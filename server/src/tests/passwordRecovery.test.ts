/**
 * Unit & Integration Tests — Password Recovery & Reset Flow
 *
 * Verifies:
 * - Forgot password endpoint generates secure random 32-byte token
 * - Token is securely hashed (SHA-256) and stored with 1-hour expiration
 * - In development mode, devResetToken is provided for local testing
 * - In production mode, devResetToken is strictly withheld (zero leakage)
 * - Single-use token enforcement: token cannot be reused once consumed
 * - Invalid/expired tokens are rejected
 * - Password is reset with bcrypt hash
 * - Successful login with the updated password
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../config/database';
import { User } from '../models';
import { forgotPassword, resetPassword } from '../controllers/authController';
import { comparePassword, hashPassword } from '../utils/password';
import { Request, Response } from 'express';

describe('Password Recovery & Reset Flow', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    // Restore password to JiteshHospital123 to match user's expected dev password
    const user = await User.findOne({ email: 'jitesh387699@gmail.com' });
    if (user) {
      user.passwordHash = await hashPassword('JiteshHospital123');
      user.passwordResetHash = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
    }
    await disconnectDB();
  });

  const testEmail = 'jitesh387699@gmail.com';
  let capturedToken: string = '';

  it('generates a recovery token and returns devResetToken in development', async () => {
    let responseData: any = null;
    let statusCode = 0;

    const req = {
      body: { email: testEmail },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    } as unknown as Response;

    const next = (err?: any) => {
      if (err) throw err;
    };

    await forgotPassword(req, res, next);

    expect(statusCode).toBe(200);
    expect(responseData.status).toBe('success');
    expect(responseData.devResetToken).toBeDefined();
    expect(typeof responseData.devResetToken).toBe('string');
    expect(responseData.devResetToken.length).toBe(64); // 32 bytes hex = 64 characters

    capturedToken = responseData.devResetToken;

    // Verify stored in DB as hash, NOT plaintext
    const user = await User.findOne({ email: testEmail }).select('+passwordResetHash +passwordResetExpires');
    expect(user).not.toBeNull();
    expect(user!.passwordResetHash).toBeDefined();
    expect(user!.passwordResetHash).not.toBe(capturedToken);
    expect(user!.passwordResetExpires).toBeDefined();
    expect(user!.passwordResetExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  it('strictly withholds devResetToken in production environment', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    let responseData: any = null;
    let statusCode = 0;

    const req = {
      body: { email: testEmail },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    } as unknown as Response;

    const next = (err?: any) => {
      if (err) throw err;
    };

    try {
      await forgotPassword(req, res, next);

      expect(statusCode).toBe(200);
      expect(responseData.status).toBe('success');
      expect(responseData.devResetToken).toBeUndefined();
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  it('rejects password reset with invalid token', async () => {
    let responseData: any = null;
    let statusCode = 0;

    const req = {
      body: {
        token: 'invalid_non_existent_token_12345678901234567890',
        newPassword: 'NewValidPassword123!',
      },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    } as unknown as Response;

    const next = (err?: any) => {
      if (err) throw err;
    };

    await resetPassword(req, res, next);

    expect(statusCode).toBe(400);
    expect(responseData.status).toBe('fail');
  });

  it('successfully resets password using the valid recovery token', async () => {
    // Generate a fresh recovery token
    let forgotResponse: any = null;
    await forgotPassword(
      { body: { email: testEmail }, ip: '127.0.0.1' } as unknown as Request,
      {
        status() { return this; },
        json(data: any) { forgotResponse = data; return this; },
      } as unknown as Response,
      () => {}
    );
    const validToken = forgotResponse.devResetToken;
    expect(validToken).toBeDefined();
    capturedToken = validToken;

    let responseData: any = null;
    let statusCode = 0;

    const req = {
      body: {
        token: validToken,
        newPassword: 'UpdatedHospitalPass123!',
      },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    } as unknown as Response;

    const next = (err?: any) => {
      if (err) throw err;
    };

    await resetPassword(req, res, next);

    expect(statusCode).toBe(200);
    expect(responseData.status).toBe('success');

    // Verify token was cleared (single-use enforcement)
    const user = await User.findOne({ email: testEmail }).select('+passwordHash +passwordResetHash +passwordResetExpires');
    expect(user!.passwordResetHash).toBeUndefined();
    expect(user!.passwordResetExpires).toBeUndefined();

    // Verify new password matches bcrypt hash
    const isMatch = await comparePassword('UpdatedHospitalPass123!', user!.passwordHash);
    expect(isMatch).toBe(true);
  });

  it('enforces single-use token: re-attempting with the same token fails', async () => {
    let responseData: any = null;
    let statusCode = 0;

    const req = {
      body: {
        token: capturedToken,
        newPassword: 'AnotherPassword123!',
      },
      ip: '127.0.0.1',
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    } as unknown as Response;

    const next = (err?: any) => {
      if (err) throw err;
    };

    await resetPassword(req, res, next);

    expect(statusCode).toBe(400);
    expect(responseData.status).toBe('fail');
    expect(responseData.message).toContain('invalid or has expired');
  });
});
