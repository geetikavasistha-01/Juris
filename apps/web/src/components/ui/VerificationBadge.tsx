import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export type VerificationVariant = 'verified' | 'unverified' | 'failed';

export interface VerificationBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: VerificationVariant;
  page?: number | null;
  customLabel?: string;
  size?: 'sm' | 'md';
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  variant,
  page,
  customLabel,
  size = 'md',
  className = '',
  ...props
}) => {
  const getLabel = () => {
    if (customLabel) return customLabel;
    if (variant === 'verified') {
      return page ? `Verified, p. ${page}` : 'Verified';
    }
    if (variant === 'unverified') {
      return page ? `Unverified, p. ${page}` : 'Unverified';
    }
    return page ? `Failed, p. ${page}` : 'Failed';
  };

  const icons = {
    verified: (
      <CheckCircle2 className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
    ),
    unverified: (
      <AlertTriangle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />
    ),
    failed: <XCircle className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden="true" />,
  };

  // Distinct border styles and treatments ensuring full readability in grayscale
  const variantStyles = {
    verified: 'bg-verified-bg text-verified border border-verified-border font-medium shadow-none',
    unverified:
      'bg-unverified-bg text-unverified border border-dashed border-unverified-border font-normal italic',
    failed: 'bg-failed-bg text-failed border border-failed-border font-medium',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-caption px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={`inline-flex items-center font-mono rounded-full select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      role="status"
      aria-label={getLabel()}
      {...props}
    >
      {icons[variant]}
      <span className="tabular-nums tracking-tight">{getLabel()}</span>
    </span>
  );
};
