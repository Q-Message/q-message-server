const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const usersModel = require('../models/users');

/**
 * POST /api/auth/register
 * Body: { username, password, public_key_quantum? }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, public_key_quantum } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    // Basic sanitization/length checks
    if (typeof username !== 'string' || username.length < 3) return res.status(400).json({ error: 'username too short' });
    if (typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'password too short' });

    const id = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.randomUUID)
      ? globalThis.crypto.randomUUID()
      : uuidv4();

    const passwordHash = await usersModel.hashPassword(password);

    const created = await usersModel.createUser({ id, username, passwordHash, public_key_quantum: public_key_quantum || null });

    return res.status(201).json({ user: created });
  } catch (err) {
    console.error('Error en /api/auth/register', err);
    // Unique violation or duplicate username may throw; keep a safe error
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
