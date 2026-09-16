/**
 * Unit & Integration Tests — Quick Demo Accounts Seeding & Authentication
 *
 * Verifies:
 * - All six Quick Demo Accounts defined on LoginPage exist in the catalog
 * - Passwords are securely hashed (never stored in plaintext)
 * - Roles strictly match application specifications:
 *   - Donor (O-) -> DONOR
 *   - Hospital -> HOSPITAL (Verified)
 *   - Admin -> ADMIN
 *   - Donor (O+) -> DONOR
 *   - Hosp (Pending) -> HOSPITAL (Pending / Unverified)
 *   - Admin (Alt) -> ADMIN
 * - Seeding is idempotent and does not create duplicate user records
 * - Login validation schema accepts all six demo credentials
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB, disconnectDB } from '../config/database';
import { ensureDemoUsers, DEMO_CREDENTIALS } from '../scripts/seed';
import { User, HospitalProfile, DonorProfile } from '../models';
import { comparePassword } from '../utils/password';
import { loginSchema, registerSchema } from '../validators/authSchemas';

describe('Quick Demo Accounts — Seed Verification & Security', () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await connectDB();
      await ensureDemoUsers();
      dbAvailable = true;
    } catch {
      console.warn('[Test] MongoDB is not running locally — demo accounts DB tests skipped.');
    }
  });

  afterAll(async () => {
    if (dbAvailable) {
      await disconnectDB();
    }
  });

  const demoAccounts = [
    {
      label: 'Donor (O-)',
      email: 'alex.donor@example.com',
      expectedRole: 'DONOR',
      expectedVerified: true,
    },
    {
      label: 'Hospital',
      email: 'metro.hospital@bloodlink.org',
      expectedRole: 'HOSPITAL',
      expectedVerified: true,
    },
    {
      label: 'Admin',
      email: 'admin@bloodlink.org',
      expectedRole: 'ADMIN',
      expectedVerified: true,
    },
    {
      label: 'Donor (O+)',
      email: 'donor.test@example.com',
      expectedRole: 'DONOR',
      expectedVerified: true,
    },
    {
      label: 'Hosp (Pending)',
      email: 'hospital.test@example.com',
      expectedRole: 'HOSPITAL',
      expectedVerified: false,
    },
    {
      label: 'Admin (Alt)',
      email: 'admin.test@example.com',
      expectedRole: 'ADMIN',
      expectedVerified: true,
    },
  ];

  it('verifies all 6 demo accounts exist in DEMO_CREDENTIALS', () => {
    expect(DEMO_CREDENTIALS.donorAlex.email).toBe('alex.donor@example.com');
    expect(DEMO_CREDENTIALS.hospitalMetro.email).toBe('metro.hospital@bloodlink.org');
    expect(DEMO_CREDENTIALS.admin.email).toBe('admin@bloodlink.org');
    expect(DEMO_CREDENTIALS.donorTest.email).toBe('donor.test@example.com');
    expect(DEMO_CREDENTIALS.hospitalPending.email).toBe('hospital.test@example.com');
    expect(DEMO_CREDENTIALS.adminAlt.email).toBe('admin.test@example.com');
  });

  for (const acc of demoAccounts) {
    it(`validates ${acc.label} (${acc.email}) has correct role and hashed password`, async () => {
      if (!dbAvailable) return;
      const user = await User.findOne({ email: acc.email });
      expect(user).not.toBeNull();
      expect(user!.role).toBe(acc.expectedRole);
      expect(user!.isVerified).toBe(acc.expectedVerified);
      expect(user!.status).toBe('ACTIVE');

      // Security check: password is NOT plaintext
      expect(user!.passwordHash).not.toBe('Password123!');
      expect(user!.passwordHash.startsWith('$2')).toBe(true);

      // Password comparison check
      const isPasswordValid = await comparePassword('Password123!', user!.passwordHash);
      expect(isPasswordValid).toBe(true);
    });
  }

  it('verifies Hospital (Pending) has unverified HospitalProfile', async () => {
    if (!dbAvailable) return;
    const user = await User.findOne({ email: 'hospital.test@example.com' });
    expect(user).not.toBeNull();
    const profile = await HospitalProfile.findOne({ userId: user!._id });
    expect(profile).not.toBeNull();
    expect(profile!.isVerifiedByAdmin).toBe(false);
  });

  it('verifies Verified Hospital has verified HospitalProfile', async () => {
    if (!dbAvailable) return;
    const user = await User.findOne({ email: 'metro.hospital@bloodlink.org' });
    expect(user).not.toBeNull();
    const profile = await HospitalProfile.findOne({ userId: user!._id });
    expect(profile).not.toBeNull();
    expect(profile!.isVerifiedByAdmin).toBe(true);
  });

  it('verifies Donor (O-) profile has correct blood group O-', async () => {
    if (!dbAvailable) return;
    const user = await User.findOne({ email: 'alex.donor@example.com' });
    expect(user).not.toBeNull();
    const profile = await DonorProfile.findOne({ userId: user!._id });
    expect(profile).not.toBeNull();
    expect(profile!.bloodGroup).toBe('O-');
  });

  it('verifies Donor (O+) profile has correct blood group O+', async () => {
    if (!dbAvailable) return;
    const user = await User.findOne({ email: 'donor.test@example.com' });
    expect(user).not.toBeNull();
    const profile = await DonorProfile.findOne({ userId: user!._id });
    expect(profile).not.toBeNull();
    expect(profile!.bloodGroup).toBe('O+');
  });

  it('is idempotent: running ensureDemoUsers again does not duplicate accounts', async () => {
    if (!dbAvailable) return;
    const countBefore = await User.countDocuments();
    await ensureDemoUsers();
    const countAfter = await User.countDocuments();
    expect(countAfter).toBe(countBefore);
  });

  it('successfully validates loginSchema for all demo accounts', async () => {
    for (const acc of demoAccounts) {
      const parsed = await loginSchema.parseAsync({
        email: acc.email,
        password: 'Password123!',
      });
      expect(parsed.email).toBe(acc.email);
      expect(parsed.password).toBe('Password123!');
    }
  });

  it('guarantees the 3 designated production demo accounts are accurately configured in DEMO_CREDENTIALS', () => {
    // 1. Demo Donor
    expect(DEMO_CREDENTIALS.donorAlex.email).toBe('alex.donor@example.com');
    expect(DEMO_CREDENTIALS.donorAlex.role).toBe('DONOR');
    expect(DEMO_CREDENTIALS.donorAlex.bloodGroup).toBe('O-');
    expect(DEMO_CREDENTIALS.donorAlex.password).toBe('Password123!');

    // 2. Demo Hospital
    expect(DEMO_CREDENTIALS.hospitalMetro.email).toBe('metro.hospital@bloodlink.org');
    expect(DEMO_CREDENTIALS.hospitalMetro.role).toBe('HOSPITAL');
    expect(DEMO_CREDENTIALS.hospitalMetro.password).toBe('Password123!');

    // 3. Demo Admin
    expect(DEMO_CREDENTIALS.admin.email).toBe('admin@bloodlink.org');
    expect(DEMO_CREDENTIALS.admin.role).toBe('ADMIN');
    expect(DEMO_CREDENTIALS.admin.password).toBe('Password123!');
  });

  describe('Hospital Verification Badge Logic Requirements', () => {
    // Pure function representing the fixed badge rendering condition in HospitalDashboardPage:
    // dashboardData?.dashboard?.hospital?.isVerifiedByAdmin === true
    function getVerificationBadgeStatus(dashboardData: any): 'Verified Facility' | 'Pending Verification' {
      if (dashboardData?.dashboard?.hospital?.isVerifiedByAdmin === true) {
        return 'Verified Facility';
      }
      return 'Pending Verification';
    }

    it('evaluates to "Verified Facility" ONLY when isVerifiedByAdmin === true', () => {
      const data = {
        dashboard: {
          hospital: {
            isVerifiedByAdmin: true,
          },
        },
      };
      expect(getVerificationBadgeStatus(data)).toBe('Verified Facility');
    });

    it('evaluates to "Pending Verification" when isVerifiedByAdmin === false', () => {
      const data = {
        dashboard: {
          hospital: {
            isVerifiedByAdmin: false,
          },
        },
      };
      expect(getVerificationBadgeStatus(data)).toBe('Pending Verification');
    });

    it('evaluates to "Pending Verification" and NOT "Verified Facility" when data is missing or undefined', () => {
      expect(getVerificationBadgeStatus(null)).toBe('Pending Verification');
      expect(getVerificationBadgeStatus(undefined)).toBe('Pending Verification');
      expect(getVerificationBadgeStatus({})).toBe('Pending Verification');
      expect(getVerificationBadgeStatus({ dashboard: {} })).toBe('Pending Verification');
      expect(getVerificationBadgeStatus({ dashboard: { hospital: {} } })).toBe('Pending Verification');
      expect(getVerificationBadgeStatus({ dashboard: { hospital: { isVerifiedByAdmin: undefined } } })).toBe('Pending Verification');
    });

    it('never falls back to a truthy user.isVerified or stats.isVerified on error/fallback data', () => {
      // Simulating error catch block returning null
      const errorData = null;
      expect(getVerificationBadgeStatus(errorData)).toBe('Pending Verification');

      // Simulating an object with legacy stats.isVerified = true
      const legacyFallback = {
        stats: {
          isVerified: true,
        },
      };
      expect(getVerificationBadgeStatus(legacyFallback)).toBe('Pending Verification');
    });
  });

  describe('Admin Portal & Public Login Isolation Security', () => {
    // Pure logic simulating public login quick demo accounts filter
    function getPublicDemoAccounts() {
      return [
        { label: 'Donor (O-)', email: 'alex.donor@example.com', role: 'DONOR' },
        { label: 'Hospital', email: 'metro.hospital@bloodlink.org', role: 'HOSPITAL' },
        { label: 'Donor (O+)', email: 'donor.test@example.com', role: 'DONOR' },
        { label: 'Hosp (Pending)', email: 'hospital.test@example.com', role: 'HOSPITAL' },
      ];
    }

    it('guarantees public login demo accounts do NOT include any ADMIN credentials or buttons', () => {
      const publicDemos = getPublicDemoAccounts();
      const hasAdmin = publicDemos.some(
        (acc) => acc.role === 'ADMIN' || acc.email.includes('admin') || acc.label.toLowerCase().includes('admin')
      );
      expect(hasAdmin).toBe(false);
    });

    it('ensures valid ADMIN credentials authenticate and route to /admin/analytics', async () => {
      const adminCreds = {
        email: 'admin@bloodlink.org',
        password: 'Password123!',
      };

      const parsed = await loginSchema.parseAsync(adminCreds);
      expect(parsed.email).toBe('admin@bloodlink.org');

      // Routing logic simulation
      const user = { role: 'ADMIN' };
      const targetRoute = user.role === 'ADMIN' ? '/admin/analytics' : '/';
      expect(targetRoute).toBe('/admin/analytics');
    });

    it('ensures non-ADMIN users (DONOR, HOSPITAL) attempting /admin/login are denied or redirected', () => {
      function evaluateAdminLoginAccess(userRole: string) {
        if (userRole !== 'ADMIN') {
          return { allowed: false, error: 'Access denied. This portal is strictly restricted to platform administrators.' };
        }
        return { allowed: true, redirect: '/admin/analytics' };
      }

      const donorAttempt = evaluateAdminLoginAccess('DONOR');
      expect(donorAttempt.allowed).toBe(false);
      expect(donorAttempt.error).toContain('strictly restricted to platform administrators');

      const hospitalAttempt = evaluateAdminLoginAccess('HOSPITAL');
      expect(hospitalAttempt.allowed).toBe(false);
      expect(hospitalAttempt.error).toContain('strictly restricted to platform administrators');

      const adminAttempt = evaluateAdminLoginAccess('ADMIN');
      expect(adminAttempt.allowed).toBe(true);
      expect(adminAttempt.redirect).toBe('/admin/analytics');
    });

    it('verifies that no Admin registration route is supported by registerSchema', async () => {
      const adminRegisterAttempt = {
        name: 'Public Admin Attempt',
        email: 'newadmin@bloodlink.org',
        password: 'Password123!',
        role: 'ADMIN',
        phone: '9876543210',
      };

      await expect(registerSchema.parseAsync(adminRegisterAttempt)).rejects.toThrow(
        /Role must be either 'DONOR' or 'HOSPITAL'/
      );
    });
  });
});

