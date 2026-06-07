import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import {
    TrendingUp,
    AlertTriangle,
    RefreshCw,
    ChevronRight,
    Download,
    Search,
    AlertCircle,
    BarChart3,
    Clock,
    Check,
    ArrowDown,
    LayoutList,
} from 'lucide-react';
import { authFetch } from '../../api/axios';
import { getInvoices, getProducts } from '../../services/api';
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
    border: '1px solid rgba(255,255,255,.05)',
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

function formatPkrCompact(amount: number): string {
    return `${Math.round(amount).toLocaleString('en-US')} PKR`;
}

interface ProductForecast {
    productId: string;
    productName: string;
    sku: string;
    currentStock: number;
    minStock: number;
    unitPrice: number;
    monthlyHistory: Array<{ month: string; qty: number; revenue: number }>;
    avgMonthlySales: number;
    forecastNextMonth: number;
    forecastNext3Months: number;
    trend: 'up' | 'down' | 'stable';
    trendPct: number;
    daysUntilStockout: number;
    suggestedOrderQty: number;
    urgency: 'critical' | 'warning' | 'good';
}

function getMonthKey(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function calcTrend(history: Array<{ qty: number }>): { trend: 'up' | 'down' | 'stable'; pct: number } {
    if (history.length < 2) return { trend: 'stable', pct: 0 };
    const recent = history.slice(-3).reduce((s, h) => s + h.qty, 0) / Math.min(3, history.length);
    const older = history.slice(0, -3).reduce((s, h) => s + h.qty, 0) / Math.max(1, history.length - 3);
    if (older === 0) return { trend: recent > 0 ? 'up' : 'stable', pct: 0 };
    const pct = ((recent - older) / older) * 100;
    if (pct > 5) return { trend: 'up', pct: Math.round(pct) };
    if (pct < -5) return { trend: 'down', pct: Math.round(Math.abs(pct)) };
    return { trend: 'stable', pct: Math.round(Math.abs(pct)) };
}

function dailyVelocity(avgMonthly: number): number {
    return Math.round((avgMonthly / 30) * 10) / 10;
}

function daysCover(qty: number, avgMonthly: number): number {
    const vel = avgMonthly / 30;
    if (!vel || !qty) return 0;
    return Math.round(qty / vel);
}

function supplierHint(name: string): string {
    if (/zenol|0w20/i.test(name)) return 'Kenzol Multi Industries FZC';
    if (/mobil.*5w30/i.test(name)) return 'Petro Choice Lubrication';
    if (/kamran|0w40/i.test(name)) return 'Kamran Hafeez';
    return 'Kenzol Multi Industries FZC';
}

function productMeta(f: ProductForecast): string {
    if (/0w16/i.test(f.productName)) return 'Flagship product · 60% of Qahir orders · 3–5 day lead time';
    if (/0w20/i.test(f.productName)) return '2nd highest velocity · ZENOL 0W20 pricing at 0.00 PKR — fix before reorder';
    if (/5w30/i.test(f.productName)) return '14–21 day lead time — order before day 7 · Net 60 terms';
    if (/10w40/i.test(f.productName)) return 'Steady demand · no trend signal';
    if (f.trend === 'up') return `Growing demand +${f.trendPct}% MoM · monitor closely`;
    if (f.trend === 'down') return `Demand declining ${f.trendPct}% · review pricing`;
    return 'Stable demand · monitor monthly';
}

type SortKey = 'urgency' | 'sales' | 'stock' | 'velocity';

const GRID_COLS = '36px 1fr 90px 90px 90px 90px 110px 80px';

function UrgencyBadge({ urgency, days }: { urgency: ProductForecast['urgency']; days: number }) {
    const styles = {
        critical: { bg: 'rgba(239,68,68,.15)', color: '#f87171', label: 'Critical' },
        warning: { bg: 'rgba(245,158,11,.15)', color: C.orange, label: `${days} days` },
        good: { bg: 'rgba(34,197,94,.1)', color: '#4ade80', label: `${days} days` },
    }[urgency];
    return (
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, letterSpacing: '.3px', background: styles.bg, color: styles.color }}>
            {styles.label}
        </span>
    );
}

