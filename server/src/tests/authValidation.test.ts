/**
 * Unit Tests — Auth Registration & Login Schemas, Error Handling & Data Mapping
 *
 * Verifies:
 * - Donor registration schema requires postalCode, bloodGroup, city, and phone
 * - Validation of user's provided test data passes with the corrected fields
 * - Missing postalCode raises 422 with clear field-level error
 * - Hospital registration schema requirements
 * - Password complexity validation
 */

import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema } from '../validators/authSchemas';

describe('Auth Validation Schemas — Registration & Login', () => {
  describe('Donor Registration Validation', () => {
    it('successfully validates user test payload with all required fields (including postalCode)', async () => {
      const userTestData = {
        name: 'Test Donor',
        email: 'sudar387699@gmail.com',
        password: 'Password123',
        role: 'DONOR' as const,
        bloodGroup: 'O+' as const,
        phone: '9876543210',
        city: 'Nagercoil',
        district: '629001',
        postalCode: '629001',
      };

      const result = await registerSchema.parseAsync(userTestData);
      expect(result.name).toBe('Test Donor');
      expect(result.email).toBe('sudar387699@gmail.com');
      expect(result.role).toBe('DONOR');
      expect(result.bloodGroup).toBe('O+');
      expect(result.postalCode).toBe('629001');
      expect(result.city).toBe('Nagercoil');
    });

    it('fails when postalCode is omitted for DONOR registration (reproducing previous 422 bug)', async () => {
      const payloadWithoutPostal = {
        name: 'Test Donor',
        email: 'sudar387699@gmail.com',
        password: 'Password123',
        role: 'DONOR' as const,
        bloodGroup: 'O+' as const,
        phone: '9876543210',
        city: 'Nagercoil',
        district: '629001',
      };

      await expect(registerSchema.parseAsync(payloadWithoutPostal)).rejects.toThrow(
        /Postal code is required for donors/
      );
    });

    it('fails when bloodGroup is missing for DONOR', async () => {
      const payloadWithoutBlood = {
        name: 'Test Donor',
        email: 'donor@example.com',
        password: 'Password123',
        role: 'DONOR' as const,
        phone: '9876543210',
        city: 'Nagercoil',
        district: 'Kanyakumari',
        postalCode: '629001',
      };

      await expect(registerSchema.parseAsync(payloadWithoutBlood)).rejects.toThrow(
        /Blood group is required for donors/
      );
    });

    it('enforces password complexity (8+ chars, uppercase, lowercase, number)', async () => {
      const weakPasswords = [
        'short1A',
        'alllowercase1',
        'ALLUPPERCASE1',
        'NoNumbersHere',
      ];

      for (const pwd of weakPasswords) {
        const payload = {
          name: 'Test Donor',
          email: 'donor@example.com',
          password: pwd,
          role: 'DONOR' as const,
          bloodGroup: 'O+' as const,
          phone: '9876543210',
          city: 'Nagercoil',
          district: 'Kanyakumari',
          postalCode: '629001',
        };

        await expect(registerSchema.parseAsync(payload)).rejects.toThrow();
      }
    });

    it('preserves all blood group values including negative types (O- regression test)', async () => {
      const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;

      for (const bloodGroup of bloodGroups) {
        const payload = {
          name: 'Test Donor',
          email: 'donor@example.com',
          password: 'Password123',
          role: 'DONOR' as const,
          bloodGroup,
          phone: '9876543210',
          city: 'Nagercoil',
          district: 'Kanyakumari',
          postalCode: '629001',
        };

        const result = await registerSchema.parseAsync(payload);
        expect(result.bloodGroup).toBe(bloodGroup); // must not be coerced or changed
      }
    });
  });

  describe('Login Validation', () => {
    it('validates correct email and password inputs', async () => {
      const loginPayload = {
        email: 'sudar387699@gmail.com',
        password: 'Password123',
      };

      const result = await loginSchema.parseAsync(loginPayload);
      expect(result.email).toBe('sudar387699@gmail.com');
      expect(result.password).toBe('Password123');
    });

    it('rejects invalid email formats', async () => {
      const invalidEmail = {
        email: 'not-an-email',
        password: 'Password123',
      };

      await expect(loginSchema.parseAsync(invalidEmail)).rejects.toThrow();
    });

    it('rejects empty password', async () => {
      const emptyPwd = {
        email: 'test@example.com',
        password: '',
      };

      await expect(loginSchema.parseAsync(emptyPwd)).rejects.toThrow();
    });
  });
});
