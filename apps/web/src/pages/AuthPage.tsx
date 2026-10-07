import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { Button, Input, Card, Toast } from '../components/ui/index.js';
import { ShieldCheck, Lock, UserCheck, Loader2 } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp, signInAsGuest } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="max-w-md mx-auto space-y-6 pt-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-brand-navy text-white font-serif font-bold text-2xl flex items-center justify-center mx-auto shadow-sm">
          §
        </div>
        <h1 className="font-serif text-2xl font-bold text-text">
          {mode === 'signin' ? 'Sign in to Juris' : 'Create a Juris Account'}
        </h1>
        <p className="text-xs text-text-muted">
          Access deterministic civic facts, budget verifications, and citation trails.
        </p>
      </div>

      {errorMsg && (
        <Toast
          type="error"
          title="Authentication Notice"
          message={errorMsg}
          onDismiss={() => setErrorMsg(null)}
        />
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="auth-email"
            label="Email Address"
            type="email"
            placeholder="analyst@juris.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            id="auth-password"
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2 flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              <Lock className="w-4 h-4" />
            ) : (
              <UserCheck className="w-4 h-4" />
            )}
            <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
          </Button>
        </form>

        <div className="relative my-6 text-center text-xs">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <span className="relative px-2 bg-surface text-text-subtle uppercase tracking-wider">
            or
          </span>
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleGuestLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4 text-accent-teal" />
          <span>Continue as Demo Guest</span>
        </Button>

        <div className="mt-6 text-center text-xs text-text-muted">
          {mode === 'signin' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="text-accent-teal font-semibold hover:underline"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-accent-teal font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};
