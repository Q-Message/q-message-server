import { Server, Socket } from 'socket.io';
import { query } from '../config/db';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData, 
  ConnectedUsersMap,
  MessagePacket // Importamos la interfaz del paquete
} from '../types/index';


export default function setupMessageHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  connectedUsers: ConnectedUsersMap
) {
  // Usamos socket.data (best practice) o fallback a la propiedad directa
  const userId = socket.data.userId || (socket as any).userId;
  const username = socket.data.username || (socket as any).username;

  if (!userId) return; // Seguridad extra

  /**
   * EVENTO: send-message
   */
  socket.on('send-message', async (data) => {
    // TypeScript sabe que 'data' es de tipo MessagePayload
    const { recipientId, content, messageType = 'text', encryptedContent, iv } = data;
    const timestamp = new Date().toISOString();

    if (!recipientId) {
      console.error(`Error: recipientId faltante en mensaje de ${username}`);
      socket.emit('message-error', { error: 'recipientId requerido' });
      return;
    }
    
    if (!content && !encryptedContent) {
      console.error(`Error: Mensaje vacío de ${username}`);
      socket.emit('message-error', { error: 'Se requiere contenido o encryptedContent' });
      return;
    }

    const messagePacket: MessagePacket = {
      senderId: userId,
      senderUsername: username,
      recipientId,
      content,
      messageType,
      encryptedContent, 
      iv,              
      timestamp,
      delivered: false,
    };

    const recipientSocketId = connectedUsers[recipientId];

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive-message', messagePacket);
      
      messagePacket.delivered = true;
      console.log(`Mensaje entregado en tiempo real: ${username} -> ${recipientId}`);

      // Confirmación al remitente
      socket.emit('message-delivered', {
        messageId: timestamp,
        recipientId,
        delivered: true,
      });

    } else {
      try {
        await query(
          `INSERT INTO pending_messages 
           (sender_id, recipient_id, encrypted_content, sent_at, content, message_type, initialization_vector)
           VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
          [
            userId, 
            recipientId, 
            encryptedContent || content, // Fallback si no hay cifrado
            content, 
            messageType,
            iv || null // Guardamos el IV si existe
          ]
        );
        console.log(`Mensaje guardado en buzón (Offline): ${username} -> ${recipientId}`);
      } catch (err) {
        console.error('Error guardando mensaje pendiente:', err);
        // Podrías emitir un error al cliente aquí si quieres
      }

      // Notificar al remitente que quedó en "Pending" (un tick gris)
      socket.emit('message-pending', {
        messageId: timestamp,
        recipientId,
        delivered: false,
      });
    }
  });

  /**
   * EVENTO: typing-indicator
   */
  socket.on('typing-indicator', (data) => {
    const { recipientId, isTyping } = data;
    const recipientSocketId = connectedUsers[recipientId];

    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user-typing', {
        senderId: userId,
        senderUsername: username,
        isTyping,
      });
    }
  });

  /**
   * EVENTO: message-read
   */
  socket.on('message-read', (data) => {
    const { senderId, messageId } = data;
    const senderSocketId = connectedUsers[senderId];

    if (senderSocketId) {
      io.to(senderSocketId).emit('message-read-receipt', {
        readBy: username,
        messageId,
        readAt: new Date().toISOString(),
      });
    }
  });
}