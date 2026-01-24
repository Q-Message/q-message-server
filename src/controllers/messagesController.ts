import { Request, Response } from 'express';
import { query } from '../config/db';

export async function getPendingMessages(req: Request, res: Response) {
	try {
		const userId = (req as any).user?.userId;
		if (!userId) {
			res.status(401).json({ error: 'Usuario no identificado' });
			return;
		}
		const result = await query(
			`SELECT 
				 id, sender_id as "senderId", recipient_id as "recipientId",
				 content, encrypted_content as "encryptedContent",
				 message_type as "messageType",
				 sent_at as "timestamp"
			 FROM pending_messages
			 WHERE recipient_id = $1
			 ORDER BY sent_at ASC`,
			[userId]
		);
		const messages = result.rows;
		if (result.rows.length > 0) {
			await query(
				'DELETE FROM pending_messages WHERE recipient_id = $1',
				[userId]
			);
		}
		res.json({
			success: true,
			messages: messages,
			count: messages.length
		});
	} catch (err) {
		console.error('Error fetching pending messages:', err);
		res.status(500).json({ error: 'Error interno del servidor' });
	}
}

export async function getMessagesWithContact(req: Request, res: Response) {
	try {
		const userId = (req as any).user?.userId;
		const contactId = req.params.contactId;
		if (!userId) {
			res.status(401).json({ error: 'Usuario no identificado' });
			return;
		}
		const contactCheck = await query(
			'SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2',
			[userId, contactId]
		);
		if (contactCheck.rows.length === 0) {
			res.status(403).json({ error: 'No eres contacto de este usuario' });
			return; 
		}
		const result = await query(
			`SELECT 
				 id, sender_id as "senderId", recipient_id as "recipientId", 
				 content, encrypted_content as "encryptedContent", 
				 message_type as "messageType", 
				 sent_at as "timestamp"
			 FROM pending_messages
			 WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
			 ORDER BY sent_at ASC`,
			[userId, contactId]
		);
		const messages = result.rows;
		res.json({
			success: true,
			messages: messages,
			count: messages.length
		});
	} catch (err) {
		console.error('Error fetching messages:', err);
		res.status(500).json({ error: 'Error interno del servidor' });
	}
}
