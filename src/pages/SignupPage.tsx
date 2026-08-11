import { type FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Building2, Loader2, Lock, Mail, User } from 'lucide-react';
import PasswordInput from '../components/ui/PasswordInput';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

function extractApiErrorDetail(err: unknown): string {
  const axiosErr = err as {
    response?: { status?: number; data?: { detail?: unknown } };
    message?: string;
  };

  console.error('Signup registration error:', {
    status: axiosErr.response?.status,
    data: axiosErr.response?.data,
    message: axiosErr.message,
    error: err,
  });

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
  return 'Registration failed. Please try again.';
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [consentError, setConsentError] = useState('');

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setConsentError('');

    if (!agreedToLegal) {
      setConsentError('You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const formData = {
        company_name: companyName.trim(),
        company_email: companyEmail.trim(),
        admin_full_name: fullName.trim(),
        admin_username: username.trim(),
        admin_password: password,
        terms_accepted: agreedToLegal,
      };
      await api.post('/api/tenants/register', formData);
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      setError(extractApiErrorDetail(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: C.bg3,
    border: '1px solid rgba(255,255,255,0.12)',
    color: C.text,
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 font-inter antialiased"
      style={{ background: C.bg, color: C.text }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-2xl"
        style={{
          background: C.bg2,
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{ background: C.blue, fontFamily: "'Syne', sans-serif" }}
          >
            S
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Syne', sans-serif" }}>
            Start your free trial
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>
            7 days free · ZAVI ERP 2.0 multi-tenant SaaS
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { id: 'companyName', label: 'Company Name', icon: Building2, type: 'text', value: companyName, set: setCompanyName },
            { id: 'companyEmail', label: 'Company Email', icon: Mail, type: 'email', value: companyEmail, set: setCompanyEmail },
            { id: 'fullName', label: 'Full Name', icon: User, type: 'text', value: fullName, set: setFullName },
            { id: 'username', label: 'Username', icon: User, type: 'text', value: username, set: setUsername },
            { id: 'password', label: 'Password', icon: Lock, type: 'password', value: password, set: setPassword },
            { id: 'confirmPassword', label: 'Confirm Password', icon: Lock, type: 'password', value: confirmPassword, set: setConfirmPassword },
          ].map(field => {
            const Icon = field.icon;
            const hasContent = field.value.length > 0;
            return (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
                  {field.label}
                </label>
                <div className="relative">
                  {!hasContent && (
                    <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.dim }} />
                  )}
                  {field.type === 'password' ? (
                    <PasswordInput
                      id={field.id}
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      required
                      className={`w-full rounded-lg py-2.5 text-sm outline-none ${hasContent ? 'pl-3' : 'pl-10'}`}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      id={field.id}
                      type={field.type}
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                      required
                      className={`w-full rounded-lg py-2.5 pr-3 text-sm outline-none ${hasContent ? 'pl-3' : 'pl-10'}`}
                      style={inputStyle}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <label
            className="flex items-start gap-3 rounded-lg px-3 py-3 text-sm"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: C.muted }}
          >
            <input
              type="checkbox"
              checked={agreedToLegal}
              onChange={(e) => {
                setAgreedToLegal(e.target.checked);
                if (e.target.checked) setConsentError('');
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#4F8EF7]"
              aria-describedby={consentError ? 'signup-consent-error' : undefined}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>
                Privacy Policy
              </Link>
            </span>
          </label>

          {consentError && (
            <p
              id="signup-consent-error"
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}
            >
              {consentError}
            </p>
          )}

          {error && (
            <p className="rounded-lg px-3 py-2 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#FCA5A5' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || isLoading || !agreedToLegal}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: C.blue }}
          >
            {(submitting || isLoading) && <Loader2 size={16} className="animate-spin" />}
            Start Free 7-Day Trial
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: C.muted }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: C.blue }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
