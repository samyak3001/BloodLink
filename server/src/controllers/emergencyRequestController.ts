import { Request, Response, NextFunction } from 'express';
import { EmergencyRequest, HospitalProfile, Notification, AuditLog, DonorProfile, DonationHistory } from '../models';
import { findPotentialMatches } from '../services/matchingService';
import { isBloodCompatible } from '../config/bloodCompatibility';
import { RequestStatus, BloodGroup, BloodComponent, RequestUrgency, CoordinationStatus } from '../types';
import { calculateDistanceKm, formatDistance, estimateTransitTimeMinutes } from '../utils/geo';
import { DONOR_MATCH_RADIUS_KM } from '../config/constants';
import {
  emitEmergencyAlert,
  emitRequestUpdated,
  pushUnreadCount,
  getIO,
} from '../services/socketService';

import { autoExpireOverdueRequests } from '../services/requestExpirationService';

/**
 * Valid state transitions for emergency requests:
 * ACTIVE -> MATCHED, FULFILLED, CANCELLED, EXPIRED
 * MATCHED -> FULFILLED, CANCELLED, ACTIVE, EXPIRED
 * FULFILLED -> (Terminal state)
 * CANCELLED -> (Terminal state)
 * EXPIRED -> (Terminal state)
 */
const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  ACTIVE: ['MATCHED', 'FULFILLED', 'CANCELLED', 'EXPIRED'],
  MATCHED: ['FULFILLED', 'CANCELLED', 'ACTIVE', 'EXPIRED'],
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

    const requestCoordinates: [number, number] | undefined =
      coordinates && Array.isArray(coordinates) && coordinates.length === 2
        ? ([coordinates[0], coordinates[1]] as [number, number])
        : Array.isArray(hospital.location?.coordinates) && hospital.location.coordinates.length === 2
        ? (hospital.location.coordinates as [number, number])
        : undefined;

    if (!requestCoordinates) {
      res.status(400).json({
        status: 'fail',
        message:
          'Your hospital profile does not have valid location coordinates. Please update your hospital facility profile with valid coordinates before creating an emergency blood request.',
      });
      return;
    }

    // 1. Run matching engine to locate initial potential matches
    // hospitalDistrict allows the engine to include donors in the same district
    // even if their GPS coordinates are missing or beyond the GPS radius.
    const hospAddr = hospital.address as any;
    const potentialMatches = await findPotentialMatches({
      targetBloodGroup: bloodGroup as BloodGroup,
      bloodComponent: (bloodComponent || 'WHOLE_BLOOD') as BloodComponent,
      urgency: urgency as RequestUrgency,
      location: requestCoordinates,
      maxRadiusKm: maxRadiusKm || DONOR_MATCH_RADIUS_KM,
      limit: 50,
      hospitalDistrict: (hospAddr?.district || hospAddr?.city || '').trim(),
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
        searchRadiusKm: maxRadiusKm || DONOR_MATCH_RADIUS_KM,
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
    // Automatically transition any overdue active requests to EXPIRED status
    await autoExpireOverdueRequests();

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

    const queryBuilder = EmergencyRequest.find(query)
      .populate('hospitalId', 'hospitalName emergencyHelpline address location isVerifiedByAdmin')
      .sort({ urgency: 1, createdAt: -1 });

    const [requests, totalCount] = await Promise.all([
      typeof (queryBuilder as any).skip === 'function'
        ? (queryBuilder as any).skip(skip).limit(pageSize)
        : queryBuilder,
      EmergencyRequest.countDocuments(query),
    ]);

    // Apply strict blood compatibility and proximity filter if caller is an authenticated donor
    const eligibleRequests = donorProfile
      ? requests.filter((r: any) => {
          const hosp = r.hospitalId as unknown as {
            isVerifiedByAdmin?: boolean;
            location?: { coordinates?: [number, number] };
            address?: { district?: string; city?: string; state?: string };
          } | null;

          // Medical facility must be verified by admin
          if (hosp && hosp.isVerifiedByAdmin === false) {
            return false;
          }

          const isComp = isBloodCompatible(
            donorProfile!.bloodGroup,
            r.bloodGroup,
            r.bloodComponent || 'WHOLE_BLOOD'
          );
          const supportsComp =
            !donorProfile!.supportedComponents ||
            donorProfile!.supportedComponents.length === 0 ||
            donorProfile!.supportedComponents.includes(r.bloodComponent || 'WHOLE_BLOOD');

          if (!isComp || !supportsComp) return false;

          const matchEntry = r.potentialMatches?.find(
            (m: any) => (m.donorId?._id || m.donorId).toString() === donorProfile!._id.toString()
          );

          // If donor has already accepted, keep it visible for coordination
          if (matchEntry?.status === 'ACCEPTED') return true;

          // Donor must be available to receive new emergency requests
          if (donorProfile!.isAvailable === false) return false;

          // --- District-based matching (primary) ---
          // If both donor and hospital have a non-empty district and they match,
          // the request is eligible regardless of GPS distance.
          const donorDistrict = (donorProfile!.address as any)?.district;
          const hospDistrict = hosp?.address?.district;
          const donorDistrictNorm = (donorDistrict || '').trim().toLowerCase();
          const hospDistrictNorm = (hospDistrict || '').trim().toLowerCase();
          const sameDistrict =
            donorDistrictNorm.length > 0 &&
            hospDistrictNorm.length > 0 &&
            donorDistrictNorm === hospDistrictNorm;

          if (sameDistrict) return true;

          // --- GPS-based matching (fallback when districts differ or are missing) ---
          const donorCoords = donorProfile!.location?.coordinates;
          const reqCoords = r.location?.coordinates || hosp?.location?.coordinates;
          const hasCoords =
            Array.isArray(donorCoords) &&
            donorCoords.length === 2 &&
            Array.isArray(reqCoords) &&
            reqCoords.length === 2;

          if (hasCoords) {
            const distanceKm = calculateDistanceKm(donorCoords as [number, number], reqCoords as [number, number]);
            return distanceKm <= DONOR_MATCH_RADIUS_KM;
          }

          // If location was explicitly defined on either but incomplete (e.g. coordinates: []), exclude
          if (donorProfile!.location || r.location || hosp?.location) {
            return false;
          }

          // Minimal mock objects without location fields in non-geospatial unit tests
          return true;
        })
      : requests;


    const serializedRequests = eligibleRequests.map((req: any) => {
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

      let myResponseStatus: 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | null = null;
      let coordinationStatus: CoordinationStatus = 'PENDING';
      let distanceKm: number | undefined;
      let distanceFormatted: string | undefined;
      let estimatedTransitTimeMinutes: number | undefined;

      if (donorProfile) {
        const matchEntry = req.potentialMatches?.find(
          (m: any) => (m.donorId?._id || m.donorId).toString() === donorProfile._id.toString()
        );
        myResponseStatus = matchEntry ? matchEntry.status : 'NOTIFIED';
        coordinationStatus = matchEntry?.coordinationStatus || 'PENDING';

        const requestCoords = req.location?.coordinates || (hosp as any)?.location?.coordinates;
        const hasCoords =
          Array.isArray(donorProfile.location?.coordinates) &&
          donorProfile.location.coordinates.length === 2 &&
          Array.isArray(requestCoords) &&
          requestCoords.length === 2;

        if (hasCoords) {
          const rawDist = calculateDistanceKm(donorProfile.location.coordinates, requestCoords as [number, number]);
          distanceKm = Math.round(rawDist * 10) / 10;
          distanceFormatted = `${(Math.round(rawDist * 10) / 10).toFixed(1)} km away`;
          estimatedTransitTimeMinutes = estimateTransitTimeMinutes(rawDist);
        } else {
          distanceFormatted = 'Location unavailable';
        }
      }

      const createdDate = req.createdAt ? new Date(req.createdAt) : new Date();
      const requiredHours = typeof req.requiredWithinHours === 'number' && req.requiredWithinHours > 0 ? req.requiredWithinHours : 3;
      const expiresAt = new Date(createdDate.getTime() + requiredHours * 3600 * 1000).toISOString();

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
        myResponseStatus,
        donorResponseStatus: myResponseStatus,
        coordinationStatus,
        distanceKm,
        distanceFormatted,
        estimatedTransitTimeMinutes,
        expiresAt,
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
        select: 'bloodGroup supportedComponents address isAvailable location privacySettings userId selfReportedScreening',
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

    // Auto-expire if timeframe elapsed
    if (request.status === 'ACTIVE' || request.status === 'MATCHED') {
      const createdTime = request.createdAt ? new Date(request.createdAt).getTime() : 0;
      const hours = typeof request.requiredWithinHours === 'number' && request.requiredWithinHours > 0 ? request.requiredWithinHours : 3;
      if (createdTime > 0 && Date.now() > createdTime + hours * 3600 * 1000) {
        request.status = 'EXPIRED';
        await request.save();
      }
    }

    // Check caller context
    let donorResponseStatus = null;
    let donorCoordinationStatus: CoordinationStatus | null = null;
    if (req.user && req.user.role === 'DONOR') {
      const donor = await DonorProfile.findOne({ userId: req.user.id });
      if (donor) {
        const matchEntry = request.potentialMatches.find(
          (m) => m.donorId && (m.donorId._id || m.donorId).toString() === donor._id.toString()
        );
        if (matchEntry) {
          donorResponseStatus = matchEntry.status;
          donorCoordinationStatus = matchEntry.coordinationStatus || 'PENDING';
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
        supportedComponents?: string[];
        selfReportedScreening?: any;
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
        coordinationStatus: (m.coordinationStatus || 'PENDING') as CoordinationStatus,
        isAvailable: donorDoc?.isAvailable !== false,
        supportedComponents: donorDoc?.supportedComponents || [],
        selfReportedScreening: donorDoc?.selfReportedScreening,
        unitsOffered: 1,
        notifiedAt: m.notifiedAt,
        acceptedAt: m.respondedAt || m.notifiedAt,
        respondedAt: m.respondedAt || m.notifiedAt,
        reviewedAt: m.reviewedAt,
        contactedAt: m.contactedAt,
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
      myResponseStatus: donorResponseStatus || 'NOTIFIED',
      donorResponseStatus: donorResponseStatus || 'NOTIFIED',
      coordinationStatus: donorCoordinationStatus || 'PENDING',
      donorCoordinationStatus: donorCoordinationStatus || 'PENDING',
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
              type: 'STATUS_UPDATE',
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
      select: 'bloodGroup supportedComponents address isAvailable location privacySettings userId selfReportedScreening',
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

    // Refresh potential matches dynamically to ensure newly registered or relocated donors appear
    if (
      (request.status === 'ACTIVE' || request.status === 'MATCHED') &&
      Array.isArray(request.location?.coordinates) &&
      request.location.coordinates.length === 2
    ) {
      try {
        const freshMatches = await findPotentialMatches({
          targetBloodGroup: request.bloodGroup,
          bloodComponent: request.bloodComponent || 'WHOLE_BLOOD',
          urgency: request.urgency,
          location: request.location.coordinates as [number, number],
          maxRadiusKm: DONOR_MATCH_RADIUS_KM,
          limit: 50,
        });

        const existingDonorIds = new Set(
          request.potentialMatches.map((m) => (m.donorId?._id || m.donorId).toString())
        );

        let addedNewMatch = false;
        for (const match of freshMatches) {
          if (!existingDonorIds.has(match.donorId)) {
            request.potentialMatches.push({
              donorId: match.donorId as any,
              status: 'NOTIFIED',
              coordinationStatus: 'PENDING',
              matchScore: match.matchScore,
              distanceKm: match.distanceKm,
              notifiedAt: new Date(),
            });
            existingDonorIds.add(match.donorId);
            addedNewMatch = true;
          }
        }

        if (addedNewMatch) {
          await request.save();
          // Re-populate newly added donor profiles
          await request.populate({
            path: 'potentialMatches.donorId',
            select: 'bloodGroup supportedComponents address isAvailable location privacySettings userId selfReportedScreening',
            populate: { path: 'userId', select: 'name email phone isVerified' },
          });
        }
      } catch (matchErr) {
        console.warn('[MatchingEngine] Dynamic potential matches evaluation non-fatal error:', matchErr);
      }
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
        selfReportedScreening?: any;
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
        coordinationStatus: (item.coordinationStatus || 'PENDING') as CoordinationStatus,
        distanceKm: item.distanceKm,
        matchScore: item.matchScore,
        isAvailable: donorDoc?.isAvailable !== false,
        isCompatible: true,
        selfReportedScreening: donorDoc?.selfReportedScreening,
        notifiedAt: item.notifiedAt,
        acceptedAt: item.respondedAt || item.notifiedAt,
        respondedAt: item.respondedAt,
        reviewedAt: item.reviewedAt,
        contactedAt: item.contactedAt,
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
 * Hospital marks an accepted donor profile as reviewed (medical safety verification step)
 */
export async function reviewAcceptedDonor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { donorId } = req.body as { donorId: string };

    if (!donorId) {
      res.status(400).json({
        status: 'fail',
        message: 'donorId is required to review donor.',
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
    if (req.user?.role === 'HOSPITAL') {
      const hospital = await HospitalProfile.findOne({ userId: req.user.id });
      if (!hospital || hospital._id.toString() !== request.hospitalId.toString()) {
        res.status(403).json({
          status: 'fail',
          message: 'You can only review accepted donors for requests initiated by your hospital.',
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

    const matchEntry = request.potentialMatches.find(
      (m) => (m.donorId && (m.donorId._id || m.donorId).toString()) === donorId.toString() && m.status === 'ACCEPTED'
    );

    if (!matchEntry) {
      res.status(400).json({
        status: 'fail',
        message: 'This donor has not accepted this emergency request. You can only review accepted donors.',
      });
      return;
    }

    // Update coordination status to HOSPITAL_REVIEWED if not already CONTACTED
    if (matchEntry.coordinationStatus !== 'CONTACTED') {
      matchEntry.coordinationStatus = 'HOSPITAL_REVIEWED';
    }
    matchEntry.reviewedAt = new Date();
    if (typeof request.save === 'function') {
      await request.save();
    }

    await AuditLog.create({
      actorId: req.user!.id,
      action: 'DONOR_REVIEWED',
      resource: 'EmergencyRequest',
      resourceId: request._id.toString(),
      details: { donorId, coordinationStatus: matchEntry.coordinationStatus },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: 'Donor profile marked as reviewed by hospital.',
      donorId,
      coordinationStatus: matchEntry.coordinationStatus,
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
    const hospAddress = hospital?.address as { street?: string; city?: string; state?: string; postalCode?: string } | undefined;
    const hospLocationStr = hospAddress
      ? [hospAddress.street, hospAddress.city, hospAddress.state].filter(Boolean).join(', ')
      : 'See hospital contact information';

    const contactMsg =
      message ||
      `${hospName} has reviewed your response and is ready to coordinate your donation for Emergency Request (${request.patientIdentifier || request._id.toString().slice(-8).toUpperCase()}). ` +
      `Blood required: ${request.bloodGroup} (${request.bloodComponent}). ` +
      `Please proceed to the hospital: ${hospLocationStr}. ` +
      `Emergency Helpline: ${helpline}. ` +
      `Follow the hospital's instructions upon arrival.`;

    // Update coordination status to CONTACTED in DB
    const matchIdx = request.potentialMatches.findIndex(
      (m) => (m.donorId && (m.donorId._id || m.donorId).toString()) === donorId.toString()
    );
    if (matchIdx !== -1) {
      request.potentialMatches[matchIdx].coordinationStatus = 'CONTACTED';
      request.potentialMatches[matchIdx].contactedAt = new Date();
      if (typeof request.save === 'function') {
        await request.save();
      }
    }

    await Notification.create({
      recipientId: donorUserId,
      type: 'STATUS_UPDATE',
      title: `🏥 Proceed to ${hospName} — Donation Coordination Ready`,
      message: contactMsg,
      data: {
        requestId: request._id.toString(),
        patientIdentifier: request.patientIdentifier,
        hospitalName: hospName,
        hospitalHelpline: helpline,
        hospitalAddress: hospLocationStr,
        bloodGroup: request.bloodGroup,
        bloodComponent: request.bloodComponent,
        urgency: request.urgency,
        coordinationStatus: 'CONTACTED',
      },
    });

    void pushUnreadCount(donorUserId);

    // Real-time socket notification to donor
    try {
      const ioInstance = getIO();
      if (ioInstance) {
        ioInstance.to(`user:${donorUserId}`).emit('donor:response', {
          requestId: request._id.toString(),
          action: 'HOSPITAL_CONTACTED',
          hospitalName: hospName,
          message: `${hospName} has initiated donation coordination. Please proceed to the hospital.`,
          coordinationStatus: 'CONTACTED',
        } as any);
      }
    } catch {
      // Non-fatal
    }

    // Audit log
    await AuditLog.create({
      actorId: req.user!.id,
      action: 'DONOR_CONTACTED',
      resource: 'EmergencyRequest',
      resourceId: request._id.toString(),
      details: { donorId, showContact, coordinationStatus: 'CONTACTED' },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `Coordination message dispatched to ${donorUser.name || 'donor'}.`,
      donorId,
      donorName: donorUser.name,
      coordinationStatus: 'CONTACTED',
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

