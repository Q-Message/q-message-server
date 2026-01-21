const express = require('express');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const contactRoutes = require('./src/routes/contactsRoutes');
const messagesRoutes = require('./src/routes/messages');

// ============ VALIDACIONES DE SEGURIDAD EN STARTUP ============
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('❌ ERROR: JWT_SECRET no configurado o muy débil (mín 32 caracteres)');
  process.exit(1);
}
if (!process.env.CORS_ORIGIN) {
  console.error('❌ ERROR: CORS_ORIGIN no configurado en .env');
  process.exit(1);
}
console.log('✅ Configuración de seguridad validada');

const app = express();

// ============ SEGURIDAD: Headers HTTP con Helmet ============
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitar CSP si causa problemas con Socket.io
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
console.log('✅ Helmet.js activado (headers de seguridad HTTP)');

// Configuración de CORS
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Confía en el Proxy (Cloudflare/Nginx) para obtener la IP real del usuario
app.set('trust proxy', true);

app.use(express.json());

// Nginx hace el "Offloading".
const server = http.createServer(app);
console.log('✅ Servidor funcionando en modo HTTP (detrás de Proxy Nginx)');

// ============ SOCKET.IO ============
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Mapeo de usuarios conectados: { userId: socketId }
const connectedUsers = {};

// Inyectar referencias en cada request para que las rutas emitan eventos
app.use((req, res, next) => {
  req.io = io;
  req.connectedUsers = connectedUsers;
  next();
});

// Rutas de la API (después de inyectar io)
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messagesRoutes);

// Middleware: Autenticar socket con JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Token no proporcionado'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  } catch (err) {
    next(new Error('Token inválido'));
  }
});

// Evento: Usuario conectado
io.on('connection', (socket) => {
  const userId = socket.userId;
  const username = socket.username;

  // Registrar usuario conectado
  connectedUsers[userId] = socket.id;
  console.log(`✅ Usuario conectado: ${username} (${userId}) - Socket: ${socket.id}`);
  console.log(`📊 Usuarios conectados: ${Object.keys(connectedUsers).length}`);

  // ========== EVENTOS DE MENSAJERÍA ==========

  /**
   * EVENTO: send-message
   * Cliente envía: { recipientId, content, messageType?, encryptedContent? }
   * Servidor reenvía al destinatario o lo almacena si no está en línea
   */
  socket.on('send-message', async (data) => {
    const { recipientId, content, messageType = 'text', encryptedContent } = data;
    const timestamp = new Date().toISOString();

    // Crear paquete de mensaje
    const messagePacket = {
      senderId: userId,
      senderUsername: username,
      recipientId,
      content,
      messageType,
      encryptedContent,
      timestamp,
      delivered: false,
    };

    // Si el destinatario está conectado, enviarle el mensaje
    if (connectedUsers[recipientId]) {
      const recipientSocketId = connectedUsers[recipientId];
      io.to(recipientSocketId).emit('receive-message', messagePacket);
      messagePacket.delivered = true;
      console.log(`📨 Mensaje entregado: ${username} → ${recipientId}`);

      // Confirmar entrega al remitente
      socket.emit('message-delivered', {
        messageId: messagePacket.timestamp,
        recipientId,
        delivered: true,
      });
    } else {
      // Guardar en pending_messages si está offline
      try {
        await db.query(
          `INSERT INTO pending_messages (sender_id, recipient_id, content, encrypted_content, message_type, sent_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [userId, recipientId, content, encryptedContent, messageType]
        );
        console.log(`📦 Mensaje guardado en pending: ${username} → ${recipientId}`);
      } catch (err) {
        console.error('Error saving pending message:', err);
      }

      socket.emit('message-pending', {
        messageId: messagePacket.timestamp,
        recipientId,
        delivered: false,
      });
    }
  });

  /**
   * EVENTO: typing-indicator
   * Cliente notifica que está escribiendo
   */
  socket.on('typing-indicator', (data) => {
    const { recipientId, isTyping } = data;

    if (connectedUsers[recipientId]) {
      const recipientSocketId = connectedUsers[recipientId];
      io.to(recipientSocketId).emit('user-typing', {
        senderId: userId,
        senderUsername: username,
        isTyping,
      });
    }
  });

  /**
   * EVENTO: message-read
   * Cliente confirma que leyó un mensaje
   */
  socket.on('message-read', (data) => {
    const { senderId, messageId } = data;

    if (connectedUsers[senderId]) {
      const senderSocketId = connectedUsers[senderId];
      io.to(senderSocketId).emit('message-read-receipt', {
        readBy: username,
        messageId,
        readAt: new Date().toISOString(),
      });
    }
  });

  /**
   * EVENTO: online-status
   * Broadcast del estado de conectividad del usuario
   */
  socket.on('set-status', (data) => {
    const { status } = data; // 'online', 'away', 'offline'
    socket.status = status;

    // Notificar a todos los contactos
    io.emit('user-status-changed', {
      userId,
      username,
      status,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * EVENTO: get-online-users
   * Cliente solicita lista de usuarios conectados
   */
  socket.on('get-online-users', () => {
    const onlineUsers = Object.entries(connectedUsers).map(([uId, sId]) => ({
      userId: uId,
      socketId: sId,
    }));
    socket.emit('online-users-list', onlineUsers);
  });

  // ========== MANEJO DE DESCONEXIONES ==========

  socket.on('disconnect', () => {
    delete connectedUsers[userId];
    console.log(`❌ Usuario desconectado: ${username} (${userId})`);
    console.log(`📊 Usuarios conectados: ${Object.keys(connectedUsers).length}`);

    // Notificar a otros usuarios que este se desconectó
    io.emit('user-went-offline', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('error', (error) => {
    console.error(`⚠️ Error en socket ${socket.id}:`, error);
  });
});

console.log('✅ Socket.io configurado como orquestador de mensajes en tiempo real');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Seguridad: Solo acepta peticiones internas de Nginx

server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Q-Message encendido internamente en ${HOST}:${PORT}`);
  console.log(`🌍 Acceso público vía: https://api.qmessage.net`);
});