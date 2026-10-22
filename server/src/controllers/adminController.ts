import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { User, DonorProfile, HospitalProfile, EmergencyRequest, AuditLog } from '../models';

/**
 * Get comprehensive platform analytics and telemetry for administrators
 */
export async function getAdminAnalytics(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [
      totalUsers,
      totalDonors,
      availableDonors,
      totalHospitals,
      verifiedHospitals,
      totalRequests,
      activeRequests,
      fulfilledRequests,
      cancelledRequests,
      bloodGroupCounts,
      donorProfiles,
    ] = await Promise.all([
      User.countDocuments(),
      DonorProfile.countDocuments(),
      DonorProfile.countDocuments({ isAvailable: true }),
      HospitalProfile.countDocuments(),
      HospitalProfile.countDocuments({ isVerifiedByAdmin: true }),
      EmergencyRequest.countDocuments(),
      EmergencyRequest.countDocuments({ status: { $in: ['ACTIVE', 'MATCHED'] } }),
      EmergencyRequest.countDocuments({ status: 'FULFILLED' }),
      EmergencyRequest.countDocuments({ status: 'CANCELLED' }),
      DonorProfile.aggregate([
        { $group: { _id: '$bloodGroup', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      DonorProfile.find().select('bloodGroup isAvailable'),
    ]);

    // Calculate donor response rate across emergency requests
    const matchStats = await EmergencyRequest.aggregate([
      { $unwind: '$potentialMatches' },
      {
        $group: {
          _id: null,
          totalNotified: { $sum: 1 },
          totalAccepted: {
            $sum: { $cond: [{ $eq: ['$potentialMatches.status', 'ACCEPTED'] }, 1, 0] },
          },
          totalDeclined: {
            $sum: { $cond: [{ $eq: ['$potentialMatches.status', 'DECLINED'] }, 1, 0] },
          },
        },
      },
    ]);

    const responseRate =
      matchStats.length > 0 && matchStats[0].totalNotified > 0
        ? Math.round((matchStats[0].totalAccepted / matchStats[0].totalNotified) * 100)
        : 0;

    const pendingHospitals = Math.max(0, totalHospitals - verifiedHospitals);
    const fulfillmentRate =
      totalRequests > 0 ? `${Math.round((fulfilledRequests / totalRequests) * 100)}%` : '0%';

    // Real weekly trend data from actual EmergencyRequests in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentRequests = await EmergencyRequest.find({
      createdAt: { $gte: sevenDaysAgo },
    }).select('createdAt urgency');

    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trends: { label: string; critical: number; high: number; medium: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayLabel = daysMap[d.getDay()];
      const dayRequests = recentRequests.filter(
        (r) => new Date(r.createdAt).toDateString() === d.toDateString()
      );
      trends.push({
        label: dayLabel,
        critical: dayRequests.filter((r) => r.urgency === 'CRITICAL').length,
        high: dayRequests.filter((r) => r.urgency === 'HIGH').length,
        medium: dayRequests.filter((r) => r.urgency === 'MEDIUM').length,
      });
    }

    // Real donor activity distribution by blood group
    const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const donorActivity = bloodGroups.map((bg) => {
      const matching = donorProfiles.filter((d) => d.bloodGroup === bg);
      const available = matching.filter((d) => d.isAvailable).length;
      const resting = matching.length - available;
      return {
        bloodGroup: bg,
        available,
        resting,
        avgResponseMins: 0,
      };
    });

    res.status(200).json({
      status: 'success',
      analytics: {
        totalUsers,
        totalDonors,
        activeDonors: availableDonors,
        totalHospitals,
        verifiedHospitals,
        pendingHospitals,
        totalRequests,
        activeRequests,
        fulfilledRequests,
        cancelledRequests,
        fulfillmentRate,
        responseRatePercentage: responseRate,
        averageResponseTimeMinutes: 0,
        users: {
          totalUsers,
          totalDonors,
          availableDonors,
          totalHospitals,
          verifiedHospitals,
          pendingHospitals,
        },
        requests: {
          totalRequests,
          activeRequests,
          fulfilledRequests,
          cancelledRequests,
          fulfillmentRate,
          responseRatePercentage: responseRate,
          totalNotifiedDonors: matchStats[0]?.totalNotified || 0,
          totalAcceptedDonors: matchStats[0]?.totalAccepted || 0,
        },
        bloodGroupDistribution: bloodGroupCounts.map((item) => ({
          bloodGroup: item._id,
          count: item.count,
        })),
        trends,
        donorActivity,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List platform users with search, role, and status filters
 */
export async function getAdminUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { role, status, search, limit = '20', page = '1' } = req.query;

    const query: Record<string, unknown> = {};
    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
      ];
    }

    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [users, totalCount] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      User.countDocuments(query),
    ]);

    // Attach profile details for rich admin management (e.g. hospital license and verification)
    const userIds = users.map((u) => u._id);
    const [hospitalProfiles, donorProfiles] = await Promise.all([
      HospitalProfile.find({ userId: { $in: userIds } }),
      DonorProfile.find({ userId: { $in: userIds } }),
    ]);

    const hospitalMap = new Map(hospitalProfiles.map((hp) => [hp.userId.toString(), hp]));
    const donorMap = new Map(donorProfiles.map((dp) => [dp.userId.toString(), dp]));

    const enrichedUsers = users.map((u) => {
      const safe = u.toSafeObject();
      const hp = hospitalMap.get(u._id.toString());
      const dp = donorMap.get(u._id.toString());

      const uid = u._id.toString();
      safe.id = uid;
      safe._id = uid;

      if (u.role === 'HOSPITAL') {
        safe.hospitalProfileId = hp ? hp._id.toString() : null;
        safe.hospitalName = hp?.hospitalName || u.name;
        safe.licenseNumber = hp?.licenseNumber || 'PENDING';
        // Authoritative rule: Hospital verification is strictly controlled by HospitalProfile.isVerifiedByAdmin
        safe.isVerifiedByAdmin = hp ? (hp.isVerifiedByAdmin === true) : false;
        safe.isVerified = hp ? (hp.isVerifiedByAdmin === true) : false;
        safe.city = hp?.address?.city;
      } else if (u.role === 'DONOR') {
        safe.donorProfileId = dp ? dp._id.toString() : null;
        safe.bloodGroup = dp?.bloodGroup;
        safe.city = dp?.address?.city;
      }

      return safe;
    });

    res.status(200).json({
      status: 'success',
      totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      users: enrichedUsers,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Moderate user status (ACTIVE vs SUSPENDED)
 */
export async function updateUserStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { status, reason } = req.body as { status: 'ACTIVE' | 'SUSPENDED'; reason?: string };

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ status: 'fail', message: 'User not found.' });
      return;
    }

    user.status = status;
    await user.save();

    await AuditLog.create({
      actorId: req.user!.id,
      action: `USER_STATUS_${status}`,
      resource: 'User',
      resourceId: user._id.toString(),
      details: { targetEmail: user.email, reason },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `User status successfully updated to '${status}'.`,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify or reject medical facility hospital license
 */
export async function verifyHospital(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { isVerified, adminNotes } = req.body as { isVerified: boolean; adminNotes?: string };

    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ status: 'fail', message: 'Invalid hospital ID format.' });
      return;
    }

    // Accept either HospitalProfile._id or associated User._id
    let hospital = await HospitalProfile.findById(id);
    if (!hospital) {
      hospital = await HospitalProfile.findOne({ userId: id });
    }

    if (!hospital) {
      const user = await User.findById(id);
      if (user && user.role === 'HOSPITAL') {
        hospital = await HospitalProfile.create({
          userId: user._id,
          hospitalName: user.name || 'Healthcare Facility',
          licenseNumber: `HOSP-LIC-${user._id.toString().slice(-4).toUpperCase()}`,
          emergencyHelpline: user.phone || '+910000000000',
          isVerifiedByAdmin: isVerified,
          location: { type: 'Point', coordinates: [] },
          address: { street: 'Facility Road', city: 'Metropolis', state: 'State', postalCode: '000000' },
        });
      }
    }

    if (!hospital) {
      res.status(404).json({ status: 'fail', message: 'Hospital profile not found.' });
      return;
    }

    hospital.isVerifiedByAdmin = isVerified;
    await hospital.save();

    // Synchronize the parent User account's isVerified flag
    await User.findByIdAndUpdate(hospital.userId, { isVerified });

    await AuditLog.create({
      actorId: req.user!.id,
      action: isVerified ? 'HOSPITAL_LICENSE_VERIFIED' : 'HOSPITAL_LICENSE_REVOKED',
      resource: 'HospitalProfile',
      resourceId: hospital._id.toString(),
      details: { hospitalName: hospital.hospitalName, licenseNumber: hospital.licenseNumber, adminNotes },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: 'success',
      message: `Hospital '${hospital.hospitalName}' verification status updated to ${isVerified}.`,
      hospital: {
        _id: hospital._id.toString(),
        id: hospital._id.toString(),
        hospitalProfileId: hospital._id.toString(),
        userId: hospital.userId.toString(),
        hospitalName: hospital.hospitalName,
        isVerifiedByAdmin: hospital.isVerifiedByAdmin,
        isVerified: hospital.isVerifiedByAdmin,
        licenseNumber: hospital.licenseNumber,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve administrative audit logs
 */
export async function getAdminAuditLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { action, limit = '30', page = '1' } = req.query;

    const query: Record<string, unknown> = {};
    if (action) query.action = action;

    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 30));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [logs, totalCount] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      status: 'success',
      totalCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      logs,
    });
  } catch (error) {
    next(error);
  }
}
