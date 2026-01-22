const db = require('../config/db');

/**
 * Configura todos los handlers de mensajería para un socket
 * @param {Object} io - Instancia de Socket.IO
 * @param {Object} socket - Socket del usuario conectado
 * @param {Object} connectedUsers - Mapa de usuarios conectados
 */
function setupMessageHandlers(io, socket, connectedUsers) {
  const userId = socket.userId;
  const username = socket.username;

  /**
   * EVENTO: send-message
   * Cliente envía: { recipientId, content, messageType?, encryptedContent? }
   * Servidor reenvía al destinatario o lo almacena si no está en línea
   */
  socket.on('send-message', async (data) => {
    const { recipientId, content, messageType = 'text', encryptedContent } = data;
    const timestamp = new Date().toISOString();

    // Validar datos mínimos
    if (!recipientId) {
      console.error('recipientId vacío o null en send-message');
      socket.emit('message-error', { error: 'recipientId requerido' });
      return;
    }
    if (!content && !encryptedContent) {
      console.error('content vacío y sin encryptedContent en send-message');
      socket.emit('message-error', { error: 'content o encryptedContent requerido' });
      return;
    }

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
          `INSERT INTO pending_messages (sender_id, recipient_id, encrypted_content, sent_at, content, message_type, initialization_vector)
           VALUES ($1, $2, $3, NOW(), $4, $5, NULL)`,
          [userId, recipientId, encryptedContent || content, content, messageType || 'text']
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
}

module.exports = setupMessageHandlers;
