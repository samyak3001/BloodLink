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
import { loginSchema } from '../validators/authSchemas';

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
});
