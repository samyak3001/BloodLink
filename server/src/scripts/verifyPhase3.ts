import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, verifyToken, getJwtSecret } from '../utils/jwt';
import { generateRandomToken, hashToken } from '../utils/crypto';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/authSchemas';
import { User, DonorProfile, HospitalProfile } from '../models';
import { authenticate, authorize } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

async function runPhase3Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 3 VERIFICATION: Auth & Security Infrastructure');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // 1. Password Hashing & Comparison Tests
  // -------------------------------------------------------------
  console.log('1. Password Security (bcryptjs)');
  const plaintext = 'SuperSecret@123';
  const hashed = await hashPassword(plaintext);

  assert(hashed !== plaintext, 'Password is never stored in plaintext');
  assert(hashed.startsWith('$2'), 'Hash has valid bcrypt format');
  assert(await comparePassword(plaintext, hashed), 'Correct password successfully matches hash');
  assert(!(await comparePassword('WrongPassword@999', hashed)), 'Incorrect password fails comparison');
  assert(!(await comparePassword('', hashed)), 'Empty password fails comparison securely');

  // -------------------------------------------------------------
  // 2. JWT Generation & Verification Tests
  // -------------------------------------------------------------
  console.log('\n2. JWT Generation & Verification');
  const payload = {
    userId: '65e01234567890abcdef1234',
    role: 'DONOR' as UserRole,
    email: 'alex.donor@example.com',
  };
  const token = generateToken(payload);
  assert(typeof token === 'string' && token.split('.').length === 3, 'JWT has valid header.payload.signature structure');

  const decoded = verifyToken(token);
  assert(decoded.userId === payload.userId, 'Decoded token contains correct userId');
  assert(decoded.role === payload.role, 'Decoded token contains correct role');
  assert(decoded.email === payload.email, 'Decoded token contains correct email');

  // Invalid Token Test
  let invalidCaught = false;
  try {
    verifyToken('invalid.corrupted.token');
  } catch {
    invalidCaught = true;
  }
  assert(invalidCaught, 'Corrupted/tampered JWT is strictly rejected');

  // Production Secret Guard Test
  const prevEnv = process.env.NODE_ENV;
  const prevSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';
  delete process.env.JWT_SECRET;
  let prodSecretCaught = false;
  try {
    getJwtSecret();
  } catch {
    prodSecretCaught = true;
  }
  assert(prodSecretCaught, 'Production environment strictly rejects missing/weak JWT_SECRET');
  process.env.NODE_ENV = prevEnv;
  if (prevSecret) process.env.JWT_SECRET = prevSecret;

  // -------------------------------------------------------------
  // 3. Cryptographic Password Reset Token Tests
  // -------------------------------------------------------------
  console.log('\n3. Cryptographic Password Recovery');
  const rawToken1 = generateRandomToken(32);
  const rawToken2 = generateRandomToken(32);
  assert(rawToken1 !== rawToken2, 'Random tokens are unique and unpredictable');
  assert(rawToken1.length === 64, '32-byte token generates 64 hex characters');

  const hashedToken1 = hashToken(rawToken1);
  const hashedToken2 = hashToken(rawToken1);
  assert(hashedToken1 === hashedToken2, 'Token hashing is deterministic via SHA-256');
  assert(hashedToken1 !== rawToken1, 'Hashed token does not reveal raw token');

  // -------------------------------------------------------------
  // 4. Zod Validation Tests
  // -------------------------------------------------------------
  console.log('\n4. Zod Input Validation & Sanitization');

  // Valid Donor registration
  const validDonor = registerSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    password: 'Password@123',
    role: 'DONOR',
    phone: '+1234567890',
    bloodGroup: 'O+',
    city: 'Metropolis',
    district: 'Central',
    postalCode: '10001',
  });
  assert(validDonor.success, 'Valid Donor registration payload passes validation');

  // Valid Hospital registration
  const validHospital = registerSchema.safeParse({
    name: 'Dr. Smith',
    email: 'admin@metrohealth.org',
    password: 'HospitalPass@456',
    role: 'HOSPITAL',
    phone: '+1987654321',
    hospitalName: 'Metro Health Hospital',
    licenseNumber: 'LIC-MH-9988',
    emergencyHelpline: '+18005550199',
    street: '123 Health Ave',
    city: 'Metropolis',
    state: 'NY',
    postalCode: '10001',
  });
  assert(validHospital.success, 'Valid Hospital registration payload passes validation');

  // Weak password rejection
  const weakPass = registerSchema.safeParse({
    name: 'Weak Pass User',
    email: 'weak@example.com',
    password: 'weak',
    role: 'DONOR',
    phone: '+1234567890',
    bloodGroup: 'A+',
    city: 'Metropolis',
    district: 'Central',
    postalCode: '10001',
  });
  assert(!weakPass.success, 'Weak password (< 8 chars, no uppercase/digit) is rejected');

  // Invalid email rejection
  const invalidEmail = loginSchema.safeParse({
    email: 'not-an-email',
    password: 'SomePassword@123',
  });
  assert(!invalidEmail.success, 'Invalid email format is rejected by loginSchema');

  // Reset password validation
  const validReset = resetPasswordSchema.safeParse({
    token: 'valid_secure_token_12345',
    newPassword: 'BrandNewPassword@99',
  });
  assert(validReset.success, 'Valid reset password payload passes validation');

  // -------------------------------------------------------------
  // 5. Authentication & Authorization Middleware Tests
  // -------------------------------------------------------------
  console.log('\n5. Authentication & Authorization Middleware');

  // Missing token test
  let resStatus = 0;
  let resJson: any = null;
  const mockRes = (): Response => {
    const res: any = {};
    res.status = (code: number) => {
      resStatus = code;
      return res;
    };
    res.json = (data: any) => {
      resJson = data;
      return res;
    };
    return res as Response;
  };

  const reqWithoutToken = { headers: {} } as Request;
  await authenticate(reqWithoutToken, mockRes(), () => {});
  assert(resStatus === 401, 'authenticate rejects request without Authorization header with 401');

  // Malformed token test
  const reqMalformed = { headers: { authorization: 'Basic 1234' } } as Request;
  await authenticate(reqMalformed, mockRes(), () => {});
  assert(resStatus === 401, 'authenticate rejects non-Bearer token with 401');

  // Authorize middleware test
  const donorReq = {
    user: {
      id: '1',
      name: 'Donor',
      email: 'donor@test.com',
      role: 'DONOR' as UserRole,
      phone: '123',
      isVerified: true,
      status: 'ACTIVE' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as Request;

  let nextCalled = false;
  authorize('DONOR')(donorReq, mockRes(), () => {
    nextCalled = true;
  });
  assert(nextCalled, 'authorize allows user with matching role (DONOR)');

  let forbiddenStatus = 0;
  const mockForbiddenRes = (): Response => {
    const res: any = {};
    res.status = (code: number) => {
      forbiddenStatus = code;
      return res;
    };
    res.json = () => res;
    return res as Response;
  };

  authorize('HOSPITAL', 'ADMIN')(donorReq, mockForbiddenRes(), () => {});
  assert(forbiddenStatus === 403, 'authorize rejects user without matching role with 403 Forbidden');

  // -------------------------------------------------------------
  // 6. Security & Privacy Assurance Tests
  // -------------------------------------------------------------
  console.log('\n6. Security & Sensitive Information Non-Exposure');

  const testUser = new User({
    name: 'Security Test User',
    email: 'sec@example.com',
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
    role: 'DONOR',
    phone: '+1234567890',
    passwordResetHash: 'secret_reset_hash_value',
    passwordResetExpires: new Date(Date.now() + 3600000),
  });

  const jsonUser = testUser.toJSON();
  assert(jsonUser.passwordHash === undefined, 'passwordHash is absent from user.toJSON()');
  assert(jsonUser.passwordResetHash === undefined, 'passwordResetHash is absent from user.toJSON()');
  assert(jsonUser.passwordResetExpires === undefined, 'passwordResetExpires is absent from user.toJSON()');

  const safeObj = testUser.toSafeObject();
  assert(!('passwordHash' in safeObj), 'passwordHash is absent from user.toSafeObject()');
  assert(!('passwordResetHash' in safeObj), 'passwordResetHash is absent from user.toSafeObject()');

  console.log('\n===========================================================');
  console.log(`PHASE 3 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Verification().catch((err) => {
  console.error('Fatal error during Phase 3 verification:', err);
  process.exit(1);
});
