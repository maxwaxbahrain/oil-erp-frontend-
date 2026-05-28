import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AlertTriangle, Mail, RefreshCw, Send } from 'lucide-react';
import api from '../api/axios';

const C = {
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
};

interface EmailSettings {
  rule_churn_risk: boolean;
  rule_trial_ending: boolean;
  rule_win_back: boolean;
  rule_feature_push: boolean;
  send_time_hour: number;
}

interface EmailLogRow {
  id: number;
  tenant_id: number;
  company_name: string;
  company_email: string;
  trigger_type: string;
  status: string;
  created_at: string;
}

interface EmailStats {
  sent_30d: number;
  opened_30d: number;
  clicked_30d: number;
  re_engaged_30d: number;
  at_risk_count: number;
}

const CHURN_PREVIEW = `Subject: We miss you at Soltol — your trial is waiting

Hi {Company Name},

We noticed you haven't logged in recently. Your Soltol ERP trial is still active and we'd love to help you get the most from invoicing, inventory, and AI tools.

Log back in today: https://www.soltol.com

— The Soltol Team`;

export default function EmailRemindersPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, logsRes, statsRes] = await Promise.all([
        api.get<EmailSettings>('/api/superadmin/emails/settings'),
        api.get<EmailLogRow[]>('/api/superadmin/emails/log'),
        api.get<EmailStats>('/api/superadmin/emails/stats'),
      ]);
      setSettings(settingsRes.data);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch {
      setMessage('Failed to load email reminders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSetting = async (key: keyof EmailSettings, value: boolean) => {
    if (!settings) return;
    try {
      const res = await api.post<EmailSettings>('/api/superadmin/emails/settings', {
        ...settings,
        [key]: value,
      });
      setSettings(res.data);
    } catch {
      // silent
    }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const res = await api.post<{ sent: number; failed: number }>('/api/superadmin/emails/send-churn-reminders');
      setMessage(`Sent ${res.data.sent} reminders (${res.data.failed} failed)`);
      await loadData();
    } catch {
      setMessage('Failed to send reminders');
    } finally {
      setSending(false);
    }
  };

  const th: CSSProperties = { textAlign: 'left', padding: '10px 12px', fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.06)' };
  const td: CSSProperties = { padding: '10px 12px', fontSize: 12, color: C.muted, borderBottom: '1px solid rgba(255,255,255,0.04)' };

  return (
    <div style={{ color: C.text, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={18} color={C.blue} /> Email Reminders
        </h2>
        <button type="button" onClick={() => { setLoading(true); loadData(); }} style={{ background: C.bg3, border: '1px solid rgba(255,255,255,0.08)', color: C.muted, borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {message && <div style={{ ...panel, padding: 12, color: C.muted }}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {[
          { label: 'Emails sent (30d)', value: stats?.sent_30d ?? '—', color: C.blue },
          { label: 'Opened', value: stats?.opened_30d ?? '—', color: C.green },
          { label: 'Re-engaged', value: stats?.re_engaged_30d ?? '—', color: C.amber },
        ].map(card => (
          <div key={card.label} style={{ ...panel, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {(stats?.at_risk_count ?? 0) > 0 && (
        <div style={{ ...panel, padding: 14, background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color={C.red} />
            <span>{stats?.at_risk_count} tenant(s) at churn risk (no login 3+ days during trial)</span>
          </div>
          <button type="button" disabled={sending} onClick={sendNow} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={14} /> Send now
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Auto-send rules</h3>
          {settings && [
            { key: 'rule_churn_risk' as const, label: 'Churn risk (3+ days inactive)' },
            { key: 'rule_trial_ending' as const, label: 'Trial ending soon' },
            { key: 'rule_win_back' as const, label: 'Win-back campaign' },
            { key: 'rule_feature_push' as const, label: 'Feature push' },
          ].map(rule => (
            <label key={rule.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, color: C.muted }}>
              {rule.label}
              <input type="checkbox" checked={settings[rule.key]} onChange={e => updateSetting(rule.key, e.target.checked)} />
            </label>
          ))}
        </div>

        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Churn risk email preview</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: C.muted, background: C.bg3, padding: 12, borderRadius: 8, margin: 0, lineHeight: 1.5 }}>{CHURN_PREVIEW}</pre>
        </div>
      </div>

      <div style={{ ...panel, padding: 16, overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Email send log</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>{['Company', 'Status', 'Trigger', 'Time'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {logs.map(row => (
              <tr key={row.id}>
                <td style={{ ...td, color: C.text }}>{row.company_name}</td>
                <td style={td}>
                  <span style={{ background: row.status === 'sent' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: row.status === 'sent' ? C.green : C.red, padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>
                    {row.status}
                  </span>
                </td>
                <td style={td}>{row.trigger_type}</td>
                <td style={td}>{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
