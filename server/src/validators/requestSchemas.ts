import { z } from 'zod';
import { BloodGroup, BloodComponent, RequestUrgency, RequestStatus } from '../types';

const bloodGroups: [BloodGroup, ...BloodGroup[]] = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
];

const bloodComponents: [BloodComponent, ...BloodComponent[]] = [
  'WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS'
];

const urgencies: [RequestUrgency, ...RequestUrgency[]] = [
  'CRITICAL', 'HIGH', 'MEDIUM'
];

const requestStatuses: [RequestStatus, ...RequestStatus[]] = [
  'ACTIVE', 'MATCHED', 'FULFILLED', 'CANCELLED', 'EXPIRED'
];

// Create Emergency Request Schema
export const createEmergencyRequestSchema = z.object({
  patientIdentifier: z
    .string()
    .trim()
    .min(2, 'Patient identifier is required')
    .max(50, 'Patient identifier cannot exceed 50 characters'),
  bloodGroup: z.enum(bloodGroups, {
    errorMap: () => ({ message: 'Valid blood group is required' }),
  }),
  bloodComponent: z.enum(bloodComponents).default('WHOLE_BLOOD'),
  unitsRequired: z
    .number({ invalid_type_error: 'Units required must be a number' })
    .int('Units must be an integer')
    .min(1, 'At least 1 unit must be requested')
    .max(20, 'Cannot request more than 20 units in a single request'),
  urgency: z.enum(urgencies, {
    errorMap: () => ({ message: 'Urgency must be CRITICAL, HIGH, or MEDIUM' }),
  }),
  requiredWithinHours: z
    .number()
    .int()
    .min(1, 'Required timeframe must be at least 1 hour')
    .max(72, 'Required timeframe cannot exceed 72 hours'),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]')
    .optional(),
  maxRadiusKm: z.number().min(1).max(100).optional().default(30),
  notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
});

// Update Request Status Schema
export const updateRequestStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'MATCHED', 'FULFILLED', 'CANCELLED'], {
      errorMap: () => ({ message: 'Invalid target status' }),
    }),
    fulfilledDonorId: z.string().trim().optional(),
    reason: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'FULFILLED' && (!data.fulfilledDonorId || data.fulfilledDonorId.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fulfilledDonorId'],
        message: 'A specific fulfilled donor ID must be selected to record physical donation completion.',
      });
    }
  });

// Donor Response to Request Schema
export const donorResponseSchema = z.object({
  action: z.enum(['ACCEPTED', 'DECLINED'], {
    errorMap: () => ({ message: "Action must be 'ACCEPTED' or 'DECLINED'" }),
  }),
  notes: z.string().trim().max(200).optional(),
});

// Donor Availability Toggle Schema
export const donorAvailabilitySchema = z.object({
  isAvailable: z.boolean({ required_error: 'isAvailable boolean is required' }),
});

// Donor Self-Reported Screening Update Schema
export const donorScreeningSchema = z.object({
  isAgeEligible: z.boolean(),
  isWeightEligible: z.boolean(),
  hasNoRecentIllness: z.boolean(),
  hasValidInterval: z.boolean(),
  screeningDisclaimerAcknowledged: z.boolean(),
});

// Admin Hospital Verification Schema
export const verifyHospitalSchema = z.object({
  isVerified: z.boolean(),
  adminNotes: z.string().trim().max(300).optional(),
});

// Admin User Status Moderation Schema
export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED'], {
    errorMap: () => ({ message: "Status must be 'ACTIVE' or 'SUSPENDED'" }),
  }),
  reason: z.string().trim().max(200).optional(),
});
