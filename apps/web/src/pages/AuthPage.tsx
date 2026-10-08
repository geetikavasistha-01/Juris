import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { Card, JurisLogo } from '../components/ui/index.js';
import {
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  User as UserIcon,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp, signInAsGuest } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      navigate('/documents');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInAsGuest();
      navigate('/documents');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Guest sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto py-6 sm:py-10 space-y-8">
      {/* Editorial Ledger Context Header */}
      <div className="w-full pb-4 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-border-subtle border border-border mb-2">
            <span className="w-2 h-2 rounded-full bg-text"></span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-text font-semibold">
              Component Specification • Authentication
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-text tracking-tight">
            {mode === 'signin' ? 'Sign in to Juris Ledger' : 'Create Civic Analyst Account'}
          </h1>
          <p className="text-xs sm:text-sm text-text-subtle mt-0.5">
            Cryptographic credential challenge and verified boundary access.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-text-subtle">
          <div className="flex flex-col text-right">
            <span className="uppercase text-[10px] text-text-muted">Cadence Standard</span>
            <span className="font-bold text-text">8pt Strict Baseline</span>
          </div>
          <div className="h-6 w-px bg-border"></div>
          <div className="flex flex-col text-right">
            <span className="uppercase text-[10px] text-text-muted">Ledger Protocol</span>
            <span className="font-bold text-text">SEC-AUTH-2025</span>
          </div>
        </div>
      </div>

      {/* Main Form Center Card */}
      <div className="max-w-[440px] mx-auto">
        <Card className="p-6 sm:p-8 bg-surface border border-border rounded-xl shadow-xs space-y-6">
          {/* Monogram & Badge */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-text text-text-inverse flex items-center justify-center shadow-xs">
              <JurisLogo size={24} iconOnly />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-border-subtle border border-border-strong font-mono text-[10px] uppercase font-semibold text-text">
              <ShieldCheck className="w-3 h-3 text-text" />
              <span>Public Access</span>
            </span>
          </div>

          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-text tracking-tight">
              {mode === 'signin' ? 'Welcome back' : 'Join the Registry'}
            </h2>
            <p className="text-xs text-text-subtle mt-1">
              {mode === 'signin'
                ? 'Sign in to access your civic dossiers and verification logs.'
                : 'Create an account to retain your parsed civic documents indefinitely.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-failed-bg border border-failed text-failed text-xs flex items-start gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Validation error</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text block" htmlFor="email-input">
                Email address
              </label>
              <input
                id="email-input"
                type="email"
                required
                placeholder="name@organisation.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 bg-surface border border-border-strong rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-text focus:ring-2 focus:ring-border-subtle transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text block" htmlFor="password-input">
                  Password
                </label>
                {mode === 'signin' && (
                  <span className="text-xs text-text-subtle hover:underline cursor-pointer">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-10 bg-surface border border-border-strong rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-text focus:ring-2 focus:ring-border-subtle transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 text-text-muted hover:text-text transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-text text-text-inverse font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer mt-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <span className="relative px-3 bg-surface font-mono text-[11px] text-text-muted lowercase">
              or
            </span>
          </div>

          {/* Guest CTA */}
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full h-11 rounded-lg bg-border-subtle hover:bg-border text-text font-semibold text-sm border border-border-strong transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <UserIcon className="w-4 h-4" />
            <span>Continue as Demo Guest</span>
          </button>

          <div className="flex items-center justify-center gap-1 text-[11px] text-text-subtle font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Guest documents are retained for current browser session</span>
          </div>

          {/* Footer toggle */}
          <div className="pt-4 border-t border-border text-center text-xs text-text-subtle">
            {mode === 'signin' ? (
              <p>
                New to Juris?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-bold text-text underline underline-offset-2 hover:opacity-80 ml-1"
                >
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-bold text-text underline underline-offset-2 hover:opacity-80 ml-1"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
