import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, TrendingUp, TrendingDown, Zap, RefreshCw, Eye } from 'lucide-react';
import { getInvoices, getProducts, getCustomers } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

interface Anomaly {
    id: string;
    type: 'demand_spike' | 'demand_drop' | 'price_anomaly' | 'payment_anomaly' | 'stock_anomaly';
    severity: 'critical' | 'high' | 'medium';
    title: string;
    description: string;
    value: string;
    detectedAt: string;
    relatedTo: string;
}

export default function AnomalyDetection() {
    const navigate = useNavigate();
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');

    useEffect(() => {
        detectAnomalies();
    }, []);

    const detectAnomalies = async () => {
        setLoading(true);
        try {
            const [invoices, products, customers] = await Promise.all([getInvoices(), getProducts(), getCustomers()]);
            const custMap: Record<string,string> = {};
            customers.forEach((c:any) => { custMap[String(c.id)] = c.name; });
            // Enrich invoice customer names
            invoices.forEach(inv => { if (!inv.customerName && inv.customerId) (inv as any).customerName = custMap[String(inv.customerId)] || `Customer ${inv.customerId}`; });
            const found: Anomaly[] = [];
            const today = new Date();

            // ── ANOMALY 1: Demand spikes (invoice amount 3x above average) ──
            if (invoices.length > 5) {
                const amounts = invoices.map(i => i.grandTotal || 0);
                const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
                const stdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length);

                invoices.forEach(inv => {
                    if (inv.grandTotal > avg + 2.5 * stdDev && inv.grandTotal > 0) {
                        found.push({
                            id: `spike-${inv.id}`,
                            type: 'demand_spike',
                            severity: inv.grandTotal > avg + 4 * stdDev ? 'critical' : 'high',
                            title: `Unusual large invoice — ${inv.customerName}`,
                            description: `Invoice ${inv.invoiceNumber} is ${((inv.grandTotal / avg) * 100).toFixed(0)}% of average invoice value. This is ${((inv.grandTotal - avg) / stdDev).toFixed(1)} standard deviations above normal.`,
                            value: formatCurrency(inv.grandTotal),
                            detectedAt: inv.invoiceDate || today.toISOString().slice(0, 10),
                            relatedTo: inv.customerName
                        });
                    }
                });
            }

            // ── ANOMALY 2: Customers who suddenly stopped ordering (60+ days) ──
            const custLastOrder: Record<string, { date: Date; name: string; totalSpend: number }> = {};
            invoices.forEach(inv => {
                const cid = String(inv.customerId);
                const d = new Date(inv.invoiceDate);
                if (!custLastOrder[cid] || d > custLastOrder[cid].date) {
                    custLastOrder[cid] = { date: d, name: inv.customerName, totalSpend: 0 };
                }
                custLastOrder[cid].totalSpend = (custLastOrder[cid].totalSpend || 0) + inv.grandTotal;
            });

            Object.entries(custLastOrder).forEach(([, info]) => {
                const daysSince = Math.floor((today.getTime() - info.date.getTime()) / 86400000);
                if (daysSince >= 60 && info.totalSpend > 100) {
                    found.push({
                        id: `drop-${info.name}-${daysSince}`,
                        type: 'demand_drop',
                        severity: daysSince > 90 ? 'critical' : 'high',
                        title: `Customer inactive — ${info.name}`,
                        description: `${info.name} has not placed an order in ${daysSince} days. They previously spent ${formatCurrency(info.totalSpend)} total. Risk of losing this customer.`,
                        value: `${daysSince} days silent`,
                        detectedAt: info.date.toISOString().slice(0, 10),
                        relatedTo: info.name
                    });
                }
            });

            // ── ANOMALY 3: Products priced way below/above average ──
            if (products.length > 2) {
                const prices = products.map(p => p.unit_price || 0).filter(p => p > 0);
                const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
                products.forEach(p => {
                    if (p.unit_price > avgPrice * 3) {
                        found.push({
                            id: `price-high-${p.id}`,
                            type: 'price_anomaly',
                            severity: 'medium',
                            title: `Unusually high price — ${p.name}`,
                            description: `${p.name} is priced at ${formatCurrency(p.unit_price)}, which is ${((p.unit_price / avgPrice) * 100).toFixed(0)}% of average product price. Verify this is intentional.`,
                            value: formatCurrency(p.unit_price),
                            detectedAt: today.toISOString().slice(0, 10),
                            relatedTo: p.name
                        });
                    }
                    if (p.unit_price < avgPrice * 0.2 && p.unit_price > 0) {
                        found.push({
                            id: `price-low-${p.id}`,
                            type: 'price_anomaly',
                            severity: 'medium',
                            title: `Unusually low price — ${p.name}`,
                            description: `${p.name} is priced at ${formatCurrency(p.unit_price)}, much lower than average. Possible pricing error or below cost sale.`,
                            value: formatCurrency(p.unit_price),
                            detectedAt: today.toISOString().slice(0, 10),
                            relatedTo: p.name
                        });
                    }
                });
            }

            // ── ANOMALY 4: Overdue invoices over 30 days ──
            invoices.forEach(inv => {
                if (inv.status === 'Unpaid' || inv.status === 'Overdue') {
                    const dueDate = new Date(inv.dueDate);
                    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000);
                    if (daysOverdue > 30) {
                        found.push({
                            id: `payment-${inv.id}`,
                            type: 'payment_anomaly',
                            severity: daysOverdue > 60 ? 'critical' : 'high',
                            title: `Severely overdue — ${inv.customerName}`,
                            description: `Invoice ${inv.invoiceNumber} for ${formatCurrency(inv.grandTotal)} is ${daysOverdue} days overdue. Immediate follow-up required.`,
                            value: `${daysOverdue} days overdue`,
                            detectedAt: inv.dueDate,
                            relatedTo: inv.customerName
                        });
                    }
                }
            });

            // ── ANOMALY 5: Zero stock products that have sales history ──
            const productsWithSales = new Set(invoices.flatMap(inv => (inv.lineItems || []).map((li: any) => li.product)));
            products.forEach(p => {
                if ((p.current_stock || 0) === 0 && productsWithSales.has(p.name)) {
                    found.push({
                        id: `stock-${p.id}`,
                        type: 'stock_anomaly',
                        severity: 'critical',
                        title: `Zero stock — active product — ${p.name}`,
                        description: `${p.name} has 0 units in stock but has active sales history. You may lose orders if customers request this product.`,
                        value: '0 units',
                        detectedAt: today.toISOString().slice(0, 10),
                        relatedTo: p.name
                    });
                }
            });

            // Sort by severity
            const order = { critical: 0, high: 1, medium: 2 };
            found.sort((a, b) => order[a.severity] - order[b.severity]);
            setAnomalies(found);
        } catch (e) {
            console.error('Anomaly detection failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const getAIInsight = async () => {
        if (anomalies.length === 0) return;
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Marcus, a business risk advisor for a NYC oil distribution company. 
Be concise. Max 150 words. No markdown. Use CAPS for headings.`,
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `I've detected these business anomalies:
${anomalies.slice(0, 8).map(a => `[${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}

Which 2-3 need my attention TODAY, and what exactly should I do?`
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

    const filtered = anomalies.filter(a => filter === 'all' || a.severity === filter);

    const ICON_MAP: Record<string, any> = {
        demand_spike: TrendingUp,
        demand_drop: TrendingDown,
        price_anomaly: AlertTriangle,
        payment_anomaly: AlertTriangle,
        stock_anomaly: Eye,
    };

    const SEV_STYLE: Record<string, string> = {
        critical: 'bg-red-50 border-red-200 border-l-red-500',
        high: 'bg-orange-50 border-orange-200 border-l-orange-500',
        medium: 'bg-amber-50 border-amber-200 border-l-amber-500',
    };

    const SEV_BADGE: Record<string, string> = {
        critical: 'bg-red-100 text-red-700',
        high: 'bg-orange-100 text-orange-700',
        medium: 'bg-amber-100 text-amber-700',
    };

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/ai')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> AI Hub
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                            <AlertTriangle size={24} className="text-orange-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Anomaly Detection</h1>
                            <p className="text-gray-400 text-xs mt-0.5">AI monitors every transaction · Flags unusual patterns instantly</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={detectAnomalies} disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-black transition-all">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Re-scan
                        </button>
                        <button onClick={getAIInsight} disabled={aiLoading || anomalies.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black transition-all disabled:opacity-50">
                            {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                            Ask Marcus
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Anomalies', value: anomalies.length, color: 'text-gray-900' },
                    { label: 'Critical', value: anomalies.filter(a => a.severity === 'critical').length, color: 'text-red-600' },
                    { label: 'High Priority', value: anomalies.filter(a => a.severity === 'high').length, color: 'text-orange-600' },
                    { label: 'Medium', value: anomalies.filter(a => a.severity === 'medium').length, color: 'text-amber-600' },
                ].map((k, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{k.label}</p>
                        <p className={`text-2xl font-black ${k.color}`}>{loading ? '...' : k.value}</p>
                    </div>
                ))}
            </div>

            {/* AI Insight */}
            {aiInsight && (
                <div className="bg-gray-900 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-orange-400" />
                        <p className="text-sm font-black text-orange-400 uppercase tracking-widest">Marcus — Priority Actions</p>
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

            {/* Filter */}
            <div className="flex items-center gap-3">
                {(['all', 'critical', 'high', 'medium'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition-all capitalize ${filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {f === 'all' ? `All (${anomalies.length})` : `${f} (${anomalies.filter(a => a.severity === f).length})`}
                    </button>
                ))}
            </div>

            {/* Anomaly List */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <RefreshCw size={32} className="animate-spin text-orange-400 mx-auto mb-3" />
                    <p className="text-gray-400 font-bold">Scanning your business data for anomalies...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <p className="text-gray-400 font-bold text-lg">✅ No anomalies detected</p>
                    <p className="text-gray-300 text-sm mt-1">Your business data looks normal for this category</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(anomaly => {
                        const Icon = ICON_MAP[anomaly.type] || AlertTriangle;
                        return (
                            <div key={anomaly.id} className={`border-2 border-l-4 rounded-2xl p-5 ${SEV_STYLE[anomaly.severity]}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${SEV_BADGE[anomaly.severity]} bg-opacity-50`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-black text-gray-900">{anomaly.title}</p>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SEV_BADGE[anomaly.severity]}`}>
                                                    {anomaly.severity.toUpperCase()}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600 leading-relaxed">{anomaly.description}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">Detected: {anomaly.detectedAt}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black font-mono text-gray-900">{anomaly.value}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <p className="text-xs text-gray-400 text-center">
                AI runs statistical analysis across all invoices, customers, products, and payments · Click Re-scan to check again
            </p>
        </div>
    );
}
