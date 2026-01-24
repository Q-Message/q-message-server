import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { shareLink, addFromLink, listContacts, deleteContact } from '../controllers/contactsController';

const router = express.Router();

// Rutas de contactos
router.get('/share-link', authenticateToken, shareLink);
router.post('/add-from-link', authenticateToken, addFromLink);
router.get('/', authenticateToken, listContacts);
router.delete('/:contactId', authenticateToken, deleteContact);

export default router;
