import React from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while processing your request. Please try again.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-8 text-center flex flex-col items-center justify-center rounded-2xl border border-emergency-200 bg-emergency-50/40 shadow-soft-sm max-w-lg mx-auto space-y-3',
        className
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-emergency-100/80 border border-emergency-200 flex items-center justify-center text-emergency-600 mb-1">
        <AlertCircle className="h-6 w-6 stroke-[2]" />
      </div>

      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h4>
        <p className="text-xs text-slate-600 leading-relaxed max-w-sm">{message}</p>
      </div>

      {onRetry && (
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};
