// ──────────────────────────────────────────────────────────────
// Dashboard Overview — V2 Soltol redesign
// Matches the customer_overview_complete_final.html mockup layout:
//   Header → 6-cell stats row → Row 1 (3-col) → Row 2 (2-col)
//   → Row 3 (2-col) → Row 4 (2-col)
// Visual-layer only — service imports, state, useMemo, handlers,
// data-loading logic all preserved exactly as in the previous build.
// Charts switched from Recharts to CSS bars per spec example.
// ──────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, X, Calendar } from 'lucide-react';
import { useTracking } from '../../hooks/useTracking';
import {
    getCustomers, getInvoices, getProducts, getSalesOrders, getVans, getPayments,
    type Invoice, type Product,
} from '../../services/api';
import { getPurchaseOrders } from '../../services/purchasesService';
import { useEscape } from '../../hooks/useEscape';
import { calculateReceivables } from '../../utils/arMetrics';

// ── Spec colour tokens (fallback hex matches V2 mockup) ─────────
const C = {
    bg:     'var(--bg, #060f1c)',
    bg2:    'var(--bg2, #091524)',
    bg3:    'var(--bg3, #0d1b2e)',
    bg4:    'var(--bg4, #122238)',
    blue:   '#4A8FF5',
    green:  '#22C55E',
    red:    '#EF4444',
    amber:  '#F59E0B',
    purple: '#9B6FE4',
    yellow: '#FACC15',
    t:      'var(--t, #EEF2FF)',
    t1:     'var(--t1, #8BA8CC)',
    t2:     'var(--t2, #8BA8CC)',
    t3:     'var(--t3, #3E5A7A)',
    br:     'rgba(255,255,255,.07)',
    bd2:    'rgba(255,255,255,.04)',
} as const;

const DAILY_TARGET = 2800;
void DAILY_TARGET;

// ── Date helpers (used by stats row + recent activity) ──────────
function isToday(d?: string): boolean {
    if (!d) return false;
    try { return new Date(d).toDateString() === new Date().toDateString(); }
    catch { return false; }
}

function _fmtDate(d?: string): string {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    catch { return d; }
}

