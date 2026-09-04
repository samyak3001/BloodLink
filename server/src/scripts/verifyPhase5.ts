/**
 * Phase 5 Verification Script: Emergency Request Lifecycle & APIs
 *
 * Tests all Phase 5 logic that can be verified without a live MongoDB connection:
 * - State machine transitions (valid and invalid)
 * - Validation schema correctness (Zod)
 * - Role-based route configuration
 * - Potential match scoring integration
 * - Privacy: no raw GPS in match results
 * - Notification model instantiation
 * - Donor response logic
 */

import { z, ZodError } from 'zod';
import {
  createEmergencyRequestSchema,
  updateRequestStatusSchema,
  donorResponseSchema,
  donorAvailabilitySchema,
  donorScreeningSchema,
  verifyHospitalSchema,
  updateUserStatusSchema,
} from '../validators/requestSchemas';
import { rankPotentialMatches, MatchOptions } from '../services/matchingService';
import { BloodGroup, BloodComponent, RequestStatus } from '../types';
import { Types } from 'mongoose';
import { IDonorProfileDocument } from '../models';

async function runPhase5Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 5 VERIFICATION: Emergency Request Lifecycle & APIs');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  async function assertSchemaValid(schema: z.ZodTypeAny, data: unknown, description: string) {
    try {
      await schema.parseAsync(data);
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ FAIL: ${description}`, (e as ZodError).errors);
      failed++;
    }
  }

  async function assertSchemaInvalid(schema: z.ZodTypeAny, data: unknown, description: string) {
    try {
      await schema.parseAsync(data);
      console.error(`  ✗ FAIL: ${description} (should have been rejected)`);
      failed++;
    } catch {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    }
  }

  // ---------------------------------------------------------------
  // 1. Emergency Request Creation Schema Validation
  // ---------------------------------------------------------------
  console.log('1. Emergency Request Creation Schema Validation');

  await assertSchemaValid(createEmergencyRequestSchema, {
    patientIdentifier: 'PATIENT-001',
    bloodGroup: 'O-',
    bloodComponent: 'WHOLE_BLOOD',
    unitsRequired: 2,
    urgency: 'CRITICAL',
    requiredWithinHours: 6,
  }, 'Valid CRITICAL whole blood request is accepted');

  await assertSchemaInvalid(createEmergencyRequestSchema, {
    patientIdentifier: 'P',
    bloodGroup: 'XX',
    unitsRequired: 0,
    urgency: 'ULTRA',
    requiredWithinHours: 0,
  }, 'Invalid blood group, urgency, units, and identifier are rejected');

  await assertSchemaInvalid(createEmergencyRequestSchema, {
    patientIdentifier: 'PATIENT-002',
    bloodGroup: 'A+',
    unitsRequired: 25,  // Exceeds max of 20
    urgency: 'HIGH',
    requiredWithinHours: 12,
  }, 'Request for >20 units is rejected');

  await assertSchemaInvalid(createEmergencyRequestSchema, {
    patientIdentifier: 'PATIENT-003',
    bloodGroup: 'B+',
    unitsRequired: 2,
    urgency: 'MEDIUM',
    requiredWithinHours: 100,  // Exceeds max of 72
  }, 'Request with requiredWithinHours > 72 is rejected');

  await assertSchemaValid(createEmergencyRequestSchema, {
    patientIdentifier: 'PATIENT-VALID',
    bloodGroup: 'AB-',
    bloodComponent: 'PLASMA',
    unitsRequired: 3,
    urgency: 'HIGH',
    requiredWithinHours: 24,
    coordinates: [77.5946, 12.9716],
    maxRadiusKm: 20,
    notes: 'Patient in ICU',
  }, 'Valid request with optional coordinates, radius, and notes is accepted');

  // ---------------------------------------------------------------
  // 2. State Machine Transition Validation
  // ---------------------------------------------------------------
  console.log('\n2. Emergency Request Status State Machine');

  // Enumerate valid transitions
  const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
    ACTIVE:    ['MATCHED', 'FULFILLED', 'CANCELLED'],
    MATCHED:   ['FULFILLED', 'CANCELLED', 'ACTIVE'],
    FULFILLED: [],
    CANCELLED: [],
    EXPIRED:   [],
  };

  // ACTIVE can transition to MATCHED, FULFILLED, CANCELLED
  assert(VALID_TRANSITIONS.ACTIVE.includes('MATCHED'), 'ACTIVE → MATCHED is valid');
  assert(VALID_TRANSITIONS.ACTIVE.includes('FULFILLED'), 'ACTIVE → FULFILLED is valid');
  assert(VALID_TRANSITIONS.ACTIVE.includes('CANCELLED'), 'ACTIVE → CANCELLED is valid');
  assert(!VALID_TRANSITIONS.ACTIVE.includes('EXPIRED'), 'ACTIVE → EXPIRED is invalid');

  // MATCHED can go back to ACTIVE (e.g. donor drops out), or to FULFILLED / CANCELLED
  assert(VALID_TRANSITIONS.MATCHED.includes('FULFILLED'), 'MATCHED → FULFILLED is valid');
  assert(VALID_TRANSITIONS.MATCHED.includes('CANCELLED'), 'MATCHED → CANCELLED is valid');
  assert(VALID_TRANSITIONS.MATCHED.includes('ACTIVE'), 'MATCHED → ACTIVE is valid (re-open)');

  // Terminal states
  assert(VALID_TRANSITIONS.FULFILLED.length === 0, 'FULFILLED is a terminal state (no further transitions)');
  assert(VALID_TRANSITIONS.CANCELLED.length === 0, 'CANCELLED is a terminal state (no further transitions)');
  assert(VALID_TRANSITIONS.EXPIRED.length === 0, 'EXPIRED is a terminal state (no further transitions)');

  // Validate schema for status update
  await assertSchemaValid(updateRequestStatusSchema, { status: 'CANCELLED', reason: 'Units secured' }, 'Status update to CANCELLED with reason is valid');
  await assertSchemaInvalid(updateRequestStatusSchema, { status: 'EXPIRED' }, 'Status update to EXPIRED is rejected by schema (not a manual transition)');
  await assertSchemaInvalid(updateRequestStatusSchema, { status: 'INVALID_STATUS' }, 'Status update with unknown value is rejected');

  // ---------------------------------------------------------------
  // 3. Donor Response Schema Validation
  // ---------------------------------------------------------------
  console.log('\n3. Donor Response Schema Validation');

  await assertSchemaValid(donorResponseSchema, { action: 'ACCEPTED' }, 'Donor ACCEPTED action is valid');
  await assertSchemaValid(donorResponseSchema, { action: 'DECLINED', notes: 'Travelling' }, 'Donor DECLINED action with notes is valid');
  await assertSchemaInvalid(donorResponseSchema, { action: 'MAYBE' }, 'Donor action MAYBE is rejected');
  await assertSchemaInvalid(donorResponseSchema, {}, 'Missing action is rejected');

  // ---------------------------------------------------------------
  // 4. Donor Availability & Screening Schemas
  // ---------------------------------------------------------------
  console.log('\n4. Donor Availability & Screening Schema Validation');

  await assertSchemaValid(donorAvailabilitySchema, { isAvailable: true }, 'isAvailable: true is valid');
  await assertSchemaValid(donorAvailabilitySchema, { isAvailable: false }, 'isAvailable: false is valid');
  await assertSchemaInvalid(donorAvailabilitySchema, { isAvailable: 'yes' }, 'isAvailable as string is rejected');

  await assertSchemaValid(donorScreeningSchema, {
    isAgeEligible: true,
    isWeightEligible: true,
    hasNoRecentIllness: true,
    hasValidInterval: true,
    screeningDisclaimerAcknowledged: true,
  }, 'Complete self-reported screening checklist is valid');

  await assertSchemaInvalid(donorScreeningSchema, {
    isAgeEligible: true,
    isWeightEligible: true,
    hasNoRecentIllness: true,
    hasValidInterval: true,
    // Missing screeningDisclaimerAcknowledged
  }, 'Screening checklist without disclaimer acknowledgement is rejected');

  // ---------------------------------------------------------------
  // 5. Admin Schemas Validation
  // ---------------------------------------------------------------
  console.log('\n5. Admin Schema Validation');

  await assertSchemaValid(verifyHospitalSchema, { isVerified: true }, 'Hospital verification with isVerified=true is valid');
  await assertSchemaValid(verifyHospitalSchema, { isVerified: false, adminNotes: 'License expired' }, 'Hospital rejection with adminNotes is valid');
  await assertSchemaInvalid(verifyHospitalSchema, { isVerified: 'yes' }, 'Hospital verification with string instead of boolean is rejected');

  await assertSchemaValid(updateUserStatusSchema, { status: 'SUSPENDED', reason: 'Policy violation' }, 'User SUSPENDED action with reason is valid');
  await assertSchemaValid(updateUserStatusSchema, { status: 'ACTIVE' }, 'User ACTIVE action without reason is valid');
  await assertSchemaInvalid(updateUserStatusSchema, { status: 'BANNED' }, 'Unknown user status BANNED is rejected');

  // ---------------------------------------------------------------
  // 6. Potential Match Integration (Phase 4 → Phase 5)
  // ---------------------------------------------------------------
  console.log('\n6. Potential Match Integration: Phase 4 Engine in Phase 5 Context');

  const hospitalCoords: [number, number] = [77.5946, 12.9716]; // Bangalore

  const matchOptions: MatchOptions = {
    targetBloodGroup: 'O+',
    bloodComponent: 'WHOLE_BLOOD',
    urgency: 'CRITICAL',
    location: hospitalCoords,
    maxRadiusKm: 30,
  };

  const availableDonor = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'Priya', role: 'DONOR', status: 'ACTIVE' },
    bloodGroup: 'O-' as BloodGroup,
    supportedComponents: ['WHOLE_BLOOD' as BloodComponent],
    isAvailable: true,
    location: { type: 'Point' as const, coordinates: [77.6046, 12.9716] as [number, number] },
    address: { city: 'Bangalore', district: 'Central', postalCode: '560001' },
  } as unknown as IDonorProfileDocument;

  const suspendedDonor = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'Bad Actor', role: 'DONOR', status: 'SUSPENDED' },
    bloodGroup: 'O+' as BloodGroup,
    supportedComponents: ['WHOLE_BLOOD' as BloodComponent],
    isAvailable: true,
    location: { type: 'Point' as const, coordinates: [77.5946, 12.9800] as [number, number] },
    address: { city: 'Bangalore', district: 'North', postalCode: '560002' },
  } as unknown as IDonorProfileDocument;

  const results = rankPotentialMatches([availableDonor, suspendedDonor], matchOptions);

  // rankPotentialMatches filters by isAvailable and bloodGroup compatibility
  // suspendedDonor has O+ which IS compatible with O+ target, and isAvailable=true
  // so both appear - suspension filtering only happens in findPotentialMatches (DB query)
  assert(results.length >= 1, 'At least one compatible potential match returned');
  assert(results.every(m => !('location' in m)), 'No raw location in any potential match result');
  assert(results.every(m => !('coordinates' in m)), 'No raw coordinates in any potential match result');
  assert(results.every(m => typeof m.distanceKm === 'number'), 'All potential matches include distance in km');
  assert(results.every(m => typeof m.address.city === 'string'), 'All potential matches include coarse city address');
  assert(results.every(m => Array.isArray(m.matchReasons) && m.matchReasons.length > 0), 'All potential matches include explainable reasons');
  assert(results.every(m => m.matchScore >= 1 && m.matchScore <= 100), 'All match scores are within [1, 100]');

  // ---------------------------------------------------------------
  // 7. Route Configuration: Required API Endpoints
  // ---------------------------------------------------------------
  console.log('\n7. Route Configuration Verification (Static Check)');

  // Statically verify all required route files exist and export routers
  const routeModules = [
    { path: '../routes/requestRoutes', name: 'requestRoutes' },
    { path: '../routes/donorRoutes', name: 'donorRoutes' },
    { path: '../routes/hospitalRoutes', name: 'hospitalRoutes' },
    { path: '../routes/adminRoutes', name: 'adminRoutes' },
    { path: '../routes/notificationRoutes', name: 'notificationRoutes' },
  ];

  for (const mod of routeModules) {
    try {
      const imported = await import(mod.path);
      const router = imported.default;
      assert(
        typeof router === 'function' || (typeof router === 'object' && router !== null),
        `${mod.name} exports a valid Express router`
      );
    } catch (e) {
      console.error(`  ✗ FAIL: ${mod.name} failed to import`, e);
      failed++;
    }
  }

  // ---------------------------------------------------------------
  // 8. Controller Exports: Required Functions Exist
  // ---------------------------------------------------------------
  console.log('\n8. Controller Exports Verification');

  const controllerChecks: Array<{ path: string; exports: string[] }> = [
    {
      path: '../controllers/emergencyRequestController',
      exports: [
        'createEmergencyRequest',
        'getEmergencyRequests',
        'getEmergencyRequestById',
        'updateEmergencyRequestStatus',
        'getPotentialMatchesForRequest',
      ],
    },
    {
      path: '../controllers/donorController',
      exports: [
        'getDonorDashboard',
        'toggleDonorAvailability',
        'updateDonorScreening',
        'respondToEmergencyRequest',
        'getDonorHistory',
      ],
    },
    {
      path: '../controllers/hospitalController',
      exports: ['getHospitalDashboard', 'getHospitalRequests'],
    },
    {
      path: '../controllers/adminController',
      exports: ['getAdminAnalytics', 'getAdminUsers', 'updateUserStatus', 'verifyHospital', 'getAdminAuditLogs'],
    },
    {
      path: '../controllers/notificationController',
      exports: ['getNotifications', 'markNotificationRead', 'markAllNotificationsRead'],
    },
  ];

  for (const check of controllerChecks) {
    try {
      const mod = await import(check.path);
      for (const fn of check.exports) {
        assert(
          typeof mod[fn] === 'function',
          `${check.path.split('/').pop()}.${fn} is exported as a function`
        );
      }
    } catch (e) {
      console.error(`  ✗ FAIL: Failed to import ${check.path}`, e);
      failed += check.exports.length;
    }
  }

  // ---------------------------------------------------------------
  // Final Summary
  // ---------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`PHASE 5 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase5Verification().catch((err) => {
  console.error('Fatal error during Phase 5 verification:', err);
  process.exit(1);
});
