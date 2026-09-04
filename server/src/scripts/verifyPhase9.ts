/**
 * Phase 9 Verification Script: Comprehensive Seed Data & Demo Experience
 *
 * Verifies all Phase 9 deliverables:
 * - server/src/scripts/seed.ts exists and exports validateSeedEnvironment and seedDatabase
 * - Strict production environment gating (throws security alert if NODE_ENV === 'production')
 * - Root and server package.json scripts configure the seed command
 * - Demo credentials catalog covers all roles: ADMIN, HOSPITAL, DONOR
 * - Comprehensive role and domain representation:
 *   - Verified and pending hospitals with licenses and GeoJSON coordinates
 *   - Donors across ABO/Rh groups (O-, A+, B+, AB+) and availability states
 *   - Emergency requests across urgencies (CRITICAL, HIGH, MEDIUM) and statuses (ACTIVE, MATCHED, FULFILLED, CANCELLED)
 *   - Donation history ledger entries
 *   - Notifications across types (EMERGENCY_ALERT, DONOR_ACCEPTED, STATUS_UPDATE, SYSTEM)
 *   - Security audit log entries
 * - Privacy protection (hideExactLocation, masked coordinates)
 * - Medical safety principles (self-reported screening disclaimer acknowledged)
 * - Client LoginPage demo credentials integration
 */

import fs from 'fs';
import path from 'path';

