import { Request, Response, NextFunction } from 'express';
import { DonorProfile, EmergencyRequest, DonationHistory, Notification, AuditLog, HospitalProfile } from '../models';
import { isBloodCompatible } from '../config/bloodCompatibility';
import { calculateDistanceKm } from '../utils/geo';
import { BloodGroup, BloodComponent } from '../types';
import {
  emitDonorResponse,
  emitRequestUpdated,
  pushUnreadCount,
} from '../services/socketService';

/**
 * Get comprehensive donor dashboard statistics and status
 */
export async function getDonorDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'DONOR') {
      res.status(403).json({ status: 'fail', message: 'Unauthorized. Donor access only.' });
      return;
    }

    const donor = await DonorProfile.findOne({ userId: req.user.id });
    if (!donor) {
      res.status(404).json({ status: 'fail', message: 'Donor profile not found.' });
      return;
    }

    // 1. Find active nearby emergency requests compatible with this donor
    const activeRequests = await EmergencyRequest.find({
      status: { $in: ['ACTIVE', 'MATCHED'] },
    }).populate('hospitalId', 'hospitalName emergencyHelpline address');

    // Filter compatible requests
    const compatibleRequests = activeRequests
      .filter((request) => {
        const isCompatible = isBloodCompatible(
          donor.bloodGroup,
          request.bloodGroup,
          request.bloodComponent
        );
        const supportsComponent = donor.supportedComponents.includes(request.bloodComponent);
        return isCompatible && supportsComponent;
      })
      .map((request) => {
        const distanceKm = calculateDistanceKm(
          donor.location.coordinates,
          request.location.coordinates
        );
        const matchEntry = request.potentialMatches.find(
          (m) => m.donorId.toString() === donor._id.toString()
        );

        return {
          id: request._id,
          hospitalName: (request.hospitalId as unknown as { hospitalName?: string })?.hospitalName || 'Hospital',
          bloodGroup: request.bloodGroup,
          bloodComponent: request.bloodComponent,
          unitsRequired: request.unitsRequired,
          urgency: request.urgency,
          status: request.status,
          distanceKm,
          myResponseStatus: matchEntry ? matchEntry.status : 'NOTIFIED',
          createdAt: request.createdAt,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // 2. Count donations
    const donationCount = await DonationHistory.countDocuments({
      donorId: donor._id,
      status: 'COMPLETED',
    });

    // 3. Unread notification count
    const unreadNotifications = await Notification.countDocuments({
      recipientId: req.user.id,
      isRead: false,
    });

    res.status(200).json({
      status: 'success',
      dashboard: {
        profile: donor.toSafeProfile(),
        isAvailable: donor.isAvailable,
        bloodGroup: donor.bloodGroup,
        supportedComponents: donor.supportedComponents,
        selfReportedScreening: donor.selfReportedScreening,
        stats: {
          compatibleActiveRequestsCount: compatibleRequests.length,
          totalCompletedDonations: donationCount,
          unreadNotificationsCount: unreadNotifications,
        },
        nearbyCompatibleRequests: compatibleRequests.slice(0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Switch donor availability status (available / unavailable)
 */
export async function toggleDonorAvailability(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { isAvailable } = req.body as { isAvailable: boolean };

    const donor = await DonorProfile.findOne({ userId: req.user!.id });
    if (!donor) {
      res.status(404).json({ status: 'fail', message: 'Donor profile not found.' });
      return;
    }

    donor.isAvailable = isAvailable;
    await donor.save();

    await AuditLog.create({
      actorId: req.user!.id,
      action: 'DONOR_AVAILABILITY_TOGGLED',
      resource: 'DonorProfile',
      resourceId: donor._id.toString(),
      details: { isAvailable },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `Availability updated to ${isAvailable ? 'Available' : 'Unavailable'}`,
      isAvailable: donor.isAvailable,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update self-reported screening checklist
 */
export async function updateDonorScreening(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const donor = await DonorProfile.findOne({ userId: req.user!.id });
    if (!donor) {
      res.status(404).json({ status: 'fail', message: 'Donor profile not found.' });
      return;
    }

    donor.selfReportedScreening = {
      ...req.body,
      lastScreeningDate: new Date(),
    };
    await donor.save();

    res.status(200).json({
      status: 'success',
      message: 'Self-reported screening updated successfully.',
      disclaimer:
        'Self-reported screening indicates potential readiness only; final medical verification is performed at the donation site.',
      selfReportedScreening: donor.selfReportedScreening,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Donor accepts or declines an emergency blood request
 */
export async function respondToEmergencyRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { requestId } = req.params;
    const { action } = req.body as { action: 'ACCEPTED' | 'DECLINED' };

    const donor = await DonorProfile.findOne({ userId: req.user!.id });
    if (!donor) {
      res.status(404).json({ status: 'fail', message: 'Donor profile not found.' });
      return;
    }

    const request = await EmergencyRequest.findById(requestId);
    if (!request) {
      res.status(404).json({ status: 'fail', message: 'Emergency request not found.' });
      return;
    }

    // Check request state: only ACTIVE or MATCHED requests can receive responses
    if (request.status === 'FULFILLED' || request.status === 'CANCELLED' || request.status === 'EXPIRED') {
      res.status(400).json({
        status: 'fail',
        message: `Cannot respond to request with status '${request.status}'`,
      });
      return;
    }

    // Locate existing match entry or create if self-discovered
    let matchEntry = request.potentialMatches.find(
      (m) => m.donorId.toString() === donor._id.toString()
    );

    if (matchEntry) {
      // Prevent duplicate responses
      if (matchEntry.status === 'ACCEPTED' || matchEntry.status === 'DECLINED') {
        res.status(409).json({
          status: 'fail',
          message: `You have already responded '${matchEntry.status}' to this request.`,
        });
        return;
      }
      matchEntry.status = action;
      matchEntry.respondedAt = new Date();
    } else {
      // Add new match entry
      const distanceKm = calculateDistanceKm(
        donor.location.coordinates,
        request.location.coordinates
      );
      request.potentialMatches.push({
        donorId: donor._id,
        status: action,
        matchScore: 50,
        distanceKm,
        notifiedAt: new Date(),
        respondedAt: new Date(),
      });
    }

    // Check if total accepted donors meets requested units
    const totalAccepted = request.potentialMatches.filter((m) => m.status === 'ACCEPTED').length;
    if (totalAccepted >= request.unitsRequired && request.status === 'ACTIVE') {
      request.status = 'MATCHED';
    }

    await request.save();

    // Notify the hospital (persistent notification)
    const hospital = await HospitalProfile.findById(request.hospitalId);
    if (hospital && action === 'ACCEPTED') {
      await Notification.create({
        recipientId: hospital.userId,
        type: 'DONOR_ACCEPTED',
        title: `Donor Accepted: ${request.bloodGroup} Request`,
        message: `A potential donor with compatible blood group (${donor.bloodGroup}) has accepted your emergency request for ${request.unitsRequired} unit(s).`,
        data: {
          requestId: request._id.toString(),
          donorId: donor._id.toString(),
          action,
        },
      });
    }

    const totalAcceptedCount = request.potentialMatches.filter((m) => m.status === 'ACCEPTED').length;

    // Emit real-time events via Socket.IO (non-fatal if socket unavailable)
    try {
      // Push donor:response to hospital's personal room
      if (hospital) {
        const hospitalUserId = hospital.userId?.toString();
        if (hospitalUserId) {
          emitDonorResponse(hospitalUserId, {
            requestId: request._id.toString(),
            donorId: donor._id.toString(),
            donorBloodGroup: donor.bloodGroup,
            action,
            requestStatus: request.status,
            totalAccepted: totalAcceptedCount,
            unitsRequired: request.unitsRequired,
            timestamp: new Date().toISOString(),
          });
          // Refresh unread count for hospital
          void pushUnreadCount(hospitalUserId);
        }
      }

      // Broadcast request:updated to all subscribers of this request room
      emitRequestUpdated(request._id.toString(), {
        requestId: request._id.toString(),
        previousStatus: totalAcceptedCount >= request.unitsRequired ? 'ACTIVE' : request.status,
        newStatus: request.status,
        bloodGroup: request.bloodGroup,
        urgency: request.urgency,
        updatedBy: 'donor',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-fatal
    }

    // Security audit log
    await AuditLog.create({
      actorId: req.user!.id,
      action: `DONOR_REQUEST_${action}`,
      resource: 'EmergencyRequest',
      resourceId: request._id.toString(),
      details: { action, donorBloodGroup: donor.bloodGroup },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `You have successfully ${action.toLowerCase()} this emergency request.`,
      action,
      requestStatus: request.status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get verified completed donation records for the authenticated donor
 */
export async function getDonorHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const donor = await DonorProfile.findOne({ userId: req.user!.id });
    if (!donor) {
      res.status(404).json({ status: 'fail', message: 'Donor profile not found.' });
      return;
    }

    const history = await DonationHistory.find({ donorId: donor._id })
      .populate('hospitalId', 'hospitalName address')
      .sort({ donationDate: -1 });

    res.status(200).json({
      status: 'success',
      history,
    });
  } catch (error) {
    next(error);
  }
}
