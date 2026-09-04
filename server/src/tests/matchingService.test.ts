/**
 * Unit Tests — Blood Group Matching Service
 *
 * Tests the pure scoring and compatibility logic in matchingService.ts
 * and bloodCompatibility.ts without any database connection.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMatchScore,
  type MatchOptions,
} from '../services/matchingService';
import {
  getCompatibleDonorBloodGroups,
  isBloodCompatible,
  isExactMatch,
  isUniversalDonor,
} from '../config/bloodCompatibility';
import type { BloodGroup, BloodComponent } from '../types';

// ---------------------------------------------------------------------------
// Blood Compatibility Matrix Tests
// ---------------------------------------------------------------------------

describe('Blood Compatibility Matrix — Whole Blood / Red Cells', () => {
  const allGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  it('O- donor is compatible with ALL recipient groups (universal donor)', () => {
    for (const recipient of allGroups) {
      expect(
        isBloodCompatible('O-', recipient, 'WHOLE_BLOOD'),
        `O- should be compatible with ${recipient}`
      ).toBe(true);
    }
  });

  it('AB+ recipient accepts ALL donor groups (universal recipient)', () => {
    for (const donor of allGroups) {
      expect(
        isBloodCompatible(donor, 'AB+', 'WHOLE_BLOOD'),
        `${donor} should be compatible with AB+`
      ).toBe(true);
    }
  });

  it('O- recipient only accepts O- donors', () => {
    const compatible = getCompatibleDonorBloodGroups('O-', 'WHOLE_BLOOD');
    expect(compatible).toEqual(['O-']);
  });

  it('A+ recipient accepts O-, O+, A-, A+', () => {
    const compatible = getCompatibleDonorBloodGroups('A+', 'WHOLE_BLOOD');
    expect(compatible).toContain('O-');
    expect(compatible).toContain('O+');
    expect(compatible).toContain('A-');
    expect(compatible).toContain('A+');
    expect(compatible).not.toContain('B+');
    expect(compatible).not.toContain('AB+');
  });

  it('B+ recipient accepts O-, O+, B-, B+', () => {
    const compatible = getCompatibleDonorBloodGroups('B+', 'WHOLE_BLOOD');
    expect(compatible).toContain('O-');
    expect(compatible).toContain('O+');
    expect(compatible).toContain('B-');
    expect(compatible).toContain('B+');
    expect(compatible).not.toContain('A+');
    expect(compatible).not.toContain('AB-');
  });

  it('AB- recipient accepts O-, A-, B-, AB- (negative donors only)', () => {
    const compatible = getCompatibleDonorBloodGroups('AB-', 'WHOLE_BLOOD');
    expect(compatible).toContain('O-');
    expect(compatible).toContain('A-');
    expect(compatible).toContain('B-');
    expect(compatible).toContain('AB-');
    expect(compatible).not.toContain('O+');
    expect(compatible).not.toContain('A+');
  });

  it('O+ recipient accepts O- and O+ only', () => {
    const compatible = getCompatibleDonorBloodGroups('O+', 'WHOLE_BLOOD');
    expect(compatible).toEqual(expect.arrayContaining(['O-', 'O+']));
    expect(compatible).not.toContain('A+');
    expect(compatible).not.toContain('B+');
  });

  it('B- recipient only accepts O- and B-', () => {
    const compatible = getCompatibleDonorBloodGroups('B-', 'WHOLE_BLOOD');
    expect(compatible).toContain('O-');
    expect(compatible).toContain('B-');
    expect(compatible).not.toContain('B+');
    expect(compatible).not.toContain('O+');
  });

  it('A- recipient only accepts O- and A-', () => {
    const compatible = getCompatibleDonorBloodGroups('A-', 'WHOLE_BLOOD');
    expect(compatible).toContain('O-');
    expect(compatible).toContain('A-');
    expect(compatible).not.toContain('A+');
    expect(compatible).not.toContain('O+');
  });

  it('RED_CELLS uses same rules as WHOLE_BLOOD', () => {
    for (const recipient of ['A+', 'B-', 'O+'] as BloodGroup[]) {
      expect(getCompatibleDonorBloodGroups(recipient, 'RED_CELLS')).toEqual(
        getCompatibleDonorBloodGroups(recipient, 'WHOLE_BLOOD')
      );
    }
  });
});

describe('Blood Compatibility Matrix — Plasma', () => {
  it('AB+ / AB- are universal plasma donors (can donate to any recipient)', () => {
    const allGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    for (const recipient of allGroups) {
      expect(isBloodCompatible('AB+', recipient, 'PLASMA')).toBe(true);
      expect(isBloodCompatible('AB-', recipient, 'PLASMA')).toBe(true);
    }
  });

  it('O recipient can receive plasma from any donor group', () => {
    const allGroups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    for (const donor of allGroups) {
      expect(isBloodCompatible(donor, 'O-', 'PLASMA')).toBe(true);
      expect(isBloodCompatible(donor, 'O+', 'PLASMA')).toBe(true);
    }
  });

  it('A recipient can only receive plasma from A or AB donors', () => {
    const compatible = getCompatibleDonorBloodGroups('A+', 'PLASMA');
    expect(compatible).toContain('A-');
    expect(compatible).toContain('A+');
    expect(compatible).toContain('AB-');
    expect(compatible).toContain('AB+');
    expect(compatible).not.toContain('O-');
    expect(compatible).not.toContain('B+');
  });
});

describe('isExactMatch', () => {
  it('returns true when donor and recipient groups are identical', () => {
    expect(isExactMatch('A+', 'A+')).toBe(true);
    expect(isExactMatch('O-', 'O-')).toBe(true);
    expect(isExactMatch('AB-', 'AB-')).toBe(true);
  });

  it('returns false when groups differ', () => {
    expect(isExactMatch('A+', 'A-')).toBe(false);
    expect(isExactMatch('O-', 'AB+')).toBe(false);
  });
});

describe('isUniversalDonor', () => {
  it('O- is universal donor for whole blood and red cells', () => {
    expect(isUniversalDonor('O-', 'WHOLE_BLOOD')).toBe(true);
    expect(isUniversalDonor('O-', 'RED_CELLS')).toBe(true);
  });

  it('AB+ and AB- are universal plasma donors', () => {
    expect(isUniversalDonor('AB+', 'PLASMA')).toBe(true);
    expect(isUniversalDonor('AB-', 'PLASMA')).toBe(true);
  });

  it('O+ is not a universal whole blood donor', () => {
    expect(isUniversalDonor('O+', 'WHOLE_BLOOD')).toBe(false);
  });

  it('O- is not a universal plasma donor', () => {
    expect(isUniversalDonor('O-', 'PLASMA')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Match Scoring Tests
// ---------------------------------------------------------------------------

const baseMatchOptions: MatchOptions = {
  targetBloodGroup: 'A+',
  bloodComponent: 'WHOLE_BLOOD',
  urgency: 'HIGH',
  location: [80.27, 13.08], // Chennai
  maxRadiusKm: 30,
};

function buildDonor(overrides: Partial<{
  bloodGroup: BloodGroup;
  supportedComponents: BloodComponent[];
  isAvailable: boolean;
  hasNoRecentIllness: boolean;
  hasValidInterval: boolean;
}> = {}) {
  return {
    bloodGroup: overrides.bloodGroup ?? 'A+',
    supportedComponents: overrides.supportedComponents ?? ['WHOLE_BLOOD'],
    isAvailable: overrides.isAvailable ?? true,
    selfReportedScreening: {
      hasNoRecentIllness: overrides.hasNoRecentIllness ?? true,
      hasValidInterval: overrides.hasValidInterval ?? true,
    },
  };
}

describe('calculateMatchScore — Base Filtering', () => {
  it('returns score 0 when donor is unavailable', () => {
    const { score } = calculateMatchScore(
      buildDonor({ isAvailable: false }),
      5,
      baseMatchOptions
    );
    expect(score).toBe(0);
  });

  it('returns score 0 when donor does not support the requested component', () => {
    const { score } = calculateMatchScore(
      buildDonor({ supportedComponents: ['PLASMA'] }),
      5,
      baseMatchOptions
    );
    expect(score).toBe(0);
  });

  it('returns score 0 when donor is outside max radius', () => {
    const { score } = calculateMatchScore(buildDonor(), 50, baseMatchOptions); // 50km > 30km
    expect(score).toBe(0);
  });
});

describe('calculateMatchScore — Blood Group Scoring', () => {
  it('exact match receives 35 blood-group points', () => {
    const { score, isExact } = calculateMatchScore(
      buildDonor({ bloodGroup: 'A+' }),
      2, // very close — max proximity
      baseMatchOptions
    );
    expect(isExact).toBe(true);
    // 35 (blood) + 50 (proximity <=5km) + 10 (HIGH urgency <=15km) = 95
    expect(score).toBe(95);
  });

  it('universal O- donor (non-exact) receives 30 blood-group points', () => {
    const { score, isExact } = calculateMatchScore(
      buildDonor({ bloodGroup: 'O-' }),
      2,
      baseMatchOptions
    );
    expect(isExact).toBe(false);
    // 30 (universal) + 50 (proximity) + 10 (HIGH urgency) = 90
    expect(score).toBe(90);
  });

  it('compatible non-universal donor receives 25 blood-group points', () => {
    // O+ is compatible with A+ (not exact, not universal for whole blood)
    const { score } = calculateMatchScore(
      buildDonor({ bloodGroup: 'O+' }),
      2,
      baseMatchOptions
    );
    // 25 (compatible) + 50 (proximity) + 10 (HIGH) = 85
    expect(score).toBe(85);
  });
});

describe('calculateMatchScore — Proximity Scoring', () => {
  it('donor within 5km receives full 50 proximity points', () => {
    const { score } = calculateMatchScore(buildDonor(), 3, baseMatchOptions);
    // 35 + 50 + 10 = 95
    expect(score).toBe(95);
  });

  it('donor at maxRadius boundary receives minimum proximity points', () => {
    const { score } = calculateMatchScore(buildDonor(), 30, baseMatchOptions);
    // 35 blood + 10 (min proximity at edge) + 5 (HIGH, 30km > 15km) = 50
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(95);
  });

  it('total score is clamped between 1 and 100', () => {
    const { score } = calculateMatchScore(buildDonor(), 1, {
      ...baseMatchOptions,
      urgency: 'CRITICAL',
    });
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateMatchScore — Urgency Scoring', () => {
  it('CRITICAL urgency donor within 10km receives +15 urgency points', () => {
    const criticalOptions: MatchOptions = {
      ...baseMatchOptions,
      urgency: 'CRITICAL',
    };
    const { score: critScore } = calculateMatchScore(buildDonor(), 5, criticalOptions);
    const { score: highScore } = calculateMatchScore(buildDonor(), 5, {
      ...baseMatchOptions,
      urgency: 'HIGH',
    });
    // CRITICAL at <=10km: +15 vs HIGH at <=15km: +10
    expect(critScore).toBeGreaterThan(highScore);
  });

  it('MEDIUM urgency always receives only +5 urgency points', () => {
    const { score: medScore } = calculateMatchScore(buildDonor(), 3, {
      ...baseMatchOptions,
      urgency: 'MEDIUM',
    });
    const { score: highScore } = calculateMatchScore(buildDonor(), 3, baseMatchOptions);
    expect(medScore).toBeLessThan(highScore);
  });
});

describe('calculateMatchScore — Self-Reported Screening', () => {
  it('includes informational readiness reason when both screening flags are true', () => {
    const { reasons } = calculateMatchScore(
      buildDonor({ hasNoRecentIllness: true, hasValidInterval: true }),
      3,
      baseMatchOptions
    );
    expect(reasons.some((r) => r.toLowerCase().includes('self-reported'))).toBe(true);
  });

  it('does not include readiness reason when screening is incomplete', () => {
    const { reasons } = calculateMatchScore(
      buildDonor({ hasNoRecentIllness: false, hasValidInterval: true }),
      3,
      baseMatchOptions
    );
    expect(reasons.some((r) => r.toLowerCase().includes('self-reported'))).toBe(false);
  });
});
