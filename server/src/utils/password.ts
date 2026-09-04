import bcrypt from 'bcryptjs';

const DEFAULT_SALT_ROUNDS = 10;

/**
 * Hash a plaintext password securely using bcryptjs.
 */
export async function hashPassword(password: string, saltRounds = DEFAULT_SALT_ROUNDS): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}
