import { Router } from 'express';
import {
  createEmergencyRequest,
  getEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequestStatus,
  getPotentialMatchesForRequest,
  contactAcceptedDonor,
} from '../controllers/emergencyRequestController';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createEmergencyRequestSchema,
  updateRequestStatusSchema,
} from '../validators/requestSchemas';

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

export default router;
