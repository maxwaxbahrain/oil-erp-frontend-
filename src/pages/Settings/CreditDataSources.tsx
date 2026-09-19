import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2, Shield } from 'lucide-react';
import PasswordInput from '../../components/ui/PasswordInput';
import {
  deleteCreditProviderSettings,
  getCreditProviderSettings,
  saveCreditProviderSettings,
  type CreditProviderSettings,
} from '../../services/api';
import { formatDateOnly } from '../../utils/formatters';

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

type CreditEnvironment = 'sandbox' | 'production';

function formatApiError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Request failed';
}

export default function CreditDataSources() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CreditProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState<CreditEnvironment>('sandbox');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const reloadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getCreditProviderSettings();
      setSettings(data);
    } catch (error) {
      setSettings(null);
      setLoadError(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    if (!username.trim() || !password) {
      setSaveError('API user key and password are required.');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveCreditProviderSettings({
        username: username.trim(),
        password,
        environment,
      });
      setSettings(updated);
      setPassword('');
      setSaveError(null);
    } catch (error) {
      setSaveError(formatApiError(error));
    } finally {
      setSaving(false);
    }
  };

  const onDisconnect = async () => {
    if (!window.confirm('Disconnect Creditsafe for this tenant?')) return;
    setDisconnectError(null);
    setDisconnectBusy(true);
    try {
      await deleteCreditProviderSettings();
      setUsername('');
      setPassword('');
      await reloadSettings();
    } catch (error) {
      setDisconnectError(formatApiError(error));
    } finally {
      setDisconnectBusy(false);
    }
  };

  const connected = settings?.connected === true;

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
          style={{
            background: 'none',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            padding: 0,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          Settings
        </button>
        <ChevronRight size={12} color={C.dim} />
        <span style={{ color: C.text, fontWeight: 600 }}>Credit data sources</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: '0 0 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Shield size={22} color={C.blue} />
            Credit data sources
          </h1>
          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
            Connect external credit providers for your tenant.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...panel, padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>Creditsafe Connect</h2>

            {loading ? (
              <p style={{ fontSize: 12, color: C.muted, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" />
                Loading status…
              </p>
            ) : loadError ? (
              <p style={{ fontSize: 12, color: '#FCA5A5', margin: 0 }}>{loadError}</p>
            ) : connected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: C.green, fontWeight: 700, margin: 0 }}>Connected</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(79,142,247,.12)',
                      color: C.blue,
                      border: '1px solid rgba(79,142,247,.25)',
                    }}
                  >
                    {settings?.environment ?? '—'}
                  </span>
                  {settings?.username_masked ? (
                    <span style={{ fontSize: 12, color: C.muted }}>{settings.username_masked}</span>
                  ) : null}
                </div>
                {settings?.last_auth_ok_at ? (
                  <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                    Last successful auth: {formatDateOnly(settings.last_auth_ok_at)}
                  </p>
                ) : null}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 12px' }}>Not connected</p>
            )}

            {!loading && settings?.last_error ? (
              <p style={{ fontSize: 12, color: '#FCA5A5', margin: '0 0 12px' }}>{settings.last_error}</p>
            ) : null}

            <form onSubmit={(event) => void onSave(event)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label
                  htmlFor="creditsafe-username"
                  style={{ display: 'block', fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}
                >
                  API user key
                </label>
                <input
                  id="creditsafe-username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="off"
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  htmlFor="creditsafe-password"
                  style={{ display: 'block', fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}
                >
                  Password
                </label>
                <PasswordInput
                  id="creditsafe-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  style={inputStyle}
                />
              </div>

              <div>
                <label
                  htmlFor="creditsafe-environment"
                  style={{ display: 'block', fontSize: 11, color: C.dim, marginBottom: 6, fontWeight: 600 }}
                >
                  Environment
                </label>
                <select
                  id="creditsafe-environment"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as CreditEnvironment)}
                  style={inputStyle}
                >
                  <option value="sandbox">sandbox</option>
                  <option value="production">production</option>
                </select>
              </div>

              {saveError ? (
                <p style={{ fontSize: 12, color: '#FCA5A5', margin: 0 }}>{saveError}</p>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: C.blue,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>

                {connected ? (
                  <button
                    type="button"
                    disabled={disconnectBusy}
                    onClick={() => void onDisconnect()}
                    style={{
                      background: 'transparent',
                      color: '#FCA5A5',
                      border: '1px solid rgba(239,68,68,.35)',
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: disconnectBusy ? 0.6 : 1,
                    }}
                  >
                    {disconnectBusy ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                ) : null}
              </div>
            </form>

            {disconnectError ? (
              <p style={{ fontSize: 12, color: '#FCA5A5', margin: '12px 0 0' }}>{disconnectError}</p>
            ) : null}

            <p style={{ fontSize: 11, color: C.dim, margin: '16px 0 0' }}>
              Searches spend Creditsafe credits; reports are free. Each tenant connects its own account.
            </p>
          </div>

          <div style={{ ...panel, padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>Public records</h2>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              Coming soon — entity status, licences, judgments and reviews from public sources.
            </p>
          </div>

          <div style={{ ...panel, padding: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
              How the payment score was validated
            </h2>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              Customers flagged YELLOW/RED went on to pay late or leave money unpaid 12 of 12 times in a
              6-month test on a live distributor&apos;s ledger. GREEN means no warning signs in payment
              history. The score is computed only from your own invoices and payments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
