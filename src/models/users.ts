import { query } from '../config/db';
import * as bcrypt from 'bcrypt';

// Función para actualizar el código de verificación y su expiración
export async function updateVerificationCode(userId: string, newCode: string): Promise<void> {
  const sql = 'UPDATE users SET verification_code = $1, code_expires_at = NOW() + interval \'5 minutes\' WHERE id = $2';
  await query(sql, [newCode, userId]);
}

// Funciones relacionadas con usuarios
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
export async function createUser({ id, username, email, passwordHash, public_key_quantum, verificationCode }:{ id: string, username: string, email: string, passwordHash: string, public_key_quantum?: string, verificationCode: string }): Promise<any> {
  const codeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const sql = `
    INSERT INTO users (id, username, email, password_hash, public_key_quantum, verification_code, code_expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, username, email, public_key_quantum, verification_code, code_expires_at, created_at
  `;
  const publicKeyParam = public_key_quantum == null ? '' : public_key_quantum;
  const params = [id, username, email, passwordHash, publicKeyParam, verificationCode, codeExpiresAt];
  try {
    const res = await query(sql, params);
    return res.rows[0];
  } catch (error: any) {
    if (error.code === '23505') {
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

// Obtener usuario por nombre de usuario
export async function getUserByUsername(username: string): Promise<any> {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum, is_verified
    FROM users
    WHERE username = $1
  `;
  const params = [username];
  const res = await query(sql, params);
  return res.rows[0];
}

// Obtener usuario por email
export async function getUserByEmail(email: string): Promise<any> {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum
    FROM users
    WHERE email = $1
  `;
  const params = [email];
  const res = await query(sql, params);
  return res.rows[0];
}


// Obtener usuario por nombre de usuario o email
export async function getUserByUsernameOrEmail(identifier: string): Promise<any> {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum
    FROM users
    WHERE username = $1 OR email = $1
  `;
  const params = [identifier];
  const res = await query(sql, params);
  return res.rows[0];
}


// Validar formato de email
export function validateEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Hashing y verificación de contraseñas
export async function hashPassword(plainPassword: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(plainPassword, saltRounds);
}
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Obtener usuario por ID
export async function getUserById(userId: string): Promise<any> {
  const sql = `
    SELECT id, username, email, password_hash, public_key_quantum, is_verified
    FROM users
    WHERE id = $1
  `;
  const params = [userId];
  const res = await query(sql, params);
  return res.rows[0];
}

// Validar código de verificación
export async function validateVerificationCode(userId: string, code: string): Promise<any> {
  const sql = `
    SELECT id, username, email, verification_code, code_expires_at
    FROM users
    WHERE id = $1 AND verification_code = $2
  `;
  const params = [userId, code];
  const res = await query(sql, params);
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
