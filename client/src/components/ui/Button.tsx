import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ButtonVariant =
  | 'primary'
  | 'emergency'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'vitality'
  | 'clinical'
  | 'destructive';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-emergency-600 hover:bg-emergency-700 text-white shadow-soft hover:shadow-soft-md focus-visible:ring-emergency-500',
      emergency:
        'bg-emergency-600 hover:bg-emergency-700 text-white shadow-soft hover:shadow-soft-md focus-visible:ring-emergency-500',
      secondary:
        'bg-slate-100 hover:bg-slate-200 text-slate-800 focus-visible:ring-slate-400',
      outline:
        'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 focus-visible:ring-clinical-500',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400',
      vitality:
        'bg-vitality-600 hover:bg-vitality-700 text-white shadow-soft hover:shadow-soft-md focus-visible:ring-vitality-500',
      clinical:
        'bg-clinical-600 hover:bg-clinical-700 text-white shadow-soft hover:shadow-soft-md focus-visible:ring-clinical-500',
      destructive:
        'bg-red-700 hover:bg-red-800 text-white shadow-soft hover:shadow-soft-md focus-visible:ring-red-600',
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5',
      md: 'text-sm px-4 py-2 rounded-xl gap-2',
      lg: 'text-base px-5 py-2.5 rounded-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
