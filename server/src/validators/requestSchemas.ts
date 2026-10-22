import { z } from 'zod';
import { BloodGroup, BloodComponent, RequestUrgency, RequestStatus } from '../types';

import { DONOR_MATCH_RADIUS_KM } from '../config/constants';

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
  maxRadiusKm: z.number().min(1).max(100).optional().default(DONOR_MATCH_RADIUS_KM),
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

// Update Donor Location & Coordinates Schema
export const updateDonorLocationSchema = z
  .object({
    street: z.string().trim().optional(),
    city: z.string().trim().min(2, 'City is required and must be at least 2 characters'),
    district: z.string().trim().min(2, 'District is required and must be at least 2 characters'),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().min(3, 'Postal code is required and must be at least 3 characters'),
    latitude: z
      .number({ invalid_type_error: 'Latitude must be a valid number' })
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional(),
    longitude: z
      .number({ invalid_type_error: 'Longitude must be a valid number' })
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional(),
    coordinates: z
      .array(z.number())
      .length(2, 'Coordinates must be [longitude, latitude]')
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasLat = data.latitude !== undefined;
    const hasLng = data.longitude !== undefined;
    const hasCoords = Array.isArray(data.coordinates) && data.coordinates.length === 2;

    if (!hasCoords && (!hasLat || !hasLng)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latitude'],
        message: 'Both latitude and longitude must be provided together',
      });
    }

    if (hasCoords) {
      const [lng, lat] = data.coordinates!;
      if (lng < -180 || lng > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['coordinates'],
          message: 'Longitude in coordinates must be between -180 and 180',
        });
      }
      if (lat < -90 || lat > 90) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['coordinates'],
          message: 'Latitude in coordinates must be between -90 and 90',
        });
      }
    }
  });

export type UpdateDonorLocationInput = z.infer<typeof updateDonorLocationSchema>;