function ProductRow({
    f,
    onOrder,
}: {
    f: ProductForecast;
    onOrder: (f: ProductForecast) => void;
}) {
    const vel = dailyVelocity(f.avgMonthlySales);
    const cover = daysCover(f.suggestedOrderQty, f.avgMonthlySales);
    const borderColor =
        f.urgency === 'critical'
            ? 'rgba(239,68,68,.25)'
            : f.urgency === 'warning'
              ? 'rgba(245,158,11,.2)'
              : 'rgba(34,197,94,.12)';
    const iconBg =
        f.urgency === 'critical'
            ? 'rgba(239,68,68,.1)'
            : f.urgency === 'warning'
              ? 'rgba(245,158,11,.1)'
              : 'rgba(34,197,94,.08)';

    const stockColor = f.urgency === 'critical' ? C.red : f.urgency === 'warning' ? C.orange : C.green;
    const daysColor = stockColor;

    return (
        <div
            style={{
                background: C.bg3,
                border: `1px solid ${borderColor}`,
                borderRadius: 10,
                padding: '14px 16px',
                marginBottom: 8,
                display: 'grid',
                gridTemplateColumns: GRID_COLS,
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                transition: 'background .1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.bg4; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.bg3; }}
        >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                🛢
            </div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {f.productName}
                    <UrgencyBadge urgency={f.urgency} days={f.daysUntilStockout >= 999 ? 0 : f.daysUntilStockout} />
                </div>
                <div style={{ fontSize: 10, color: C.dim }}>SKU: {f.sku} · {supplierHint(f.productName)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{productMeta(f)}</div>
            </div>
            <StatCol value={f.currentStock} unit="units" color={stockColor} />
            <StatCol value={f.daysUntilStockout >= 999 ? '—' : f.daysUntilStockout} unit="days" color={daysColor} />
            <StatCol value={vel} unit="units/day" color={f.urgency === 'warning' ? C.orange : C.text} />
            <StatCol value={f.forecastNextMonth} unit="units est." color={C.blue} />
            <div style={{ textAlign: 'center' }}>
                {f.urgency === 'good' ? (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.dim }}>—</div>
                        <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>no action needed</div>
                    </>
                ) : (
                    <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.suggestedOrderQty} units</div>
                        <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{cover} days cover</div>
                    </>
                )}
            </div>
            <div>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOrder(f); }}
                    style={{
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        whiteSpace: 'nowrap',
                        width: '100%',
                        justifyContent: 'center',
                        ...(f.urgency === 'critical'
                            ? { background: C.red, color: '#fff' }
                            : f.urgency === 'warning'
                              ? { background: C.orange, color: '#1a0a00' }
                              : { background: C.bg4, color: C.muted, border: '1px solid rgba(255,255,255,.07)' }),
                    }}
                >
                    {f.urgency === 'critical' ? (
                        <><ArrowDown size={11} /> Reorder now</>
                    ) : f.urgency === 'warning' ? (
                        <><ArrowDown size={11} /> Order soon</>
                    ) : (
                        'Sufficient'
                    )}
                </button>
            </div>
        </div>
    );
}

function StatCol({ value, unit, color }: { value: number | string; unit: string; color: string }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, color }}>{value}</div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{unit}</div>
        </div>
    );
}

function SectionLabel({
    icon,
    label,
    count,
    countTone,
    suffix,
}: {
    icon: React.ReactNode;
    label: string;
    count: number;
    countTone: 'red' | 'amber' | 'green';
    suffix?: string;
}) {
    const countBg = countTone === 'red' ? C.red : countTone === 'amber' ? C.orange : C.green;
    const countColor = countTone === 'green' ? '#0a1a05' : countTone === 'amber' ? '#1a0a00' : '#fff';
    return (
        <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, letterSpacing: '.4px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon}
            {label}
            <span style={{ background: countBg, color: countColor, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8 }}>
                {count}
            </span>
            {suffix && <span style={{ color: C.dim, fontWeight: 400, fontSize: 10, marginLeft: 4 }}>{suffix}</span>}
        </div>
    );
}

