import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme, type ThemePreference } from '../../theme.js';
import { useAuth } from '../../lib/auth.js';
import {
  Sun,
  Moon,
  Monitor,
  FileText,
  Upload,
  ShieldCheck,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { Button, JurisLogo } from '../ui/index.js';

export const Navbar: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isNavActive = (path: string) => {
    if (
      path === '/documents' &&
      (location.pathname === '/' || location.pathname === '/documents')
    ) {
      return true;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            to="/upload"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded py-1"
          >
            <span className="w-8 h-8 rounded-lg border border-border-strong flex items-center justify-center bg-surface shadow-xs group-hover:bg-border-subtle transition-colors">
              <JurisLogo size={22} iconOnly />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-serif font-bold text-2xl text-text tracking-tight leading-none">
                Juris
              </span>
              <span className="text-[11px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-text-subtle hidden sm:inline-block">
                v2.4
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
            <Link
              to="/upload"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isNavActive('/upload')
                  ? 'bg-surface text-text border border-border-strong shadow-xs font-semibold'
                  : 'text-text-subtle hover:text-text hover:bg-surface/60'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Workspace</span>
            </Link>

            <Link
              to="/documents"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isNavActive('/documents')
                  ? 'bg-surface text-text border border-border-strong shadow-xs font-semibold'
                  : 'text-text-subtle hover:text-text hover:bg-surface/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Library</span>
            </Link>

            <Link
              to="/design"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isNavActive('/design')
                  ? 'bg-surface text-text border border-border-strong shadow-xs font-semibold'
                  : 'text-text-subtle hover:text-text hover:bg-surface/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-text-muted" />
              <span>Ledger Specs</span>
            </Link>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Language Toggle */}
          <div className="hidden sm:flex items-center border border-border rounded-full p-0.5 bg-surface text-xs font-medium">
            <span className="px-2.5 py-1 rounded-full bg-border-subtle text-text font-semibold">
              EN
            </span>
            <span className="px-2.5 py-1 rounded-full text-text-muted hover:text-text transition-colors cursor-pointer">
              हिन्दी
            </span>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
            <select
              id="theme-select"
              aria-label="Theme selector"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemePreference)}
              className="bg-transparent text-xs font-sans font-medium text-text px-1.5 py-1 border-0 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring cursor-pointer"
            >
              <option value="system">System ({resolvedTheme})</option>
              <option value="matcha-light">Matcha Light</option>
              <option value="matcha-dark">Matcha Dark</option>
              <option value="mono-light">Mono Light</option>
              <option value="mono-dark">Mono Dark</option>
            </select>
            <button
              onClick={() => setTheme('matcha-light')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'matcha-light' || (theme as string) === 'light'
                  ? 'bg-border-subtle text-text shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Light theme"
              aria-label="Light theme"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('matcha-dark')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'matcha-dark' || (theme as string) === 'dark'
                  ? 'bg-border-subtle text-text shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Dark theme"
              aria-label="Dark theme"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'system'
                  ? 'bg-border-subtle text-text shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="System preference theme"
              aria-label="System theme"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile / Auth */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-text-subtle hidden lg:inline-block max-w-[150px] truncate">
                {user.email || 'Guest Analyst'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-text-muted hover:text-failed"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Sign Out</span>
              </Button>
            </div>
          ) : (
            <Link to="/login">
              <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
