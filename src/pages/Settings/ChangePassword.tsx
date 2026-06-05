import { useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, ChevronRight, CheckCircle } from 'lucide-react';
import api from '../../api/axios';
import PasswordInput from '../../components/ui/PasswordInput';
import { useAuth } from '../../contexts/AuthContext';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  red: '#EF4444',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: C.bg3,
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: C.text,
  outline: 'none',
};

function extractError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return 'Could not update password. Please try again.';
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100%',
        background: C.bg,
        color: C.text,
        margin: '-24px -40px',
        width: 'calc(100% + 80px)',
        paddingBottom: 48,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '12px 28px',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          background: C.bg2,
          fontSize: 11,
          color: C.muted,
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/settings')}
          style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600 }}
        >
          Settings
        </button>
        <ChevronRight size={12} color={C.dim} />
        <span style={{ color: C.text, fontWeight: 600 }}>Change password</span>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Lock size={22} color={C.blue} />
            Change password
          </h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Signed in as <strong style={{ color: C.text }}>{user?.username}</strong>
            {user?.full_name ? ` · ${user.full_name}` : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...panel, padding: 24 }}>
          {success && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(34,197,94,.12)',
                border: '1px solid rgba(34,197,94,.25)',
                color: '#86EFAC',
                fontSize: 12,
              }}
            >
              <CheckCircle size={16} />
              Password updated successfully.
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(239,68,68,.12)',
                border: '1px solid rgba(239,68,68,.25)',
                color: '#FCA5A5',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="current-password" style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
              Current password
            </label>
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="new-password" style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
              New password
            </label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
            <p style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>Minimum 8 characters</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="confirm-password" style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>
              Confirm new password
            </label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 16px',
              borderRadius: 8,
              border: 'none',
              background: C.blue,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
