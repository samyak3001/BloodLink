import React, { useId } from 'react';
import { cn } from '../../utils/cn';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id: customId,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-xs font-semibold text-slate-700 tracking-wide"
          >
            {label}
            {required && <span className="text-emergency-600 ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            className={cn(
              'w-full bg-white border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 py-2 transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              leftIcon ? 'pl-10' : 'pl-3.5',
              rightIcon || error ? 'pr-10' : 'pr-3.5',
              error
                ? 'border-emergency-300 focus:border-emergency-500 focus:ring-emergency-100'
                : 'border-slate-200 hover:border-slate-300 focus:border-clinical-500 focus:ring-clinical-100',
              className
            )}
            {...props}
          />

          {error ? (
            <div className="absolute right-3 text-emergency-500 pointer-events-none flex items-center">
              <AlertCircle className="h-4 w-4" />
            </div>
          ) : (
            rightIcon && (
              <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center justify-center">
                {rightIcon}
              </div>
            )
          )}
        </div>

        {error && (
          <p id={errorId} className="text-xs font-medium text-emergency-600 flex items-center gap-1 mt-1">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs text-slate-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
