import { Router } from 'express';
import {
  getHospitalDashboard,
  getHospitalRequests,
} from '../controllers/hospitalController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Protect all hospital routes
router.use(authenticate, authorize('HOSPITAL'));

// Hospital Dashboard Overview & Metrics
router.get('/dashboard', getHospitalDashboard);

// List All Requests Raised by This Hospital
router.get('/requests', getHospitalRequests);

export default router;
