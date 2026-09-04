import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthTokenPayload } from '../types';

const DEV_FALLBACK_SECRET = 'bloodlink_dev_only_jwt_secret_do_not_use_in_prod_12345';

/**
 * Retrieve validated JWT Secret based on environment
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret === DEV_FALLBACK_SECRET || secret.length < 32) {
      throw new Error(
        '[Security Alert] In production, JWT_SECRET must be explicitly set and at least 32 characters long.'
      );
    }
    return secret;
  }

  return secret || DEV_FALLBACK_SECRET;
}

/**
 * Generate a signed JWT for authenticated user session
 */
export function generateToken(payload: AuthTokenPayload): string {
  const secret = getJwtSecret();
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

  const tokenPayload = {
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  };

  return jwt.sign(tokenPayload, secret, {
    expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode an incoming JWT
 */
export function verifyToken(token: string): AuthTokenPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;

  if (!decoded || typeof decoded !== 'object' || !decoded.userId || !decoded.role || !decoded.email) {
    throw new Error('Invalid token payload structure');
  }

  return {
    userId: decoded.userId as string,
    role: decoded.role as AuthTokenPayload['role'],
    email: decoded.email as string,
  };
}
