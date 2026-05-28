import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Shield, RefreshCw, Users, Clock, AlertTriangle, DollarSign, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  bg4: '#142540',
  blue: '#4F8EF7',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  purple: '#7C3AED',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
};

interface Overview {
  total_tenants: number;
  active_trials: number;
  expired_trials: number;
  total_ai_cost_usd: number;
  total_ai_tokens: number;
  new_signups_today: number;
  new_signups_this_week: number;
}

interface TenantRow {
  id: number;
  company_name: string;
  company_email: string;
  plan: string;
  trial_ends_at: string | null;
  days_left: number;
  is_trial_expired: boolean;
  ai_tokens_used: number;
  ai_cost_usd: number;
  total_users: number;
  created_at: string;
  is_active: boolean;
}

interface AIUsageRow {
  tenant_company_name: string;
  username: string | null;
  feature: string;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

interface PageActivityRow {
  feature: string;
  total_calls: number;
  total_tokens: number;
  total_cost: number;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function OverviewCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: typeof Users;
}) {
  return (
    <div style={{ ...panel, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} color={color} />
        <span style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [aiUsage, setAiUsage] = useState<AIUsageRow[]>([]);
  const [pageActivity, setPageActivity] = useState<PageActivityRow[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [overviewRes, tenantsRes, usageRes, activityRes] = await Promise.all([
        api.get<Overview>('/api/superadmin/overview'),
        api.get<TenantRow[]>('/api/superadmin/tenants'),
        api.get<AIUsageRow[]>('/api/superadmin/ai-usage'),
        api.get<PageActivityRow[]>('/api/superadmin/page-activity'),
      ]);
      setOverview(overviewRes.data);
      setTenants(tenantsRes.data);
      setAiUsage(usageRes.data);
      setPageActivity(activityRes.data);
      setError('');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to load super admin dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = window.setInterval(loadData, 30000);
    return () => window.clearInterval(interval);
  }, [loadData]);

  const handleActivate = async (tenantId: number) => {
    setActionLoading(tenantId);
    try {
      await api.post(`/api/superadmin/tenants/${tenantId}/activate`);
      await loadData();
    } catch {
      setError('Failed to activate tenant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (tenantId: number) => {
    setActionLoading(tenantId);
    try {
      await api.post(`/api/superadmin/tenants/${tenantId}/deactivate`);
      await loadData();
    } catch {
      setError('Failed to deactivate tenant');
    } finally {
      setActionLoading(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div style={{ ...panel, padding: 24, color: C.muted, maxWidth: 640 }}>
        Super Admin access is restricted to the platform administrator account.
      </div>
    );
  }

  const th: CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 10,
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  const td: CSSProperties = {
    padding: '10px 12px',
    fontSize: 12,
    color: C.muted,
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  };

  return (
    <div style={{ color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>Platform / Super Admin</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color={C.blue} />
            Super Admin Dashboard
          </h1>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); loadData(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: C.bg3,
            border: '1px solid rgba(255,255,255,0.08)',
            color: C.muted,
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ ...panel, padding: 12, marginBottom: 16, color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12, marginBottom: 20 }}>
        <OverviewCard label="Total Tenants" value={String(overview?.total_tenants ?? '—')} color={C.blue} icon={Users} />
        <OverviewCard label="Active Trials" value={String(overview?.active_trials ?? '—')} color={C.green} icon={Clock} />
        <OverviewCard label="Expired Trials" value={String(overview?.expired_trials ?? '—')} color={C.red} icon={AlertTriangle} />
        <OverviewCard
          label="Total AI Cost"
          value={overview ? `$${overview.total_ai_cost_usd.toFixed(4)}` : '—'}
          color={C.amber}
          icon={DollarSign}
        />
        <OverviewCard label="New Today" value={String(overview?.new_signups_today ?? '—')} color={C.purple} icon={Sparkles} />
      </div>

      <div style={{ ...panel, padding: 16, marginBottom: 20, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tenants</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr>
              {['Company', 'Email', 'Plan', 'Days Left', 'Users', 'AI Tokens', 'AI Cost ($)', 'Status', 'Actions'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => {
              const rowBg = t.is_trial_expired
                ? 'rgba(239,68,68,0.08)'
                : t.plan === 'trial' && t.is_active
                  ? 'rgba(34,197,94,0.06)'
                  : 'transparent';
              const status = !t.is_active ? 'Inactive' : t.is_trial_expired ? 'Trial expired' : t.plan === 'trial' ? 'Active trial' : t.plan;
              return (
                <tr key={t.id} style={{ background: rowBg }}>
                  <td style={{ ...td, color: C.text, fontWeight: 600 }}>{t.company_name}</td>
                  <td style={td}>{t.company_email}</td>
                  <td style={td}>{t.plan}</td>
                  <td style={td}>{t.days_left}</td>
                  <td style={td}>{t.total_users}</td>
                  <td style={td}>{t.ai_tokens_used.toLocaleString()}</td>
                  <td style={td}>${t.ai_cost_usd.toFixed(4)}</td>
                  <td style={td}>{status}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={actionLoading === t.id}
                        onClick={() => handleActivate(t.id)}
                        style={{ background: 'rgba(34,197,94,0.15)', color: C.green, border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Activate
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === t.id}
                        onClick={() => handleDeactivate(t.id)}
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
        <div style={{ ...panel, padding: 16, overflowX: 'auto' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Recent AI Usage</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                {['Company', 'User', 'Feature', 'Tokens', 'Cost ($)', 'Date'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aiUsage.map((row, i) => (
                <tr key={`${row.created_at}-${i}`}>
                  <td style={{ ...td, color: C.text }}>{row.tenant_company_name}</td>
                  <td style={td}>{row.username ?? '—'}</td>
                  <td style={td}>{row.feature}</td>
                  <td style={td}>{row.tokens_used.toLocaleString()}</td>
                  <td style={td}>${row.cost_usd.toFixed(4)}</td>
                  <td style={td}>{formatDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ ...panel, padding: 16, overflowX: 'auto' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Most Used Features</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Feature/Page', 'Total Calls', 'Total Tokens', 'Total Cost'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageActivity.map(row => (
                <tr key={row.feature}>
                  <td style={{ ...td, color: C.text }}>{row.feature}</td>
                  <td style={td}>{row.total_calls.toLocaleString()}</td>
                  <td style={td}>{row.total_tokens.toLocaleString()}</td>
                  <td style={td}>${row.total_cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
