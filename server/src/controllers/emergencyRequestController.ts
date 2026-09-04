import { Request, Response, NextFunction } from 'express';
import { EmergencyRequest, HospitalProfile, Notification, AuditLog, DonorProfile } from '../models';
import { findPotentialMatches } from '../services/matchingService';
import { RequestStatus, BloodGroup, BloodComponent, RequestUrgency } from '../types';
import {
  emitEmergencyAlert,
  emitRequestUpdated,
  pushUnreadCount,
  getIO,
} from '../services/socketService';

/**
 * Valid state transitions for emergency requests:
 * ACTIVE -> MATCHED, FULFILLED, CANCELLED
 * MATCHED -> FULFILLED, CANCELLED, ACTIVE
 * FULFILLED -> (Terminal state)
 * CANCELLED -> (Terminal state)
 */
const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  ACTIVE: ['MATCHED', 'FULFILLED', 'CANCELLED'],
  MATCHED: ['FULFILLED', 'CANCELLED', 'ACTIVE'],
  FULFILLED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Hospital creates an urgent emergency blood request
 */
export async function createEmergencyRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'HOSPITAL') {
      res.status(403).json({
        status: 'fail',
        message: 'Only registered hospitals can initiate emergency blood requests.',
      });
      return;
    }

    const hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) {
      res.status(404).json({
        status: 'fail',
        message: 'Hospital profile not found. Please complete your medical facility profile.',
      });
      return;
    }

    const {
      patientIdentifier,
      bloodGroup,
      bloodComponent,
      unitsRequired,
      urgency,
      requiredWithinHours,
      coordinates,
      maxRadiusKm,
      notes,
    } = req.body;

    const requestCoordinates: [number, number] =
      coordinates && Array.isArray(coordinates) && coordinates.length === 2
        ? ([coordinates[0], coordinates[1]] as [number, number])
        : hospital.location.coordinates;

    // 1. Run matching engine to locate initial potential matches
    const potentialMatches = await findPotentialMatches({
      targetBloodGroup: bloodGroup as BloodGroup,
      bloodComponent: (bloodComponent || 'WHOLE_BLOOD') as BloodComponent,
      urgency: urgency as RequestUrgency,
      location: requestCoordinates,
      maxRadiusKm: maxRadiusKm || 30,
      limit: 50,
    });

    // 2. Prepare potential matches array for storage
    const potentialMatchEntries = potentialMatches.map((match) => ({
      donorId: match.donorId,
      status: 'NOTIFIED' as const,
      matchScore: match.matchScore,
      distanceKm: match.distanceKm,
      notifiedAt: new Date(),
    }));

    // 3. Create EmergencyRequest in MongoDB
    const request = await EmergencyRequest.create({
      hospitalId: hospital._id,
      patientIdentifier,
      bloodGroup,
      bloodComponent: bloodComponent || 'WHOLE_BLOOD',
      unitsRequired,
      urgency,
      status: 'ACTIVE',
      location: {
        type: 'Point',
        coordinates: requestCoordinates,
      },
      requiredWithinHours,
      potentialMatches: potentialMatchEntries,
      notes,
    });

    // 4. Create persistent Notification documents for candidate donors
    const notificationPromises = potentialMatches.map((match) => {
      if (!match.userId) return Promise.resolve();
      return Notification.create({
        recipientId: match.userId,
        type: 'EMERGENCY_ALERT',
        title: `URGENT: ${urgency} Blood Request (${bloodGroup})`,
        message: `${hospital.hospitalName} urgently requires ${unitsRequired} unit(s) of ${bloodGroup} (${bloodComponent || 'WHOLE_BLOOD'}). Approximately ${match.distanceFormatted} away.`,
        data: {
          requestId: request._id.toString(),
          bloodGroup,
          bloodComponent: bloodComponent || 'WHOLE_BLOOD',
          urgency,
          unitsRequired,
        },
      });
    });

    await Promise.allSettled(notificationPromises);

    // 6. Emit real-time emergency:alert to each matched donor via Socket.IO
    // NOTE: Exact GPS coordinates are NEVER included in the payload
    try {
      for (const match of potentialMatches) {
        if (match.userId) {
          emitEmergencyAlert(match.userId, {
            requestId: request._id.toString(),
            bloodGroup,
            bloodComponent: bloodComponent || 'WHOLE_BLOOD',
            unitsRequired,
            urgency,
            hospitalName: hospital.hospitalName,
            distanceKm: match.distanceKm,
            distanceFormatted: match.distanceFormatted,
            estimatedTransitTimeMinutes: match.estimatedTransitTimeMinutes,
            matchScore: match.matchScore,
            matchReasons: match.matchReasons,
            address: match.address,
          });
          // Push updated unread count badge to each notified donor
          void pushUnreadCount(match.userId);
        }
      }
    } catch {
      // Socket errors are non-fatal — REST response is authoritative
    }

    // 7. Security audit log
    await AuditLog.create({
      actorId: req.user.id,
      action: 'EMERGENCY_REQUEST_CREATED',
      resource: 'EmergencyRequest',
      resourceId: request._id.toString(),
      details: {
        bloodGroup,
        unitsRequired,
        urgency,
        potentialMatchesCount: potentialMatches.length,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({
      status: 'success',
      message: 'Emergency request published successfully',
      request,
      matchSummary: {
        totalPotentialMatchesNotified: potentialMatches.length,
        searchRadiusKm: maxRadiusKm || 30,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List emergency requests with configurable filters
 */
export async function getEmergencyRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { bloodGroup, bloodComponent, urgency, status, limit = '20', page = '1' } = req.query;

    const query: Record<string, unknown> = {};

    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (bloodComponent) query.bloodComponent = bloodComponent;
    if (urgency) query.urgency = urgency;
    if (status) {
      query.status = status;
    } else {
      // Default to active emergency requests
      query.status = { $in: ['ACTIVE', 'MATCHED'] };
    }

    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [requests, totalCount] = await Promise.all([
      EmergencyRequest.find(query)
        .populate('hospitalId', 'hospitalName emergencyHelpline address location')
        .sort({ urgency: 1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      EmergencyRequest.countDocuments(query),
    ]);

    res.status(200).json({
      status: 'success',
      totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get detailed emergency request by ID
 */
export async function getEmergencyRequestById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await EmergencyRequest.findById(id).populate(
      'hospitalId',
      'hospitalName emergencyHelpline address'
    );

    if (!request) {
      res.status(404).json({
        status: 'fail',
        message: 'Emergency request not found.',
      });
      return;
    }

    // Check caller context
    let donorResponseStatus = null;
    if (req.user && req.user.role === 'DONOR') {
      const donor = await DonorProfile.findOne({ userId: req.user.id });
      if (donor) {
        const matchEntry = request.potentialMatches.find(
          (m) => m.donorId.toString() === donor._id.toString()
        );
        if (matchEntry) {
          donorResponseStatus = matchEntry.status;
        }
      }
    }

    // Aggregate statistics
    const stats = {
      totalNotified: request.potentialMatches.length,
      acceptedCount: request.potentialMatches.filter((m) => m.status === 'ACCEPTED').length,
      declinedCount: request.potentialMatches.filter((m) => m.status === 'DECLINED').length,
      pendingCount: request.potentialMatches.filter((m) => m.status === 'NOTIFIED').length,
    };

    res.status(200).json({
      status: 'success',
      request,
      stats,
      donorResponseStatus,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update status of an emergency request (enforces state transitions)
 */
export async function updateEmergencyRequestStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { status: targetStatus, reason } = req.body as {
      status: RequestStatus;
      reason?: string;
    };

    const request = await EmergencyRequest.findById(id);
    if (!request) {
      res.status(404).json({
        status: 'fail',
        message: 'Emergency request not found.',
      });
      return;
    }

    // Permission check: only owning hospital or admin can update status
    if (req.user?.role === 'HOSPITAL') {
      const hospital = await HospitalProfile.findOne({ userId: req.user.id });
      if (!hospital || hospital._id.toString() !== request.hospitalId.toString()) {
        res.status(403).json({
          status: 'fail',
          message: 'You can only manage emergency requests raised by your hospital.',
        });
        return;
      }
    } else if (req.user?.role !== 'ADMIN') {
      res.status(403).json({
        status: 'fail',
        message: 'Unauthorized to change emergency request status.',
      });
      return;
    }

    // Validate state machine transition
    const allowedTargets = VALID_TRANSITIONS[request.status];
    if (!allowedTargets.includes(targetStatus)) {
      res.status(400).json({
        status: 'fail',
        message: `Invalid state transition from '${request.status}' to '${targetStatus}'. Allowed target states: ${
          allowedTargets.length > 0 ? allowedTargets.join(', ') : 'None (terminal state)'
        }`,
      });
      return;
    }

    const previousStatus = request.status;
    request.status = targetStatus;
    await request.save();

    // Emit real-time request:updated to all subscribers of this request room
    try {
      emitRequestUpdated(request._id.toString(), {
        requestId: request._id.toString(),
        previousStatus,
        newStatus: targetStatus,
        bloodGroup: request.bloodGroup,
        urgency: request.urgency,
        updatedBy: req.user?.role === 'ADMIN' ? 'admin' : 'hospital',
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-fatal
    }

    // Audit log
    await AuditLog.create({
      actorId: req.user.id,
      action: 'EMERGENCY_REQUEST_STATUS_UPDATED',
      resource: 'EmergencyRequest',
      resourceId: request._id.toString(),
      details: { previousStatus, targetStatus, reason },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `Request status successfully updated to '${targetStatus}'`,
      request,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Hospital retrieves potential matches and their response status (Strictly Privacy Protected)
 */
export async function getPotentialMatchesForRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const request = await EmergencyRequest.findById(id).populate({
      path: 'potentialMatches.donorId',
      select: 'bloodGroup supportedComponents address isAvailable userId',
      populate: { path: 'userId', select: 'name isVerified' },
    });

    if (!request) {
      res.status(404).json({
        status: 'fail',
        message: 'Emergency request not found.',
      });
      return;
    }

    // Ownership check
    if (req.user?.role === 'HOSPITAL') {
      const hospital = await HospitalProfile.findOne({ userId: req.user.id });
      if (!hospital || hospital._id.toString() !== request.hospitalId.toString()) {
        res.status(403).json({
          status: 'fail',
          message: 'Unauthorized to view potential matches for this facility request.',
        });
        return;
      }
    } else if (req.user?.role !== 'ADMIN') {
      res.status(403).json({
        status: 'fail',
        message: 'Unauthorized access.',
      });
      return;
    }

    // Sanitize output: Never leak raw GPS coordinates
    const safeMatches = request.potentialMatches.map((item) => {
      const donorDoc = item.donorId as unknown as {
        _id: unknown;
        bloodGroup: string;
        supportedComponents: string[];
        address: { city: string; district: string; postalCode: string };
        isAvailable: boolean;
        userId?: { name: string; isVerified: boolean };
      };

      return {
        donorId: donorDoc?._id?.toString(),
        donorName: donorDoc?.userId?.name || 'Anonymous Donor',
        bloodGroup: donorDoc?.bloodGroup,
        supportedComponents: donorDoc?.supportedComponents,
        address: donorDoc?.address,
        status: item.status,
        distanceKm: item.distanceKm,
        matchScore: item.matchScore,
        notifiedAt: item.notifiedAt,
        respondedAt: item.respondedAt,
      };
    });

    res.status(200).json({
      status: 'success',
      requestId: request._id,
      bloodGroup: request.bloodGroup,
      unitsRequired: request.unitsRequired,
      potentialMatches: safeMatches,
    });
  } catch (error) {
    next(error);
  }
}
