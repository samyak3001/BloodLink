import React from 'react';
import { cn } from '../../utils/cn';

export type StatusType = 'online' | 'offline' | 'available' | 'busy' | 'critical';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  label?: string;
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  pulse = true,
  className,
  ...props
}) => {
  const statusStyles: Record<StatusType, { dot: string; text: string; defaultLabel: string }> = {
    online: {
      dot: 'bg-vitality-500',
      text: 'text-vitality-700',
      defaultLabel: 'Online',
    },
    available: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-700',
      defaultLabel: 'Available to Donate',
    },
    offline: {
      dot: 'bg-slate-400',
      text: 'text-slate-600',
      defaultLabel: 'Offline',
    },
    busy: {
      dot: 'bg-amber-500',
      text: 'text-amber-700',
      defaultLabel: 'Busy',
    },
    critical: {
      dot: 'bg-emergency-600',
      text: 'text-emergency-700 font-bold',
      defaultLabel: 'Critical Alert',
    },
  };

  const cfg = statusStyles[status];

  return (
    <span
      className={cn('inline-flex items-center gap-2 text-xs font-semibold', cfg.text, className)}
      {...props}
    >
      <span className="relative flex h-2 w-2">
        {pulse && status !== 'offline' && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
              cfg.dot
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full h-2 w-2', cfg.dot)} />
      </span>
      <span>{label || cfg.defaultLabel}</span>
    </span>
  );
};
