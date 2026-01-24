import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, verify, resend } from '../controllers/authController';

const router: Router = express.Router();

// Limitadores de tasa para registro y login
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de registro, prueba más tarde' }
});

// Limitador de tasa para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiados intentos de login, prueba más tarde' }
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/verify', verify);
router.post('/resend', resend);

export default router;