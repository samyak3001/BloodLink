import React from 'react';
import { cn } from '../../utils/cn';
import { BloodGroup, RequestUrgency, RequestStatus, UserRole } from '../../types';

export type BadgeVariant =
  | 'default'
  | 'emergency'
  | 'clinical'
  | 'vitality'
  | 'outline'
  | 'warning'
  | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  urgency?: RequestUrgency;
  status?: RequestStatus;
  bloodGroup?: BloodGroup;
  role?: UserRole;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  urgency,
  status,
  bloodGroup,
  role,
  dot = false,
  children,
  ...props
}) => {
  // If urgency is provided, compute specific urgency styling
  if (urgency) {
    const urgencyConfig: Record<RequestUrgency, { bg: string; dot: string; label: string }> = {
      CRITICAL: {
        bg: 'bg-emergency-50 text-emergency-700 border-emergency-200 ring-emergency-200',
        dot: 'bg-emergency-600 animate-ping',
        label: 'Critical',
      },
      HIGH: {
        bg: 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-200',
        dot: 'bg-amber-500',
        label: 'High Urgency',
      },
      MEDIUM: {
        bg: 'bg-clinical-50 text-clinical-700 border-clinical-200 ring-clinical-200',
        dot: 'bg-clinical-500',
        label: 'Medium Urgency',
      },
    };

    const cfg = urgencyConfig[urgency];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-soft-sm tracking-wide',
          cfg.bg,
          className
        )}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          {urgency === 'CRITICAL' && (
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', cfg.dot)} />
          )}
          <span className={cn('relative inline-flex rounded-full h-2 w-2', cfg.dot.split(' ')[0])} />
        </span>
        {children || cfg.label}
      </span>
    );
  }

  // If request status is provided
  if (status) {
    const statusConfig: Record<RequestStatus, { bg: string; dot: string; label: string }> = {
      ACTIVE: {
        bg: 'bg-clinical-50 text-clinical-700 border-clinical-200',
        dot: 'bg-clinical-500',
        label: 'Active',
      },
      MATCHED: {
        bg: 'bg-vitality-50 text-vitality-700 border-vitality-200',
        dot: 'bg-vitality-500 animate-pulse',
        label: 'Matched',
      },
      FULFILLED: {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-600',
        label: 'Fulfilled',
      },
      CANCELLED: {
        bg: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
        label: 'Cancelled',
      },
      EXPIRED: {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-400',
        label: 'Expired',
      },
    };

    const cfg = statusConfig[status];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-soft-sm',
          cfg.bg,
          className
        )}
        {...props}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot.split(' ')[0])} />
        {children || cfg.label}
      </span>
    );
  }

  // If blood group is provided
  if (bloodGroup) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center font-extrabold text-white bg-emergency-600 border border-emergency-700 shadow-soft',
          'px-2.5 py-1 rounded-lg text-xs font-mono tracking-tight',
          className
        )}
        {...props}
      >
        {children || bloodGroup}
      </span>
    );
  }

  // If user role is provided
  if (role) {
    const roleConfig: Record<UserRole, string> = {
      DONOR: 'bg-vitality-50 text-vitality-700 border-vitality-200',
      HOSPITAL: 'bg-clinical-50 text-clinical-700 border-clinical-200',
      ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    };

    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border shadow-soft-sm tracking-wide',
          roleConfig[role],
          className
        )}
        {...props}
      >
        {children || role}
      </span>
    );
  }

  // Generic variants
  const genericStyles: Record<BadgeVariant, string> = {
    default: 'bg-slate-100 text-slate-800 border-slate-200',
    emergency: 'bg-emergency-50 text-emergency-700 border-emergency-200',
    clinical: 'bg-clinical-50 text-clinical-700 border-clinical-200',
    vitality: 'bg-vitality-50 text-vitality-700 border-vitality-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-slate-50 text-slate-600 border-slate-200',
    outline: 'border border-slate-300 text-slate-700 bg-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-soft-sm',
        genericStyles[variant],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
};
