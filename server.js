const express = require('express');
const http = require('http');
const helmet = require('helmet');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const contactRoutes = require('./src/routes/contactsRoutes');
const messagesRoutes = require('./src/routes/messages');

// Importar módulos de sockets
const deliverPendingMessages = require('./src/sockets/pendingMessages');
const setupMessageHandlers = require('./src/sockets/messageHandlers');
const setupConnectionHandlers = require('./src/sockets/connectionHandlers');

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
io.on('connection', async (socket) => {
  const userId = socket.userId;
  const username = socket.username;

  // Registrar usuario conectado
  connectedUsers[userId] = socket.id;
  console.log(`✅ Usuario conectado: ${username} (${userId}) - Socket: ${socket.id}`);
  console.log(`📊 Usuarios conectados: ${Object.keys(connectedUsers).length}`);

  // Entregar mensajes pendientes
  await deliverPendingMessages(io, socket, connectedUsers);

  // Configurar handlers de mensajería
  setupMessageHandlers(io, socket, connectedUsers);

  // Configurar handlers de conexión/desconexión
  setupConnectionHandlers(io, socket, connectedUsers);
});

console.log('✅ Socket.io configurado como orquestador de mensajes en tiempo real');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1'; // Seguridad: Solo acepta peticiones internas de Nginx

server.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor Q-Message encendido internamente en ${HOST}:${PORT}`);
  console.log(`🌍 Acceso público vía: https://api.qmessage.net`);
});