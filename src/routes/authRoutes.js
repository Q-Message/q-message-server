const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const usersModel = require('../models/users');

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
  max: 3, // máximo 3 intentos
  message: { error: 'Too many registration attempts, please try again later' },
  standardHeaders: true, // devuelve info en `RateLimit-*` headers
  legacyHeaders: false, // deshabilita `X-RateLimit-*` headers
});

/**
 * POST /api/auth/register
 * Body: { username, password, public_key_quantum? }
 * Respuestas:
 * - 201 Created: usuario creado exitosamente
 * - 400 Bad Request: validación fallida (username/password inválidos)
 * - 409 Conflict: username ya existe
 * - 429 Too Many Requests: rate limit excedido
 * - 500 Internal Server Error: error interno
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, public_key_quantum } = req.body;

    // Validar campos obligatorios
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    // Validar tipo de datos
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'username and password must be strings' });
    }

    // Validar longitud de username
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'username must be between 3 and 50 characters' });
    }

    // Validar caracteres permitidos en username (alfanuméricos, guión, guión bajo)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'username can only contain letters, numbers, underscores, and hyphens' });
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

    // Crear usuario en la base de datos
    const created = await usersModel.createUser({
      id,
      username,
      passwordHash,
      public_key_quantum: public_key_quantum || null,
    });

    return res.status(201).json({ user: created });
  } catch (err) {
    console.error('Error en /api/auth/register', err);

    // Manejar error específico: constraint unique violado (username duplicado)
    // Código SQL: 23505 = unique_violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
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

module.exports = router;
