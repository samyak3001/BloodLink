import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn('animate-pulse bg-slate-200/80 rounded-xl', className)}
      {...props}
    />
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={cn('space-y-2.5 w-full', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-3.5 rounded-md',
            i === lines - 1 ? 'w-3/5' : i % 2 === 0 ? 'w-full' : 'w-4/5'
          )}
        />
      ))}
    </div>
  );
};

export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };

  return <Skeleton className={cn('rounded-full shrink-0', sizeClasses[size], className)} />;
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('p-6 bg-white border border-slate-200/80 rounded-2xl shadow-soft space-y-4', className)}>
      <div className="flex items-center space-x-3">
        <SkeletonAvatar size="md" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
      </div>
      <SkeletonText lines={2} />
      <div className="pt-2 flex justify-between items-center border-t border-slate-100">
        <Skeleton className="h-3 w-1/5 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 4,
  columns = 4,
  className,
}) => {
  return (
    <div className={cn('w-full border border-slate-200/80 rounded-2xl bg-white shadow-soft p-4 space-y-3', className)}>
      <div className="grid grid-cols-4 gap-4 pb-3 border-b border-slate-100">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid grid-cols-4 gap-4 py-2 border-b border-slate-50 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
};
