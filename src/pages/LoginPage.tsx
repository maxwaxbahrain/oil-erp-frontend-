import { type FormEvent, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Loader2, Lock, User, UserCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [userFocused, setUserFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [signInHover, setSignInHover] = useState(false);
  const [guestHover, setGuestHover] = useState(false);

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
    } catch (err) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 429) {
        setError('Too many login attempts. Please wait a minute and try again.');
      } else {
        setError('Invalid username or password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await login('demo', 'demo');
      navigate('/', { replace: true });
    } catch (err) {
      const statusCode = (err as { response?: { status?: number } })?.response?.status;
      if (statusCode === 429) {
        setError('Too many login attempts. Please wait a minute and try again.');
      } else {
        setError('Guest login is unavailable right now');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = (focused: boolean, hasValue: boolean) => ({
    background: focused ? 'rgba(79,107,244,0.06)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${focused ? 'rgba(79,107,244,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '9px',
    padding: `12px 14px 12px ${hasValue ? '14px' : '40px'}`,
    fontSize: '15px',
    color: '#ffffff',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s, background-color 0.15s, padding 0.15s',
  });

  const iconStyle = (hasValue: boolean) => ({
    position: 'absolute' as const,
    left: '13px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'rgba(255,255,255,0.35)',
    opacity: hasValue ? 0 : 1,
    transition: 'opacity 0.15s',
    pointerEvents: 'none' as const,
  });

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 font-inter antialiased"
      style={{ background: '#06080f', color: '#ffffff' }}
    >
      <div
        className="w-full max-w-md"
        style={{
          background: '#0d0f18',
          border: '1px solid rgba(79,107,244,0.2)',
          borderRadius: '16px',
          padding: '40px 36px',
        }}
      >
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2.5">
            <div
              className="flex items-center justify-center text-white"
              style={{
                width: '44px',
                height: '44px',
                background: '#4F6BF4',
                borderRadius: '11px',
                fontFamily: "'Syne', sans-serif",
                fontSize: '24px',
                fontWeight: 500,
              }}
            >
              S
            </div>
            <span
              className="font-semibold"
              style={{ fontSize: '20px', color: '#ffffff', fontFamily: "'Syne', sans-serif" }}
            >
              SOLTOL
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#85B7EB',
                background: 'rgba(79,107,244,0.15)',
                border: '1px solid rgba(79,107,244,0.3)',
                padding: '2px 8px',
                borderRadius: '5px',
              }}
            >
              ONE
            </span>
          </div>
          <p className="mt-3" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" style={labelStyle}>
              Username
            </label>
            <div className="relative">
              <User size={18} style={iconStyle(username.length > 0)} />
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setUserFocused(true)}
                onBlur={() => setUserFocused(false)}
                required
                style={inputStyle(userFocused, username.length > 0)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <div className="relative">
              <Lock size={18} style={iconStyle(password.length > 0)} />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                required
                style={inputStyle(passFocused, password.length > 0)}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '13px',
                  color: '#85B7EB',
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </Link>
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
            onMouseEnter={() => setSignInHover(true)}
            onMouseLeave={() => setSignInHover(false)}
            className="flex w-full items-center justify-center gap-2 disabled:opacity-60"
            style={{
              background: signInHover ? '#3d5ae0' : '#4F6BF4',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9px',
              padding: '13px',
              fontSize: '15px',
              fontWeight: 500,
              transition: 'background-color 0.15s',
            }}
          >
            {(submitting || isLoading) && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
        </form>

        <div className="flex items-center" style={{ margin: '18px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ padding: '0 12px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={submitting || isLoading}
          onMouseEnter={() => setGuestHover(true)}
          onMouseLeave={() => setGuestHover(false)}
          className="flex w-full items-center justify-center disabled:opacity-60"
          style={{
            background: guestHover ? 'rgba(79,107,244,0.08)' : 'transparent',
            color: '#85B7EB',
            border: `1px solid ${guestHover ? 'rgba(79,107,244,0.8)' : 'rgba(79,107,244,0.5)'}`,
            borderRadius: '9px',
            padding: '13px',
            fontSize: '15px',
            fontWeight: 500,
            gap: '8px',
            transition: 'background-color 0.15s, border-color 0.15s',
          }}
        >
          <UserCircle size={18} />
          Sign in as Guest
        </button>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '20px 0' }} />

        <p className="text-center" style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
          Don&apos;t have an account?{' '}
          <a href="/signup" style={{ color: '#85B7EB' }}>
            Start your free trial →
          </a>
        </p>

        <div className="mt-6 text-center">
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>SOLTOL ONE</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Built in the United States</p>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Built for the world</p>
        </div>
      </div>
    </div>
  );
}
