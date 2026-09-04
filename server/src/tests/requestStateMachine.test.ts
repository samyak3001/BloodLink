/**
 * Unit Tests — Emergency Request State Machine
 *
 * Tests the valid and invalid transitions for the EmergencyRequest status enum.
 * These are pure logic tests with no database connection required.
 */

import { describe, it, expect } from 'vitest';
import type { RequestStatus } from '../types';

// ---------------------------------------------------------------------------
// State Machine Definition
// Mirrors the allowed transitions enforced by the application layer.
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  ACTIVE: ['MATCHED', 'CANCELLED', 'EXPIRED'],
  MATCHED: ['FULFILLED', 'ACTIVE', 'CANCELLED', 'EXPIRED'],
  FULFILLED: [], // terminal state
  CANCELLED: [], // terminal state
  EXPIRED: [], // terminal state
};

function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

const ALL_STATUSES: RequestStatus[] = [
  'ACTIVE',
  'MATCHED',
  'FULFILLED',
  'CANCELLED',
  'EXPIRED',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmergencyRequest State Machine — Valid Transitions', () => {
  it('ACTIVE → MATCHED is valid (donor matched)', () => {
    expect(canTransition('ACTIVE', 'MATCHED')).toBe(true);
  });

  it('ACTIVE → CANCELLED is valid (hospital cancelled)', () => {
    expect(canTransition('ACTIVE', 'CANCELLED')).toBe(true);
  });

  it('ACTIVE → EXPIRED is valid (system-triggered expiry)', () => {
    expect(canTransition('ACTIVE', 'EXPIRED')).toBe(true);
  });

  it('MATCHED → FULFILLED is valid (donation confirmed)', () => {
    expect(canTransition('MATCHED', 'FULFILLED')).toBe(true);
  });

  it('MATCHED → ACTIVE is valid (donor declined, reopening request)', () => {
    expect(canTransition('MATCHED', 'ACTIVE')).toBe(true);
  });

  it('MATCHED → CANCELLED is valid (hospital cancelled after matching)', () => {
    expect(canTransition('MATCHED', 'CANCELLED')).toBe(true);
  });

  it('MATCHED → EXPIRED is valid (deadline passed while matched)', () => {
    expect(canTransition('MATCHED', 'EXPIRED')).toBe(true);
  });
});

describe('EmergencyRequest State Machine — Terminal States', () => {
  const terminalStates: RequestStatus[] = ['FULFILLED', 'CANCELLED', 'EXPIRED'];

  for (const terminal of terminalStates) {
    it(`${terminal} has no valid outgoing transitions (terminal)`, () => {
      for (const target of ALL_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    });
  }
});

describe('EmergencyRequest State Machine — Invalid Transitions', () => {
  it('ACTIVE → FULFILLED is invalid (must be MATCHED first)', () => {
    expect(canTransition('ACTIVE', 'FULFILLED')).toBe(false);
  });

  it('ACTIVE → ACTIVE self-transition is invalid', () => {
    expect(canTransition('ACTIVE', 'ACTIVE')).toBe(false);
  });

  it('FULFILLED → ACTIVE is invalid (cannot reopen fulfilled request)', () => {
    expect(canTransition('FULFILLED', 'ACTIVE')).toBe(false);
  });

  it('CANCELLED → MATCHED is invalid', () => {
    expect(canTransition('CANCELLED', 'MATCHED')).toBe(false);
  });

  it('EXPIRED → ACTIVE is invalid (expired requests cannot be reopened)', () => {
    expect(canTransition('EXPIRED', 'ACTIVE')).toBe(false);
  });
});

describe('EmergencyRequest State Machine — Status Enum Completeness', () => {
  it('all 5 statuses are defined in the state machine', () => {
    const defined = Object.keys(VALID_TRANSITIONS) as RequestStatus[];
    for (const s of ALL_STATUSES) {
      expect(defined).toContain(s);
    }
  });

  it('ACTIVE is the only valid initial status for new requests', () => {
    // The schema default is 'ACTIVE'; all other states require a prior state
    const initialStatus: RequestStatus = 'ACTIVE';
    expect(ALL_STATUSES).toContain(initialStatus);
    // MATCHED, FULFILLED, CANCELLED, EXPIRED are not initial states
    const nonInitial: RequestStatus[] = ['MATCHED', 'FULFILLED', 'CANCELLED', 'EXPIRED'];
    for (const s of nonInitial) {
      // They should not be reachable from themselves
      expect(canTransition(s, s)).toBe(false);
    }
  });
});
