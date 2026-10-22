/**
 * End-to-End Regression Test Suite:
 * Bug 1: Donor Registration & GeoJSON Integrity
 * Bug 2: Hospital Emergency Requests & Dynamic Donor Feed Matching
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { register } from '../controllers/authController';
import {
  createEmergencyRequest,
  getEmergencyRequests,
  getPotentialMatchesForRequest,
} from '../controllers/emergencyRequestController';
import { updateHospitalProfile } from '../controllers/hospitalController';
import { respondToEmergencyRequest, getDonorProfile } from '../controllers/donorController';
import { DONOR_MATCH_RADIUS_KM } from '../config/constants';
import * as matchingService from '../services/matchingService';

// Mock dependencies
vi.mock('../models', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
  DonorProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
  },
  HospitalProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  },
  EmergencyRequest: {
    findOne: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
  DonationHistory: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  Notification: {
    create: vi.fn().mockResolvedValue({}),
    countDocuments: vi.fn().mockResolvedValue(0),
  },
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

import { User, DonorProfile, HospitalProfile, EmergencyRequest, DonationHistory } from '../models';

vi.mock('../utils/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_pw_123'),
  comparePassword: vi.fn().mockResolvedValue(true),
}));

vi.mock('../utils/jwt', () => ({
  generateToken: vi.fn().mockReturnValue('mock_jwt_token'),
}));

vi.mock('../services/socketService', () => ({
  emitEmergencyAlert: vi.fn(),
  emitDonorResponse: vi.fn(),
  emitRequestUpdated: vi.fn(),
  pushUnreadCount: vi.fn(),
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
}));

describe('BloodLink — Registration GeoJSON & Emergency Request Matching Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // BUG 1: DONOR REGISTRATION WITHOUT / WITH COORDINATES
  // --------------------------------------------------------------------------
  describe('BUG 1: Donor Registration & GeoJSON', () => {
    it('1. Donor registration without coordinates creates profile with location as undefined (never empty Point)', async () => {
      (User.findOne as any).mockResolvedValue(null);
      const mockCreatedUser = {
        _id: 'user-donor-1',
        name: 'Pon Samyak',
        email: 'pon.donor@example.com',
        role: 'DONOR',
        phone: '9876543210',
        toSafeObject: () => ({ id: 'user-donor-1', name: 'Pon Samyak' }),
      };
      (User.create as any).mockResolvedValue(mockCreatedUser as any);

      let capturedDonorDoc: any = null;
      (DonorProfile.create as any).mockImplementation(async (doc: any) => {
        capturedDonorDoc = doc;
        return {
          ...doc,
          _id: 'donor-profile-1',
          toJSON: () => ({ ...doc, id: 'donor-profile-1' }),
        } as any;
      });

      const req: any = {
        body: {
          name: 'Pon Samyak',
          email: 'pon.donor@example.com',
          password: 'Password123!',
          role: 'DONOR',
          bloodGroup: 'O+',
          phone: '9876543210',
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600001',
          // Coordinates intentionally omitted
        },
        ip: '127.0.0.1',
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(capturedDonorDoc).toBeDefined();
      // Crucial: location must NOT be { type: 'Point', coordinates: [] }
      expect(capturedDonorDoc.location).toBeUndefined();
      // Address must be preserved
      expect(capturedDonorDoc.address.city).toBe('Chennai');
      expect(capturedDonorDoc.address.postalCode).toBe('600001');
    });

    it('2. Donor registration with valid coordinates stores GeoJSON [longitude, latitude]', async () => {
      (User.findOne as any).mockResolvedValue(null);
      const mockCreatedUser = {
        _id: 'user-donor-2',
        name: 'Chennai Donor',
        email: 'chennai.donor@example.com',
        role: 'DONOR',
        phone: '9876543210',
        toSafeObject: () => ({ id: 'user-donor-2' }),
      };
      (User.create as any).mockResolvedValue(mockCreatedUser as any);

      let capturedDonorDoc: any = null;
      (DonorProfile.create as any).mockImplementation(async (doc: any) => {
        capturedDonorDoc = doc;
        return {
          ...doc,
          _id: 'donor-profile-2',
          toJSON: () => ({ ...doc, id: 'donor-profile-2' }),
        } as any;
      });

      const req: any = {
        body: {
          name: 'Chennai Donor',
          email: 'chennai.donor@example.com',
          password: 'Password123!',
          role: 'DONOR',
          bloodGroup: 'O+',
          phone: '9876543210',
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600001',
          coordinates: [80.2707, 13.0827], // [lng, lat]
        },
        ip: '127.0.0.1',
      };

      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(capturedDonorDoc.location).toEqual({
        type: 'Point',
        coordinates: [80.2707, 13.0827],
      });
    });

    it('3. Safely rolls back User creation if DonorProfile creation fails (no orphaned user records)', async () => {
      (User.findOne as any).mockResolvedValue(null);
      const mockCreatedUser = {
        _id: 'user-donor-orphaned',
        email: 'orphan@example.com',
      };
      (User.create as any).mockResolvedValue(mockCreatedUser as any);
      (DonorProfile.create as any).mockRejectedValue(new Error('MongoDB GeoJSON validation error'));

      const req: any = {
        body: {
          name: 'Orphan Donor',
          email: 'orphan@example.com',
          password: 'Password123!',
          role: 'DONOR',
          bloodGroup: 'O+',
          phone: '9876543210',
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600001',
        },
        ip: '127.0.0.1',
      };

      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await register(req, res, next);

      expect(User.findByIdAndDelete).toHaveBeenCalledWith('user-donor-orphaned');
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('4. getDonorProfile returns hasValidLocation: false when coordinates are missing', async () => {
      const mockDonorProfile = {
        _id: 'donor-1',
        userId: 'user-1',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        address: { city: 'Chennai', district: 'Chennai', state: 'TN', postalCode: '600001' },
        location: undefined,
      };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonorProfile as any);

      const req: any = {
        user: { id: 'user-1', role: 'DONOR', name: 'Pon Samyak', email: 'pon@example.com', phone: '9876543210' },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getDonorProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const profile = res.json.mock.calls[0][0].profile;
      expect(profile.hasValidLocation).toBe(false);
      expect(profile.latitude).toBeNull();
      expect(profile.longitude).toBeNull();
      expect(profile.coordinates).toEqual([]);
      expect(profile.address.city).toBe('Chennai');
    });
  });

  // --------------------------------------------------------------------------
  // BUG 2: HOSPITAL LOCATION, EMERGENCY REQUEST & DONOR FEED MATCHING
  // --------------------------------------------------------------------------
  describe('BUG 2: Hospital Coordinates, Request Creation & Dynamic Matching', () => {
    it('5. Hospital updates facility location to Chennai [80.2707, 13.0827] and saves GeoJSON Point', async () => {
      const mockHospital = {
        _id: 'hosp-apollo',
        userId: 'user-apollo',
        hospitalName: 'Apollo Hospital',
        licenseNumber: 'HOSP-APOLLO-01',
        emergencyHelpline: '044-28290200',
        isVerifiedByAdmin: true,
        address: { street: 'Greams Road', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600006' },
        location: undefined as any,
        save: vi.fn().mockResolvedValue(true),
      };
      const mockUser = {
        _id: 'user-apollo',
        name: 'Apollo Hospital',
        email: 'apollo@chennai.org',
        save: vi.fn().mockResolvedValue(true),
      };

      (HospitalProfile.findOne as any).mockResolvedValue(mockHospital as any);
      (User.findById as any).mockResolvedValue(mockUser as any);

      const req: any = {
        user: { id: 'user-apollo', role: 'HOSPITAL', email: 'apollo@chennai.org' },
        body: {
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          latitude: 13.0827,
          longitude: 80.2707,
        },
        ip: '127.0.0.1',
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await updateHospitalProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockHospital.location).toEqual({
        type: 'Point',
        coordinates: [80.2707, 13.0827], // [longitude, latitude]
      });
      expect(mockHospital.save).toHaveBeenCalled();
    });

    it('6. Hospital profile update rejects unpaired latitude without longitude', async () => {
      const mockHospital = {
        _id: 'hosp-apollo',
        userId: 'user-apollo',
        address: { street: '', city: 'Chennai', state: '', postalCode: '' },
        save: vi.fn(),
      };
      (HospitalProfile.findOne as any).mockResolvedValue(mockHospital as any);
      (User.findById as any).mockResolvedValue({ save: vi.fn() } as any);

      const req: any = {
        user: { id: 'user-apollo', role: 'HOSPITAL' },
        body: {
          city: 'Chennai',
          latitude: 13.0827,
          // longitude missing
        },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await updateHospitalProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringMatching(/both latitude and longitude/i),
        })
      );
    });

    it('7. Rejects emergency request creation when hospital coordinates are missing', async () => {
      const mockHospital = {
        _id: 'hosp-apollo',
        userId: 'user-apollo',
        isVerifiedByAdmin: true,
        location: undefined, // No coordinates
      };
      (HospitalProfile.findOne as any).mockResolvedValue(mockHospital as any);

      const req: any = {
        user: { id: 'user-apollo', role: 'HOSPITAL' },
        body: {
          patientIdentifier: 'ER-CASE-01',
          bloodGroup: 'O+',
          unitsRequired: 2,
          urgency: 'CRITICAL',
          requiredWithinHours: 3,
        },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await createEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringMatching(/valid location coordinates/i),
        })
      );
      expect(EmergencyRequest.create).not.toHaveBeenCalled();
    });

    it('8. Emergency request inherits currently saved hospital facility coordinates', async () => {
      const mockHospital = {
        _id: 'hosp-apollo',
        userId: 'user-apollo',
        hospitalName: 'Apollo Hospital Chennai',
        isVerifiedByAdmin: true,
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827], // Saved Chennai coordinates
        },
        address: { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
      };
      (HospitalProfile.findOne as any).mockResolvedValue(mockHospital as any);

      let createdRequestPayload: any = null;
      (EmergencyRequest.create as any).mockImplementation(async (payload: any) => {
        createdRequestPayload = payload;
        return {
          ...payload,
          _id: 'req-chennai-01',
          toObject: () => ({ ...payload, _id: 'req-chennai-01' }),
        } as any;
      });

      const req: any = {
        user: { id: 'user-apollo', role: 'HOSPITAL' },
        body: {
          patientIdentifier: 'ER-TRAUMA-CHENNAI',
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 4,
          urgency: 'CRITICAL',
          requiredWithinHours: 2,
        },
        ip: '127.0.0.1',
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await createEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(createdRequestPayload.location).toEqual({
        type: 'Point',
        coordinates: [80.2707, 13.0827], // Correctly inherited Chennai coordinates
      });
      expect(createdRequestPayload.status).toBe('ACTIVE');
    });

    it('9. Donor feed (getEmergencyRequests) returns active request for donor in Chennai (<= 30 km)', async () => {
      const mockDonorProfile = {
        _id: 'donor-pon',
        userId: 'user-pon',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827], // Chennai
        },
      };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonorProfile as any);

      const mockRequestInChennai = {
        _id: 'req-chennai-01',
        patientIdentifier: 'ER-TRAUMA-01',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827], // Chennai (distance = 0 km)
        },
        hospitalId: {
          _id: 'hosp-apollo',
          hospitalName: 'Apollo Hospital Chennai',
          emergencyHelpline: '044-28290200',
          isVerifiedByAdmin: true,
          location: { coordinates: [80.2707, 13.0827] },
          address: { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' },
        },
        potentialMatches: [],
        toObject: function () { return this; },
      };

      const mockSort = vi.fn().mockResolvedValue([mockRequestInChennai]);
      const mockPopulate = vi.fn().mockReturnValue({ sort: mockSort });
      (EmergencyRequest.find as any).mockReturnValue({ populate: mockPopulate } as any);

      const req: any = {
        user: { id: 'user-pon', role: 'DONOR' },
        query: { status: 'ACTIVE' },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getEmergencyRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const json = res.json.mock.calls[0][0];
      expect(json.totalCount).toBe(1);
      expect(json.requests).toHaveLength(1);
      expect(json.requests[0].id).toBe('req-chennai-01');
      expect(json.requests[0].distanceKm).toBe(0);
    });

    it('10. Donor feed excludes emergency request if donor is outside 30 km radius (e.g. Bengaluru ~290 km away)', async () => {
      const mockDonorInBengaluru = {
        _id: 'donor-bengaluru',
        userId: 'user-bengaluru',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716], // Bengaluru
        },
      };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonorInBengaluru as any);

      const mockRequestInChennai = {
        _id: 'req-chennai-01',
        patientIdentifier: 'ER-TRAUMA-01',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827], // Chennai
        },
        hospitalId: {
          _id: 'hosp-apollo',
          isVerifiedByAdmin: true,
          location: { coordinates: [80.2707, 13.0827] },
          address: { city: 'Chennai' },
        },
        potentialMatches: [],
        toObject: function () { return this; },
      };

      const mockSort = vi.fn().mockResolvedValue([mockRequestInChennai]);
      const mockPopulate = vi.fn().mockReturnValue({ sort: mockSort });
      (EmergencyRequest.find as any).mockReturnValue({ populate: mockPopulate } as any);

      const req: any = {
        user: { id: 'user-bengaluru', role: 'DONOR' },
        query: { status: 'ACTIVE' },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getEmergencyRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const json = res.json.mock.calls[0][0];
      // Excluded because ~290 km > 30 km
      expect(json.totalCount).toBe(0);
      expect(json.requests).toHaveLength(0);
    });

    it('11. Donor feed excludes emergency requests created by unverified hospitals', async () => {
      const mockDonorProfile = {
        _id: 'donor-pon',
        userId: 'user-pon',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827],
        },
      };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonorProfile as any);

      const mockUnverifiedRequest = {
        _id: 'req-unverified-01',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: [80.2707, 13.0827] },
        hospitalId: {
          _id: 'hosp-unverified',
          isVerifiedByAdmin: false, // NOT verified by admin
          location: { coordinates: [80.2707, 13.0827] },
        },
        potentialMatches: [],
        toObject: function () { return this; },
      };

      const mockSort = vi.fn().mockResolvedValue([mockUnverifiedRequest]);
      const mockPopulate = vi.fn().mockReturnValue({ sort: mockSort });
      (EmergencyRequest.find as any).mockReturnValue({ populate: mockPopulate } as any);

      const req: any = {
        user: { id: 'user-pon', role: 'DONOR' },
        query: { status: 'ACTIVE' },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getEmergencyRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const json = res.json.mock.calls[0][0];
      expect(json.totalCount).toBe(0);
      expect(json.requests).toHaveLength(0);
    });

    it('12. getPotentialMatchesForRequest dynamically discovers new donors within 30 km and merges into potentialMatches', async () => {
      const mockRequest = {
        _id: 'req-apollo-01',
        hospitalId: 'hosp-apollo',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        urgency: 'CRITICAL',
        unitsRequired: 2,
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: [80.2707, 13.0827] }, // Chennai
        potentialMatches: [] as any[],
        save: vi.fn().mockResolvedValue(true),
        populate: vi.fn().mockResolvedValue(true),
      };

      (EmergencyRequest.findById as any).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockRequest),
      } as any);

      (HospitalProfile.findOne as any).mockResolvedValue({
        _id: 'hosp-apollo',
        userId: 'user-apollo',
      } as any);

      // Mock findPotentialMatches discovering newly registered donor in Chennai
      const findPotentialMatchesSpy = vi.spyOn(matchingService, 'findPotentialMatches');
      findPotentialMatchesSpy.mockResolvedValue([
        {
          donorId: 'donor-pon',
          userId: 'user-pon',
          donorName: 'Pon Samyak',
          bloodGroup: 'O+',
          supportedComponents: ['WHOLE_BLOOD'],
          address: { city: 'Chennai', district: 'Chennai', postalCode: '600001' },
          distanceKm: 2.5,
          distanceFormatted: '2.5 km away',
          estimatedTransitTimeMinutes: 10,
          matchScore: 85,
          matchReasons: ['Exact blood group match (O+)', 'Immediate proximity'],
          isExactBloodMatch: true,
        },
      ]);

      const req: any = {
        params: { id: 'req-apollo-01' },
        user: { id: 'user-apollo', role: 'HOSPITAL' },
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await getPotentialMatchesForRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      // Confirms dynamically discovered donor was added
      expect(mockRequest.potentialMatches).toHaveLength(1);
      expect(mockRequest.potentialMatches[0].donorId).toBe('donor-pon');
      expect(mockRequest.potentialMatches[0].distanceKm).toBe(2.5);
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('13. Donor acceptance enforces proximity and does NOT create DonationHistory', async () => {
      const mockDonor = {
        _id: 'donor-pon',
        userId: 'user-pon',
        bloodGroup: 'O+',
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827], // Chennai
        },
        address: { city: 'Chennai', district: 'Chennai' },
      };
      const mockRequest = {
        _id: 'req-chennai-01',
        hospitalId: 'hosp-apollo',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        status: 'ACTIVE',
        location: {
          type: 'Point',
          coordinates: [80.2707, 13.0827], // Chennai
        },
        potentialMatches: [] as any[],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(mockDonor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(mockRequest as any);
      (HospitalProfile.findById as any).mockResolvedValue({
        _id: 'hosp-apollo',
        userId: 'user-apollo',
        hospitalName: 'Apollo Hospital',
      } as any);
      (User.findById as any).mockResolvedValue({ name: 'Pon Samyak' } as any);

      const req: any = {
        params: { requestId: 'req-chennai-01' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-pon', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      await respondToEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRequest.potentialMatches[0].status).toBe('ACCEPTED');
      // Crucial: DonationHistory must NOT be created on acceptance (only on fulfillment)
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });
  });
});
