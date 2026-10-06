import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from './Button.js';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <FileText className="w-10 h-10 text-text-muted" />,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-border rounded-xl bg-surface/50 ${className}`}
    >
      <div className="p-3 mb-3 rounded-full bg-surface border border-border flex items-center justify-center">
        {icon}
      </div>
      <h4 className="text-h3 font-serif font-semibold text-text">{title}</h4>
      <p className="text-small text-text-muted font-sans max-w-sm mt-1 mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
