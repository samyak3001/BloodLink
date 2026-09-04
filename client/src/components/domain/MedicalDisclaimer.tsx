import React from 'react';
import { ShieldAlert, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface MedicalDisclaimerProps {
  variant?: 'banner' | 'card' | 'compact';
  className?: string;
}

export const MedicalDisclaimer: React.FC<MedicalDisclaimerProps> = ({
  variant = 'banner',
  className,
}) => {
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-900',
          className
        )}
      >
        <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
        <p className="leading-tight">
          <strong className="font-semibold text-amber-950">Coordination Platform:</strong> Screening is self-reported; final medical eligibility is determined exclusively on-site by authorized healthcare personnel.
        </p>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'p-5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-soft-sm space-y-2',
          className
        )}
      >
        <div className="flex items-center space-x-2 text-amber-900">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0" />
          <h4 className="font-bold text-xs tracking-tight text-amber-950 uppercase">
            Medical Safety & Verification Principle
          </h4>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">
          BloodLink is strictly an emergency coordination and matching engine. It does not perform clinical diagnoses nor does it certify medical fitness. Potential donor eligibility is based solely on self-reported questionnaires; final blood compatibility and donor eligibility verification is performed exclusively by authorized healthcare providers.
        </p>
      </div>
    );
  }

  // Default 'banner' variant
  return (
    <aside
      role="note"
      aria-label="Medical safety notice"
      className={cn(
        'w-full rounded-2xl bg-amber-50 border border-amber-200/90 p-4 text-xs text-amber-900 shadow-soft-sm flex items-start space-x-3.5',
        className
      )}
    >
      <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
        <AlertCircle className="h-5 w-5 text-amber-700" />
      </div>
      <div className="space-y-1">
        <h4 className="font-bold tracking-tight text-amber-950 text-sm">
          Important Medical Safety Notice
        </h4>
        <p className="text-amber-900 leading-relaxed">
          BloodLink facilitates real-time communication between hospitals and prospective donors during emergencies. <strong>Self-reported screening is not medical clearance.</strong> Algorithmic match scores indicate approximate compatibility and proximity; full donor screening, cross-matching, and health evaluation are conducted strictly by medical staff prior to collection.
        </p>
      </div>
    </aside>
  );
};
