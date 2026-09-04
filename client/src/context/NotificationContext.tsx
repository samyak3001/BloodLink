import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Notification } from '../types';
import { EmergencyAlertPayload, NotificationCountPayload } from '../types/socket';
import { getNotificationsApi, markNotificationReadApi, markAllNotificationsReadApi } from '../api/notificationsApi';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  latestEmergencyAlert: EmergencyAlertPayload | null; // For toast
  clearEmergencyAlert: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [latestEmergencyAlert, setLatestEmergencyAlert] = useState<EmergencyAlertPayload | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const data = await getNotificationsApi({ limit: '50' });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await markNotificationReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      // unreadCount will be updated via socket shortly, but we can optimistically update
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
    }
  };

  const clearEmergencyAlert = useCallback(() => {
    setLatestEmergencyAlert(null);
  }, []);

  // Socket listeners
  useSocketEvent('notification:unread-count', useCallback((data: NotificationCountPayload) => {
    setUnreadCount(data.unreadCount);
  }, []));

  useSocketEvent('emergency:alert', useCallback((payload: EmergencyAlertPayload) => {
    setLatestEmergencyAlert(payload);
    fetchNotifications(); // Refresh list to get the new DB notification
  }, [fetchNotifications]));

  useSocketEvent('donor:response', useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]));

  useSocketEvent('request:updated', useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]));

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        latestEmergencyAlert,
        clearEmergencyAlert,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}
