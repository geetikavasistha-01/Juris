import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button.js';

export interface ErrorStateProps {
  title?: string;
  message: string;
  code?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Processing Error',
  message,
  code,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-8 text-center border border-failed-border rounded-xl bg-failed-bg/30 ${className}`}
    >
      <div className="p-3 mb-3 rounded-full bg-failed-bg border border-failed-border flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-failed" />
      </div>
      <h4 className="text-h3 font-serif font-semibold text-text">{title}</h4>
      <p className="text-small text-text-muted font-sans max-w-sm mt-1 mb-2">{message}</p>
      {code && (
        <span className="text-caption font-mono bg-surface px-2.5 py-0.5 rounded border border-border text-failed mb-4">
          Error Code: {code}
        </span>
      )}
      {onRetry && (
        <Button variant="secondary" size="md" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          <span>Retry Operation</span>
        </Button>
      )}
    </div>
  );
};
