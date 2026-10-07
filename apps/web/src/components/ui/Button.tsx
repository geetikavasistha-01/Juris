import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium font-sans rounded-md transition-colors duration-150 ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 ' +
      'disabled:opacity-50 disabled:pointer-events-none min-h-touch select-none';

    const variantStyles = {
      primary:
        'bg-accent-teal text-[var(--btn-primary-text)] font-semibold hover:bg-accent-teal-hover active:opacity-90 shadow-sm',
      secondary:
        'border border-brand-navy text-brand-navy bg-transparent hover:bg-surface-raised active:bg-border-subtle dark:border-brand-navy dark:text-brand-navy',
      ghost: 'text-text hover:bg-surface-raised active:bg-border-subtle',
      destructive:
        'bg-failed text-[var(--btn-primary-text)] font-semibold hover:opacity-90 active:opacity-80 shadow-sm',
    };

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 min-w-[36px]',
      md: 'text-small px-4 py-2 min-w-[44px]',
      lg: 'text-body px-6 py-2.5 min-w-[48px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
