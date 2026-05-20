// VoiceAnalytics — KPIs + charts on the Voice module's last-30-days activity.
// Data source: GET /api/voice/analytics (single rollup endpoint).
// Charts: calls-per-day line + sentiment pie. Renders the live Usage card
// (calls / minutes / AI cost) from GET /api/voice/usage right alongside.

import { useEffect, useState } from 'react';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    PhoneCall, Clock, ShoppingCart, CheckCircle2, RefreshCw, AlertCircle, DollarSign,
} from 'lucide-react';
import {
    getAnalytics, getUsage,
    type AnalyticsResponse, type UsageResponse,
} from '../../services/voiceService';

const SENTIMENT_COLORS: Record<string, string> = {
    positive: '#10b981',
    neutral: '#9ca3af',
    negative: '#f43f5e',
};

export default function VoiceAnalytics() {
    const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
    const [usage, setUsage] = useState<UsageResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [a, u] = await Promise.all([getAnalytics(), getUsage()]);
            setAnalytics(a);
            setUsage(u);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const sentimentData = analytics ? [
        { name: 'Positive', value: analytics.sentiment_breakdown.positive, key: 'positive' },
        { name: 'Neutral', value: analytics.sentiment_breakdown.neutral, key: 'neutral' },
        { name: 'Negative', value: analytics.sentiment_breakdown.negative, key: 'negative' },
    ] : [];

    const callsByDay = analytics?.calls_by_day ?? [];

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Voice Analytics</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">
                        Trends, sentiment mix, and AI cost — last 30 days.
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-redwood-border hover:border-redwood-text-muted rounded-xl text-[11px] font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* KPI tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Tile icon={<PhoneCall size={16} className="text-redwood-primary" />} label="Calls (30d)" value={analytics?.calls_last_30d ?? '—'} sub={`${analytics?.calls_today ?? 0} today`} />
                <Tile icon={<Clock size={16} className="text-emerald-600" />} label="Avg duration" value={analytics ? `${Math.round((analytics.avg_duration_seconds || 0) / 6) / 10}m` : '—'} sub="per call" />
                <Tile icon={<ShoppingCart size={16} className="text-amber-600" />} label="Drafted" value={analytics?.orders_drafted_30d ?? '—'} sub="AI-extracted orders" />
                <Tile icon={<CheckCircle2 size={16} className="text-emerald-700" />} label="Confirmed" value={analytics?.orders_confirmed_30d ?? '—'} sub="approved into ERP" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Calls-per-day chart */}
                <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-redwood-border shadow-sm">
                    <div className="mb-3">
                        <h3 className="text-[15px] font-black text-redwood-text-main">Calls per day</h3>
                        <p className="text-[12px] text-redwood-text-muted">Last 30 days · inbound + outbound</p>
                    </div>
                    {callsByDay.length === 0 ? (
                        <div className="h-64 flex items-center justify-center text-sm text-redwood-text-muted">
                            No call data in the last 30 days.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={callsByDay}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#fafafa' }} />
                                <Bar dataKey="count" fill="#00758F" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Sentiment pie */}
                <div className="bg-white p-5 rounded-xl border border-redwood-border shadow-sm">
                    <div className="mb-3">
                        <h3 className="text-[15px] font-black text-redwood-text-main">Sentiment breakdown</h3>
                        <p className="text-[12px] text-redwood-text-muted">Caller mood — last 30 days</p>
                    </div>
                    {sentimentData.every((d) => d.value === 0) ? (
                        <div className="h-64 flex items-center justify-center text-sm text-redwood-text-muted">
                            No sentiment data yet.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie data={sentimentData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={45}>
                                    {sentimentData.map((d) => (
                                        <Cell key={d.key} fill={SENTIMENT_COLORS[d.key]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                    <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                        {sentimentData.map((d) => (
                            <div key={d.key}>
                                <div className="text-lg font-black" style={{ color: SENTIMENT_COLORS[d.key] }}>{d.value}</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-redwood-text-muted">{d.name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Usage card */}
            <div className="bg-white p-5 rounded-xl border border-redwood-border shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-[15px] font-black text-redwood-text-main">Usage this period</h3>
                        <p className="text-[12px] text-redwood-text-muted">
                            Plan: <span className="font-black uppercase">{usage?.plan ?? '—'}</span>
                            {usage?.period_start && (
                                <span className="ml-2">· started {new Date(usage.period_start).toLocaleDateString()}</span>
                            )}
                        </p>
                    </div>
                    <DollarSign size={16} className="text-redwood-text-muted" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <UsageStat label="Calls" used={usage?.calls ?? 0} limit={usage?.limits?.calls_per_month ?? null} />
                    <UsageStat label="Minutes" used={usage?.minutes ?? 0} limit={usage?.limits?.minutes_per_month ?? null} />
                    <UsageStat label="Drafts" used={usage?.orders_drafted ?? 0} limit={null} />
                    <UsageStat label="AI cost" used={usage ? Number(usage.ai_cost_usd.toFixed(2)) : 0} limit={null} prefix="$" />
                </div>
            </div>
        </div>
    );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
    return (
        <div className="bg-white p-5 rounded-xl border border-redwood-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">{label}</span>
            </div>
            <div className="text-2xl font-black text-redwood-text-main leading-tight">{value}</div>
            {sub && <div className="text-[11px] text-redwood-text-muted mt-1">{sub}</div>}
        </div>
    );
}

function UsageStat({ label, used, limit, prefix = '' }: { label: string; used: number; limit: number | null; prefix?: string }) {
    const pct = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
    return (
        <div>
            <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">{label}</span>
                <span className="text-[11px] text-redwood-text-muted">
                    {limit ? `${prefix}${used} / ${prefix}${limit}` : `${prefix}${used}`}
                </span>
            </div>
            <div className="h-2 rounded-full bg-redwood-bg-light overflow-hidden">
                {pct != null ? (
                    <div
                        className={`h-full ${pct > 80 ? 'bg-amber-500' : 'bg-redwood-primary'}`}
                        style={{ width: `${pct}%` }}
                    />
                ) : (
                    <div className="h-full bg-redwood-primary/40" style={{ width: '100%' }} />
                )}
            </div>
        </div>
    );
}
