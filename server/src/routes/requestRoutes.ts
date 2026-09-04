import { Router } from 'express';
import {
  createEmergencyRequest,
  getEmergencyRequests,
  getEmergencyRequestById,
  updateEmergencyRequestStatus,
  getPotentialMatchesForRequest,
} from '../controllers/emergencyRequestController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createEmergencyRequestSchema,
  updateRequestStatusSchema,
} from '../validators/requestSchemas';

const router = Router();

// Public / Filtered Emergency Request Listing
router.get('/', getEmergencyRequests);

// Create Emergency Request (Hospitals Only)
router.post(
  '/',
  authenticate,
  authorize('HOSPITAL'),
  validateBody(createEmergencyRequestSchema),
  createEmergencyRequest
);

// Get Request by ID (Includes caller-specific response status if donor)
router.get('/:id', getEmergencyRequestById);

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

export default router;
