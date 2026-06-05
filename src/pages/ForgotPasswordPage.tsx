import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import api from '../api/axios';
import AuthPageShell from '../components/auth/AuthPageShell';
import { authIconStyle, authInputStyle, authLabelStyle, authPrimaryButtonStyle } from './authPageUtils';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [submitHover, setSubmitHover] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setSubmitting(true);
    try {
      const { data } = await api.post<{ message: string }>('/api/auth/forgot-password', {
        email: email.trim(),
      });
      setSuccessMessage(data.message);
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthPageShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link"
      footer={
        <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
          <Link to="/login" style={{ color: 'var(--auth-accent)' }}>
            Back to sign in
          </Link>
        </p>
      }
    >
      {successMessage ? (
        <p
          className="rounded-lg px-3 py-3 text-sm"
          style={{ background: 'var(--auth-accent-soft-bg)', color: 'var(--auth-accent)' }}
        >
          {successMessage}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" style={authLabelStyle}>
              Email
            </label>
            <div className="relative">
              <Mail size={18} style={authIconStyle(email.length > 0)} />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                required
                style={authInputStyle(emailFocused, email.length > 0)}
              />
            </div>
          </div>

          {error && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--auth-error-bg)', color: 'var(--auth-error-text)' }}
            >
              {error}
            </p>
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
            Send reset link
          </button>
        </form>
      )}
    </AuthPageShell>
  );
}
