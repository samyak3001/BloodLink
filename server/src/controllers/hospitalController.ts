import { Request, Response, NextFunction } from 'express';
import { HospitalProfile, EmergencyRequest } from '../models';

/**
 * Get comprehensive hospital dashboard statistics
 */
export async function getHospitalDashboard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'HOSPITAL') {
      res.status(403).json({ status: 'fail', message: 'Unauthorized. Hospital access only.' });
      return;
    }

    const hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) {
      res.status(404).json({ status: 'fail', message: 'Hospital profile not found.' });
      return;
    }

    // Retrieve hospital's emergency requests
    const requests = await EmergencyRequest.find({ hospitalId: hospital._id })
      .sort({ createdAt: -1 })
      .limit(20);

    const activeRequests = requests.filter((r) => r.status === 'ACTIVE');
    const matchedRequests = requests.filter((r) => r.status === 'MATCHED');
    const fulfilledRequests = requests.filter((r) => r.status === 'FULFILLED');

    let totalUnitsRequested = 0;
    let totalAcceptedResponses = 0;

    requests.forEach((r) => {
      totalUnitsRequested += r.unitsRequired;
      totalAcceptedResponses += r.potentialMatches.filter((m) => m.status === 'ACCEPTED').length;
    });

    res.status(200).json({
      status: 'success',
      dashboard: {
        hospital: {
          id: hospital._id,
          hospitalName: hospital.hospitalName,
          licenseNumber: hospital.licenseNumber,
          emergencyHelpline: hospital.emergencyHelpline,
          isVerifiedByAdmin: hospital.isVerifiedByAdmin,
          address: hospital.address,
        },
        stats: {
          activeRequestsCount: activeRequests.length,
          matchedRequestsCount: matchedRequests.length,
          fulfilledRequestsCount: fulfilledRequests.length,
          totalUnitsRequested,
          totalAcceptedResponses,
        },
        recentRequests: requests.slice(0, 10).map((r) => ({
          id: r._id,
          patientIdentifier: r.patientIdentifier,
          bloodGroup: r.bloodGroup,
          bloodComponent: r.bloodComponent,
          unitsRequired: r.unitsRequired,
          urgency: r.urgency,
          status: r.status,
          totalNotified: r.potentialMatches.length,
          acceptedCount: r.potentialMatches.filter((m) => m.status === 'ACCEPTED').length,
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all emergency requests belonging to the authenticated hospital
 */
export async function getHospitalRequests(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const hospital = await HospitalProfile.findOne({ userId: req.user!.id });
    if (!hospital) {
      res.status(404).json({ status: 'fail', message: 'Hospital profile not found.' });
      return;
    }

    const { status, limit = '20', page = '1' } = req.query;
    const query: Record<string, unknown> = { hospitalId: hospital._id };

    if (status) {
      query.status = status;
    }

    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [requests, totalCount] = await Promise.all([
      EmergencyRequest.find(query)
        .sort({ createdAt: -1 })
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
