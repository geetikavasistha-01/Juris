import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  className = '',
  children,
  ...props
}) => {
  const [activeTab, setActiveTabState] = useState(defaultValue);
  const currentTab = value !== undefined ? value : activeTab;

  const setActiveTab = (tabId: string) => {
    if (value === undefined) {
      setActiveTabState(tabId);
    }
    onValueChange?.(tabId);
  };

  return (
    <TabsContext.Provider value={{ activeTab: currentTab, setActiveTab }}>
      <div className={`w-full flex flex-col ${className}`} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 p-1 bg-surface border border-border rounded-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  className = '',
  children,
  ...props
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.activeTab === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={() => context.setActiveTab(value)}
      className={`px-3.5 py-1.5 text-small font-sans font-medium rounded-md transition-all duration-150 select-none min-h-[36px]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring
        ${
          isActive
            ? 'bg-surface-raised text-text border border-border shadow-xs'
            : 'text-text-muted hover:text-text hover:bg-surface-raised/50'
        } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  className = '',
  children,
  ...props
}) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={`mt-3 focus-visible:outline-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
