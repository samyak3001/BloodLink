import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Rate limiter for authentication endpoints (login, register)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 100, // Stricter limit in production, developer-friendly in dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Stricter rate limiter for password reset endpoints to prevent email enumeration or brute force
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 5 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many password reset requests from this IP. Please try again after 15 minutes.',
  },
});
