import {
  getCompatibleDonorBloodGroups,
  isBloodCompatible,
  isExactMatch,
  isUniversalDonor,
} from '../config/bloodCompatibility';
import { calculateDistanceKm, formatDistance, estimateTransitTimeMinutes } from '../utils/geo';
import {
  calculateMatchScore,
  rankPotentialMatches,
  MatchOptions,
} from '../services/matchingService';
import { BloodGroup, BloodComponent } from '../types';
import { Types } from 'mongoose';
import { IDonorProfileDocument } from '../models';

async function runPhase4Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 4 VERIFICATION: Matching Engine & Geospatial');
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

  // -------------------------------------------------------------
  // 1. Blood Group Compatibility Rules Verification
  // -------------------------------------------------------------
  console.log('1. Blood Group Compatibility Rules (ABO & Rh Matrix)');

  const allGroups: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  // Verify O- is Universal Red Cell Donor
  const oNegCanDonateToAll = allGroups.every((recipient) =>
    isBloodCompatible('O-', recipient, 'WHOLE_BLOOD')
  );
  assert(oNegCanDonateToAll, 'O- is universal donor: compatible with all 8 blood groups for Whole Blood');

  // Verify AB+ is Universal Red Cell Recipient
  const abPosCanReceiveFromAll = allGroups.every((donor) =>
    isBloodCompatible(donor, 'AB+', 'WHOLE_BLOOD')
  );
  assert(abPosCanReceiveFromAll, 'AB+ is universal recipient: accepts donations from all 8 blood groups');

  // Verify O- Recipient can only receive O-
  const oNegDonors = getCompatibleDonorBloodGroups('O-', 'WHOLE_BLOOD');
  assert(
    oNegDonors.length === 1 && oNegDonors[0] === 'O-',
    'O- recipient can ONLY receive from O- donors'
  );

  // Verify A+ compatibility
  const aPosDonors = getCompatibleDonorBloodGroups('A+', 'WHOLE_BLOOD');
  assert(
    aPosDonors.includes('A+') &&
      aPosDonors.includes('A-') &&
      aPosDonors.includes('O+') &&
      aPosDonors.includes('O-') &&
      !aPosDonors.includes('B+') &&
      !aPosDonors.includes('AB+'),
    'A+ recipient accepts [O-, O+, A-, A+] and rejects [B+, B-, AB+, AB-]'
  );

  // Verify Rh incompatibility rule: Rh- recipient cannot receive Rh+ blood
  assert(!isBloodCompatible('O+', 'O-', 'WHOLE_BLOOD'), 'Rh+ blood (O+) cannot be donated to Rh- recipient (O-)');
  assert(!isBloodCompatible('A+', 'A-', 'WHOLE_BLOOD'), 'Rh+ blood (A+) cannot be donated to Rh- recipient (A-)');

  // Verify Component Inversion for Plasma: AB is universal plasma donor
  assert(isUniversalDonor('AB+', 'PLASMA'), 'AB+ is universal plasma donor');
  assert(isBloodCompatible('AB+', 'O-', 'PLASMA'), 'AB+ plasma is compatible with O- recipient');
  assert(isUniversalDonor('O-', 'WHOLE_BLOOD'), 'O- is universal whole blood donor');

  // Verify Exact Match helper
  assert(isExactMatch('B+', 'B+'), 'isExactMatch returns true for matching groups');
  assert(!isExactMatch('O-', 'A+'), 'isExactMatch returns false for non-identical compatible groups');

  // -------------------------------------------------------------
  // 2. Geospatial Distance & Transit Calculation Verification
  // -------------------------------------------------------------
  console.log('\n2. Geospatial & Proximity Calculation (Haversine)');

  // Landmark distance: Empire State Building to Times Square (~1.07 km)
  const empireState: [number, number] = [-73.9857, 40.7484];
  const timesSquare: [number, number] = [-73.9855, 40.758];
  const nyDistance = calculateDistanceKm(empireState, timesSquare);
  assert(nyDistance >= 1.0 && nyDistance <= 1.2, `Calculated distance (~${nyDistance} km) matches expected ~1.07 km`);

  // Distance symmetry: d(A,B) === d(B,A)
  const reverseDistance = calculateDistanceKm(timesSquare, empireState);
  assert(nyDistance === reverseDistance, 'Distance calculation is symmetric');

  // Same location distance === 0
  assert(calculateDistanceKm(empireState, empireState) === 0, 'Distance between identical coordinates is 0 km');

  // Distance formatting
  assert(formatDistance(0.45) === '450 m', 'Sub-kilometer distances are formatted in meters');
  assert(formatDistance(4.56) === '4.6 km', 'Distances over 1 km are formatted with 1 decimal place');

  // Transit time estimation
  assert(estimateTransitTimeMinutes(3.5) === 6, 'Transit time estimates ~6 mins for 3.5 km');
  assert(estimateTransitTimeMinutes(0.5) === 5, 'Transit time has a reasonable minimum 5-minute safety threshold');

  // -------------------------------------------------------------
  // 3. Multi-Factor Scoring & Ranking Engine Verification
  // -------------------------------------------------------------
  console.log('\n3. Multi-Factor Potential Match Ranking Engine');

  const hospitalLocation: [number, number] = [77.5946, 12.9716]; // Bangalore City Center

  // Mock donor documents
  const donor1CloseExact = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'Alex Close', role: 'DONOR', status: 'ACTIVE' },
    bloodGroup: 'A+' as BloodGroup,
    supportedComponents: ['WHOLE_BLOOD' as BloodComponent],
    isAvailable: true,
    location: { type: 'Point' as const, coordinates: [77.6046, 12.9716] as [number, number] }, // ~1.1 km away
    address: { city: 'Bangalore', district: 'Central', postalCode: '560001' },
    selfReportedScreening: { hasNoRecentIllness: true, hasValidInterval: true },
  } as unknown as IDonorProfileDocument;

  const donor2FarCompatible = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'Sam Far', role: 'DONOR', status: 'ACTIVE' },
    bloodGroup: 'O-' as BloodGroup, // Universal but farther
    supportedComponents: ['WHOLE_BLOOD' as BloodComponent],
    isAvailable: true,
    location: { type: 'Point' as const, coordinates: [77.7546, 12.9716] as [number, number] }, // ~17.3 km away
    address: { city: 'Bangalore', district: 'East', postalCode: '560066' },
    selfReportedScreening: { hasNoRecentIllness: true, hasValidInterval: true },
  } as unknown as IDonorProfileDocument;

  const donor3Unavailable = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'Offline Donor', role: 'DONOR', status: 'ACTIVE' },
    bloodGroup: 'A+' as BloodGroup,
    supportedComponents: ['WHOLE_BLOOD' as BloodComponent],
    isAvailable: false, // NOT available
    location: { type: 'Point' as const, coordinates: [77.595, 12.972] as [number, number] },
    address: { city: 'Bangalore', district: 'Central', postalCode: '560001' },
  } as unknown as IDonorProfileDocument;

  const donor4Incompatible = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'B+ Donor', role: 'DONOR', status: 'ACTIVE' },
    bloodGroup: 'B+' as BloodGroup, // Incompatible with A+ recipient
    supportedComponents: ['WHOLE_BLOOD' as BloodComponent],
    isAvailable: true,
    location: { type: 'Point' as const, coordinates: [77.595, 12.972] as [number, number] },
    address: { city: 'Bangalore', district: 'Central', postalCode: '560001' },
  } as unknown as IDonorProfileDocument;

  const donor5WrongComponent = {
    _id: new Types.ObjectId(),
    userId: { _id: new Types.ObjectId(), name: 'Plasma Only Donor', role: 'DONOR', status: 'ACTIVE' },
    bloodGroup: 'A+' as BloodGroup,
    supportedComponents: ['PLASMA' as BloodComponent], // Does NOT support WHOLE_BLOOD
    isAvailable: true,
    location: { type: 'Point' as const, coordinates: [77.595, 12.972] as [number, number] },
    address: { city: 'Bangalore', district: 'Central', postalCode: '560001' },
  } as unknown as IDonorProfileDocument;

  const donorList = [
    donor2FarCompatible,
    donor4Incompatible,
    donor1CloseExact,
    donor3Unavailable,
    donor5WrongComponent,
  ];

  const matchOptions: MatchOptions = {
    targetBloodGroup: 'A+',
    bloodComponent: 'WHOLE_BLOOD',
    urgency: 'CRITICAL',
    location: hospitalLocation,
    maxRadiusKm: 30,
  };

  const rankedResults = rankPotentialMatches(donorList, matchOptions);

  assert(rankedResults.length === 2, 'Only eligible, available, and compatible donors are included (2 of 5)');
  assert(rankedResults[0].donorName === 'Alex Close', 'Closer exact match donor ranks 1st over farther compatible donor');
  assert(rankedResults[0].matchScore > rankedResults[1].matchScore, '1st place match score is strictly greater than 2nd place');
  assert(rankedResults[0].isExactBloodMatch === true, 'Top result correctly identified as exact blood group match');
  assert(rankedResults[1].isExactBloodMatch === false, 'Second result identified as compatible universal donor');

  // -------------------------------------------------------------
  // 4. Explainable Match Reasons Verification
  // -------------------------------------------------------------
  console.log('\n4. Explainable Match Reasons');
  const reasons1 = rankedResults[0].matchReasons;
  assert(reasons1.some((r) => r.includes('Exact blood group match')), 'Explains exact blood match');
  assert(reasons1.some((r) => r.includes('proximity')), 'Explains proximity');
  assert(reasons1.some((r) => r.includes('critical urgency')), 'Explains urgency priority weighting');

  // -------------------------------------------------------------
  // 5. Privacy & Non-Exposure of GPS Coordinates Verification
  // -------------------------------------------------------------
  console.log('\n5. Privacy & Non-Exposure of Exact GPS Coordinates');
  for (const match of rankedResults) {
    assert(!('location' in match), 'Raw location object is completely omitted from potential match result');
    assert(!('coordinates' in match), 'Raw coordinates property is completely omitted');
    assert(typeof match.distanceKm === 'number', 'Safe distance in kilometers is provided');
    assert(typeof match.address.city === 'string', 'Coarse city address is provided');
  }

  console.log('\n===========================================================');
  console.log(`PHASE 4 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Verification().catch((err) => {
  console.error('Fatal error during Phase 4 verification:', err);
  process.exit(1);
});
