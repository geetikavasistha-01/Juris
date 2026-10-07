import React from 'react';

interface JurisLogoProps {
  /** Size in pixels (applies to icon/emblem height or full logo width) */
  size?: number | string;
  /** Whether to show only the circular emblem mark */
  iconOnly?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Optional variant for specific theme overrides */
  variant?: 'auto' | 'light' | 'dark';
}

/**
 * Juris Brand Logo Component
 * Renders vector SVG emblem matching the brand identity:
 * - Circular civic ring with folded document sector in accent teal
 * - Classical judicial pillars & pediment inside
 * - High-legibility wordmark "Juris"
 */
export const JurisLogo: React.FC<JurisLogoProps> = ({
  size = 36,
  iconOnly = false,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      style={{ height: typeof size === 'number' ? `${size}px` : size }}
    >
      {/* Emblem SVG */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto shrink-0 transition-transform duration-200 group-hover:scale-105"
        style={{ aspectRatio: '1/1' }}
        aria-hidden="true"
      >
        {/* Outer Circular Navy Arc (3/4 Ring) */}
        <path
          d="M 50 12 
             A 38 38 0 1 0 88 50 
             L 74 50 
             A 24 24 0 1 1 50 26 
             Z"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />

        {/* Top-Right Folded Document Wedge (Teal) */}
        <path
          d="M 54 12
             L 85 43
             A 38 38 0 0 0 54 12
             Z"
          className="fill-accent-teal transition-colors"
        />

        {/* Inner Classical Judicial Pediment & Pillars */}
        {/* Pediment Triangle Roof */}
        <path
          d="M 32 46 L 50 36 L 68 46 Z"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />
        {/* Entablature Beam under roof */}
        <rect
          x="33"
          y="47"
          width="34"
          height="2.5"
          rx="0.5"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />
        {/* 3 Pillars */}
        <rect
          x="37"
          y="51"
          width="4.5"
          height="14"
          rx="1"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />
        <rect
          x="47.75"
          y="51"
          width="4.5"
          height="14"
          rx="1"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />
        <rect
          x="58.5"
          y="51"
          width="4.5"
          height="14"
          rx="1"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />
        {/* Base Floor */}
        <rect
          x="33"
          y="66"
          width="34"
          height="3"
          rx="0.75"
          className="fill-brand-navy dark:fill-brand-navy-hover transition-colors"
        />
      </svg>

      {/* Wordmark */}
      {!iconOnly && (
        <span className="font-serif font-bold text-2xl tracking-tight text-text leading-none">
          Juris
        </span>
      )}
    </div>
  );
};
