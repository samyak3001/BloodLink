import { Router } from 'express';
import {
  getDonorDashboard,
  toggleDonorAvailability,
  updateDonorScreening,
  respondToEmergencyRequest,
  getDonorHistory,
  getDonorProfile,
  updateDonorLocation,
} from '../controllers/donorController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  donorAvailabilitySchema,
  donorScreeningSchema,
  donorResponseSchema,
  updateDonorLocationSchema,
} from '../validators/requestSchemas';

const router = Router();

// Protect all donor routes
router.use(authenticate, authorize('DONOR'));

// Donor Profile & Location Management
router.get('/profile', getDonorProfile);
router.put('/location', validateBody(updateDonorLocationSchema), updateDonorLocation);
router.patch('/location', validateBody(updateDonorLocationSchema), updateDonorLocation);

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
