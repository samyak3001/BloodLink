import { Router } from 'express';
import {
  getAdminAnalytics,
  getAdminUsers,
  updateUserStatus,
  verifyHospital,
  getAdminAuditLogs,
} from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  updateUserStatusSchema,
  verifyHospitalSchema,
} from '../validators/requestSchemas';

const router = Router();

// Protect all admin routes: Requires ADMIN role
router.use(authenticate, authorize('ADMIN'));

// Platform Telemetry & Analytics
router.get('/analytics', getAdminAnalytics);

// User Management: List & Filter Donors and Hospitals
router.get('/users', getAdminUsers);

// User Moderation: Activate or Suspend User Account
router.patch('/users/:id/status', validateBody(updateUserStatusSchema), updateUserStatus);

// Hospital Credential Verification: Approve or Reject License
router.patch('/hospitals/:id/verify', validateBody(verifyHospitalSchema), verifyHospital);

// Security & Audit Logs
router.get('/audit-logs', getAdminAuditLogs);

export default router;
