const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const usersModel = require('../models/users');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

/**
 * Validar que la contraseña cumpla requisitos de seguridad:
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos un número
 * - Al menos un carácter especial (!@#$%^&*)
 */
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!hasUpperCase) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!hasNumber) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!hasSpecialChar) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }

  return { valid: true };
}

/**
 * Rate limiting: máximo 3 intentos por 15 minutos por IP
 * Evita ataques de fuerza bruta
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 3 intentos
  message: { error: 'Too many registration attempts, please try again later' },
  standardHeaders: true, // devuelve info en `RateLimit-*` headers
  legacyHeaders: false, // deshabilita `X-RateLimit-*` headers
});

/**
 * Rate limiting para login: máximo 5 intentos por 15 minutos por IP
 * Evita ataques de fuerza bruta
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/register
 * Body: { username, email, password, public_key_quantum? }
 * Respuestas:
 * - 201 Created: usuario creado exitosamente
 * - 400 Bad Request: validación fallida (username/email/password inválidos)
 * - 409 Conflict: username o email ya existe
 * - 429 Too Many Requests: rate limit excedido
 * - 500 Internal Server Error: error interno
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, public_key_quantum } = req.body;

    // Validar campos obligatorios
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password required' });
    }

    // Validar tipo de datos
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'username, email and password must be strings' });
    }

    // Validar longitud de username
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'username must be between 3 and 50 characters' });
    }

    // Validar caracteres permitidos en username (alfanuméricos, guión, guión bajo)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'username can only contain letters, numbers, underscores, and hyphens' });
    }

    // Validar formato de email
    if (!usersModel.validateEmailFormat(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validar fortaleza de contraseña
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Generar ID único
    const id = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.randomUUID)
      ? globalThis.crypto.randomUUID()
      : uuidv4();

    // Hashear contraseña
    const passwordHash = await usersModel.hashPassword(password);

    // Generar código de verificación de 6 dígitos
    const verificationCode = usersModel.generateVerificationCode();

    // Crear usuario en la base de datos
    const created = await usersModel.createUser({
      id,
      username,
      email,
      passwordHash,
      public_key_quantum: public_key_quantum || null,
      verificationCode,
    });

    // Enviar email con el código de verificación (no bloquea el registro si falla)
    let emailSent = false;
    try {
      const sendResult = await emailService.sendVerificationCode(email, username, verificationCode);
      emailSent = !!(sendResult && sendResult.success);
      if (!emailSent) {
        console.error('No se pudo enviar el email de verificación:', sendResult && sendResult.error);
      }
    } catch (e) {
      console.error('Error enviando email de verificación:', e.message);
    }

    // Log de registro exitoso
    const ip = req.ip || req.connection.remoteAddress;
    logger.logAuth('REGISTER_SUCCESS', username, ip);

    return res.status(201).json({ user: created, email_sent: emailSent });
  } catch (err) {
    console.error('Error en /api/auth/register', err);

    // Manejar error específico: constraint unique violado (username/email duplicado)
    // Código SQL: 23505 = unique_violation
    if (err.message && err.message.includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Cualquier otro error en la DB
    if (err.code && err.severity) {
      console.error(`DB Error [${err.code}]: ${err.message}`);
      return res.status(500).json({ error: 'Database error, please try again later' });
    }

    // Error genérico
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { username_or_email, password }
 * Puedes loguearte con username O con email
 * Respuestas:
 * - 200 OK: login exitoso, devuelve JWT token
 * - 400 Bad Request: username_or_email o password faltando
 * - 401 Unauthorized: credenciales inválidas
 * - 429 Too Many Requests: rate limit excedido
 * - 500 Internal Server Error: error interno
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username_or_email, password } = req.body;

    // Validar campos obligatorios
    if (!username_or_email || !password) {
      return res.status(400).json({ error: 'username_or_email and password required' });
    }

    // Validar tipo de datos
    if (typeof username_or_email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'username_or_email and password must be strings' });
    }

    // Buscar usuario por username O email
    const user = await usersModel.getUserByUsernameOrEmail(username_or_email);
    const ip = req.ip || req.connection.remoteAddress;

    // Si no existe o contraseña incorrecta
    if (!user) {
      logger.logFailedAttempt(username_or_email, ip, 'User not found');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verificar contraseña
    const passwordMatch = await usersModel.verifyPassword(password, user.password_hash);

    if (!passwordMatch) {
      logger.logFailedAttempt(username_or_email, ip, 'Invalid password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generar JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log de login exitoso
    logger.logAuth('LOGIN_SUCCESS', user.username, ip);

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        public_key_quantum: user.public_key_quantum,
      },
    });
  } catch (err) {
    console.error('Error en /api/auth/login', err);

    // Cualquier error en la DB
    if (err.code && err.severity) {
      console.error(`DB Error [${err.code}]: ${err.message}`);
      return res.status(500).json({ error: 'Database error, please try again later' });
    }

    // Error genérico
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify
 * Body: { userId, code }
 * Verificar código de verificación
 * Respuestas:
 * - 200 OK: código válido, usuario verificado
 * - 400 Bad Request: código inválido o expirado
 * - 500 Internal Server Error: error interno
 */
router.post('/verify', async (req, res) => {
  const { userId, code } = req.body;

  try {
    const result = await usersModel.validateVerificationCode(userId, code);

    if (!result.valid) {
      return res.status(400).json({ message: result.message });
    }

    // Actualizar is_verified a true
    const db = require('../config/db');
    await db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);

    return res.json({ success: true, message: 'Cuenta verificada con éxito' });
  } catch (error) {
    console.error('Error en /api/auth/verify', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Body: { userId }
 * Reenviar código de verificación
 * Respuestas:
 * - 200 OK: código reenviado
 * - 404 Not Found: usuario no existe
 * - 400 Bad Request: usuario ya verificado
 * - 429 Too Many Requests: rate limit excedido
 * - 500 Internal Server Error: error interno
 */
router.post('/resend-verification', registerLimiter, async (req, res) => {
  const { userId } = req.body;

  try {
    // Validar campos obligatorios
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Obtener usuario por ID
    const db = require('../config/db');
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verificar que no esté ya verificado
    if (user.is_verified) {
      return res.status(400).json({ error: 'User already verified' });
    }

    // Generar nuevo código de verificación
    const newCode = usersModel.generateVerificationCode();
    const codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // +5 minutos
    
    await db.query(
      'UPDATE users SET verification_code = $1, code_expires_at = $2 WHERE id = $3',
      [newCode, codeExpiresAt, userId]
    );

    // Enviar email con el nuevo código
    let emailSent = false;
    try {
      const sendResult = await emailService.sendVerificationCode(user.email, user.username, newCode);
      emailSent = !!(sendResult && sendResult.success);
      if (!emailSent) {
        console.error('No se pudo enviar el email de verificación:', sendResult && sendResult.error);
      }
    } catch (e) {
      console.error('Error enviando email de verificación:', e.message);
    }

    const ip = req.ip || req.connection.remoteAddress;
    logger.logAuth('RESEND_VERIFICATION', user.username, ip);

    return res.json({ success: true, email_sent: emailSent, message: 'Verification code resent' });
  } catch (error) {
    console.error('Error en /api/auth/resend-verification', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;