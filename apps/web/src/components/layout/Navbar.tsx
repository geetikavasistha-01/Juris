import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../theme.js';
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
import { Button } from '../ui/index.js';

export const Navbar: React.FC = () => {
  const { theme, setTheme } = useTheme();
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
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link
            to="/documents"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-navy flex items-center justify-center text-white font-serif font-bold text-xl shadow-sm">
              §
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif font-semibold text-lg text-text tracking-tight">Juris</h1>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-raised border border-border text-text-muted">
                  Civic AI
                </span>
              </div>
              <p className="text-xs text-text-subtle hidden sm:block">
                Legal & Fiscal Intelligence
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <Link
              to="/documents"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isNavActive('/documents')
                  ? 'bg-surface-raised text-text border border-border shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-raised/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Documents
            </Link>

            <Link
              to="/upload"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isNavActive('/upload')
                  ? 'bg-surface-raised text-text border border-border shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-raised/50'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </Link>

            <Link
              to="/design"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isNavActive('/design')
                  ? 'bg-surface-raised text-text border border-border shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-raised/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-accent-teal" />
              Design System
            </Link>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Selector */}
          <div className="flex items-center bg-surface-raised border border-border rounded-lg p-0.5">
            <select
              id="theme-select"
              aria-label="Theme selector"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              className="sr-only"
            >
              <option value="light">light</option>
              <option value="dark">dark</option>
              <option value="system">system</option>
            </select>
            <button
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'light'
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
              title="Light theme"
              aria-label="Light theme"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-md transition-colors ${
                theme === 'dark'
                  ? 'bg-surface text-text shadow-xs'
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
                  ? 'bg-surface text-text shadow-xs'
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
              <span className="text-xs font-mono text-text-muted hidden lg:inline-block max-w-[150px] truncate">
                {user.email || 'Civic Analyst'}
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
