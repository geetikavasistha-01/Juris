import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  type ThemeId,
  type ThemePreference,
  type ThemeMode,
  type ThemeFamily,
  THEMES,
  resolveTheme,
} from '@juris/shared';

export type { ThemeId, ThemePreference, ThemeMode, ThemeFamily };

export interface ThemeContextType {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  resolvedTheme: ThemeId;
  isDark: boolean;
  mode: ThemeMode;
  family: ThemeFamily;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    try {
      const stored = localStorage.getItem('juris-theme');
      if (
        stored === 'matcha-light' ||
        stored === 'matcha-dark' ||
        stored === 'mono-light' ||
        stored === 'mono-dark' ||
        stored === 'system'
      ) {
        return stored as ThemePreference;
      }
      // Migrate legacy storage values
      if (stored === 'dark') return 'matcha-dark';
      if (stored === 'light') return 'matcha-light';
    } catch {
      // fallback
    }
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: ThemeId = useMemo(() => {
    if ((theme as string) === 'light') return 'matcha-light';
    if ((theme as string) === 'dark') return 'matcha-dark';
    return resolveTheme(theme, systemIsDark);
  }, [theme, systemIsDark]);

  const metadata = THEMES[resolvedTheme];
  const isDark = metadata.mode === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.setAttribute('data-theme-mode', metadata.mode);
    document.documentElement.setAttribute('data-theme-family', metadata.family);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme, metadata, isDark]);

  const setTheme = (newTheme: ThemePreference) => {
    const canonicalTheme =
      newTheme === ('light' as ThemePreference)
        ? 'matcha-light'
        : newTheme === ('dark' as ThemePreference)
          ? 'matcha-dark'
          : newTheme;

    setThemeState(canonicalTheme);
    try {
      if (canonicalTheme === 'system') {
        localStorage.removeItem('juris-theme');
      } else {
        localStorage.setItem('juris-theme', canonicalTheme);
      }
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        isDark,
        mode: metadata.mode,
        family: metadata.family,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
