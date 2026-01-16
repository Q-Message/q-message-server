const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
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
  max: 10, // Máximo 10 intentos de registro por IP en 15 min
  message: { error: 'Demasiados intentos de registro, prueba más tarde' }
});

/**
 * RUTA: POST /api/auth/register
 * Crea el usuario y devuelve el objeto "user" con su "id"
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password, public_key_quantum } = req.body;

    // 1. Validaciones básicas
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (!usersModel.validateEmailFormat(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    const passVal = validatePasswordStrength(password);
    if (!passVal.valid) {
      return res.status(400).json({ error: passVal.message });
    }

    // 2. Generar datos únicos
    const id = uuidv4();
    const passwordHash = await usersModel.hashPassword(password);
    const verificationCode = usersModel.generateVerificationCode();

    // 3. Guardar en Base de Datos (Esto ya usa el campo "email")
    const created = await usersModel.createUser({
      id,
      username,
      email,
      passwordHash,
      public_key_quantum: public_key_quantum || null,
      verificationCode,
    });

    // 4. Intentar enviar email (no bloquea el registro)
    let emailSent = false;
    try {
      const sendResult = await emailService.sendVerificationCode(email, username, verificationCode);
      emailSent = !!(sendResult && sendResult.success);
    } catch (e) {
      console.error('Error enviando email:', e.message);
    }

    // 5. RESPUESTA PARA ANDROID:
    // Devolvemos el objeto 'user' para que Android encuentre el 'id'
    const ip = req.ip || req.connection.remoteAddress;
    logger.logAuth('REGISTER_SUCCESS', username, ip);

    return res.status(201).json({ 
      user: created, 
      email_sent: emailSent 
    });

  } catch (err) {
    console.error('Error en registro:', err);
    if (err.message.includes('exists')) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * RUTA: POST /api/auth/login
 * Inicia sesión y devuelve un token JWT
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Máximo 5 intentos de login por IP en 15 min
  message: { error: 'Demasiados intentos de login, prueba más tarde' }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Validaciones básicas
    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password son obligatorios' });
    }

    // 2. Buscar usuario por username
    const user = await usersModel.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 3. Verificar contraseña
    const isValidPassword = await usersModel.verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      const ip = req.ip || req.connection.remoteAddress;
      logger.logAuth('LOGIN_FAILED', username, ip);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // 4. Verificar que la cuenta esté verificada
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'Cuenta no verificada',
        message: 'Por favor verifica tu email antes de iniciar sesión'
      });
    }

    // 5. Generar token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 6. Log exitoso
    const ip = req.ip || req.connection.remoteAddress;
    logger.logAuth('LOGIN_SUCCESS', username, ip);

    // 7. Respuesta
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
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * RUTA: POST /api/auth/verify
 * Activa la cuenta si el código es correcto
 */
router.post('/verify', async (req, res) => {
  const { userId, code } = req.body;
  try {
    const result = await usersModel.validateVerificationCode(userId, code);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    const db = require('../config/db');
    await db.query('UPDATE users SET is_verified = true WHERE id = $1', [userId]);

    return res.json({ success: true, message: 'Cuenta verificada correctamente' });
  } catch (error) {
    return res.status(500).json({ error: 'Error en la verificación' });
  }
});

module.exports = router;