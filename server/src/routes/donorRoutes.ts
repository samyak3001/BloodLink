import { Router } from 'express';
import {
  getDonorDashboard,
  toggleDonorAvailability,
  updateDonorScreening,
  respondToEmergencyRequest,
  getDonorHistory,
} from '../controllers/donorController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  donorAvailabilitySchema,
  donorScreeningSchema,
  donorResponseSchema,
} from '../validators/requestSchemas';

const router = Router();

// Protect all donor routes
router.use(authenticate, authorize('DONOR'));

// Donor Dashboard Overview
router.get('/dashboard', getDonorDashboard);

// Toggle Availability Status
router.patch('/availability', validateBody(donorAvailabilitySchema), toggleDonorAvailability);

// Update Self-Reported Screening Checklist
router.patch('/screening', validateBody(donorScreeningSchema), updateDonorScreening);

// Respond (Accept or Decline) to an Emergency Blood Request
router.post(
  '/requests/:requestId/respond',
  validateBody(donorResponseSchema),
  respondToEmergencyRequest
);

// Get Verified Donation History Records
router.get('/history', getDonorHistory);

export default router;
