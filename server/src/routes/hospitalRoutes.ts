import { Router } from 'express';
import {
  getHospitalDashboard,
  getHospitalRequests,
  getHospitalProfile,
  updateHospitalProfile,
  getRegisteredDonors,
} from '../controllers/hospitalController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateHospitalProfileSchema } from '../validators/authSchemas';

const router = Router();

// Protect all hospital routes
router.use(authenticate, authorize('HOSPITAL'));

// Hospital Facility Profile Management
router.get('/profile', getHospitalProfile);
router.put('/profile', validateBody(updateHospitalProfileSchema), updateHospitalProfile);

// Hospital Dashboard Overview & Metrics
router.get('/dashboard', getHospitalDashboard);

// List All Requests Raised by This Hospital
router.get('/requests', getHospitalRequests);

// Registered Donors Platform Directory for Hospital Management
router.get('/donors', getRegisteredDonors);

export default router;

