// ──────────────────────────────────────────────────────────────
// Dashboard Overview — Soltol dark theme redesign
// Visual-layer rewrite per DASHBOARD_OVERVIEW_MASTER_PROMPT.md.
// All data loading, services, useMemo computations preserved.
// Layout simplified to: header → 6 KPIs → Revenue & Collections
// → Today's Activity → Stock & Operations.
// ──────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, X, Calendar, Sparkles, Truck, Package } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    getCustomers, getInvoices, getProducts, getSalesOrders, getVans, getPayments,
    type Invoice, type Product,
} from '../../services/api';
import { getPurchaseOrders } from '../../services/purchasesService';
import { useEscape } from '../../hooks/useEscape';

// ── Spec colour tokens (fallback hex so theme.css stays untouched) ─
const C = {
    bg:     'var(--bg, #060f1c)',
    bg2:    'var(--bg2, #0a1726)',
    bg3:    'var(--bg3, #0f1f33)',
    bg4:    'var(--bg4, #142540)',
    blue:   '#4F8EF7',
    green:  '#22C55E',
    red:    '#EF4444',
    amber:  '#F59E0B',
    purple: '#7C3AED',
    t:      'var(--t, #EEF2FF)',
    t2:     'var(--t2, #8BA3C7)',
    t3:     'var(--t3, #3E5678)',
    br2:    'rgba(255,255,255,.12)',
    bd2:    'rgba(255,255,255,.04)',
} as const;

// Marcus AI alert copy (matches existing dashboard's static insights).
const AI_ALERTS: { message: string }[] = [
    { message: 'Qahir Enterprises 32d overdue — $3,875 at risk. Stop credit immediately.' },
    { message: 'AP $18k due Friday — schedule payment run today.' },
    { message: 'Income on track for $490k projection by month-end.' },
    { message: 'OW16 SP stock low — Auto PO ready for approval.' },
];

const DAILY_TARGET = 2800;