function isImportedCustomer(c: { notes?: string }): boolean {
    const notes = String(c.notes || '').toLowerCase();
    return notes.includes('bettano import') || notes.includes('imported');
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { trackPage } = useTracking();
    useEffect(() => { trackPage('dashboard'); }, [trackPage]);

    // Data state (preserved from previous build) ────────────────
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesOrdersData, setSalesOrdersData] = useState<any[]>([]);
    const [vansData, setVansData] = useState<any[]>([]);
    const [paymentsData, setPaymentsData] = useState<any[]>([]);
    const [customersCount, setCustomersCount] = useState(0);
    const [customersData, setCustomersData] = useState<any[]>([]);
    const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
    const [, setDataError] = useState(false);

    // UI state
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [showDateRange, setShowDateRange] = useState(false);
    const [dashFrom, setDashFrom] = useState<string>('');
    const [dashTo, setDashTo] = useState<string>('');
    const [chartRange, setChartRange] = useState<'3m' | '6m' | 'ytd' | '1y'>('6m');

    // Responsive — per V2 spec, isMobile + isTablet booleans
    const [isMobile, setIsMobile] = useState<boolean>(() =>
        typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    const [isTablet, setIsTablet] = useState<boolean>(() =>
        typeof window !== 'undefined' ? window.innerWidth < 1024 : false
    );

    useEffect(() => {
        const update = () => {
            setIsMobile(window.innerWidth < 768);
            setIsTablet(window.innerWidth < 1024);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // ── Data loader (preserved business logic) ─────────────────
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
            // `pos` (purchase orders) still loaded for parity with original;
            // not surfaced in V2 layout but kept so the service call signature
            // and downstream consumers (if any) remain intact.
            void pos;
            setInvoices(Array.isArray(inv) ? inv : []);
            setProducts(Array.isArray(prod) ? prod : []);
            setSalesOrdersData(Array.isArray(orders) ? orders : []);
            setVansData(Array.isArray(vans) ? vans : []);
            setPaymentsData(Array.isArray(pays) ? pays : []);
            const custList = Array.isArray(customers) ? customers : [];
            setCustomersCount(custList.length);
            setCustomersData(custList);

            const now = new Date();
            const thisMonth = custList.filter((c: any) => {
                if (isImportedCustomer(c)) return false;
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

    // ── Derived data — preserved + extended ────────────────────
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
        const points: Array<{ month: string; revenue: number }> = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const keyYear = d.getFullYear();
            const keyMonth = d.getMonth();
            const monthLabel = d.toLocaleDateString(undefined, { month: 'short' });
            const revenue = filteredInvoices
                .filter((inv) => {
                    const date = new Date(inv.invoiceDate || inv.createdAt);
                    return date.getFullYear() === keyYear && date.getMonth() === keyMonth;
                })
                .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
            points.push({ month: monthLabel, revenue });
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

    // ── KPI metrics computed from existing data ────────────────
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

    const receivables = useMemo(
        () => calculateReceivables(invoices, paymentsData, _now),
        [invoices, paymentsData],
    );
    const totalOutstanding = receivables.total;
    const unpaidInvoiceCount = receivables.invoices.length;
    const overdueTotal = receivables.days30 + receivables.days60 + receivables.days90;
    const overdueCount = receivables.invoices.filter(r => r.bucket !== 'current').length;

    const customerNameById = useMemo(() => {
        const map = new Map<string, string>();
        customersData.forEach((c: any) => {
            if (c.id != null && c.name) map.set(String(c.id), String(c.name));
        });
        return map;
    }, [customersData]);

    function resolveCustomerName(inv: Invoice): string {
        const trimmed = String(inv.customerName || '').trim();
        if (trimmed) return trimmed;
        const cid = inv.customerId ? String(inv.customerId) : '';
        if (cid && customerNameById.has(cid)) return customerNameById.get(cid)!;
        return cid ? `Customer #${cid}` : 'Unknown customer';
    }

    const todayOrders = salesOrdersData.filter((o: any) => {
        const d = String(o.orderDate || o.createdAt || '').slice(0, 10);
        return d === _todayStr;
    });
    const ordersToday = todayOrders.length;
    const orderValueToday = todayOrders.reduce(
        (sum: number, o: any) => sum + (Number(o.grandTotal) || 0), 0
    );

    const pendingOrderCount = salesOrdersData.filter((o: any) =>
        ['pending', 'open', 'draft'].includes(String(o.status || '').toLowerCase())
    ).length;

    const lowStockCount = products.filter(p => Number(p.current_stock || 0) < 10).length;
    const lowStockItems = products
        .filter(p => Number(p.current_stock || 0) < 20)
        .sort((a, b) => Number(a.current_stock || 0) - Number(b.current_stock || 0))
        .slice(0, 6);

    const cashCollectedToday = paymentsData.reduce((sum: number, p: any) => {
        const d = String(p.payment_date || p.date || '').slice(0, 10);
        return d === _todayStr ? sum + (Number(p.amount) || 0) : sum;
    }, 0);

    const totalSalesYTD = invoices.reduce((sum, inv) => {
        if (String(inv.status || '').toLowerCase() === 'cancelled') return sum;
        const d = new Date(inv.invoiceDate || inv.createdAt || 0);
        if (d.getFullYear() !== _curYear) return sum;
        return sum + (Number(inv.grandTotal) || 0);
    }, 0);

    const totalOrderCount = invoices.length;
    const avgOrderValue = totalOrderCount > 0
        ? invoices.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0) / totalOrderCount
        : 0;

    const collectedYTD = paymentsData.reduce((sum: number, p: any) => {
        const d = p.payment_date ?? p.date ?? p.createdAt;
        if (!d) return sum;
        try {
            if (new Date(d).getFullYear() === _curYear) return sum + (Number(p.amount) || 0);
        } catch { /* ignore */ }
        return sum;
    }, 0);

    // Top outstanding customers — grouped from payment-aware receivables
    const topOutstandingCustomers = useMemo(() => {
        const map = new Map<string, { name: string; balance: number; overdue: boolean }>();
        receivables.invoices.forEach(({ invoice: inv, balance, bucket }) => {
            const cid = inv.customerId ? String(inv.customerId) : resolveCustomerName(inv as Invoice);
            const name = resolveCustomerName(inv as Invoice);
            const key = cid || name;
            const prev = map.get(key) || { name, balance: 0, overdue: false };
            prev.balance += balance;
            if (bucket !== 'current') prev.overdue = true;
            map.set(key, prev);
        });
        return [...map.values()].sort((a, b) => b.balance - a.balance).slice(0, 5);
    }, [receivables, customerNameById]);

    // Top products — aggregate revenue from sales orders / invoice line items
    const topProducts = (() => {
        const pmap: Record<string, number> = {};
        salesOrdersData.forEach((o: any) => {
            const items = o.items ?? o.lineItems ?? [];
            items.forEach((item: any) => {
                const name = item.productName ?? item.name ?? item.product ?? 'Unknown';
                const total = Number(item.total ?? item.amount ?? item.price ?? 0);
                pmap[name] = (pmap[name] ?? 0) + total;
            });
        });
        // Fall back to invoices if sales orders had no line items
        if (Object.keys(pmap).length === 0) {
            invoices.forEach((inv: any) => {
                const items = inv.items ?? inv.lineItems ?? [];
                items.forEach((item: any) => {
                    const name = item.productName ?? item.name ?? item.product ?? 'Unknown';
                    const total = Number(item.total ?? item.amount ?? item.price ?? 0);
                    pmap[name] = (pmap[name] ?? 0) + total;
                });
            });
        }
        return Object.entries(pmap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    })();

    // Sorted payments (newest-first) for the history bar chart
    const sortedPayments = [...paymentsData].sort((a: any, b: any) => {
        return new Date(b.payment_date ?? b.date ?? b.createdAt ?? 0).getTime()
             - new Date(a.payment_date ?? a.date ?? a.createdAt ?? 0).getTime();
    }).slice(0, 5);
    const paymentMaxAmt = sortedPayments.length > 0
        ? Math.max(...sortedPayments.map((p: any) => Number(p.amount) || 0), 1)
        : 1;

    // ── 6-cell stats row data ──────────────────────────────────
    const statCells: Array<{ label: string; value: string; color: string; sub: string }> = [
        {
            label: 'Total Revenue (MTD)',
            value: `$${totalRevenueMTD.toLocaleString()}`,
            color: C.green,
            sub: 'this month',
        },
        {
            label: 'Outstanding AR',
            value: `$${totalOutstanding.toLocaleString()}`,
            color: totalOutstanding > 0 ? C.amber : C.green,
            sub: `${unpaidInvoiceCount} unpaid invoices`,
        },
        {
            label: 'Overdue Amount',
            value: `$${overdueTotal.toLocaleString()}`,
            color: overdueTotal > 0 ? C.red : C.green,
            sub: overdueTotal > 0 ? `${overdueCount} customers` : 'All clear ✓',
        },
        {
            label: 'Orders Today',
            value: String(ordersToday || recentOrders.filter(o => isToday(o.date)).length),
            color: C.blue,
            sub: `$${orderValueToday.toLocaleString()} value`,
        },
        {
            label: 'Low Stock Items',
            value: String(lowStockItems.length || lowStockCount),
            color: (lowStockItems.length || lowStockCount) > 0 ? C.amber : C.green,
            sub: (lowStockItems.length || lowStockCount) > 0 ? 'need reorder' : 'All stocked ✓',
        },
        {
            label: 'Active Customers',
            value: String(customersCount),
            color: C.blue,
            sub: `${newCustomersThisMonth} new this month`,
        },
    ];

    // ── Render ─────────────────────────────────────────────────
    return (
        <div style={{ background: C.bg, color: C.t, minHeight: '100%' }}>
            {/* Transient toast */}
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
            <div style={{
                padding: '16px 20px 12px',
                borderBottom: `1px solid ${C.br}`,
                background: C.bg2,
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{
                            fontSize: 22, fontWeight: 700, color: C.t,
                            display: 'flex', alignItems: 'center', gap: 8, margin: 0,
                        }}>
                            <span aria-hidden>📊</span> Dashboard Overview
                        </h1>
                        <p style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>
                            Revenue · Collections · Stock · Van operations · AI alerts
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
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <button
                            onClick={() => void handleRefresh()}
                            disabled={refreshing}
                            style={{
                                background: 'transparent', border: `1px solid ${C.br}`,
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
                                background: showDateRange ? 'rgba(74,143,245,.12)' : 'transparent',
                                border: `1px solid ${C.br}`,
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
                    margin: '12px 18px 0',
                    background: C.bg3,
                    border: '1px solid rgba(74,143,245,.25)',
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12,
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>From</label>
                        <input type="date" value={dashFrom} onChange={e => setDashFrom(e.target.value)}
                            style={{ background: C.bg4, color: C.t, border: `1px solid ${C.br}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>To</label>
                        <input type="date" value={dashTo} onChange={e => setDashTo(e.target.value)}
                            style={{ background: C.bg4, color: C.t, border: `1px solid ${C.br}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <button onClick={() => { setDashFrom(''); setDashTo(''); }}
                        style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${C.br}`, borderRadius: 6, fontSize: 10, color: C.t2, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'inherit' }}>Clear</button>
                    <button onClick={() => { setShowDateRange(false); flashToast('Date range applied to charts.'); }}
                        style={{ padding: '6px 14px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'inherit' }}>Apply</button>
                    <button onClick={() => setShowDateRange(false)}
                        aria-label="Close date range picker"
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.t2, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                        <X size={12} />
                    </button>
                </div>
            )}

            {/* ── 6-cell stats row (borderless, edge-to-edge per HTML mockup) ── */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(3,1fr)' : 'repeat(6,1fr)',
                borderBottom: `1px solid ${C.br}`,
                background: C.bg2,
            }}>
                {statCells.map((cell, i) => (
                    <div
                        key={cell.label}
                        style={{
                            padding: '12px 14px',
                            borderRight: !isMobile && i < statCells.length - 1 ? `1px solid ${C.br}` : 'none',
                            borderBottom: isMobile && i < statCells.length - 1 ? `1px solid ${C.br}` : undefined,
                        }}
                    >
                        <div style={{
                            fontSize: 9, color: C.t3, fontWeight: 700,
                            letterSpacing: '.5px', marginBottom: 4, textTransform: 'uppercase',
                        }}>
                            {cell.label}
                        </div>
                        <div style={{
                            fontSize: 18, fontWeight: 700, lineHeight: 1,
                            marginBottom: 2, color: cell.color,
                        }}>
                            {cell.value}
                        </div>
                        <div style={{ fontSize: 10, color: C.t2 }}>{cell.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Main content area ── */}
            <div style={{ padding: '14px 18px' }}>

                {/* ─── ROW 1 — 3-col (Business summary, Top outstanding, Recent activity) ─── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : '1fr 1fr 1fr',
                    gap: 10,
                    marginBottom: 10,
                }}>
                    {/* Col 1 — Business summary */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>📋 Business summary</span>
                            <span style={{ fontSize: 10, color: C.t2 }}>live</span>
                        </div>
                        {[
                            { label: 'Revenue this month',   value: `$${totalRevenueMTD.toLocaleString()}`,    color: C.green },
                            { label: 'Total outstanding AR', value: `$${totalOutstanding.toLocaleString()}`,   color: C.amber },
                            { label: 'Cash collected today', value: `$${cashCollectedToday.toLocaleString()}`, color: C.green },
                            { label: 'Pending orders',       value: String(pendingOrderCount),                  color: C.blue  },
                            { label: 'Active customers',     value: String(customersCount),                     color: C.blue  },
                            { label: 'Low stock alerts',     value: String(lowStockItems.length),               color: lowStockItems.length > 0 ? C.amber : C.green },
                            { label: 'Overdue invoices',     value: String(overdueCount),                       color: overdueCount > 0 ? C.red : C.green },
                            { label: 'Van routes today',     value: String(vansData.length),                    color: C.blue  },
                        ].map((row, i, arr) => (
                            <div key={row.label} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '6px 0',
                                borderBottom: i < arr.length - 1 ? `1px solid ${C.bd2}` : 'none',
                                fontSize: 11,
                            }}>
                                <span style={{ color: C.t1 }}>{row.label}</span>
                                <span style={{ color: row.color, fontWeight: 500 }}>{row.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Col 2 — Top outstanding customers */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>🔴 Top outstanding — AR</span>
                            <span style={{ fontSize: 10, color: C.t2 }}>by balance</span>
                        </div>
                        {topOutstandingCustomers.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                No outstanding balances ✓
                            </div>
                        ) : topOutstandingCustomers.map((c, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '7px 0',
                                borderBottom: i < topOutstandingCustomers.length - 1 ? `1px solid ${C.bd2}` : 'none',
                                fontSize: 11, cursor: 'pointer',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        width: 24, height: 24, borderRadius: '50%',
                                        background: i === 0 ? 'rgba(239,68,68,.15)' : 'rgba(74,143,245,.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 9, fontWeight: 700,
                                        color: i === 0 ? C.red : C.blue,
                                        flexShrink: 0,
                                    }}>
                                        {c.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span style={{
                                        color: C.t, fontWeight: 500,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        minWidth: 0,
                                    }}>
                                        {c.name}
                                    </span>
                                    {c.overdue && (
                                        <span style={{
                                            fontSize: 9, padding: '1px 5px', borderRadius: 6,
                                            background: 'rgba(239,68,68,.12)', color: C.red,
                                            fontWeight: 600, flexShrink: 0,
                                        }}>
                                            Overdue
                                        </span>
                                    )}
                                </div>
                                <span style={{ color: c.overdue ? C.red : C.amber, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                                    ${c.balance.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Col 3 — Recent activity */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>⚡ Recent activity</span>
                            <span style={{ fontSize: 10, color: C.t2 }}>last 30 days</span>
                        </div>
                        {(() => {
                            const items = [
                                ...paymentsData.slice(0, 3).map((p: any) => ({
                                    icon: '💵', bg: 'rgba(34,197,94,.1)',
                                    text: `Payment received — $${Number(p.amount ?? 0).toFixed(2)}`,
                                    sub: `${p.reference ?? p.id ?? ''} · ${_fmtDate(p.payment_date ?? p.date ?? p.createdAt)}`,
                                })),
                                ...recentOrders.slice(0, 2).map((o) => ({
                                    icon: '🛒', bg: 'rgba(74,143,245,.1)',
                                    text: `Order — ${o.customerName} $${o.amount.toFixed(2)}`,
                                    sub: `${o.reference} · ${_fmtDate(o.date)}`,
                                })),
                            ].slice(0, 5);
                            if (items.length === 0) {
                                return (
                                    <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                        No recent activity
                                    </div>
                                );
                            }
                            return items.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                    padding: '7px 0',
                                    borderBottom: i < items.length - 1 ? `1px solid ${C.bd2}` : 'none',
                                    fontSize: 11,
                                }}>
                                    <div style={{
                                        width: 26, height: 26, borderRadius: 7, background: item.bg, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                                    }}>
                                        {item.icon}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ color: C.t, lineHeight: 1.4, marginBottom: 1 }}>{item.text}</div>
                                        <div style={{ fontSize: 10, color: C.t2 }}>{item.sub}</div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* ─── ROW 2 — 2-col (Revenue trend + Open invoices) ─── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 10, marginBottom: 10,
                }}>
                    {/* Col 1 — Revenue trend (CSS bars) */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>
                                📈 Revenue trend — last {chartRange === '3m' ? '3' : chartRange === '6m' ? '6' : chartRange === '1y' ? '12' : `${_now.getMonth() + 1}`} months
                            </span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {(['3m', '6m', 'ytd', '1y'] as const).map(r => {
                                    const active = chartRange === r;
                                    return (
                                        <button
                                            key={r}
                                            onClick={() => setChartRange(r)}
                                            style={{
                                                padding: '3px 7px', borderRadius: 5,
                                                fontSize: 9, fontWeight: 600,
                                                background: active ? C.blue : 'transparent',
                                                color: active ? '#fff' : C.t3,
                                                border: `1px solid ${C.br}`,
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
                        {(() => {
                            const months = monthlyPerformanceData.slice(-6);
                            const maxVal = Math.max(...months.map(m => Number(m.revenue) || 0), 1);
                            return (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginBottom: 4 }}>
                                        {months.length > 0 ? months.map((m, i) => {
                                            const val = Number(m.revenue) || 0;
                                            const pct = Math.max(8, Math.round((val / maxVal) * 100));
                                            const isLatest = i === months.length - 1;
                                            return (
                                                <div key={i} style={{
                                                    flex: 1, display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', gap: 2, height: '100%',
                                                }}>
                                                    <div style={{
                                                        width: '100%', height: `${pct}%`,
                                                        background: isLatest ? C.green : C.blue,
                                                        opacity: isLatest ? 1 : 0.45 + i * 0.1,
                                                        borderRadius: '2px 2px 0 0',
                                                        alignSelf: 'flex-end',
                                                        transition: 'opacity .2s',
                                                    }} />
                                                    <div style={{ fontSize: 8, color: C.t2 }}>
                                                        {m.month}{isLatest ? ' ↑' : ''}
                                                    </div>
                                                </div>
                                            );
                                        }) : ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May ↑'].map((lbl, i) => (
                                            <div key={i} style={{
                                                flex: 1, display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', gap: 2, height: '100%',
                                            }}>
                                                <div style={{
                                                    width: '100%', alignSelf: 'flex-end',
                                                    borderRadius: '2px 2px 0 0',
                                                    height: `${[35, 44, 56, 50, 74, 90][i]}%`,
                                                    background: i === 5 ? C.green : C.blue,
                                                    opacity: i === 5 ? 1 : 0.45 + i * 0.1,
                                                }} />
                                                <div style={{ fontSize: 8, color: C.t2 }}>{lbl}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 3 mini stats below chart */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
                                        {[
                                            { val: `$${totalSalesYTD.toLocaleString()}`, lbl: 'YTD revenue', color: C.green },
                                            { val: String(totalOrderCount),               lbl: 'Orders',     color: C.blue },
                                            { val: `$${avgOrderValue.toFixed(0)}`,        lbl: 'Avg order',  color: C.purple },
                                        ].map(s => (
                                            <div key={s.lbl} style={{
                                                background: C.bg4, borderRadius: 8, padding: 8,
                                                textAlign: 'center', border: `1px solid ${C.bd2}`,
                                            }}>
                                                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1, marginBottom: 1, color: s.color }}>
                                                    {s.val}
                                                </div>
                                                <div style={{ fontSize: 9, color: C.t2 }}>{s.lbl}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* Col 2 — Open invoices */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: `1px solid ${C.br}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>🧾 Open invoices</span>
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
                                        {['Invoice', 'Customer', 'Amount', 'Due', 'Status'].map(h => (
                                            <th key={h} style={{
                                                fontSize: 10, color: C.t2, fontWeight: 700,
                                                letterSpacing: '.5px', padding: '8px 10px',
                                                borderBottom: `1px solid ${C.br}`,
                                                textAlign: 'left', textTransform: 'uppercase',
                                                background: C.bg2,
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {receivables.invoices.length === 0 ? (
                                        <tr><td colSpan={5} style={{ padding: '32px 10px', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                            No open invoices ✓
                                        </td></tr>
                                    ) : receivables.invoices.slice(0, 6).map((row, i: number) => {
                                        const inv = row.invoice as Invoice;
                                        const isOverdue = row.bucket !== 'current';
                                        return (
                                            <tr
                                                key={i}
                                                onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                                                onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <td style={{ fontSize: 11, color: C.blue, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace' }}>
                                                    {inv.invoiceNumber ?? inv.id ?? '—'}
                                                </td>
                                                <td style={{ fontSize: 11, color: C.t, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
                                                    {resolveCustomerName(inv)}
                                                </td>
                                                <td style={{ fontSize: 11, color: C.t, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace' }}>
                                                    ${row.balance.toFixed(2)}
                                                </td>
                                                <td style={{ fontSize: 11, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, color: isOverdue ? C.red : C.amber }}>
                                                    {_fmtDate(inv.dueDate ?? (inv as any).due_date ?? inv.invoiceDate)}
                                                    {isOverdue ? ' ⚠' : ''}
                                                </td>
                                                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                                                    <span style={{
                                                        fontSize: 9, padding: '2px 7px', borderRadius: 8,
                                                        fontWeight: 600, whiteSpace: 'nowrap',
                                                        background: isOverdue ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                                                        color: isOverdue ? '#B91C1C' : '#B45309',
                                                    }}>
                                                        {isOverdue ? 'Overdue' : 'Pending'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ─── ROW 3 — 2-col (Payment history + Top products + Marcus AI) ─── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 10, marginBottom: 10,
                }}>
                    {/* Col 1 — Payment history bars */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>💰 Payment history</span>
                            <span style={{ fontSize: 10, color: C.t2 }}>last 5 payments</span>
                        </div>
                        {sortedPayments.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                No payments yet
                            </div>
                        ) : sortedPayments.map((p: any, i: number) => {
                            const amt = Number(p.amount) || 0;
                            const pct = Math.round((amt / paymentMaxAmt) * 100);
                            const dateStr = p.payment_date ?? p.date ?? p.createdAt;
                            const label = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 0',
                                    borderBottom: i < sortedPayments.length - 1 ? `1px solid ${C.bd2}` : 'none',
                                    fontSize: 11,
                                }}>
                                    <span style={{ width: 56, color: C.t1, flexShrink: 0, fontSize: 10 }}>{label}</span>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 4, height: 6 }}>
                                        <div style={{
                                            height: 6, borderRadius: 4, width: `${pct}%`,
                                            background: i === 0 ? C.green : C.blue,
                                        }} />
                                    </div>
                                    <span style={{ color: i === 0 ? C.green : C.blue, fontWeight: 600, width: 76, textAlign: 'right' }}>
                                        ${amt.toLocaleString()}
                                    </span>
                                </div>
                            );
                        })}
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.bd2}`,
                        }}>
                            <span style={{ fontSize: 11, color: C.t1 }}>Total collected YTD</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                                ${collectedYTD.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Col 2 — Top products + Marcus AI alerts */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>📦 Top products sold</span>
                            <span style={{ fontSize: 10, color: C.t2 }}>by revenue</span>
                        </div>
                        {(() => {
                            const colours = [C.green, C.blue, C.amber, C.purple];
                            if (topProducts.length === 0) {
                                return (
                                    <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                        No sales data yet
                                    </div>
                                );
                            }
                            const list = (() => {
                                const maxVal = topProducts[0][1] || 1;
                                return topProducts.map(([name, val], i) => ({
                                    name, val, pct: Math.round((val / maxVal) * 100), color: colours[i],
                                }));
                            })();
                            return list.map((p, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 0',
                                    borderBottom: i < list.length - 1 ? `1px solid ${C.bd2}` : 'none',
                                    fontSize: 11,
                                }}>
                                    <span style={{
                                        width: 110, color: C.t1, fontSize: 10,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {p.name}
                                    </span>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 3, height: 5 }}>
                                        <div style={{
                                            height: 5, borderRadius: 3,
                                            width: `${p.pct}%`, background: p.color,
                                        }} />
                                    </div>
                                    <span style={{ color: p.color, fontWeight: 600, width: 68, textAlign: 'right' }}>
                                        ${p.val.toLocaleString()}
                                    </span>
                                </div>
                            ));
                        })()}

                        {/* Marcus AI alerts — real dashboard counts only */}
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: C.t,
                                marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                                ✦ Marcus AI alerts
                            </div>
                            {(() => {
                                const alerts = [
                                    ...(unpaidInvoiceCount > 0 || overdueCount > 0
                                        ? [{
                                            bg: 'rgba(239,68,68,.07)',
                                            bd: 'rgba(239,68,68,.2)',
                                            text: `${unpaidInvoiceCount} unpaid invoice${unpaidInvoiceCount === 1 ? '' : 's'} totalling $${totalOutstanding.toLocaleString()} — ${overdueCount} overdue.`,
                                        }]
                                        : []),
                                    ...(vansData.length > 0 || cashCollectedToday > 0
                                        ? [{
                                            bg: 'rgba(74,143,245,.07)',
                                            bd: 'rgba(74,143,245,.2)',
                                            text: `${vansData.length} van${vansData.length === 1 ? '' : 's'} active today. Cash collected: $${cashCollectedToday.toLocaleString()}.`,
                                        }]
                                        : []),
                                ];
                                if (alerts.length === 0) {
                                    return (
                                        <div style={{
                                            background: 'rgba(255,255,255,.04)', border: `1px solid ${C.bd2}`, borderRadius: 8,
                                            padding: '7px 10px', fontSize: 10, color: C.t1, lineHeight: 1.5,
                                        }}>
                                            —
                                        </div>
                                    );
                                }
                                return alerts.map((a, i) => (
                                    <div key={i} style={{
                                        background: a.bg, border: `1px solid ${a.bd}`, borderRadius: 8,
                                        padding: '7px 10px', fontSize: 10, color: C.t1, lineHeight: 1.5,
                                    }}>
                                        {a.text}
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                </div>

                {/* ─── ROW 4 — 2-col (Van ops + Low stock) ─── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                    gap: 10,
                }}>
                    {/* Col 1 — Van operations */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>🚛 Van operations</span>
                            <span style={{ fontSize: 10, color: C.t2 }}>today</span>
                        </div>
                        {vansData.length === 0 ? (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                No vans on route
                            </div>
                        ) : vansData.slice(0, 4).map((van: any, i: number) => {
                            const status = String(van.status || '').toLowerCase();
                            const isOnRoute = status === 'active' || status === 'on_route';
                            const shown = Math.min(vansData.length, 4);
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '8px 0',
                                    borderBottom: i < shown - 1 ? `1px solid ${C.bd2}` : 'none',
                                    fontSize: 11,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                            background: isOnRoute ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 13,
                                        }}>
                                            🚛
                                        </div>
                                        <div>
                                            <div style={{ color: C.t, fontWeight: 500, marginBottom: 1 }}>
                                                {van.driver?.name ?? van.driverName ?? van.name ?? `Van ${i + 1}`}
                                            </div>
                                            <div style={{ fontSize: 10, color: C.t2 }}>
                                                {van.completedStops ?? van.stopsCompleted ?? 0}/{van.totalStops ?? 0} stops ·
                                                {' '}${Number(van.collectedAmount ?? van.collected ?? 0).toFixed(2)} collected
                                            </div>
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 8,
                                        background: isOnRoute ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                                        color: isOnRoute ? '#16A34A' : '#B45309',
                                    }}>
                                        {isOnRoute ? '● On route' : '● At depot'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Col 2 — Low stock alerts */}
                    <div style={{ background: C.bg3, border: `1px solid ${C.br}`, borderRadius: 12, padding: 0, overflow: 'hidden' }}>
                        <div style={{
                            padding: '12px 14px',
                            borderBottom: `1px solid ${C.br}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.t }}>📦 Low stock alerts</span>
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
                                        {['Product', 'Stock', 'Min', 'Status'].map(h => (
                                            <th key={h} style={{
                                                fontSize: 10, color: C.t2, fontWeight: 700,
                                                letterSpacing: '.5px', padding: '8px 10px',
                                                borderBottom: `1px solid ${C.br}`,
                                                textAlign: 'left', textTransform: 'uppercase',
                                                background: C.bg2,
                                            }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowStockItems.length === 0 ? (
                                        <tr><td colSpan={4} style={{ padding: '32px 10px', textAlign: 'center', color: C.t2, fontSize: 11 }}>
                                            All stocked ✓
                                        </td></tr>
                                    ) : lowStockItems.slice(0, 6).map((item: any, i: number) => {
                                        const qty = Number(item.current_stock ?? item.quantity ?? item.stock ?? 0);
                                        const min = Number((item as any).reorder_point ?? (item as any).minimumStock ?? (item as any).minStock ?? 10);
                                        const isCritical = qty <= Math.floor(min * 0.5);
                                        return (
                                            <tr
                                                key={i}
                                                onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                                                onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <td style={{ fontSize: 11, color: C.t, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                                                    {item.name ?? item.productName ?? '—'}
                                                </td>
                                                <td style={{
                                                    fontSize: 11, padding: '8px 10px',
                                                    borderBottom: `1px solid ${C.bd2}`,
                                                    color: isCritical ? C.red : C.amber,
                                                    fontWeight: 600, fontFamily: 'monospace',
                                                }}>
                                                    {qty}
                                                </td>
                                                <td style={{ fontSize: 11, color: C.t2, padding: '8px 10px', borderBottom: `1px solid ${C.bd2}`, fontFamily: 'monospace' }}>
                                                    {min}
                                                </td>
                                                <td style={{ padding: '8px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                                                    <span style={{
                                                        fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 600,
                                                        background: isCritical ? 'rgba(239,68,68,.12)' : 'rgba(245,158,11,.12)',
                                                        color: isCritical ? '#B91C1C' : '#B45309',
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
                </div>
            </div>
        </div>
    );
}
