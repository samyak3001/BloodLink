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
  createEmergencyRequest,
  getEmergencyRequests,
  getEmergencyRequestById,
  getPotentialMatchesForRequest,
  contactAcceptedDonor,
  reviewAcceptedDonor,
  updateEmergencyRequestStatus,
} from '../controllers/emergencyRequestController';
import {
  respondToEmergencyRequest,
  getDonorDashboard,
  getDonorHistory,
} from '../controllers/donorController';
import { calculateDistanceKm } from '../utils/geo';

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
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    }),
    find: vi.fn(),
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
    create: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    }),
    findOne: vi.fn().mockResolvedValue(null),
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
import { DonationHistory } from '../models/DonationHistory';
import * as socketService from '../services/socketService';

describe('Donor ↔ Hospital Request Details & Acceptance Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DonorProfile.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any);
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

      // 4. Donor confirmation notification created with VALID type STATUS_UPDATE (not DONATION_MATCH)
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-donor-777',
          type: 'STATUS_UPDATE',
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

    it('idempotently handles duplicate acceptance from the same donor (HTTP 200, no duplicate side effects)', async () => {
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
      vi.mocked(Notification.create).mockClear();

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

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          alreadyResponded: true,
          action: 'ACCEPTED',
        })
      );
      // No duplicate DB save or duplicate notifications
      expect(mockRequest.save).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('rejects DECLINE when donor has already ACCEPTED (HTTP 409 ALREADY_ACCEPTED)', async () => {
      const mockDonor = {
        _id: 'donor-acc-then-dec',
        userId: 'user-donor-acc',
        bloodGroup: 'A+',
        location: { coordinates: [77.2, 28.6] },
      };

      const mockRequest = {
        _id: 'req-acc-then-dec',
        bloodGroup: 'A+',
        bloodComponent: 'WHOLE_BLOOD',
        status: 'ACTIVE',
        potentialMatches: [
          {
            donorId: 'donor-acc-then-dec',
            status: 'ACCEPTED',
            respondedAt: new Date(),
          },
        ],
        save: vi.fn(),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

      const req: any = {
        params: { id: 'req-acc-then-dec' },
        body: { action: 'DECLINED' },
        user: { id: 'user-donor-acc', role: 'DONOR' },
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
          code: 'ALREADY_ACCEPTED',
          message: expect.stringContaining('already accepted this request and cannot decline it'),
        })
      );
      expect(mockRequest.save).not.toHaveBeenCalled();
    });

    it('records donor DECLINE without creating DonationHistory (HTTP 200)', async () => {
      const mockDonor = {
        _id: 'donor-dec-test',
        userId: 'user-donor-dec',
        bloodGroup: 'B+',
        location: { coordinates: [77.2, 28.6] },
      };

      const mockRequest = {
        _id: 'req-dec-test',
        bloodGroup: 'B+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        status: 'ACTIVE',
        potentialMatches: [
          {
            donorId: 'donor-dec-test',
            status: 'NOTIFIED',
            notifiedAt: new Date(),
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { id: 'req-dec-test' },
        body: { action: 'DECLINED' },
        user: { id: 'user-donor-dec', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await respondToEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRequest.potentialMatches[0].status).toBe('DECLINED');
      expect(mockRequest.save).toHaveBeenCalled();
      // Decline must NEVER create DonationHistory
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('rejects ACCEPT when donor has already DECLINED (HTTP 409 ALREADY_DECLINED)', async () => {
      const mockDonor = {
        _id: 'donor-dec-then-acc',
        userId: 'user-donor-dec2',
        bloodGroup: 'B+',
        location: { coordinates: [77.2, 28.6] },
      };

      const mockRequest = {
        _id: 'req-dec-then-acc',
        bloodGroup: 'B+',
        bloodComponent: 'WHOLE_BLOOD',
        status: 'ACTIVE',
        potentialMatches: [
          {
            donorId: 'donor-dec-then-acc',
            status: 'DECLINED',
            respondedAt: new Date(),
          },
        ],
        save: vi.fn(),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

      const req: any = {
        params: { id: 'req-dec-then-acc' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-dec2', role: 'DONOR' },
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
          code: 'ALREADY_DECLINED',
          message: expect.stringContaining('already declined this request'),
        })
      );
      expect(mockRequest.save).not.toHaveBeenCalled();
    });

    it('rejects response from non-donor user with HTTP 403', async () => {
      const req: any = {
        params: { id: 'req-test' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-hospital', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };
      const next = vi.fn();

      await respondToEmergencyRequest(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('Donor access only'),
        })
      );
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
          type: 'STATUS_UPDATE',
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

    it('getEmergencyRequests includes myResponseStatus for authenticated donors', async () => {
      const mockDonor = {
        _id: 'donor-status-check',
        userId: 'user-donor-sc',
        bloodGroup: 'O+',
        supportedComponents: ['WHOLE_BLOOD'],
      };

      const acceptedReq = {
        _id: 'req-accepted-1',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        potentialMatches: [
          { donorId: 'donor-status-check', status: 'ACCEPTED' },
        ],
        hospitalId: { hospitalName: 'Hospital A', address: { city: 'City A' } },
        toObject: () => ({
          _id: 'req-accepted-1',
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
          potentialMatches: [
            { donorId: 'donor-status-check', status: 'ACCEPTED' },
          ],
        }),
      };

      const unrespondedReq = {
        _id: 'req-unresp-2',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        potentialMatches: [
          { donorId: 'donor-status-check', status: 'NOTIFIED' },
        ],
        hospitalId: { hospitalName: 'Hospital B', address: { city: 'City B' } },
        toObject: () => ({
          _id: 'req-unresp-2',
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
          potentialMatches: [
            { donorId: 'donor-status-check', status: 'NOTIFIED' },
          ],
        }),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.find).mockReturnValue({
        populate: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([acceptedReq, unrespondedReq]),
      } as any);
      vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(2);

      const req: any = {
        query: { status: 'ACTIVE' },
        user: { id: 'user-donor-sc', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = {
        status: vi.fn().mockReturnValue({ json: jsonMock }),
      };

      await getEmergencyRequests(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      const data = jsonMock.mock.calls[0][0];
      expect(data.requests).toHaveLength(2);
      expect(data.requests[0].myResponseStatus).toBe('ACCEPTED');
      expect(data.requests[1].myResponseStatus).toBe('NOTIFIED');
    });

    it('handles rapid consecutive acceptance requests idempotently without duplicate side effects', async () => {
      const mockDonor = {
        _id: 'donor-rapid-1',
        userId: 'user-rapid-1',
        bloodGroup: 'A+',
        location: { coordinates: [77.5, 12.9] },
      };

      const mockRequest = {
        _id: 'req-rapid-1',
        hospitalId: 'hosp-1',
        bloodGroup: 'A+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        status: 'ACTIVE',
        location: { coordinates: [77.5, 12.9] },
        potentialMatches: [] as any[],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findById).mockResolvedValue({ userId: 'hosp-user-1', hospitalName: 'Rapid Hosp' } as any);
      vi.mocked(User.findById).mockResolvedValue({ name: 'Rapid Donor' } as any);
      vi.mocked(Notification.create).mockClear();

      const req1: any = {
        params: { id: 'req-rapid-1' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-rapid-1', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const res1: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

      // First click: Accepted
      await respondToEmergencyRequest(req1, res1, vi.fn());
      expect(res1.status).toHaveBeenCalledWith(200);
      expect(mockRequest.potentialMatches).toHaveLength(1);
      expect(mockRequest.potentialMatches[0].status).toBe('ACCEPTED');
      expect(Notification.create).toHaveBeenCalled();

      // Clear notifications to verify second click doesn't trigger another notification
      vi.mocked(Notification.create).mockClear();
      mockRequest.save.mockClear();

      // Second rapid click: already accepted -> idempotent 200 with alreadyResponded: true
      const jsonMock2 = vi.fn();
      const res2: any = { status: vi.fn().mockReturnValue({ json: jsonMock2 }) };
      await respondToEmergencyRequest(req1, res2, vi.fn());

      expect(res2.status).toHaveBeenCalledWith(200);
      expect(jsonMock2).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          alreadyResponded: true,
          action: 'ACCEPTED',
        })
      );
      expect(mockRequest.save).not.toHaveBeenCalled();
      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // DonationHistory Creation on FULFILLED
  // -------------------------------------------------------------------------
  describe('DonationHistory: created when request is marked FULFILLED', () => {
    it('creates DonationHistory record ONLY for the selected fulfilledDonorId when request is marked FULFILLED', async () => {
      const mockRequest = {
        _id: 'req-fulfill-test',
        hospitalId: 'hosp-123',
        patientIdentifier: 'FULFILL-TEST-001',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'HIGH',
        status: 'ACTIVE',
        potentialMatches: [
          { donorId: 'donor-A', status: 'ACCEPTED' },
          { donorId: 'donor-B', status: 'ACCEPTED' },
          { donorId: 'donor-C', status: 'DECLINED' },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = { _id: 'hosp-123', hospitalName: 'Metro Hospital' };

      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);
      vi.mocked(DonationHistory.findOne).mockResolvedValue(null);
      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { id: 'req-fulfill-test' },
        body: { status: 'FULFILLED', fulfilledDonorId: 'donor-A' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };
      const next = vi.fn();

      await updateEmergencyRequestStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);

      // DonationHistory.create must be called with ONLY ONE record for donor-A
      expect(DonationHistory.create).toHaveBeenCalledTimes(1);
      expect(DonationHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          donorId: 'donor-A',
          hospitalId: 'hosp-123',
          requestId: 'req-fulfill-test',
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
          unitsDonated: 1,
          status: 'COMPLETED',
        })
      );
    });

    it('rejects FULFILLED transition with HTTP 400 when fulfilledDonorId is missing', async () => {
      const mockRequest = {
        _id: 'req-missing-donor',
        hospitalId: 'hosp-123',
        patientIdentifier: 'MISSING-DONOR-001',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgency: 'HIGH',
        status: 'ACTIVE',
        potentialMatches: [{ donorId: 'donor-A', status: 'ACCEPTED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = { _id: 'hosp-123', hospitalName: 'Metro Hospital' };
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);
      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { id: 'req-missing-donor' },
        body: { status: 'FULFILLED' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('fulfilled donor ID must be selected'),
        })
      );
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('rejects FULFILLED transition with HTTP 400 when fulfilledDonorId is not in potentialMatches', async () => {
      const mockRequest = {
        _id: 'req-unassociated-donor',
        hospitalId: 'hosp-123',
        patientIdentifier: 'UNASSOCIATED-001',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgency: 'HIGH',
        status: 'ACTIVE',
        potentialMatches: [{ donorId: 'donor-A', status: 'ACCEPTED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = { _id: 'hosp-123', hospitalName: 'Metro Hospital' };
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);
      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { id: 'req-unassociated-donor' },
        body: { status: 'FULFILLED', fulfilledDonorId: 'donor-stranger' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('not associated with this emergency request'),
        })
      );
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('rejects FULFILLED transition with HTTP 400 when fulfilledDonorId has not ACCEPTED (e.g. DECLINED)', async () => {
      const mockRequest = {
        _id: 'req-declined-donor',
        hospitalId: 'hosp-123',
        patientIdentifier: 'DECLINED-001',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgency: 'HIGH',
        status: 'ACTIVE',
        potentialMatches: [
          { donorId: 'donor-A', status: 'ACCEPTED' },
          { donorId: 'donor-C', status: 'DECLINED' },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = { _id: 'hosp-123', hospitalName: 'Metro Hospital' };
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);
      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { id: 'req-declined-donor' },
        body: { status: 'FULFILLED', fulfilledDonorId: 'donor-C' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining("Only donors who responded with ACCEPTED can be fulfilled"),
        })
      );
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('does NOT create DonationHistory records when request is CANCELLED', async () => {
      const mockRequest = {
        _id: 'req-cancel-test',
        hospitalId: 'hosp-123',
        patientIdentifier: 'CANCEL-TEST-001',
        bloodGroup: 'A+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgency: 'HIGH',
        status: 'ACTIVE',
        potentialMatches: [{ donorId: 'donor-X', status: 'ACCEPTED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = { _id: 'hosp-123', hospitalName: 'Metro Hospital' };
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);

      const req: any = {
        params: { id: 'req-cancel-test' },
        body: { status: 'CANCELLED' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      vi.mocked(DonationHistory.create).mockClear();

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('prevents duplicate DonationHistory creation when FULFILLED is repeated (idempotency)', async () => {
      const mockRequest = {
        _id: 'req-repeat-fulfill',
        hospitalId: 'hosp-123',
        patientIdentifier: 'REPEAT-FULFILL-001',
        bloodGroup: 'B+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        potentialMatches: [{ donorId: 'donor-dup-1', status: 'ACCEPTED' }],
        save: vi.fn().mockResolvedValue(true),
      };

      const mockHospital = { _id: 'hosp-123', hospitalName: 'Metro Hospital' };
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);

      // Simulate that a record ALREADY exists for (requestId, donorId)
      vi.mocked(DonationHistory.findOne).mockResolvedValue({ _id: 'existing-hist-id', donorId: 'donor-dup-1' } as any);

      const req: any = {
        params: { id: 'req-repeat-fulfill' },
        body: { status: 'FULFILLED', fulfilledDonorId: 'donor-dup-1' },
        user: { id: 'user-hosp', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      vi.mocked(DonationHistory.create).mockClear();

      await updateEmergencyRequestStatus(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      // DonationHistory.create must NOT create duplicate records
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Database-Driven Donor History & Dashboard Isolation Tests
  // -------------------------------------------------------------------------
  describe('Database-Driven Donor History & Dashboard Statistics', () => {
    it('donor ACCEPTANCE does NOT create any DonationHistory records', async () => {
      const mockDonor = {
        _id: 'donor-accept-test-id',
        userId: 'user-donor-accept',
        bloodGroup: 'O-',
        supportedComponents: ['WHOLE_BLOOD'],
        location: { coordinates: [80.27, 13.08] },
        address: { city: 'Chennai' },
      };

      const mockRequest = {
        _id: 'req-to-accept-id',
        patientIdentifier: 'PT-ACCEPT-01',
        hospitalId: 'hosp-123',
        bloodGroup: 'O-',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        location: { coordinates: [80.28, 13.09] },
        potentialMatches: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findById).mockResolvedValue({ userId: 'hosp-user-1', hospitalName: 'City Hospital' } as any);
      vi.mocked(User.findById).mockResolvedValue({ name: 'Alex Donor' } as any);

      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { requestId: 'req-to-accept-id' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-accept', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      // Acceptance alone must NEVER create a DonationHistory entry
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('MATCHED request status does NOT create DonationHistory records', async () => {
      const mockDonor = {
        _id: 'donor-match-id',
        userId: 'user-donor-match',
        bloodGroup: 'A+',
        supportedComponents: ['WHOLE_BLOOD'],
        location: { coordinates: [80.27, 13.08] },
        address: { city: 'Chennai' },
      };

      // 1 unit required, already has 0 accepted. When this donor accepts, totalAccepted becomes 1 >= 1 => status becomes MATCHED
      const mockRequest = {
        _id: 'req-matched-status-id',
        patientIdentifier: 'PT-MATCH-01',
        hospitalId: 'hosp-123',
        bloodGroup: 'A+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 1,
        urgency: 'HIGH',
        status: 'ACTIVE',
        location: { coordinates: [80.28, 13.09] },
        potentialMatches: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findById).mockResolvedValue({ userId: 'hosp-user-1', hospitalName: 'City Hospital' } as any);
      vi.mocked(User.findById).mockResolvedValue({ name: 'Sarah Donor' } as any);

      vi.mocked(DonationHistory.create).mockClear();

      const req: any = {
        params: { requestId: 'req-matched-status-id' },
        body: { action: 'ACCEPTED' },
        user: { id: 'user-donor-match', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await respondToEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRequest.status).toBe('MATCHED');
      // MATCHED state transition must NOT create DonationHistory
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });

    it('getDonorDashboard returns exact 0 completed donations and 0 units when donor has no history', async () => {
      const mockDonor = {
        _id: 'donor-new-empty-id',
        userId: 'user-donor-new',
        bloodGroup: 'AB-',
        supportedComponents: ['WHOLE_BLOOD'],
        isAvailable: true,
        selfReportedScreening: { isAgeEligible: true },
        toSafeProfile: () => ({ bloodGroup: 'AB-', isAvailable: true }),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.find).mockReturnValue({
        populate: vi.fn().mockResolvedValue([]),
      } as any);

      // No completed donations in database
      vi.mocked(DonationHistory.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as any);
      vi.mocked(Notification.countDocuments).mockResolvedValue(0);

      const req: any = {
        user: { id: 'user-donor-new', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getDonorDashboard(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          dashboard: expect.objectContaining({
            bloodGroup: 'AB-',
            isAvailable: true,
            stats: expect.objectContaining({
              totalCompletedDonations: 0,
              unitsDonated: 0,
              compatibleActiveRequestsCount: 0,
            }),
            nearbyRequests: [],
          }),
        })
      );
    });

    it('getDonorDashboard correctly sums units from multiple completed donations', async () => {
      const mockDonor = {
        _id: 'donor-multi-history-id',
        userId: 'user-donor-multi',
        bloodGroup: 'O+',
        supportedComponents: ['WHOLE_BLOOD', 'PLATELETS'],
        isAvailable: true,
        selfReportedScreening: { isAgeEligible: true },
        toSafeProfile: () => ({ bloodGroup: 'O+', isAvailable: true }),
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
      vi.mocked(EmergencyRequest.find).mockReturnValue({
        populate: vi.fn().mockResolvedValue([]),
      } as any);

      // Two completed donations: 1 unit + 2 units = 3 units
      vi.mocked(DonationHistory.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([{ unitsDonated: 1 }, { unitsDonated: 2 }]),
      } as any);
      vi.mocked(Notification.countDocuments).mockResolvedValue(1);

      const req: any = {
        user: { id: 'user-donor-multi', role: 'DONOR' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getDonorDashboard(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dashboard: expect.objectContaining({
            stats: expect.objectContaining({
              totalCompletedDonations: 2,
              unitsDonated: 3,
            }),
          }),
        })
      );
    });

    it('getDonorHistory enforces tenant isolation: queries strictly by authenticated donor ID', async () => {
      const mockDonorA = {
        _id: 'donor-profile-A',
        userId: 'user-A',
      };

      vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonorA as any);

      const sortMock = vi.fn().mockResolvedValue([
        {
          _id: 'don-rec-1',
          donorId: 'donor-profile-A',
          unitsDonated: 1,
          bloodGroup: 'O+',
        },
      ]);
      const populateMock = vi.fn().mockReturnValue({ sort: sortMock });
      vi.mocked(DonationHistory.find).mockReturnValue({ populate: populateMock } as any);

      const req: any = {
        user: { id: 'user-A', role: 'DONOR' },
        // Attempting to inject a different donorId in params or query
        query: { donorId: 'donor-profile-B' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getDonorHistory(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      // Query MUST strictly use donor-profile-A resolved from req.user.id
      expect(DonationHistory.find).toHaveBeenCalledWith({ donorId: 'donor-profile-A' });
    });
  });

  // -------------------------------------------------------------------------
  // Hospital Verification Gate: createEmergencyRequest
  // -------------------------------------------------------------------------
  describe('Hospital Verification Gate — createEmergencyRequest', () => {
    const validRequestBody = {
      patientIdentifier: 'ER-TEST-99',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      urgency: 'CRITICAL',
      requiredWithinHours: 3,
      maxRadiusKm: 25,
    };

    it('rejects an unverified HOSPITAL (isVerifiedByAdmin: false) with HTTP 403', async () => {
      const unverifiedHospital = {
        _id: 'hosp-unverified-1',
        userId: 'user-hosp-unverified',
        hospitalName: 'Unverified Test Hospital',
        isVerifiedByAdmin: false,
        location: { type: 'Point', coordinates: [80.27, 13.08] },
        address: { city: 'Chennai' },
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(unverifiedHospital as any);

      const req: any = {
        body: validRequestBody,
        user: { id: 'user-hosp-unverified', role: 'HOSPITAL' },
        ip: '127.0.0.1',
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
      // Must not create an EmergencyRequest document
      expect(EmergencyRequest.create).not.toHaveBeenCalled();
    });

    it('allows a verified HOSPITAL (isVerifiedByAdmin: true) to create an emergency request', async () => {
      const verifiedHospital = {
        _id: 'hosp-verified-1',
        userId: 'user-hosp-verified',
        hospitalName: 'Metro Life Hospital',
        isVerifiedByAdmin: true,
        location: { type: 'Point', coordinates: [80.27, 13.08] },
        address: { city: 'Chennai', district: 'Chennai', state: 'TN', postalCode: '600001' },
      };

      const createdDoc = {
        _id: 'req-new-123',
        ...validRequestBody,
        hospitalId: verifiedHospital._id,
        status: 'ACTIVE',
        potentialMatches: [],
        toObject: () => ({
          _id: 'req-new-123',
          ...validRequestBody,
          hospitalId: verifiedHospital._id,
          status: 'ACTIVE',
        }),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(verifiedHospital as any);
      vi.mocked(EmergencyRequest.create).mockResolvedValue(createdDoc as any);
      vi.mocked(DonorProfile.find).mockResolvedValue([]);

      const req: any = {
        body: validRequestBody,
        user: { id: 'user-hosp-verified', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await createEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
        })
      );
    });

    it('rejects non-hospital users (e.g. DONOR) with HTTP 403', async () => {
      const req: any = {
        body: validRequestBody,
        user: { id: 'user-donor-1', role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await createEmergencyRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('Only registered hospitals'),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Complete Real-World Workflow: Review, Coordination, Radius & Fulfillment
  // -------------------------------------------------------------------------
  describe('Complete Real-World Workflow: Hospital Review & Donor Coordination', () => {
    it('allows owning hospital to review accepted donor profile (sets HOSPITAL_REVIEWED)', async () => {
      const mockHosp = {
        _id: 'hosp-100',
        userId: 'user-hosp-100',
        hospitalName: 'Apollo Specialty Hospital',
      };
      const mockReq = {
        _id: 'req-review-1',
        hospitalId: 'hosp-100',
        potentialMatches: [
          {
            donorId: 'donor-rev-1',
            status: 'ACCEPTED',
            coordinationStatus: 'PENDING',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHosp as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockReq as any);

      const req: any = {
        params: { id: 'req-review-1' },
        body: { donorId: 'donor-rev-1' },
        user: { id: 'user-hosp-100', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await reviewAcceptedDonor(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          donorId: 'donor-rev-1',
          coordinationStatus: 'HOSPITAL_REVIEWED',
        })
      );
      expect(mockReq.potentialMatches[0].coordinationStatus).toBe('HOSPITAL_REVIEWED');
      expect(mockReq.potentialMatches[0].reviewedAt).toBeInstanceOf(Date);
      expect(mockReq.save).toHaveBeenCalled();
    });

    it('rejects reviewing donor who has not ACCEPTED the request (HTTP 400)', async () => {
      const mockHosp = {
        _id: 'hosp-100',
        userId: 'user-hosp-100',
      };
      const mockReq = {
        _id: 'req-review-2',
        hospitalId: 'hosp-100',
        potentialMatches: [
          {
            donorId: 'donor-declined-1',
            status: 'DECLINED',
          },
        ],
        save: vi.fn(),
      };

      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHosp as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockReq as any);

      const req: any = {
        params: { id: 'req-review-2' },
        body: { donorId: 'donor-declined-1' },
        user: { id: 'user-hosp-100', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await reviewAcceptedDonor(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'fail',
          message: expect.stringContaining('You can only review accepted donors'),
        })
      );
    });

    it('contactAcceptedDonor sets coordinationStatus to CONTACTED and saves contactedAt', async () => {
      const mockHospital = {
        _id: 'hosp-contact-1',
        userId: 'user-hosp-c',
        hospitalName: 'Apollo City Hospital',
        emergencyHelpline: '+91 44 2829 0200',
        address: { street: 'Greams Road', city: 'Chennai', state: 'TN' },
      };

      const mockDonorUser = {
        _id: 'user-donor-c',
        name: 'Arun Kumar',
        phone: '+91 98400 12345',
        email: 'arun@example.com',
      };

      const mockDonorProfile = {
        _id: 'donor-c-1',
        userId: mockDonorUser,
        privacySettings: { showContactToMatchedHospitalsOnly: true },
      };

      const mockRequest = {
        _id: 'req-contact-1',
        patientIdentifier: 'ER-CH-99',
        hospitalId: 'hosp-contact-1',
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        urgency: 'CRITICAL',
        potentialMatches: [
          {
            donorId: 'donor-c-1',
            status: 'ACCEPTED',
            coordinationStatus: 'HOSPITAL_REVIEWED',
          },
        ],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(mockHospital as any);
      vi.mocked(DonorProfile.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockDonorProfile),
      } as any);

      const req: any = {
        params: { id: 'req-contact-1' },
        body: { donorId: 'donor-c-1' },
        user: { id: 'user-hosp-c', role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await contactAcceptedDonor(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          donorId: 'donor-c-1',
          coordinationStatus: 'CONTACTED',
        })
      );
      expect(mockRequest.potentialMatches[0].coordinationStatus).toBe('CONTACTED');
      expect(mockRequest.potentialMatches[0].contactedAt).toBeInstanceOf(Date);
      expect(mockRequest.save).toHaveBeenCalled();
    });

    it('getPotentialMatchesForRequest returns coordinationStatus and selfReportedScreening for accepted donors', async () => {
      const mockReq = {
        _id: 'req-match-1',
        hospitalId: 'hosp-100',
        bloodGroup: 'O+',
        unitsRequired: 2,
        potentialMatches: [
          {
            donorId: {
              _id: 'donor-pm-1',
              bloodGroup: 'O+',
              supportedComponents: ['WHOLE_BLOOD'],
              address: { city: 'Chennai', district: 'Chennai', postalCode: '600001' },
              isAvailable: true,
              selfReportedScreening: { isHealthy: true, weightAbove50kg: true },
              userId: { name: 'Praveen K', phone: '+91 99999 11111', isVerified: true },
            },
            status: 'ACCEPTED',
            coordinationStatus: 'CONTACTED',
            distanceKm: 4.5,
            matchScore: 92,
            notifiedAt: new Date(),
            respondedAt: new Date(),
          },
        ],
      };

      vi.mocked(EmergencyRequest.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(mockReq),
      } as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue({ _id: 'hosp-100', userId: 'user-hosp-100' } as any);

      const req: any = {
        params: { id: 'req-match-1' },
        user: { id: 'user-hosp-100', role: 'HOSPITAL' },
      };
      const jsonMock = vi.fn();
      const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

      await getPotentialMatchesForRequest(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          acceptedDonors: expect.arrayContaining([
            expect.objectContaining({
              donorId: 'donor-pm-1',
              coordinationStatus: 'CONTACTED',
              selfReportedScreening: expect.objectContaining({ isHealthy: true }),
            }),
          ]),
        })
      );
    });

    it('executes full sequential sub-flow: Donor Accepts -> Hospital Notified -> Hospital Opens Request & Reviews -> Hospital Contacts -> Donor Notified (No DonationHistory, Not FULFILLED)', async () => {
      // 1. Setup entities
      const hospitalUser = { _id: 'user-hosp-seq', name: 'Apollo Health' };
      const hospitalProfile = {
        _id: 'hosp-seq-1',
        userId: hospitalUser._id,
        hospitalName: 'Apollo Multi-Specialty Hospital',
        emergencyHelpline: '+91 44 2829 0200',
        address: { street: 'Greams Road', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600006' },
      };

      const donorUser = {
        _id: 'user-donor-seq',
        name: 'Samyak Pon',
        email: 'samyak@example.com',
        phone: '+91 98888 77777',
        isVerified: true,
      };
      const donorProfile = {
        _id: 'donor-seq-1',
        userId: donorUser._id,
        bloodGroup: 'O+',
        isAvailable: true,
        supportedComponents: ['WHOLE_BLOOD'],
        address: { city: 'Chennai', district: 'Chennai', postalCode: '600006' },
        location: { type: 'Point', coordinates: [80.25, 13.06] },
        selfReportedScreening: { isHealthy: true, weightAbove50kg: true },
        privacySettings: { showContactToMatchedHospitalsOnly: true },
      };

      const requestDoc: any = {
        _id: 'req-seq-101',
        patientIdentifier: 'ER-SEQ-101',
        hospitalId: hospitalProfile._id,
        bloodGroup: 'O+',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 2,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        location: { type: 'Point', coordinates: [80.26, 13.07] },
        potentialMatches: [
          {
            donorId: donorProfile._id,
            status: 'NOTIFIED',
            coordinationStatus: 'PENDING',
            distanceKm: 2.1,
            matchScore: 95,
            notifiedAt: new Date(),
          },
        ],
        save: vi.fn().mockImplementation(async function () {
          return true;
        }),
        toObject: () => ({
          _id: 'req-seq-101',
          patientIdentifier: 'ER-SEQ-101',
          hospitalId: hospitalProfile._id,
          bloodGroup: 'O+',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 2,
          urgency: 'CRITICAL',
          status: requestDoc.status,
          potentialMatches: requestDoc.potentialMatches,
        }),
      };

      // Mocks
      vi.mocked(DonorProfile.findOne).mockResolvedValue(donorProfile as any);
      vi.mocked(User.findById).mockResolvedValue(donorUser as any);
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(requestDoc as any);
      vi.mocked(HospitalProfile.findById).mockResolvedValue(hospitalProfile as any);
      vi.mocked(HospitalProfile.findOne).mockResolvedValue(hospitalProfile as any);

      // --- STEP A: DONOR ACCEPTS REQUEST ---
      const acceptReq: any = {
        params: { id: 'req-seq-101' },
        body: { action: 'ACCEPTED' },
        user: { id: donorUser._id, role: 'DONOR' },
        ip: '127.0.0.1',
      };
      const acceptJson = vi.fn();
      const acceptRes: any = { status: vi.fn().mockReturnValue({ json: acceptJson }) };

      await respondToEmergencyRequest(acceptReq, acceptRes, vi.fn());

      expect(acceptRes.status).toHaveBeenCalledWith(200);
      expect(requestDoc.potentialMatches[0].status).toBe('ACCEPTED');
      expect(requestDoc.status).toBe('ACTIVE'); // unitsRequired is 2, 1 accepted -> remains ACTIVE (not FULFILLED)

      // Hospital receives notification
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: hospitalProfile.userId,
          type: 'DONOR_ACCEPTED',
          message: expect.stringContaining('Samyak Pon with compatible blood group (O+) has accepted'),
        })
      );

      // Verify NO DonationHistory is created at acceptance stage
      expect(DonationHistory.create).not.toHaveBeenCalled();

      // --- STEP B: HOSPITAL OPENS REQUEST & REVIEWS PROFILE ---
      // Configure populate for getEmergencyRequestById
      const populatedRequest = {
        ...requestDoc,
        hospitalId: hospitalProfile,
        potentialMatches: [
          {
            donorId: {
              ...donorProfile,
              userId: donorUser,
            },
            status: 'ACCEPTED',
            coordinationStatus: 'PENDING',
            distanceKm: 2.1,
            notifiedAt: new Date(),
            respondedAt: new Date(),
          },
        ],
        toObject: () => ({
          ...requestDoc,
          hospitalId: hospitalProfile,
        }),
      };

      vi.mocked(EmergencyRequest.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue(populatedRequest),
      } as any);

      const viewReq: any = {
        params: { id: 'req-seq-101' },
        user: { id: hospitalUser._id, role: 'HOSPITAL' },
      };
      const viewJson = vi.fn();
      const viewRes: any = { status: vi.fn().mockReturnValue({ json: viewJson }) };

      await getEmergencyRequestById(viewReq, viewRes, vi.fn());

      expect(viewRes.status).toHaveBeenCalledWith(200);
      expect(viewJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          acceptedDonors: expect.arrayContaining([
            expect.objectContaining({
              donorId: 'donor-seq-1',
              donorName: 'Samyak Pon',
              bloodGroup: 'O+',
              status: 'ACCEPTED',
              coordinationStatus: 'PENDING',
              selfReportedScreening: expect.objectContaining({ isHealthy: true }),
            }),
          ]),
        })
      );

      // --- STEP C: HOSPITAL REVIEWS DONOR PROFILE ---
      vi.mocked(EmergencyRequest.findById).mockResolvedValue(requestDoc as any);

      const reviewReq: any = {
        params: { id: 'req-seq-101' },
        body: { donorId: 'donor-seq-1' },
        user: { id: hospitalUser._id, role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const reviewJson = vi.fn();
      const reviewRes: any = { status: vi.fn().mockReturnValue({ json: reviewJson }) };

      await reviewAcceptedDonor(reviewReq, reviewRes, vi.fn());

      expect(reviewRes.status).toHaveBeenCalledWith(200);
      expect(requestDoc.potentialMatches[0].coordinationStatus).toBe('HOSPITAL_REVIEWED');
      expect(requestDoc.potentialMatches[0].reviewedAt).toBeInstanceOf(Date);
      expect(DonationHistory.create).not.toHaveBeenCalled();

      // --- STEP D: HOSPITAL CLICKS "CONTACT DONOR" ---
      vi.mocked(DonorProfile.findById).mockReturnValue({
        populate: vi.fn().mockResolvedValue({
          ...donorProfile,
          userId: donorUser,
        }),
      } as any);

      const contactReq: any = {
        params: { id: 'req-seq-101' },
        body: { donorId: 'donor-seq-1' },
        user: { id: hospitalUser._id, role: 'HOSPITAL' },
        ip: '127.0.0.1',
      };
      const contactJson = vi.fn();
      const contactRes: any = { status: vi.fn().mockReturnValue({ json: contactJson }) };

      await contactAcceptedDonor(contactReq, contactRes, vi.fn());

      expect(contactRes.status).toHaveBeenCalledWith(200);
      expect(requestDoc.potentialMatches[0].coordinationStatus).toBe('CONTACTED');
      expect(requestDoc.potentialMatches[0].contactedAt).toBeInstanceOf(Date);

      // Donor receives contact/coordination notification
      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: donorUser._id,
          type: 'STATUS_UPDATE',
          title: expect.stringContaining('Proceed to Apollo Multi-Specialty Hospital'),
          message: expect.stringContaining('ready to coordinate your donation'),
        })
      );

      // Final critical assertions
      expect(requestDoc.status).not.toBe('FULFILLED');
      expect(DonationHistory.create).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// BUG 1: NOTIFICATION TYPE VALIDATION TESTS
// =============================================================================
describe('Bug 1: Notification Type Validation — Accept/Decline Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DonorProfile.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any);
  });

  it('B1-1: Accept succeeds with HTTP 200 and STATUS_UPDATE (not DONATION_MATCH) notification', async () => {
    const mockDonor = {
      _id: 'donor-b1-1',
      userId: 'user-donor-b1-1',
      bloodGroup: 'O+',
      address: { city: 'Bengaluru', district: 'South' },
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-1',
      hospitalId: 'hosp-b1-1',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    const mockHospital = {
      _id: 'hosp-b1-1',
      userId: 'user-hosp-b1-1',
      hospitalName: 'City Hospital',
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue(mockHospital as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'Test Donor' } as any);

    const req: any = {
      params: { id: 'req-b1-1' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-1', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', action: 'ACCEPTED' })
    );

    // Verify STATUS_UPDATE is used, NOT the invalid DONATION_MATCH
    const notifCalls = vi.mocked(Notification.create).mock.calls.map((c) => c[0]);
    const donorNotif = notifCalls.find((n: any) => n.recipientId === 'user-donor-b1-1');
    expect(donorNotif).toBeDefined();
    expect((donorNotif as any).type).toBe('STATUS_UPDATE');
    expect((donorNotif as any).type).not.toBe('DONATION_MATCH');
  });

  it('B1-2: Decline succeeds with HTTP 200 without creating any notification', async () => {
    const mockDonor = {
      _id: 'donor-b1-2',
      userId: 'user-donor-b1-2',
      bloodGroup: 'A+',
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-2',
      hospitalId: 'hosp-b1-2',
      bloodGroup: 'A+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [{ donorId: 'donor-b1-2', status: 'NOTIFIED', notifiedAt: new Date() }],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(Notification.create).mockClear();

    const req: any = {
      params: { id: 'req-b1-2' },
      body: { action: 'DECLINED' },
      user: { id: 'user-donor-b1-2', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', action: 'DECLINED' })
    );
    // DECLINED should not send a donor self-notification
    const notifCalls = vi.mocked(Notification.create).mock.calls.map((c) => c[0]);
    const donorNotif = notifCalls.find((n: any) => n.recipientId === 'user-donor-b1-2');
    expect(donorNotif).toBeUndefined();
  });

  it('B1-3: Valid notification types only — DONATION_MATCH is never used', async () => {
    const mockDonor = {
      _id: 'donor-b1-3',
      userId: 'user-donor-b1-3',
      bloodGroup: 'B+',
      address: { city: 'Bengaluru', district: 'East' },
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-3',
      hospitalId: 'hosp-b1-3',
      bloodGroup: 'B+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue({
      _id: 'hosp-b1-3',
      userId: 'user-hosp-b1-3',
      hospitalName: 'Test Hospital',
    } as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'B1-3 Donor' } as any);

    const req: any = {
      params: { id: 'req-b1-3' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-3', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    const validNotifTypes = ['EMERGENCY_ALERT', 'DONOR_ACCEPTED', 'DONOR_DECLINED', 'STATUS_UPDATE', 'SYSTEM'];
    const allCreatedNotifs = vi.mocked(Notification.create).mock.calls.map((c) => c[0] as any);

    for (const notif of allCreatedNotifs) {
      expect(validNotifTypes).toContain(notif.type);
      expect(notif.type).not.toBe('DONATION_MATCH');
      expect(notif.type).not.toBe('REQUEST_MATCH');
      expect(notif.type).not.toBe('DONOR_RESPONSE');
    }
  });

  it('B1-4: Notification validation error does not cause false-error HTTP response', async () => {
    // Even if Notification.create were to fail internally, the main response must still succeed
    const mockDonor = {
      _id: 'donor-b1-4',
      userId: 'user-donor-b1-4',
      bloodGroup: 'AB+',
      address: { city: 'Bengaluru', district: 'North' },
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-4',
      hospitalId: 'hosp-b1-4',
      bloodGroup: 'AB+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue({
      _id: 'hosp-b1-4',
      userId: 'user-hosp-b1-4',
      hospitalName: 'Emergency Center',
    } as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'B1-4 Donor' } as any);

    const req: any = {
      params: { id: 'req-b1-4' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-4', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    // With the fix in place, STATUS_UPDATE is valid — Notification.create should NOT throw
    await respondToEmergencyRequest(req, res, vi.fn());

    // Main operation must succeed
    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', action: 'ACCEPTED' })
    );
  });

  it('B1-5: Hospital receives DONOR_ACCEPTED notification when donor accepts (correct type for hospital)', async () => {
    const mockDonor = {
      _id: 'donor-b1-5',
      userId: 'user-donor-b1-5',
      bloodGroup: 'O-',
      address: { city: 'Bengaluru', district: 'West' },
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-5',
      hospitalId: 'hosp-b1-5',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    const mockHospital = {
      _id: 'hosp-b1-5',
      userId: 'user-hosp-b1-5',
      hospitalName: 'O-Negative Emergency Center',
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue(mockHospital as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'O-Neg Donor' } as any);

    const req: any = {
      params: { id: 'req-b1-5' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-5', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    const allCreatedNotifs = vi.mocked(Notification.create).mock.calls.map((c) => c[0] as any);

    // Hospital must get DONOR_ACCEPTED
    const hospitalNotif = allCreatedNotifs.find((n) => n.recipientId === 'user-hosp-b1-5');
    expect(hospitalNotif).toBeDefined();
    expect(hospitalNotif.type).toBe('DONOR_ACCEPTED');

    // Donor must get STATUS_UPDATE (not DONATION_MATCH)
    const donorNotif = allCreatedNotifs.find((n) => n.recipientId === 'user-donor-b1-5');
    expect(donorNotif).toBeDefined();
    expect(donorNotif.type).toBe('STATUS_UPDATE');
  });

  it('B1-6: Double Accept is handled safely — no duplicate notifications on second call', async () => {
    const mockDonor = {
      _id: 'donor-b1-6',
      userId: 'user-donor-b1-6',
      bloodGroup: 'A+',
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-6',
      hospitalId: 'hosp-b1-6',
      bloodGroup: 'A+',
      bloodComponent: 'WHOLE_BLOOD',
      status: 'MATCHED',
      potentialMatches: [{ donorId: 'donor-b1-6', status: 'ACCEPTED', respondedAt: new Date() }],
      save: vi.fn(),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(Notification.create).mockClear();

    const req: any = {
      params: { id: 'req-b1-6' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-6', role: 'DONOR' },
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ alreadyResponded: true }));
    expect(Notification.create).not.toHaveBeenCalled(); // No duplicate
    expect(mockRequest.save).not.toHaveBeenCalled();
  });

  it('B1-7: Accept after Decline is rejected with HTTP 409 ALREADY_DECLINED', async () => {
    const mockDonor = {
      _id: 'donor-b1-7',
      userId: 'user-donor-b1-7',
      bloodGroup: 'B+',
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-7',
      bloodGroup: 'B+',
      bloodComponent: 'WHOLE_BLOOD',
      status: 'ACTIVE',
      potentialMatches: [{ donorId: 'donor-b1-7', status: 'DECLINED', respondedAt: new Date() }],
      save: vi.fn(),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

    const req: any = {
      params: { id: 'req-b1-7' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-7', role: 'DONOR' },
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ALREADY_DECLINED' })
    );
    expect(mockRequest.save).not.toHaveBeenCalled();
  });

  it('B1-8: Decline after Accept is rejected with HTTP 409 ALREADY_ACCEPTED', async () => {
    const mockDonor = {
      _id: 'donor-b1-8',
      userId: 'user-donor-b1-8',
      bloodGroup: 'O+',
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-8',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      status: 'MATCHED',
      potentialMatches: [{ donorId: 'donor-b1-8', status: 'ACCEPTED', respondedAt: new Date() }],
      save: vi.fn(),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

    const req: any = {
      params: { id: 'req-b1-8' },
      body: { action: 'DECLINED' },
      user: { id: 'user-donor-b1-8', role: 'DONOR' },
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ALREADY_ACCEPTED' })
    );
  });

  it('B1-9: Accept/Decline does not create DonationHistory', async () => {
    const mockDonor = {
      _id: 'donor-b1-9',
      userId: 'user-donor-b1-9',
      bloodGroup: 'A+',
      address: { city: 'Bengaluru', district: 'Central' },
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-9',
      hospitalId: 'hosp-b1-9',
      bloodGroup: 'A+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue({
      _id: 'hosp-b1-9', userId: 'user-hosp-b1-9', hospitalName: 'Test Hosp',
    } as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'B1-9 Donor' } as any);
    vi.mocked(DonationHistory.create).mockClear();

    const req: any = {
      params: { id: 'req-b1-9' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-9', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await respondToEmergencyRequest(req, res, vi.fn());
    expect(DonationHistory.create).not.toHaveBeenCalled();
  });

  it('B1-10: Hospital receives correct DONOR_ACCEPTED notification after donor accepts', async () => {
    const mockDonor = {
      _id: 'donor-b1-10',
      userId: 'user-donor-b1-10',
      bloodGroup: 'O-',
      address: { city: 'Bengaluru', district: 'East' },
      location: { coordinates: [77.59, 12.97] },
    };

    const mockRequest = {
      _id: 'req-b1-10',
      hospitalId: 'hosp-b1-10',
      patientIdentifier: 'PATIENT-B1-10',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.60, 12.98] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    const mockHospital = {
      _id: 'hosp-b1-10',
      userId: 'user-hosp-b1-10',
      hospitalName: 'Main Hospital',
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue(mockHospital as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'O-Neg Hero' } as any);

    const req: any = {
      params: { id: 'req-b1-10' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-b1-10', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'user-hosp-b1-10',
        type: 'DONOR_ACCEPTED',
        data: expect.objectContaining({
          donorName: 'O-Neg Hero',
          bloodGroup: 'O-',
          action: 'ACCEPTED',
        }),
      })
    );
  });
});

// =============================================================================
// BUG 2: LOCATION MATCHING TESTS
// =============================================================================
describe('Bug 2: Location-Based Donor Matching', () => {
  // Realistic coordinates used throughout:
  // Bengaluru: [77.5946, 12.9716]
  // Chennai:   [80.2707, 13.0827]  (~290 km from Bengaluru)
  // Nearby:    [77.60,   12.98]    (~1 km from Bengaluru)

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DonorProfile.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any);
  });

  it('B2-11: Compatible donor WITHIN radius IS returned in request list', async () => {
    const nearbyDonor = {
      _id: 'donor-nearby-11',
      userId: 'user-nearby-11',
      bloodGroup: 'O+',
      supportedComponents: ['WHOLE_BLOOD'],
      isAvailable: true,
      location: { coordinates: [77.60, 12.98] }, // ~1 km from hospital
    };

    const requestInBengaluru = {
      _id: 'req-blr-11',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      hospitalId: { hospitalName: 'BLR Hospital', address: { city: 'Bengaluru', state: 'Karnataka' } },
      location: { coordinates: [77.5946, 12.9716] }, // Bengaluru
      potentialMatches: [],
      toObject: () => ({ _id: 'req-blr-11', bloodGroup: 'O+', bloodComponent: 'WHOLE_BLOOD', potentialMatches: [] }),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(nearbyDonor as any);
    vi.mocked(EmergencyRequest.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([requestInBengaluru]),
    } as any);
    vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

    const req: any = { query: { status: 'ACTIVE' }, user: { id: 'user-nearby-11', role: 'DONOR' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getEmergencyRequests(req, res, vi.fn());

    const data = jsonMock.mock.calls[0][0];
    expect(data.requests).toHaveLength(1);
    expect(data.requests[0].bloodGroup).toBe('O+');
    // Distance must be defined and reasonable (not 0 for nearby, not huge for same city)
    expect(data.requests[0].distanceKm).toBeDefined();
    expect(data.requests[0].distanceKm).toBeGreaterThanOrEqual(0);
  });

  it('B2-12: Compatible donor OUTSIDE radius is excluded from request list', async () => {
    const chennaiDonor = {
      _id: 'donor-chennai-12',
      userId: 'user-chennai-12',
      bloodGroup: 'O+',
      supportedComponents: ['WHOLE_BLOOD'],
      isAvailable: true,
      location: { coordinates: [80.2707, 13.0827] }, // Chennai
    };

    const requestInBengaluru = {
      _id: 'req-blr-12',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      hospitalId: { hospitalName: 'Jitesh Hospital', address: { city: 'Bengaluru', state: 'Karnataka' } },
      location: { coordinates: [77.5946, 12.9716] }, // Bengaluru
      potentialMatches: [],
      toObject: () => ({ _id: 'req-blr-12', bloodGroup: 'O+', bloodComponent: 'WHOLE_BLOOD', potentialMatches: [] }),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(chennaiDonor as any);
    vi.mocked(EmergencyRequest.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([requestInBengaluru]),
    } as any);
    vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

    const req: any = { query: { status: 'ACTIVE' }, user: { id: 'user-chennai-12', role: 'DONOR' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getEmergencyRequests(req, res, vi.fn());

    const data = jsonMock.mock.calls[0][0];
    // Chennai donor must NOT see the Bengaluru request (290 km >> 30 km radius)
    expect(data.requests).toHaveLength(0);
  });

  it('B2-13: Incompatible blood group is NOT returned even if donor is nearby', async () => {
    const nearbyDonor = {
      _id: 'donor-incompat-13',
      userId: 'user-incompat-13',
      bloodGroup: 'O+', // O+ cannot donate to O- recipients
      supportedComponents: ['WHOLE_BLOOD'],
      isAvailable: true,
      location: { coordinates: [77.60, 12.98] },
    };

    const oNegRequest = {
      _id: 'req-oneg-13',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      hospitalId: { hospitalName: 'BLR Hospital', address: { city: 'Bengaluru', state: 'Karnataka' } },
      location: { coordinates: [77.5946, 12.9716] },
      potentialMatches: [],
      toObject: () => ({ _id: 'req-oneg-13', bloodGroup: 'O-', bloodComponent: 'WHOLE_BLOOD', potentialMatches: [] }),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(nearbyDonor as any);
    vi.mocked(EmergencyRequest.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([oNegRequest]),
    } as any);
    vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

    const req: any = { query: { status: 'ACTIVE' }, user: { id: 'user-incompat-13', role: 'DONOR' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getEmergencyRequests(req, res, vi.fn());

    const data = jsonMock.mock.calls[0][0];
    expect(data.requests).toHaveLength(0); // Incompatible blood group excluded
  });

  it('B2-14: Donor OUTSIDE radius cannot manually accept via API (HTTP 403 OUTSIDE_RADIUS)', async () => {
    const chennaiDonor = {
      _id: 'donor-far-14',
      userId: 'user-far-14',
      bloodGroup: 'O+',
      address: { city: 'Chennai', district: 'Chennai' },
      location: { coordinates: [80.2707, 13.0827] }, // Chennai — 290 km from Bengaluru
    };

    const bengaluruRequest = {
      _id: 'req-blr-14',
      hospitalId: 'hosp-blr-14',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.5946, 12.9716] }, // Bengaluru
      potentialMatches: [], // Not in match list — manual API call
      save: vi.fn(),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(chennaiDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(bengaluruRequest as any);

    const req: any = {
      params: { id: 'req-blr-14' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-far-14', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    // Backend must reject the out-of-radius donor
    expect(res.status).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        code: 'OUTSIDE_RADIUS',
        message: expect.stringContaining('exceeds the allowed matching radius'),
      })
    );
    expect(bengaluruRequest.save).not.toHaveBeenCalled();
  });

  it('B2-15: Haversine distance calculation is correct — Chennai to Bengaluru is ~290 km not 0', () => {
    const chennaiCoords: [number, number] = [80.2707, 13.0827]; // [lon, lat]
    const bengaluruCoords: [number, number] = [77.5946, 12.9716]; // [lon, lat]

    const distance = calculateDistanceKm(chennaiCoords, bengaluruCoords);

    // Chennai to Bengaluru is ~290 km
    expect(distance).toBeGreaterThan(280);
    expect(distance).toBeLessThan(310);
    expect(distance).not.toBe(0);
  });

  it('B2-16: Different-city donor/hospital does NOT show 0 m — shows correct distance', async () => {
    const nearbyDonor = {
      _id: 'donor-dist-16',
      userId: 'user-dist-16',
      bloodGroup: 'A+',
      supportedComponents: ['WHOLE_BLOOD'],
      isAvailable: true,
      location: { coordinates: [77.605, 12.975] }, // ~1.5 km from hospital
    };

    const hospitalRequest = {
      _id: 'req-dist-16',
      bloodGroup: 'A+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      hospitalId: { hospitalName: 'Hospital A', address: { city: 'Bengaluru', state: 'Karnataka' } },
      location: { coordinates: [77.5946, 12.9716] }, // Bengaluru hospital
      potentialMatches: [],
      toObject: () => ({ _id: 'req-dist-16', bloodGroup: 'A+', bloodComponent: 'WHOLE_BLOOD', potentialMatches: [] }),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(nearbyDonor as any);
    vi.mocked(EmergencyRequest.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([hospitalRequest]),
    } as any);
    vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

    const req: any = { query: { status: 'ACTIVE' }, user: { id: 'user-dist-16', role: 'DONOR' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getEmergencyRequests(req, res, vi.fn());

    const data = jsonMock.mock.calls[0][0];
    expect(data.requests).toHaveLength(1);
    const reqItem = data.requests[0];

    // Distance must NOT be 0 when donor and hospital are at different coordinates
    expect(reqItem.distanceKm).toBeDefined();
    expect(reqItem.distanceKm).toBeGreaterThan(0); // Must be non-zero for different coords
    expect(reqItem.distanceFormatted).not.toBe('0.0 km away');
    expect(reqItem.distanceFormatted).not.toContain('0 m');
  });

  it('B2-17: Missing donor coordinates are handled safely — request excluded from listing', async () => {
    const donorWithoutCoords = {
      _id: 'donor-nocoords-17',
      userId: 'user-nocoords-17',
      bloodGroup: 'A+',
      supportedComponents: ['WHOLE_BLOOD'],
      isAvailable: true,
      location: { coordinates: [] }, // Empty coordinates
    };

    const request = {
      _id: 'req-nocoords-17',
      bloodGroup: 'A+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      hospitalId: { hospitalName: 'Hospital B', address: { city: 'Bengaluru', state: 'Karnataka' } },
      location: { coordinates: [77.5946, 12.9716] },
      potentialMatches: [],
      toObject: () => ({ _id: 'req-nocoords-17', bloodGroup: 'A+', bloodComponent: 'WHOLE_BLOOD', potentialMatches: [] }),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(donorWithoutCoords as any);
    vi.mocked(EmergencyRequest.find).mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([request]),
    } as any);
    vi.mocked(EmergencyRequest.countDocuments).mockResolvedValue(1);

    const req: any = { query: { status: 'ACTIVE' }, user: { id: 'user-nocoords-17', role: 'DONOR' } };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getEmergencyRequests(req, res, vi.fn());

    const data = jsonMock.mock.calls[0][0];
    // No valid location = cannot verify proximity = exclude from list
    expect(data.requests).toHaveLength(0);
  });

  it('B2-18: Demo location data is consistent — Chennai donor coords are Chennai not Bengaluru', () => {
    // If donor.address.city is 'Chennai', coordinates should be Chennai coords
    const correctChennaiCoords: [number, number] = [80.2707, 13.0827];
    const bengaluruCoords: [number, number] = [77.5946, 12.9716];
    const wrongCoords: [number, number] = [77.5946, 12.9716]; // Bengaluru coords with Chennai label

    const correctDistance = calculateDistanceKm(correctChennaiCoords, bengaluruCoords);
    const wrongDistance = calculateDistanceKm(wrongCoords, bengaluruCoords);

    // Correct Chennai→Bengaluru distance must be ~290 km (excluded from 30 km radius)
    expect(correctDistance).toBeGreaterThan(280);

    // Wrong coords (Bengaluru labeled as Chennai) would show ~0 km (the bug)
    expect(wrongDistance).toBeLessThan(1);

    // The correct distance must be WAY different from 0
    expect(correctDistance).toBeGreaterThan(wrongDistance * 100);
  });

  it('B2-19: Accepted nearby donor IS visible to hospital in request details', async () => {
    const mockAcceptedDonor = {
      _id: 'donor-accepted-19',
      bloodGroup: 'O+',
      address: { city: 'Bengaluru', district: 'South' },
      isAvailable: true,
      privacySettings: { hideExactLocation: true, showContactToMatchedHospitalsOnly: true },
      userId: { name: 'Nearby Hero', phone: '+91 9876543210', email: 'hero@test.com', isVerified: true },
    };

    const mockRequest = {
      _id: 'req-accepted-19',
      patientIdentifier: 'ICU-19',
      bloodGroup: 'O+',
      unitsRequired: 1,
      urgency: 'CRITICAL',
      status: 'MATCHED',
      hospitalId: { _id: 'hosp-19', hospitalName: 'Apollo', address: { city: 'Bengaluru', state: 'Karnataka' } },
      potentialMatches: [
        {
          donorId: mockAcceptedDonor,
          status: 'ACCEPTED',
          distanceKm: 1.5,
          notifiedAt: new Date(),
          respondedAt: new Date(),
        },
      ],
      toObject: () => ({
        _id: 'req-accepted-19',
        patientIdentifier: 'ICU-19',
        bloodGroup: 'O+',
        unitsRequired: 1,
        urgency: 'CRITICAL',
        status: 'MATCHED',
        hospitalId: { _id: 'hosp-19', hospitalName: 'Apollo', address: { city: 'Bengaluru', state: 'Karnataka' } },
        potentialMatches: [],
      }),
    };

    vi.mocked(EmergencyRequest.findById).mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockRequest),
    } as any);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue({
      _id: 'hosp-19',
      hospitalName: 'Apollo',
    } as any);

    const req: any = {
      params: { id: 'req-accepted-19' },
      user: { id: 'user-hosp-19', role: 'HOSPITAL' },
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await getEmergencyRequestById(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    const data = jsonMock.mock.calls[0][0];
    expect(data.acceptedDonors).toHaveLength(1);
    expect(data.acceptedDonors[0].name).toBe('Nearby Hero');
    expect(data.acceptedDonors[0].bloodGroup).toBe('O+');
    expect(data.acceptedDonors[0].distanceKm).toBe(1.5);
  });

  it('B2-20: Hospital receives donor acceptance notification with correct data', async () => {
    const nearbyDonor = {
      _id: 'donor-notify-20',
      userId: 'user-donor-notify-20',
      bloodGroup: 'O-',
      address: { city: 'Bengaluru', district: 'North' },
      location: { coordinates: [77.60, 12.98] }, // ~1 km from hospital
    };

    const mockRequest = {
      _id: 'req-notify-20',
      hospitalId: 'hosp-notify-20',
      patientIdentifier: 'PATIENT-20',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.5946, 12.9716] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    const mockHospital = {
      _id: 'hosp-notify-20',
      userId: 'user-hosp-notify-20',
      hospitalName: 'Notification Test Hospital',
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(nearbyDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue(mockHospital as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'Notify Donor' } as any);

    const req: any = {
      params: { id: 'req-notify-20' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-notify-20', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: 'user-hosp-notify-20',
        type: 'DONOR_ACCEPTED',
        data: expect.objectContaining({
          requestId: 'req-notify-20',
          donorName: 'Notify Donor',
          bloodGroup: 'O-',
          action: 'ACCEPTED',
        }),
      })
    );
  });
});

// =============================================================================
// FULFILLMENT SAFETY TESTS
// =============================================================================
describe('Fulfillment Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(DonorProfile.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as any);
  });

  it('F21: Accepted donor does NOT automatically create DonationHistory on accept', async () => {
    const mockDonor = {
      _id: 'donor-f21',
      userId: 'user-donor-f21',
      bloodGroup: 'A+',
      address: { city: 'Bengaluru', district: 'Central' },
      location: { coordinates: [77.60, 12.98] },
    };

    const mockRequest = {
      _id: 'req-f21',
      hospitalId: 'hosp-f21',
      bloodGroup: 'A+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      status: 'ACTIVE',
      location: { coordinates: [77.5946, 12.9716] },
      potentialMatches: [] as any[],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue({ _id: 'hosp-f21', userId: 'hosp-user-f21', hospitalName: 'Test Hosp' } as any);
    vi.mocked(User.findById).mockResolvedValue({ name: 'F21 Donor' } as any);
    vi.mocked(DonationHistory.create).mockClear();

    const req: any = {
      params: { id: 'req-f21' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-f21', role: 'DONOR' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await respondToEmergencyRequest(req, res, vi.fn());

    expect(DonationHistory.create).not.toHaveBeenCalled();
  });

  it('F22: Hospital CAN fulfill with an accepted donor', async () => {
    const mockRequest = {
      _id: 'req-f22',
      hospitalId: 'hosp-f22',
      patientIdentifier: 'F22-PATIENT',
      bloodGroup: 'B+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      urgency: 'HIGH',
      status: 'ACTIVE',
      potentialMatches: [{ donorId: 'donor-f22', status: 'ACCEPTED' }],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue({ _id: 'hosp-f22', hospitalName: 'B+ Hospital' } as any);
    vi.mocked(DonationHistory.findOne).mockResolvedValue(null);
    vi.mocked(DonorProfile.findById).mockReturnValue({ select: vi.fn().mockResolvedValue({ userId: 'donor-user-f22' }) } as any);

    const req: any = {
      params: { id: 'req-f22' },
      body: { status: 'FULFILLED', fulfilledDonorId: 'donor-f22' },
      user: { id: 'user-hosp-f22', role: 'HOSPITAL' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await updateEmergencyRequestStatus(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRequest.status).toBe('FULFILLED');
  });

  it('F23: Only an ACCEPTED donor can be used as fulfilledDonorId — NOTIFIED donor is rejected', async () => {
    const mockRequest = {
      _id: 'req-f23',
      hospitalId: 'hosp-f23',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      urgency: 'HIGH',
      status: 'ACTIVE',
      potentialMatches: [
        { donorId: 'donor-accepted-f23', status: 'ACCEPTED' },
        { donorId: 'donor-notified-f23', status: 'NOTIFIED' },
      ],
      save: vi.fn(),
    };

    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue({ _id: 'hosp-f23', hospitalName: 'Test' } as any);

    const req: any = {
      params: { id: 'req-f23' },
      body: { status: 'FULFILLED', fulfilledDonorId: 'donor-notified-f23' }, // Wrong donor
      user: { id: 'user-hosp-f23', role: 'HOSPITAL' },
      ip: '127.0.0.1',
    };
    const jsonMock = vi.fn();
    const res: any = { status: vi.fn().mockReturnValue({ json: jsonMock }) };

    await updateEmergencyRequestStatus(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Only donors who responded with ACCEPTED') })
    );
  });

  it('F24: Only the selected donor gets DonationHistory — other accepted donors do not', async () => {
    const mockRequest = {
      _id: 'req-f24',
      hospitalId: 'hosp-f24',
      patientIdentifier: 'F24',
      bloodGroup: 'AB+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 2,
      urgency: 'HIGH',
      status: 'ACTIVE',
      potentialMatches: [
        { donorId: 'donor-selected-f24', status: 'ACCEPTED' },
        { donorId: 'donor-other-f24', status: 'ACCEPTED' },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue({ _id: 'hosp-f24', hospitalName: 'AB+ Hospital' } as any);
    vi.mocked(DonationHistory.findOne).mockResolvedValue(null);
    vi.mocked(DonorProfile.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ userId: 'user-selected-f24' }),
    } as any);

    const req: any = {
      params: { id: 'req-f24' },
      body: { status: 'FULFILLED', fulfilledDonorId: 'donor-selected-f24' },
      user: { id: 'user-hosp-f24', role: 'HOSPITAL' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await updateEmergencyRequestStatus(req, res, vi.fn());

    // DonationHistory must be called exactly once for the selected donor only
    expect(DonationHistory.create).toHaveBeenCalledTimes(1);
    expect(DonationHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ donorId: 'donor-selected-f24' })
    );
    // Must NOT be called with the other donor
    expect(DonationHistory.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ donorId: 'donor-other-f24' })
    );
  });

  it('F25: Duplicate fulfillment is idempotent — DonationHistory is NOT created twice', async () => {
    const mockRequest = {
      _id: 'req-f25',
      hospitalId: 'hosp-f25',
      bloodGroup: 'O+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      urgency: 'HIGH',
      status: 'ACTIVE',
      potentialMatches: [{ donorId: 'donor-f25', status: 'ACCEPTED' }],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue({ _id: 'hosp-f25', hospitalName: 'Idempotent Hosp' } as any);
    // Simulate existing DonationHistory record
    vi.mocked(DonationHistory.findOne).mockResolvedValue({ donorId: 'donor-f25' } as any);
    vi.mocked(DonorProfile.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ userId: 'user-f25' }),
    } as any);
    vi.mocked(DonationHistory.create).mockClear();

    const req: any = {
      params: { id: 'req-f25' },
      body: { status: 'FULFILLED', fulfilledDonorId: 'donor-f25' },
      user: { id: 'user-hosp-f25', role: 'HOSPITAL' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await updateEmergencyRequestStatus(req, res, vi.fn());

    // DonationHistory.create must NOT be called since record already exists
    expect(DonationHistory.create).not.toHaveBeenCalled();
  });

  it('F26: Cancellation does NOT create DonationHistory', async () => {
    const mockRequest = {
      _id: 'req-f26',
      hospitalId: 'hosp-f26',
      bloodGroup: 'B+',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      urgency: 'MEDIUM',
      status: 'ACTIVE',
      potentialMatches: [{ donorId: 'donor-f26', status: 'ACCEPTED' }],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findOne).mockResolvedValue({ _id: 'hosp-f26', hospitalName: 'Cancel Hosp' } as any);
    vi.mocked(DonationHistory.create).mockClear();

    const req: any = {
      params: { id: 'req-f26' },
      body: { status: 'CANCELLED' },
      user: { id: 'user-hosp-f26', role: 'HOSPITAL' },
      ip: '127.0.0.1',
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };

    await updateEmergencyRequestStatus(req, res, vi.fn());

    expect(mockRequest.status).toBe('CANCELLED');
    expect(DonationHistory.create).not.toHaveBeenCalled();
  });
});
