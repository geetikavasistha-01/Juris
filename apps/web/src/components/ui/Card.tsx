import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'raised' | 'subtle';
}

export const Card: React.FC<CardProps> = ({
  className = '',
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-surface border border-border',
    raised: 'bg-surface-raised border border-border-strong shadow-sm',
    subtle: 'bg-bg border border-border-subtle',
  };

  return (
    <div
      className={`rounded-lg transition-colors duration-150 ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`p-5 pb-3 flex flex-col gap-1 border-b border-border-subtle ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <h3 className={`text-h3 font-serif font-semibold text-text ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <p className={`text-small text-text-muted font-sans ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`p-5 pt-3 border-t border-border-subtle flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
