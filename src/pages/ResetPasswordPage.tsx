import { type FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import api from '../api/axios';
import AuthPageShell from '../components/auth/AuthPageShell';
import { authIconStyle, authInputStyle, authLabelStyle, authPrimaryButtonStyle } from './authPageUtils';

const MIN_PASSWORD_LENGTH = 8;

function extractResetError(err: unknown): string {
  const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown } } };
  if (axiosErr.response?.status === 400) {
    const detail = axiosErr.response.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return 'Something went wrong. Please try again.';
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passFocused, setPassFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitHover, setSubmitHover] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ message: string }>('/api/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      setSuccessMessage(data.message);
    } catch (err) {
      setError(extractResetError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthPageShell
        title="Reset link invalid"
        subtitle="This password reset link is missing or incomplete."
        footer={
          <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
            <Link to="/forgot-password" style={{ color: 'var(--auth-accent)' }}>
              Request a new reset link
            </Link>
          </p>
        }
      >
        <p
          className="rounded-lg px-3 py-3 text-sm"
          style={{ background: 'var(--auth-error-bg)', color: 'var(--auth-error-text)' }}
        >
          No reset token was found in the link. Open the link from your email or request a new one.
        </p>
      </AuthPageShell>
    );
  }

  if (successMessage) {
    return (
      <AuthPageShell
        title="Password updated"
        subtitle="Your password has been reset successfully."
        footer={
          <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
            <Link to="/login" style={{ color: 'var(--auth-accent)' }}>
              Sign in with your new password
            </Link>
          </p>
        }
      >
        <p
          className="rounded-lg px-3 py-3 text-sm"
          style={{ background: 'var(--auth-accent-soft-bg)', color: 'var(--auth-accent)' }}
        >
          {successMessage}
        </p>
      </AuthPageShell>
    );
  }

  const invalidToken =
    error === 'Invalid or expired reset token' ||
    error.toLowerCase().includes('invalid or expired');

  return (
    <AuthPageShell
      title="Choose a new password"
      subtitle="Enter and confirm your new password below"
      footer={
        <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
          <Link to="/login" style={{ color: 'var(--auth-accent)' }}>
            Back to sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="new-password" style={authLabelStyle}>
            New password
          </label>
          <div className="relative">
            <Lock size={18} style={authIconStyle(newPassword.length > 0)} />
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onFocus={() => setPassFocused(true)}
              onBlur={() => setPassFocused(false)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              style={authInputStyle(passFocused, newPassword.length > 0)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirm-password" style={authLabelStyle}>
            Confirm password
          </label>
          <div className="relative">
            <Lock size={18} style={authIconStyle(confirmPassword.length > 0)} />
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setConfirmFocused(true)}
              onBlur={() => setConfirmFocused(false)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              style={authInputStyle(confirmFocused, confirmPassword.length > 0)}
            />
          </div>
        </div>

        {error && (
          <div className="space-y-2">
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--auth-error-bg)', color: 'var(--auth-error-text)' }}
            >
              {error}
            </p>
            {invalidToken && (
              <p className="text-center text-sm" style={{ color: 'var(--auth-text-link)' }}>
                <Link to="/forgot-password" style={{ color: 'var(--auth-accent)' }}>
                  Request a new reset link
                </Link>
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          onMouseEnter={() => setSubmitHover(true)}
          onMouseLeave={() => setSubmitHover(false)}
          className="flex w-full items-center justify-center gap-2 disabled:opacity-60"
          style={authPrimaryButtonStyle(submitHover)}
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Reset password
        </button>
      </form>
    </AuthPageShell>
  );
}
