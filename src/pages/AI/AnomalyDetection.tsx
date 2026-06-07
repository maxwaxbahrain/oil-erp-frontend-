import { useState, useEffect, useMemo, Fragment, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Zap,
    RefreshCw,
    Eye,
    Search,
    Bot,
    ChevronRight,
    MessageCircle,
} from 'lucide-react';
import { authFetch } from '../../api/axios';
import { getInvoices, getProducts, getCustomers } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';
import { getCurrentUser } from '../../store/authStore';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    purple: '#7C3AED',
    orange: '#F59E0B',
    red: '#EF4444',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

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

function openMarcusAdvisor() {
    window.dispatchEvent(new CustomEvent('soltol:open-ai-advisor'));
}

function formatRelativeTime(ts: number | null): string {
    if (!ts) return '—';
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Just now';
    if (mins === 1) return '1 min ago';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) return '1 hr ago';
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

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

const SEV_GROUP: Record<string, { label: string; color: string; bg: string; border: string }> = {
    critical: { label: 'CRITICAL', color: C.red, bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.25)' },
    high: { label: 'HIGH PRIORITY', color: C.orange, bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)' },
    medium: { label: 'MEDIUM', color: '#FCD34D', bg: 'rgba(250,204,21,.06)', border: 'rgba(250,204,21,.2)' },
};

function getSeverityBadge(anomaly: Anomaly): { label: string; color: string; bg: string } {
    if (anomaly.severity === 'critical') {
        return { label: 'Critical', color: '#FCA5A5', bg: 'rgba(239,68,68,.15)' };
    }
    if (anomaly.severity === 'high') {
        return { label: 'High risk', color: '#FCA5A5', bg: 'rgba(239,68,68,.12)' };
    }
    if (anomaly.type === 'price_anomaly') {
        return { label: 'Pricing error', color: '#FCD34D', bg: 'rgba(245,158,11,.15)' };
    }
    return { label: 'Medium', color: '#FCD34D', bg: 'rgba(250,204,21,.12)' };
}

