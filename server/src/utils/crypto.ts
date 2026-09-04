import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token (e.g. for password resets)
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a sensitive token using SHA-256 before storing it in the database
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
