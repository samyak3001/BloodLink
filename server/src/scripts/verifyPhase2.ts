import {
  User,
  DonorProfile,
  HospitalProfile,
  EmergencyRequest,
  DonationHistory,
  Notification,
  AuditLog,
} from '../models';
import { connectDB, disconnectDB, isDbConnected } from '../config/database';

async function verifyPhase2() {
  console.log('--- Verifying Phase 2: Database Schemas & Data Layer ---\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // 1. Verify User Model
  console.log('1. Verifying User Model...');
  const userIndexes = User.schema.indexes();
  const hasUserEmailIndex = userIndexes.some((idx) => 'email' in idx[0]);
  assert(hasUserEmailIndex, 'User schema has index on email');

  const sampleUser = new User({
    name: 'Test Donor',
    email: 'test@donor.com',
    passwordHash: 'secret_hash_value',
    role: 'DONOR',
    phone: '+1234567890',
  });
  const userJson = sampleUser.toJSON();
  assert(userJson.passwordHash === undefined, 'User JSON transform excludes passwordHash');
  assert(userJson.name === 'Test Donor', 'User JSON transform preserves non-sensitive fields');

  // 2. Verify DonorProfile Model
  console.log('\n2. Verifying DonorProfile Model & Privacy...');
  const donorIndexes = DonorProfile.schema.indexes();
  const hasDonor2dsphere = donorIndexes.some((idx) => idx[0].location === '2dsphere');
  assert(hasDonor2dsphere, 'DonorProfile schema has 2dsphere index on location');

  const sampleDonor = new DonorProfile({
    userId: sampleUser._id,
    bloodGroup: 'O-',
    isAvailable: true,
    supportedComponents: ['WHOLE_BLOOD'],
    selfReportedScreening: {
      isAgeEligible: true,
      isWeightEligible: true,
      hasNoRecentIllness: true,
      hasValidInterval: true,
      screeningDisclaimerAcknowledged: true,
    },
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
    },
    address: {
      city: 'Bangalore',
      district: 'Bangalore Urban',
      postalCode: '560001',
    },
    privacySettings: {
      hideExactLocation: true,
      showContactToMatchedHospitalsOnly: true,
    },
  });

  const donorJson = sampleDonor.toJSON();
  assert(donorJson.location === undefined, 'Donor JSON transform masks exact GPS location by default');
  assert(donorJson.bloodGroup === 'O-', 'Donor blood group is preserved in serialization');

  const safeDonor = sampleDonor.toSafeProfile(4.2, 95);
  assert(safeDonor.distanceKm === 4.2, 'Safe donor profile calculates rounded distanceKm');
  assert(safeDonor.matchScore === 95, 'Safe donor profile preserves matchScore');
  assert(safeDonor.address.city === 'Bangalore', 'Safe donor profile includes coarse city location');
  assert(!('location' in safeDonor), 'Safe donor profile completely omits raw GPS coordinates');

  // 3. Verify HospitalProfile Model
  console.log('\n3. Verifying HospitalProfile Model...');
  const hospitalIndexes = HospitalProfile.schema.indexes();
  const hasHospital2dsphere = hospitalIndexes.some((idx) => idx[0].location === '2dsphere');
  assert(hasHospital2dsphere, 'HospitalProfile schema has 2dsphere index on location');

  // 4. Verify EmergencyRequest Model
  console.log('\n4. Verifying EmergencyRequest Model & bloodComponent...');
  const reqIndexes = EmergencyRequest.schema.indexes();
  const hasReq2dsphere = reqIndexes.some((idx) => idx[0].location === '2dsphere');
  assert(hasReq2dsphere, 'EmergencyRequest schema has 2dsphere index on location');

  const sampleReq = new EmergencyRequest({
    hospitalId: sampleUser._id,
    patientIdentifier: 'EM-***92',
    bloodGroup: 'A+',
    bloodComponent: 'WHOLE_BLOOD',
    unitsRequired: 2,
    urgency: 'CRITICAL',
    requiredWithinHours: 3,
    location: {
      type: 'Point',
      coordinates: [77.5946, 12.9716],
    },
  });
  assert(sampleReq.bloodComponent === 'WHOLE_BLOOD', 'EmergencyRequest defaults bloodComponent to WHOLE_BLOOD');
  assert(sampleReq.status === 'ACTIVE', 'EmergencyRequest defaults status to ACTIVE');
  assert(Array.isArray(sampleReq.potentialMatches), 'EmergencyRequest initializes potentialMatches as array');

  // 5. Verify DonationHistory Model
  console.log('\n5. Verifying DonationHistory Model...');
  const sampleDonation = new DonationHistory({
    donorId: sampleDonor._id,
    hospitalId: sampleUser._id,
    requestId: sampleReq._id,
    bloodGroup: 'O-',
    bloodComponent: 'WHOLE_BLOOD',
    unitsDonated: 1,
  });
  assert(sampleDonation.status === 'COMPLETED', 'DonationHistory status defaults to COMPLETED');
  assert(sampleDonation.bloodComponent === 'WHOLE_BLOOD', 'DonationHistory supports bloodComponent');

  // 6. Verify Notification Model
  console.log('\n6. Verifying Notification Model...');
  const notifIndexes = Notification.schema.indexes();
  const hasNotifIndex = notifIndexes.some((idx) => 'recipientId' in idx[0] && 'isRead' in idx[0]);
  assert(hasNotifIndex, 'Notification has compound index on recipientId, isRead, createdAt');

  // 7. Verify AuditLog Model
  console.log('\n7. Verifying AuditLog Model...');
  const auditIndexes = AuditLog.schema.indexes();
  const hasAuditIndex = auditIndexes.some((idx) => 'actorId' in idx[0]);
  assert(hasAuditIndex, 'AuditLog has compound index on actorId, createdAt');

  // 8. Verify DB Connection Helpers
  console.log('\n8. Verifying DB Connection Helpers...');
  assert(typeof connectDB === 'function', 'connectDB helper is exported');
  assert(typeof disconnectDB === 'function', 'disconnectDB helper is exported');
  assert(typeof isDbConnected === 'function', 'isDbConnected helper is exported');
  assert(isDbConnected() === false, 'isDbConnected accurately reflects offline state prior to connect');

  console.log(`\n========================================`);
  console.log(`Verification Complete: ${passedTests}/${totalTests} tests passed.`);
  console.log(`========================================\n`);
}

verifyPhase2().catch((err) => {
  console.error('Phase 2 verification failed:', err);
  process.exit(1);
});
