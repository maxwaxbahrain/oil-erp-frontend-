import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Zap,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronRight,
    MessageCircle,
    Search,
    DollarSign,
    AlertTriangle,
    Clock,
    Bot,
} from 'lucide-react';
import { authFetch } from '../../api/axios';
import { getInvoices, getCustomers } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';
import { getCurrentUser } from '../../store/authStore';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    bg4: '#142540',
    blue: '#4F8EF7',
    green: '#22C55E',
    purple: '#7C3AED',
    orange: '#F59E0B',
    red: '#EF4444',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const FORECAST_PERIOD = 'June 2026';

const panel: CSSProperties = {
    background: C.bg2,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
};

function userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AQ';
}

function openBettanoAdvisor() {
    window.dispatchEvent(new CustomEvent('soltol:open-ai-advisor'));
}

function avgDaysBetweenOrders(sortedInvs: { invoiceDate: string }[]): number {
    if (sortedInvs.length < 2) return 0;
    const dates = sortedInvs
        .map(inv => new Date(inv.invoiceDate).getTime())
        .sort((a, b) => a - b);
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) {
        totalGap += (dates[i] - dates[i - 1]) / 86400000;
    }
    return totalGap / (dates.length - 1);
}

function assessRisk(
    daysSince: number,
    avgInterval: number,
    totalSpend: number,
    trend: 'up' | 'down' | 'stable',
): 'high' | 'medium' | 'low' {
    if (
        (avgInterval > 0 && daysSince > avgInterval * 2) ||
        (daysSince > 90 && totalSpend > 5000)
    ) {
        return 'high';
    }
    if (
        (avgInterval > 0 && daysSince > avgInterval * 1.5) ||
        (daysSince > 45 && trend === 'down')
    ) {
        return 'medium';
    }
    return 'low';
}

interface CustomerForecast {
    customerId: string;
    customerName: string;
    lastOrderDate: string;
    daysSinceOrder: number;
    totalSpend: number;
    avgOrderValue: number;
    orderCount: number;
    forecastNextMonth: number;
    forecastRevenue: number;
    trend: 'up' | 'down' | 'stable';
    trendPct: number;
    risk: 'high' | 'medium' | 'low';
    topProducts: string[];
}

function RiskBadge({ risk }: { risk: 'high' | 'medium' | 'low' }) {
    const meta = {
        high: { label: 'At risk', color: '#FCA5A5', bg: 'rgba(239,68,68,.15)' },
        medium: { label: 'Watch', color: '#FCD34D', bg: 'rgba(245,158,11,.15)' },
        low: { label: 'Active', color: '#86EFAC', bg: 'rgba(34,197,94,.12)' },
    }[risk];

    return (
        <span style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            whiteSpace: 'nowrap',
        }}>
            {meta.label}
        </span>
    );
}

function TrendIcon({ trend, pct }: { trend: string; pct: number }) {
    if (trend === 'up') {
        return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: C.green }}>
                <TrendingUp size={12} />+{pct}%
            </span>
        );
    }
    if (trend === 'down') {
        return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: C.red }}>
                <TrendingDown size={12} />-{pct}%
            </span>
        );
    }
    return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: C.dim }}>
            <Minus size={12} />Stable
        </span>
    );
}

