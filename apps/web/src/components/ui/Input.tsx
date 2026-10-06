import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, label, helperText, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-small font-medium text-text">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          disabled={disabled}
          className={`w-full min-h-touch px-3.5 py-2 rounded-md bg-surface text-text border text-body font-sans transition-colors placeholder:text-text-subtle
            ${error ? 'border-failed focus-visible:ring-failed' : 'border-border focus-visible:border-accent-teal focus-visible:ring-focus-ring'}
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
            disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed
            ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-caption text-failed font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-caption text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
