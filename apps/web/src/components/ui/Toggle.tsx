import React from 'react';

export interface ToggleProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onChange'
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: 'sm' | 'md';
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      checked,
      onChange,
      label,
      description,
      size = 'md',
      disabled = false,
      className = '',
      id,
      ...props
    },
    ref,
  ) => {
    const toggleId = id || React.useId();

    const trackSizes = {
      sm: 'w-8 h-4.5 p-0.5',
      md: 'w-11 h-6 p-0.5',
    };

    const thumbSizes = {
      sm: 'w-3.5 h-3.5',
      md: 'w-5 h-5',
    };

    const thumbTranslate = {
      sm: checked ? 'translate-x-3.5' : 'translate-x-0',
      md: checked ? 'translate-x-5' : 'translate-x-0',
    };

    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <button
          ref={ref}
          id={toggleId}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={`
            relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out cursor-pointer
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${trackSizes[size]}
            ${checked ? 'bg-accent-teal' : 'bg-border-strong/40'}
          `}
          {...props}
        >
          <span
            className={`
              pointer-events-none inline-block rounded-full bg-surface-raised shadow-xs transform ring-0 transition duration-200 ease-in-out
              ${thumbSizes[size]}
              ${thumbTranslate[size]}
            `}
          />
        </button>
        {(label || description) && (
          <label htmlFor={toggleId} className="cursor-pointer select-none">
            {label && <span className="text-small font-medium text-text block">{label}</span>}
            {description && <span className="text-xs text-text-muted block">{description}</span>}
          </label>
        )}
      </div>
    );
  },
);

Toggle.displayName = 'Toggle';
