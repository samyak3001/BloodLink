import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

/**
 * Middleware that guarantees database readiness before executing operations.
 * If MongoDB is not connected, fails fast with 503 Service Unavailable and
 * an actionable diagnostic message, preventing 10,000ms Mongoose query buffering timeouts.
 */
export function requireDatabase(req: Request, res: Response, next: NextFunction): void {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database service is currently unavailable. Please verify MongoDB is running and MONGODB_URI is correctly configured.',
    });
    return;
  }
  next();
}
