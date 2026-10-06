import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'teal' | 'navy';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium font-mono rounded-full select-none';

  const variantStyles = {
    neutral: 'bg-surface-raised text-text-muted border border-border',
    teal: 'bg-accent-teal-subtle text-accent-teal border border-accent-teal-border',
    navy: 'bg-surface-raised text-brand-navy border border-border-strong',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-caption px-2.5 py-1',
  };

  return (
    <span
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
