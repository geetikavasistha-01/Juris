import React from 'react';
import { useTheme } from './theme.js';

// Declared via vite.config.ts define
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;

export const App: React.FC = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
  const gitSha = typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev';

  return (
    <main className="min-h-screen flex flex-col justify-between p-8 bg-background text-text transition-colors duration-200">
      <header className="flex justify-between items-center max-w-4xl w-full mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-text">Juris</h1>
        <div className="flex items-center space-x-2">
          <label htmlFor="theme-select" className="text-xs text-text-muted">
            Theme:
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="text-xs rounded border border-border bg-surface text-text px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="system">System ({resolvedTheme})</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center max-w-2xl mx-auto my-12">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm w-full">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accent/10 text-accent mb-4">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">Juris</h2>
          <p className="text-sm text-text-muted mb-6">Foundational service initialized.</p>

          <dl className="grid grid-cols-2 gap-4 text-left border-t border-border pt-4 text-xs">
            <div>
              <dt className="text-text-muted">Version</dt>
              <dd id="app-version" className="font-mono font-medium text-text mt-0.5">
                {version}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Git SHA</dt>
              <dd id="app-git-sha" className="font-mono font-medium text-text mt-0.5">
                {gitSha}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <footer className="text-center text-xs text-text-muted border-t border-border pt-4 max-w-4xl w-full mx-auto">
        <p>Juris &middot; Phase 0 Foundation</p>
      </footer>
    </main>
  );
};

export default App;
