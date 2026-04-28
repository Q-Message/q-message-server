import { Server, Socket } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  ConnectedUsersMap
} from '../types/index';

export default function setupConnectionHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  connectedUsers: ConnectedUsersMap
) {
  // La autenticación del socket (evento 'register') se gestiona únicamente en server.ts.
  // Aquí solo se montan los handlers de estado, presencia y desconexión.

  // El resto de eventos solo funcionarán si el usuario está autenticado
  socket.on('set-status', (data) => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    if (!userId || !username) return;
    const { status } = data;
    socket.data.status = status;
    io.emit('user-status-changed', {
      userId,
      username,
      status: status,
      timestamp: new Date().toISOString(),
    });
    console.log(`Estado actualizado: ${username} -> ${status}`);
  });

  // EVENTO: Pedir lista de usuarios
  socket.on('get-online-users', () => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    if (!userId || !username) return;
    const onlineUsers = Object.entries(connectedUsers).map(([uId, sId]) => ({
      userId: uId,
      socketId: sId,
    }));
    socket.emit('online-users-list', onlineUsers);
  });

  // EVENTO: Desconexión
  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    const username = socket.data.username;
    if (userId && connectedUsers[userId] === socket.id) {
      delete connectedUsers[userId];
    }
    if (userId && username) {
      console.log(`Usuario desconectado: ${username} (${userId})`);
      io.emit('user-went-offline', {
        userId,
        username,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Log más informativo para sockets no autenticados
      let ip = socket.handshake.headers['x-forwarded-for'] as string | undefined;
      if (ip) {
        ip = ip.split(',')[0].trim();
      } else {
        ip = socket.handshake.address;
      }
      console.log(`Socket desconectado sin autenticar: id=${socket.id} | ip=${ip}`);
    }
    console.log(`Usuarios conectados: ${Object.keys(connectedUsers).length}`);
  });

  // EVENTO: Error
  socket.on('error', (error) => {
    console.error(`Error en socket ${socket.id}:`, error);
  });
}