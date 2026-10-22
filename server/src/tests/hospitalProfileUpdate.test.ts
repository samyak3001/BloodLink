/**
 * Unit & Integration Tests — Hospital Facility Profile Update Flow
 *
 * Verifies:
 * 1. Hospital can retrieve its own facility profile via GET /api/hospitals/profile
 * 2. Truthful verification status reporting (isVerifiedByAdmin)
 * 3. Hospital can update its facility details (name, phone, street, city, district)
 * 4. User and HospitalProfile synchronization
 * 5. Rejection of unauthenticated callers (HTTP 401)
 * 6. Rejection of non-hospital roles e.g. DONOR (HTTP 403)
 * 7. Security: isVerifiedByAdmin cannot be modified by hospital profile update
 * 8. Email update: uniqueness validation (HTTP 409 on duplicate)
 * 9. License number update: uniqueness validation (HTTP 409 on duplicate)
 * 10. Zod body validation: rejects invalid email or missing fields with HTTP 422
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getHospitalProfile,
  updateHospitalProfile,
} from '../controllers/hospitalController';
import { validateBody } from '../middleware/validate';
import { updateHospitalProfileSchema } from '../validators/authSchemas';

vi.mock('../models', () => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  HospitalProfile: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  EmergencyRequest: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

import { User, HospitalProfile, AuditLog } from '../models';

describe('Hospital Facility Profile Update Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/hospitals/profile', () => {
    it('returns hospital profile with truthful isVerifiedByAdmin status', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-101',
        userId: 'user-hosp-101',
        hospitalName: 'Metro General Hospital',
        licenseNumber: 'HOSP-LIC-101',
        emergencyHelpline: '+91 98765 00101',
        isVerifiedByAdmin: false, // Unverified
        address: {
          street: '123 Care Ave',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        },
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUserDoc = {
        _id: 'user-hosp-101',
        name: 'Metro General Hospital',
        email: 'contact@metrogeneral.org',
        phone: '+91 98765 00101',
        role: 'HOSPITAL',
        isVerified: false,
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);

      const req: any = {
        user: { id: 'user-hosp-101', role: 'HOSPITAL', email: 'contact@metrogeneral.org' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };

      await getHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.status).toBe('success');
      expect(data.profile.hospitalName).toBe('Metro General Hospital');
      expect(data.profile.isVerifiedByAdmin).toBe(false);
      expect(data.profile.address.city).toBe('Bengaluru');
      expect(data.profile.licenseNumber).toBe('HOSP-LIC-101');
    });

    it('rejects unauthenticated requests with HTTP 403 or unauthorized', async () => {
      const req: any = { user: undefined };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fail', message: expect.stringContaining('Hospital access only') })
      );
    });

    it('rejects DONOR users with HTTP 403', async () => {
      const req: any = { user: { id: 'donor-1', role: 'DONOR' } };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('PUT /api/hospitals/profile', () => {
    it('successfully updates facility name, emergency phone, street, city, and district', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-102',
        userId: 'user-hosp-102',
        hospitalName: 'Old Facility Name',
        licenseNumber: 'HOSP-LIC-102',
        emergencyHelpline: '+91 11111 22222',
        isVerifiedByAdmin: false,
        address: {
          street: 'Old Street',
          city: 'Old City',
          state: 'Old State',
          postalCode: '111111',
        },
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        save: vi.fn().mockResolvedValue(true),
      };

      const mockUserDoc = {
        _id: 'user-hosp-102',
        name: 'Old Facility Name',
        email: 'hospital102@bloodlink.org',
        phone: '+91 11111 22222',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);

      const req: any = {
        user: { id: 'user-hosp-102', role: 'HOSPITAL', email: 'hospital102@bloodlink.org' },
        body: {
          hospitalName: 'Jitesh Multi-Speciality Hospital',
          emergencyHelpline: '+91 99999 88888',
          street: 'New Campus Road',
          city: 'Bengaluru',
          district: 'Karnataka',
        },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.status).toBe('success');
      expect(data.message).toBe('Facility profile updated successfully.');
      expect(data.profile.hospitalName).toBe('Jitesh Multi-Speciality Hospital');
      expect(data.profile.address.city).toBe('Bengaluru');
      expect(data.profile.address.state).toBe('Karnataka');

      // Verify MongoDB documents were updated and saved
      expect(mockHospitalDoc.hospitalName).toBe('Jitesh Multi-Speciality Hospital');
      expect(mockHospitalDoc.address.city).toBe('Bengaluru');
      expect(mockHospitalDoc.address.street).toBe('New Campus Road');
      expect(mockUserDoc.name).toBe('Jitesh Multi-Speciality Hospital');
      expect(mockUserDoc.phone).toBe('+91 99999 88888');
      expect(mockHospitalDoc.save).toHaveBeenCalled();
      expect(mockUserDoc.save).toHaveBeenCalled();

      // Audit log must be written
      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-hosp-102',
          action: 'HOSPITAL_PROFILE_UPDATED',
        })
      );
    });

    it('SECURITY: prevents mass assignment of isVerifiedByAdmin (verification status remains unchanged)', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-sec-1',
        userId: 'user-sec-1',
        hospitalName: 'Unverified Hospital',
        licenseNumber: 'HOSP-SEC-1',
        emergencyHelpline: '+91 88888 77777',
        isVerifiedByAdmin: false, // Must remain false
        address: { street: 'Street', city: 'City', state: 'State', postalCode: '000000' },
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        save: vi.fn().mockResolvedValue(true),
      };

      const mockUserDoc = {
        _id: 'user-sec-1',
        name: 'Unverified Hospital',
        email: 'unverified@test.com',
        phone: '+91 88888 77777',
        isVerified: false, // Must remain false
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);

      const req: any = {
        user: { id: 'user-sec-1', role: 'HOSPITAL', email: 'unverified@test.com' },
        body: {
          hospitalName: 'Updated Name',
          city: 'Updated City',
          isVerifiedByAdmin: true, // Malicious attempt to self-verify!
          isVerified: true,
        },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHospitalDoc.isVerifiedByAdmin).toBe(false); // Security assertion: still false!
      expect(mockUserDoc.isVerified).toBe(false);
      const data = jsonMock.mock.calls[0][0];
      expect(data.profile.isVerifiedByAdmin).toBe(false);
    });

    it('preserves existing isVerifiedByAdmin: true if hospital was already verified', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-sec-2',
        userId: 'user-sec-2',
        hospitalName: 'Verified Trauma Center',
        licenseNumber: 'HOSP-SEC-2',
        emergencyHelpline: '+91 77777 66666',
        isVerifiedByAdmin: true, // Already verified by admin
        address: { street: 'Street', city: 'City', state: 'State', postalCode: '000000' },
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        save: vi.fn().mockResolvedValue(true),
      };

      const mockUserDoc = {
        _id: 'user-sec-2',
        name: 'Verified Trauma Center',
        email: 'verified@test.com',
        phone: '+91 77777 66666',
        isVerified: true,
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);

      const req: any = {
        user: { id: 'user-sec-2', role: 'HOSPITAL', email: 'verified@test.com' },
        body: { city: 'Bengaluru New Area' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHospitalDoc.isVerifiedByAdmin).toBe(true); // Must remain true
      const data = jsonMock.mock.calls[0][0];
      expect(data.profile.isVerifiedByAdmin).toBe(true);
    });

    it('rejects duplicate email address with HTTP 409 Conflict', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-dup-email',
        userId: 'user-dup-email',
        hospitalName: 'Hospital A',
        emergencyHelpline: '+91 12345 67890',
        licenseNumber: 'LIC-A',
        address: { street: 'S', city: 'C', state: 'S', postalCode: '000' },
      };

      const mockUserDoc = {
        _id: 'user-dup-email',
        email: 'original@hospitala.org',
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);
      // Another user already has 'taken@hospitalb.org'
      vi.mocked(User.findOne).mockResolvedValue({ _id: 'other-user', email: 'taken@hospitalb.org' } as any);

      const req: any = {
        user: { id: 'user-dup-email', role: 'HOSPITAL', email: 'original@hospitala.org' },
        body: { email: 'taken@hospitalb.org' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fail', message: expect.stringContaining('already in use') })
      );
    });

    it('rejects duplicate license reference with HTTP 409 Conflict', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-dup-lic',
        userId: 'user-dup-lic',
        hospitalName: 'Hospital A',
        emergencyHelpline: '+91 12345 67890',
        licenseNumber: 'LIC-ORIGINAL',
        address: { street: 'S', city: 'C', state: 'S', postalCode: '000' },
      };

      const mockUserDoc = {
        _id: 'user-dup-lic',
        email: 'hospital@a.org',
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);
      // Another hospital already has 'LIC-TAKEN'
      vi.mocked(HospitalProfile.findOne).mockImplementation(async (query: any) => {
        if (query.userId) return mockHospitalDoc as any;
        if (query.licenseNumber) return { _id: 'other-hosp', licenseNumber: 'LIC-TAKEN' } as any;
        return null;
      });

      const req: any = {
        user: { id: 'user-dup-lic', role: 'HOSPITAL', email: 'hospital@a.org' },
        body: { licenseNumber: 'LIC-TAKEN' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fail', message: expect.stringContaining('License number is already registered') })
      );
    });

    it('updates coordinates when valid 2-element array is provided', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-coords',
        userId: 'user-coords',
        hospitalName: 'Coord Hospital',
        licenseNumber: 'LIC-COORD',
        emergencyHelpline: '+91 11111 22222',
        isVerifiedByAdmin: false,
        address: { street: 'S', city: 'Bengaluru', state: 'KA', postalCode: '560001' },
        location: { type: 'Point', coordinates: [77.59, 12.97] },
        save: vi.fn().mockResolvedValue(true),
      };

      const mockUserDoc = {
        _id: 'user-coords',
        name: 'Coord Hospital',
        email: 'coords@hospital.org',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);

      const req: any = {
        user: { id: 'user-coords', role: 'HOSPITAL', email: 'coords@hospital.org' },
        body: { coordinates: [77.6101, 12.9802] },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHospitalDoc.location.coordinates).toEqual([77.6101, 12.9802]);
    });

    it('updates facility location coordinates when passed as separate latitude and longitude', async () => {
      const mockHospitalDoc: any = {
        _id: 'hosp-coords-sep',
        userId: 'user-coords-sep',
        hospitalName: 'Apollo Hospital Chennai',
        licenseNumber: 'HOSP-LIC-CHE-01',
        emergencyHelpline: '+91 44 2829 0200',
        address: { street: 'Greams Rd', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600006' },
        location: { type: 'Point', coordinates: [77.5946, 12.9716] }, // old Bengaluru coords
        save: vi.fn().mockResolvedValue(true),
      };
      const mockUserDoc: any = {
        _id: 'user-coords-sep',
        email: 'apollo.che@hospital.org',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);
      vi.mocked(User.findById).mockResolvedValue(mockUserDoc as any);

      // Hospital submits Chennai coordinates as separate latitude & longitude
      const req: any = {
        user: { id: 'user-coords-sep', role: 'HOSPITAL', email: 'apollo.che@hospital.org' },
        body: { latitude: 13.0827, longitude: 80.2707 },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateHospitalProfile(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      // Confirms GeoJSON coordinates stored in [longitude, latitude] order
      expect(mockHospitalDoc.location.coordinates).toEqual([80.2707, 13.0827]);
    });
  });

  describe('Zod Validation Middleware for Hospital Profile Update', () => {
    it('rejects invalid email with HTTP 422', async () => {
      const middleware = validateBody(updateHospitalProfileSchema);
      const req: any = { body: { email: 'invalid-email-address' } };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
      const data = jsonMock.mock.calls[0][0];
      expect(data.status).toBe('fail');
      expect(data.errors[0].field).toBe('email');
    });

    it('rejects too-short hospital name with HTTP 422', async () => {
      const middleware = validateBody(updateHospitalProfileSchema);
      const req: any = { body: { hospitalName: 'A' } }; // min is 2
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
      const data = jsonMock.mock.calls[0][0];
      expect(data.errors[0].field).toBe('hospitalName');
    });

    it('rejects out-of-range latitude with HTTP 422', async () => {
      const middleware = validateBody(updateHospitalProfileSchema);
      const req: any = { body: { latitude: 105.5 } }; // max is 90
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
      const data = jsonMock.mock.calls[0][0];
      expect(data.errors[0].field).toBe('latitude');
    });

    it('rejects out-of-range longitude with HTTP 422', async () => {
      const middleware = validateBody(updateHospitalProfileSchema);
      const req: any = { body: { longitude: 195.2 } }; // max is 180
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(next).not.toHaveBeenCalled();
      const data = jsonMock.mock.calls[0][0];
      expect(data.errors[0].field).toBe('longitude');
    });

    it('passes validation for clean valid input with separate coordinates', async () => {
      const middleware = validateBody(updateHospitalProfileSchema);
      const req: any = {
        body: {
          hospitalName: 'Apollo Speciality Hospital',
          email: 'apollo.info@bloodlink.org',
          phone: '+91 44 2829 0200',
          city: 'Chennai',
          district: 'Central',
          street: '21 Greams Lane',
          latitude: '13.0827',
          longitude: '80.2707',
        },
      };
      const res: any = { status: vi.fn() };
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.hospitalName).toBe('Apollo Speciality Hospital');
      expect(req.body.latitude).toBe(13.0827);
      expect(req.body.longitude).toBe(80.2707);
    });
  });
});
