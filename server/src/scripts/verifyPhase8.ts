/**
 * Phase 8 Verification Script: Role-Based Portals & Dashboards
 *
 * Verifies all Phase 8 deliverables:
 * - Public & Authentication pages exist (Landing, Login with demo logins, Register, Forgot/Reset Password)
 * - Donor portal pages exist (Dashboard, Requests, History, Notifications, Profile)
 * - Hospital portal pages exist (Dashboard, Create Request, Active Requests, Request Details, Profile)
 * - Admin portal pages exist (Dashboard Analytics, Users Directory, Hospital Verification, Audit Logs)
 * - Fallback pages exist (NotFoundPage, DesignSystemPage)
 * - Central AppRoutes exists with role guards
 * - App.tsx connects to AppRoutes
 * - Privacy protection (no raw coordinates exposed in match view)
 * - Self-reported screening disclaimers enforced
 */

import fs from 'fs';
import path from 'path';

async function runPhase8Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 8 VERIFICATION: Role-Based Portals & Dashboards');
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

  const clientDir = path.join(__dirname, '../../../client/src');

  // -----------------------------------------------------------------
  // 1. Public & Auth Pages
  // -----------------------------------------------------------------
  console.log('\n--- 1. Public & Authentication Pages ---');

  const publicAuthPages = [
    'pages/public/LandingPage.tsx',
    'pages/auth/LoginPage.tsx',
    'pages/auth/RegisterPage.tsx',
    'pages/auth/ForgotPasswordPage.tsx',
    'pages/auth/ResetPasswordPage.tsx',
    'pages/NotFoundPage.tsx',
    'pages/DesignSystemPage.tsx',
  ];

  for (const file of publicAuthPages) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Page exists: ${file}`);
  }

  // Verify Login Page features demo credentials for Donor, Hospital, Admin
  const loginSource = fs.readFileSync(path.join(clientDir, 'pages/auth/LoginPage.tsx'), 'utf-8');
  assert(
    loginSource.includes('donor.test@example.com') &&
      loginSource.includes('hospital.test@example.com') &&
      loginSource.includes('admin.test@example.com'),
    'LoginPage.tsx features quick demo credentials for Donor, Hospital, and Admin'
  );

  // Verify Register Page supports dual Donor and Hospital roles
  const registerSource = fs.readFileSync(path.join(clientDir, 'pages/auth/RegisterPage.tsx'), 'utf-8');
  assert(
    registerSource.includes('role === \'DONOR\'') && registerSource.includes('role === \'HOSPITAL\''),
    'RegisterPage.tsx supports dual role registration for Donors and Hospitals'
  );

  // -----------------------------------------------------------------
  // 2. Donor Portal Pages
  // -----------------------------------------------------------------
  console.log('\n--- 2. Donor Portal Pages ---');

  const donorPages = [
    'pages/donor/DonorDashboardPage.tsx',
    'pages/donor/DonorRequestsPage.tsx',
    'pages/donor/DonorHistoryPage.tsx',
    'pages/donor/DonorNotificationsPage.tsx',
    'pages/donor/DonorProfilePage.tsx',
  ];

  for (const file of donorPages) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Donor page exists: ${file}`);
  }

  // Verify Donor Dashboard has availability toggle
  const donorDashSource = fs.readFileSync(path.join(clientDir, 'pages/donor/DonorDashboardPage.tsx'), 'utf-8');
  assert(
    donorDashSource.includes('toggleDonorAvailabilityApi') || donorDashSource.includes('handleToggleAvailability'),
    'DonorDashboardPage.tsx includes interactive availability toggle'
  );

  // Verify Donor Profile enforces self-reported screening disclaimer
  const donorProfileSource = fs.readFileSync(path.join(clientDir, 'pages/donor/DonorProfilePage.tsx'), 'utf-8');
  assert(
    donorProfileSource.includes('screeningDisclaimerAcknowledged') &&
      donorProfileSource.includes('MedicalDisclaimer'),
    'DonorProfilePage.tsx enforces self-reported screening disclaimer acknowledgment'
  );

  // -----------------------------------------------------------------
  // 3. Hospital Portal Pages
  // -----------------------------------------------------------------
  console.log('\n--- 3. Hospital Portal Pages ---');

  const hospitalPages = [
    'pages/hospital/HospitalDashboardPage.tsx',
    'pages/hospital/CreateRequestPage.tsx',
    'pages/hospital/ActiveRequestsPage.tsx',
    'pages/hospital/RequestDetailsPage.tsx',
    'pages/hospital/HospitalProfilePage.tsx',
  ];

  for (const file of hospitalPages) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Hospital page exists: ${file}`);
  }

  // Verify Create Request has required validation fields
  const createReqSource = fs.readFileSync(path.join(clientDir, 'pages/hospital/CreateRequestPage.tsx'), 'utf-8');
  assert(
    createReqSource.includes('patientIdentifier') &&
      createReqSource.includes('bloodGroup') &&
      createReqSource.includes('unitsRequired') &&
      createReqSource.includes('urgency'),
    'CreateRequestPage.tsx collects patientIdentifier, bloodGroup, unitsRequired, urgency'
  );

  // Verify Request Details joins socket room and protects GPS privacy
  const reqDetailsSource = fs.readFileSync(path.join(clientDir, 'pages/hospital/RequestDetailsPage.tsx'), 'utf-8');
  assert(
    reqDetailsSource.includes('useRequestRoom') &&
      reqDetailsSource.includes('DonorCard') &&
      !reqDetailsSource.includes('coordinates: [number, number]'),
    'RequestDetailsPage.tsx connects to live socket room and protects exact GPS coordinates'
  );

  // -----------------------------------------------------------------
  // 4. Admin Portal Pages
  // -----------------------------------------------------------------
  console.log('\n--- 4. Admin Portal Pages ---');

  const adminPages = [
    'pages/admin/AdminDashboardPage.tsx',
    'pages/admin/AdminUsersPage.tsx',
    'pages/admin/AdminHospitalsPage.tsx',
    'pages/admin/AdminAuditLogsPage.tsx',
  ];

  for (const file of adminPages) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Admin page exists: ${file}`);
  }

  // Verify Admin User moderation
  const adminUsersSource = fs.readFileSync(path.join(clientDir, 'pages/admin/AdminUsersPage.tsx'), 'utf-8');
  assert(
    adminUsersSource.includes('updateUserStatusApi') &&
      adminUsersSource.includes('SUSPENDED'),
    'AdminUsersPage.tsx supports user status suspension and moderation'
  );

  // Verify Admin Hospital verification
  const adminHospitalsSource = fs.readFileSync(path.join(clientDir, 'pages/admin/AdminHospitalsPage.tsx'), 'utf-8');
  assert(
    adminHospitalsSource.includes('verifyHospitalApi') &&
      adminHospitalsSource.includes('adminNotes'),
    'AdminHospitalsPage.tsx supports verifying and revoking hospital licenses with notes'
  );

  // -----------------------------------------------------------------
  // 5. Routing Infrastructure & RBAC Guards
  // -----------------------------------------------------------------
  console.log('\n--- 5. Central Routing & Role Guards ---');

  assert(
    fs.existsSync(path.join(clientDir, 'routes/AppRoutes.tsx')),
    'AppRoutes.tsx exists'
  );

  const appRoutesSource = fs.readFileSync(path.join(clientDir, 'routes/AppRoutes.tsx'), 'utf-8');
  assert(
    appRoutesSource.includes("allowedRoles={['DONOR']}"),
    'AppRoutes protects donor routes with allowedRoles=[\'DONOR\']'
  );
  assert(
    appRoutesSource.includes("allowedRoles={['HOSPITAL']}"),
    'AppRoutes protects hospital routes with allowedRoles=[\'HOSPITAL\']'
  );
  assert(
    appRoutesSource.includes("allowedRoles={['ADMIN']}"),
    'AppRoutes protects admin routes with allowedRoles=[\'ADMIN\']'
  );
  assert(
    appRoutesSource.includes('NotFoundPage') && appRoutesSource.includes('path="*"'),
    'AppRoutes provides 404 catch-all route'
  );

  const appSource = fs.readFileSync(path.join(clientDir, 'App.tsx'), 'utf-8');
  assert(
    appSource.includes('<AppRoutes'),
    'App.tsx renders <AppRoutes />'
  );

  // -----------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`PHASE 8 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8Verification().catch((err) => {
  console.error('Fatal error during Phase 8 verification:', err);
  process.exit(1);
});
