import { Router } from 'express';
import {
  createEmergencyRequest,
  getEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequestStatus,
  getPotentialMatchesForRequest,
  contactAcceptedDonor,
  reviewAcceptedDonor,
} from '../controllers/emergencyRequestController';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createEmergencyRequestSchema,
  updateRequestStatusSchema,
  donorResponseSchema,
} from '../validators/requestSchemas';
import { respondToEmergencyRequest } from '../controllers/donorController';

const router = Router();

// Public / Filtered Emergency Request Listing (compatible filtering if donor)
router.get('/', optionalAuthenticate, getEmergencyRequests);

// Create Emergency Request (Hospitals Only)
router.post(
  '/',
  authenticate,
  authorize('HOSPITAL'),
  validateBody(createEmergencyRequestSchema),
  createEmergencyRequest
);

// Get Request by ID (Includes caller-specific response status and authorized accepted donors)
router.get('/:id', optionalAuthenticate, getEmergencyRequestById);

// Respond to Emergency Request (Donor Only)
router.post(
  '/:id/respond',
  authenticate,
  authorize('DONOR'),
  validateBody(donorResponseSchema),
  respondToEmergencyRequest
);

// Update Request Status (Hospital Owner or Admin)
router.patch(
  '/:id/status',
  authenticate,
  validateBody(updateRequestStatusSchema),
  updateEmergencyRequestStatus
);

// View Potential Matches for Request (Hospital Owner or Admin Only)
router.get(
  '/:id/potential-matches',
  authenticate,
  authorize('HOSPITAL', 'ADMIN'),
  getPotentialMatchesForRequest
);

// Contact Accepted Donor (Hospital Owner or Admin Only)
router.post(
  '/:id/contact-donor',
  authenticate,
  authorize('HOSPITAL', 'ADMIN'),
  contactAcceptedDonor
);

// Review Accepted Donor Profile (Hospital Owner or Admin Only)
router.post(
  '/:id/review-donor',
  authenticate,
  authorize('HOSPITAL', 'ADMIN'),
  reviewAcceptedDonor
);

export default router;