function SectionDivider({ label }: { label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 10px' }}>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)' }} />
            <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.8px' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,.07),transparent)' }} />
        </div>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();

    // Data state (loaded from services — preserved)
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesOrdersData, setSalesOrdersData] = useState<any[]>([]);
    const [vansData, setVansData] = useState<any[]>([]);
    const [paymentsData, setPaymentsData] = useState<any[]>([]);
    const [customersCount, setCustomersCount] = useState(0);
    const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
    const [, setDataError] = useState(false);

    // UI state
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [showDateRange, setShowDateRange] = useState(false);
    const [dashFrom, setDashFrom] = useState<string>('');
    const [dashTo, setDashTo] = useState<string>('');
    const [chartRange, setChartRange] = useState<'3m' | '6m' | 'ytd' | '1y'>('3m');

    // Responsive grid columns
    const [cols, setCols] = useState({
        kpi: typeof window !== 'undefined'
            ? (window.innerWidth >= 1024 ? 6 : window.innerWidth >= 768 ? 3 : 2)
            : 6,
        twoCol: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
        threeCol: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    });

    useEffect(() => {
        const update = () => setCols({
            kpi: window.innerWidth >= 1024 ? 6 : window.innerWidth >= 768 ? 3 : 2,
            twoCol: window.innerWidth >= 768,
            threeCol: window.innerWidth >= 1024,
        });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ── Data loader (preserved business logic) ─────────────────────
    async function loadDashboardData() {
        setRefreshing(true);
        try {
            const [inv, prod, orders, vans, customers, pays, pos] = await Promise.all([
                getInvoices().catch(() => []),
                getProducts().catch(() => []),
                getSalesOrders().catch(() => []),
                getVans().catch(() => []),
                getCustomers().catch(() => []),
                getPayments().catch(() => []),
                getPurchaseOrders().catch(() => []),
            ]);
            // `pos` (purchase orders) still loaded for parity with original; not
            // surfaced in the new layout but kept so the service call signature
            // and downstream consumers (if any) remain intact.
            void pos;
            setInvoices(Array.isArray(inv) ? inv : []);
            setProducts(Array.isArray(prod) ? prod : []);
            setSalesOrdersData(Array.isArray(orders) ? orders : []);
            setVansData(Array.isArray(vans) ? vans : []);
            setPaymentsData(Array.isArray(pays) ? pays : []);
            const custList = Array.isArray(customers) ? customers : [];
            setCustomersCount(custList.length);

            const now = new Date();
            const thisMonth = custList.filter((c: any) => {
                if (!c.created_at) return false;
                const d = new Date(c.created_at);
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
            }).length;
            setNewCustomersThisMonth(thisMonth);
            setDataError(false);
        } catch {
            setDataError(true);
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => { void loadDashboardData(); }, []);
    useEscape(() => setShowDateRange(false), showDateRange);

    function flashToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    }

    async function handleRefresh() {
        await loadDashboardData();
        flashToast('Dashboard data refreshed.');
    }

    // ── Derived data (preserved + extended) ─────────────────────────
    const filteredInvoices = useMemo(() => {
        if (!dashFrom && !dashTo) return invoices;
        return invoices.filter(inv => {
            const d = (inv.invoiceDate || inv.createdAt || '').slice(0, 10);
            if (dashFrom && d < dashFrom) return false;
            if (dashTo && d > dashTo) return false;
            return true;
        });
    }, [invoices, dashFrom, dashTo]);

    const monthlyPerformanceData = useMemo(() => {
        const now = new Date();
        const months =
            chartRange === '3m' ? 3 :
            chartRange === '6m' ? 6 :
            chartRange === '1y' ? 12 :
            /* ytd */ now.getMonth() + 1;
        const points: Array<{ month: string; sales: number; expenses: number }> = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const keyYear = d.getFullYear();
            const keyMonth = d.getMonth();
            const monthLabel = d.toLocaleDateString(undefined, { month: 'short' });
            const sales = filteredInvoices
                .filter((inv) => {
                    const date = new Date(inv.invoiceDate || inv.createdAt);
                    return date.getFullYear() === keyYear && date.getMonth() === keyMonth;
                })
                .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
            points.push({ month: monthLabel, sales, expenses: 0 });
        }
        return points;
    }, [filteredInvoices, chartRange]);

    const recentOrders = useMemo(() => {
        return [...invoices]
            .sort((a, b) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime())
            .slice(0, 5)
            .map((i) => ({
                id: i.invoiceNumber || String(i.id),
                customerName: i.customerName || 'Customer',
                reference: i.invoiceNumber || String(i.id),
                date: (i.invoiceDate || i.createdAt || '').toString().slice(0, 10),
                amount: Number(i.grandTotal) || 0,
                status: String(i.status || 'Unpaid').toLowerCase(),
            }));
    }, [invoices]);

    // ── KPI metrics computed from existing data ────────────────────
    const _now = new Date();
    const _curMonth = _now.getMonth();
    const _curYear = _now.getFullYear();
    const _todayStr = _now.toISOString().slice(0, 10);

    const totalRevenueMTD = invoices.reduce((sum, inv) => {
        if (String(inv.status || '').toLowerCase() === 'cancelled') return sum;
        const d = new Date(inv.invoiceDate || inv.createdAt || 0);
        if (d.getFullYear() !== _curYear || d.getMonth() !== _curMonth) return sum;
        return sum + (Number(inv.grandTotal) || 0);
    }, 0);

    const unpaidInvoices = invoices.filter(i =>
        ['unpaid', 'pending', 'partial', 'overdue'].includes(String(i.status || '').toLowerCase())
    );
    const totalOutstanding = unpaidInvoices.reduce(
        (sum, i) => sum + (Number(i.remaining_balance ?? i.grandTotal) || 0), 0
    );
    const unpaidInvoiceCount = unpaidInvoices.length;

    const overdueInvoices = invoices.filter(i => String(i.status || '').toLowerCase() === 'overdue');
    const overdueTotal = overdueInvoices.reduce(
        (sum, i) => sum + (Number(i.remaining_balance ?? i.grandTotal) || 0), 0
    );
    const overdueCount = overdueInvoices.length;

    const todayOrders = salesOrdersData.filter((o: any) => {
        const d = String(o.orderDate || o.createdAt || '').slice(0, 10);
        return d === _todayStr;
    });
    const ordersToday = todayOrders.length;
    const orderValueToday = todayOrders.reduce(
        (sum: number, o: any) => sum + (Number(o.grandTotal) || 0), 0
    );

    const lowStockCount = products.filter(p => Number(p.current_stock || 0) < 10).length;
    const lowStockProducts = products
        .filter(p => Number(p.current_stock || 0) < 20)
        .sort((a, b) => Number(a.current_stock || 0) - Number(b.current_stock || 0))
        .slice(0, 5);

    const activeCustomerCount = customersCount;

    const cashCollectedToday = paymentsData.reduce((sum: number, p: any) => {
        const d = String(p.payment_date || p.date || '').slice(0, 10);
        return d === _todayStr ? sum + (Number(p.amount) || 0) : sum;
    }, 0);

    // Top outstanding customers — grouped from invoices
    const topOutstandingCustomers = (() => {
        const map = new Map<string, { name: string; balance: number; overdue: number; oldestDays: number }>();
        invoices.forEach(inv => {
            const status = String(inv.status || '').toLowerCase();
            if (!['unpaid', 'pending', 'partial', 'overdue'].includes(status)) return;
            const key = inv.customerName || String((inv as any).customerId || '?');
            const amt = Number(inv.remaining_balance ?? inv.grandTotal) || 0;
            const isOverdue = status === 'overdue';
            const dateStr = inv.invoiceDate || inv.createdAt;
            const ageDays = dateStr ? Math.floor((_now.getTime() - new Date(dateStr).getTime()) / 86400000) : 0;
            const prev = map.get(key) || { name: key, balance: 0, overdue: 0, oldestDays: 0 };
            prev.balance += amt;
            if (isOverdue) prev.overdue += amt;
            if (ageDays > prev.oldestDays) prev.oldestDays = ageDays;
            map.set(key, prev);
        });
        return [...map.values()].sort((a, b) => b.balance - a.balance).slice(0, 5);
    })();

    // ── KPI definitions ────────────────────────────────────────────
    const KPIS = [
        {
            label: 'Total Revenue (MTD)',
            value: `$${totalRevenueMTD.toLocaleString()}`,
            color: C.green, stripe: C.green,
            sub: 'this month',
            badge: { text: '↑ MTD', color: C.green },
        },
        {
            label: 'Outstanding AR',
            value: `$${totalOutstanding.toLocaleString()}`,
            color: totalOutstanding > 0 ? C.amber : C.green, stripe: C.amber,
            sub: `${unpaidInvoiceCount} unpaid invoices`,
            badge: { text: 'Collect', color: C.amber },
        },
        {
            label: 'Overdue Amount',
            value: `$${overdueTotal.toLocaleString()}`,
            color: overdueTotal > 0 ? C.red : C.green, stripe: C.red,
            sub: overdueTotal > 0 ? `${overdueCount} customers` : 'All clear ✓',
            badge: { text: overdueTotal > 0 ? 'Urgent' : 'Clear', color: overdueTotal > 0 ? C.red : C.green },
        },
        {
            label: 'Orders Today',
            value: String(ordersToday),
            color: C.blue, stripe: C.blue,
            sub: `$${orderValueToday.toLocaleString()} value`,
            badge: { text: 'Today', color: C.blue },
        },
        {
            label: 'Low Stock Items',
            value: String(lowStockCount),
            color: lowStockCount > 0 ? C.amber : C.green, stripe: C.amber,
            sub: lowStockCount > 0 ? 'need reorder' : 'All stocked ✓',
            badge: { text: lowStockCount > 0 ? 'Reorder' : 'OK', color: lowStockCount > 0 ? C.amber : C.green },
        },
        {
            label: 'Active Customers',
            value: String(activeCustomerCount),
            color: C.blue, stripe: C.purple,
            sub: `${newCustomersThisMonth} new this month`,
            badge: { text: 'Active', color: C.blue },
        },
    ];

    // ── Render ─────────────────────────────────────────────────────
    return (
        <div style={{ background: C.bg, color: C.t, minHeight: '100%' }}>
            {/* Transient toast (refresh / date range / errors) */}
            {toast && (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        position: 'fixed', top: 80, right: 24, zIndex: 200,
                        background: C.bg3,
                        border: '1px solid rgba(34,197,94,.3)',
                        borderRadius: 9, padding: '10px 14px',
                        fontSize: 11, color: C.green,
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 8px 24px rgba(0,0,0,.4)',
                    }}
                >
                    <span>{toast}</span>
                    <button
                        onClick={() => setToast(null)}
                        aria-label="Dismiss"
                        style={{ background: 'transparent', border: 'none', color: C.t2, cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* Page header */}
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{
                            fontSize: 22, fontWeight: 700, color: C.t,
                            display: 'flex', alignItems: 'center', gap: 8, margin: 0,
                        }}>
                            <span aria-hidden>📊</span> Dashboard Overview
                        </h1>
                        <p style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>
                            Revenue · Collections · Stock · AI alerts · Team performance
                            {(dashFrom || dashTo) && (
                                <span style={{ marginLeft: 8, fontSize: 10, color: C.amber, fontWeight: 700 }}>
                                    · Chart filtered: {dashFrom || '…'} → {dashTo || 'today'}{' '}
                                    <button
                                        onClick={() => { setDashFrom(''); setDashTo(''); flashToast('Date range cleared.'); }}
                                        style={{ background: 'transparent', border: 'none', color: C.blue, cursor: 'pointer', textDecoration: 'underline', fontSize: 10, fontFamily: 'inherit' }}
                                    >
                                        clear
                                    </button>
                                </span>
                            )}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                            onClick={() => void handleRefresh()}
                            disabled={refreshing}
                            style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,.12)',
                                borderRadius: 8, padding: '6px 13px', fontSize: 11,
                                color: C.t2, cursor: refreshing ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: 5,
                                fontFamily: 'inherit', opacity: refreshing ? 0.6 : 1,
                            }}
                        >
                            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button
                            onClick={() => setShowDateRange(v => !v)}
                            style={{
                                background: showDateRange ? 'rgba(79,142,247,.12)' : 'transparent',
                                border: '1px solid rgba(255,255,255,.12)',
                                borderRadius: 8, padding: '6px 13px', fontSize: 11,
                                color: showDateRange ? C.blue : C.t2, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 5,
                                fontFamily: 'inherit',
                            }}
                        >
                            <Calendar size={12} /> Date range
                        </button>
                    </div>
                </div>
            </div>

            {/* Date range picker (collapsible) */}
            {showDateRange && (
                <div style={{
                    margin: '12px 20px 0',
                    background: C.bg3,
                    border: '1px solid rgba(79,142,247,.25)',
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>From</label>
                        <input
                            type="date"
                            value={dashFrom}
                            onChange={e => setDashFrom(e.target.value)}
                            style={{ background: C.bg4, color: C.t, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>To</label>
                        <input
                            type="date"
                            value={dashTo}
                            onChange={e => setDashTo(e.target.value)}
                            style={{ background: C.bg4, color: C.t, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit' }}
                        />
                    </div>
                    <button
                        onClick={() => { setDashFrom(''); setDashTo(''); }}
                        style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, fontSize: 10, color: C.t2, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'inherit' }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => { setShowDateRange(false); flashToast('Date range applied to charts.'); }}
                        style={{ padding: '6px 14px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'inherit' }}
                    >
                        Apply
                    </button>
                    <button
                        onClick={() => setShowDateRange(false)}
                        aria-label="Close date range picker"
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.t2, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                    >
                        <X size={12} />
                    </button>
                </div>
            )}

            <div style={{ padding: '14px 20px 24px' }}>
                {/* KPI row — 6 cards */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi},1fr)`, gap: 10 }}>
                    {KPIS.map((kpi, i) => (
                        <div
                            key={i}
                            style={{
                                background: C.bg3, border: `1px solid ${C.br2}`,
                                borderRadius: 10, padding: '11px 13px',
                                position: 'relative', overflow: 'hidden', cursor: 'pointer',
                                transition: 'transform .2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0,
                                height: 2.5, background: kpi.stripe,
                            }} />
                            <span style={{
                                position: 'absolute', top: 8, right: 8,
                                fontSize: 9, fontWeight: 600,
                                padding: '1px 6px', borderRadius: 8,
                                background: `${kpi.badge.color}22`, color: kpi.badge.color,
                            }}>
                                {kpi.badge.text}
                            </span>
                            <div style={{ fontSize: 10, color: C.t2, marginBottom: 4, marginTop: 2 }}>{kpi.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color, lineHeight: 1, marginBottom: 3 }}>
                                {kpi.value}
                            </div>
                            <div style={{ fontSize: 10, color: C.t3 }}>{kpi.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Section 1 — Revenue & Collections */}
                <SectionDivider label="REVENUE & COLLECTIONS" />
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: cols.twoCol ? '1.6fr 1fr' : '1fr',
                    gap: 10,
                }}>
                    {/* Revenue chart */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br2}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>
                                📈 Revenue
                            </span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {(['3m', '6m', 'ytd', '1y'] as const).map(r => {
                                    const active = chartRange === r;
                                    return (
                                        <button
                                            key={r}
                                            onClick={() => setChartRange(r)}
                                            style={{
                                                padding: '3px 8px', borderRadius: 6,
                                                fontSize: 10, fontWeight: 600,
                                                background: active ? C.blue : 'transparent',
                                                color: active ? '#fff' : C.t3,
                                                border: '1px solid rgba(255,255,255,.07)',
                                                cursor: 'pointer', textTransform: 'uppercase',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {r === 'ytd' ? 'YTD' : r.toUpperCase()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div style={{ height: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyPerformanceData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="month" tick={{ fill: '#3E5678', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.07)' }} />
                                    <YAxis tick={{ fill: '#3E5678', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.07)' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--bg3,#0f1f33)',
                                            border: '1px solid rgba(79,142,247,0.3)',
                                            borderRadius: 8,
                                            color: '#EEF2FF',
                                            fontSize: 11,
                                        }}
                                        cursor={{ fill: 'rgba(255,255,255,.03)' }}
                                    />
                                    <Bar dataKey="sales" name="Revenue" fill="#4F8EF7" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top outstanding customers */}
                    <div style={{
                        background: C.bg3, border: `1px solid ${C.br2}`,
                        borderRadius: 12, padding: 0, overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid rgba(255,255,255,.07)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>
                                🔴 Top Outstanding
                            </span>
                            <span
                                style={{ fontSize: 10, color: C.blue, cursor: 'pointer' }}
                                onClick={() => navigate('/sales/invoices')}
                            >
                                View all →
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Customer', 'Balance', 'Overdue', 'Days', 'Action'].map(h => (
                                            <th key={h} style={{
                                                fontSize: 10, color: C.t3, fontWeight: 700,
                                                letterSpacing: '.5px', padding: '8px 10px',
                                                borderBottom: '1px solid rgba(255,255,255,.07)',
                                                textAlign: 'left', textTransform: 'uppercase',
                                                background: C.bg2,
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {topOutstandingCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '32px 10px', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                                No outstanding balances ✓
                                            </td>
                                        </tr>
                                    ) : topOutstandingCustomers.map((c, i) => (
                                        <tr
                                            key={i}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                            style={{ transition: 'background .15s' }}
                                        >
                                            <td style={{ fontSize: 11, color: C.t, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontWeight: 600 }}>{c.name}</td>
                                            <td style={{ fontSize: 11, color: C.amber, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace' }}>
                                                ${c.balance.toFixed(0)}
                                            </td>
                                            <td style={{ fontSize: 11, color: c.overdue > 0 ? C.red : C.t3, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace' }}>
                                                {c.overdue > 0 ? `$${c.overdue.toFixed(0)}` : '—'}
                                            </td>
                                            <td style={{ fontSize: 11, color: c.oldestDays > 30 ? C.red : C.t3, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                                                {c.oldestDays}d
                                            </td>
                                            <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                                                <button
                                                    onClick={() => navigate('/sales/invoices')}
                                                    style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 7, padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                                                >
                                                    Collect
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Section 2 — Today's Activity */}
                <SectionDivider label="TODAY'S ACTIVITY" />
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: cols.threeCol ? '1fr 1fr 1fr' : cols.twoCol ? '1fr 1fr' : '1fr',
                    gap: 10,
                }}>
                    {/* Recent orders */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br2}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t, marginBottom: 10 }}>
                            🛒 Recent orders
                        </div>
                        {recentOrders.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                No recent orders
                            </div>
                        ) : recentOrders.map((order, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '7px 0',
                                    borderBottom: i < recentOrders.length - 1 ? `1px solid ${C.bd2}` : 'none',
                                    fontSize: 11,
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ color: C.t, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {order.customerName}
                                    </div>
                                    <div style={{ fontSize: 10, color: C.t3 }}>{order.reference} · {order.date}</div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                                    <div style={{ color: C.green, fontWeight: 600 }}>
                                        ${order.amount.toFixed(2)}
                                    </div>
                                    <span style={{
                                        fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8,
                                        background: order.status === 'paid' ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                                        color: order.status === 'paid' ? '#16A34A' : '#B45309',
                                    }}>
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cash collected today */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br2}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.t, marginBottom: 10 }}>
                            💵 Cash collected today
                        </div>
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                            <div style={{ fontSize: 28, fontWeight: 700, color: C.green, lineHeight: 1, marginBottom: 4 }}>
                                ${cashCollectedToday.toLocaleString()}
                            </div>
                            <div style={{ fontSize: 11, color: C.t2 }}>
                                Target: ${DAILY_TARGET.toLocaleString()}
                            </div>
                            <div style={{
                                height: 8, borderRadius: 8,
                                background: 'rgba(255,255,255,.06)',
                                margin: '10px 0 6px', overflow: 'hidden',
                            }}>
                                <div style={{
                                    height: 8, borderRadius: 8,
                                    width: `${Math.min(100, DAILY_TARGET > 0 ? (cashCollectedToday / DAILY_TARGET) * 100 : 0)}%`,
                                    background: C.green,
                                    transition: 'width .6s ease',
                                }} />
                            </div>
                            <div style={{ fontSize: 10, color: C.t3 }}>
                                {DAILY_TARGET > 0
                                    ? `${((cashCollectedToday / DAILY_TARGET) * 100).toFixed(0)}% of daily target`
                                    : 'No target set'}
                            </div>
                        </div>
                    </div>

                    {/* AI alerts */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br2}`, borderRadius: 12, padding: 14 }}>
                        <div style={{
                            fontSize: 12, fontWeight: 700, color: C.t, marginBottom: 10,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <Sparkles size={13} color={C.purple} /> Marcus AI alerts
                            <span style={{
                                background: 'rgba(239,68,68,.15)', color: '#B91C1C',
                                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                            }}>
                                {AI_ALERTS.length} new
                            </span>
                        </div>
                        {AI_ALERTS.slice(0, 4).map((alert, i) => (
                            <div
                                key={i}
                                style={{
                                    background: i === 0 ? 'rgba(239,68,68,.07)' : 'rgba(255,255,255,.03)',
                                    border: `1px solid ${i === 0 ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.06)'}`,
                                    borderRadius: 8, padding: '7px 10px', marginBottom: 6,
                                    fontSize: 10, color: C.t2, lineHeight: 1.5,
                                }}
                            >
                                <span style={{ color: C.t }}>{alert.message}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 3 — Stock & Operations */}
                <SectionDivider label="STOCK & OPERATIONS" />
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
                    gap: 10,
                }}>
                    {/* Low stock table */}
                    <div style={{
                        background: C.bg3, border: `1px solid ${C.br2}`,
                        borderRadius: 12, padding: 0, overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid rgba(255,255,255,.07)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Package size={13} color={C.amber} /> Low stock — needs reorder
                            </span>
                            <span
                                style={{ fontSize: 10, color: C.blue, cursor: 'pointer' }}
                                onClick={() => navigate('/products')}
                            >
                                View all →
                            </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['Product', 'Stock', 'Reorder Point', 'Status'].map(h => (
                                            <th key={h} style={{
                                                fontSize: 10, color: C.t3, fontWeight: 700,
                                                letterSpacing: '.5px', padding: '8px 10px',
                                                borderBottom: '1px solid rgba(255,255,255,.07)',
                                                textAlign: 'left', textTransform: 'uppercase',
                                                background: C.bg2,
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowStockProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '32px 10px', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                                All stocked ✓
                                            </td>
                                        </tr>
                                    ) : lowStockProducts.map((p, i) => {
                                        const stock = Number(p.current_stock || 0);
                                        const reorderPoint = Number((p as any).reorder_point || 10);
                                        const isCritical = stock < reorderPoint / 2;
                                        const stockColor = stock < reorderPoint ? (isCritical ? C.red : C.amber) : C.t;
                                        return (
                                            <tr
                                                key={i}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                style={{ transition: 'background .15s' }}
                                            >
                                                <td style={{ fontSize: 11, color: C.t, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontWeight: 500 }}>
                                                    {p.name}
                                                </td>
                                                <td style={{ fontSize: 11, color: stockColor, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace', fontWeight: 600 }}>
                                                    {stock}
                                                </td>
                                                <td style={{ fontSize: 11, color: C.t2, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace' }}>
                                                    {reorderPoint}
                                                </td>
                                                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                                                    <span style={{
                                                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                                                        background: isCritical ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                                                        color: isCritical ? '#B91C1C' : '#B45309',
                                                        textTransform: 'uppercase', letterSpacing: '.4px',
                                                    }}>
                                                        {isCritical ? 'Critical' : 'Low'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Van operations */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br2}`, borderRadius: 12, padding: 14 }}>
                        <div style={{
                            fontSize: 12, fontWeight: 700, color: C.t, marginBottom: 10,
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <Truck size={13} color={C.green} /> Van operations — today
                        </div>
                        {vansData.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                No vans on route
                            </div>
                        ) : vansData.slice(0, 5).map((van: any, i: number) => {
                            const status = String(van.status || '').toLowerCase();
                            const isOnRoute = status === 'active' || status === 'on_route';
                            const shown = Math.min(vansData.length, 5);
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '8px 0',
                                        borderBottom: i < shown - 1 ? `1px solid ${C.bd2}` : 'none',
                                        fontSize: 11,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%',
                                            background: isOnRoute ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11,
                                        }}>
                                            🚛
                                        </div>
                                        <div>
                                            <div style={{ color: C.t, fontWeight: 500 }}>
                                                {van.name || van.driverName || `Van ${i + 1}`}
                                            </div>
                                            <div style={{ fontSize: 10, color: C.t3 }}>
                                                {van.stopsCompleted ?? 0}/{van.totalStops ?? 0} stops ·
                                                {' '}${Number(van.collected ?? 0).toFixed(0)} collected
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 8,
                                        background: isOnRoute ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                                        color: isOnRoute ? '#16A34A' : '#B45309',
                                    }}>
                                        {isOnRoute ? 'On route' : 'At depot'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
