const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const usersModel = require('../models/users');
const logger = require('../utils/logger');
const emailService = require('../utils/emailService');

// 👇👇👇 NUEVOS IMPORTS PARA CRIPTOGRAFÍA 👇👇👇
const { MlKem768 } = require('crystals-kyber-js');
const CryptoJS = require('crypto-js');

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

/**
 * Helper: Intenta descifrar el payload si viene cifrado, sino devuelve el original
 */
async function decryptPayloadIfNeeded(reqBody) {
  const { encapsulated_key, iv, ciphertext } = reqBody;

  // Si no tiene campos cifrados, devolver el body original
  if (!encapsulated_key || !iv || !ciphertext) {
    return reqBody;
  }

  // Cargar clave privada del servidor
  const SERVER_SK_BASE64 = process.env.SERVER_KYBER_PRIVATE_KEY;
  if (!SERVER_SK_BASE64) {
    throw new Error('SERVER_KYBER_PRIVATE_KEY no configurada');
  }

  try {
    const mlkem = new MlKem768();
    
    // Preparar buffers
    const skBuffer = Buffer.from(SERVER_SK_BASE64, 'base64');
    const skArray = new Uint8Array(skBuffer);
    
    const capsuleBuffer = Buffer.from(encapsulated_key, 'base64');
    const capsuleArray = new Uint8Array(capsuleBuffer);

    // Decapsular para obtener la clave AES
    const sharedSecret = await mlkem.decapsulate(capsuleArray, skArray);
    const aesKey = Buffer.from(sharedSecret).toString('base64');

    // Desencriptar AES
    const bytes = CryptoJS.AES.decrypt(ciphertext, aesKey, {
      iv: CryptoJS.enc.Base64.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const originalText = bytes.toString(CryptoJS.enc.Utf8);

    if (!originalText) throw new Error('Fallo al descifrar AES');

    const decryptedData = JSON.parse(originalText);
    console.log('🔓 Payload descifrado correctamente');
    return decryptedData;

  } catch (cryptoError) {
    console.error('Error descifrando payload:', cryptoError);
    throw new Error('Fallo al descifrar. Datos corruptos o claves incorrectas.');
  }
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
//  RUTA SEGURA: Recibe datos cifrados con Kyber + AES
// =========================================================================
router.post('/register-secure', registerLimiter, async (req, res) => {
  try {
    const { encapsulated_key, encrypted_data } = req.body;

    // 1. Validar que llegó el paquete cifrado
    if (!encapsulated_key || !encrypted_data) {
      return res.status(400).json({ error: 'Faltan datos cifrados o formato incorrecto' });
    }

    // 2. Cargar Clave Privada del Servidor (.env)
    const SERVER_SK_BASE64 = process.env.SERVER_KYBER_PRIVATE_KEY;
    if (!SERVER_SK_BASE64) {
      console.error("❌ ERROR CRÍTICO: No existe SERVER_KYBER_PRIVATE_KEY en .env");
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }

    // -----------------------------------------------------
    // 🔓 FASE DE DESCIFRADO (Decapsulación + AES Decrypt)
    // -----------------------------------------------------
    let decryptedData;
    try {
      const mlkem = new MlKem768();
      
      // Preparar Buffers
      const skBuffer = Buffer.from(SERVER_SK_BASE64, 'base64');
      const skArray = new Uint8Array(skBuffer);
      
      const capsuleBuffer = Buffer.from(encapsulated_key, 'base64');
      const capsuleArray = new Uint8Array(capsuleBuffer);

      // A. Kyber Decapsulate: Recuperamos la llave compartida
      const sharedSecret = await mlkem.decapsulate(capsuleArray, skArray);
      
      // B. Convertimos el secreto a Base64 (esa es la llave AES)
      const aesKey = Buffer.from(sharedSecret).toString('base64');

      // C. AES Decrypt: Desciframos el JSON
      const bytes = CryptoJS.AES.decrypt(encrypted_data, aesKey);
      const originalText = bytes.toString(CryptoJS.enc.Utf8);

      if (!originalText) throw new Error("Fallo al descifrar AES");
      
      decryptedData = JSON.parse(originalText);
      console.log(`🔓 Datos descifrados correctamente para usuario: ${decryptedData.username}`);

    } catch (cryptoError) {
      console.error("Error criptográfico:", cryptoError);
      return res.status(400).json({ error: 'Fallo al descifrar. Llaves incorrectas o datos corruptos.' });
    }

    // -----------------------------------------------------
    // 💾 FASE DE REGISTRO (Guardar en Base de Datos)
    // -----------------------------------------------------
    // Extraemos los datos ya limpios
    const { username, email, password, public_key_quantum } = decryptedData;

    // 1. Validaciones
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios dentro del paquete cifrado' });
    }
    if (!usersModel.validateEmailFormat(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }
    const passVal = validatePasswordStrength(password);
    if (!passVal.valid) {
      return res.status(400).json({ error: passVal.message });
    }

    // 2. Preparar datos DB
    const id = uuidv4();
    const passwordHash = await usersModel.hashPassword(password);
    const verificationCode = usersModel.generateVerificationCode();

    // 3. Insertar en PostgreSQL
    const created = await usersModel.createUser({
      id,
      username,
      email,
      passwordHash,
      public_key_quantum: public_key_quantum || null, // Guardamos la llave pública del usuario
      verificationCode,
    });

    // 4. Enviar Email (Opcional, no bloquea)
    let emailSent = false;
    try {
      const sendResult = await emailService.sendVerificationCode(email, username, verificationCode);
      emailSent = !!(sendResult && sendResult.success);
    } catch (e) {
      console.error('Error enviando email:', e.message);
    }

    // 5. Respuesta Exitosa
    const ip = req.ip || req.connection.remoteAddress;
    logger.logAuth('REGISTER_SECURE_SUCCESS', username, ip);

    return res.status(201).json({
      success: true,
      message: 'Registro seguro completado',
      user_id: created.id,
      email_sent: emailSent
    });

  } catch (err) {
    console.error('Error en register-secure:', err);
    // Manejo de errores de base de datos (Usuario duplicado)
    if (err.message && err.message.includes('exists')) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =========================================================================
//  RUTAS CLÁSICAS (Login, Verify, Register Normal) - AHORA CON SOPORTE PARA CIFRADO
// =========================================================================

/**
 * RUTA: POST /api/auth/register
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    // Intentar descifrar si viene cifrado
    const payload = await decryptPayloadIfNeeded(req.body);
    const { username, email, password, public_key_quantum } = payload;

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
    if (err.message.includes('Fallo al descifrar')) {
      return res.status(400).json({ error: err.message });
    }
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
    // Intentar descifrar si viene cifrado
    const payload = await decryptPayloadIfNeeded(req.body);
    const { username, password } = payload;

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
    if (err.message.includes('Fallo al descifrar')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * RUTA: POST /api/auth/verify
 */
router.post('/verify', async (req, res) => {
  try {
    // Intentar descifrar si viene cifrado
    const payload = await decryptPayloadIfNeeded(req.body);
    const { userId, code } = payload;

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
    if (error.message.includes('Fallo al descifrar')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error en verificación' });
  }
});

/**
 * RUTA: POST /api/auth/resend
 */
router.post('/resend', async (req, res) => {
  try {
    // Intentar descifrar si viene cifrado
    const payload = await decryptPayloadIfNeeded(req.body);
    const { userId } = payload;

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
    if (error.message.includes('Fallo al descifrar')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;