/**
 * Unit & Integration Tests — Complete Donor Location & Emergency Request Matching Flow
 *
 * Requirements:
 * LOCATION:
 * 1. Donor can update location.
 * 2. Donor location persists in MongoDB.
 * 3. Invalid latitude rejected (-90 to 90 range).
 * 4. Invalid longitude rejected (-180 to 180 range).
 * 5. Missing latitude/longitude rejected.
 * 6. Donor cannot update another donor's location (uses JWT req.user.id).
 *
 * MATCHING:
 * 7. Donor within radius appears in request feed.
 * 8. Donor outside radius does not appear.
 * 9. Chennai vs Bengaluru (~290 km) is excluded.
 * 10. Correct non-zero Haversine distance calculation.
 * 11. Missing donor coordinates are excluded.
 * 12. Missing hospital coordinates are excluded.
 * 13. City-name match alone does not create a match (coordinates determine distance).
 * 14. Updated donor coordinates are used immediately for matching.
 * 15. Hospital request uses actual hospital coordinates.
 *
 * ACCEPTANCE:
 * 16. In-radius donor can accept.
 * 17. Outside-radius donor receives 403 OUTSIDE_RADIUS.
 * 18. Missing location receives 403 LOCATION_UNAVAILABLE.
 * 19. Accept is idempotent.
 * 20. Repeated accept does not create duplicate notifications.
 *
 * NOTIFICATIONS:
 * 21. Acceptance notification uses a valid notification type (DONOR_ACCEPTED / STATUS_UPDATE).
 * 22. Hospital receives donor acceptance notification.
 * 23. Donor receives valid lifecycle/contact notification.
 * 24. Notification validation failure cannot falsely turn a successful acceptance into an error.
 *
 * FULFILLMENT:
 * 25. Acceptance does not create DonationHistory.
 * 26. Decline does not create DonationHistory.
 * 27. MATCHED does not create DonationHistory.
 * 28. Only selected accepted donor receives DonationHistory on FULFILLED.
 * 29. Fulfillment is idempotent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDonorProfile,
  updateDonorLocation,
  getDonorDashboard,
  respondToEmergencyRequest,
} from '../controllers/donorController';
import {
  getEmergencyRequests,
  updateEmergencyRequestStatus,
  createEmergencyRequest,
} from '../controllers/emergencyRequestController';
import { calculateDistanceKm, formatDistance } from '../utils/geo';
import { DONOR_MATCH_RADIUS_KM } from '../config/constants';
import { updateDonorLocationSchema } from '../validators/requestSchemas';

vi.mock('../models', () => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  DonorProfile: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
  },
  HospitalProfile: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
  },
  EmergencyRequest: {
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    countDocuments: vi.fn(),
  },
  Notification: {
    create: vi.fn().mockResolvedValue({}),
    find: vi.fn(),
  },
  DonationHistory: {
    create: vi.fn().mockResolvedValue({ _id: 'dh-mock' }),
    find: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null), // No pre-existing history record by default
  },
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/socketService', () => ({
  emitDonorResponse: vi.fn(),
  emitRequestUpdated: vi.fn(),
  emitEmergencyAlert: vi.fn(),
  emitEmergencyFulfilled: vi.fn(),
  pushUnreadCount: vi.fn().mockResolvedValue(undefined),
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
}));

import { DonorProfile, EmergencyRequest, Notification, DonationHistory, HospitalProfile, AuditLog } from '../models';

describe('Complete Donor Location & Matching Flow (29 Criteria)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // SUITE 1: LOCATION UPDATES (Tests 1 - 6)
  // ==========================================
  describe('Location Updates & Persistence', () => {
    it('1. Donor can update location with valid coordinates', async () => {
      const mockDonor = {
        _id: 'donor-1',
        userId: 'user-donor-1',
        bloodGroup: 'O+',
        isAvailable: true,
        address: { city: 'Old City', district: 'Old District', postalCode: '000000' },
        location: { type: 'Point', coordinates: [0, 0] },
        save: vi.fn().mockResolvedValue(true),
      };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonor as any);

      const req: any = {
        user: { id: 'user-donor-1', role: 'DONOR' },
        body: {
          street: '450 Healthcare Blvd',
          city: 'Chennai',
          district: 'Chennai',
          state: 'Tamil Nadu',
          postalCode: '600002',
          latitude: 13.0827,
          longitude: 80.2707,
        },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateDonorLocation(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockDonor.save).toHaveBeenCalled();
      expect(mockDonor.address.city).toBe('Chennai');
      expect(mockDonor.location.coordinates).toEqual([80.2707, 13.0827]);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'Donation location updated successfully.',
          profile: expect.objectContaining({
            coordinates: [80.2707, 13.0827],
            latitude: 13.0827,
            longitude: 80.2707,
          }),
        })
      );
    });

    it('2. Donor location persists in MongoDB document', async () => {
      const mockDonor = {
        _id: 'donor-persist',
        userId: 'user-donor-persist',
        address: { city: 'Bengaluru', district: 'Bengaluru Urban', postalCode: '560001' },
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        save: vi.fn().mockResolvedValue(true),
      };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonor as any);

      const req: any = {
        user: { id: 'user-donor-persist', role: 'DONOR' },
        body: {
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600002',
          latitude: 13.0827,
          longitude: 80.2707,
        },
        ip: '127.0.0.1',
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await updateDonorLocation(req, res, vi.fn());

      // Assert MongoDB document was mutated before save
      expect(mockDonor.location.type).toBe('Point');
      expect(mockDonor.location.coordinates).toEqual([80.2707, 13.0827]);
      expect(mockDonor.address.city).toBe('Chennai');
      expect(mockDonor.save).toHaveBeenCalledTimes(1);
    });

    it('3. Invalid latitude rejected (-90 to 90 range)', async () => {
      // Direct controller check
      const mockDonor = { _id: 'donor-3', userId: 'user-3', save: vi.fn() };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonor as any);

      const req: any = {
        user: { id: 'user-3', role: 'DONOR' },
        body: {
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600002',
          latitude: 95.5, // Invalid > 90
          longitude: 80.2707,
        },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateDonorLocation(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('Invalid latitude'),
        })
      );
      expect(mockDonor.save).not.toHaveBeenCalled();

      // Schema check
      const zodResult = updateDonorLocationSchema.safeParse({
        city: 'Chennai',
        district: 'Chennai',
        postalCode: '600002',
        latitude: -95,
        longitude: 80.2707,
      });
      expect(zodResult.success).toBe(false);
    });

    it('4. Invalid longitude rejected (-180 to 180 range)', async () => {
      const mockDonor = { _id: 'donor-4', userId: 'user-4', save: vi.fn() };
      (DonorProfile.findOne as any).mockResolvedValue(mockDonor as any);

      const req: any = {
        user: { id: 'user-4', role: 'DONOR' },
        body: {
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600002',
          latitude: 13.0827,
          longitude: 195.0, // Invalid > 180
        },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateDonorLocation(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('Invalid longitude'),
        })
      );
      expect(mockDonor.save).not.toHaveBeenCalled();

      const zodResult = updateDonorLocationSchema.safeParse({
        city: 'Chennai',
        district: 'Chennai',
        postalCode: '600002',
        latitude: 13.0827,
        longitude: -185,
      });
      expect(zodResult.success).toBe(false);
    });

    it('5. Missing latitude/longitude rejected by schema', () => {
      const missingBoth = updateDonorLocationSchema.safeParse({
        city: 'Chennai',
        district: 'Chennai',
        postalCode: '600002',
      });
      expect(missingBoth.success).toBe(false);

      const missingLng = updateDonorLocationSchema.safeParse({
        city: 'Chennai',
        district: 'Chennai',
        postalCode: '600002',
        latitude: 13.0827,
      });
      expect(missingLng.success).toBe(false);
    });

    it('6. Donor cannot update another donor location (uses JWT req.user.id)', async () => {
      const mockDonor = {
        _id: 'donor-victim',
        userId: 'user-victim',
        save: vi.fn(),
      };
      // Query should be scoped strictly to req.user.id
      (DonorProfile.findOne as any).mockResolvedValue(null);

      const req: any = {
        user: { id: 'user-attacker', role: 'DONOR' },
        body: {
          targetDonorId: 'donor-victim', // Malicious attempt to supply another donor ID
          city: 'Chennai',
          district: 'Chennai',
          postalCode: '600002',
          latitude: 13.0827,
          longitude: 80.2707,
        },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await updateDonorLocation(req, res, vi.fn());

      expect(DonorProfile.findOne).toHaveBeenCalledWith({ userId: 'user-attacker' });
      expect(res.status).toHaveBeenCalledWith(404);
      expect(mockDonor.save).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // SUITE 2: MATCHING & DISTANCE (Tests 7 - 15)
  // ==========================================
  describe('Matching & Geospatial Distance Evaluation', () => {
    const chennaiCoords: [number, number] = [80.2707, 13.0827];
    const nearbyHospitalCoords: [number, number] = [80.2500, 13.0700]; // ~3 km away
    const bengaluruHospitalCoords: [number, number] = [77.5946, 12.9716]; // ~290 km away

    it('7. Donor within radius appears in request feed', async () => {
      const donorInChennai = {
        _id: 'donor-chennai',
        userId: 'user-donor-chennai',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: { type: 'Point', coordinates: chennaiCoords },
      };

      const nearbyRequest = {
        _id: 'req-nearby',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: nearbyHospitalCoords },
        hospitalId: {
          _id: 'hosp-1',
          hospitalName: 'Apollo Chennai',
          emergencyHelpline: '108',
          location: { type: 'Point', coordinates: nearbyHospitalCoords },
          address: { city: 'Chennai', district: 'Chennai' },
        },
        potentialMatches: [],
        toObject: () => ({ _id: 'req-nearby', bloodGroup: 'O+', status: 'ACTIVE' }),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donorInChennai as any);
      (EmergencyRequest.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([nearbyRequest]),
            }),
          }),
        }),
      } as any);
      (EmergencyRequest.countDocuments as any).mockResolvedValue(1);

      const req: any = { user: { id: 'user-donor-chennai', role: 'DONOR' }, query: {} };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getEmergencyRequests(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(1);
      expect(data.requests[0].id).toBe('req-nearby');
      expect(data.requests[0].distanceFormatted).toContain('km away');
    });

    it('8. Donor outside radius does NOT appear in request feed', async () => {
      const donorInChennai = {
        _id: 'donor-chennai',
        userId: 'user-donor-chennai',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: { type: 'Point', coordinates: chennaiCoords },
      };

      const farRequestInBengaluru = {
        _id: 'req-bengaluru',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: bengaluruHospitalCoords },
        hospitalId: {
          _id: 'hosp-blr',
          hospitalName: 'Manipal Hospital',
          emergencyHelpline: '108',
          location: { type: 'Point', coordinates: bengaluruHospitalCoords },
          address: { city: 'Bengaluru', district: 'Bengaluru' },
        },
        potentialMatches: [],
        toObject: () => ({ _id: 'req-bengaluru', bloodGroup: 'O+' }),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donorInChennai as any);
      (EmergencyRequest.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([farRequestInBengaluru]),
            }),
          }),
        }),
      } as any);
      (EmergencyRequest.countDocuments as any).mockResolvedValue(1);

      const req: any = { user: { id: 'user-donor-chennai', role: 'DONOR' }, query: {} };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getEmergencyRequests(req, res, vi.fn());

      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(0); // Excluded because distance ~290 km > 30 km
    });

    it('9. Chennai vs Bengaluru distance (~290 km) is mathematically excluded', () => {
      const dist = calculateDistanceKm(chennaiCoords, bengaluruHospitalCoords);
      expect(dist).toBeGreaterThan(280);
      expect(dist).toBeLessThan(310);
      expect(dist).toBeGreaterThan(DONOR_MATCH_RADIUS_KM);
    });

    it('10. Correct non-zero Haversine distance is calculated and formatted', () => {
      const dist = calculateDistanceKm(chennaiCoords, nearbyHospitalCoords);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(10);
      const formatted = formatDistance(dist);
      expect(formatted).not.toBe('0 m');
      expect(formatted).toContain('km');
    });

    it('11. Missing donor coordinates are excluded from request feed', async () => {
      const donorWithoutCoords = {
        _id: 'donor-nocoords',
        userId: 'user-nocoords',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: { type: 'Point', coordinates: [] }, // Incomplete
      };

      const request = {
        _id: 'req-11',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: chennaiCoords },
        potentialMatches: [],
        toObject: () => ({ _id: 'req-11' }),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donorWithoutCoords as any);
      (EmergencyRequest.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([request]),
            }),
          }),
        }),
      } as any);

      const req: any = { user: { id: 'user-nocoords', role: 'DONOR' }, query: {} };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getEmergencyRequests(req, res, vi.fn());

      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(0); // Excluded safely
    });

    it('12. Missing hospital coordinates are safely excluded from matching', async () => {
      const donorInChennai = {
        _id: 'donor-12',
        userId: 'user-12',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: { type: 'Point', coordinates: chennaiCoords },
      };

      const requestWithoutCoords = {
        _id: 'req-12',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: [] }, // Missing
        hospitalId: { address: { city: 'Chennai' }, location: { coordinates: [] } },
        potentialMatches: [],
        toObject: () => ({ _id: 'req-12' }),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donorInChennai as any);
      (EmergencyRequest.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([requestWithoutCoords]),
            }),
          }),
        }),
      } as any);

      const req: any = { user: { id: 'user-12', role: 'DONOR' }, query: {} };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getEmergencyRequests(req, res, vi.fn());

      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(0); // Never defaults to 0 distance
    });

    it('13. City-name match alone does NOT create a match when coordinates are distant', async () => {
      // Both address texts say "Chennai", but coordinates are 290 km apart
      const donor = {
        _id: 'donor-cityname',
        userId: 'user-cityname',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        address: { city: 'Chennai', district: 'Chennai' },
        location: { type: 'Point', coordinates: chennaiCoords },
      };

      const requestWithMismatchedCoords = {
        _id: 'req-cityname',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        address: { city: 'Chennai' },
        location: { type: 'Point', coordinates: bengaluruHospitalCoords }, // Bengaluru coordinates despite "Chennai" name
        hospitalId: { address: { city: 'Chennai' } },
        potentialMatches: [],
        toObject: () => ({ _id: 'req-cityname' }),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([requestWithMismatchedCoords]),
            }),
          }),
        }),
      } as any);

      const req: any = { user: { id: 'user-cityname', role: 'DONOR' }, query: {} };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getEmergencyRequests(req, res, vi.fn());

      const data = jsonMock.mock.calls[0][0];
      // Coordinates determine distance, NOT city text
      expect(data.requests).toHaveLength(0);
    });

    it('14. Updated donor coordinates are used immediately for matching', async () => {
      // Donor updates coordinates from Chennai to Bengaluru
      const donor = {
        _id: 'donor-updated',
        userId: 'user-updated',
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        location: { type: 'Point', coordinates: bengaluruHospitalCoords }, // Now in Bengaluru
      };

      const bengaluruRequest = {
        _id: 'req-blr-14',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: bengaluruHospitalCoords },
        hospitalId: { location: { coordinates: bengaluruHospitalCoords }, address: { city: 'Bengaluru' } },
        potentialMatches: [],
        toObject: () => ({ _id: 'req-blr-14' }),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.find as any).mockReturnValue({
        populate: vi.fn().mockReturnValue({
          sort: vi.fn().mockReturnValue({
            skip: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([bengaluruRequest]),
            }),
          }),
        }),
      } as any);

      const req: any = { user: { id: 'user-updated', role: 'DONOR' }, query: {} };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getEmergencyRequests(req, res, vi.fn());

      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(1); // Now matches because donor relocated
    });

    it('15. Hospital request uses actual hospital coordinates', async () => {
      const mockHospital = {
        _id: 'hosp-15',
        userId: 'user-hosp-15',
        hospitalName: 'Apollo Chennai',
        isVerifiedByAdmin: true,
        location: { type: 'Point', coordinates: chennaiCoords },
      };
      (HospitalProfile.findOne as any).mockResolvedValue(mockHospital as any);
      (EmergencyRequest.create as any).mockResolvedValue({ _id: 'req-15' } as any);

      const req: any = {
        user: { id: 'user-hosp-15', role: 'HOSPITAL' },
        body: {
          patientIdentifier: 'PT-15',
          bloodGroup: 'O+',
          unitsRequired: 1,
          urgency: 'HIGH',
          requiredWithinHours: 4,
          // coordinates omitted: must inherit from mockHospital.location.coordinates
        },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await createEmergencyRequest(req, res, vi.fn());

      expect(EmergencyRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hospitalId: 'hosp-15',
          location: {
            type: 'Point',
            coordinates: chennaiCoords,
          },
        })
      );
    });
  });

  // ==========================================
  // SUITE 3: ACCEPTANCE & RADIUS (Tests 16 - 20)
  // ==========================================
  describe('Donor Acceptance & Proximity Enforcement', () => {
    it('16. In-radius donor can successfully accept', async () => {
      const donor = {
        _id: 'donor-in-radius',
        userId: 'user-donor-in',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] }, // Chennai
      };
      const request = {
        _id: 'req-in-radius',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] }, // ~3 km away
        hospitalId: 'hosp-in',
        potentialMatches: [{ donorId: 'donor-in-radius', status: 'NOTIFIED', coordinationStatus: 'PENDING' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({ userId: 'user-hosp-in' } as any);

      const req: any = {
        params: { requestId: 'req-in-radius' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-in', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(request.potentialMatches[0].status).toBe('ACCEPTED');
      expect(request.save).toHaveBeenCalled();
    });

    it('17. Outside-radius donor receives HTTP 403 OUTSIDE_RADIUS', async () => {
      const chennaiDonor = {
        _id: 'donor-far',
        userId: 'user-donor-far',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] }, // Chennai
      };
      const bengaluruRequest = {
        _id: 'req-far',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        location: { coordinates: [77.5946, 12.9716] }, // Bengaluru (~290 km)
        potentialMatches: [],
        save: vi.fn(),
      };

      (DonorProfile.findOne as any).mockResolvedValue(chennaiDonor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(bengaluruRequest as any);

      const req: any = {
        params: { requestId: 'req-far' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-far', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          code: 'OUTSIDE_RADIUS',
        })
      );
      expect(bengaluruRequest.save).not.toHaveBeenCalled();
    });

    it('18. Missing location receives HTTP 403 LOCATION_UNAVAILABLE', async () => {
      const donorWithoutCoords = {
        _id: 'donor-no-coords',
        userId: 'user-no-coords',
        bloodGroup: 'O+',
        location: { coordinates: [] }, // No coordinates
      };
      const request = {
        _id: 'req-18',
        bloodGroup: 'O+',
        status: 'ACTIVE',
        location: { coordinates: [80.2707, 13.0827] },
        potentialMatches: [], // Not pre-matched
        save: vi.fn(),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donorWithoutCoords as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);

      const req: any = {
        params: { requestId: 'req-18' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-no-coords', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          code: 'LOCATION_UNAVAILABLE',
        })
      );
      expect(request.save).not.toHaveBeenCalled();
    });

    it('19. Accept is idempotent: repeating accept returns existing state', async () => {
      const donor = {
        _id: 'donor-idem',
        userId: 'user-idem',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-idem',
        bloodGroup: 'O+',
        status: 'MATCHED',
        location: { coordinates: [80.2500, 13.0700] },
        potentialMatches: [{ donorId: 'donor-idem', status: 'ACCEPTED' }], // Already accepted
        save: vi.fn(),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);

      const req: any = {
        params: { requestId: 'req-idem' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-idem', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          action: 'ACCEPTED',
          message: expect.stringContaining('already accepted'),
        })
      );
      expect(request.save).not.toHaveBeenCalled();
    });

    it('20. Repeated accept does NOT create duplicate notifications', async () => {
      const donor = {
        _id: 'donor-20',
        userId: 'user-20',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-20',
        bloodGroup: 'O+',
        status: 'MATCHED',
        location: { coordinates: [80.2500, 13.0700] },
        potentialMatches: [{ donorId: 'donor-20', status: 'ACCEPTED' }],
        save: vi.fn(),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);

      const req: any = {
        params: { requestId: 'req-20' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-20', role: 'DONOR' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // SUITE 4: NOTIFICATION INTEGRITY (Tests 21 - 24)
  // ==========================================
  describe('Notification Validation & Resilience', () => {
    it('21. Acceptance notification uses valid notification types only (DONOR_ACCEPTED and STATUS_UPDATE)', async () => {
      const donor = {
        _id: 'donor-notif',
        userId: 'user-donor-notif',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-notif',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        hospitalId: 'hosp-notif',
        potentialMatches: [{ donorId: 'donor-notif', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({
        userId: 'user-hosp-notif',
        hospitalName: 'Apollo',
      } as any);

      const req: any = {
        params: { requestId: 'req-notif' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-notif', role: 'DONOR', name: 'Verified Donor' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      const notifCalls = (Notification.create as any).mock.calls.map((c) => c[0] as any);
      const validTypes = ['EMERGENCY_ALERT', 'DONOR_ACCEPTED', 'DONOR_DECLINED', 'STATUS_UPDATE', 'SYSTEM'];

      for (const notif of notifCalls) {
        expect(validTypes).toContain(notif.type);
        expect(notif.type).not.toBe('DONATION_MATCH');
      }
    });

    it('22. Hospital receives DONOR_ACCEPTED notification', async () => {
      const donor = {
        _id: 'donor-22',
        userId: 'user-donor-22',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-22',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        hospitalId: 'hosp-22',
        potentialMatches: [{ donorId: 'donor-22', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({
        userId: 'user-hosp-22',
        hospitalName: 'Apollo',
      } as any);

      const req: any = {
        params: { requestId: 'req-22' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-22', role: 'DONOR', name: 'Hero Donor' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-hosp-22',
          type: 'DONOR_ACCEPTED',
        })
      );
    });

    it('23. Donor receives valid STATUS_UPDATE notification upon acceptance', async () => {
      const donor = {
        _id: 'donor-23',
        userId: 'user-donor-23',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-23',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        hospitalId: 'hosp-23',
        potentialMatches: [{ donorId: 'donor-23', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({
        userId: 'user-hosp-23',
        hospitalName: 'Apollo',
      } as any);

      const req: any = {
        params: { requestId: 'req-23' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-23', role: 'DONOR', name: 'Donor 23' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-donor-23',
          type: 'STATUS_UPDATE',
        })
      );
    });

    it('24. Notification failure cannot falsely turn a successful acceptance into an error', async () => {
      const donor = {
        _id: 'donor-24',
        userId: 'user-donor-24',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-24',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        hospitalId: 'hosp-24',
        potentialMatches: [{ donorId: 'donor-24', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({ userId: 'user-hosp-24' } as any);
      // Simulate notification service error
      (Notification.create as any).mockRejectedValueOnce(new Error('Notification DB failure'));

      const req: any = {
        params: { requestId: 'req-24' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-24', role: 'DONOR', name: 'Donor 24' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      // Should NOT throw or fail the response
      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          action: 'ACCEPTED',
        })
      );
      expect(request.potentialMatches[0].status).toBe('ACCEPTED');
    });
  });

  // ==========================================
  // SUITE 5: FULFILLMENT & HISTORY (Tests 25 - 29)
  // ==========================================
  describe('Fulfillment & DonationHistory Integrity', () => {
    it('25. Acceptance does NOT create DonationHistory', async () => {
      const donor = {
        _id: 'donor-25',
        userId: 'user-donor-25',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-25',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        hospitalId: 'hosp-25',
        potentialMatches: [{ donorId: 'donor-25', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({ userId: 'hosp-25' } as any);

      const req: any = {
        params: { requestId: 'req-25' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-25', role: 'DONOR' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('26. Decline does NOT create DonationHistory', async () => {
      const donor = {
        _id: 'donor-26',
        userId: 'user-donor-26',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-26',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        potentialMatches: [{ donorId: 'donor-26', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);

      const req: any = {
        params: { requestId: 'req-26' },
        body: { action: 'DECLINED' },
        user: { id: 'user-donor-26', role: 'DONOR' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('27. MATCHED status does NOT create DonationHistory', async () => {
      // Units required = 1, donor accepts -> status becomes MATCHED
      const donor = {
        _id: 'donor-27',
        userId: 'user-donor-27',
        bloodGroup: 'O+',
        location: { coordinates: [80.2707, 13.0827] },
      };
      const request = {
        _id: 'req-27',
        bloodGroup: 'O+',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [80.2500, 13.0700] },
        hospitalId: 'hosp-27',
        potentialMatches: [{ donorId: 'donor-27', status: 'NOTIFIED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      (DonorProfile.findOne as any).mockResolvedValue(donor as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (HospitalProfile.findById as any).mockResolvedValue({ userId: 'hosp-27' } as any);

      const req: any = {
        params: { requestId: 'req-27' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-27', role: 'DONOR' },
      };
      const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(request.status).toBe('MATCHED');
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('28. Only selected accepted donor receives DonationHistory on FULFILLED', async () => {
      const hospital = { _id: { toString: () => 'hosp-28' }, userId: 'user-hosp-28' };
      const selectedDonor = {
        _id: 'donor-selected',
        userId: 'user-selected',
        bloodGroup: 'O+',
        save: vi.fn().mockResolvedValue(true),
      };

      const request = {
        _id: { toString: () => 'req-28' },
        hospitalId: { toString: () => 'hosp-28' },
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        status: 'MATCHED',
        potentialMatches: [
          { donorId: { toString: () => 'donor-selected' }, status: 'ACCEPTED', coordinationStatus: 'CONTACTED' },
          { donorId: { toString: () => 'donor-other' }, status: 'ACCEPTED', coordinationStatus: 'PENDING' },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      (HospitalProfile.findOne as any).mockResolvedValue(hospital as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);
      (DonorProfile.findById as any).mockResolvedValue(selectedDonor as any);
      (DonationHistory.create as any).mockResolvedValue({ _id: 'dh-28' } as any);
      // No pre-existing record → should create one
      (DonationHistory as any).findOne = vi.fn().mockResolvedValue(null);

      const req: any = {
        params: { id: 'req-28' },
        body: { status: 'FULFILLED', fulfilledDonorId: 'donor-selected' },
        user: { id: 'user-hosp-28', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(request.status).toBe('FULFILLED');
      expect(DonationHistory.create).toHaveBeenCalledTimes(1);
      expect(DonationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
        })
      );
    });

    it('29. Fulfillment is idempotent: completing already fulfilled request does not duplicate DonationHistory', async () => {
      const hospital = { _id: 'hosp-29', userId: 'user-hosp-29' };
      const request = {
        _id: 'req-29',
        hospitalId: 'hosp-29',
        status: 'FULFILLED', // Terminal state
        save: vi.fn(),
      };

      (HospitalProfile.findOne as any).mockResolvedValue(hospital as any);
      (EmergencyRequest.findById as any).mockResolvedValue(request as any);

      const req: any = {
        params: { id: 'req-29' },
        body: { status: 'FULFILLED', fulfilledDonorId: 'donor-selected' },
        user: { id: 'user-hosp-29', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          // The state machine rejects FULFILLED→FULFILLED with "Invalid state transition from 'FULFILLED' to 'FULFILLED'. Allowed target states: None (terminal state)"
          message: expect.stringContaining('FULFILLED'),
        })
      );
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });
  });
});
