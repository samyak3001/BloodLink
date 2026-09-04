import { Router } from 'express';
import {
  exportUserData,
  updatePrivacySettings,
  changePassword,
  deleteAccount,
} from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All user settings and data governance routes require authentication
router.use(authenticate);

// Data portability and export (Prompt.md rule 633)
router.get('/export-data', exportUserData);

// Privacy settings (Prompt.md rule 631)
router.patch('/privacy', updatePrivacySettings);

// Password change
router.put('/password', changePassword);

// Self-service account deletion & anonymization (Prompt.md rule 632)
router.delete('/account', deleteAccount);

export default router;
