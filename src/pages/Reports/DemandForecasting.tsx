import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TrendingUp, Package, AlertTriangle, RefreshCw, ChevronUp, ChevronDown, Minus , ArrowLeft } from 'lucide-react';
import { getInvoices, getProducts } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

interface ProductForecast {
    productId: string;
    productName: string;
    sku: string;
    currentStock: number;
    minStock: number;
    unitPrice: number;

    // Historical monthly sales
    monthlyHistory: Array<{ month: string; qty: number; revenue: number }>;

    // Forecast
    avgMonthlySales: number;
    forecastNextMonth: number;
    forecastNext3Months: number;
    trend: 'up' | 'down' | 'stable';
    trendPct: number;

    // Stock analysis
    daysUntilStockout: number;
    suggestedOrderQty: number;
    urgency: 'critical' | 'warning' | 'good';
}

function getMonthKey(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

export default function DemandForecasting() {
    const navigate = useNavigate();
    const [forecasts, setForecasts] = useState<ProductForecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'urgency' | 'sales' | 'stock'>('urgency');
    const [selected, setSelected] = useState<string | null>(null);
    const [aiInsight, setAiInsight] = useState<string>('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');

    useEffect(() => {
        Promise.all([getInvoices(), getProducts()]).then(([invoices, products]) => {
            const today = new Date();

            // Build last 6 months keys
            const last6: string[] = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                last6.push(`${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
            }

            // Aggregate sales per product per month
            const salesMap: Record<string, Record<string, { qty: number; revenue: number }>> = {};
            invoices
                .filter(inv => inv.status !== 'Partial')
                .forEach(inv => {
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

            const result: ProductForecast[] = products.map(p => {
                const productSales = salesMap[p.name] || {};
                const history = last6.map(month => ({
                    month,
                    qty: productSales[month]?.qty || 0,
                    revenue: productSales[month]?.revenue || 0
                }));

                const totalQty = history.reduce((s, h) => s + h.qty, 0);
                const avgMonthly = totalQty / 6;

                // Weighted forecast: recent months count more
                const weights = [0.05, 0.10, 0.15, 0.20, 0.25, 0.25];
                const weightedForecast = history.reduce((s, h, i) => s + h.qty * weights[i], 0);
                const forecastNext = Math.ceil(Math.max(weightedForecast, avgMonthly * 0.8));

                const { trend, pct } = calcTrend(history);

                // Apply trend adjustment
                const trendMultiplier = trend === 'up' ? 1 + (pct / 200) : trend === 'down' ? 1 - (pct / 300) : 1;
                const forecastNextMonth = Math.ceil(forecastNext * trendMultiplier);
                const forecastNext3 = Math.ceil(forecastNextMonth * 3 * trendMultiplier);

                const currentStock = p.current_stock || 0;
                const minStock = p.minimum_stock || 10;
                const daysUntilStockout = avgMonthly > 0
                    ? Math.floor((currentStock / (avgMonthly / 30)))
                    : 999;

                // Suggested order: 2 months supply + buffer - current stock
                const suggested = Math.max(0, Math.ceil(forecastNextMonth * 2.5) - currentStock + minStock);

                const urgency: 'critical' | 'warning' | 'good' =
                    daysUntilStockout <= 14 ? 'critical' :
                        daysUntilStockout <= 30 ? 'warning' : 'good';

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
                    urgency
                };
            });

            // Sort by urgency by default
            result.sort((a, b) => {
                const order = { critical: 0, warning: 1, good: 2 };
                return order[a.urgency] - order[b.urgency];
            });

            setForecasts(result);
            setLoading(false);
        });
    }, []);

    const sorted = [...forecasts].sort((a, b) => {
        if (sortBy === 'urgency') {
            const order = { critical: 0, warning: 1, good: 2 };
            return order[a.urgency] - order[b.urgency];
        }
        if (sortBy === 'sales') return b.forecastNextMonth - a.forecastNextMonth;
        return a.daysUntilStockout - b.daysUntilStockout;
    });

    const critical = forecasts.filter(f => f.urgency === 'critical').length;
    const warning = forecasts.filter(f => f.urgency === 'warning').length;
    const totalForecastValue = forecasts.reduce((s, f) => s + f.forecastNextMonth * f.unitPrice, 0);

    const getAIForecast = async () => {
        if (forecasts.length === 0) return;
        setAiLoading(true);
        setAiError('');
        setAiInsight('');

        const today = new Date().toISOString().slice(0, 10);
        const API_HOST = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

        // Build concise data summary for Claude
        const summary = forecasts.map(f => ({
            product: f.productName,
            avgMonthlySales: f.avgMonthlySales,
            currentStock: f.currentStock,
            daysLeft: f.daysUntilStockout >= 999 ? 'unlimited' : f.daysUntilStockout,
            trend: f.trend,
            trendPct: f.trendPct,
            forecastNext: f.forecastNextMonth,
            last6Months: f.monthlyHistory.map(h => `${h.month}:${h.qty}`).join(', ')
        }));

        const systemPrompt = `You are Marcus, an expert business advisor specializing in distribution and inventory management.
Today: ${today}. Business: Oil/lubricant distribution in New York City.

Analyze this real sales + inventory data and give AI-powered demand forecasting insights.
Be specific, practical, and mention relevant external factors (weather, market, economy, geopolitics).
Write in plain English - NO markdown symbols. Use CAPS for section headings.
Keep total response under 400 words.`;

        const userMsg = `Here is my current inventory and sales data:
${JSON.stringify(summary, null, 2)}

Give me:
1. Which products to order urgently and how much (with reasoning)
2. Which products will see demand increase next month and why
3. Any market or seasonal factors affecting my NYC oil distribution business right now
4. One specific action I should take today`;

        try {
            const res = await fetch(`${API_HOST}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: systemPrompt,
                    max_tokens: 800,
                    messages: [{ role: 'user', content: userMsg }]
                })
            });
            if (!res.ok) throw new Error('Server error');
            const data = await res.json();
            setAiInsight(data.reply || 'No insight received.');
        } catch (e) {
            setAiError('Could not connect to AI. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const renderAIText = (text: string) => {
        return text.split('\n').map((line, i) => {
            const t = line.trim();
            if (!t) return <div key={i} className="h-2" />;
            if (t === t.toUpperCase() && t.length > 4 && /[A-Z]{3}/.test(t))
                return <div key={i} className="text-xs font-black text-orange-600 uppercase tracking-widest mt-3 mb-1 border-b border-orange-100 pb-1">{t}</div>;
            if (/^[0-9]+\./.test(t))
                return <div key={i} className="text-sm font-black text-blue-700 mt-2">{t}</div>;
            if (t.startsWith('•') || t.startsWith('-'))
                return <div key={i} className="flex gap-2 text-sm mt-1"><span className="text-orange-400">•</span><span>{t.slice(1).trim()}</span></div>;
            if (/^(WARNING|MARKET ALERT|ACTION|ALERT):/i.test(t))
                return <div key={i} className="mt-2 text-sm font-bold bg-amber-50 text-amber-800 px-3 py-2 rounded-lg border-l-4 border-amber-400">{t}</div>;
            return <div key={i} className="text-sm text-gray-700 leading-relaxed">{t}</div>;
        });
    };

    const TrendIcon = ({ trend, pct }: { trend: string; pct: number }) => {
        if (trend === 'up') return <span className="flex items-center gap-1 text-emerald-600 font-black text-xs"><ChevronUp size={14} />+{pct}%</span>;
        if (trend === 'down') return <span className="flex items-center gap-1 text-red-500 font-black text-xs"><ChevronDown size={14} />-{pct}%</span>;
        return <span className="flex items-center gap-1 text-gray-400 font-black text-xs"><Minus size={14} />Stable</span>;
    };

    const urgencyStyle = (u: string) => ({
        critical: 'bg-red-50 border-red-200 border-l-red-500',
        warning: 'bg-amber-50 border-amber-200 border-l-amber-500',
        good: 'bg-white border-gray-100 border-l-emerald-400'
    }[u] || '');

    const urgencyBadge = (u: string) => ({
        critical: 'bg-red-100 text-red-700',
        warning: 'bg-amber-100 text-amber-700',
        good: 'bg-emerald-100 text-emerald-700'
    }[u] || '');

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <TrendingUp size={24} className="text-orange-400" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"><ArrowLeft size={14} /> Back</button>
                    <h1 className="text-xl font-black uppercase tracking-tight">Demand Forecasting</h1>
                        <p className="text-gray-400 text-xs mt-0.5">AI-powered predictions based on your last 6 months of sales</p>
                    </div>
                </div>
                <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Products Tracked', value: forecasts.length, color: 'text-gray-900', bg: 'bg-white', border: 'border-gray-100', icon: Package },
                    { label: 'Critical Stock', value: critical, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle },
                    { label: 'Needs Attention', value: warning, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
                    { label: 'Next Month Revenue Forecast', value: formatCurrency(totalForecastValue), color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: TrendingUp },
                ].map((k, i) => (
                    <div key={i} className={`${k.bg} border ${k.border} rounded-2xl p-4 shadow-sm`}>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
                        <p className={`text-2xl font-black ${k.color}`}>{loading ? '...' : k.value}</p>
                    </div>
                ))}
            </div>

            {/* AI Forecast Panel */}
            <div className="bg-gray-900 rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-xl">🧠</div>
                        <div>
                            <p className="text-sm font-black">AI Demand Intelligence</p>
                            <p className="text-xs text-gray-400">Marcus analyzes your sales patterns + market conditions</p>
                        </div>
                    </div>
                    <button
                        onClick={getAIForecast}
                        disabled={aiLoading || forecasts.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-black transition-all"
                    >
                        {aiLoading ? (
                            <><RefreshCw size={16} className="animate-spin" /> Analyzing...</>
                        ) : (
                            <><TrendingUp size={16} /> Get AI Forecast</>
                        )}
                    </button>
                </div>

                {aiError && (
                    <div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm font-bold">{aiError}</div>
                )}

                {!aiInsight && !aiLoading && !aiError && (
                    <div className="bg-white/5 rounded-xl px-4 py-8 text-center">
                        <p className="text-gray-400 text-sm">Click "Get AI Forecast" — Marcus will analyze your data and give specific ordering recommendations, demand predictions, and market intelligence for NYC oil distribution.</p>
                    </div>
                )}

                {aiLoading && (
                    <div className="bg-white/5 rounded-xl px-4 py-8 text-center">
                        <RefreshCw size={24} className="animate-spin text-orange-400 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Analyzing 6 months of sales data, market conditions, and NYC distribution trends...</p>
                    </div>
                )}

                {aiInsight && !aiLoading && (
                    <div className="bg-white/5 rounded-xl px-5 py-4 space-y-1">
                        {renderAIText(aiInsight)}
                    </div>
                )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Sort by:</span>
                {([
                    { key: 'urgency', label: '🚨 Urgency' },
                    { key: 'sales', label: '📈 Forecast Sales' },
                    { key: 'stock', label: '📦 Days of Stock' }
                ] as const).map(s => (
                    <button key={s.key} onClick={() => setSortBy(s.key)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${sortBy === s.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Product Cards */}
            {loading ? (
                <div className="bg-white rounded-2xl p-16 text-center text-gray-400 font-bold border border-gray-100">
                    Analyzing 6 months of sales data...
                </div>
            ) : (
                <div className="space-y-3">
                    {sorted.map(f => (
                        <div key={f.productId}
                            className={`border-2 border-l-4 rounded-2xl shadow-sm overflow-hidden transition-all cursor-pointer ${urgencyStyle(f.urgency)}`}
                            onClick={() => setSelected(selected === f.productId ? null : f.productId)}>

                            {/* Main Row */}
                            <div className="p-5">
                                <div className="flex items-center justify-between flex-wrap gap-3">

                                    {/* Left: Product Info */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-2xl">
                                            🛢️
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-black text-gray-900">{f.productName}</p>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${urgencyBadge(f.urgency)}`}>
                                                    {f.urgency === 'critical' ? '🔴 Reorder Now' : f.urgency === 'warning' ? '🟡 Order Soon' : '🟢 Well Stocked'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400">SKU: {f.sku} · Avg sales: {f.avgMonthlySales} units/month</p>
                                        </div>
                                    </div>

                                    {/* Right: Key Numbers */}
                                    <div className="flex items-center gap-6 flex-wrap">
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Current Stock</p>
                                            <p className={`text-xl font-black ${f.currentStock < f.minStock ? 'text-red-600' : 'text-gray-900'}`}>{f.currentStock}</p>
                                            <p className="text-[10px] text-gray-400">units</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Days Left</p>
                                            <p className={`text-xl font-black ${f.daysUntilStockout <= 14 ? 'text-red-600' : f.daysUntilStockout <= 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {f.daysUntilStockout >= 999 ? '∞' : f.daysUntilStockout}
                                            </p>
                                            <p className="text-[10px] text-gray-400">days</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Next Month</p>
                                            <p className="text-xl font-black text-blue-600">{f.forecastNextMonth}</p>
                                            <p className="text-[10px] text-gray-400">forecast</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Trend</p>
                                            <TrendIcon trend={f.trend} pct={f.trendPct} />
                                        </div>
                                        {f.suggestedOrderQty > 0 && (
                                            <div className="bg-orange-500 text-white px-4 py-2 rounded-xl text-center">
                                                <p className="text-[10px] font-black uppercase">Order</p>
                                                <p className="text-lg font-black">{f.suggestedOrderQty}</p>
                                                <p className="text-[10px]">units</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded: Monthly Chart */}
                            {selected === f.productId && (
                                <div className="border-t border-gray-100 p-5 bg-white/60">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                        {/* Monthly Sales Chart */}
                                        <div>
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Monthly Sales — Last 6 Months</p>
                                            <div className="flex items-end gap-2 h-28">
                                                {f.monthlyHistory.map((h, i) => {
                                                    const max = Math.max(...f.monthlyHistory.map(x => x.qty), 1);
                                                    const height = Math.max((h.qty / max) * 100, 4);
                                                    const isLast = i === f.monthlyHistory.length - 1;
                                                    return (
                                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                                            <span className="text-[9px] font-bold text-gray-500">{h.qty}</span>
                                                            <div className="w-full rounded-t-md transition-all"
                                                                style={{
                                                                    height: `${height}%`,
                                                                    background: isLast ? '#f97316' : '#e2e8f0'
                                                                }} />
                                                            <span className="text-[9px] text-gray-400">{h.month}</span>
                                                        </div>
                                                    );
                                                })}
                                                {/* Forecast bar */}
                                                <div className="flex-1 flex flex-col items-center gap-1">
                                                    <span className="text-[9px] font-black text-blue-600">{f.forecastNextMonth}</span>
                                                    <div className="w-full rounded-t-md border-2 border-blue-400 border-dashed"
                                                        style={{
                                                            height: `${Math.max((f.forecastNextMonth / Math.max(...f.monthlyHistory.map(x => x.qty), 1)) * 100, 4)}%`,
                                                            background: '#dbeafe'
                                                        }} />
                                                    <span className="text-[9px] font-black text-blue-500">Forecast</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Analysis */}
                                        <div className="space-y-3">
                                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Analysis</p>
                                            <div className="space-y-2">
                                                {[
                                                    { label: 'Avg Monthly Sales', value: `${f.avgMonthlySales} units` },
                                                    { label: 'Next Month Forecast', value: `${f.forecastNextMonth} units` },
                                                    { label: 'Next 3 Months', value: `${f.forecastNext3Months} units` },
                                                    { label: 'Forecast Revenue', value: formatCurrency(f.forecastNextMonth * f.unitPrice) },
                                                    { label: 'Suggested Order', value: `${f.suggestedOrderQty} units (${formatCurrency(f.suggestedOrderQty * f.unitPrice)})` },
                                                ].map((row, i) => (
                                                    <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-100">
                                                        <span className="text-gray-500">{row.label}</span>
                                                        <span className="font-black text-gray-900">{row.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {f.urgency !== 'good' && (
                                                <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-bold ${f.urgency === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                                    {f.urgency === 'critical'
                                                        ? `⚠️ At current sales rate, stock runs out in ${f.daysUntilStockout} days. Order ${f.suggestedOrderQty} units now.`
                                                        : `📦 Stock will last ~${f.daysUntilStockout} days. Consider ordering within the next week.`
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <p className="text-xs text-gray-400 text-center">
                Forecast uses weighted average of last 6 months with trend adjustment · Click any product to see detailed chart
            </p>
        </div>
    );
}
