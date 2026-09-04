/**
 * Unit Tests — JWT Authentication Utilities
 *
 * Tests token generation, verification, expiry handling, and
 * the authorize() role-enforcement middleware using mocked Express
 * request/response objects. No database connection required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, getJwtSecret } from '../utils/jwt';
import { authorize } from '../middleware/auth';
import type { AuthTokenPayload, SafeUser, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePayload(overrides: Partial<AuthTokenPayload> = {}): AuthTokenPayload {
  return {
    userId: 'user_abc123',
    role: 'DONOR',
    email: 'donor@test.com',
    ...overrides,
  };
}

function makeReq(user?: SafeUser): Partial<Request> {
  return { user };
}

function makeRes() {
  const ctx = {
    statusCode: null as number | null,
    body: null as unknown,
  };
  const res = {
    status(code: number) {
      ctx.statusCode = code;
      return res;
    },
    json(data: unknown) {
      ctx.body = data;
      return res;
    },
  } as unknown as Partial<Response>;
  return { res, ctx };
}

// ---------------------------------------------------------------------------
// getJwtSecret Tests
// ---------------------------------------------------------------------------

describe('getJwtSecret', () => {
  it('returns a non-empty string in development/test environment', () => {
    const secret = getJwtSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
  });

  it('uses the dev fallback when JWT_SECRET is not set', () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const secret = getJwtSecret();
    expect(secret).toContain('bloodlink_dev_only');
    process.env.JWT_SECRET = original;
  });

  it('uses the custom JWT_SECRET when set', () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'my_custom_secret_for_testing';
    const secret = getJwtSecret();
    expect(secret).toBe('my_custom_secret_for_testing');
    process.env.JWT_SECRET = original;
  });
});

// ---------------------------------------------------------------------------
// generateToken Tests
// ---------------------------------------------------------------------------

describe('generateToken', () => {
  it('returns a non-empty JWT string', () => {
    const token = generateToken(makePayload());
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('embeds userId, role, and email in the token payload', () => {
    const payload = makePayload({ role: 'HOSPITAL', email: 'hosp@test.com' });
    const token = generateToken(payload);
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    expect(decoded.userId).toBe('user_abc123');
    expect(decoded.role).toBe('HOSPITAL');
    expect(decoded.email).toBe('hosp@test.com');
  });

  it('generates different tokens for different payloads', () => {
    const t1 = generateToken(makePayload({ userId: 'user1' }));
    const t2 = generateToken(makePayload({ userId: 'user2' }));
    expect(t1).not.toBe(t2);
  });

  it('generates tokens signed with HS256 algorithm', () => {
    const token = generateToken(makePayload());
    const secret = getJwtSecret();
    // This should NOT throw if algorithm is correct
    expect(() => jwt.verify(token, secret, { algorithms: ['HS256'] })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// verifyToken Tests
// ---------------------------------------------------------------------------

describe('verifyToken', () => {
  it('successfully decodes a valid generated token', () => {
    const payload = makePayload({ role: 'ADMIN', email: 'admin@test.com' });
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('user_abc123');
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.email).toBe('admin@test.com');
  });

  it('throws on a token signed with a wrong secret', () => {
    const badToken = jwt.sign(
      { userId: 'x', role: 'DONOR', email: 'x@x.com' },
      'wrong_secret',
      { algorithm: 'HS256' }
    );
    expect(() => verifyToken(badToken)).toThrow();
  });

  it('throws on a completely malformed token string', () => {
    expect(() => verifyToken('not.a.token')).toThrow();
  });

  it('throws on an expired token', () => {
    const secret = getJwtSecret();
    const expiredToken = jwt.sign(
      { userId: 'y', role: 'DONOR', email: 'y@y.com' },
      secret,
      { expiresIn: -1 } // already expired
    );
    expect(() => verifyToken(expiredToken)).toThrow();
  });

  it('throws when required payload fields are missing', () => {
    const secret = getJwtSecret();
    // Token missing the 'role' field
    const incomplete = jwt.sign({ userId: 'z', email: 'z@z.com' }, secret, {
      algorithm: 'HS256',
    });
    expect(() => verifyToken(incomplete)).toThrow('Invalid token payload structure');
  });

  it('throws when token payload is not an object', () => {
    const secret = getJwtSecret();
    const stringPayload = jwt.sign('not_an_object', secret, { algorithm: 'HS256' });
    expect(() => verifyToken(stringPayload)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// authorize() Middleware Tests
// ---------------------------------------------------------------------------

describe('authorize() middleware — Role Enforcement', () => {
  const makeSafeUser = (role: UserRole): SafeUser => ({
    id: 'uid',
    name: 'Test User',
    email: 'test@test.com',
    role,
    phone: '0000000000',
    isVerified: true,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('calls next() when user role matches allowed roles', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(makeSafeUser('DONOR'));
    const { res, ctx } = makeRes();

    authorize('DONOR')(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.statusCode).toBeNull();
  });

  it('calls next() when one of multiple allowed roles matches', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(makeSafeUser('HOSPITAL'));
    const { res } = makeRes();

    authorize('DONOR', 'HOSPITAL', 'ADMIN')(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when user role is not in allowed roles', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(makeSafeUser('DONOR'));
    const { res, ctx } = makeRes();

    authorize('ADMIN')(req as Request, res as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.statusCode).toBe(403);
    expect((ctx.body as { status: string }).status).toBe('fail');
  });

  it('returns 403 with HOSPITAL role when only ADMIN is allowed', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(makeSafeUser('HOSPITAL'));
    const { res, ctx } = makeRes();

    authorize('ADMIN')(req as Request, res as Response, next);

    expect(ctx.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is not set (unauthenticated)', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(undefined); // no user attached
    const { res, ctx } = makeRes();

    authorize('DONOR')(req as Request, res as Response, next);

    expect(ctx.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('ADMIN role passes ADMIN-only guard', () => {
    const next = vi.fn() as NextFunction;
    const req = makeReq(makeSafeUser('ADMIN'));
    const { res } = makeRes();

    authorize('ADMIN')(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Round-trip Token Flow Tests
// ---------------------------------------------------------------------------

describe('Token Round-trip Integration', () => {
  it('a generated token can be verified and matched back to original payload', () => {
    const roles: UserRole[] = ['DONOR', 'HOSPITAL', 'ADMIN'];
    for (const role of roles) {
      const payload = makePayload({ role, email: `${role.toLowerCase()}@test.com` });
      const token = generateToken(payload);
      const decoded = verifyToken(token);
      expect(decoded.role).toBe(role);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.userId).toBe(payload.userId);
    }
  });

  it('tokens from different users are independently verifiable', () => {
    const donor = generateToken(makePayload({ userId: 'd1', role: 'DONOR' }));
    const admin = generateToken(makePayload({ userId: 'a1', role: 'ADMIN' }));
    expect(verifyToken(donor).userId).toBe('d1');
    expect(verifyToken(admin).userId).toBe('a1');
  });
});
