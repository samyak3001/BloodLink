import React, { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { NotificationItem } from '../../components/notifications/NotificationItem';

export const HospitalNotificationsPage: React.FC = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'RESPONSES'>('ALL');

  const filtered = notifications.filter((n) => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'RESPONSES') {
      return n.type === 'DONOR_ACCEPTED' || n.type === 'DONOR_DECLINED';
    }
    return true;
  });

  const responseCount = notifications.filter(
    (n) => n.type === 'DONOR_ACCEPTED' || n.type === 'DONOR_DECLINED'
  ).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-soft-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Hospital Notification Feed
            </h1>
            {unreadCount > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emergency-600 text-white">
                {unreadCount} Unread
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                All Read
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Real-time donor acceptance feeds, dispatch updates, and regulatory audit alerts for your facility.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            leftIcon={<CheckCheck className="h-3.5 w-3.5" />}
          >
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          All Feed ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'UNREAD'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('RESPONSES')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === 'RESPONSES'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          Donor Responses ({responseCount})
        </button>
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0 divide-y divide-slate-100">
          {filtered.length > 0 ? (
            filtered.map((item) => (
              <NotificationItem
                key={item._id}
                notification={item}
                onMarkRead={(id) => markAsRead(id)}
              />
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title={
                  filter === 'UNREAD'
                    ? 'No Unread Notifications'
                    : filter === 'RESPONSES'
                    ? 'No Donor Responses Yet'
                    : 'Feed is Empty'
                }
                description={
                  filter === 'UNREAD'
                    ? 'All alerts for this facility have been reviewed.'
                    : filter === 'RESPONSES'
                    ? 'When nearby donors accept or decline your emergency broadcasts, they will appear here instantly.'
                    : 'Emergency broadcast responses and system notifications will be streamed here in real time.'
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
