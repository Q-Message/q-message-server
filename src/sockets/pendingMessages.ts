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
    const pendingResult = await query(
      `SELECT pm.id, pm.sender_id, u.username as sender_username, pm.content, 
              pm.encrypted_content, pm.message_type, pm.sent_at, pm.initialization_vector
       FROM pending_messages pm
       JOIN users u ON pm.sender_id = u.id
       WHERE pm.recipient_id = $1
       ORDER BY pm.sent_at ASC`,
      [userId]
    );

    // Casteamos el resultado a nuestra interfaz
    const rows = pendingResult.rows as PendingMessageRow[];

    if (rows.length > 0) {
      console.log(`Enviando ${rows.length} mensajes pendientes a ${username}`);

      for (const msg of rows) {
        
        // Construimos el paquete siguiendo la interfaz MessagePacket
        const messagePacket: MessagePacket = {
          senderId: msg.sender_id,
          senderUsername: msg.sender_username,
          recipientId: userId,
          content: msg.content,
          messageType: msg.message_type || 'text',
          encryptedContent: msg.encrypted_content,
          // Convertimos el Date de Postgres a String ISO para el JSON
          timestamp: new Date(msg.sent_at).toISOString(),
          iv: msg.initialization_vector,
          delivered: true,
          isPending: true, // Marca visual para el frontend (ej: icono diferente)
        };

        // Emitir al usuario que se acaba de conectar
        socket.emit('receive-message', messagePacket);

        const senderSocketId = connectedUsers[msg.sender_id];
        if (senderSocketId) {
          io.to(senderSocketId).emit('message-delivered', {
            messageId: messagePacket.timestamp, // Usamos la fecha original como ID
            recipientId: userId,
            delivered: true,
          });
        }
      }

      await query(
        'DELETE FROM pending_messages WHERE recipient_id = $1',
        [userId]
      );
      console.log(`Mensajes pendientes eliminados de DB para ${username}`);
    }
  } catch (err) {
    console.error('Error al recuperar mensajes pendientes:', err);
    // TypeScript nos obliga a que el objeto de error coincida con la interfaz del evento
    socket.emit('message-error', {
      error: 'Error recuperando historial de mensajes'
    });
  }
}