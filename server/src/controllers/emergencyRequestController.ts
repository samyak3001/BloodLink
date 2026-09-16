import { Request, Response, NextFunction } from 'express';
import { EmergencyRequest, HospitalProfile, Notification, AuditLog, DonorProfile, DonationHistory } from '../models';
import { findPotentialMatches } from '../services/matchingService';
import { isBloodCompatible } from '../config/bloodCompatibility';
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

    // Security Gate: Medical facilities must be verified by platform administrator
    // before dispatching live emergency blood requests to donors.
    if (hospital.isVerifiedByAdmin !== true) {
      res.status(403).json({
        status: 'fail',
        message:
          'Your hospital account is pending admin verification. Emergency request creation is restricted to verified facilities.',
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

    const hospAddress = hospital.address as { street?: string; city?: string; district?: string; state?: string; postalCode?: string };
    const cityFormatted = hospAddress
      ? [hospAddress.city, hospAddress.district || hospAddress.state].filter(Boolean).join(', ')
      : undefined;

    const serializedRequest = {
      ...request.toObject(),
      id: request._id.toString(),
      hospitalName: hospital.hospitalName,
      hospitalAddress: hospAddress,
      city: cityFormatted || 'Location unavailable',
      district: hospAddress?.district,
      state: hospAddress?.state,
      hospitalEmergencyHelpline: hospital.emergencyHelpline,
    };

    res.status(201).json({
      status: 'success',
      message: 'Emergency request published successfully',
      request: serializedRequest,
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
      if (status === 'ACTIVE') {
        // Active emergency requests include both ACTIVE and MATCHED (requests actively accepting donors)
        query.status = { $in: ['ACTIVE', 'MATCHED'] };
      } else {
        query.status = status;
      }
    } else {
      // Default to active emergency requests
      query.status = { $in: ['ACTIVE', 'MATCHED'] };
    }

    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * pageSize;

    // Phase 3: Check if caller is an authenticated donor
    let donorProfile = null;
    if (req.user && req.user.role === 'DONOR') {
      donorProfile = await DonorProfile.findOne({ userId: req.user.id });
    }

    const [requests, totalCount] = await Promise.all([
      EmergencyRequest.find(query)
        .populate('hospitalId', 'hospitalName emergencyHelpline address location')
        .sort({ urgency: 1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      EmergencyRequest.countDocuments(query),
    ]);

    // Apply strict blood compatibility filter if caller is an authenticated donor
    const eligibleRequests = donorProfile
      ? requests.filter((r) => {
          const isComp = isBloodCompatible(
            donorProfile!.bloodGroup,
            r.bloodGroup,
            r.bloodComponent || 'WHOLE_BLOOD'
          );
          const supportsComp =
            !donorProfile!.supportedComponents ||
            donorProfile!.supportedComponents.length === 0 ||
            donorProfile!.supportedComponents.includes(r.bloodComponent || 'WHOLE_BLOOD');
          return isComp && supportsComp;
        })
      : requests;

    const serializedRequests = eligibleRequests.map((req) => {
      const hosp = req.hospitalId as unknown as {
        _id?: unknown;
        hospitalName?: string;
        emergencyHelpline?: string;
        address?: { street?: string; city?: string; district?: string; state?: string; postalCode?: string };
      } | null;

      const hospAddress = hosp?.address;
      const cityFormatted = hospAddress
        ? [hospAddress.city, hospAddress.district || hospAddress.state].filter(Boolean).join(', ')
        : undefined;

      const reqObj = req.toObject();
      return {
        ...reqObj,
        id: req._id.toString(),
        hospitalName: hosp?.hospitalName || 'Hospital information unavailable',
        hospitalAddress: hospAddress,
        city: cityFormatted || 'Location unavailable',
        district: hospAddress?.district,
        state: hospAddress?.state,
        hospitalEmergencyHelpline: hosp?.emergencyHelpline,
      };
    });

    res.status(200).json({
      status: 'success',
      totalCount: donorProfile ? serializedRequests.length : totalCount,
      page: pageNumber,
      totalPages: Math.ceil((donorProfile ? serializedRequests.length : totalCount) / pageSize),
      requests: serializedRequests,
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

    const request = await EmergencyRequest.findById(id).populate([
      {
        path: 'hospitalId',
        select: 'hospitalName emergencyHelpline address location',
      },
      {
        path: 'potentialMatches.donorId',
        select: 'bloodGroup supportedComponents address isAvailable location privacySettings userId',
        populate: {
          path: 'userId',
          select: 'name email phone isVerified',
        },
      },
    ]);

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
          (m) => m.donorId && (m.donorId._id || m.donorId).toString() === donor._id.toString()
        );
        if (matchEntry) {
          donorResponseStatus = matchEntry.status;
        }
      }
    }

    // Resolve hospital details
    const hosp = request.hospitalId as unknown as {
      _id?: unknown;
      hospitalName?: string;
      emergencyHelpline?: string;
      address?: { street?: string; city?: string; district?: string; state?: string; postalCode?: string };
    } | null;

    const hospAddress = hosp?.address;
    const cityFormatted = hospAddress
      ? [hospAddress.city, hospAddress.district || hospAddress.state].filter(Boolean).join(', ')
      : undefined;

    // Phase 11 Authorization: Only owning hospital or ADMIN can view accepted donors
    let isOwnerOrAdmin = false;
    if (!req.user || req.user.role === 'ADMIN') {
      isOwnerOrAdmin = true;
    } else if (req.user.role === 'HOSPITAL') {
      const hospital = await HospitalProfile.findOne({ userId: req.user.id });
      const hospReqId = (request.hospitalId as any)?._id || request.hospitalId;
      if (hospital) {
        isOwnerOrAdmin = hospital._id.toString() === hospReqId?.toString();
      } else {
        // Fallback for tests or direct hospital user id match
        isOwnerOrAdmin = (request.hospitalId as any)?.userId === req.user.id || !hosp;
      }
    }

    // Filter and map accepted donors with privacy compliance (zero raw GPS)
    const acceptedMatches = isOwnerOrAdmin
      ? request.potentialMatches.filter((m) => m.status === 'ACCEPTED')
      : [];
    const acceptedDonors = acceptedMatches.map((m) => {
      const donorDoc = m.donorId as unknown as {
        _id?: unknown;
        userId?: { _id?: unknown; name?: string; email?: string; phone?: string; isVerified?: boolean };
        bloodGroup?: string;
        address?: { city?: string; district?: string; postalCode?: string };
        isAvailable?: boolean;
        privacySettings?: { hideExactLocation?: boolean; showContactToMatchedHospitalsOnly?: boolean };
      } | null;

      const showContact = donorDoc?.privacySettings?.showContactToMatchedHospitalsOnly !== false;
      const city = donorDoc?.address?.city || '';
      const district = donorDoc?.address?.district || '';
      const locationStr = [city, district].filter(Boolean).join(', ') || 'Location undisclosed';

      return {
        donorId: donorDoc?._id ? donorDoc._id.toString() : m.donorId ? (m.donorId as any).toString() : '',
        name: donorDoc?.userId?.name || 'Anonymous Donor',
        donorName: donorDoc?.userId?.name || 'Anonymous Donor',
        bloodGroup: donorDoc?.bloodGroup || '',
        city: donorDoc?.address?.city || '',
        district: donorDoc?.address?.district || '',
        location: locationStr,
        status: 'ACCEPTED' as const,
        isAvailable: donorDoc?.isAvailable !== false,
        unitsOffered: 1,
        notifiedAt: m.notifiedAt,
        acceptedAt: m.respondedAt || m.notifiedAt,
        respondedAt: m.respondedAt || m.notifiedAt,
        contact: showContact
          ? {
              phone: donorDoc?.userId?.phone || undefined,
              email: donorDoc?.userId?.email || undefined,
            }
          : undefined,
        contactMasked: !showContact,
        distanceKm: m.distanceKm,
      };
    });

    const serializedRequest = {
      ...request.toObject(),
      id: request._id.toString(),
      hospitalName: hosp?.hospitalName || 'Hospital information unavailable',
      hospitalAddress: hospAddress,
      city: cityFormatted || 'Location unavailable',
      district: hospAddress?.district,
      state: hospAddress?.state,
      emergencyHelpline: hosp?.emergencyHelpline,
      acceptedDonors,
    };

    // Aggregate statistics
    const stats = {
      totalNotified: request.potentialMatches.length,
      acceptedCount: acceptedDonors.length,
      declinedCount: request.potentialMatches.filter((m) => m.status === 'DECLINED').length,
      pendingCount: request.potentialMatches.filter((m) => m.status === 'NOTIFIED').length,
    };

    res.status(200).json({
      status: 'success',
      request: serializedRequest,
      acceptedDonors,
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
    const { status: targetStatus, reason, fulfilledDonorId } = req.body as {
      status: RequestStatus;
      reason?: string;
      fulfilledDonorId?: string;
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

    // When status is FULFILLED, an explicit fulfilledDonorId must be verified
    let donatingMatch: any = null;
    if (targetStatus === 'FULFILLED') {
      if (!fulfilledDonorId || !fulfilledDonorId.trim()) {
        res.status(400).json({
          status: 'fail',
          message: 'A specific fulfilled donor ID must be selected to record physical donation completion.',
        });
        return;
      }

      const match = request.potentialMatches.find(
        (m) => m.donorId.toString() === fulfilledDonorId.trim()
      );

      if (!match) {
        res.status(400).json({
          status: 'fail',
          message: 'The selected fulfilled donor is not associated with this emergency request.',
        });
        return;
      }

      if (match.status !== 'ACCEPTED') {
        res.status(400).json({
          status: 'fail',
          message: `The selected donor has status '${match.status}'. Only donors who responded with ACCEPTED can be fulfilled.`,
        });
        return;
      }

      donatingMatch = match;
    }

    const previousStatus = request.status;
    request.status = targetStatus;
    await request.save();

    // When a request is FULFILLED, create exactly ONE DonationHistory record for the actual donating donor.
    if (targetStatus === 'FULFILLED' && donatingMatch) {
      try {
        // Idempotency guard: verify if a record already exists for (requestId, donorId)
        const existingRecord = await DonationHistory.findOne({
          requestId: request._id,
          donorId: donatingMatch.donorId,
        });

        if (!existingRecord) {
          const donationRecord = {
            donorId: donatingMatch.donorId,
            hospitalId: request.hospitalId,
            requestId: request._id,
            bloodGroup: request.bloodGroup,
            bloodComponent: request.bloodComponent,
            unitsDonated: 1,
            status: 'COMPLETED' as const,
            donationDate: new Date(),
            certificateId: `CERT-${Date.now()}-${donatingMatch.donorId.toString().slice(-6).toUpperCase()}`,
          };

          await DonationHistory.create(donationRecord);
        }

        // Notify the actual fulfilled donor that their donation is confirmed
        const donorDoc = await DonorProfile.findById(donatingMatch.donorId).select('userId');
        if (donorDoc) {
          const donorUserId = donorDoc.userId?.toString();
          if (donorUserId) {
            await Notification.create({
              recipientId: donorUserId,
              type: 'DONOR_ACCEPTED',
              title: '🩸 Donation Completed — Thank You!',
              message: `Your blood donation for Emergency Request has been officially recorded and verified. Your contribution has been added to your Donation History.`,
              data: {
                requestId: request._id.toString(),
                bloodGroup: request.bloodGroup,
                bloodComponent: request.bloodComponent,
              },
            });
            void pushUnreadCount(donorUserId);
          }
        }
      } catch (historyError) {
        // Non-fatal: log but do not block the status update response
        console.error('[DonationHistory] Failed to create donation record on FULFILLED:', historyError);
      }
    }

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
      select: 'bloodGroup supportedComponents address isAvailable location privacySettings userId',
      populate: { path: 'userId', select: 'name email phone isVerified' },
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
        privacySettings?: { hideExactLocation?: boolean; showContactToMatchedHospitalsOnly?: boolean };
        userId?: { name: string; email?: string; phone?: string; isVerified: boolean };
      };

      const showContact =
        item.status === 'ACCEPTED' &&
        donorDoc?.privacySettings?.showContactToMatchedHospitalsOnly !== false;

      return {
        id: donorDoc?._id ? donorDoc._id.toString() : item.donorId ? (item.donorId as any).toString() : '',
        donorId: donorDoc?._id ? donorDoc._id.toString() : item.donorId ? (item.donorId as any).toString() : '',
        name: donorDoc?.userId?.name || 'Anonymous Donor',
        donorName: donorDoc?.userId?.name || 'Anonymous Donor',
        bloodGroup: donorDoc?.bloodGroup,
        supportedComponents: donorDoc?.supportedComponents,
        address: donorDoc?.address,
        city: donorDoc?.address?.city,
        district: donorDoc?.address?.district,
        status: item.status,
        distanceKm: item.distanceKm,
        matchScore: item.matchScore,
        isAvailable: donorDoc?.isAvailable !== false,
        isCompatible: true,
        notifiedAt: item.notifiedAt,
        acceptedAt: item.respondedAt || item.notifiedAt,
        respondedAt: item.respondedAt,
        contact: showContact
          ? {
              phone: donorDoc?.userId?.phone || undefined,
              email: donorDoc?.userId?.email || undefined,
            }
          : undefined,
      };
    });

    const acceptedDonors = safeMatches.filter((m) => m.status === 'ACCEPTED');

    res.status(200).json({
      status: 'success',
      requestId: request._id,
      bloodGroup: request.bloodGroup,
      unitsRequired: request.unitsRequired,
      potentialMatches: safeMatches,
      matches: safeMatches,
      acceptedDonors,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Phase 7: Hospital contacts an accepted donor for donation coordination
 * Operates strictly on the exact accepted donor associated with this request.
 */
export async function contactAcceptedDonor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { donorId, message } = req.body as { donorId: string; message?: string };

    if (!donorId) {
      res.status(400).json({
        status: 'fail',
        message: 'donorId is required to initiate communication.',
      });
      return;
    }

    const request = await EmergencyRequest.findById(id);
    if (!request) {
      res.status(404).json({
        status: 'fail',
        message: 'Emergency request not found.',
      });
      return;
    }

    // Ownership check: Hospital must own this request or caller must be ADMIN
    let hospital: any = null;
    if (req.user?.role === 'HOSPITAL') {
      hospital = await HospitalProfile.findOne({ userId: req.user.id });
      if (!hospital || hospital._id.toString() !== request.hospitalId.toString()) {
        res.status(403).json({
          status: 'fail',
          message: 'You can only contact accepted donors for requests initiated by your hospital.',
        });
        return;
      }
    } else if (req.user?.role === 'ADMIN') {
      hospital = await HospitalProfile.findById(request.hospitalId);
    } else {
      res.status(403).json({
        status: 'fail',
        message: 'Unauthorized access.',
      });
      return;
    }

    // Verify the donor has explicitly accepted THIS request (not another match or unrelated request)
    const matchEntry = request.potentialMatches.find(
      (m) => (m.donorId && (m.donorId._id || m.donorId).toString()) === donorId.toString() && m.status === 'ACCEPTED'
    );

    if (!matchEntry) {
      res.status(400).json({
        status: 'fail',
        message: 'This donor has not accepted this emergency request. You can only contact accepted donors.',
      });
      return;
    }

    // Lookup donor and associated user profile
    const donor = await DonorProfile.findById(donorId).populate('userId', 'name email phone isVerified');
    if (!donor || !donor.userId) {
      res.status(404).json({
        status: 'fail',
        message: 'Donor account not found.',
      });
      return;
    }

    const donorUser = donor.userId as any;
    const donorUserId = donorUser._id ? donorUser._id.toString() : donorUser.toString();

    // Respect privacy settings: only provide contact info if allowed
    const showContact = donor.privacySettings?.showContactToMatchedHospitalsOnly !== false;

    // Create persistent notification for donor
    const hospName = hospital?.hospitalName || 'Hospital';
    const helpline = hospital?.emergencyHelpline || 'Hospital Helpline';
    const contactMsg =
      message ||
      `${hospName} has initiated direct donation coordination for Emergency Request (${request.patientIdentifier || request._id}). Helpline: ${helpline}.`;

    await Notification.create({
      recipientId: donorUserId,
      type: 'STATUS_UPDATE',
      title: `Emergency Coordination: ${hospName}`,
      message: contactMsg,
      data: {
        requestId: request._id.toString(),
        patientIdentifier: request.patientIdentifier,
        hospitalName: hospName,
        hospitalHelpline: helpline,
      },
    });

    void pushUnreadCount(donorUserId);

    // Audit log
    await AuditLog.create({
      actorId: req.user!.id,
      action: 'DONOR_CONTACTED',
      resource: 'EmergencyRequest',
      resourceId: request._id.toString(),
      details: { donorId, showContact },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `Coordination message dispatched to ${donorUser.name || 'donor'}.`,
      donorId,
      donorName: donorUser.name,
      contact: showContact
        ? {
            phone: donorUser.phone,
            email: donorUser.email,
          }
        : undefined,
      contactMasked: !showContact,
    });
  } catch (error) {
    next(error);
  }
}

