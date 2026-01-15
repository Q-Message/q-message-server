const db = require('../../src/config/db');
const bcrypt = require('bcrypt');

async function createUser({ id, username, passwordHash, public_key_quantum }) {
  const sql = `
    INSERT INTO users (id, username, password_hash, public_key_quantum, created_at)
    VALUES ($1,$2,$3,$4,NOW())
    RETURNING id, username, public_key_quantum, created_at
  `;
  // Si la columna public_key_quantum es NOT NULL en tu esquema, mandamos '' en lugar de null
  const publicKeyParam = public_key_quantum == null ? '' : public_key_quantum;
  const params = [id, username, passwordHash, publicKeyParam];
  const res = await db.query(sql, params);
  return res.rows[0];
}

async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
}

module.exports = {
  createUser,
  hashPassword,
};
