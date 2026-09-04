import { Router } from 'express';
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter';
import { requireDatabase } from '../middleware/dbCheck';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authSchemas';

const router = Router();

// Registration: database-guarded, rate-limited, and validated
router.post('/register', requireDatabase, authRateLimiter, validateBody(registerSchema), register);

// Login: database-guarded, rate-limited, and validated
router.post('/login', requireDatabase, authRateLimiter, validateBody(loginSchema), login);

// Authenticated current session profile
router.get('/me', authenticate, getMe);

// Password recovery initiation: strictly rate-limited and database-guarded
router.post(
  '/forgot-password',
  requireDatabase,
  passwordResetRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword
);

// Password reset finalization
router.post(
  '/reset-password',
  requireDatabase,
  passwordResetRateLimiter,
  validateBody(resetPasswordSchema),
  resetPassword
);

export default router;
