const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const usersModel = require('../models/users');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

/**
 * Validación de seguridad para la contraseña
 */
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
  if (!hasUpperCase) return { valid: false, message: 'Debe contener al menos una mayúscula' };
  if (!hasNumber) return { valid: false, message: 'Debe contener al menos un número' };
  if (!hasSpecialChar) return { valid: false, message: 'Debe contener un carácter especial (!@#$%^&*)' };

  return { valid: true };
}

// Limitadores de intentos (Seguridad)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de registro, prueba más tarde' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiados intentos de login, prueba más tarde' }
});

// =========================================================================
//  RUTAS CLÁSICAS (Login, Verify, Register Normal) - SIN CIFRADO OPCIONAL
// =========================================================================

/**
 * RUTA: POST /api/auth/register
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, public_key_quantum } = req.body;

    // 1. Validaciones
    if (!username || !email || !password) return res.status(400).json({ error: 'Campos obligatorios' });
    if (!usersModel.validateEmailFormat(email)) return res.status(400).json({ error: 'Email inválido' });
    
    const passVal = validatePasswordStrength(password);
    if (!passVal.valid) return res.status(400).json({ error: passVal.message });

    // 2. Preparar datos DB
    const id = uuidv4();
    const passwordHash = await usersModel.hashPassword(password);
    const verificationCode = usersModel.generateVerificationCode();
    
    const created = await usersModel.createUser({
      id, username, email, passwordHash, 
      public_key_quantum: public_key_quantum || null, verificationCode
    });

    // 3. Enviar Email
    let emailSent = false;
    try {
      const sendResult = await emailService.sendVerificationCode(email, username, verificationCode);
      emailSent = !!(sendResult && sendResult.success);
    } catch (e) {
      console.error('Error enviando email:', e.message);
    }

    // 4. Respuesta
    const ip = req.ip || req.connection.remoteAddress;
    logger.logAuth('REGISTER_SUCCESS', username, ip);

    return res.status(201).json({
      success: true,
      message: 'Registro completado',
      user: { id: created.id },
      email_sent: emailSent
    });

  } catch (err) {
    console.error('Error en register:', err);
    if (err.message && err.message.includes('exists')) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * RUTA: POST /api/auth/login
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const user = await usersModel.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const isValidPassword = await usersModel.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      logger.logAuth('LOGIN_FAILED', username, req.ip);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Cuenta no verificada',
        message: 'Verifica tu email',
        user: { id: user.id }
      });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.logAuth('LOGIN_SUCCESS', username, req.ip);

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
});

/**
 * RUTA: POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    const { userId, code } = req.body;

    const result = await usersModel.validateVerificationCode(userId, code);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    // Obtener datos del usuario para enviar bienvenida
    const user = await usersModel.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Marcar verificado
    await db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);

    // Enviar email de bienvenida (no bloquea la respuesta)
    emailService.sendWelcomeEmail(user.email, user.username)
      .catch((err) => console.error('Error enviando email de bienvenida:', err.message));

    return res.json({ success: true, message: 'Cuenta verificada correctamente' });
  } catch (error) {
    console.error('Error en verify:', error);
    return res.status(500).json({ error: 'Error en verificación' });
  }
});

/**
 * RUTA: POST /api/auth/resend
 */
router.post('/resend', async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await usersModel.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const newCode = usersModel.generateVerificationCode();
    await usersModel.updateVerificationCode(userId, newCode);

    let emailSent = false;
    try {
      const sendResult = await emailService.sendVerificationCode(user.email, user.username, newCode);
      emailSent = !!(sendResult && sendResult.success);
    } catch (e) {
      console.error('Error enviando email:', e.message);
    }

    return res.json({ success: true, message: 'Código reenviado', email_sent: emailSent });
  } catch (error) {
    console.error('Error en resend:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;