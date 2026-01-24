import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

// Controladores de contactos
export async function shareLink(req: Request, res: Response) {
	try {
		const userId = (req as any).user.userId;
		const token = jwt.sign(
			{ inviterId: userId },
			process.env.JWT_SECRET as string,
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
}


// Agrega un contacto usando un enlace compartido
export async function addFromLink(req: Request, res: Response) {
	try {
		const currentUserId = (req as any).user.userId;
		const { token } = req.body;
		if (!token) {
			return res.status(400).json({ error: 'Token requerido' });
		}
		let decoded: any;
		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET as string);
		} catch (err) {
			return res.status(401).json({ error: 'Token inválido o expirado' });
		}
		const inviterId = decoded.inviterId;
		if (currentUserId === inviterId) {
			return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
		}
		const inviterResult = await query('SELECT id, username, email, public_key_quantum FROM users WHERE id = $1', [inviterId]);
		if (inviterResult.rows.length === 0) {
			return res.status(404).json({ error: 'Usuario no encontrado' });
		}
		const existingContact = await query(
			'SELECT * FROM contacts WHERE user_id = $1 AND contact_id = $2',
			[currentUserId, inviterId]
		);
		if (existingContact.rows.length > 0) {
			return res.status(409).json({ error: 'Ya son contactos' });
		}
		const currentUserResult = await query(
			'SELECT id, username, email, public_key_quantum FROM users WHERE id = $1',
			[currentUserId]
		);
		await query(
			'INSERT INTO contacts (user_id, contact_id, created_at) VALUES ($1, $2, NOW()), ($2, $1, NOW())',
			[currentUserId, inviterId]
		);
		const inviterSocketId = (req as any).connectedUsers ? (req as any).connectedUsers[inviterId] : null;
		if (inviterSocketId && (req as any).io) {
			(req as any).io.to(inviterSocketId).emit('contact-added', {
				userId: currentUserResult.rows[0].id,
				username: currentUserResult.rows[0].username,
				email: currentUserResult.rows[0].email,
				public_key_quantum: currentUserResult.rows[0].public_key_quantum,
				addedAt: new Date().toISOString(),
			});
		}
		return res.json({
			success: true,
			message: 'Contacto agregado correctamente',
			contact: {
				id: inviterResult.rows[0].id,
				username: inviterResult.rows[0].username,
				email: inviterResult.rows[0].email,
				public_key_quantum: inviterResult.rows[0].public_key_quantum
			}
		});
	} catch (err) {
		console.error('Error adding contact:', err);
		return res.status(500).json({ error: 'Error interno del servidor' });
	}
}

// Lista los contactos del usuario
export async function listContacts(req: Request, res: Response) {
	try {
		const userId = (req as any).user.userId;
		const result = await query(
			`SELECT u.id, u.username, u.email, u.public_key_quantum, c.created_at as added_at
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
}

export async function deleteContact(req: Request, res: Response) {
	try {
		const userId = (req as any).user.userId;
		const contactId = req.params.contactId;
		const currentUserResult = await query(
			'SELECT id, username FROM users WHERE id = $1',
			[userId]
		);
		await query(
			'DELETE FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1)',
			[userId, contactId]
		);
		const contactSocketId = (req as any).connectedUsers ? (req as any).connectedUsers[contactId] : null;
		if (contactSocketId && (req as any).io) {
			(req as any).io.to(contactSocketId).emit('contact-removed', {
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
}
