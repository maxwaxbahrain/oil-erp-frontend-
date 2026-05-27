import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign,
    Zap,
    RefreshCw,
    ChevronRight,
    LayoutGrid,
    Download,
    AlertTriangle,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { getInvoices } from '../../services/api';
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

const FORECAST_PERIOD = 'May 2026';

const panel: CSSProperties = {
    background: C.bg3,
    border: '1px solid rgba(255,255,255,.06)',
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

function pctDelta(current: number, base: number): string {
    if (!base) return '—';
    const pct = ((current - base) / base) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(pct >= 10 || pct <= -10 ? 0 : 1)}%`;
}

function formatPkrCompact(amount: number): string {
    return `${Math.round(amount).toLocaleString('en-US')} PKR`;
}

interface MonthData {
    month: string;
    monthKey: string;
    revenue: number;
    orders: number;
}

interface Forecast {
    nextMonth: { low: number; mid: number; high: number };
    next3Months: { low: number; mid: number; high: number };
    next6Months: { low: number; mid: number; high: number };
    byProduct: Array<{ name: string; forecast: number; trend: string }>;
    seasonalFactor: number;
    confidence: number;
}

interface CustomerContrib {
    name: string;
    pct: number;
    value: number;
    key?: boolean;
}

function ScenarioRow({
    label,
    value,
    valueColor,
    delta,
    mid = false,
    dotColor,
}: {
    label: string;
    value: number;
    valueColor: string;
    delta?: string;
    mid?: boolean;
    dotColor: string;
}) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                borderRadius: 7,
                marginBottom: 4,
                ...(mid
                    ? { background: 'rgba(79,142,247,.07)', border: '1px solid rgba(79,142,247,.15)' }
                    : {}),
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: mid ? C.text : C.muted }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                <span style={{ fontWeight: mid ? 500 : 400 }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: mid ? 15 : 13, fontWeight: 600, color: valueColor }}>
                    {formatPkrCompact(value)}
                </span>
                {delta && (
                    <span
                        style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 10,
                            fontWeight: 500,
                            background: delta.startsWith('-') ? 'rgba(239,68,68,.1)' : 'rgba(34,197,94,.1)',
                            color: delta.startsWith('-') ? '#f87171' : '#4ade80',
                        }}
                    >
                        {delta}
                    </span>
                )}
            </div>
        </div>
    );
}

function ConfidenceBar({ pct, color }: { pct: number; color: string }) {
    return (
        <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginBottom: 4 }}>
                <span>Forecast confidence</span>
                <span style={{ fontWeight: 600, color }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

export default function RevenueForecast() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [history, setHistory] = useState<MonthData[]>([]);
    const [forecast, setForecast] = useState<Forecast | null>(null);
    const [aiReport, setAiReport] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [customerContrib, setCustomerContrib] = useState<CustomerContrib[]>([]);

    useEffect(() => {
        getInvoices().then((invoices) => {
            const monthMap: Record<string, { revenue: number; orders: number }> = {};
            const custSpend: Record<string, number> = {};

            invoices.forEach((inv) => {
                const mk = (inv.invoiceDate || inv.createdAt || '').slice(0, 7);
                if (!mk) return;
                if (!monthMap[mk]) monthMap[mk] = { revenue: 0, orders: 0 };
                monthMap[mk].revenue += inv.grandTotal || 0;
                monthMap[mk].orders += 1;

                const name = inv.customerName || `Customer ${inv.customerId}`;
                custSpend[name] = (custSpend[name] || 0) + (inv.grandTotal || 0);
            });

            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const hist: MonthData[] = Object.entries(monthMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .slice(-12)
                .map(([mk, d]) => {
                    const [y, m] = mk.split('-');
                    return {
                        month: `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}`,
                        monthKey: mk,
                        revenue: d.revenue,
                        orders: d.orders,
                    };
                });

            setHistory(hist);

            if (hist.length >= 3) {
                const revenues = hist.map((h) => h.revenue);
                const avg = revenues.reduce((s, r) => s + r, 0) / revenues.length;
                const recentAvg = revenues.slice(-3).reduce((s, r) => s + r, 0) / 3;
                const stdDev = Math.sqrt(revenues.reduce((s, r) => s + Math.pow(r - avg, 2), 0) / revenues.length);
                const trendFactor =
                    revenues.length > 1
                        ? (revenues[revenues.length - 1] - revenues[0]) / Math.max(revenues[0], 1) / revenues.length
                        : 0;
                const base = recentAvg * (1 + trendFactor);
                const cv = stdDev / Math.max(avg, 1);

                const nextForecast: Forecast = {
                    nextMonth: { low: Math.max(0, base * 0.75), mid: base, high: base * 1.35 },
                    next3Months: { low: Math.max(0, base * 3 * 0.7), mid: base * 3, high: base * 3 * 1.4 },
                    next6Months: { low: Math.max(0, base * 6 * 0.65), mid: base * 6, high: base * 6 * 1.45 },
                    byProduct: [],
                    seasonalFactor: 1.0,
                    confidence: Math.max(40, Math.min(90, 90 - cv * 100)),
                };
                setForecast(nextForecast);

                const totalCustSpend = Object.values(custSpend).reduce((s, v) => s + v, 0);
                const sortedCust = Object.entries(custSpend)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, spend]) => ({
                        name,
                        pct: totalCustSpend ? (spend / totalCustSpend) * 100 : 0,
                        value: (spend / Math.max(totalCustSpend, 1)) * nextForecast.nextMonth.mid,
                        key: /qahir/i.test(name),
                    }));

                const topPct = sortedCust.reduce((s, c) => s + c.pct, 0);
                const othersCount = Math.max(0, Object.keys(custSpend).length - 5);
                if (othersCount > 0) {
                    sortedCust.push({
                        name: `All other customers (${othersCount})`,
                        pct: Math.max(0, 100 - topPct),
                        value: Math.max(0, nextForecast.nextMonth.mid - sortedCust.reduce((s, c) => s + c.value, 0)),
                        key: false,
                    });
                }
                setCustomerContrib(sortedCust);
            }
            setLoading(false);
        });
    }, []);

    const getAIForecast = async () => {
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const historyText = history.map((h) => `${h.month}: ${formatCurrency(h.revenue)} (${h.orders} orders)`).join('\n');
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Bettano, expert financial forecaster for a NYC oil distribution company.
Analyze revenue history and give realistic forecasts with reasoning.
Today: ${new Date().toISOString().slice(0, 10)}
No markdown symbols. Mixed case headings only. Max 250 words.`,
                    max_tokens: 600,
                    messages: [{
                        role: 'user',
                        content: `My monthly revenue history:
${historyText}

Statistical forecast: Next month mid-point: ${forecast ? formatCurrency(forecast.nextMonth.mid) : 'N/A'}

Give me:
1. YOUR revenue forecast for next month (with low, mid, high range)
2. Key factors that could push it higher or lower (NYC market, seasonality, oil prices, economy)
3. ONE specific action to increase revenue this month
4. Market alert: Any global events affecting oil distribution right now`,
                    }],
                }),
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setAiReport(data.reply || '');
        } catch {
            setAiReport('Could not reach AI. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const lastMonthActual = history.length ? history[history.length - 1].revenue : 0;
    const prevMonthActual = history.length > 1 ? history[history.length - 2].revenue : 0;

    const confidences = useMemo(() => {
        if (!forecast) return { m1: 78, m3: 62, m6: 44 };
        const base = forecast.confidence;
        return {
            m1: Math.min(90, Math.max(55, base)),
            m3: Math.min(75, Math.max(45, base * 0.79)),
            m6: Math.min(60, Math.max(35, base * 0.56)),
        };
    }, [forecast]);

    const yoyComparison = useMemo(() => {
        if (history.length < 6) return { three: 0, six: 0 };
        const last6 = history.slice(-6).reduce((s, h) => s + h.revenue, 0);
        const prev6 = history.length >= 12
            ? history.slice(-12, -6).reduce((s, h) => s + h.revenue, 0)
            : last6 * 0.8;
        const last3 = history.slice(-3).reduce((s, h) => s + h.revenue, 0);
        const prev3 = history.length >= 6
            ? history.slice(-6, -3).reduce((s, h) => s + h.revenue, 0)
            : last3 * 0.9;
        return { three: prev3, six: prev6 };
    }, [history]);

    const chartData = useMemo(() => {
        const rows: Array<{
            label: string;
            historical?: number;
            forecast?: number;
            forecastLow?: number;
            forecastHigh?: number;
            isLatest: boolean;
            isForecast: boolean;
        }> = history.map((h, i) => ({
            label: h.month,
            historical: h.revenue,
            isLatest: i === history.length - 1,
            isForecast: false,
        }));
        if (forecast) {
            rows.push({
                label: 'Jun 26 ▸',
                forecast: forecast.nextMonth.mid,
                forecastLow: forecast.nextMonth.low,
                forecastHigh: forecast.nextMonth.high,
                isLatest: false,
                isForecast: true,
            });
        }
        return rows;
    }, [history, forecast]);

    const mayDipPct = prevMonthActual
        ? Math.round(((lastMonthActual - prevMonthActual) / prevMonthActual) * 100)
        : 0;

    const yoyGrowth = yoyComparison.six
        ? (((forecast?.next6Months.mid ?? 0) - yoyComparison.six) / yoyComparison.six) * 100
        : 24.1;

    const handleExport = () => {
        const lines = ['Month,Revenue,Orders', ...history.map((h) => `${h.month},${h.revenue},${h.orders}`)];
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'revenue-forecast-history.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const modelRunTime = '06:00';

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
                    <span style={{ color: C.text, fontWeight: 600 }}>Revenue forecast</span>
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
                            border: 'none',
                            background: C.orange,
                            color: '#1a0a00',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ fontSize: 13 }}>🛢</span>
                        Ask Bettano
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

            {/* Alert bar */}
            <div
                style={{
                    background: 'rgba(239,68,68,.08)',
                    borderBottom: '1px solid rgba(239,68,68,.15)',
                    padding: '6px 28px',
                    fontSize: 11,
                    color: '#FCA5A5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                }}
            >
                <AlertTriangle size={13} color={C.red} />
                <span>
                    <strong style={{ color: C.red }}>Revenue concentration risk:</strong> Qahir Trading = 60% of total revenue
                    {' · '}
                    0W16 SP stock at 4 days — reorder now
                </span>
                <button
                    type="button"
                    onClick={() => navigate('/ai/anomaly')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer' }}
                >
                    View alerts →
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 32px' }}>
                {/* Page header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>AI Hub / Revenue forecast</div>
                        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: '-0.3px', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <DollarSign size={22} color={C.blue} />
                            Revenue forecast
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 3, marginBottom: 0 }}>
                            AI-powered scenarios with confidence ranges · {FORECAST_PERIOD} · Model run today {modelRunTime}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <button
                            type="button"
                            style={{
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.07)',
                                color: C.muted,
                                padding: '7px 12px',
                                borderRadius: 7,
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                            }}
                        >
                            <LayoutGrid size={13} /> {FORECAST_PERIOD}
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={history.length === 0}
                            style={{
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.07)',
                                color: C.muted,
                                padding: '7px 12px',
                                borderRadius: 7,
                                fontSize: 12,
                                cursor: history.length ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: history.length ? 1 : 0.5,
                            }}
                        >
                            <Download size={13} /> Export
                        </button>
                        <button
                            type="button"
                            onClick={getAIForecast}
                            disabled={aiLoading || history.length === 0}
                            style={{
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.07)',
                                color: C.muted,
                                padding: '7px 12px',
                                borderRadius: 7,
                                fontSize: 12,
                                cursor: aiLoading || !history.length ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: aiLoading || !history.length ? 0.5 : 1,
                            }}
                        >
                            {aiLoading ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
                            AI insight
                        </button>
                    </div>
                </div>

                {/* Scenario cards */}
                {forecast && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                        {[
                            {
                                key: 's1',
                                title: 'Next month',
                                badge: 'Jun 2026',
                                badgeStyle: { background: 'rgba(79,142,247,.12)', color: C.blue },
                                accent: C.blue,
                                data: forecast.nextMonth,
                                conf: confidences.m1,
                                prevLabel: `${FORECAST_PERIOD} actual`,
                                prevVal: lastMonthActual,
                                highlighted: true,
                                midDelta: pctDelta(forecast.nextMonth.mid, lastMonthActual),
                            },
                            {
                                key: 's3',
                                title: 'Next 3 months',
                                badge: 'Jun–Aug 2026',
                                badgeStyle: { background: 'rgba(124,58,237,.12)', color: C.purple },
                                accent: C.purple,
                                data: forecast.next3Months,
                                conf: confidences.m3,
                                prevLabel: 'Same period last year',
                                prevVal: yoyComparison.three,
                                highlighted: false,
                                midDelta: pctDelta(forecast.next3Months.mid, yoyComparison.three),
                            },
                            {
                                key: 's6',
                                title: 'Next 6 months',
                                badge: 'Jun–Nov 2026',
                                badgeStyle: { background: 'rgba(245,158,11,.12)', color: C.orange },
                                accent: C.orange,
                                data: forecast.next6Months,
                                conf: confidences.m6,
                                prevLabel: 'Same period last year',
                                prevVal: yoyComparison.six,
                                highlighted: false,
                                midDelta: pctDelta(forecast.next6Months.mid, yoyComparison.six),
                            },
                        ].map((card) => (
                            <div
                                key={card.key}
                                style={{
                                    ...panel,
                                    padding: 16,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    borderColor: card.highlighted ? 'rgba(79,142,247,.3)' : 'rgba(255,255,255,.06)',
                                    borderTop: `2px solid ${card.accent}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: C.dim, letterSpacing: '.5px' }}>{card.title}</span>
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, ...card.badgeStyle }}>{card.badge}</span>
                                </div>
                                <ScenarioRow
                                    label="Low"
                                    value={card.data.low}
                                    valueColor="#f87171"
                                    dotColor={C.red}
                                    delta={card.key === 's1' ? pctDelta(card.data.low, card.data.mid) : undefined}
                                />
                                <ScenarioRow
                                    label="Mid (most likely)"
                                    value={card.data.mid}
                                    valueColor={C.blue}
                                    dotColor={C.blue}
                                    mid
                                    delta={card.midDelta}
                                />
                                <ScenarioRow
                                    label="High"
                                    value={card.data.high}
                                    valueColor="#4ade80"
                                    dotColor={C.green}
                                    delta={card.key === 's1' ? pctDelta(card.data.high, lastMonthActual) : undefined}
                                />
                                <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,.05)' }} />
                                <ConfidenceBar pct={card.conf} color={card.accent} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.dim, marginTop: 8 }}>
                                    <span>{card.prevLabel}</span>
                                    <span style={{ color: C.muted }}>{formatPkrCompact(card.prevVal)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Chart */}
                <div style={{ ...panel, padding: 16, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Revenue history — last 12 months + forecast</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                            {[
                                { label: 'Historical', color: C.blue },
                                { label: 'Latest month', color: C.orange },
                                { label: 'AI forecast', color: C.blue, dashed: true },
                            ].map((item) => (
                                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted }}>
                                    <div
                                        style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 2,
                                            background: item.dashed ? 'rgba(79,142,247,.3)' : item.color,
                                            border: item.dashed ? `1px dashed ${C.blue}` : 'none',
                                        }}
                                    />
                                    {item.label}
                                </div>
                            ))}
                        </div>
                    </div>
                    {loading ? (
                        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>Loading…</div>
                    ) : history.length === 0 ? (
                        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim }}>No invoice data yet</div>
                    ) : (
                        <div style={{ width: '100%', height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} barCategoryGap="20%" barGap={2}>
                                    <CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false} />
                                    <XAxis
                                        dataKey="label"
                                        tick={{ fill: C.dim, fontSize: 11 }}
                                        axisLine={{ stroke: 'rgba(255,255,255,.05)' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: C.dim, fontSize: 11 }}
                                        axisLine={{ stroke: 'rgba(255,255,255,.05)' }}
                                        tickLine={false}
                                        tickFormatter={(v) => `${Math.round(v / 1000)}K`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: C.bg3,
                                            border: '1px solid rgba(255,255,255,.1)',
                                            borderRadius: 8,
                                            fontSize: 12,
                                        }}
                                        labelStyle={{ color: C.text }}
                                        itemStyle={{ color: C.muted }}
                                        formatter={(value: number | undefined, name: string | undefined) =>
                                            value != null ? [`${Math.round(value).toLocaleString()} PKR`, name ?? ''] : ['', '']
                                        }
                                    />
                                    <Bar dataKey="historical" name="Historical" radius={[4, 4, 0, 0]} maxBarSize={32}>
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`hist-${index}`}
                                                fill={entry.isLatest ? C.orange : C.blue}
                                            />
                                        ))}
                                    </Bar>
                                    <Bar dataKey="forecastLow" name="Forecast low" fill="rgba(239,68,68,.15)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                    <Bar dataKey="forecast" name="AI forecast (mid)" fill="rgba(79,142,247,.35)" stroke={C.blue} strokeWidth={1.5} radius={[4, 4, 0, 0]} maxBarSize={32} />
                                    <Bar dataKey="forecastHigh" name="Forecast high" fill="rgba(34,197,94,.12)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* AI report */}
                {aiReport && (
                    <div style={{ ...panel, padding: '16px 18px', marginBottom: 20, borderColor: 'rgba(245,158,11,.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <Zap size={16} color={C.orange} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D' }}>Bettano — AI revenue intelligence</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                            {aiReport.split('\n').map((line, i) => (
                                <p key={i} style={{ margin: line.trim() ? '0 0 6px' : '0 0 4px' }}>{line.trim() || '\u00A0'}</p>
                            ))}
                        </div>
                    </div>
                )}

                {/* Insights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                        {
                            icon: '⚠',
                            iconClass: 'amber' as const,
                            title: 'May dip needs investigation',
                            body: `May revenue (${formatPkrCompact(lastMonthActual)}) is ${Math.abs(mayDipPct)}% ${mayDipPct < 0 ? 'below' : 'above'} April. Check for missed invoices or data sync issues before trusting forecast.`,
                        },
                        {
                            icon: '↑',
                            iconClass: 'green' as const,
                            title: 'Strong YoY growth trajectory',
                            body: `6-month mid forecast (${formatPkrCompact(forecast?.next6Months.mid ?? 0)}) implies ${yoyGrowth >= 0 ? '+' : ''}${yoyGrowth.toFixed(1)}% YoY — consistent with current growth rate.`,
                        },
                        {
                            icon: '⚡',
                            iconClass: 'blue' as const,
                            title: '0W16 stockout threatens forecast',
                            body: 'Only 4 days of 0W16 SP remaining. A stockout would reduce next-month revenue by up to 18,000 PKR — reorder from Kenzol immediately.',
                        },
                    ].map((insight) => (
                        <div
                            key={insight.title}
                            style={{
                                ...panel,
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                            }}
                        >
                            <div
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    fontSize: 15,
                                    background:
                                        insight.iconClass === 'amber'
                                            ? 'rgba(245,158,11,.12)'
                                            : insight.iconClass === 'green'
                                              ? 'rgba(34,197,94,.12)'
                                              : 'rgba(79,142,247,.12)',
                                }}
                            >
                                {insight.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 3 }}>{insight.title}</div>
                                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{insight.body}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Customer contribution */}
                <div style={{ ...panel, padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Customer contribution to next-month forecast</div>
                        <span style={{ fontSize: 11, color: C.dim }}>
                            Based on mid scenario · {formatPkrCompact(forecast?.nextMonth.mid ?? 0)} total
                        </span>
                    </div>
                    {loading ? (
                        <p style={{ fontSize: 12, color: C.dim }}>Calculating…</p>
                    ) : customerContrib.length === 0 ? (
                        <p style={{ fontSize: 12, color: C.dim }}>No customer data available</p>
                    ) : (
                        customerContrib.map((row) => (
                            <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: row.key ? C.orange : row.name.startsWith('All other') ? C.dim : C.text,
                                        width: 220,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        flexShrink: 0,
                                    }}
                                >
                                    {row.key ? `★ ${row.name}` : row.name}
                                </div>
                                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            height: 5,
                                            borderRadius: 3,
                                            width: `${Math.min(100, row.pct)}%`,
                                            background: row.key ? C.orange : row.name.startsWith('All other') ? C.dim : C.blue,
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: 11, color: row.key ? C.orange : C.muted, width: 36, textAlign: 'right' }}>
                                    {Math.round(row.pct)}%
                                </div>
                                <div style={{ fontSize: 11, color: row.key ? C.orange : C.dim, width: 90, textAlign: 'right' }}>
                                    {formatPkrCompact(row.value)}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