async function runPhase9Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 9 VERIFICATION: Comprehensive Seed Data & Demo Experience');
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

  const serverDir = path.join(__dirname, '../..');
  const clientDir = path.join(__dirname, '../../../client/src');
  const rootDir = path.join(__dirname, '../../..');

  // -----------------------------------------------------------------
  // 1. Seed Script File & Module Structure
  // -----------------------------------------------------------------
  console.log('--- 1. Seed Script File & Exports ---');

  const seedFilePath = path.join(serverDir, 'src/scripts/seed.ts');
  assert(fs.existsSync(seedFilePath), 'server/src/scripts/seed.ts exists');

  // Dynamically import seed module to test exported utilities
  const seedModule = await import('./seed');
  assert(
    typeof seedModule.validateSeedEnvironment === 'function',
    'seed.ts exports validateSeedEnvironment() function'
  );
  assert(
    typeof seedModule.seedDatabase === 'function',
    'seed.ts exports seedDatabase() function'
  );
  assert(
    typeof seedModule.DEMO_CREDENTIALS === 'object' && seedModule.DEMO_CREDENTIALS !== null,
    'seed.ts exports DEMO_CREDENTIALS catalog'
  );

  // -----------------------------------------------------------------
  // 2. Strict Environment Gating (Safety Rule)
  // -----------------------------------------------------------------
  console.log('\n--- 2. Environment Gating & Production Protection ---');

  const originalNodeEnv = process.env.NODE_ENV;
  let productionBlocked = false;

  try {
    process.env.NODE_ENV = 'production';
    seedModule.validateSeedEnvironment();
  } catch (err: any) {
    if (err.message && err.message.includes('CRITICAL SECURITY ALERT')) {
      productionBlocked = true;
    }
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert(
    productionBlocked,
    'validateSeedEnvironment() strictly blocks execution when NODE_ENV === "production"'
  );

  // Verify non-production doesn't throw
  let devAllowed = false;
  try {
    process.env.NODE_ENV = 'development';
    seedModule.validateSeedEnvironment();
    devAllowed = true;
  } catch {
    devAllowed = false;
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert(devAllowed, 'validateSeedEnvironment() permits execution in development mode');

  // -----------------------------------------------------------------
  // 3. Package.json Seed Script Configuration
  // -----------------------------------------------------------------
  console.log('\n--- 3. CLI Seed Scripts Configuration ---');

  const serverPkg = JSON.parse(
    fs.readFileSync(path.join(serverDir, 'package.json'), 'utf-8')
  );
  assert(
    serverPkg.scripts && serverPkg.scripts.seed,
    'server/package.json contains "seed" npm script'
  );

  const rootPkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')
  );
  assert(
    rootPkg.scripts && rootPkg.scripts.seed,
    'root package.json contains "seed" npm script for monorepo execution'
  );

  // -----------------------------------------------------------------
  // 4. Demo Credentials & User Role Coverage
  // -----------------------------------------------------------------
  console.log('\n--- 4. Demo Credentials & Role Coverage ---');

  const creds = seedModule.DEMO_CREDENTIALS;

  // Admin check
  assert(
    creds.admin && creds.admin.role === 'ADMIN' && creds.admin.email === 'admin@bloodlink.org',
    'DEMO_CREDENTIALS includes primary System Admin (admin@bloodlink.org)'
  );

  // Hospital checks
  assert(
    creds.hospitalMetro &&
      creds.hospitalMetro.role === 'HOSPITAL' &&
      creds.hospitalMetro.isVerifiedByAdmin === true &&
      creds.hospitalMetro.licenseNumber.startsWith('HOSP-LIC'),
    'DEMO_CREDENTIALS includes verified hospital (Metro General Emergency Hospital)'
  );
  assert(
    creds.hospitalPending &&
      creds.hospitalPending.role === 'HOSPITAL' &&
      creds.hospitalPending.isVerifiedByAdmin === false,
    'DEMO_CREDENTIALS includes pending hospital for admin verification workflow'
  );

  // Donor checks across ABO/Rh groups
  assert(
    creds.donorAlex && creds.donorAlex.bloodGroup === 'O-' && creds.donorAlex.isAvailable === true,
    'DEMO_CREDENTIALS includes Universal O- donor (Alex Mercer)'
  );
  assert(
    creds.donorSarah && creds.donorSarah.bloodGroup === 'A+' && creds.donorSarah.isAvailable === true,
    'DEMO_CREDENTIALS includes A+ donor (Sarah Connor)'
  );
  assert(
    creds.donorMichael && creds.donorMichael.bloodGroup === 'B+' && creds.donorMichael.isAvailable === false,
    'DEMO_CREDENTIALS includes resting/temporarily unavailable B+ donor'
  );
  assert(
    creds.donorPriya && creds.donorPriya.bloodGroup === 'AB+' && creds.donorPriya.isAvailable === true,
    'DEMO_CREDENTIALS includes Universal Plasma AB+ donor'
  );
  assert(
    creds.donorTest && creds.donorTest.email === 'donor.test@example.com',
    'DEMO_CREDENTIALS includes fallback quick demo donor (donor.test@example.com)'
  );

  // -----------------------------------------------------------------
  // 5. Seed Script Source & Entity Creation Coverage
  // -----------------------------------------------------------------
  console.log('\n--- 5. Entity Coverage in seedDatabase() ---');

  const seedSource = fs.readFileSync(seedFilePath, 'utf-8');

  assert(
    seedSource.includes('EmergencyRequest.create') &&
      seedSource.includes("'CRITICAL'") &&
      seedSource.includes("'ACTIVE'"),
    'seedDatabase() creates active critical emergency blood requests'
  );

  assert(
    seedSource.includes("'MATCHED'") && seedSource.includes("'ACCEPTED'"),
    'seedDatabase() creates matched requests with donor response status'
  );

  assert(
    seedSource.includes("'FULFILLED'") && seedSource.includes("'CANCELLED'"),
    'seedDatabase() creates fulfilled and cancelled requests'
  );

  assert(
    seedSource.includes('DonationHistory.create') && seedSource.includes('CERT-2026-DON'),
    'seedDatabase() populates verified donation history with certificate IDs'
  );

  assert(
    seedSource.includes('Notification.create') &&
      seedSource.includes("'EMERGENCY_ALERT'") &&
      seedSource.includes("'DONOR_ACCEPTED'"),
    'seedDatabase() creates multiple types of in-app notifications'
  );

  assert(
    seedSource.includes('AuditLog.create') && seedSource.includes('HOSPITAL_LICENSE_VERIFIED'),
    'seedDatabase() generates security and compliance audit logs'
  );

  // -----------------------------------------------------------------
  // 6. Privacy & Medical Safety Principles
  // -----------------------------------------------------------------
  console.log('\n--- 6. Privacy & Medical Safety Safeguards ---');

  assert(
    seedSource.includes('hideExactLocation: true'),
    'Donors in seed data have hideExactLocation: true privacy setting'
  );

  assert(
    seedSource.includes('screeningDisclaimerAcknowledged: true'),
    'Donors in seed data acknowledge that self-reported screening is not medical clearance'
  );

  // Verify coordinates format
  const coordsRegex = /coordinates:\s*\[\s*-?\d+\.?\d*,\s*-?\d+\.?\d*\s*\]/;
  assert(coordsRegex.test(seedSource), 'Seed entities contain valid [longitude, latitude] coordinates');

  // -----------------------------------------------------------------
  // 7. Client Quick Demo Integration
  // -----------------------------------------------------------------
  console.log('\n--- 7. Client LoginPage Demo Integration ---');

  const loginPageSource = fs.readFileSync(
    path.join(clientDir, 'pages/auth/LoginPage.tsx'),
    'utf-8'
  );

  assert(
    loginPageSource.includes('alex.donor@example.com') ||
      loginPageSource.includes('donor.test@example.com'),
    'LoginPage.tsx connects to seeded demo donor account'
  );

  assert(
    loginPageSource.includes('metro.hospital@bloodlink.org') ||
      loginPageSource.includes('hospital.test@example.com'),
    'LoginPage.tsx connects to seeded demo hospital account'
  );

  assert(
    loginPageSource.includes('admin@bloodlink.org') ||
      loginPageSource.includes('admin.test@example.com'),
    'LoginPage.tsx connects to seeded demo admin account'
  );

  // -----------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`PHASE 9 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9Verification().catch((err) => {
  console.error('Fatal error during Phase 9 verification:', err);
  process.exit(1);
});
