import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwt';
import { User } from '../models';
import { SafeUser, UserRole } from '../types';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

/**
 * Middleware to authenticate requests via JWT Bearer token
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required. Please provide a valid Bearer token.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        status: 'fail',
        message: 'Malformed authentication token.',
      });
      return;
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid token';
      res.status(401).json({
        status: 'fail',
        message: errorMessage.includes('expired')
          ? 'Authentication token has expired. Please log in again.'
          : 'Invalid authentication token.',
      });
      return;
    }

    // Check database connection before querying user
    if (mongoose.connection.readyState !== 1) {
      res.status(503).json({
        status: 'error',
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is currently unavailable. Please verify MongoDB is running.',
      });
      return;
    }

    // Load active user from database
    const userDoc = await User.findById(decoded.userId);

    if (!userDoc) {
      res.status(401).json({
        status: 'fail',
        message: 'The user account associated with this token no longer exists.',
      });
      return;
    }

    // Reject suspended users immediately
    if (userDoc.status === 'SUSPENDED') {
      res.status(403).json({
        status: 'fail',
        message: 'This account has been suspended. Please contact platform support.',
      });
      return;
    }

    // Attach safe user object to request
    req.user = {
      id: userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      role: userDoc.role,
      phone: userDoc.phone,
      isVerified: userDoc.isVerified,
      status: userDoc.status,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to enforce role-based access control server-side
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required before checking permissions.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        status: 'fail',
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
