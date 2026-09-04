import { Request, Response, NextFunction } from 'express';
import { Notification } from '../models';
import { pushUnreadCount } from '../services/socketService';

/**
 * Get paginated notifications for the authenticated user
 * Only returns notifications belonging to the caller's userId
 */
export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { unread, limit = '20', page = '1' } = req.query;

    const query: Record<string, unknown> = { recipientId: req.user!.id };
    if (unread === 'true') {
      query.isRead = false;
    }

    const pageSize = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const skip = (pageNumber - 1) * pageSize;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: req.user!.id, isRead: false }),
    ]);

    res.status(200).json({
      status: 'success',
      totalCount,
      unreadCount,
      page: pageNumber,
      totalPages: Math.ceil(totalCount / pageSize),
      notifications,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a single notification as read
 * Enforces ownership: a user can only mark their own notifications
 */
export async function markNotificationRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: req.user!.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({
        status: 'fail',
        message: 'Notification not found or does not belong to you.',
      });
      return;
    }

    // Push updated unread count to client via Socket.IO
    void pushUnreadCount(req.user!.id);

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read.',
      notification,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark ALL unread notifications for the authenticated user as read
 */
export async function markAllNotificationsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await Notification.updateMany(
      { recipientId: req.user!.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    // Push updated unread count to client via Socket.IO
    void pushUnreadCount(req.user!.id);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read.',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
}
