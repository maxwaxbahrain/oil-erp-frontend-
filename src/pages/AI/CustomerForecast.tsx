import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Zap, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getInvoices, getCustomers } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

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

export default function CustomerForecast() {
    const navigate = useNavigate();
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

            // Build per-customer invoice history
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

                    // Monthly breakdown for trend
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

                    // Forecast next month (weighted recent activity)
                    const forecastRevenue = Math.max(0, recent3 * (trend === 'up' ? 1.1 : trend === 'down' ? 0.8 : 1.0));

                    // Risk assessment
                    const risk: 'high' | 'medium' | 'low' = daysSince > 60 ? 'high' : daysSince > 30 ? 'medium' : 'low';

                    // Top products
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
                        topProducts
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
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Marcus, a CRM and sales advisor for a NYC distribution company. Max 150 words. No markdown. CAPS for headings.`,
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `Customer forecast data:

TOP 5 BY REVENUE:
${top5.map(f => `${f.customerName}: $${f.totalSpend.toFixed(0)} total, ${f.orderCount} orders, trend: ${f.trend} ${f.trendPct}%, last order: ${f.daysSinceOrder} days ago`).join('\n')}

AT-RISK CUSTOMERS (60+ days no order):
${atRisk.length > 0 ? atRisk.map(f => `${f.customerName}: ${f.daysSinceOrder} days silent, previously spent $${f.totalSpend.toFixed(0)}`).join('\n') : 'None'}

Which customers should I contact TODAY and what should I say?`
                    }]
                })
            });
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

    const TrendIcon = ({ trend, pct }: { trend: string; pct: number }) => {
        if (trend === 'up') return <span className="flex items-center gap-0.5 text-emerald-600 text-xs font-black"><TrendingUp size={12} />+{pct}%</span>;
        if (trend === 'down') return <span className="flex items-center gap-0.5 text-red-500 text-xs font-black"><TrendingDown size={12} />-{pct}%</span>;
        return <span className="flex items-center gap-0.5 text-gray-400 text-xs font-black"><Minus size={12} />Stable</span>;
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/ai')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> AI Hub
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                            <Users size={24} className="text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Customer-Level Forecast</h1>
                            <p className="text-gray-400 text-xs mt-0.5">Predict what each customer will order next month</p>
                        </div>
                    </div>
                    <button onClick={getAIInsight} disabled={aiLoading || forecasts.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50">
                        {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                        Ask Marcus
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Customers Tracked', value: forecasts.length, color: 'text-gray-900' },
                    { label: 'Next Month Forecast', value: formatCurrency(totalForecast), color: 'text-blue-600' },
                    { label: 'At-Risk Customers', value: atRiskCount, color: atRiskCount > 0 ? 'text-red-600' : 'text-emerald-600' },
                    { label: 'Growing Customers', value: forecasts.filter(f => f.trend === 'up').length, color: 'text-emerald-600' },
                ].map((k, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
                        <p className={`text-xl font-black ${k.color}`}>{loading ? '...' : k.value}</p>
                    </div>
                ))}
            </div>

            {/* AI Insight */}
            {aiInsight && (
                <div className="bg-gray-900 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-orange-400" />
                        <p className="text-sm font-black text-orange-400 uppercase tracking-widest">Marcus — Customer Intelligence</p>
                    </div>
                    <div className="text-sm text-gray-300 leading-relaxed space-y-1">
                        {aiInsight.split('\n').map((line, i) => {
                            const t = line.trim();
                            if (!t) return <div key={i} className="h-1" />;
                            if (t === t.toUpperCase() && t.length > 4)
                                return <p key={i} className="font-black text-orange-400 text-xs uppercase tracking-widest mt-3">{t}</p>;
                            return <p key={i}>{t}</p>;
                        })}
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search customer..."
                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-400 flex-1 min-w-[200px]" />
                {(['revenue', 'risk', 'recent'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all capitalize ${sortBy === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {s === 'revenue' ? '💰 By Revenue' : s === 'risk' ? '⚠️ By Risk' : '🕐 By Recency'}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400 font-bold">Analyzing customer order patterns...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Customer', 'Orders', 'Avg Value', 'Trend', 'Last Order', 'Next Month Est.', 'Top Products', 'Risk'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sorted.map(f => (
                                    <tr key={f.customerId} className={`hover:bg-gray-50 transition-all ${f.risk === 'high' ? 'bg-red-50/30' : ''}`}>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-black text-gray-900">{f.customerName}</p>
                                            <p className="text-xs text-gray-400">{formatCurrency(f.totalSpend)} lifetime</p>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-black text-gray-700">{f.orderCount}</td>
                                        <td className="px-5 py-4 text-sm font-mono font-black text-gray-700">{formatCurrency(f.avgOrderValue)}</td>
                                        <td className="px-5 py-4"><TrendIcon trend={f.trend} pct={f.trendPct} /></td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-mono text-gray-500">{f.lastOrderDate}</p>
                                            <p className={`text-xs font-bold ${f.daysSinceOrder > 60 ? 'text-red-500' : f.daysSinceOrder > 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {f.daysSinceOrder}d ago
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-sm font-black text-blue-600">{formatCurrency(f.forecastRevenue)}</p>
                                            <p className="text-xs text-gray-400">est. {f.forecastNextMonth} order{f.forecastNextMonth !== 1 ? 's' : ''}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {f.topProducts.slice(0, 2).map((p, i) => (
                                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold truncate max-w-[100px]">{p}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-full ${f.risk === 'high' ? 'bg-red-100 text-red-700' : f.risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {f.risk === 'high' ? '🔴 At Risk' : f.risk === 'medium' ? '🟡 Watch' : '🟢 Active'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 text-center">
                Forecast based on historical order patterns + trend analysis · Red rows = customer hasn't ordered in 60+ days
            </p>
        </div>
    );
}
