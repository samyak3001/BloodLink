import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { CheckCheck, Inbox } from 'lucide-react';

interface NotificationDropdownProps {
  onClose?: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  return (
    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Notifications</h3>
          <p className="text-[11px] text-slate-500">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-clinical-600 hover:text-clinical-700 font-medium flex items-center gap-1 bg-clinical-50 px-2 py-1 rounded-md"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {isLoading && notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <div className="animate-spin h-5 w-5 border-2 border-clinical-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notification) => (
            <NotificationItem
              key={notification._id}
              notification={notification}
              onMarkRead={markAsRead}
            />
          ))
        ) : (
          <div className="p-10 text-center text-slate-400 flex flex-col items-center">
            <Inbox className="h-8 w-8 mb-2 opacity-20" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-xs mt-1 text-slate-400">We'll let you know when something happens</p>
          </div>
        )}
      </div>
    </div>
  );
};
