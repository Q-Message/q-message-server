const db = require('../../src/config/db');
const bcrypt = require('bcrypt');

async function createUser({ id, username, passwordHash, public_key_quantum }) {
  const sql = `
    INSERT INTO users (id, username, password_hash, public_key_quantum, created_at)
    VALUES ($1,$2,$3,$4,NOW())
    RETURNING id, username, public_key_quantum, created_at
  `;
  const params = [id, username, passwordHash, public_key_quantum];
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
