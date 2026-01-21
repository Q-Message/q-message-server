const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * GET /api/messages/:contactId
 * Recupera el historial de mensajes pendientes con un contacto
 * Solo muestra mensajes que llegaron offline (en pending_messages)
 * Requiere: JWT auth
 */
router.get('/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactId = req.params.contactId;

    // Validar que son contactos
    const contactCheck = await db.query(
      'SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2',
      [userId, contactId]
    );

    if (contactCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No eres contacto de este usuario' });
    }

    // Recuperar mensajes pendientes de este contacto (más antiguos primero)
    const result = await db.query(
      `SELECT 
         id, sender_id as senderId, recipient_id as recipientId, 
         content, encrypted_content as encryptedContent, 
         message_type as messageType, 
         sent_at as timestamp
       FROM pending_messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY sent_at ASC`,
      [userId, contactId]
    );

    return res.json({
      success: true,
      messages: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Error fetching messages:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/messages/pending
 * Recupera todos los mensajes pendientes para el usuario autenticado
 * (Mensajes que llegaron mientras estaba offline)
 * Requiere: JWT auth
 */
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Todos los mensajes pendientes para este usuario
    const result = await db.query(
      `SELECT 
         id, sender_id as senderId, recipient_id as recipientId,
         content, encrypted_content as encryptedContent,
         message_type as messageType,
         sent_at as timestamp
       FROM pending_messages
       WHERE recipient_id = $1
       ORDER BY sent_at ASC`,
      [userId]
    );

    // Eliminar mensajes pendientes después de entregarlos
    if (result.rows.length > 0) {
      await db.query(
        'DELETE FROM pending_messages WHERE recipient_id = $1',
        [userId]
      );
    }

    return res.json({
      success: true,
      messages: result.rows,
      count: result.rows.length
    });

  } catch (err) {
    console.error('Error fetching pending messages:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
