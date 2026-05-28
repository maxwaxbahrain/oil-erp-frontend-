import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, CreditCard, Loader2 } from 'lucide-react';
import api from '../api/axios';

const C = {
  bg: '#060f1c',
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

interface TenantInfo {
  company_name: string;
  plan: string;
  trial_ends_at: string | null;
  days_left: number;
  is_trial_expired: boolean;
  ai_tokens_used: number;
  ai_cost_usd: number;
}

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
  padding: 20,
};

export default function BillingPage() {
  const [info, setInfo] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<TenantInfo>('/api/tenants/me')
      .then(res => setInfo(res.data))
      .catch(() => setError('Could not load billing information for this account.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: C.muted }}>
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div style={{ ...panel, color: C.muted, maxWidth: 720 }}>
        {error || 'No tenant billing profile found.'}
      </div>
    );
  }

  const trialActive = info.plan === 'trial' && !info.is_trial_expired;

  return (
    <div style={{ maxWidth: 720, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Settings / Billing</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={20} color={C.blue} />
          Billing &amp; plan
        </h1>
      </div>

      {info.is_trial_expired && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
          }}
        >
          <AlertTriangle size={18} color={C.red} />
          <div>
            <div style={{ fontWeight: 600, color: '#FCA5A5', marginBottom: 4 }}>Trial expired</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Your free trial has ended. Upgrade to continue using AI features and full ERP access.
            </div>
          </div>
        </div>
      )}

      {trialActive && (
        <div
          style={{
            background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 16,
            color: '#86EFAC',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {info.days_left} day{info.days_left === 1 ? '' : 's'} remaining on your free trial
        </div>
      )}

      <div style={{ ...panel, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Stat label="Company" value={info.company_name} />
          <Stat label="Plan" value={info.plan} />
          <Stat label="AI tokens used" value={info.ai_tokens_used.toLocaleString()} />
          <Stat label="AI cost (USD)" value={`$${info.ai_cost_usd.toFixed(4)}`} />
        </div>
      </div>

      <div style={panel}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <CreditCard size={18} color={C.amber} />
          <span style={{ fontWeight: 600 }}>Upgrade</span>
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
          Need more seats, AI capacity, or a paid plan? Contact us to upgrade your tenant.
        </p>
        <a
          href="mailto:admin@soltol.com"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: C.blue,
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Contact us at admin@soltol.com
        </a>
        <p style={{ marginTop: 12, fontSize: 11, color: C.dim }}>
          <Link to="/settings" style={{ color: C.blue }}>
            ← Back to settings
          </Link>
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{value}</div>
    </div>
  );
}
