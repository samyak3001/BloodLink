/**
 * Unit & Integration Tests — Phase 8 Admin Hospital Verification
 *
 * Verifies:
 * 1. Verifying Hospital A updates ONLY Hospital A's unique record.
 * 2. Unverified/pending hospitals (B, C, D) remain completely unchanged.
 * 3. Revoking verification on Hospital B updates ONLY Hospital B.
 * 4. Invalid ObjectId format is rejected with HTTP 400.
 * 5. Non-existent hospital ID is rejected with HTTP 404.
 * 6. getAdminUsers returns distinct unique IDs and individual verification flags.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { verifyHospital, getAdminUsers } from '../controllers/adminController';

vi.mock('../models', () => ({
  User: {
    find: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  },
  HospitalProfile: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
  DonorProfile: {
    find: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
  EmergencyRequest: {
    countDocuments: vi.fn(),
  },
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

import { User, HospitalProfile, DonorProfile, AuditLog } from '../models';

describe('Admin Hospital Verification Isolation & Unique ID Targeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifying Hospital A updates ONLY Hospital A, leaving Hospital B unchanged', async () => {
    const hospAId = new mongoose.Types.ObjectId().toString();
    const hospBId = new mongoose.Types.ObjectId().toString();
    const userAId = new mongoose.Types.ObjectId().toString();
    const userBId = new mongoose.Types.ObjectId().toString();

    const mockHospitalA = {
      _id: hospAId,
      userId: userAId,
      hospitalName: 'Hospital Alpha',
      licenseNumber: 'LIC-ALPHA-01',
      isVerifiedByAdmin: false,
      save: vi.fn().mockResolvedValue(true),
    };

    const mockHospitalB = {
      _id: hospBId,
      userId: userBId,
      hospitalName: 'Hospital Beta',
      licenseNumber: 'LIC-BETA-02',
      isVerifiedByAdmin: false,
      save: vi.fn().mockResolvedValue(true),
    };

    // When HospitalProfile.findById is called, it returns only the targeted hospital
    vi.mocked(HospitalProfile.findById).mockImplementation((id: any) => {
      if (id === hospAId) return Promise.resolve(mockHospitalA as any);
      if (id === hospBId) return Promise.resolve(mockHospitalB as any);
      return Promise.resolve(null);
    });

    vi.mocked(User.findByIdAndUpdate).mockResolvedValue({} as any);

    const req: any = {
      params: { id: hospAId },
      body: { isVerified: true, adminNotes: 'Verified license against state registry' },
      user: { id: 'admin-user-id', role: 'ADMIN' },
      ip: '127.0.0.1',
    };

    const jsonMock = vi.fn();
    const res: any = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    };

    await verifyHospital(req, res, vi.fn());

    // 1. Response is HTTP 200 with verified status for Hospital A
    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        hospital: expect.objectContaining({
          _id: hospAId,
          isVerifiedByAdmin: true,
        }),
      })
    );

    // 2. Hospital A document had save called with isVerifiedByAdmin = true
    expect(mockHospitalA.isVerifiedByAdmin).toBe(true);
    expect(mockHospitalA.save).toHaveBeenCalledTimes(1);

    // 3. User A had findByIdAndUpdate called with userAId ONLY
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userAId, { isVerified: true });
    expect(User.findByIdAndUpdate).not.toHaveBeenCalledWith(userBId, expect.anything());

    // 4. Hospital B document was NEVER touched or saved
    expect(mockHospitalB.isVerifiedByAdmin).toBe(false);
    expect(mockHospitalB.save).not.toHaveBeenCalled();

    // 5. AuditLog created specifically for Hospital A
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HOSPITAL_LICENSE_VERIFIED',
        resourceId: hospAId,
      })
    );
  });

  it('revoking verification for Hospital B updates ONLY Hospital B, leaving Hospital A verified', async () => {
    const hospAId = new mongoose.Types.ObjectId().toString();
    const hospBId = new mongoose.Types.ObjectId().toString();
    const userAId = new mongoose.Types.ObjectId().toString();
    const userBId = new mongoose.Types.ObjectId().toString();

    const mockHospitalA = {
      _id: hospAId,
      userId: userAId,
      hospitalName: 'Hospital Alpha',
      licenseNumber: 'LIC-ALPHA-01',
      isVerifiedByAdmin: true,
      save: vi.fn().mockResolvedValue(true),
    };

    const mockHospitalB = {
      _id: hospBId,
      userId: userBId,
      hospitalName: 'Hospital Beta',
      licenseNumber: 'LIC-BETA-02',
      isVerifiedByAdmin: true,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(HospitalProfile.findById).mockImplementation((id: any) => {
      if (id === hospAId) return Promise.resolve(mockHospitalA as any);
      if (id === hospBId) return Promise.resolve(mockHospitalB as any);
      return Promise.resolve(null);
    });

    vi.mocked(User.findByIdAndUpdate).mockResolvedValue({} as any);

    const req: any = {
      params: { id: hospBId },
      body: { isVerified: false, adminNotes: 'License expired pending renewal' },
      user: { id: 'admin-user-id', role: 'ADMIN' },
      ip: '127.0.0.1',
    };

    const jsonMock = vi.fn();
    const res: any = {
      status: vi.fn().mockReturnValue({ json: jsonMock }),
    };

    await verifyHospital(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        hospital: expect.objectContaining({
          _id: hospBId,
          isVerifiedByAdmin: false,
        }),
      })
    );

    // Hospital B was revoked
    expect(mockHospitalB.isVerifiedByAdmin).toBe(false);
    expect(mockHospitalB.save).toHaveBeenCalledTimes(1);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(userBId, { isVerified: false });

    // Hospital A remains verified and untouched
    expect(mockHospitalA.isVerifiedByAdmin).toBe(true);
    expect(mockHospitalA.save).not.toHaveBeenCalled();
    expect(User.findByIdAndUpdate).not.toHaveBeenCalledWith(userAId, expect.anything());
  });

  it('rejects an invalid ObjectId with HTTP 400', async () => {
    const req: any = {
      params: { id: 'invalid-non-object-id' },
      body: { isVerified: true },
      user: { id: 'admin-1', role: 'ADMIN' },
    };

    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await verifyHospital(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        message: 'Invalid hospital ID format.',
      })
    );
    expect(HospitalProfile.findById).not.toHaveBeenCalled();
  });

  it('returns HTTP 404 when hospital profile is not found', async () => {
    const validNonExistentId = new mongoose.Types.ObjectId().toString();

    vi.mocked(HospitalProfile.findById).mockResolvedValue(null);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue(null);

    const req: any = {
      params: { id: validNonExistentId },
      body: { isVerified: true },
      user: { id: 'admin-1', role: 'ADMIN' },
    };

    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await verifyHospital(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        message: 'Hospital profile not found.',
      })
    );
  });

  it('getAdminUsers attaches unique string id and accurate independent isVerifiedByAdmin per hospital', async () => {
    const user1Id = new mongoose.Types.ObjectId();
    const user2Id = new mongoose.Types.ObjectId();
    const hosp1Id = new mongoose.Types.ObjectId();
    const hosp2Id = new mongoose.Types.ObjectId();

    const mockUsers = [
      {
        _id: user1Id,
        name: 'Metro Admin',
        email: 'metro@hospital.org',
        role: 'HOSPITAL',
        toSafeObject: () => ({ _id: user1Id.toString(), name: 'Metro Admin', email: 'metro@hospital.org' }),
      },
      {
        _id: user2Id,
        name: 'City Care Admin',
        email: 'citycare@hospital.org',
        role: 'HOSPITAL',
        toSafeObject: () => ({ _id: user2Id.toString(), name: 'City Care Admin', email: 'citycare@hospital.org' }),
      },
    ];

    const mockHospProfiles = [
      {
        _id: hosp1Id,
        userId: user1Id,
        hospitalName: 'Metro Hospital Center',
        licenseNumber: 'LIC-001',
        isVerifiedByAdmin: true,
        address: { city: 'Chennai' },
      },
      {
        _id: hosp2Id,
        userId: user2Id,
        hospitalName: 'City Care Clinic',
        licenseNumber: 'LIC-002',
        isVerifiedByAdmin: false,
        address: { city: 'Madurai' },
      },
    ];

    vi.mocked(User.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockUsers),
        }),
      }),
    } as any);

    vi.mocked(User.countDocuments).mockResolvedValue(2);
    vi.mocked(HospitalProfile.find).mockResolvedValue(mockHospProfiles as any);
    vi.mocked(DonorProfile.find).mockResolvedValue([] as any);

    const req: any = {
      query: { role: 'HOSPITAL' },
      user: { id: 'admin-1', role: 'ADMIN' },
    };

    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getAdminUsers(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);

    const responseUsers = jsonMock.mock.calls[0][0].users;
    expect(responseUsers).toHaveLength(2);

    // Hospital 1 has its own distinct IDs and verified status
    expect(responseUsers[0]._id).toBe(user1Id.toString());
    expect(responseUsers[0].id).toBe(user1Id.toString());
    expect(responseUsers[0].hospitalProfileId).toBe(hosp1Id.toString());
    expect(responseUsers[0].isVerified).toBe(true);
    expect(responseUsers[0].isVerifiedByAdmin).toBe(true);

    // Hospital 2 has distinct IDs and unverified status
    expect(responseUsers[1]._id).toBe(user2Id.toString());
    expect(responseUsers[1].id).toBe(user2Id.toString());
    expect(responseUsers[1].hospitalProfileId).toBe(hosp2Id.toString());
    expect(responseUsers[1].isVerified).toBe(false);
    expect(responseUsers[1].isVerifiedByAdmin).toBe(false);
  });
});
