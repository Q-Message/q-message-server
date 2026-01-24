import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { getPendingMessages, getMessagesWithContact } from '../controllers/messagesController';

const router = express.Router();

// Rutas de mensajes
router.get('/pending', authenticateToken, getPendingMessages);
router.get('/:contactId', authenticateToken, getMessagesWithContact);

export default router;