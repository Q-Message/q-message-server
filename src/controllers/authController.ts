import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as usersModel from '../models/users';
import * as logger from '../utils/logger';
import * as emailService from '../utils/emailService';
import { query } from '../config/db';
import jwt from 'jsonwebtoken';

interface RegisterBody {
	username: string;
	email: string;
	password: string;
	public_key_quantum?: string;
}

interface LoginBody {
	username: string;
	password: string;
}

interface VerifyBody {
	userId: string;
	code: string;
}

interface ResendBody {
	userId: string;
}

interface PasswordValidation {
	valid: boolean;
	message?: string;
}

// Valida la fortaleza de la contraseña
function validatePasswordStrength(password: string): PasswordValidation {
	const minLength = 8;
	const hasUpperCase = /[A-Z]/.test(password);
	const hasNumber = /\d/.test(password);
	const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
	if (password.length < minLength) {
		return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
	}
	if (!hasUpperCase) {
		return { valid: false, message: 'Debe contener al menos una mayúscula' };
	}
	if (!hasNumber) {
		return { valid: false, message: 'Debe contener al menos un número' };
	}
	if (!hasSpecialChar) {
		return { valid: false, message: 'Debe contener un carácter especial (!@#$%^&*)' };
	}
	return { valid: true };
}

// Controladores de autenticación
export async function register(req: Request<{}, {}, RegisterBody>, res: Response) {
	try {
		const { username, email, password, public_key_quantum } = req.body;
		if (!username || !email || !password) {
			return res.status(400).json({ error: 'Campos obligatorios' });
		}
		if (!usersModel.validateEmailFormat(email)) {
			return res.status(400).json({ error: 'Email inválido' });
		}
		const passVal = validatePasswordStrength(password);
		if (!passVal.valid) {
			return res.status(400).json({ error: passVal.message });
		}
		const id = uuidv4();
		const passwordHash = await usersModel.hashPassword(password);
		const verificationCode = usersModel.generateVerificationCode();
		const created = await usersModel.createUser({
			id,
			username,
			email,
			passwordHash,
			public_key_quantum: public_key_quantum || undefined,
			verificationCode
		});
		let emailSent = false;
		try {
			const sendResult = await emailService.sendVerificationCode(email, username, verificationCode);
			emailSent = !!(sendResult && sendResult.success);
		} catch (e) {
			const error = e as Error;
			console.error('Error enviando email:', error.message);
		}
		const ip = req.ip || (req.connection as any)?.remoteAddress || 'unknown';
		logger.logAuth('REGISTER_SUCCESS', username, ip);
		return res.status(201).json({
			success: true,
			message: 'Registro completado',
			user: { id: created.id },
			email_sent: emailSent
		});
	} catch (err) {
		const error = err as Error;
		console.error('Error en register:', error);
		if (error.message && error.message.includes('exists')) {
			return res.status(409).json({ error: error.message });
		}
		return res.status(500).json({ error: 'Error interno del servidor' });
	}
}

// Controlador de login
export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
	try {
		const { username, password } = req.body;
		if (!username || !password) {
			return res.status(400).json({ error: 'Faltan credenciales' });
		}
		const user = await usersModel.getUserByUsername(username);
		if (!user) {
			return res.status(401).json({ error: 'Credenciales inválidas' });
		}
		const isValidPassword = await usersModel.verifyPassword(password, user.password_hash);
		if (!isValidPassword) {
			logger.logAuth('LOGIN_FAILED', username, req.ip || 'unknown');
			return res.status(401).json({ error: 'Credenciales inválidas' });
		}
		if (!user.is_verified) {
			return res.status(403).json({
				error: 'Cuenta no verificada',
				message: 'Verifica tu email',
				user: { id: user.id }
			});
		}
		if (!process.env.JWT_SECRET) {
			console.error('CRÍTICO: JWT_SECRET no está configurado');
			return res.status(500).json({ error: 'Error de configuración del servidor' });
		}
		const token = jwt.sign(
			{ userId: user.id, username: user.username },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);
		logger.logAuth('LOGIN_SUCCESS', username, req.ip || 'unknown');
		return res.status(200).json({
			success: true,
			token,
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				public_key_quantum: user.public_key_quantum
			}
		});
	} catch (err) {
		console.error('Error en login:', err);
		return res.status(500).json({ error: 'Error interno' });
	}
}

// Controlador de verificación de cuenta
export async function verify(req: Request<{}, {}, VerifyBody>, res: Response) {
	try {
		const { userId, code } = req.body;
		const result = await usersModel.validateVerificationCode(userId, code);
		if (!result.valid) {
			return res.status(400).json({ error: result.message });
		}
		const user = await usersModel.getUserById(userId);
		if (!user) {
			return res.status(404).json({ error: 'Usuario no encontrado' });
		}
		await query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);
		emailService.sendWelcomeEmail(user.email, user.username)
			.catch((err: Error) => console.error('Error enviando email de bienvenida:', err.message));
		return res.json({ success: true, message: 'Cuenta verificada correctamente' });
	} catch (error) {
		console.error('Error en verify:', error);
		return res.status(500).json({ error: 'Error en verificación' });
	}
}

// Controlador para reenviar código de verificación
export async function resend(req: Request<{}, {}, ResendBody>, res: Response) {
	try {
		const { userId } = req.body;
		const user = await usersModel.getUserById(userId);
		if (!user) {
			return res.status(404).json({ error: 'Usuario no encontrado' });
		}
		const newCode = usersModel.generateVerificationCode();
		await usersModel.updateVerificationCode(userId, newCode);
		let emailSent = false;
		try {
			const sendResult = await emailService.sendVerificationCode(user.email, user.username, newCode);
			emailSent = !!(sendResult && sendResult.success);
		} catch (e) {
			const error = e as Error;
			console.error('Error enviando email:', error.message);
		}
		return res.json({ success: true, message: 'Código reenviado', email_sent: emailSent });
	} catch (error) {
		console.error('Error en resend:', error);
		return res.status(500).json({ error: 'Error interno' });
	}
}
