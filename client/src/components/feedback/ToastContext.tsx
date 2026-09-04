import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastHelpers = {
    success: (message: string, title?: string) =>
      addToast({ type: 'success', title, message }),
    error: (message: string, title?: string) =>
      addToast({ type: 'error', title, message }),
    warning: (message: string, title?: string) =>
      addToast({ type: 'warning', title, message }),
    info: (message: string, title?: string) =>
      addToast({ type: 'info', title, message }),
  };

  const getToastIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-vitality-600 shrink-0" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-emergency-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-clinical-600 shrink-0" />;
    }
  };

  const getToastBorder = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-l-4 border-l-vitality-500 border-vitality-100 bg-vitality-50/50';
      case 'error':
        return 'border-l-4 border-l-emergency-500 border-emergency-100 bg-emergency-50/50';
      case 'warning':
        return 'border-l-4 border-l-amber-500 border-amber-100 bg-amber-50/50';
      case 'info':
      default:
        return 'border-l-4 border-l-clinical-500 border-clinical-100 bg-clinical-50/50';
    }
  };

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        toast: toastHelpers,
      }}
    >
      {children}

      {/* Toast Container */}
      <div
        aria-live="polite"
        className="fixed top-20 right-4 z-50 flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-full bg-white rounded-xl shadow-soft-lg border p-3.5 flex items-start gap-3 transition-all duration-300 animate-in slide-in-from-top-2',
              getToastBorder(t.type)
            )}
          >
            <div className="mt-0.5">{getToastIcon(t.type)}</div>
            <div className="flex-1 min-w-0">
              {t.title && (
                <h5 className="text-xs font-bold text-slate-900 tracking-tight">
                  {t.title}
                </h5>
              )}
              <p className="text-xs text-slate-700 leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
