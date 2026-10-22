import { z } from 'zod';
import { BloodGroup, BloodComponent } from '../types';

const bloodGroups: [BloodGroup, ...BloodGroup[]] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

const bloodComponents: [BloodComponent, ...BloodComponent[]] = [
  'WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS'
];

// Password complexity regex: at least 8 chars, 1 uppercase, 1 lowercase, 1 number
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  role: z.enum(['DONOR', 'HOSPITAL'], {
    errorMap: () => ({ message: "Role must be either 'DONOR' or 'HOSPITAL'" }),
  }),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 characters').max(20),

  // Donor-specific fields
  bloodGroup: z.enum(bloodGroups).optional(),
  supportedComponents: z.array(z.enum(bloodComponents)).optional(),
  city: z.string().trim().min(2, 'City is required').optional(),
  district: z.string().trim().min(2, 'District is required').optional(),
  postalCode: z.string().trim().min(3, 'Postal code is required').optional(),
  latitude: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val === undefined || val === '' ? undefined : Number(val)))
    .refine(
      (val) => val === undefined || (!isNaN(val) && val >= -90 && val <= 90),
      'Latitude must be a valid number between -90 and 90'
    ),
  longitude: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val === undefined || val === '' ? undefined : Number(val)))
    .refine(
      (val) => val === undefined || (!isNaN(val) && val >= -180 && val <= 180),
      'Longitude must be a valid number between -180 and 180'
    ),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]')
    .refine(
      (val) => val[0] >= -180 && val[0] <= 180 && val[1] >= -90 && val[1] <= 90,
      'Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)]'
    )
    .optional(),
  selfReportedScreening: z
    .object({
      isAgeEligible: z.boolean().optional(),
      isWeightEligible: z.boolean().optional(),
      hasNoRecentIllness: z.boolean().optional(),
      hasValidInterval: z.boolean().optional(),
      screeningDisclaimerAcknowledged: z.boolean().optional(),
    })
    .optional(),

  // Hospital-specific fields
  hospitalName: z.string().trim().min(2).max(150).optional(),
  licenseNumber: z.string().trim().min(3).max(50).optional(),
  emergencyHelpline: z.string().trim().min(5).max(30).optional(),
  street: z.string().trim().min(2).optional(),
  state: z.string().trim().min(2).optional(),
}).superRefine((data, ctx) => {
  const hasLat = data.latitude !== undefined;
  const hasLng = data.longitude !== undefined;
  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasLat ? 'longitude' : 'latitude'],
      message: 'Both latitude and longitude must be provided together',
    });
  }
  if (data.role === 'DONOR') {
    if (!data.bloodGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['bloodGroup'],
        message: 'Blood group is required for donors',
      });
    }
    if (!data.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'City is required for donors',
      });
    }
    if (!data.district) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['district'],
        message: 'District is required for donors',
      });
    }
    if (!data.postalCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postalCode'],
        message: 'Postal code is required for donors',
      });
    }
  } else if (data.role === 'HOSPITAL') {
    if (!data.hospitalName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hospitalName'],
        message: 'Hospital name is required',
      });
    }
    if (!data.licenseNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['licenseNumber'],
        message: 'Medical facility license number is required',
      });
    }
    if (!data.emergencyHelpline) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['emergencyHelpline'],
        message: 'Emergency helpline is required',
      });
    }
    if (!data.city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['city'],
        message: 'City is required',
      });
    }
    if (!data.state) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['state'],
        message: 'State is required',
      });
    }
    if (!data.postalCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['postalCode'],
        message: 'Postal code is required',
      });
    }
  }
});

export const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'Invalid or missing reset token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(passwordRegex, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
});

export const updateHospitalProfileSchema = z.object({
  hospitalName: z.string().trim().min(2, 'Hospital name must be at least 2 characters').max(150, 'Hospital name cannot exceed 150 characters').optional(),
  name: z.string().trim().min(2, 'Hospital name must be at least 2 characters').max(150, 'Hospital name cannot exceed 150 characters').optional(),
  email: z.string().trim().email('Please enter a valid official email address').toLowerCase().optional(),
  phone: z.string().trim().min(5, 'Emergency hotline must be at least 5 characters').max(30, 'Emergency hotline cannot exceed 30 characters').optional(),
  emergencyHelpline: z.string().trim().min(5, 'Emergency hotline must be at least 5 characters').max(30, 'Emergency hotline cannot exceed 30 characters').optional(),
  licenseNumber: z.string().trim().min(3, 'License number must be at least 3 characters').max(50, 'License number cannot exceed 50 characters').optional(),
  street: z.string().trim().min(2, 'Street address must be at least 2 characters').optional(),
  city: z.string().trim().min(2, 'City is required and must be at least 2 characters').optional(),
  district: z.string().trim().min(2, 'District must be at least 2 characters').optional(),
  state: z.string().trim().min(2, 'State must be at least 2 characters').optional(),
  postalCode: z.string().trim().min(3, 'Postal code must be at least 3 characters').optional(),
  latitude: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val === undefined || val === '' ? undefined : Number(val)))
    .refine(
      (val) => val === undefined || (!isNaN(val) && val >= -90 && val <= 90),
      'Latitude must be a valid number between -90 and 90'
    ),
  longitude: z
    .union([z.number(), z.string()])
    .optional()
    .transform((val) => (val === undefined || val === '' ? undefined : Number(val)))
    .refine(
      (val) => val === undefined || (!isNaN(val) && val >= -180 && val <= 180),
      'Longitude must be a valid number between -180 and 180'
    ),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]')
    .refine(
      (val) => val[0] >= -180 && val[0] <= 180 && val[1] >= -90 && val[1] <= 90,
      'Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)]'
    )
    .optional(),
}).superRefine((data, ctx) => {
  const hasLat = data.latitude !== undefined;
  const hasLng = data.longitude !== undefined;
  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [hasLat ? 'longitude' : 'latitude'],
      message: 'Both latitude and longitude must be provided together',
    });
  }
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateHospitalProfileInput = z.infer<typeof updateHospitalProfileSchema>;
