import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Brain, RefreshCw, Send, Star } from 'lucide-react';
import api from '../api/axios';

const C = {
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

interface ProfileData {
  tenant: {
    id: number;
    company_name: string;
    company_email: string;
    plan: string;
    trial_ends_at: string | null;
    days_left: number;
    is_active: boolean;
    is_trial_expired: boolean;
    ai_tokens_used: number;
    ai_cost_usd: number;
    created_at: string;
  };
  users: Array<{ id: number; username: string; full_name: string | null; role: string; last_login: string | null }>;
  login_history: Array<{ ip: string | null; country: string | null; country_code: string | null; device_type: string | null; browser: string | null; created_at: string }>;
  page_visits: Array<{ page: string; visit_count: number; last_visited: string }>;
  ai_usage: Array<{ feature: string; total_calls: number; total_tokens: number; total_cost: number }>;
  satisfaction: { rating: number; comment: string | null; created_at: string } | null;
  notes: Array<{ id: number; note: string; created_at: string }>;
  monthly_stats: { this_month_logins: number; last_month_logins: number; this_month_ai_calls: number; last_month_ai_calls: number };
  health_score: number;
  upgrade_probability: number;
  churn_probability: number;
  days_since_last_login: number;
  adoption_pct: number;
  feature_recommendation: string;
  login_heatmap: Array<{ date: string; count: number }>;
  ai_trend: Array<{ date: string; calls: number }>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'T';
}

function healthColor(score: number) {
  if (score >= 70) return C.green;
  if (score >= 40) return C.amber;
  return C.red;
}

export default function TenantProfilePage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [nlpQuery, setNlpQuery] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await api.get<ProfileData>(`/api/superadmin/tenant/${tenantId}/profile`);
      setData(res.data);
      setError('');
    } catch {
      setError('Failed to load tenant profile');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const maxVisits = useMemo(() => Math.max(1, ...(data?.page_visits.map(v => v.visit_count) ?? [1])), [data]);
  const maxHeat = useMemo(() => Math.max(1, ...(data?.login_heatmap.map(h => h.count) ?? [1])), [data]);
  const maxAiTrend = useMemo(() => Math.max(1, ...(data?.ai_trend.map(t => t.calls) ?? [1])), [data]);

  const addNote = async () => {
    if (!tenantId || !note.trim()) return;
    try {
      await api.post(`/api/superadmin/tenant/${tenantId}/notes`, { note });
      setNote('');
      await loadProfile();
    } catch {
      // silent
    }
  };

  const th: CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 10, color: C.dim, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' };
  const td: CSSProperties = { padding: '8px 10px', fontSize: 12, color: C.muted, borderBottom: '1px solid rgba(255,255,255,0.04)' };

  if (loading) {
    return <div style={{ color: C.muted, padding: 24 }}>Loading tenant profile…</div>;
  }

  if (!data) {
    return <div style={{ color: C.red, padding: 24 }}>{error || 'Tenant not found'}</div>;
  }

  const { tenant } = data;
  const healthParts = [
    { label: 'Login activity', value: Math.min(data.monthly_stats.this_month_logins * 5, 40), max: 40 },
    { label: 'Module adoption', value: Math.min((data.page_visits.length / 14) * 30, 30), max: 30 },
    { label: 'AI usage', value: Math.min(data.ai_usage.reduce((s, r) => s + r.total_calls, 0) * 0.5, 20), max: 20 },
    { label: 'Satisfaction', value: data.satisfaction ? (data.satisfaction.rating / 5) * 10 : 5, max: 10 },
  ];

  return (
    <div style={{ color: C.text, display: 'grid', gap: 16, maxWidth: 1400 }}>
      <button type="button" onClick={() => navigate('/superadmin')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
        <ArrowLeft size={16} /> Back to Super Admin
      </button>

      <div style={{ ...panel, padding: 18, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: C.bg4, display: 'grid', placeItems: 'center', fontWeight: 700, color: C.blue }}>{initials(tenant.company_name)}</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{tenant.company_name}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(79,142,247,0.15)', color: C.blue, padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>{tenant.plan}</span>
              <span style={{ background: tenant.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: tenant.is_active ? C.green : C.red, padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>
                {tenant.is_active ? 'Active' : 'Inactive'}
              </span>
              {tenant.is_trial_expired && <span style={{ background: 'rgba(239,68,68,0.15)', color: C.red, padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>Trial expired</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: C.dim }}>Health score</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: healthColor(data.health_score) }}>{data.health_score}</div>
        </div>
      </div>

      {data.days_since_last_login >= 3 && (
        <div style={{ ...panel, padding: 14, background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color={C.red} />
            <span>Churn risk: no login for {data.days_since_last_login} days</span>
          </div>
          <button type="button" onClick={() => navigate('/superadmin?tab=emails')} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
            Set reminder
          </button>
        </div>
      )}

      <div style={{ ...panel, padding: 12, display: 'flex', gap: 8 }}>
        <input
          value={nlpQuery}
          onChange={e => setNlpQuery(e.target.value)}
          placeholder="Ask about this customer..."
          style={{ flex: 1, background: C.bg3, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: C.text, padding: '10px 12px', fontSize: 13 }}
        />
        <button
          type="button"
          onClick={() => navigate('/ai/hub', { state: { prompt: nlpQuery || `Analyze tenant ${tenant.company_name}` } })}
          style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Brain size={14} /> Ask AI
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[
          { label: 'Logins (this month)', value: data.monthly_stats.this_month_logins },
          { label: 'AI calls (this month)', value: data.monthly_stats.this_month_ai_calls },
          { label: 'Adoption', value: `${data.adoption_pct}%` },
          { label: 'Satisfaction', value: data.satisfaction ? `${data.satisfaction.rating}/5` : '—' },
        ].map(card => (
          <div key={card.label} style={{ ...panel, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.dim }}>Upgrade probability</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>{data.upgrade_probability}%</div>
        </div>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.dim }}>Churn probability</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.red }}>{data.churn_probability}%</div>
        </div>
        <div style={{ ...panel, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.dim }}>Feature recommendation</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.purple, marginTop: 6 }}>Try {data.feature_recommendation.replace('_', ' ')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Most used modules</h3>
          {data.page_visits.slice(0, 8).map(v => (
            <div key={v.page} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 4 }}>
                <span>{v.page}</span><span>{v.visit_count}</span>
              </div>
              <div style={{ height: 8, background: C.bg3, borderRadius: 999 }}>
                <div style={{ width: `${(v.visit_count / maxVisits) * 100}%`, height: '100%', background: C.blue, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Health breakdown</h3>
          {healthParts.map(part => (
            <div key={part.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginBottom: 4 }}>
                <span>{part.label}</span><span>{Math.round(part.value)}/{part.max}</span>
              </div>
              <div style={{ height: 8, background: C.bg3, borderRadius: 999 }}>
                <div style={{ width: `${(part.value / part.max) * 100}%`, height: '100%', background: C.green, borderRadius: 999 }} />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>Satisfaction survey</div>
            {data.satisfaction ? (
              <div style={{ fontSize: 13, color: C.muted }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} color={i <= data.satisfaction!.rating ? '#F59E0B' : C.dim} fill={i <= data.satisfaction!.rating ? '#F59E0B' : 'none'} />)}
                </div>
                {data.satisfaction.comment || 'No comment'}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.dim }}>No survey response yet</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Weekly login heatmap</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {data.login_heatmap.map(day => (
              <div key={day.date} title={`${day.date}: ${day.count}`} style={{ height: 28, borderRadius: 4, background: `rgba(79,142,247,${0.15 + (day.count / maxHeat) * 0.85})` }} />
            ))}
          </div>
        </div>
        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>AI trend (7 days)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {data.ai_trend.map(day => (
              <div key={day.date} title={`${day.date}: ${day.calls}`} style={{ flex: 1, background: C.purple, borderRadius: 4, height: `${Math.max(8, (day.calls / maxAiTrend) * 100)}%`, opacity: 0.85 }} />
            ))}
          </div>
        </div>
        <div style={{ ...panel, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Monthly summary</h3>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.8 }}>
            <div>Logins: {data.monthly_stats.this_month_logins} this month ({data.monthly_stats.last_month_logins} last)</div>
            <div>AI calls: {data.monthly_stats.this_month_ai_calls} this month ({data.monthly_stats.last_month_ai_calls} last)</div>
            <div>Tokens used: {tenant.ai_tokens_used.toLocaleString()}</div>
            <div>AI cost: ${tenant.ai_cost_usd.toFixed(4)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...panel, padding: 16, overflowX: 'auto' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Login history</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['IP', 'Location', 'Device', 'Browser', 'Time'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.login_history.map((row, i) => (
                <tr key={`${row.created_at}-${i}`}>
                  <td style={td}>{row.ip ?? '—'}</td>
                  <td style={td}>{row.country ?? '—'}</td>
                  <td style={td}>{row.device_type ?? '—'}</td>
                  <td style={td}>{row.browser ?? '—'}</td>
                  <td style={td}>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...panel, padding: 16, overflowX: 'auto' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>AI usage breakdown</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Feature', 'Calls', 'Tokens', 'Cost'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.ai_usage.map(row => (
                <tr key={row.feature}>
                  <td style={{ ...td, color: C.text }}>{row.feature}</td>
                  <td style={td}>{row.total_calls}</td>
                  <td style={td}>{row.total_tokens.toLocaleString()}</td>
                  <td style={td}>${row.total_cost.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...panel, padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Admin notes</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note about this tenant..." style={{ flex: 1, background: C.bg3, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: C.text, padding: '10px 12px', fontSize: 13 }} />
          <button type="button" onClick={addNote} style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Send size={14} /> Add note
          </button>
        </div>
        {data.notes.map(n => (
          <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13, color: C.muted }}>
            <div>{n.note}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <button type="button" onClick={() => { setLoading(true); loadProfile(); }} style={{ background: C.bg3, border: '1px solid rgba(255,255,255,0.08)', color: C.muted, borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', width: 'fit-content' }}>
        <RefreshCw size={14} /> Refresh profile
      </button>
    </div>
  );
}
