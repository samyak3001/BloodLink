import React from 'react';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const iconConfig = {
    danger: {
      icon: <AlertCircle className="h-6 w-6 text-emergency-600" />,
      bg: 'bg-emergency-50 text-emergency-600',
      btnVariant: 'destructive' as ButtonVariant,
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
      bg: 'bg-amber-50 text-amber-600',
      btnVariant: 'primary' as ButtonVariant,
    },
    info: {
      icon: <CheckCircle2 className="h-6 w-6 text-clinical-600" />,
      bg: 'bg-clinical-50 text-clinical-600',
      btnVariant: 'clinical' as ButtonVariant,
    },
  };

  const cfg = iconConfig[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" showCloseButton={false}>
      <div className="text-center space-y-4">
        <div className={`h-12 w-12 rounded-2xl ${cfg.bg} flex items-center justify-center mx-auto shadow-soft-sm`}>
          {cfg.icon}
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={cfg.btnVariant}
            fullWidth
            isLoading={isLoading}
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
