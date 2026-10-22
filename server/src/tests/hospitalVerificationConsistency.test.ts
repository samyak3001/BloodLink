/**
 * Unit & Integration Tests — Hospital Verification State Consistency
 *
 * Verifies the authoritative rule:
 * Hospital verification is strictly controlled by HospitalProfile.isVerifiedByAdmin === true.
 *
 * Test cases:
 * A. Newly registered hospital: User.isVerified = false, HospitalProfile.isVerifiedByAdmin = false
 * B. Admin hospital list: unverified hospital appears with isVerifiedByAdmin: false (Pending Review)
 * C. Admin verify: HospitalProfile.isVerifiedByAdmin becomes true, User.isVerified synchronized to true
 * D. Verified hospital: dashboard shows isVerifiedByAdmin === true
 * E. Unverified hospital: dashboard shows isVerifiedByAdmin === false
 * F. Unverified hospital: POST emergency request returns 403 and blocks creation
 * G. Verified hospital: POST emergency request succeeds (HTTP 201)
 * H. Admin revoke: hospital becomes unverified (isVerifiedByAdmin = false, User.isVerified = false)
 * I. Critical consistency case: If User.isVerified === true but HospitalProfile.isVerifiedByAdmin === false,
 *    HospitalProfile.isVerifiedByAdmin strictly controls verification across Admin, Dashboard, and Request Creation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../models', () => ({
  User: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  },
  HospitalProfile: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
  DonorProfile: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
  EmergencyRequest: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
  Notification: {
    create: vi.fn().mockResolvedValue({}),
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_pw_123'),
  comparePassword: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/socketService', () => ({
  emitEmergencyAlert: vi.fn(),
  broadcastEmergencyAlertToDonors: vi.fn(),
  emitDonorResponse: vi.fn(),
  emitRequestUpdated: vi.fn(),
  pushUnreadCount: vi.fn(),
}));

vi.mock('../services/matchingService', () => ({
  findPotentialMatches: vi.fn().mockResolvedValue([]),
  findPotentialDonorsForRequest: vi.fn().mockResolvedValue([]),
}));

import { User, HospitalProfile, DonorProfile, EmergencyRequest, AuditLog } from '../models';
import { register } from '../controllers/authController';
import { getAdminUsers, verifyHospital } from '../controllers/adminController';
import { getHospitalDashboard } from '../controllers/hospitalController';
import { createEmergencyRequest } from '../controllers/emergencyRequestController';

describe('Hospital Verification State Consistency & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getHospitalDashboard queries DonorProfile.countDocuments for totalRegisteredDonors;
    // provide a default resolved value so tests that don't set it explicitly don't crash.
    (DonorProfile.countDocuments as any).mockResolvedValue(0 as any);
  });

  // A. Newly registered hospital
  it('A. Newly registered hospital starts with User.isVerified = false and HospitalProfile.isVerifiedByAdmin = false', async () => {
    const mockCreatedUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Dr. Jane Smith',
      email: 'jane.hospital@bloodlink.org',
      role: 'HOSPITAL',
      isVerified: false,
      status: 'ACTIVE',
      toSafeObject: () => ({
        _id: 'user-hosp-new',
        name: 'Dr. Jane Smith',
        email: 'jane.hospital@bloodlink.org',
        role: 'HOSPITAL',
        isVerified: false,
      }),
    };

    const mockCreatedProfile = {
      _id: new mongoose.Types.ObjectId(),
      userId: mockCreatedUser._id,
      hospitalName: 'Apollo City Hospital',
      licenseNumber: 'HOSP-LIC-NEW-01',
      emergencyHelpline: '+919999900000',
      isVerifiedByAdmin: false,
      toJSON: () => ({
        hospitalName: 'Apollo City Hospital',
        isVerifiedByAdmin: false,
      }),
    };

    (User.findOne as any).mockResolvedValue(null);
    (User.create as any).mockResolvedValue(mockCreatedUser as any);
    (HospitalProfile.create as any).mockResolvedValue(mockCreatedProfile as any);

    const req: any = {
      body: {
        name: 'Dr. Jane Smith',
        email: 'jane.hospital@bloodlink.org',
        password: 'Password123!',
        phone: '+919999900000',
        role: 'HOSPITAL',
        hospitalName: 'Apollo City Hospital',
        licenseNumber: 'HOSP-LIC-NEW-01',
        emergencyHelpline: '+919999900000',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      },
      ip: '127.0.0.1',
    };

    const jsonMock = vi.fn();
    const res: any = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    };

    await register(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'HOSPITAL',
        isVerified: false,
      })
    );
    expect(HospitalProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hospitalName: 'Apollo City Hospital',
        isVerifiedByAdmin: false,
      })
    );
  });

  // B. Admin hospital list
  it('B. Admin hospital list reports an unverified hospital as isVerifiedByAdmin: false (Pending Review)', async () => {
    const userId = new mongoose.Types.ObjectId();
    const profileId = new mongoose.Types.ObjectId();

    const mockUser = {
      _id: userId,
      name: 'Jitesh Hospital',
      email: 'jitesh387699@gmail.com',
      role: 'HOSPITAL',
      isVerified: false,
      toSafeObject: () => ({
        _id: userId.toString(),
        name: 'Jitesh Hospital',
        email: 'jitesh387699@gmail.com',
        role: 'HOSPITAL',
        isVerified: false,
      }),
    };

    const mockProfile = {
      _id: profileId,
      userId: userId,
      hospitalName: 'Jitesh Hospital',
      licenseNumber: 'HOSP-LIC-JITESH-01',
      isVerifiedByAdmin: false,
      address: { city: 'Bengaluru' },
    };

    (User.find as any).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    } as any);

    (User.countDocuments as any).mockResolvedValue(1);
    (HospitalProfile.find as any).mockResolvedValue([mockProfile] as any);
    (DonorProfile.find as any).mockResolvedValue([]);

    const req: any = { query: { role: 'HOSPITAL' }, user: { id: 'admin-1', role: 'ADMIN' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getAdminUsers(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const users = jsonMock.mock.calls[0][0].users;
    expect(users[0].isVerifiedByAdmin).toBe(false);
    expect(users[0].isVerified).toBe(false);
  });

  // C. Admin verify
  it('C. Admin verify sets HospitalProfile.isVerifiedByAdmin = true and synchronizes User.isVerified = true', async () => {
    const hospId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();

    const mockProfile = {
      _id: hospId,
      userId,
      hospitalName: 'Jitesh Hospital',
      licenseNumber: 'HOSP-LIC-JITESH-01',
      isVerifiedByAdmin: false,
      save: vi.fn().mockResolvedValue(true),
    };

    (HospitalProfile.findById as any).mockResolvedValue(mockProfile as any);
    (User.findByIdAndUpdate as any).mockResolvedValue({} as any);

    const req: any = {
      params: { id: hospId },
      body: { isVerified: true, adminNotes: 'State license verified' },
      user: { id: 'admin-1', role: 'ADMIN' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await verifyHospital(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockProfile.isVerifiedByAdmin).toBe(true);
    expect(mockProfile.save).toHaveBeenCalledTimes(1);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, { isVerified: true });
  });

  // D. Verified hospital dashboard
  it('D. Verified hospital dashboard reports isVerifiedByAdmin === true', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const profileId = new mongoose.Types.ObjectId();

    const mockProfile = {
      _id: profileId,
      userId,
      hospitalName: 'Jitesh Hospital',
      licenseNumber: 'HOSP-LIC-JITESH-01',
      emergencyHelpline: '+919876543210',
      isVerifiedByAdmin: true,
      address: { city: 'Bengaluru' },
    };

    (HospitalProfile.findOne as any).mockResolvedValue(mockProfile as any);
    (EmergencyRequest.find as any).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const req: any = { user: { id: userId, _id: userId, role: 'HOSPITAL' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getHospitalDashboard(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const dashboard = jsonMock.mock.calls[0][0].dashboard;
    expect(dashboard.hospital.isVerifiedByAdmin).toBe(true);
  });

  // E. Unverified hospital dashboard
  it('E. Unverified hospital dashboard reports isVerifiedByAdmin === false', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const profileId = new mongoose.Types.ObjectId();

    const mockProfile = {
      _id: profileId,
      userId,
      hospitalName: 'Jitesh Hospital',
      licenseNumber: 'HOSP-LIC-JITESH-01',
      emergencyHelpline: '+919876543210',
      isVerifiedByAdmin: false,
      address: { city: 'Bengaluru' },
    };

    (HospitalProfile.findOne as any).mockResolvedValue(mockProfile as any);
    (EmergencyRequest.find as any).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const req: any = { user: { id: userId, _id: userId, role: 'HOSPITAL' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getHospitalDashboard(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const dashboard = jsonMock.mock.calls[0][0].dashboard;
    expect(dashboard.hospital.isVerifiedByAdmin).toBe(false);
  });

  // F. Unverified hospital cannot create emergency request (HTTP 403)
  it('F. Unverified hospital POST emergency request returns HTTP 403 and does NOT create request', async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    const mockProfile = {
      _id: new mongoose.Types.ObjectId(),
      userId,
      hospitalName: 'Jitesh Hospital',
      isVerifiedByAdmin: false,
    };

    (HospitalProfile.findOne as any).mockResolvedValue(mockProfile as any);

    const req: any = {
      user: { id: userId, _id: userId, role: 'HOSPITAL' },
      body: {
        patientIdentifier: 'EMERG-001',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsNeeded: 2,
        urgencyLevel: 'CRITICAL',
        requiredWithinHours: 2,
      },
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await createEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        message: expect.stringContaining('pending admin verification'),
      })
    );
    expect(EmergencyRequest.create).not.toHaveBeenCalled();
  });

  // G. Verified hospital can create emergency request (HTTP 201)
  it('G. Verified hospital POST emergency request succeeds with HTTP 201', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const profileId = new mongoose.Types.ObjectId();

    const mockProfile = {
      _id: profileId,
      userId,
      hospitalName: 'Jitesh Hospital',
      emergencyHelpline: '+919876543210',
      isVerifiedByAdmin: true,
      address: { city: 'Bengaluru' },
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    };

    const mockCreatedRequest = {
      _id: new mongoose.Types.ObjectId(),
      hospitalId: profileId,
      patientIdentifier: 'EMERG-002',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      urgency: 'CRITICAL',
      status: 'ACTIVE',
      save: vi.fn().mockResolvedValue(true),
      toObject: vi.fn().mockReturnValue({
        _id: 'req-id-002',
        patientIdentifier: 'EMERG-002',
        bloodGroup: 'O+',
        unitsRequired: 2,
        urgency: 'CRITICAL',
      }),
    };

    (HospitalProfile.findOne as any).mockResolvedValue(mockProfile as any);
    (EmergencyRequest.create as any).mockResolvedValue(mockCreatedRequest as any);

    const req: any = {
      user: { id: userId, _id: userId, role: 'HOSPITAL' },
      body: {
        patientIdentifier: 'EMERG-002',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        requiredWithinHours: 2,
      },
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await createEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(EmergencyRequest.create).toHaveBeenCalled();
  });

  // H. Admin revoke verification
  it('H. Admin revoke sets HospitalProfile.isVerifiedByAdmin = false and User.isVerified = false', async () => {
    const hospId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId().toString();

    const mockProfile = {
      _id: hospId,
      userId,
      hospitalName: 'Jitesh Hospital',
      licenseNumber: 'HOSP-LIC-JITESH-01',
      isVerifiedByAdmin: true,
      save: vi.fn().mockResolvedValue(true),
    };

    (HospitalProfile.findById as any).mockResolvedValue(mockProfile as any);
    (User.findByIdAndUpdate as any).mockResolvedValue({} as any);

    const req: any = {
      params: { id: hospId },
      body: { isVerified: false, adminNotes: 'License expired' },
      user: { id: 'admin-1', role: 'ADMIN' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await verifyHospital(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockProfile.isVerifiedByAdmin).toBe(false);
    expect(mockProfile.save).toHaveBeenCalledTimes(1);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userId, { isVerified: false });
  });

  // I. Critical consistency case: User.isVerified is true while HospitalProfile.isVerifiedByAdmin is false
  it('I. Critical consistency case: If User.isVerified === true but HospitalProfile.isVerifiedByAdmin === false, HospitalProfile.isVerifiedByAdmin controls verification everywhere', async () => {
    const userId = new mongoose.Types.ObjectId();
    const profileId = new mongoose.Types.ObjectId();

    // Disagreement scenario (like the original Jitesh Hospital bug):
    // User document has isVerified: true, but HospitalProfile has isVerifiedByAdmin: false
    const mockUser = {
      _id: userId,
      name: 'Jitesh Hospital',
      email: 'jitesh387699@gmail.com',
      role: 'HOSPITAL',
      isVerified: true, // Legacy or desynchronized true flag
      toSafeObject: () => ({
        _id: userId.toString(),
        name: 'Jitesh Hospital',
        email: 'jitesh387699@gmail.com',
        role: 'HOSPITAL',
        isVerified: true, // Safe object starts with User.isVerified = true
      }),
    };

    const mockProfile = {
      _id: profileId,
      userId: userId,
      hospitalName: 'Jitesh Hospital',
      licenseNumber: 'HOSP-LIC-JITESH-01',
      emergencyHelpline: '+919876543210',
      isVerifiedByAdmin: false, // The authoritative value is FALSE
      address: { city: 'Bengaluru' },
    };

    // 1. In getAdminUsers: must overwrite safe.isVerified to false and safe.isVerifiedByAdmin to false
    (User.find as any).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockUser]),
        }),
      }),
    } as any);

    (User.countDocuments as any).mockResolvedValue(1);
    (HospitalProfile.find as any).mockResolvedValue([mockProfile] as any);
    (DonorProfile.find as any).mockResolvedValue([]);

    const adminReq: any = { query: { role: 'HOSPITAL' }, user: { id: 'admin-1', role: 'ADMIN' } };
    const adminJsonMock = vi.fn();
    const adminRes: any = { status: vi.fn().mockReturnValue({ json: adminJsonMock }) };

    await getAdminUsers(adminReq, adminRes, vi.fn());

    expect(adminRes.status).toHaveBeenCalledWith(200);
    const users = adminJsonMock.mock.calls[0][0].users;
    // Authoritative rule: must NOT show verified merely because User.isVerified is true!
    expect(users[0].isVerifiedByAdmin).toBe(false);
    expect(users[0].isVerified).toBe(false);

    // 2. In getHospitalDashboard: must strictly return isVerifiedByAdmin === false
    (HospitalProfile.findOne as any).mockResolvedValue(mockProfile as any);
    (EmergencyRequest.find as any).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const dashReq: any = { user: { id: userId.toString(), _id: userId.toString(), role: 'HOSPITAL' } };
    const dashJsonMock = vi.fn();
    const dashRes: any = { status: vi.fn().mockReturnValue({ json: dashJsonMock }) };

    await getHospitalDashboard(dashReq, dashRes, vi.fn());

    expect(dashRes.status).toHaveBeenCalledWith(200);
    const dashboard = dashJsonMock.mock.calls[0][0].dashboard;
    expect(dashboard.hospital.isVerifiedByAdmin).toBe(false);

    // 3. In createEmergencyRequest: must reject with HTTP 403 (blocking creation)
    const reqCreate: any = {
      user: { id: userId.toString(), _id: userId.toString(), role: 'HOSPITAL', isVerified: true },
      body: {
        patientIdentifier: 'EMERG-003',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsNeeded: 2,
        urgencyLevel: 'CRITICAL',
        requiredWithinHours: 2,
      },
    };
    const reqJsonMock = vi.fn();
    const reqRes: any = { status: vi.fn().mockReturnValue({ json: reqJsonMock }) };

    await createEmergencyRequest(reqCreate, reqRes, vi.fn());

    expect(reqRes.status).toHaveBeenCalledWith(403);
    expect(EmergencyRequest.create).not.toHaveBeenCalled();
  });
});
