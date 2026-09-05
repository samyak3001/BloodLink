/**
 * Unit & Integration Tests — Blood Compatibility & Donor Acceptance Guard
 *
 * Validates:
 * 1. RBC ABO + Rh compatibility matrix for all recipient/donor pairs
 * 2. Specific test cases requested for ABO and Rh factor checks
 * 3. Graceful handling of invalid, null, or undefined inputs
 * 4. Controller-level rejection (HTTP 400 BLOOD_INCOMPATIBLE) on incompatible acceptance attempts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isBloodCompatible,
  getCompatibleDonorBloodGroups,
  RED_CELL_COMPATIBILITY,
} from '../config/bloodCompatibility';
import { respondToEmergencyRequest } from '../controllers/donorController';
import type { BloodGroup, BloodComponent } from '../types';

describe('RBC ABO + Rh Blood Compatibility Rules', () => {
  const allGroups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  describe('Recipient O-', () => {
    it('accepts ONLY O- donor', () => {
      expect(isBloodCompatible('O-', 'O-')).toBe(true);
      const incompatible: BloodGroup[] = ['O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'O-')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('O-')).toEqual(['O-']);
    });
  });

  describe('Recipient O+', () => {
    it('accepts O+ or O- donor only', () => {
      expect(isBloodCompatible('O-', 'O+')).toBe(true);
      expect(isBloodCompatible('O+', 'O+')).toBe(true);
      const incompatible: BloodGroup[] = ['A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'O+')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('O+')).toEqual(['O-', 'O+']);
    });
  });

  describe('Recipient A-', () => {
    it('accepts A- or O- donor only', () => {
      expect(isBloodCompatible('O-', 'A-')).toBe(true);
      expect(isBloodCompatible('A-', 'A-')).toBe(true);
      const incompatible: BloodGroup[] = ['O+', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'A-')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('A-')).toEqual(['O-', 'A-']);
    });
  });

  describe('Recipient A+', () => {
    it('accepts A+, A-, O+, O- donor only', () => {
      const compatible: BloodGroup[] = ['O-', 'O+', 'A-', 'A+'];
      for (const donor of compatible) {
        expect(isBloodCompatible(donor, 'A+')).toBe(true);
      }
      const incompatible: BloodGroup[] = ['B-', 'B+', 'AB-', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'A+')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('A+')).toEqual(compatible);
    });
  });

  describe('Recipient B-', () => {
    it('accepts B- or O- donor only', () => {
      expect(isBloodCompatible('O-', 'B-')).toBe(true);
      expect(isBloodCompatible('B-', 'B-')).toBe(true);
      const incompatible: BloodGroup[] = ['O+', 'B+', 'A-', 'A+', 'AB-', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'B-')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('B-')).toEqual(['O-', 'B-']);
    });
  });

  describe('Recipient B+', () => {
    it('accepts B+, B-, O+, O- donor only', () => {
      const compatible: BloodGroup[] = ['O-', 'O+', 'B-', 'B+'];
      for (const donor of compatible) {
        expect(isBloodCompatible(donor, 'B+')).toBe(true);
      }
      const incompatible: BloodGroup[] = ['A-', 'A+', 'AB-', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'B+')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('B+')).toEqual(compatible);
    });
  });

  describe('Recipient AB-', () => {
    it('accepts AB-, A-, B-, O- donor only', () => {
      const compatible: BloodGroup[] = ['O-', 'A-', 'B-', 'AB-'];
      for (const donor of compatible) {
        expect(isBloodCompatible(donor, 'AB-')).toBe(true);
      }
      const incompatible: BloodGroup[] = ['O+', 'A+', 'B+', 'AB+'];
      for (const donor of incompatible) {
        expect(isBloodCompatible(donor, 'AB-')).toBe(false);
      }
      expect(getCompatibleDonorBloodGroups('AB-')).toEqual(compatible);
    });
  });

  describe('Recipient AB+', () => {
    it('accepts all 8 donor groups (universal RBC recipient)', () => {
      for (const donor of allGroups) {
        expect(isBloodCompatible(donor, 'AB+')).toBe(true);
      }
      expect(getCompatibleDonorBloodGroups('AB+')).toEqual(allGroups);
    });
  });

  describe('Specific ABO + Rh Cross-Checks', () => {
    it('O+ donor -> O- request = REJECT', () => {
      expect(isBloodCompatible('O+', 'O-')).toBe(false);
    });

    it('O- donor -> O- request = ACCEPT', () => {
      expect(isBloodCompatible('O-', 'O-')).toBe(true);
    });

    it('O- donor -> O+ request = ACCEPT', () => {
      expect(isBloodCompatible('O-', 'O+')).toBe(true);
    });

    it('O+ donor -> O+ request = ACCEPT', () => {
      expect(isBloodCompatible('O+', 'O+')).toBe(true);
    });

    it('A+ donor -> A- request = REJECT', () => {
      expect(isBloodCompatible('A+', 'A-')).toBe(false);
    });

    it('A- donor -> A+ request = ACCEPT', () => {
      expect(isBloodCompatible('A-', 'A+')).toBe(true);
    });

    it('B+ donor -> B- request = REJECT', () => {
      expect(isBloodCompatible('B+', 'B-')).toBe(false);
    });

    it('B- donor -> B+ request = ACCEPT', () => {
      expect(isBloodCompatible('B-', 'B+')).toBe(true);
    });

    it('AB+ donor -> AB- request = REJECT', () => {
      expect(isBloodCompatible('AB+', 'AB-')).toBe(false);
    });

    it('AB- donor -> AB+ request = ACCEPT', () => {
      expect(isBloodCompatible('AB-', 'AB+')).toBe(true);
    });

    it('A+ donor -> B+ request = REJECT', () => {
      expect(isBloodCompatible('A+', 'B+')).toBe(false);
    });

    it('B+ donor -> A+ request = REJECT', () => {
      expect(isBloodCompatible('B+', 'A+')).toBe(false);
    });
  });

  describe('Defensive Input Handling', () => {
    it('returns false for null, undefined, or empty donor group', () => {
      expect(isBloodCompatible(null, 'O+')).toBe(false);
      expect(isBloodCompatible(undefined, 'O+')).toBe(false);
      expect(isBloodCompatible('' as any, 'O+')).toBe(false);
    });

    it('returns false for null, undefined, or empty recipient group', () => {
      expect(isBloodCompatible('O+', null)).toBe(false);
      expect(isBloodCompatible('O+', undefined)).toBe(false);
      expect(isBloodCompatible('O+', '' as any)).toBe(false);
    });

    it('returns false for unrecognized blood group strings', () => {
      expect(isBloodCompatible('C+', 'O+')).toBe(false);
      expect(isBloodCompatible('O+', 'UNKNOWN')).toBe(false);
      expect(isBloodCompatible('X-', 'Y+')).toBe(false);
    });

    it('handles red blood cell and whole blood components consistently', () => {
      expect(isBloodCompatible('O+', 'O-', 'WHOLE_BLOOD')).toBe(false);
      expect(isBloodCompatible('O+', 'O-', 'RED_CELLS')).toBe(false);
      expect(isBloodCompatible('O-', 'O-', 'WHOLE_BLOOD')).toBe(true);
      expect(isBloodCompatible('O-', 'O-', 'RED_CELLS')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Controller Integration: respondToEmergencyRequest rejection guard
// ---------------------------------------------------------------------------

// Mock Mongoose models used by donorController
vi.mock('../models/DonorProfile', () => ({
  DonorProfile: {
    findOne: vi.fn(),
  },
}));

vi.mock('../models/EmergencyRequest', () => ({
  EmergencyRequest: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/HospitalProfile', () => ({
  HospitalProfile: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/Notification', () => ({
  Notification: {
    create: vi.fn(),
  },
}));

vi.mock('../models/AuditLog', () => ({
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../models/User', () => ({
  User: {
    findById: vi.fn().mockResolvedValue({ name: 'Alex Donor' }),
  },
}));

vi.mock('../services/socketService', () => ({
  emitToUser: vi.fn(),
  emitEmergencyUpdate: vi.fn(),
  emitDonorResponse: vi.fn(),
  emitRequestUpdated: vi.fn(),
  pushUnreadCount: vi.fn(),
}));

import { DonorProfile } from '../models/DonorProfile';
import { EmergencyRequest } from '../models/EmergencyRequest';
import { HospitalProfile } from '../models/HospitalProfile';
import { Notification } from '../models/Notification';

describe('Controller Acceptance Guard — respondToEmergencyRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an O+ donor attempting to ACCEPT an O- emergency request with 400 BLOOD_INCOMPATIBLE', async () => {
    const mockDonor = {
      _id: 'donor-123',
      userId: 'user-donor-123',
      bloodGroup: 'O+',
      location: { coordinates: [77.209, 28.6139] },
    };

    const mockRequest = {
      _id: 'req-456',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.21, 28.614] },
      potentialMatches: [],
      save: vi.fn(),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);

    const req: any = {
      params: { id: 'req-456' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-123', role: 'DONOR' },
    };

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = {
      status: statusMock,
      json: jsonMock,
    };

    const next = vi.fn();
    await respondToEmergencyRequest(req, res, next);

    // Assert HTTP 400 with BLOOD_INCOMPATIBLE code
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        code: 'BLOOD_INCOMPATIBLE',
        message: expect.stringContaining('Incompatible blood groups'),
      })
    );

    // Ensure request was NOT saved and NO notification was created
    expect(mockRequest.save).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
    expect(mockRequest.potentialMatches).toHaveLength(0);
  });

  it('allows an O- donor to ACCEPT an O- emergency request', async () => {
    const mockDonor = {
      _id: 'donor-456',
      userId: 'user-donor-456',
      bloodGroup: 'O-',
      location: { coordinates: [77.209, 28.6139] },
    };

    const mockRequest = {
      _id: 'req-789',
      hospitalId: 'hosp-1',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.21, 28.614] },
      potentialMatches: [],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue({ userId: 'hosp-user-1' } as any);

    const req: any = {
      params: { id: 'req-789' },
      body: { action: 'ACCEPTED' },
      user: { id: 'user-donor-456', role: 'DONOR' },
    };

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = {
      status: statusMock,
      json: jsonMock,
    };
    const next = vi.fn();

    await respondToEmergencyRequest(req, res, next);

    // Should succeed with 200
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
      })
    );
    expect(mockRequest.save).toHaveBeenCalled();
    expect(mockRequest.potentialMatches[0]).toMatchObject({
      donorId: 'donor-456',
      status: 'ACCEPTED',
    });
  });

  it('allows an incompatible donor to DECLINE without compatibility error', async () => {
    const mockDonor = {
      _id: 'donor-999',
      userId: 'user-donor-999',
      bloodGroup: 'O+',
      location: { coordinates: [77.209, 28.6139] },
    };

    const mockRequest = {
      _id: 'req-999',
      hospitalId: 'hosp-1',
      bloodGroup: 'O-',
      bloodComponent: 'WHOLE_BLOOD',
      unitsRequired: 1,
      status: 'ACTIVE',
      location: { coordinates: [77.21, 28.614] },
      potentialMatches: [],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(DonorProfile.findOne).mockResolvedValue(mockDonor as any);
    vi.mocked(EmergencyRequest.findById).mockResolvedValue(mockRequest as any);
    vi.mocked(HospitalProfile.findById).mockResolvedValue({ userId: 'hosp-user-1' } as any);

    const req: any = {
      params: { id: 'req-999' },
      body: { action: 'DECLINED' },
      user: { id: 'user-donor-999', role: 'DONOR' },
    };

    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    const res: any = {
      status: statusMock,
      json: jsonMock,
    };
    const next = vi.fn();

    await respondToEmergencyRequest(req, res, next);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(mockRequest.potentialMatches[0].status).toBe('DECLINED');
    expect(Notification.create).not.toHaveBeenCalled();
  });
});
