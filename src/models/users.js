const db = require('../../src/config/db');
const bcrypt = require('bcrypt');

// 1. Crear usuario (versión básica, sin email)
async function createUser({ id, username, passwordHash, public_key_quantum }) {
  const sql = `
    INSERT INTO users (id, username, password_hash, public_key_quantum, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, username, public_key_quantum, created_at
  `;
  
  // Manejo de la clave cuántica (permitimos null si no viene)
  const publicKeyParam = public_key_quantum == null ? '' : public_key_quantum;
  
  const params = [id, username, passwordHash, publicKeyParam];
  
  try {
    const res = await db.query(sql, params);
    return res.rows[0];
  } catch (error) {
    // Error de duplicado (unique constraint)
    if (error.code === '23505') {
      throw new Error('Username already exists');
    }
    throw error;
  }
}

// 2. Buscar usuario por username (sin email)
async function getUserByUsername(username) {
  const sql = `
    SELECT id, username, password_hash, public_key_quantum
    FROM users
    WHERE username = $1
  `;
  const params = [username];
  const res = await db.query(sql, params);
  return res.rows[0];
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
  verifyPassword,
};