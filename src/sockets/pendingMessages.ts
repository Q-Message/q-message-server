import { Server, Socket } from 'socket.io';
import { query } from '../config/db';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData, 
  ConnectedUsersMap,
  MessagePacket 
} from '../types/index';

// Definimos qué pinta tiene una fila cruda de la base de datos
// para que TypeScript sepa qué devuelve el SELECT
interface PendingMessageRow {
  id: number;
  sender_id: string;
  sender_username: string;
  content: string;
  encrypted_content: string;
  message_type: string;
  sent_at: Date; // Postgres devuelve Date, no string
  initialization_vector: string;
  encapsulated_key: string;
}

/**
 * Entrega mensajes pendientes a un usuario recién conectado
 */
export default async function deliverPendingMessages(
  io: any,
  socket: any,
  connectedUsers: any
) {
  // Recuperar datos del socket (usando .data preferiblemente)
  const userId = socket.data.userId || (socket as any).userId;
  const username = socket.data.username || (socket as any).username;

  if (!userId) return;

  try {
    // CTE atómico: borra y devuelve los mensajes en una sola operación,
    // eliminando la race condition entre el socket y el endpoint REST.
    const pendingResult = await query(
      `WITH deleted AS (
         DELETE FROM pending_messages WHERE recipient_id = $1 RETURNING *
       )
       SELECT d.id, d.sender_id, u.username AS sender_username, d.content,
              d.encrypted_content, d.message_type, d.sent_at, d.initialization_vector,
              d.encapsulated_key
       FROM deleted d
       JOIN users u ON d.sender_id = u.id
       ORDER BY d.sent_at ASC`,
      [userId]
    );

    const rows = pendingResult.rows as PendingMessageRow[];

    if (rows.length > 0) {
      console.log(`Enviando ${rows.length} mensajes pendientes a ${username}`);

      for (const msg of rows) {
        const messagePacket: MessagePacket = {
          senderId: msg.sender_id,
          senderUsername: msg.sender_username,
          recipientId: userId,
          content: msg.content,
          messageType: msg.message_type || 'text',
          encryptedContent: msg.encrypted_content,
          timestamp: new Date(msg.sent_at).toISOString(),
          iv: msg.initialization_vector,
          encapsulatedKey: msg.encapsulated_key,
          delivered: true,
          isPending: true,
        };

        socket.emit('receive-message', messagePacket);

        const senderSocketId = connectedUsers[msg.sender_id];
        if (senderSocketId) {
          io.to(senderSocketId).emit('message-delivered', {
            messageId: messagePacket.timestamp,
            recipientId: userId,
            delivered: true,
          });
        }
      }

      console.log(`${rows.length} mensajes pendientes entregados a ${username}`);
    }
  } catch (err) {
    console.error('Error al recuperar mensajes pendientes:', err);
    // TypeScript nos obliga a que el objeto de error coincida con la interfaz del evento
    socket.emit('message-error', {
      error: 'Error recuperando historial de mensajes'
    });
  }
}