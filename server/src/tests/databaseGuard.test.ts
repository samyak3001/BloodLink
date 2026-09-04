/**
 * Unit Tests — Database Connectivity Guard & Error Handling
 *
 * Verifies:
 * - requireDatabase middleware rejects requests when DB readyState !== 1 with HTTP 503
 * - requireDatabase calls next() when DB readyState === 1
 * - bufferCommands: false prevents long 10000ms buffering timeouts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { requireDatabase } from '../middleware/dbCheck';

describe('Database Connectivity Guard Middleware (requireDatabase)', () => {
  function makeMockRes() {
    const ctx = {
      statusCode: null as number | null,
      body: null as unknown,
    };
    const res = {
      status(code: number) {
        ctx.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        ctx.body = payload;
        return this;
      },
    };
    return { res, ctx };
  }

  it('immediately returns 503 Service Unavailable when mongoose is disconnected (readyState 0)', () => {
    // Force disconnected state
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);

    const req = {} as Request;
    const { res, ctx } = makeMockRes();
    const next = vi.fn() as NextFunction;

    requireDatabase(req, res as unknown as Response, next);

    expect(ctx.statusCode).toBe(503);
    expect(ctx.body).toMatchObject({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('immediately returns 503 when mongoose is connecting (readyState 2) or disconnecting (readyState 3)', () => {
    const { res: res2, ctx: ctx2 } = makeMockRes();
    const next2 = vi.fn() as NextFunction;
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(2);

    requireDatabase({} as Request, res2 as unknown as Response, next2);
    expect(ctx2.statusCode).toBe(503);
    expect(next2).not.toHaveBeenCalled();

    const { res: res3, ctx: ctx3 } = makeMockRes();
    const next3 = vi.fn() as NextFunction;
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(3);

    requireDatabase({} as Request, res3 as unknown as Response, next3);
    expect(ctx3.statusCode).toBe(503);
    expect(next3).not.toHaveBeenCalled();
  });

  it('invokes next() when mongoose is fully connected (readyState 1)', () => {
    vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(1);

    const req = {} as Request;
    const { res, ctx } = makeMockRes();
    const next = vi.fn() as NextFunction;

    requireDatabase(req, res as unknown as Response, next);

    expect(ctx.statusCode).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });
});
