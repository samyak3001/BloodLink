import { Request, Response, NextFunction } from 'express';
import {
  User,
  DonorProfile,
  HospitalProfile,
  DonationHistory,
  EmergencyRequest,
  Notification,
  AuditLog,
} from '../models';
import { comparePassword, hashPassword } from '../utils/password';
import { SafeUser } from '../types';

/**
 * Export complete personal data archive in compliance with privacy & data rights principles
 * (Prompt.md rule 633: "Provide data export architecture where practical")
 */
export async function exportUserData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'fail', message: 'Authentication required.' });
      return;
    }

    const userId = req.user.id;

    // 1. Fetch User Record (excluding password hashes)
    const user = await User.findById(userId).select('-passwordHash -passwordResetHash');
    if (!user) {
      res.status(404).json({ status: 'fail', message: 'User account not found.' });
      return;
    }

    // 2. Fetch Role-Specific Profile & Activity Data
    let profileData: unknown = null;
    let activityData: Record<string, unknown> = {};

    if (user.role === 'DONOR') {
      const donor = await DonorProfile.findOne({ userId });
      profileData = donor;
      const history = await DonationHistory.find({ donorId: donor?._id }).sort({ donationDate: -1 });
      activityData = { donationHistory: history };
    } else if (user.role === 'HOSPITAL') {
      const hospital = await HospitalProfile.findOne({ userId });
      profileData = hospital;
      const requests = await EmergencyRequest.find({ hospitalId: hospital?._id }).sort({ createdAt: -1 });
      activityData = { emergencyRequestsDispatched: requests };
    }

    // 3. Fetch In-App Notifications
    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(100);

    // 4. Fetch User Audit Trail
    const auditLogs = await AuditLog.find({ actorId: userId })
      .sort({ createdAt: -1 })
      .limit(100);

    // 5. Construct Structured Export Archive
    const exportBundle = {
      metadata: {
        exportDate: new Date().toISOString(),
        platform: 'BloodLink Emergency Coordination System',
        dataPortabilityVersion: '1.0',
        userId: user._id,
        userRole: user.role,
        purpose: 'User Data Portability and Privacy Compliance Export',
        confidentialityNotice:
          'This archive contains your self-reported data, preferences, and platform activity history.',
      },
      account: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status,
        registeredAt: user.createdAt,
        lastUpdatedAt: user.updatedAt,
      },
      profile: profileData,
      activity: activityData,
      notifications,
      auditLogs,
    };

    // Log the export event for compliance
    await AuditLog.create({
      actorId: userId,
      action: 'USER_DATA_EXPORT',
      resource: 'User',
      resourceId: userId,
      details: { exportTime: new Date() },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json({
      status: 'success',
      data: exportBundle,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user privacy settings (hideExactLocation, contact visibility)
 * (Prompt.md rule 631: "Provide appropriate privacy settings")
 */
export async function updatePrivacySettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'fail', message: 'Authentication required.' });
      return;
    }

    const { hideExactLocation, showContactToMatchedHospitalsOnly } = req.body;

    if (req.user.role === 'DONOR') {
      const donor = await DonorProfile.findOne({ userId: req.user.id });
      if (!donor) {
        res.status(404).json({ status: 'fail', message: 'Donor profile not found.' });
        return;
      }

      if (typeof hideExactLocation === 'boolean') {
        donor.privacySettings.hideExactLocation = hideExactLocation;
      }
      if (typeof showContactToMatchedHospitalsOnly === 'boolean') {
        donor.privacySettings.showContactToMatchedHospitalsOnly = showContactToMatchedHospitalsOnly;
      }

      await donor.save();

      await AuditLog.create({
        actorId: req.user.id,
        action: 'PRIVACY_SETTINGS_UPDATED',
        resource: 'DonorProfile',
        resourceId: donor._id.toString(),
        details: { privacySettings: donor.privacySettings },
        ipAddress: req.ip || req.socket.remoteAddress,
      });

      res.status(200).json({
        status: 'success',
        message: 'Privacy settings updated successfully.',
        data: { privacySettings: donor.privacySettings },
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      message: 'Settings acknowledged for user role.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change authenticated user's account password
 */
export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'fail', message: 'Authentication required.' });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        status: 'fail',
        message: 'Both current password and new password are required.',
      });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({
        status: 'fail',
        message: 'New password must be at least 8 characters long.',
      });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ status: 'fail', message: 'User not found.' });
      return;
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({
        status: 'fail',
        message: 'Current password is incorrect.',
      });
      return;
    }

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await AuditLog.create({
      actorId: req.user.id,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      resourceId: req.user.id,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Self-service account deletion and anonymization architecture
 * (Prompt.md rule 632: "Provide account deletion architecture")
 */
export async function deleteAccount(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'fail', message: 'Authentication required.' });
      return;
    }

    const { password } = req.body;
    if (!password) {
      res.status(400).json({
        status: 'fail',
        message: 'Password confirmation is required to delete an account.',
      });
      return;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ status: 'fail', message: 'User not found.' });
      return;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({
        status: 'fail',
        message: 'Incorrect password. Account deletion aborted.',
      });
      return;
    }

    // Deactivate donor availability immediately if donor
    if (user.role === 'DONOR') {
      await DonorProfile.updateOne(
        { userId: user._id },
        { $set: { isAvailable: false } }
      );
    }

    // Set user account status to SUSPENDED / Deactivated and scrub identifiable data
    user.status = 'SUSPENDED';
    user.name = `Deactivated User (${user._id.toString().slice(-4)})`;
    user.email = `deleted_${user._id.toString()}@anonymized.bloodlink.local`;
    user.phone = '0000000000';
    await user.save();

    await AuditLog.create({
      actorId: req.user.id,
      action: 'USER_ACCOUNT_DELETED',
      resource: 'User',
      resourceId: req.user.id,
      details: { deletionTimestamp: new Date(), requestedByUser: true },
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    res.status(200).json({
      status: 'success',
      message: 'Your account has been deactivated and personal data anonymized in accordance with platform privacy policy.',
    });
  } catch (error) {
    next(error);
  }
}
