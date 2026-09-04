import { Router } from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// GET /api/notifications — List caller's notifications (supports ?unread=true&page=&limit=)
router.get('/', getNotifications);

// PATCH /api/notifications/read-all — Mark every unread notification as read (must come before /:id)
router.patch('/read-all', markAllNotificationsRead);

// PATCH /api/notifications/:id/read — Mark a single notification as read
router.patch('/:id/read', markNotificationRead);

export default router;
