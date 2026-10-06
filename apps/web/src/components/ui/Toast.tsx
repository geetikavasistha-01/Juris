import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id?: string;
  type?: ToastType;
  title: string;
  message?: string;
  onDismiss?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  title,
  message,
  onDismiss,
  className = '',
}) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-verified shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-failed shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-unverified shrink-0" />,
    info: <Info className="w-5 h-5 text-accent-teal shrink-0" />,
  };

  const borderStyles = {
    success: 'border-verified-border',
    error: 'border-failed-border',
    warning: 'border-unverified-border',
    info: 'border-accent-teal-border',
  };

  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`flex items-start gap-3 p-4 bg-surface border rounded-lg shadow-md max-w-sm ${borderStyles[type]} ${className}`}
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        <h4 className="text-small font-medium text-text">{title}</h4>
        {message && <p className="text-caption text-text-muted mt-0.5">{message}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss toast"
          className="text-text-muted hover:text-text p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
