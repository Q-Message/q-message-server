const db = require('../config/db');

/**
 * Entrega mensajes pendientes a un usuario recién conectado
 * @param {Object} io - Instancia de Socket.IO
 * @param {Object} socket - Socket del usuario conectado
 * @param {Object} connectedUsers - Mapa de usuarios conectados
 */
async function deliverPendingMessages(io, socket, connectedUsers) {
  const userId = socket.userId;
  const username = socket.username;

  try {
    // Buscar mensajes pendientes para este usuario
    const pendingResult = await db.query(
      `SELECT pm.id, pm.sender_id, u.username as sender_username, pm.content, 
              pm.encrypted_content, pm.message_type, pm.sent_at, pm.initialization_vector
       FROM pending_messages pm
       JOIN users u ON pm.sender_id = u.id
       WHERE pm.recipient_id = $1
       ORDER BY pm.sent_at ASC`,
      [userId]
    );

    if (pendingResult.rows.length > 0) {
      console.log(`📬 Enviando ${pendingResult.rows.length} mensajes pendientes a ${username}`);

      // Enviar cada mensaje pendiente
      for (const msg of pendingResult.rows) {
        const messagePacket = {
          senderId: msg.sender_id,
          senderUsername: msg.sender_username,
          recipientId: userId,
          content: msg.content,
          messageType: msg.message_type || 'text',
          encryptedContent: msg.encrypted_content,
          timestamp: msg.sent_at,
          delivered: true,
          isPending: true, // Indicador de que es un mensaje pendiente entregado
        };

        socket.emit('receive-message', messagePacket);

        // Notificar al remitente (si está conectado) que el mensaje fue entregado
        if (connectedUsers[msg.sender_id]) {
          const senderSocketId = connectedUsers[msg.sender_id];
          io.to(senderSocketId).emit('message-delivered', {
            messageId: msg.sent_at,
            recipientId: userId,
            delivered: true,
          });
        }
      }

      // Eliminar mensajes pendientes de la base de datos
      await db.query(
        'DELETE FROM pending_messages WHERE recipient_id = $1',
        [userId]
      );
      console.log(`✅ Mensajes pendientes eliminados para ${username}`);
    }
  } catch (err) {
    console.error('❌ Error al recuperar mensajes pendientes:', err);
    socket.emit('pending-messages-error', {
      error: 'No se pudieron recuperar mensajes pendientes'
    });
  }
}

module.exports = deliverPendingMessages;
