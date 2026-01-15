const db = require('../../src/config/db');
const bcrypt = require('bcrypt');


// Creamos un nuevo usuario en la base de datos, la contraseña ya debe venir hasheada
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

// Función para hashear la contraseña usando bcrypt
async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
}


// Obtener usuario por username
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

// Verificar contraseña comparando la contraseña plana con el hash almacenado
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Exportamos las funciones para usarlas en otros módulos
module.exports = {
  createUser,
  hashPassword,
  getUserByUsername,
  verifyPassword,
};
