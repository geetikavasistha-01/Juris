import React from 'react';
import { Drawer, type DrawerProps } from './Drawer.js';

export interface SheetProps extends DrawerProps {
  description?: string;
}

export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  position = 'right',
  className = '',
}) => {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      position={position}
      className={className}
    >
      {description && <p className="text-small text-text-muted mb-4 -mt-2">{description}</p>}
      {children}
    </Drawer>
  );
};
