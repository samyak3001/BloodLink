import React from 'react';
import { Bell, ShieldAlert, HeartPulse, Info, CheckCircle } from 'lucide-react';
import { Notification } from '../../types';
import { cn } from '../../utils/cn';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkRead }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'EMERGENCY_ALERT':
        return <ShieldAlert className="h-5 w-5 text-emergency-600" />;
      case 'DONOR_ACCEPTED':
        return <HeartPulse className="h-5 w-5 text-vitality-600" />;
      case 'STATUS_UPDATE':
        return <Info className="h-5 w-5 text-clinical-600" />;
      case 'SYSTEM':
      case 'DONOR_DECLINED':
      default:
        return <Bell className="h-5 w-5 text-slate-500" />;
    }
  };

  return (
    <div
      className={cn(
        'p-4 border-b border-slate-100 transition-colors',
        !notification.isRead ? 'bg-clinical-50/50' : 'bg-white'
      )}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold truncate', !notification.isRead ? 'text-slate-900' : 'text-slate-700')}>
            {notification.title}
          </p>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-medium text-slate-400">
              {new Date(notification.createdAt).toLocaleString()}
            </span>
            {!notification.isRead && (
              <button
                onClick={() => onMarkRead(notification._id)}
                className="text-xs text-clinical-600 hover:text-clinical-700 font-medium flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
