import { type FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Lock, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch {
      setError('Invalid username or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 font-inter antialiased"
      style={{ background: '#060f1c', color: '#EEF2FF' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{
          background: '#0a1726',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{ background: '#4F8EF7', fontFamily: "'Syne', sans-serif" }}
          >
            S1
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            SOLTOL / ZAVI ERP
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#8BA3C7' }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: '#8BA3C7' }}>
              Username
            </label>
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#3E5678' }} />
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-colors"
                style={{
                  background: '#0f1f33',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#EEF2FF',
                }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: '#8BA3C7' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#3E5678' }} />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-colors"
                style={{
                  background: '#0f1f33',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#EEF2FF',
                }}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: '#4F8EF7' }}
          >
            {(submitting || isLoading) && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
