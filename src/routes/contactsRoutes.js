const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * GET /api/contacts/share-link
 * Genera un link temporal para agregar como contacto
 * Requiere: JWT auth
 */
router.get('/share-link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Generar token con ID del usuario que comparte
    const token = jwt.sign(
      { inviterId: userId }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    const shareLink = `https://qmessage.info/invite/${token}`;
    
    return res.json({ 
      success: true,
      link: shareLink, 
      token: token,
      expiresIn: '24h'
    });

  } catch (err) {
    console.error('Error generating share link:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/contacts/add-from-link
 * Agrega contacto usando el token del link compartido
 * Body: { token }
 * Requiere: JWT auth
 */
router.post('/add-from-link', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token requerido' });
    }

    // Decodificar token para obtener ID del usuario que compartió
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const inviterId = decoded.inviterId;

    // Validar que no te agregues a ti mismo
    if (currentUserId === inviterId) {
      return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
    }

    // Verificar que ambos usuarios existan
    const inviterResult = await db.query('SELECT id, username FROM users WHERE id = $1', [inviterId]);
    if (inviterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que no sean ya contactos
    const existingContact = await db.query(
      'SELECT * FROM contacts WHERE user_id = $1 AND contact_id = $2',
      [currentUserId, inviterId]
    );

    if (existingContact.rows.length > 0) {
      return res.status(409).json({ error: 'Ya son contactos' });
    }

    // Datos del usuario actual (quien acepta/agrega)
    const currentUserResult = await db.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [currentUserId]
    );

    // Agregar contacto (bidireccional)
    await db.query(
      'INSERT INTO contacts (user_id, contact_id, created_at) VALUES ($1, $2, NOW()), ($2, $1, NOW())',
      [currentUserId, inviterId]
    );

    // Notificar en tiempo real al invitador (si está conectado)
    const inviterSocketId = req.connectedUsers ? req.connectedUsers[inviterId] : null;
    if (inviterSocketId && req.io) {
      req.io.to(inviterSocketId).emit('contact-added', {
        userId: currentUserResult.rows[0].id,
        username: currentUserResult.rows[0].username,
        email: currentUserResult.rows[0].email,
        addedAt: new Date().toISOString(),
      });
    }

    return res.json({ 
      success: true, 
      message: 'Contacto agregado correctamente',
      contact: {
        id: inviterResult.rows[0].id,
        username: inviterResult.rows[0].username
      }
    });

  } catch (err) {
    console.error('Error adding contact:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/contacts
 * Lista todos los contactos del usuario autenticado
 * Requiere: JWT auth
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      `SELECT u.id, u.username, u.email, c.created_at as added_at
       FROM contacts c
       JOIN users u ON c.contact_id = u.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return res.json({ 
      success: true,
      contacts: result.rows 
    });

  } catch (err) {
    console.error('Error fetching contacts:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/contacts/:contactId
 * Elimina un contacto
 * Requiere: JWT auth
 */
router.delete('/:contactId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const contactId = req.params.contactId;

    // Datos del usuario que elimina (para informar al otro)
    const currentUserResult = await db.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );

    // Eliminar relación bidireccional
    await db.query(
      'DELETE FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1)',
      [userId, contactId]
    );

    // Notificar en tiempo real al contacto eliminado (si está conectado)
    const contactSocketId = req.connectedUsers ? req.connectedUsers[contactId] : null;
    if (contactSocketId && req.io) {
      req.io.to(contactSocketId).emit('contact-removed', {
        userId: currentUserResult.rows[0].id,
        username: currentUserResult.rows[0].username,
        removedAt: new Date().toISOString(),
      });
    }

    return res.json({ 
      success: true,
      message: 'Contacto eliminado correctamente' 
    });

  } catch (err) {
    console.error('Error deleting contact:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;