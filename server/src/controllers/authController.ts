import { Request, Response, NextFunction } from 'express';
import { User, DonorProfile, HospitalProfile, AuditLog } from '../models';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { generateRandomToken, hashToken } from '../utils/crypto';
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../validators/authSchemas';

/**
 * Register a new Donor or Hospital account
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data: RegisterInput = req.body;

    // 1. Check for duplicate email
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      res.status(409).json({
        status: 'fail',
        message: 'An account with this email address already exists.',
      });
      return;
    }

    // 2. Check for duplicate hospital license number if registering hospital
    if (data.role === 'HOSPITAL' && data.licenseNumber) {
      const existingLicense = await HospitalProfile.findOne({
        licenseNumber: data.licenseNumber,
      });
      if (existingLicense) {
        res.status(409).json({
          status: 'fail',
          message: 'A hospital with this license number is already registered.',
        });
        return;
      }
    }

    // 3. Hash password
    const passwordHash = await hashPassword(data.password);

    // 4. Create User document
    const user = await User.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      phone: data.phone,
      isVerified: data.role === 'DONOR', // Donors verified by default in dev; hospitals undergo admin review
      status: 'ACTIVE',
    });

    // 5. Create Role Profile
    let createdProfile = null;

    if (data.role === 'DONOR') {
      createdProfile = await DonorProfile.create({
        userId: user._id,
        bloodGroup: data.bloodGroup!,
        supportedComponents: data.supportedComponents || ['WHOLE_BLOOD'],
        selfReportedScreening: {
          isAgeEligible: data.selfReportedScreening?.isAgeEligible ?? false,
          isWeightEligible: data.selfReportedScreening?.isWeightEligible ?? false,
          hasNoRecentIllness: data.selfReportedScreening?.hasNoRecentIllness ?? true,
          hasValidInterval: data.selfReportedScreening?.hasValidInterval ?? true,
          screeningDisclaimerAcknowledged:
            data.selfReportedScreening?.screeningDisclaimerAcknowledged ?? false,
          lastScreeningDate: new Date(),
        },
        location: {
          type: 'Point',
          coordinates: data.coordinates || [77.5946, 12.9716], // Default coordinates if not provided
        },
        address: {
          city: data.city!,
          district: data.district!,
          postalCode: data.postalCode!,
        },
      });
    } else if (data.role === 'HOSPITAL') {
      createdProfile = await HospitalProfile.create({
        userId: user._id,
        hospitalName: data.hospitalName!,
        licenseNumber: data.licenseNumber!,
        emergencyHelpline: data.emergencyHelpline!,
        isVerifiedByAdmin: false,
        location: {
          type: 'Point',
          coordinates: data.coordinates || [77.5946, 12.9716],
        },
        address: {
          street: data.street || 'Hospital Road',
          city: data.city!,
          state: data.state!,
          postalCode: data.postalCode!,
        },
      });
    }

    // 6. Security Audit Log (non-fatal — a logging failure must not block the user)
    try {
      await AuditLog.create({
        actorId: user._id,
        action: 'USER_REGISTERED',
        resource: 'User',
        resourceId: user._id.toString(),
        details: { role: user.role, email: user.email },
        ipAddress: req.ip,
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to write USER_REGISTERED audit entry:', auditErr);
    }

    // 7. Generate JWT Token
    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(201).json({
      status: 'success',
      message: 'Registration successful',
      token,
      user: user.toSafeObject(),
      profile: createdProfile ? createdProfile.toJSON() : null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Log in with email and password
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password }: LoginInput = req.body;

    // 1. Find user with passwordHash
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password.',
      });
      return;
    }

    // 2. Secure password comparison
    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password.',
      });
      return;
    }

    // 3. Reject suspended accounts
    if (user.status === 'SUSPENDED') {
      res.status(403).json({
        status: 'fail',
        message: 'This account has been suspended. Please contact platform support.',
      });
      return;
    }

    // 4. Security Audit Log (non-fatal — a logging failure must not block the user)
    try {
      await AuditLog.create({
        actorId: user._id,
        action: 'USER_LOGIN_SUCCESS',
        resource: 'User',
        resourceId: user._id.toString(),
        details: { role: user.role },
        ipAddress: req.ip,
      });
    } catch (auditErr) {
      console.error('[AuditLog] Failed to write USER_LOGIN_SUCCESS audit entry:', auditErr);
    }

    // 5. Generate token
    const token = generateToken({
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    });

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve authenticated user profile and associated role record
 */
export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        status: 'fail',
        message: 'Authentication required.',
      });
      return;
    }

    let profile = null;
    if (req.user.role === 'DONOR') {
      profile = await DonorProfile.findOne({ userId: req.user.id });
    } else if (req.user.role === 'HOSPITAL') {
      profile = await HospitalProfile.findOne({ userId: req.user.id });
    }

    res.status(200).json({
      status: 'success',
      user: req.user,
      profile: profile ? profile.toJSON() : null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Initiate password recovery (generates secure hashed reset token)
 */
export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email }: ForgotPasswordInput = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    let devResetToken: string | undefined;
    const isDev = process.env.NODE_ENV !== 'production';

    if (user && user.status !== 'SUSPENDED') {
      // Generate secure 32-byte random token
      const rawToken = generateRandomToken(32);
      const hashedToken = hashToken(rawToken);

      // Store hashed token with 1-hour expiration
      user.passwordResetHash = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // Audit log event (never logging the raw token)
      await AuditLog.create({
        actorId: user._id,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'User',
        resourceId: user._id.toString(),
        ipAddress: req.ip,
      });

      // For local testing in development only (never exposed in production)
      if (isDev) {
        devResetToken = rawToken;
        console.log('\n===========================================================');
        console.log(`[Dev Password Recovery] Target Account: ${user.email}`);
        console.log(`[Dev Password Recovery] Generated Token: ${rawToken}`);
        console.log(`[Dev Password Recovery] Direct Reset URL: http://localhost:5173/reset-password?token=${rawToken}`);
        console.log('===========================================================\n');
      }
    }

    // Always return neutral response to prevent email enumeration
    res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, password reset instructions have been generated.',
      ...(isDev && devResetToken ? { devResetToken } : {}),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password using valid single-use token
 */
export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword }: ResetPasswordInput = req.body;

    // Hash incoming token to match stored database hash
    const hashedToken = hashToken(token);

    // Find user with active, non-expired reset token
    const user = await User.findOne({
      passwordResetHash: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetHash +passwordResetExpires');

    if (!user) {
      res.status(400).json({
        status: 'fail',
        message: 'Password reset token is invalid or has expired.',
      });
      return;
    }

    // Hash new password
    user.passwordHash = await hashPassword(newPassword);

    // Clear reset token fields (single-use enforcement)
    user.passwordResetHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Audit log
    await AuditLog.create({
      actorId: user._id,
      action: 'PASSWORD_RESET_COMPLETED',
      resource: 'User',
      resourceId: user._id.toString(),
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: 'Password has been successfully reset. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}
