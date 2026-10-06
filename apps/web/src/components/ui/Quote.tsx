import React from 'react';

export interface QuoteProps extends React.HTMLAttributes<HTMLQuoteElement> {
  page?: number;
  citation?: string;
}

export const Quote: React.FC<QuoteProps> = ({
  className = '',
  page,
  citation,
  children,
  ...props
}) => {
  return (
    <blockquote
      className={`my-3 p-3.5 pl-4 rounded-r-md border-l-4 border-quote-border bg-quote-highlight text-text font-mono text-small leading-relaxed relative ${className}`}
      {...props}
    >
      <div className="italic select-text">{children}</div>
      {(page !== undefined || citation) && (
        <div className="mt-2 flex items-center justify-end">
          <span className="text-caption font-mono text-text-muted bg-surface/80 px-2 py-0.5 rounded border border-border tabular-nums select-none">
            {citation ? citation : `Source: p. ${page}`}
          </span>
        </div>
      )}
    </blockquote>
  );
};
