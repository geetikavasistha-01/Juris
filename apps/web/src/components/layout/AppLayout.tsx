import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar.js';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-accent-teal/20 selection:text-text">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6 bg-surface/50 text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold text-text">Juris</span>
            <span>—</span>
            <span>Deterministic Civic & Legal AI. Verifiable, Citation-Backed.</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span id="app-version">v0.1.0</span>
            <span>•</span>
            <span id="app-git-sha">sha-main</span>
            <span>•</span>
            <span>Self-Hosted & Private</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
