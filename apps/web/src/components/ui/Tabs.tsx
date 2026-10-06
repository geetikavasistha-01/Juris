import React, { createContext, useContext, useState, useRef } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (id: string) => void;
  tabTriggersRef: React.MutableRefObject<Map<string, HTMLButtonElement>>;
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
  const tabTriggersRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const setActiveTab = (tabId: string) => {
    if (value === undefined) {
      setActiveTabState(tabId);
    }
    onValueChange?.(tabId);
  };

  return (
    <TabsContext.Provider value={{ activeTab: currentTab, setActiveTab, tabTriggersRef }}>
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
  const context = useContext(TabsContext);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!context) return;
    const triggers = Array.from(context.tabTriggersRef.current.entries());
    if (triggers.length === 0) return;

    const currentIndex = triggers.findIndex(([val]) => val === context.activeTab);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % triggers.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = triggers.length - 1;
    } else {
      return;
    }

    const nextItem = triggers[nextIndex];
    if (nextItem) {
      context.setActiveTab(nextItem[0]);
      nextItem[1]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
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
      id={`tab-trigger-${value}`}
      aria-controls={`tab-panel-${value}`}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      ref={(el) => {
        if (el) {
          context.tabTriggersRef.current.set(value, el);
        } else {
          context.tabTriggersRef.current.delete(value);
        }
      }}
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
      id={`tab-panel-${value}`}
      aria-labelledby={`tab-trigger-${value}`}
      tabIndex={0}
      className={`mt-3 focus-visible:outline-none ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
