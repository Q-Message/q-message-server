import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import helmet from 'helmet';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

import './config/db';
import authRoutes from './routes/authRoutes';
import contactRoutes from './routes/contactsRoutes';
import messagesRoutes from './routes/messages';
import deliverPendingMessages from './sockets/pendingMessages';
import setupMessageHandlers from './sockets/messageHandlers';
import setupConnectionHandlers from './sockets/connectionHandlers';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData, ConnectedUsersMap } from './types/index';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('ERROR: JWT_SECRET no configurado o muy débil (mín 32 caracteres)');
  process.exit(1);
}

const CORS_ORIGIN = process.env.CORS_ORIGIN;
if (!CORS_ORIGIN) {
  console.error('ERROR: CORS_ORIGIN no configurado en .env');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // Permite que express-rate-limit y otros middleware confíen en X-Forwarded-For
app.use(helmet());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/messages', messagesRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const connectedUsers: ConnectedUsersMap = {};

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
  // Solo montamos los handlers de conexión al principio
  setupConnectionHandlers(io, socket, connectedUsers);

  // Esperamos a que el socket se autentique para montar los demás handlers
  socket.on('register', function onRegister(token: string) {
    // Si el socket ya está autenticado, evitamos doble registro
    if (socket.data._handlersMounted) return;
    // Verificamos el token igual que en connectionHandlers
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; username: string };
      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username;
      connectedUsers[decoded.userId] = socket.id;
      socket.data._handlersMounted = true;
      // Montamos los handlers de mensajes y pendientes SOLO tras autenticar
      setupMessageHandlers(io, socket, connectedUsers);
      deliverPendingMessages(io, socket, connectedUsers);
      // Log de autenticación (ya lo hace connectionHandlers, pero por si acaso)
      let ip = socket.handshake.headers['x-forwarded-for'] as string | undefined;
      if (ip) {
        ip = ip.split(',')[0].trim();
      } else {
        ip = socket.handshake.address;
      }
      console.log(`Socket autenticado: ${decoded.username} (${decoded.userId}) | ip: ${ip}`);
    } catch (err) {
      socket.emit('message-error', { error: 'Token inválido o expirado' });
      socket.disconnect();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