export default function CustomerForecast() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [forecasts, setForecasts] = useState<CustomerForecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [sortBy, setSortBy] = useState<'revenue' | 'risk' | 'recent'>('revenue');
    const [search, setSearch] = useState('');

    useEffect(() => {
        Promise.all([getInvoices(), getCustomers()]).then(([invoices, customers]) => {
            const today = new Date();
            const custMap: Record<string, any> = {};
            customers.forEach(c => { custMap[String(c.id)] = c; });

            const custInvoices: Record<string, any[]> = {};
            invoices.forEach(inv => {
                const cid = String(inv.customerId);
                if (!custInvoices[cid]) custInvoices[cid] = [];
                custInvoices[cid].push(inv);
            });

            const result: CustomerForecast[] = Object.entries(custInvoices)
                .filter(([, invs]) => invs.length > 0)
                .map(([cid, invs]) => {
                    const customer = custMap[cid];
                    const sorted = [...invs].sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
                    const lastDate = new Date(sorted[0].invoiceDate);
                    const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / 86400000);
                    const totalSpend = invs.reduce((s, i) => s + (i.grandTotal || 0), 0);
                    const avgOrder = totalSpend / invs.length;
                    const avgInterval = avgDaysBetweenOrders(sorted);

                    const monthSpend: Record<string, number> = {};
                    invs.forEach(inv => {
                        const mk = inv.invoiceDate?.slice(0, 7) || '';
                        monthSpend[mk] = (monthSpend[mk] || 0) + (inv.grandTotal || 0);
                    });
                    const monthKeys = Object.keys(monthSpend).sort();
                    const recent3 = monthKeys.slice(-3).reduce((s, k) => s + monthSpend[k], 0) / 3;
                    const older3 = monthKeys.slice(-6, -3).reduce((s, k) => s + monthSpend[k], 0) / Math.max(1, monthKeys.slice(-6, -3).length);
                    const trendPct = older3 > 0 ? ((recent3 - older3) / older3) * 100 : 0;
                    const trend: 'up' | 'down' | 'stable' = trendPct > 10 ? 'up' : trendPct < -10 ? 'down' : 'stable';

                    const forecastRevenue = Math.max(0, recent3 * (trend === 'up' ? 1.1 : trend === 'down' ? 0.8 : 1.0));
                    const risk = assessRisk(daysSince, avgInterval, totalSpend, trend);

                    const prodCount: Record<string, number> = {};
                    invs.forEach(inv => {
                        (inv.lineItems || []).forEach((li: any) => {
                            const p = li.product || li.description || '';
                            prodCount[p] = (prodCount[p] || 0) + (li.quantity || 1);
                        });
                    });
                    const topProducts = Object.entries(prodCount)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([p]) => p)
                        .filter(Boolean);

                    return {
                        customerId: cid,
                        customerName: customer?.name || `Customer ${cid}`,
                        lastOrderDate: sorted[0].invoiceDate || '',
                        daysSinceOrder: daysSince,
                        totalSpend,
                        avgOrderValue: avgOrder,
                        orderCount: invs.length,
                        forecastNextMonth: Math.ceil(forecastRevenue / Math.max(avgOrder, 1)),
                        forecastRevenue,
                        trend,
                        trendPct: Math.abs(Math.round(trendPct)),
                        risk,
                        topProducts,
                    };
                });

            setForecasts(result);
            setLoading(false);
        });
    }, []);

    const getAIInsight = async () => {
        if (forecasts.length === 0) return;
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const top5 = [...forecasts].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 5);
            const atRisk = forecasts.filter(f => f.risk === 'high').slice(0, 5);
            const res = await authFetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Bettano, a CRM and sales advisor for a distribution company. Max 150 words. No markdown. CAPS for headings.`,
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `Customer forecast data for ${FORECAST_PERIOD}:

TOP 5 BY REVENUE:
${top5.map(f => `${f.customerName}: ${formatCurrency(f.totalSpend)} total, ${f.orderCount} orders, trend: ${f.trend} ${f.trendPct}%, last order: ${f.daysSinceOrder} days ago`).join('\n')}

AT-RISK CUSTOMERS (order gap exceeds normal cadence):
${atRisk.length > 0 ? atRisk.map(f => `${f.customerName}: ${f.daysSinceOrder} days silent, previously spent ${formatCurrency(f.totalSpend)}`).join('\n') : 'None'}

