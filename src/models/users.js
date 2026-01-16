const db = require('../../src/config/db');
const bcrypt = require('bcrypt');

// Generar código de verificación de 6 dígitos random
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. Crear usuario con email y código de verificación
async function createUser({ id, username, email, passwordHash, public_key_quantum, verificationCode }) {
  const codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // +5 minutos
  
  const sql = `
    INSERT INTO users (id, username, email, password_hash, public_key_quantum, verification_code, code_expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, username, email, public_key_quantum, verification_code, code_expires_at, created_at
  `;
  
  // Manejo de la clave cuántica (permitimos null si no viene)
  const publicKeyParam = public_key_quantum == null ? '' : public_key_quantum;
  
  const params = [id, username, email, passwordHash, publicKeyParam, verificationCode, codeExpiresAt];
  
  try {
    const res = await db.query(sql, params);
    return res.rows[0];
  } catch (error) {
    // Error de duplicado (unique constraint)
    if (error.code === '23505') {
      // Determinar si es username o email duplicado
      if (error.detail && error.detail.includes('username')) {
        throw new Error('Username already exists');
      } else if (error.detail && error.detail.includes('email')) {
        throw new Error('Email already exists');
      }
      throw new Error('User data already exists');
    }
    throw error;
  }
}

// 2. Buscar usuario por username
async function getUserByUsername(username) {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum
    FROM users
    WHERE username = $1
  `;
  const params = [username];
  const res = await db.query(sql, params);
  return res.rows[0];
}

// 3. Buscar usuario por email
async function getUserByEmail(email) {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum
    FROM users
    WHERE email = $1
  `;
  const params = [email];
  const res = await db.query(sql, params);
  return res.rows[0];
}

// 4. Buscar usuario por username O email (para login flexible)
async function getUserByUsernameOrEmail(identifier) {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum
    FROM users
    WHERE username = $1 OR email = $1
  `;
  const params = [identifier];
  const res = await db.query(sql, params);
  return res.rows[0];
}

// 5. Validar formato de email
function validateEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Funciones de hash y verificación
async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
}

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// 6. Validar código de verificación
async function validateVerificationCode(userId, code) {
  const sql = `
    SELECT id, username, email, verification_code, code_expires_at
    FROM users
    WHERE id = $1 AND verification_code = $2
  `;
  const params = [userId, code];
  const res = await db.query(sql, params);
  
  if (res.rows.length === 0) {
    return { valid: false, message: 'Invalid verification code' };
  }
  
  const user = res.rows[0];
  const now = new Date();
  
  if (now > user.code_expires_at) {
    return { valid: false, message: 'Verification code has expired' };
  }
  
  return { valid: true, user };
}

module.exports = {
  createUser,
  hashPassword,
  getUserByUsername,
  getUserByEmail,
  getUserByUsernameOrEmail,
  validateEmailFormat,
  verifyPassword,
  generateVerificationCode,
  validateVerificationCode,
};