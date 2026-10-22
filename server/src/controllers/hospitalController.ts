import { Request, Response, NextFunction } from 'express';
import { HospitalProfile, EmergencyRequest, DonorProfile, User, AuditLog } from '../models';

/**
 * Normalise district: trim + lowercase for consistent comparison.
 * Returns empty string if the value is falsy.
 */
export function normalizeDistrict(value: string | undefined | null): string {
  return (value || '').trim().toLowerCase();
}

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

    let hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) {
      hospital = await HospitalProfile.create({
        userId: req.user.id,
        hospitalName: req.user.name || 'Healthcare Facility',
        licenseNumber: `HOSP-LIC-${req.user.id.slice(-4).toUpperCase()}`,
        emergencyHelpline: req.user.phone || '+910000000000',
        isVerifiedByAdmin: false,
        location: undefined,
        address: { street: 'Facility Road', city: 'Metropolis', district: '', state: 'State', postalCode: '000000' },
      });
    }

    // Retrieve hospital's emergency requests and platform donor count
    const [requests, totalRegisteredDonors] = await Promise.all([
      EmergencyRequest.find({ hospitalId: hospital._id })
        .sort({ createdAt: -1 })
        .limit(50),
      DonorProfile.countDocuments({}),
    ]);

    const activeRequests = requests.filter((r) => r.status === 'ACTIVE');
    const matchedRequests = requests.filter((r) => r.status === 'MATCHED');
    const fulfilledRequests = requests.filter((r) => r.status === 'FULFILLED');
    const cancelledRequests = requests.filter((r) => r.status === 'CANCELLED');

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
          location: hospital.location,
        },
        stats: {
          activeRequestsCount: activeRequests.length,
          matchedRequestsCount: matchedRequests.length,
          fulfilledRequestsCount: fulfilledRequests.length,
          cancelledRequestsCount: cancelledRequests.length,
          totalRequestsCount: requests.length,
          totalUnitsRequested,
          totalAcceptedResponses,
          activeRequests: activeRequests.length,
          matchedDonors: totalAcceptedResponses,
          fulfilledRequests: fulfilledRequests.length,
          cancelledRequests: cancelledRequests.length,
          totalRegisteredDonors,
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
          matchedCount: r.potentialMatches.length,
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

/**
 * Retrieve authenticated hospital facility profile
 */
export async function getHospitalProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'HOSPITAL') {
      res.status(403).json({ status: 'fail', message: 'Unauthorized. Hospital access only.' });
      return;
    }

    let hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) {
      hospital = await HospitalProfile.create({
        userId: req.user.id,
        hospitalName: req.user.name || 'Healthcare Facility',
        licenseNumber: `HOSP-LIC-${req.user.id.slice(-4).toUpperCase()}`,
        emergencyHelpline: req.user.phone || '+910000000000',
        isVerifiedByAdmin: false,
        location: undefined,
        address: { street: 'Facility Road', city: 'Metropolis', district: '', state: 'State', postalCode: '000000' },
      });
    }

    const user = await User.findById(req.user.id);

    const coords = hospital.location?.coordinates || [];
    const hasValidLocation = Array.isArray(coords) && coords.length === 2;

    const addr = hospital.address as any;

    res.status(200).json({
      status: 'success',
      profile: {
        id: hospital._id.toString(),
        hospitalName: hospital.hospitalName,
        email: user?.email || req.user.email,
        phone: hospital.emergencyHelpline,
        emergencyHelpline: hospital.emergencyHelpline,
        licenseNumber: hospital.licenseNumber,
        isVerifiedByAdmin: hospital.isVerifiedByAdmin,
        address: {
          street: addr.street || '',
          city: addr.city || '',
          district: addr.district || '',
          state: addr.state || '',
          postalCode: addr.postalCode || '',
        },
        location: hospital.location,
        coordinates: coords,
        latitude: hasValidLocation ? coords[1] : null,
        longitude: hasValidLocation ? coords[0] : null,
        hasValidLocation,
        createdAt: hospital.createdAt,
        updatedAt: hospital.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update authenticated hospital facility profile.
 * Strictly secures verification status: hospital users cannot modify isVerifiedByAdmin or user.isVerified.
 */
export async function updateHospitalProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'HOSPITAL') {
      res.status(403).json({ status: 'fail', message: 'Unauthorized. Hospital access only.' });
      return;
    }

    let hospital = await HospitalProfile.findOne({ userId: req.user.id });
    if (!hospital) {
      hospital = await HospitalProfile.create({
        userId: req.user.id,
        hospitalName: req.user.name || 'Healthcare Facility',
        licenseNumber: `HOSP-LIC-${req.user.id.slice(-4).toUpperCase()}`,
        emergencyHelpline: req.user.phone || '+910000000000',
        isVerifiedByAdmin: false,
        location: undefined,
        address: { street: 'Facility Road', city: 'Metropolis', district: '', state: 'State', postalCode: '000000' },
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ status: 'fail', message: 'User account not found.' });
      return;
    }

    const {
      hospitalName,
      name,
      email,
      phone,
      emergencyHelpline,
      licenseNumber,
      street,
      city,
      district,
      state,
      postalCode,
      coordinates,
      latitude,
      longitude,
    } = req.body;

    // 1. Email uniqueness check
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id },
      });
      if (existingUser) {
        res.status(409).json({
          status: 'fail',
          message: 'Email address is already in use by another account.',
        });
        return;
      }
      user.email = email.toLowerCase();
    }

    // 2. License number uniqueness check
    if (licenseNumber && licenseNumber.trim() !== hospital.licenseNumber) {
      const existingHospital = await HospitalProfile.findOne({
        licenseNumber: licenseNumber.trim(),
        _id: { $ne: hospital._id },
      });
      if (existingHospital) {
        res.status(409).json({
          status: 'fail',
          message: 'License number is already registered to another medical facility.',
        });
        return;
      }
      hospital.licenseNumber = licenseNumber.trim();
    }

    // 3. Update facility details
    const newName = (hospitalName || name)?.trim();
    if (newName) {
      hospital.hospitalName = newName;
      user.name = newName;
    }

    const newPhone = (emergencyHelpline || phone)?.trim();
    if (newPhone) {
      hospital.emergencyHelpline = newPhone;
      user.phone = newPhone;
    }

    const addr = hospital.address as any;
    if (street !== undefined) addr.street = street.trim();
    if (city !== undefined) addr.city = city.trim();
    // district and state are independent fields; if state is omitted, it defaults to district
    if (district !== undefined) {
      addr.district = district.trim();
    } else if (city !== undefined && (!addr.district || addr.district.trim() === '')) {
      addr.district = city.trim();
    }
    if (state !== undefined) {
      addr.state = state.trim();
    } else if (district !== undefined) {
      addr.state = district.trim();
    }
    if (postalCode !== undefined) addr.postalCode = postalCode.trim();


    // 4. Coordinates resolution & validation
    const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLng = longitude !== undefined && longitude !== null && longitude !== '';
    const hasCoords = Array.isArray(coordinates) && coordinates.length === 2;

    if (!hasCoords && ((hasLat && !hasLng) || (!hasLat && hasLng))) {
      res.status(422).json({
        status: 'fail',
        message: 'Both latitude and longitude must be provided together.',
      });
      return;
    }

    let resolvedLng: number | undefined;
    let resolvedLat: number | undefined;

    if (hasCoords) {
      resolvedLng = Number(coordinates[0]);
      resolvedLat = Number(coordinates[1]);
    } else if (hasLat && hasLng) {
      resolvedLng = Number(longitude);
      resolvedLat = Number(latitude);
    }

    if (resolvedLat !== undefined && resolvedLng !== undefined) {
      if (isNaN(resolvedLat) || resolvedLat < -90 || resolvedLat > 90) {
        res.status(422).json({
          status: 'fail',
          message: 'Invalid latitude. Must be a number between -90 and 90.',
        });
        return;
      }
      if (isNaN(resolvedLng) || resolvedLng < -180 || resolvedLng > 180) {
        res.status(422).json({
          status: 'fail',
          message: 'Invalid longitude. Must be a number between -180 and 180.',
        });
        return;
      }
      hospital.location = {
        type: 'Point',
        coordinates: [resolvedLng, resolvedLat],
      };
    }

    // Security Gate: Verification status is NEVER modified by hospital self-update.
    // isVerifiedByAdmin and user.isVerified are preserved intact.

    await Promise.all([hospital.save(), user.save()]);

    try {
      await AuditLog.create({
        actorId: req.user.id,
        action: 'HOSPITAL_PROFILE_UPDATED',
        resource: 'HospitalProfile',
        resourceId: hospital._id.toString(),
        details: {
          hospitalName: hospital.hospitalName,
          city: addr.city,
          district: addr.district,
          coordinates: hospital.location?.coordinates,
        },
        ipAddress: req.ip,
      });
    } catch {
      // Non-fatal
    }

    const updatedCoords = hospital.location?.coordinates || [];
    const hasValidUpdatedLocation = Array.isArray(updatedCoords) && updatedCoords.length === 2;

    res.status(200).json({
      status: 'success',
      message: 'Facility profile updated successfully.',
      profile: {
        id: hospital._id.toString(),
        hospitalName: hospital.hospitalName,
        email: user.email,
        phone: hospital.emergencyHelpline,
        emergencyHelpline: hospital.emergencyHelpline,
        licenseNumber: hospital.licenseNumber,
        isVerifiedByAdmin: hospital.isVerifiedByAdmin,
        address: {
          street: addr.street || '',
          city: addr.city || '',
          district: addr.district || '',
          state: addr.state || '',
          postalCode: addr.postalCode || '',
        },
        location: hospital.location,
        coordinates: updatedCoords,
        latitude: hasValidUpdatedLocation ? updatedCoords[1] : null,
        longitude: hasValidUpdatedLocation ? updatedCoords[0] : null,
        hasValidLocation: hasValidUpdatedLocation,
        createdAt: hospital.createdAt,
        updatedAt: hospital.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve all registered donors on the platform for hospital management overview
 */
export async function getRegisteredDonors(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || req.user.role !== 'HOSPITAL') {
      res.status(403).json({ status: 'fail', message: 'Unauthorized. Hospital access only.' });
      return;
    }

    const { bloodGroup, isAvailable, search, district, city } = req.query;

    const query: Record<string, unknown> = {};

    if (bloodGroup && bloodGroup !== 'ALL') {
      query.bloodGroup = bloodGroup;
    }

    if (isAvailable !== undefined && isAvailable !== 'ALL') {
      query.isAvailable = String(isAvailable).toLowerCase() === 'true';
    }

    if (district) {
      query['address.district'] = new RegExp(String(district).trim(), 'i');
    }

    if (city) {
      query['address.city'] = new RegExp(String(city).trim(), 'i');
    }

    // Query donor profiles populated with user details
    const donors = await DonorProfile.find(query)
      .populate('userId', 'name email phone status isVerified createdAt')
      .sort({ createdAt: -1 });

    // Optional text search in memory if search query provided
    const searchNorm = typeof search === 'string' ? search.trim().toLowerCase() : '';
    const filteredDonors = searchNorm
      ? donors.filter((d: any) => {
          const u = d.userId as any;
          const name = (u?.name || '').toLowerCase();
          const email = (u?.email || '').toLowerCase();
          const phone = (u?.phone || '').toLowerCase();
          const bg = (d.bloodGroup || '').toLowerCase();
          const dCity = (d.address?.city || '').toLowerCase();
          const dDistrict = (d.address?.district || '').toLowerCase();
          const state = (d.address?.state || '').toLowerCase();
          return (
            name.includes(searchNorm) ||
            email.includes(searchNorm) ||
            phone.includes(searchNorm) ||
            bg.includes(searchNorm) ||
            dCity.includes(searchNorm) ||
            dDistrict.includes(searchNorm) ||
            state.includes(searchNorm)
          );
        })
      : donors;

    const mappedDonors = filteredDonors.map((d: any) => {
      const u = d.userId as any;
      const addr = d.address || {};
      const cityFormatted = [addr.city, addr.district || addr.state].filter(Boolean).join(', ') || 'Location unavailable';

      return {
        id: d._id.toString(),
        donorId: d._id.toString(),
        userId: u?._id?.toString(),
        name: u?.name || 'Registered Donor',
        email: u?.email || 'N/A',
        phone: u?.phone || 'N/A',
        isVerified: u?.isVerified ?? true,
        userStatus: u?.status || 'ACTIVE',
        bloodGroup: d.bloodGroup,
        supportedComponents: d.supportedComponents || ['WHOLE_BLOOD'],
        isAvailable: d.isAvailable ?? true,
        address: {
          street: addr.street,
          city: addr.city,
          district: addr.district,
          state: addr.state,
          postalCode: addr.postalCode,
        },
        cityFormatted,
        selfReportedScreening: d.selfReportedScreening,
        registeredAt: d.createdAt || u?.createdAt,
      };
    });

    res.status(200).json({
      status: 'success',
      totalCount: mappedDonors.length,
      donors: mappedDonors,
    });
  } catch (error) {
    next(error);
  }
}