Which customers should I contact TODAY and what should I say?`,
                    }],
                }),
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setAiInsight(data.reply || '');
        } catch {
            setAiInsight('Could not reach AI.');
        } finally {
            setAiLoading(false);
        }
    };

    const sorted = [...forecasts]
        .filter(f => !search || f.customerName.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'revenue') return b.forecastRevenue - a.forecastRevenue;
            if (sortBy === 'risk') {
                const r = { high: 0, medium: 1, low: 2 };
                return r[a.risk] - r[b.risk];
            }
            return a.daysSinceOrder - b.daysSinceOrder;
        });

    const totalForecast = forecasts.reduce((s, f) => s + f.forecastRevenue, 0);
    const atRiskCount = forecasts.filter(f => f.risk === 'high').length;
    const growingCount = forecasts.filter(f => f.trend === 'up').length;

    const inputStyle: CSSProperties = {
        flex: 1,
        minWidth: 200,
        background: C.bg3,
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 12,
        fontWeight: 600,
        color: C.text,
        outline: 'none',
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
                background: C.bg,
                color: C.text,
                fontFamily: 'inherit',
                margin: '-24px -40px',
                width: 'calc(100% + 80px)',
                paddingBottom: 80,
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 28px',
                    borderBottom: '1px solid rgba(255,255,255,.06)',
                    background: C.bg2,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
                    <button
                        type="button"
                        onClick={() => navigate('/ai')}
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600 }}
                    >
                        AI hub
                    </button>
                    <ChevronRight size={12} color={C.dim} />
                    <span style={{ color: C.text, fontWeight: 600 }}>Customer-level forecast</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        type="button"
                        onClick={openBettanoAdvisor}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(245,158,11,.35)',
                            background: 'rgba(245,158,11,.12)',
                            color: '#FCD34D',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ fontSize: 13 }}>🛢</span>
                        <MessageCircle size={13} /> Ask Bettano
                    </button>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#fff',
                        }}
                    >
                        {userInitials(currentUser.name)}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 32px' }}>
                {/* Page header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                            <Users size={24} color={C.purple} />
                            Customer-level forecast
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 5, marginBottom: 0, maxWidth: 620 }}>
                            Predict what each customer will order next month · {FORECAST_PERIOD}
                        </p>
                    </div>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 999,
                            background: 'rgba(124,58,237,.12)',
                            color: '#C4B5FD',
                            border: '1px solid rgba(124,58,237,.35)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {FORECAST_PERIOD}
                    </span>
                </div>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                    {[
                        {
                            label: 'Customers tracked',
                            value: loading ? '…' : forecasts.length,
                            sub: 'with order history',
                            accent: C.purple,
                        },
                        {
                            label: 'June forecast total',
                            value: loading ? '…' : formatCurrency(totalForecast),
                            sub: 'predicted revenue',
                            accent: C.blue,
                        },
                        {
                            label: 'At-risk customers',
                            value: loading ? '…' : `${atRiskCount} / ${forecasts.length}`,
                            sub: 'order gap exceeds cadence',
                            accent: atRiskCount > 0 ? C.red : C.green,
                        },
                        {
                            label: 'Growing customers',
                            value: loading ? '…' : growingCount,
                            sub: 'upward trend detected',
                            accent: C.green,
                        },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            style={{
                                ...panel,
                                padding: '14px 16px',
                                borderTop: `3px solid ${kpi.accent}`,
                            }}
                        >
                            <p style={{ fontSize: 10, fontWeight: 600, color: C.muted, margin: '0 0 6px' }}>
                                {kpi.label}
                            </p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
                                {kpi.value}
                            </p>
                            <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>{kpi.sub}</p>
                        </div>
                    ))}
                </div>

                {/* AI insight — shown after trigger */}
                {aiInsight && (
                    <div style={{
                        ...panel,
                        padding: '16px 18px',
                        marginBottom: 14,
                        background: `linear-gradient(135deg, rgba(124,58,237,.12), rgba(245,158,11,.08))`,
                        border: '1px solid rgba(124,58,237,.25)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'rgba(124,58,237,.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}>
                                <Zap size={18} color={C.purple} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: C.orange, margin: '0 0 6px' }}>
                                    Bettano — Customer intelligence
                                </p>
                                <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                                    {aiInsight.split('\n').map((line, i) => {
                                        const t = line.trim();
                                        if (!t) return <div key={i} style={{ height: 4 }} />;
                                        if (t === t.toUpperCase() && t.length > 4) {
                                            return (
                                                <p key={i} style={{ fontWeight: 700, color: C.orange, fontSize: 10, textTransform: 'uppercase', margin: '8px 0 4px' }}>
                                                    {t}
                                                </p>
                                            );
                                        }
                                        return <p key={i} style={{ margin: '2px 0', color: C.muted }}>{t}</p>;
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Insight trigger */}
                {!aiInsight && !aiLoading && forecasts.length > 0 && (
                    <div style={{ ...panel, padding: '16px 18px', marginBottom: 14, background: C.bg3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: 'rgba(245,158,11,.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Bot size={18} color={C.orange} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 11, fontWeight: 700, color: C.orange, margin: '0 0 4px' }}>Bettano says:</p>
                                    <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
                                        {atRiskCount > 0
                                            ? `${atRiskCount} at-risk customer${atRiskCount !== 1 ? 's' : ''} flagged — ask Bettano who to contact today.`
                                            : `${forecasts.length} customers forecast — ask Bettano for outreach priorities.`}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={getAIInsight}
                                disabled={aiLoading || forecasts.length === 0}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '7px 14px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: C.orange,
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                <Zap size={13} /> Get insight
                            </button>
                        </div>
                    </div>
                )}

                {aiLoading && (
                    <div style={{ ...panel, padding: '16px 18px', marginBottom: 14, background: C.bg3 }}>
                        <p style={{ fontSize: 12, color: C.muted, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RefreshCw size={14} className="animate-spin" /> Bettano is analysing customer patterns...
                        </p>
                    </div>
                )}

                {/* Controls row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                        <Search size={14} color={C.dim} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search customer..."
                            style={{ ...inputStyle, paddingLeft: 36 }}
                        />
                    </div>
                    {([
                        { key: 'revenue' as const, label: 'By revenue', icon: DollarSign },
                        { key: 'risk' as const, label: 'By risk', icon: AlertTriangle },
                        { key: 'recent' as const, label: 'By recency', icon: Clock },
                    ]).map(s => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => setSortBy(s.key)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '7px 14px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    border: sortBy === s.key ? '1px solid rgba(79,142,247,.4)' : '1px solid rgba(255,255,255,.08)',
                                    background: sortBy === s.key ? 'rgba(79,142,247,.15)' : C.bg3,
                                    color: sortBy === s.key ? '#93C5FD' : C.muted,
                                }}
                            >
                                <Icon size={12} /> {s.label}
                            </button>
                        );
                    })}
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 999,
                            background: 'rgba(124,58,237,.12)',
                            color: '#C4B5FD',
                            border: '1px solid rgba(124,58,237,.25)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {FORECAST_PERIOD}
                    </span>
                </div>

                {/* Main table */}
                <div style={{ ...panel, overflow: 'hidden', background: C.bg3 }}>
                    <div style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid rgba(255,255,255,.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>
                            Customer forecasts · {sorted.length} shown
                        </p>
                    </div>

                    {loading ? (
                        <div style={{ padding: 48, textAlign: 'center' }}>
                            <RefreshCw size={32} className="animate-spin" color={C.purple} style={{ margin: '0 auto 12px' }} />
                            <p style={{ color: C.muted, fontWeight: 700, fontSize: 12, margin: 0 }}>Analyzing customer order patterns...</p>
                        </div>
                    ) : sorted.length === 0 ? (
                        <div style={{ padding: 48, textAlign: 'center' }}>
                            <p style={{ color: C.muted, fontWeight: 700, fontSize: 14, margin: 0 }}>No customers match your search</p>
                            <p style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Try adjusting your search term</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                                        {['Customer', 'Orders', 'Avg value', 'Trend', 'Last order', 'Next month est.', 'Top products', 'Risk'].map(h => (
                                            <th key={h} style={{
                                                padding: '10px 16px',
                                                fontSize: 10,
                                                fontWeight: 600,
                                                color: C.dim,
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map(f => (
                                        <tr
                                            key={f.customerId}
                                            style={{
                                                borderBottom: '1px solid rgba(255,255,255,.04)',
                                                background: f.risk === 'high' ? 'rgba(239,68,68,.06)' : 'transparent',
                                                transition: 'background .12s',
                                            }}
                                        >
                                            <td style={{ padding: '12px 16px' }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{f.customerName}</p>
                                                <p style={{ fontSize: 10, color: C.dim, margin: '3px 0 0' }}>{formatCurrency(f.totalSpend)} lifetime</p>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: C.text }}>
                                                {f.orderCount}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontWeight: 600, color: C.muted, fontFamily: 'monospace' }}>
                                                {formatCurrency(f.avgOrderValue)}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <TrendIcon trend={f.trend} pct={f.trendPct} />
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <p style={{ fontSize: 11, fontFamily: 'monospace', color: C.muted, margin: 0 }}>{f.lastOrderDate}</p>
                                                <p style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    margin: '3px 0 0',
                                                    color: f.risk === 'high' ? C.red : f.risk === 'medium' ? C.orange : C.green,
                                                }}>
                                                    {f.daysSinceOrder}d ago
                                                </p>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: C.blue, margin: 0 }}>{formatCurrency(f.forecastRevenue)}</p>
                                                <p style={{ fontSize: 10, color: C.dim, margin: '3px 0 0' }}>
                                                    est. {f.forecastNextMonth} order{f.forecastNextMonth !== 1 ? 's' : ''}
                                                </p>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {f.topProducts.slice(0, 2).map((p, i) => (
                                                        <span
                                                            key={i}
                                                            style={{
                                                                fontSize: 9,
                                                                fontWeight: 600,
                                                                padding: '3px 8px',
                                                                borderRadius: 999,
                                                                background: C.bg4,
                                                                color: C.muted,
                                                                maxWidth: 100,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {p}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <RiskBadge risk={f.risk} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer note */}
            <div style={{
                position: 'sticky',
                bottom: 0,
                padding: '12px 28px',
                borderTop: '1px solid rgba(255,255,255,.06)',
                background: C.bg2,
                textAlign: 'center',
            }}>
                <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>
                    Forecast based on historical order patterns and trend analysis · At-risk = order gap exceeds normal cadence
                </p>
            </div>
        </div>
    );
}