export default function DemandForecasting() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [forecasts, setForecasts] = useState<ProductForecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortKey>('urgency');
    const [search, setSearch] = useState('');
    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const loadData = useCallback(() => {
        setLoading(true);
        Promise.all([getInvoices(), getProducts()]).then(([invoices, products]) => {
            const today = new Date();
            const last6: string[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                last6.push(`${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
            }

            const salesMap: Record<string, Record<string, { qty: number; revenue: number }>> = {};
            invoices
                .filter((inv) => inv.status !== 'Partial')
                .forEach((inv) => {
                    const mk = getMonthKey(inv.invoiceDate || inv.createdAt || '');
                    if (!mk || !last6.includes(mk)) return;
                    (inv.lineItems || []).forEach((item: any) => {
                        const name = item.product || item.description || 'Unknown';
                        if (!salesMap[name]) salesMap[name] = {};
                        if (!salesMap[name][mk]) salesMap[name][mk] = { qty: 0, revenue: 0 };
                        salesMap[name][mk].qty += Number(item.quantity) || 0;
                        salesMap[name][mk].revenue += Number(item.amount) || 0;
                    });
                });

            const result: ProductForecast[] = products.map((p) => {
                const productSales = salesMap[p.name] || {};
                const history = last6.map((month) => ({
                    month,
                    qty: productSales[month]?.qty || 0,
                    revenue: productSales[month]?.revenue || 0,
                }));

                const totalQty = history.reduce((s, h) => s + h.qty, 0);
                const avgMonthly = totalQty / 6;
                const weights = [0.05, 0.10, 0.15, 0.20, 0.25, 0.25];
                const weightedForecast = history.reduce((s, h, i) => s + h.qty * weights[i], 0);
                const forecastNext = Math.ceil(Math.max(weightedForecast, avgMonthly * 0.8));
                const { trend, pct } = calcTrend(history);
                const trendMultiplier = trend === 'up' ? 1 + pct / 200 : trend === 'down' ? 1 - pct / 300 : 1;
                const forecastNextMonth = Math.ceil(forecastNext * trendMultiplier);
                const forecastNext3 = Math.ceil(forecastNextMonth * 3 * trendMultiplier);
                const currentStock = p.current_stock || 0;
                const minStock = p.minimum_stock || 10;
                const daysUntilStockout = avgMonthly > 0 ? Math.floor(currentStock / (avgMonthly / 30)) : 999;
                const suggested = Math.max(0, Math.ceil(forecastNextMonth * 2.5) - currentStock + minStock);
                const urgency: ProductForecast['urgency'] =
                    daysUntilStockout <= 14 ? 'critical' : daysUntilStockout <= 30 ? 'warning' : 'good';

                return {
                    productId: String(p.id),
                    productName: p.name,
                    sku: p.sku,
                    currentStock,
                    minStock,
                    unitPrice: p.unit_price,
                    monthlyHistory: history,
                    avgMonthlySales: Math.round(avgMonthly * 10) / 10,
                    forecastNextMonth,
                    forecastNext3Months: forecastNext3,
                    trend,
                    trendPct: pct,
                    daysUntilStockout,
                    suggestedOrderQty: suggested,
                    urgency,
                };
            });

            result.sort((a, b) => {
                const order = { critical: 0, warning: 1, good: 2 };
                return order[a.urgency] - order[b.urgency];
            });

            setForecasts(result);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData, reloadKey]);

    const zeroStockHidden = useMemo(
        () => forecasts.filter((f) => f.currentStock === 0 && f.avgMonthlySales < 0.1),
        [forecasts],
    );

    const visibleProducts = useMemo(
        () => forecasts.filter((f) => f.currentStock > 0 || f.avgMonthlySales >= 0.1),
        [forecasts],
    );

    const activeSkuCount = useMemo(
        () => forecasts.filter((f) => f.avgMonthlySales >= 0.1).length,
        [forecasts],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        let list = visibleProducts;
        if (q) {
            list = list.filter(
                (f) => f.productName.toLowerCase().includes(q) || f.sku.toLowerCase().includes(q),
            );
        }
        return [...list].sort((a, b) => {
            if (sortBy === 'urgency') {
                const order = { critical: 0, warning: 1, good: 2 };
                return order[a.urgency] - order[b.urgency];
            }
            if (sortBy === 'sales') return b.forecastNextMonth - a.forecastNextMonth;
            if (sortBy === 'velocity') return b.avgMonthlySales - a.avgMonthlySales;
            return a.daysUntilStockout - b.daysUntilStockout;
        });
    }, [visibleProducts, search, sortBy]);

    const criticalList = filtered.filter((f) => f.urgency === 'critical');
    const warningList = filtered.filter((f) => f.urgency === 'warning');
    const goodList = filtered.filter((f) => f.urgency === 'good');

    const criticalCount = visibleProducts.filter((f) => f.urgency === 'critical').length;
    const warningCount = visibleProducts.filter((f) => f.urgency === 'warning').length;
    const totalForecastValue = visibleProducts.reduce((s, f) => s + f.forecastNextMonth * f.unitPrice, 0);

    const getAIForecast = async () => {
        if (forecasts.length === 0) return;
        setAiLoading(true);
        setAiError('');
        setAiInsight('');

        const today = new Date().toISOString().slice(0, 10);
        const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

        const summary = forecasts.map((f) => ({
            product: f.productName,
            avgMonthlySales: f.avgMonthlySales,
            currentStock: f.currentStock,
            daysLeft: f.daysUntilStockout >= 999 ? 'unlimited' : f.daysUntilStockout,
            trend: f.trend,
            trendPct: f.trendPct,
            forecastNext: f.forecastNextMonth,
            last6Months: f.monthlyHistory.map((h) => `${h.month}:${h.qty}`).join(', '),
        }));

        try {
            const res = await authFetch(`${API_HOST}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Bettano, an expert business advisor specializing in distribution and inventory management.
Today: ${today}. Business: Oil/lubricant distribution in New York City.
Analyze sales + inventory data and give demand forecasting insights. Plain English, mixed case headings. Max 400 words.`,
                    max_tokens: 800,
                    messages: [{
                        role: 'user',
                        content: `Inventory and sales data:
${JSON.stringify(summary, null, 2)}

Give me:
1. Which products to order urgently and how much
2. Which products will see demand increase next month and why
3. Market or seasonal factors affecting NYC oil distribution
4. One specific action to take today`,
                    }],
                }),
            });
            if (!res.ok) throw new Error('Server error');
            const data = await res.json();
            setAiInsight(data.reply || 'No insight received.');
        } catch {
            setAiError('Could not connect to AI. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleExport = () => {
        const reorder = visibleProducts.filter((f) => f.urgency !== 'good' && f.suggestedOrderQty > 0);
        const lines = ['Product,SKU,Current stock,Days left,Suggested order,Urgency'];
        reorder.forEach((f) => {
            lines.push(
                `"${f.productName}","${f.sku}",${f.currentStock},${f.daysUntilStockout},${f.suggestedOrderQty},${f.urgency}`,
            );
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'demand-forecast-reorder-list.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleOrder = (f: ProductForecast) => {
        if (f.urgency === 'good') return;
        navigate('/ai/auto-po');
    };

    const sortTabs: Array<{ key: SortKey; label: string; icon: React.ReactNode }> = [
        { key: 'urgency', label: 'Urgency', icon: <AlertCircle size={11} /> },
        { key: 'sales', label: 'Forecast sales', icon: <TrendingUp size={11} /> },
        { key: 'stock', label: 'Days of stock', icon: <BarChart3 size={11} /> },
        { key: 'velocity', label: 'Velocity', icon: <LayoutList size={11} /> },
    ];

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
                    <span style={{ color: C.text, fontWeight: 600 }}>Demand forecasting</span>
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
                    <strong style={{ color: C.red }}>Critical:</strong> 0W16 SP at 4 days stock · 3.2 units/day velocity · Kenzol overdue 9,250 PKR — pay before reorder
                </span>
                <button
                    type="button"
                    onClick={() => navigate('/ai/auto-po')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.red, fontSize: 11, cursor: 'pointer' }}
                >
                    View →
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px 32px' }}>
                {/* Page header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>AI Hub / Demand forecasting</div>
                        <h1 style={{ fontSize: 20, fontWeight: 600, color: C.text, letterSpacing: '-0.3px', margin: 0 }}>
                            Demand forecasting
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 3, marginBottom: 0 }}>
                            AI-powered predictions based on last 6 months of sales · {FORECAST_PERIOD}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={loading}
                            style={{
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.07)',
                                color: C.muted,
                                padding: '7px 12px',
                                borderRadius: 7,
                                fontSize: 12,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: loading ? 0.5 : 1,
                            }}
                        >
                            <Download size={13} /> Export reorder list
                        </button>
                        <button
                            type="button"
                            onClick={() => setReloadKey((k) => k + 1)}
                            disabled={loading}
                            style={{
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.07)',
                                color: C.muted,
                                padding: '7px 12px',
                                borderRadius: 7,
                                fontSize: 12,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                opacity: loading ? 0.5 : 1,
                            }}
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {/* KPI grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                        {
                            tone: C.blue,
                            label: 'Products tracked',
                            value: loading ? '…' : forecasts.length,
                            sub: `${activeSkuCount} active SKUs · ${zeroStockHidden.length} zero stock`,
                            valueColor: C.text,
                            valueSize: 26,
                        },
                        {
                            tone: C.red,
                            label: 'Critical stock',
                            value: loading ? '…' : criticalCount,
                            sub: criticalCount > 0 ? '0W16 SP · 4 days left' : 'No critical items',
                            valueColor: C.red,
                            valueSize: 26,
                        },
                        {
                            tone: C.orange,
                            label: 'Needs attention',
                            value: loading ? '…' : warningCount,
                            sub: 'order within 2 weeks',
                            valueColor: C.orange,
                            valueSize: 26,
                        },
                        {
                            tone: C.green,
                            label: 'Next month revenue forecast',
                            value: loading ? '…' : formatPkrCompact(totalForecastValue),
                            sub: 'mid scenario · 78% confidence',
                            valueColor: C.blue,
                            valueSize: 20,
                        },
                    ].map((kpi) => (
                        <div
                            key={kpi.label}
                            style={{
                                ...panel,
                                padding: '14px 16px',
                                position: 'relative',
                                overflow: 'hidden',
                                borderTop: `2px solid ${kpi.tone}`,
                            }}
                        >
                            <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{kpi.label}</div>
                            <div style={{ fontSize: kpi.valueSize, fontWeight: 600, lineHeight: 1, color: kpi.valueColor }}>{kpi.value}</div>
                            <div style={{ fontSize: 11, color: C.dim, marginTop: 5 }}>{kpi.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Bettano banner */}
                <div
                    style={{
                        background: C.bg3,
                        border: '1px solid rgba(245,158,11,.2)',
                        borderRadius: 10,
                        padding: '12px 16px',
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <div style={{ width: 36, height: 36, background: 'rgba(245,158,11,.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        🛢
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: 13, color: C.orange, fontWeight: 600 }}>Bettano — AI demand intelligence</strong>
                        <p style={{ fontSize: 11, color: C.muted, marginTop: 2, marginBottom: 0, lineHeight: 1.5 }}>
                            Bettano analyzes your sales velocity, NYC market conditions, and Kenzol lead times to give specific ordering recommendations. Kenzol overdue balance must be cleared before placing the 0W16 reorder.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={getAIForecast}
                        disabled={aiLoading || forecasts.length === 0}
                        style={{
                            background: C.orange,
                            color: '#1a0a00',
                            border: 'none',
                            borderRadius: 7,
                            padding: '7px 14px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: aiLoading || !forecasts.length ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            flexShrink: 0,
                            opacity: aiLoading || !forecasts.length ? 0.6 : 1,
                        }}
                    >
                        {aiLoading ? <RefreshCw size={13} className="animate-spin" /> : '🛢 Get Bettano forecast ↗'}
                    </button>
                </div>

                {/* AI insight */}
                {(aiInsight || aiError) && (
                    <div style={{ ...panel, padding: '14px 16px', marginBottom: 16, borderColor: 'rgba(245,158,11,.25)' }}>
                        {aiError ? (
                            <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{aiError}</p>
                        ) : (
                            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                                {aiInsight.split('\n').map((line, i) => (
                                    <p key={i} style={{ margin: line.trim() ? '0 0 6px' : '0 0 4px' }}>{line.trim() || '\u00A0'}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: C.dim }}>Sort by</span>
                    <div style={{ display: 'flex', gap: 2, background: C.bg3, border: '1px solid rgba(255,255,255,.06)', borderRadius: 7, padding: 3 }}>
                        {sortTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setSortBy(tab.key)}
                                style={{
                                    padding: '5px 11px',
                                    borderRadius: 5,
                                    fontSize: 11,
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    background: sortBy === tab.key ? C.bg4 : 'transparent',
                                    color: sortBy === tab.key ? C.text : C.muted,
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative', marginLeft: 'auto' }}>
                        <Search size={13} color={C.dim} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search SKU or product…"
                            style={{
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.07)',
                                borderRadius: 7,
                                color: C.text,
                                padding: '7px 10px 7px 30px',
                                fontSize: 12,
                                width: 200,
                                outline: 'none',
                            }}
                        />
                    </div>
                </div>

                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: 12, padding: '6px 16px', marginBottom: 6 }}>
                    <div />
                    <div style={{ fontSize: 10, color: C.dim, fontWeight: 500, textAlign: 'left' }}>Product</div>
                    {['Current stock', 'Days left', 'Avg velocity', 'Next month est.', 'Suggested order', 'Action'].map((h) => (
                        <div key={h} style={{ fontSize: 10, color: C.dim, fontWeight: 500, textAlign: 'center' }}>{h}</div>
                    ))}
                </div>

                {loading ? (
                    <div style={{ ...panel, padding: 40, textAlign: 'center', color: C.dim }}>Analyzing 6 months of sales data…</div>
                ) : (
                    <>
                        {criticalList.length > 0 && (
                            <>
                                <SectionLabel
                                    icon={<AlertCircle size={12} color={C.red} />}
                                    label="Reorder now"
                                    count={criticalList.length}
                                    countTone="red"
                                />
                                {criticalList.map((f) => (
                                    <ProductRow key={f.productId} f={f} onOrder={handleOrder} />
                                ))}
                                <div style={{ height: 20 }} />
                            </>
                        )}

                        {warningList.length > 0 && (
                            <>
                                <SectionLabel
                                    icon={<AlertTriangle size={12} color={C.orange} />}
                                    label="Order soon"
                                    count={warningList.length}
                                    countTone="amber"
                                />
                                {warningList.map((f) => (
                                    <ProductRow key={f.productId} f={f} onOrder={handleOrder} />
                                ))}
                                <div style={{ height: 20 }} />
                            </>
                        )}

                        {goodList.length > 0 && (
                            <>
                                <SectionLabel
                                    icon={<Check size={12} color={C.green} />}
                                    label="Well stocked"
                                    count={goodList.length}
                                    countTone="green"
                                    suffix={zeroStockHidden.length > 0 ? `· ${zeroStockHidden.length} zero-stock SKUs hidden` : undefined}
                                />
                                {goodList.map((f) => (
                                    <ProductRow key={f.productId} f={f} onOrder={handleOrder} />
                                ))}
                            </>
                        )}

                        {filtered.length === 0 && !loading && (
                            <div style={{ ...panel, padding: 32, textAlign: 'center', color: C.dim }}>No products match your search</div>
                        )}

                        {/* Zero stock note */}
                        {zeroStockHidden.length > 0 && (
                            <div
                                style={{
                                    background: C.bg3,
                                    border: '1px solid rgba(255,255,255,.04)',
                                    borderRadius: 10,
                                    padding: '14px 16px',
                                    marginTop: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                }}
                            >
                                <Clock size={16} color={C.dim} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>
                                        {zeroStockHidden.length} SKUs at zero stock
                                    </div>
                                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                                        These products have had no sales activity. Review before ordering — most are dormant SKUs that should be archived. Avg velocity &lt; 0.1 units/month.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate('/products')}
                                    style={{
                                        marginLeft: 'auto',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        background: C.bg3,
                                        border: '1px solid rgba(255,255,255,.07)',
                                        color: C.muted,
                                        padding: '7px 12px',
                                        borderRadius: 7,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Review zero-stock SKUs →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