export default function AnomalyDetection() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
    const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

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
            setLastCheckedAt(Date.now());
        }
    };

    const getAIInsight = async () => {
        if (anomalies.length === 0) return;
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const res = await authFetch(`${API}/ai/chat`, {
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

    const filtered = anomalies.filter(a => filter === 'all' || a.severity === filter);

    const ICON_MAP: Record<string, any> = {
        demand_spike: TrendingUp,
        demand_drop: TrendingDown,
        price_anomaly: AlertTriangle,
        payment_anomaly: AlertTriangle,
        stock_anomaly: Eye,
    };

    const thisMonthCount = useMemo(() => {
        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        return anomalies.filter(a => {
            const d = new Date(a.detectedAt);
            return d.getMonth() === month && d.getFullYear() === year;
        }).length;
    }, [anomalies]);

    const groupedFiltered = useMemo(() => {
        if (filter !== 'all') return { [filter]: filtered };
        const groups: Record<string, Anomaly[]> = { critical: [], high: [], medium: [] };
        filtered.forEach(a => groups[a.severity].push(a));
        return groups;
    }, [filtered, filter]);

    const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
    const highCount = anomalies.filter(a => a.severity === 'high').length;
    const mediumCount = anomalies.filter(a => a.severity === 'medium').length;

    const renderAnomalyCard = (anomaly: Anomaly) => {
        const Icon = ICON_MAP[anomaly.type] || AlertTriangle;
        const badge = getSeverityBadge(anomaly);
        const group = SEV_GROUP[anomaly.severity];

        return (
            <div
                key={anomaly.id}
                style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    background: group.bg,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: badge.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}>
                        <Icon size={16} color={badge.color} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{anomaly.title}</p>
                            <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: 999,
                                background: badge.bg,
                                color: badge.color,
                            }}>
                                {badge.label}
                            </span>
                        </div>
                        <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px', lineHeight: 1.5 }}>{anomaly.description}</p>
                        <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>Detected: {anomaly.detectedAt}</p>
                    </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: C.text, margin: 0 }}>{anomaly.value}</p>
                </div>
            </div>
        );
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
                    <span style={{ color: C.text, fontWeight: 600 }}>Anomaly detection</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        type="button"
                        onClick={openMarcusAdvisor}
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
                            <Search size={24} color={C.red} />
                            Anomaly detection
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 5, marginBottom: 0, maxWidth: 620 }}>
                            AI monitors every transaction · Flags unusual patterns · human review required
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                            type="button"
                            onClick={detectAnomalies}
                            disabled={loading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 14px',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,.12)',
                                background: C.bg3,
                                color: C.text,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                            }}
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Re-scan
                        </button>
                        <span
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '6px 12px',
                                borderRadius: 999,
                                background: 'rgba(34,197,94,.12)',
                                color: '#86EFAC',
                                border: '1px solid rgba(34,197,94,.35)',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            <Bot size={12} /> Live · scanning
                        </span>
                    </div>
                </div>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
                    {[
                        {
                            label: 'Total anomalies',
                            value: loading ? '…' : `${thisMonthCount} / ${anomalies.length}`,
                            sub: 'this month / all detected',
                            accent: C.blue,
                        },
                        {
                            label: 'Critical',
                            value: loading ? '…' : criticalCount,
                            sub: 'needs immediate action',
                            accent: C.red,
                        },
                        {
                            label: 'High priority',
                            value: loading ? '…' : highCount,
                            sub: 'review today',
                            accent: C.orange,
                        },
                        {
                            label: 'Last checked',
                            value: loading ? '…' : formatRelativeTime(lastCheckedAt),
                            sub: 'auto-scan on load',
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
                            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: C.muted, margin: '0 0 6px' }}>
                                {kpi.label}
                            </p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px', fontFamily: typeof kpi.value === 'number' ? 'monospace' : 'inherit' }}>
                                {kpi.value}
                            </p>
                            <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>{kpi.sub}</p>
                        </div>
                    ))}
                </div>

                {/* AI Insight — shown after Ask Marcus trigger */}
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
                                <p style={{ fontSize: 11, fontWeight: 700, color: C.orange, margin: '0 0 6px' }}>Marcus — Priority Actions</p>
                                <div style={{ fontSize: 12, lineHeight: 1.55 }}>
                                    {aiInsight.split('\n').map((line, i) => {
                                        const t = line.trim();
                                        if (!t) return <div key={i} style={{ height: 4 }} />;
                                        if (t === t.toUpperCase() && t.length > 4) {
                                            return <p key={i} style={{ fontWeight: 700, color: C.orange, fontSize: 10, textTransform: 'uppercase', margin: '8px 0 4px' }}>{t}</p>;
                                        }
                                        return <p key={i} style={{ margin: '2px 0', color: C.muted }}>{t}</p>;
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Ask Marcus trigger (preserves existing handler) */}
                {!aiInsight && !aiLoading && anomalies.length > 0 && (
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
                                        {criticalCount > 0
                                            ? `${criticalCount} critical anomal${criticalCount !== 1 ? 'ies' : 'y'} detected — ask Marcus which need attention today.`
                                            : `${anomalies.length} anomal${anomalies.length !== 1 ? 'ies' : 'y'} flagged — ask Marcus for priority actions.`}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={getAIInsight}
                                disabled={aiLoading || anomalies.length === 0}
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
                                <Zap size={13} /> Ask Marcus
                            </button>
                        </div>
                    </div>
                )}

                {aiLoading && (
                    <div style={{ ...panel, padding: '16px 18px', marginBottom: 14, background: C.bg3 }}>
                        <p style={{ fontSize: 12, color: C.muted, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RefreshCw size={14} className="animate-spin" /> Marcus is analysing anomalies...
                        </p>
                    </div>
                )}

                {/* Filter pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    {([
                        { key: 'all' as const, label: `All (${anomalies.length})` },
                        { key: 'critical' as const, label: `Critical (${criticalCount})` },
                        { key: 'high' as const, label: `High (${highCount})` },
                        { key: 'medium' as const, label: `Medium (${mediumCount})` },
                    ]).map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            style={{
                                padding: '7px 14px',
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: filter === f.key ? '1px solid rgba(79,142,247,.4)' : '1px solid rgba(255,255,255,.08)',
                                background: filter === f.key ? 'rgba(79,142,247,.15)' : C.bg3,
                                color: filter === f.key ? '#93C5FD' : C.muted,
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Anomaly list */}
                <div style={{ ...panel, overflow: 'hidden' }}>
                    <div style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid rgba(255,255,255,.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>
                            Detected anomalies · {filtered.length} shown
                        </p>
                        <button
                            type="button"
                            onClick={detectAnomalies}
                            disabled={loading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                background: 'none',
                                border: 'none',
                                fontSize: 10,
                                fontWeight: 700,
                                color: C.blue,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.5 : 1,
                            }}
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Re-scan
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ padding: 48, textAlign: 'center' }}>
                            <RefreshCw size={32} className="animate-spin" color={C.orange} style={{ margin: '0 auto 12px' }} />
                            <p style={{ color: C.muted, fontWeight: 700, fontSize: 12, margin: 0 }}>Scanning your business data for anomalies...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 48, textAlign: 'center' }}>
                            <p style={{ color: C.muted, fontWeight: 700, fontSize: 14, margin: 0 }}>✅ No anomalies detected</p>
                            <p style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Your business data looks normal for this category</p>
                        </div>
                    ) : (
                        <div>
                            {(filter === 'all' ? (['critical', 'high', 'medium'] as const) : [filter]).map(sevKey => {
                                const items = groupedFiltered[sevKey] || [];
                                if (items.length === 0) return null;
                                const meta = SEV_GROUP[sevKey];
                                return (
                                    <Fragment key={sevKey}>
                                        {filter === 'all' && (
                                            <div style={{
                                                padding: '8px 16px',
                                                background: meta.bg,
                                                borderTop: `1px solid ${meta.border}`,
                                                borderBottom: `1px solid ${meta.border}`,
                                            }}>
                                                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.6px', color: meta.color }}>
                                                    {meta.label} · {items.length} anomal{items.length !== 1 ? 'ies' : 'y'}
                                                </span>
                                            </div>
                                        )}
                                        {items.map(renderAnomalyCard)}
                                    </Fragment>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer disclaimer */}
            <div style={{
                position: 'sticky',
                bottom: 0,
                padding: '12px 28px',
                borderTop: '1px solid rgba(255,255,255,.06)',
                background: C.bg2,
                textAlign: 'center',
            }}>
                <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>
                    Statistical analysis across invoices, customers, products, payments · Re-scan anytime
                </p>
            </div>
        </div>
    );
}
