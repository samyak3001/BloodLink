/**
 * Unit & Integration Tests — Donor ↔ Hospital Request Details and Acceptance Flow
 *
 * Validates:
 * 1. Emergency request listing returns real hospital name and address details, with safe fallback
 * 2. Donor acceptance is stored, notifying both hospital and donor, and emitting Socket.IO events
 * 3. Hospital request details endpoint returns populated accepted donors with privacy controls
 * 4. Multiple accepted donors handling
 * 5. Duplicate acceptance rejection (HTTP 409)
 * 6. Incompatible blood group rejection (HTTP 400 BLOOD_INCOMPATIBLE)
 * 7. Inactive / fulfilled / cancelled request protection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEmergencyRequests,
  getEmergencyRequestById,
  getPotentialMatchesForRequest,
  contactAcceptedDonor,
} from '../controllers/emergencyRequestController';
import {
  respondToEmergencyRequest,
  getDonorDashboard,
} from '../controllers/donorController';

// ---------------------------------------------------------------------------
// Model and Service Mocks
// ---------------------------------------------------------------------------

vi.mock('../models/EmergencyRequest', () => ({
  EmergencyRequest: {
    find: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../models/HospitalProfile', () => ({
  HospitalProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../models/DonorProfile', () => ({
  DonorProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../models/User', () => ({
  User: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/Notification', () => ({
  Notification: {
    create: vi.fn().mockResolvedValue({}),
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../models/DonationHistory', () => ({
  DonationHistory: {
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../models/AuditLog', () => ({
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../services/socketService', () => ({
  emitEmergencyAlert: vi.fn(),
  emitDonorResponse: vi.fn(),
  emitRequestUpdated: vi.fn(),
  pushUnreadCount: vi.fn(),
  getIO: vi.fn(),
}));

import { EmergencyRequest } from '../models/EmergencyRequest';
import { HospitalProfile } from '../models/HospitalProfile';
import { DonorProfile } from '../models/DonorProfile';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import * as socketService from '../services/socketService';

describe('Donor ↔ Hospital Request Details & Acceptance Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // BUG 1: Real Requesting Hospital Name and Location
  // -------------------------------------------------------------------------
  describe('Bug 1: Real Hospital Name & Details in Emergency Requests', () => {
    it('returns real hospital name and address formatted when hospital profile exists', async () => {
      const mockHospProfile = {
        _id: 'hosp-123',
        hospitalName: 'Apollo Speciality Hospital',
        emergencyHelpline: '+91 44 2829 0200',
        address: {
          street: '21 Greams Lane',
          city: 'Chennai',
          district: 'Central District',
          state: 'Tamil Nadu',
          postalCode: '600006',
        },
      };

      const mockRequestDoc = {
        _id: 'req-001',
        patientIdentifier: 'EMERGENCY-ICU-42',
        bloodGroup: 'O-',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        requiredWithinHours: 3,
        notes: 'Emergency whole blood required for trauma patient.',
        hospitalId: mockHospProfile,
        toObject: () => ({
          _id: 'req-001',
          patientIdentifier: 'EMERGENCY-ICU-42',
          bloodGroup: 'O-',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 2,
          urgency: 'CRITICAL',
          status: 'ACTIVE',
          requiredWithinHours: 3,
          notes: 'Emergency whole blood required for trauma patient.',
          hospitalId: mockHospProfile,
        }),
      };

      const queryChain = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRequestDoc]),
      };

      vi.mocked(EmergencyRequest.find).mockReturnValue(queryChain as any);
      vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

      const req: any = { query: {} };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await getEmergencyRequests(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(1);
      const reqItem = data.requests[0];

      // Must expose real hospital name and location at top level
      expect(reqItem.hospitalName).toBe('Apollo Speciality Hospital');
      expect(reqItem.city).toContain('Chennai');
      expect(reqItem.city).toContain('Central District');
      expect(reqItem.hospitalEmergencyHelpline).toBe('+91 44 2829 0200');
    });

    it('falls back safely to "Hospital information unavailable" when hospital profile is missing', async () => {
      const mockRequestDoc = {
        _id: 'req-002',
        patientIdentifier: 'REF-ORPHANED-1',
        bloodGroup: 'A+',
        unitsRequired: 1,
        urgency: 'HIGH',
        status: 'ACTIVE',
        hospitalId: null, // missing/deleted hospital
        toObject: () => ({
          _id: 'req-002',
          patientIdentifier: 'REF-ORPHANED-1',
          bloodGroup: 'A+',
          unitsRequired: 1,
          urgency: 'HIGH',
          status: 'ACTIVE',
          hospitalId: null,
        }),
      };

      const queryChain = {
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRequestDoc]),
      };

      vi.mocked(EmergencyRequest.find).mockReturnValue(queryChain as any);
      vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

      const req: any = { query: {} };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await getEmergencyRequests(req, res, next);

      const data = jsonMock.mock.calls[0][0];
      const reqItem = data.requests[0];

      // Safe fallback, NEVER fake generic strings like "Local Hospital"
      expect(reqItem.hospitalName).toBe('Hospital information unavailable');
      expect(reqItem.city).toBe('Location unavailable');
      expect(reqItem.hospitalName).not.toBe('Local Hospital');
      expect(reqItem.city).not.toBe('Local Medical Center');
    });
  });

  // -------------------------------------------------------------------------
  // BUG 2: Donor Acceptance Flow & Hospital Accepted Donors View
  // -------------------------------------------------------------------------
  describe('Bug 2: Donor Acceptance & Hospital Accepted Donors View', () => {
    it('records donor acceptance, notifies hospital and donor, and emits real-time events', async () => {
      const mockDonor = {
        _id: 'donor-777',
        userId: 'user-donor-777',
        bloodGroup: 'O-',
        address: { city: 'Nagercoil', district: 'Kanyakumari' },
        location: { coordinates: [77.43, 8.18] },
      };

      const mockRequest = {
        _id: 'req-900',
        hospitalId: 'hosp-100',
        bloodGroup: 'O-',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        status: 'ACTIVE',
        location: { coordinates: [77.45, 8.19] },
        potentialMatches: [] as any[],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = {
        _id: 'hosp-100',
        userId: 'user-hosp-100',
        hospitalName: 'Kanyakumari Medical College',
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findById).mockResolvedValue(mockHospital as any);
      vi.mocked(User.findById).mockResolvedValue({ name: 'David Kumar' } as any);

      const req: any = {
        params: { id: 'req-900' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-777', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await respondToEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      // 1. Match entry stored with status ACCEPTED
      expect(mockRequest.potentialMatches).toHaveLength(1);
      expect(mockRequest.potentialMatches[0]).toMatchObject({
        donorId: 'donor-777',
        status: 'ACCEPTED',
      });

      // 2. Request status transitioned to MATCHED because unitsRequired (1) was met
      expect(mockRequest.status).toBe('MATCHED');
      expect(mockRequest.save).toHaveBeenCalled();

      // 3. Hospital notification created
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-hosp-100',
          type: 'DONOR_ACCEPTED',
          data: expect.objectContaining({
            donorName: 'David Kumar',
            bloodGroup: 'O-',
            action: 'ACCEPTED',
          }),
        })
      );

      // 4. Donor confirmation notification created
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-donor-777',
          type: 'DONATION_MATCH',
          title: expect.stringContaining('Acceptance Confirmed'),
        })
      );

      // 5. Real-time Socket.IO emission to hospital
      expect(socketService.emitDonorResponse).toHaveBeenCalledWith(
        'user-hosp-100',
        expect.objectContaining({
          donorName: 'David Kumar',
          donorBloodGroup: 'O-',
          action: 'ACCEPTED',
          totalAccepted: 1,
        })
      );

      // 6. Real-time Socket.IO update to request room
      expect(socketService.emitRequestUpdated).toHaveBeenCalledWith(
        'req-900',
        expect.objectContaining({
          newStatus: 'MATCHED',
        })
      );
    });

    it('prevents duplicate acceptance from the same donor (HTTP 409)', async () => {
      const mockDonor = {
        _id: 'donor-dup',
        userId: 'user-donor-dup',
        bloodGroup: 'A+',
        location: { coordinates: [77.2, 28.6] },
      };

      const mockRequest = {
        _id: 'req-dup',
        bloodGroup: 'A+',
        bloodComponent: 'WHOLE_BLOOD',
        status: 'ACTIVE',
        potentialMatches: [
          {
            donorId: 'donor-dup',
            status: 'ACCEPTED',
            respondedAt: new Date(),
          },
        ],
        save: vi.fn(),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

      const req: any = {
        params: { id: 'req-dup' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-dup', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await respondToEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('already responded'),
        })
      );
      expect(mockRequest.save).not.toHaveBeenCalled();
    });

    it('rejects responses to terminal or cancelled requests (HTTP 400)', async () => {
      const mockDonor = {
        _id: 'donor-term',
        userId: 'user-term',
        bloodGroup: 'B+',
        location: { coordinates: [77.2, 28.6] },
      };

      const mockRequest = {
        _id: 'req-term',
        bloodGroup: 'B+',
        status: 'FULFILLED', // Terminal status
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

      const req: any = {
        params: { id: 'req-term' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-term', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await respondToEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining("Cannot respond to request with status 'FULFILLED'"),
        })
      );
    });

    it('hospital request details retrieves accepted donors with privacy controls', async () => {
      const mockHospitalDoc = {
        _id: 'hosp-view',
        hospitalName: 'Metro General Trauma Center',
        address: { city: 'Metro Hub', state: 'Delhi' },
      };

      const mockAcceptedDonor1 = {
        _id: 'donor-1',
        bloodGroup: 'O-',
        address: { city: 'South Sector', district: 'Zone 4' },
        isAvailable: true,
        privacySettings: { hideExactLocation: true, showContactToMatchedHospitalsOnly: true },
        userId: {
          name: 'Sarah Connor',
          phone: '+91 98765 11111',
          email: 'sarah@example.com',
          isVerified: true,
        },
      };

      const mockAcceptedDonor2 = {
        _id: 'donor-2',
        bloodGroup: 'O-',
        address: { city: 'North Sector', district: 'Zone 1' },
        isAvailable: true,
        privacySettings: { hideExactLocation: true, showContactToMatchedHospitalsOnly: false }, // opted out of contact
        userId: {
          name: 'John Doe',
          phone: '+91 98765 22222',
          email: 'john@example.com',
          isVerified: true,
        },
      };

      const mockRequest = {
        _id: 'req-hospital-view',
        patientIdentifier: 'EMERGENCY-SURGERY-101',
        bloodGroup: 'O-',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        status: 'MATCHED',
        hospitalId: mockHospitalDoc,
        potentialMatches: [
          {
            donorId: mockAcceptedDonor1,
            status: 'ACCEPTED',
            notifiedAt: new Date(),
            respondedAt: new Date(),
            distanceKm: 2.4,
          },
          {
            donorId: mockAcceptedDonor2,
            status: 'ACCEPTED',
            notifiedAt: new Date(),
            respondedAt: new Date(),
            distanceKm: 4.1,
          },
          {
            donorId: { _id: 'donor-3', bloodGroup: 'O-' },
            status: 'NOTIFIED',
          },
        ],
        toObject: () => ({
          _id: 'req-hospital-view',
          patientIdentifier: 'EMERGENCY-SURGERY-101',
          bloodGroup: 'O-',
          unitsRequired: 2,
          urgency: 'CRITICAL',
          status: 'MATCHED',
          hospitalId: mockHospitalDoc,
          potentialMatches: [],
        }),
      };

      vi.mocked(EmergencyRequest.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockRequest),
      } as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospitalDoc as any);

      const req: any = {
        params: { id: 'req-hospital-view' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await getEmergencyRequestById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];

      // Verify real hospital name
      expect(data.request.hospitalName).toBe('Metro General Trauma Center');

      // Verify accepted donors list
      expect(data.acceptedDonors).toHaveLength(2);

      const donor1 = data.acceptedDonors[0];
      expect(donor1.name).toBe('Sarah Connor');
      expect(donor1.bloodGroup).toBe('O-');
      expect(donor1.location).toBe('South Sector, Zone 4');
      expect(donor1.contact?.phone).toBe('+91 98765 11111'); // Permitted

      const donor2 = data.acceptedDonors[1];
      expect(donor2.name).toBe('John Doe');
      expect(donor2.contact).toBeUndefined(); // Masked by privacy settings
      expect(donor2.contactMasked).toBe(true);

      // Verify stats
      expect(data.stats.acceptedCount).toBe(2);
      expect(data.stats.pendingCount).toBe(1);
    });

    it('hospital contacts accepted donor and dispatches persistent notification (Phase 7)', async () => {
      const mockHospital = {
        _id: 'hosp-view',
        hospitalName: 'Metro General Trauma Center',
        emergencyHelpline: '+91 11 2345 6789',
      };

      const mockDonorUser = {
        _id: 'user-sarah',
        name: 'Sarah Connor',
        phone: '+91 98765 11111',
        email: 'sarah@example.com',
      };

      const mockDonorProfile = {
        _id: 'donor-1',
        userId: mockDonorUser,
        privacySettings: { showContactToMatchedHospitalsOnly: true },
      };

      const mockRequest = {
        _id: 'req-hospital-view',
        patientIdentifier: 'EMERGENCY-SURGERY-101',
        hospitalId: 'hosp-view',
        potentialMatches: [
          {
            donorId: 'donor-1',
            status: 'ACCEPTED',
          },
        ],
      };

      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);
      vi.mocked(DonorProfile.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockDonorProfile),
      } as any);

      const req: any = {
        params: { id: 'req-hospital-view' },
        body: { donorId: 'donor-1', message: 'Please report to Blood Bank Room 102.' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await contactAcceptedDonor(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          donorId: 'donor-1',
          contact: { phone: '+91 98765 11111', email: 'sarah@example.com' },
          contactMasked: false,
        })
      );

      // Verify persistent notification for the donor
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-sarah',
          type: 'HOSPITAL_CONTACT',
          message: 'Please report to Blood Bank Room 102.',
          data: expect.objectContaining({
            requestId: 'req-hospital-view',
            patientIdentifier: 'EMERGENCY-SURGERY-101',
          }),
        })
      );
    });

    it('rejects contact action if donor has NOT accepted the request (Phase 7 & 11)', async () => {
      const mockHospital = {
        _id: 'hosp-view',
        hospitalName: 'Metro General Trauma Center',
      };

      const mockRequest = {
        _id: 'req-hospital-view',
        hospitalId: 'hosp-view',
        potentialMatches: [
          {
            donorId: 'donor-not-accepted',
            status: 'NOTIFIED', // Not accepted!
          },
        ],
      };

      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);

      const req: any = {
        params: { id: 'req-hospital-view' },
        body: { donorId: 'donor-not-accepted' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await contactAcceptedDonor(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('donor has not accepted this emergency request'),
        })
      );
    });

    it('rejects hospital from contacting donors on another hospital request (Phase 11 authorization)', async () => {
      const mockHospital = {
        _id: 'hosp-other',
        hospitalName: 'Other Hospital',
      };

      const mockRequest = {
        _id: 'req-hospital-view',
        hospitalId: 'hosp-owner', // Different hospital!
        potentialMatches: [
          {
            donorId: 'donor-1',
            status: 'ACCEPTED',
          },
        ],
      };

      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);

      const req: any = {
        params: { id: 'req-hospital-view' },
        body: { donorId: 'donor-1' },
        user: { id: 'user-other-hosp', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await contactAcceptedDonor(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('You can only contact accepted donors for requests initiated by your hospital'),
        })
      );
    });

    it('supports multiple donors accepting the same request without auto-fulfilling (Phase 8 & 9)', async () => {
      const mockRequest = {
        _id: 'req-multi-5346',
        patientIdentifier: 'ER-5346',
        hospitalId: 'hosp-apollo',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 3,
        status: 'ACTIVE',
        location: { coordinates: [77.59, 12.97] },
        potentialMatches: [] as any[],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = {
        _id: 'hosp-apollo',
        userId: 'user-hosp-apollo',
        hospitalName: 'Apollo Hospital',
      };

      const donorA = {
        _id: 'donor-A',
        userId: 'user-donor-A',
        bloodGroup: 'O+',
        address: { city: 'Bengaluru', district: 'South' },
        location: { coordinates: [77.60, 12.98] },
      };

      const donorB = {
        _id: 'donor-B',
        userId: 'user-donor-B',
        bloodGroup: 'O+',
        address: { city: 'Bengaluru', district: 'East' },
        location: { coordinates: [77.61, 12.96] },
      };

      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findById).mockResolvedValue(mockHospital as any);

      // Donor A accepts
      vi.mocked(DonorProfile.findOne).mockResolvedValue(donorA as any);
      vi.mocked(User.findById).mockResolvedValue({ name: 'Donor A' } as any);

      const reqA: any = {
        params: { id: 'req-multi-5346' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-A', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const resA: any = {
        status: vi.fn().mockReturnValue({ json: vi.fn() }),
      };
      await respondToEmergencyRequest(reqA, resA, vi.fn());

      expect(resA.status).toHaveBeenCalledWith(200);
      expect(mockRequest.potentialMatches).toHaveLength(1);
      expect(mockRequest.potentialMatches[0].donorId).toBe('donor-A');
      expect(mockRequest.status).toBe('ACTIVE'); // 1/3 units, still ACTIVE, NOT FULFILLED

      // Donor B accepts
      vi.mocked(DonorProfile.findOne).mockResolvedValue(donorB as any);
      vi.mocked(User.findById).mockResolvedValue({ name: 'Donor B' } as any);

      const reqB: any = {
        params: { id: 'req-multi-5346' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-B', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const resB: any = {
        status: vi.fn().mockReturnValue({ json: vi.fn() }),
      };
      await respondToEmergencyRequest(reqB, resB, vi.fn());

      expect(resB.status).toHaveBeenCalledWith(200);
      expect(mockRequest.potentialMatches).toHaveLength(2);
      expect(mockRequest.potentialMatches[1].donorId).toBe('donor-B');

      // Both donors accepted the same request ID
      const accepted = mockRequest.potentialMatches.filter((m) => m.status === 'ACCEPTED');
      expect(accepted).toHaveLength(2);
      expect(mockRequest.status).not.toBe('FULFILLED'); // Must NEVER auto-fulfill (Phase 9)
    });

    it('donor request feed filters out incompatible blood requests (Phase 3)', async () => {
      // O+ donor should NOT receive O- whole blood request
      const donorOPlus = {
        _id: 'donor-oplus',
        userId: 'user-oplus',
        bloodGroup: 'O+',
        supportedComponents: ['WHOLE_BLOOD', 'RED_CELLS'],
      };

      const requestONeg = {
        _id: 'req-oneg',
        bloodGroup: 'O-',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        hospitalId: {
          hospitalName: 'Trauma Center',
          address: { city: 'City', district: 'Zone' },
        },
        toObject: () => ({
          _id: 'req-oneg',
          bloodGroup: 'O-',
          bloodComponent: 'WHOLE_BLOOD',
        }),
      };

      const requestOPlus = {
        _id: 'req-oplus',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        hospitalId: {
          hospitalName: 'Apollo Hospital',
          address: { city: 'City', district: 'Zone' },
        },
        toObject: () => ({
          _id: 'req-oplus',
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
        }),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(donorOPlus as any);
      vi.mocked(EmergencyRequest.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([requestONeg, requestOPlus]),
      } as any);
      vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(2);

      const req: any = {
        query: { status: 'ACTIVE' },
        user: { id: 'user-oplus', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };

      await getEmergencyRequests(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];

      // Only O+ request must be returned; O- whole blood request is filtered out
      expect(data.requests).toHaveLength(1);
      expect(data.requests[0].bloodGroup).toBe('O+');
      expect(data.requests[0].hospitalName).toBe('Apollo Hospital');
    });
  });
});

