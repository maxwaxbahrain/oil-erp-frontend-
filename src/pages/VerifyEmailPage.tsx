import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../api/axios';
import AuthPageShell from '../components/auth/AuthPageShell';

function extractApiErrorDetail(err: unknown): string {
  const axiosErr = err as {
    response?: { status?: number; data?: { detail?: unknown } };
    message?: string;
  };

  const detail = axiosErr.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: { msg?: string; loc?: (string | number)[] }) => {
        const field = item.loc?.[item.loc.length - 1] ?? 'field';
        return `${field}: ${item.msg ?? 'invalid'}`;
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  if (axiosErr.message && !axiosErr.response) {
    return axiosErr.message;
  }
  return 'Verification failed. Please try again.';
}

type VerifyState = 'missing-token' | 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);
  const verifyStartedRef = useRef(false);

  const [state, setState] = useState<VerifyState>(() => (token ? 'verifying' : 'missing-token'));
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('missing-token');
      return;
    }

    if (verifyStartedRef.current) return;
    verifyStartedRef.current = true;

    let cancelled = false;
    setState('verifying');
    setError('');

    (async () => {
      try {
        const { data } = await api.post<{ message: string }>('/api/tenants/verify-email', { token });
        if (cancelled) return;
        setSuccessMessage(data.message || 'Email verified. You can now sign in.');
        setState('success');
      } catch (err) {
        if (cancelled) return;
        setError(extractApiErrorDetail(err));
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'missing-token') {
    return (
      <AuthPageShell
        title="Verification link invalid"
        subtitle="This email verification link is missing or incomplete."
        footer={
          <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
            <Link to="/login" style={{ color: 'var(--auth-accent)' }}>
              Go to sign in
            </Link>
          </p>
        }
      >
        <p
          className="rounded-lg px-3 py-3 text-sm"
          style={{ background: 'var(--auth-error-bg)', color: 'var(--auth-error-text)' }}
        >
          No verification token was found in the link. Open the link from your email or sign up again.
        </p>
      </AuthPageShell>
    );
  }

  if (state === 'verifying') {
    return (
      <AuthPageShell
        title="Verify your email"
        subtitle="Confirming your SOLTOL account"
      >
        <div
          className="flex items-center justify-center gap-2 rounded-lg px-3 py-4 text-sm"
          style={{ background: 'var(--auth-accent-soft-bg)', color: 'var(--auth-accent)' }}
        >
          <Loader2 size={18} className="animate-spin" />
          Verifying your email…
        </div>
      </AuthPageShell>
    );
  }

  if (state === 'success') {
    return (
      <AuthPageShell
        title="Email verified"
        subtitle="Your account is ready to use."
        footer={
          <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
            <Link to="/login" style={{ color: 'var(--auth-accent)' }}>
              Sign in
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

  return (
    <AuthPageShell
      title="Verification failed"
      subtitle="We could not verify your email address."
      footer={
        <p className="mt-6 text-center" style={{ fontSize: '14px', color: 'var(--auth-text-link)' }}>
          <Link to="/login" style={{ color: 'var(--auth-accent)' }}>
            Go to sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-2">
        <p
          className="rounded-lg px-3 py-3 text-sm"
          style={{ background: 'var(--auth-error-bg)', color: 'var(--auth-error-text)' }}
        >
          {error}
        </p>
        <p className="text-center text-sm" style={{ color: 'var(--auth-text-muted, var(--auth-text-link))' }}>
          The link may have expired.
        </p>
      </div>
    </AuthPageShell>
  );
}
