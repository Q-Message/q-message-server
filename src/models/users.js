const db = require('../../src/config/db');
const bcrypt = require('bcrypt');

// 1. Crear usuario con email
async function createUser({ id, username, email, passwordHash, public_key_quantum }) {
  const sql = `
    INSERT INTO users (id, username, email, password_hash, public_key_quantum, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING id, username, email, public_key_quantum, created_at
  `;
  
  // Manejo de la clave cuántica (permitimos null si no viene)
  const publicKeyParam = public_key_quantum == null ? '' : public_key_quantum;
  
  const params = [id, username, email, passwordHash, publicKeyParam];
  
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

// Funciones de hash y verificación (sin cambios)
async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
}

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = {
  createUser,
  hashPassword,
  getUserByUsername,
  getUserByEmail,
  getUserByUsernameOrEmail,
  validateEmailFormat,
  verifyPassword,
};