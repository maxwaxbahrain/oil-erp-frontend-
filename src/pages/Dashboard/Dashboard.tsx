import {
    ShoppingCart,
    Wallet,
    TrendingUp,
    AlertTriangle,
    MoreVertical,
    RefreshCw,
    Download,
    Calendar,
    Sliders,
    X,
    Users,
    UserPlus,
    Truck,
    Package,
    Sparkles,
    ChevronDown,
    Lock,
    Unlock,
    ListChecks,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getCustomers, getInvoices, getProducts, getSalesOrders, getVans, getPayments, type Invoice, type Product } from '../../services/api';
import { getPurchaseOrders } from '../../services/purchasesService';
// TC-02 — Dashboard Options dropdown.
import autoTable from 'jspdf-autotable';
import { generateStandardPDF } from '../../utils/documentGenerator';
import { formatCurrency } from '../../services/settingsService';
import { useEscape } from '../../hooks/useEscape';

// ── KPI sparkline data — static, hardcoded.  Matches the spec from
// public/preview.html.  These are NOT real metrics — they're a
// 7-point trend silhouette under each KPI tile so the card hints
// at directional momentum without committing to per-card history
// queries (which would require new backend work).
const SPARKLINE_DATA = {
    income:   [62, 68, 71, 75, 77, 78, 82],
    ar:       [380, 390, 400, 408, 410, 412, 411],
    ap:       [41, 44, 47, 51, 50, 52, 52],
    total:    [320, 355, 375, 390, 400, 408, 412],
    lowstock: [8, 14, 19, 24, 28, 35, 40],
} as const;
type SparkKey = keyof typeof SPARKLINE_DATA;

// ── Prediction-chip palette.  Three semantic variants:
//   teal  = on-track / positive
//   amber = action-needed / heads-up
//   red   = critical / warn
const PREDICTION_PALETTE = {
    teal:  { bg: 'rgba(0,212,170,0.10)', color: '#5EEAD4', border: 'rgba(0,212,170,0.2)' },
    amber: { bg: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: 'rgba(245,158,11,0.2)' },
    red:   { bg: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: 'rgba(239,68,68,0.2)' },
} as const;
type PredictionVariant = keyof typeof PREDICTION_PALETTE;

// ── Inline SVG sparkline — single polyline, no fill.  preserveAspectRatio
// "none" lets the line stretch horizontally to the card width.
function Sparkline({ data, color }: { data: readonly number[]; color: string }) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 100, h = 32;
    const pts = data
        .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
        .join(' ');
    return (
        <svg
            width="100%"
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="mt-2 block"
            aria-hidden="true"
        >
            <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
        </svg>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesOrdersCount, setSalesOrdersCount] = useState(0);
    const [vansCount, setVansCount] = useState(0);
    const [customersCount, setCustomersCount] = useState(0);
    const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
    const [, setDataError] = useState(false);
    const [aiContext, setAiContext] = useState({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [], vans: [] } as any);
    // TC-02 — Options dropdown state.
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [showDateRange, setShowDateRange] = useState(false);
    const [dashFrom, setDashFrom] = useState<string>('');
    const [dashTo, setDashTo] = useState<string>('');
    const [chartRange, setChartRange] = useState<'3m' | '6m' | 'ytd' | '1y'>('3m');
    const optionsRef = useRef<HTMLDivElement>(null);

    // AI Business Insights collapsible panel (between KPIs and Charts row).
    // Static text per spec — no live AI call here; CTA opens the existing
    // advisor via the `soltol:open-ai-advisor` event (see askAI).
    const [aiOpen, setAiOpen] = useState(false);

    // Today's Checklist — local UI state only, no persistence.  Tag values
    // 'urgent' | 'critical' | 'low' | null drive the row badge color.
    type ChecklistTag = 'urgent' | 'critical' | 'low' | null;
    type ChecklistItem = { label: string; done: boolean; tag: ChecklistTag };
    const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([
        { label: "Post yesterday's invoices",         done: true,  tag: null },
        { label: 'Reconcile bank payments',            done: false, tag: 'urgent' },
        { label: 'Chase Qahir — $3,875 overdue 32d',   done: false, tag: 'critical' },
        { label: 'Mobil 5W30 reorder check',           done: false, tag: 'low' },
        { label: 'Review 3 pending approvals',         done: true,  tag: null },
    ]);
    const toggleCheck = (i: number) =>
        setChecklistItems(prev => prev.map((item, idx) => idx === i ? { ...item, done: !item.done } : item));
    const checkLeft = checklistItems.filter(i => !i.done).length;

    // TC-02 — Extracted the data loader so "Refresh Data" can call it
    // from the Options menu and the mount effect can call it once.
    // Returns a Promise so callers can await it and show a spinner.
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
            setAiContext({ invoices: inv, customers, products: prod, payments: pays, purchaseOrders: pos, vans });
            setInvoices(Array.isArray(inv) ? inv : []);
            setProducts(Array.isArray(prod) ? prod : []);
            setSalesOrdersCount(Array.isArray(orders) ? orders.length : 0);
            setVansCount(Array.isArray(vans) ? vans.filter((v) => String(v.status).toLowerCase() === 'active').length : 0);
            const custList = Array.isArray(customers) ? customers : [];
            setCustomersCount(custList.length);

            const now = new Date();
            const thisMonth = custList.filter((c) => {
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

    // TC-02 — Close dropdown on outside click and on Escape.
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!optionsRef.current) return;
            if (!optionsRef.current.contains(e.target as Node)) setOptionsOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);
    useEscape(() => setOptionsOpen(false), optionsOpen);
    useEscape(() => setShowDateRange(false), showDateRange);

    // Transient toast — 2.5s auto-dismiss. Used by Customize and a few others.
    function flashToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    }

    // TC-02 — Refresh Data option.
    async function handleRefresh() {
        setOptionsOpen(false);
        await loadDashboardData();
        flashToast('Dashboard data refreshed.');
    }

    // TC-02 — Export as PDF option. Uses the standard PDF wrapper so the
    // company header + footer match every other PDF in the app.
    function handleExportPDF() {
        setOptionsOpen(false);
        try {
            generateStandardPDF('Dashboard Snapshot', `dashboard-${new Date().toISOString().slice(0, 10)}`, (doc) => {
                let y = 92;
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(80, 80, 80);
                doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y);
                y += 8;
                autoTable(doc, {
                    startY: y,
                    head: [['Metric', 'Value']],
                    body: [
                        ['Total Income', formatCurrency(metrics.totalIncome)],
                        ['Total Expenses', formatCurrency(metrics.totalExpenses)],
                        ['Net Profit', formatCurrency(metrics.netProfit)],
                        ['Unpaid Invoices', formatCurrency(metrics.unpaidAmount)],
                        ['Overdue Count', String(metrics.overdueCount)],
                        ['Low Stock Items (<10)', String(metrics.lowStock)],
                        ['Active Sales Orders', String(salesOrdersCount)],
                        ['Active Vans', String(vansCount)],
                        ['Total Customers', String(customersCount)],
                        ['New Customers (this month)', String(newCustomersThisMonth)],
                        ['Total Products', String(metrics.productCount)],
                    ],
                    headStyles: { fillColor: [128, 0, 32], textColor: 255, fontStyle: 'bold' },
                    columnStyles: { 1: { halign: 'right' } },
                    margin: { left: 14, right: 14 },
                    styles: { fontSize: 10, cellPadding: 4 },
                });
            }, 'report');
        } catch (e: any) {
            flashToast(`PDF failed: ${e?.message || 'try again'}`);
        }
    }

    function handleOpenDateRange() {
        setOptionsOpen(false);
        setShowDateRange(true);
    }

    function handleCustomize() {
        setOptionsOpen(false);
        flashToast('Dashboard customization — coming soon.');
    }

    // Opens the existing AI Business Advisor in the bottom-right via
    // the same window-event AIHub uses.  No pre-fill (would require
    // touching AIAssistant.tsx, out of scope).
    const askAI = useCallback(() => {
        try { window.dispatchEvent(new Event('soltol:open-ai-advisor')); } catch { /* ignore */ }
    }, []);

    // TC-02 — When a date range is set, filter invoices for chart computation.
    // Empty range = no filter (the default behavior).
    const filteredInvoices = useMemo(() => {
        if (!dashFrom && !dashTo) return invoices;
        return invoices.filter(inv => {
            const d = (inv.invoiceDate || inv.createdAt || '').slice(0, 10);
            if (dashFrom && d < dashFrom) return false;
            if (dashTo && d > dashTo) return false;
            return true;
        });
    }, [invoices, dashFrom, dashTo]);

    const metrics = useMemo(() => {
        const validIncomeInvoices = invoices.filter((i) => String(i.status || '').toLowerCase() !== 'cancelled');
        const totalIncome = validIncomeInvoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
        const totalExpenses = 0;
        const netProfit = totalIncome;
        const unpaid = invoices.filter((i) => ['unpaid', 'pending', 'partial', 'overdue'].includes(String(i.status || '').toLowerCase()));
        const unpaidAmount = unpaid.reduce((sum, i) => sum + (Number(i.remaining_balance ?? i.grandTotal) || 0), 0);
        const overdueCount = invoices.filter((i) => String(i.status || '').toLowerCase() === 'overdue').length;
        const lowStock = products.filter((p) => Number(p.current_stock || 0) < 10).length;
        const productCount = products.length;
        return { totalIncome, totalExpenses, netProfit, unpaidAmount, overdueCount, lowStock, productCount };
    }, [invoices, products]);

    // TC-02 — Chart uses filteredInvoices so the Options → Set Date Range
    // affects the monthly performance bars (and only the bars — the KPI
    // tiles still reflect all-time totals so a date filter doesn't make
    // the user think their revenue dropped).
    //
    // chartRange controls how many months back to display (3M / 6M / YTD / 1Y).
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

    // Donut data — top 3 products by stock + an aggregated "Others"
    // bucket.  Each item carries its own colour so the donut and side
    // legend render consistently.
    const inventoryDonutData = useMemo(() => {
        const sorted = products
            .map((p) => ({ name: p.name, value: Number(p.current_stock) || 0 }))
            .filter((x) => x.value > 0)
            .sort((a, b) => b.value - a.value);
        const total = sorted.reduce((sum, x) => sum + x.value, 0);
        if (total === 0) return [];
        const palette = ['#4F8EF7', '#22C55E', '#F59E0B'];
        const top3 = sorted.slice(0, 3).map((item, i) => ({
            name: item.name,
            value: item.value,
            pct: Math.round((item.value / total) * 100),
            color: palette[i],
        }));
        const othersValue = sorted.slice(3).reduce((sum, x) => sum + x.value, 0);
        if (othersValue > 0) {
            top3.push({
                name: 'Others',
                value: othersValue,
                pct: Math.round((othersValue / total) * 100),
                color: '#3E5678',
            });
        }
        return top3;
    }, [products]);

    const recentOrders = useMemo(() => {
        const custMap: Record<string, string> = {};
        (aiContext.customers || []).forEach((c: any) => { custMap[String(c.id)] = c.name; });
        return [...invoices]
            .sort((a, b) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime())
            .slice(0, 8)
            .map((i) => ({
                id: i.invoiceNumber || String(i.id),
                customer: i.customerName || custMap[String(i.customerId)] || custMap[String((i as any).customer_id)] || 'Customer',
                date: i.invoiceDate || i.createdAt?.slice(0, 10) || '—',
                net: Number(i.subtotal) || 0,
                vat: Number(i.taxAmount) || 0,
                amount: Number(i.grandTotal) || 0,
                status: i.status || 'Unpaid',
                // Per spec: payment terms fallback to 'COD'; isOverdue from status.
                // Source fields are optional on the Invoice type — cast for safety.
                terms: (i as any).paymentTerms || (i as any).terms || 'COD',
                isOverdue: String(i.status || '').toLowerCase() === 'overdue',
            }));
    }, [invoices, aiContext.customers]);

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-10">
            {/* TC-02 — Transient toast for Refresh / Customize / errors. */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <span className="text-sm font-bold">{toast}</span>
                    <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white"><X size={14} /></button>
                </div>
            )}

            {/* Header & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Dashboard Overview</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">
                        Real-time performance metrics and insights.
                        {(dashFrom || dashTo) && (
                            <span className="ml-2 text-[11px] text-orange-600 font-black uppercase tracking-widest">
                                · Chart filtered: {dashFrom || '…'} → {dashTo || 'today'}
                                <button onClick={() => { setDashFrom(''); setDashTo(''); flashToast('Date range cleared.'); }} className="ml-2 underline">clear</button>
                            </span>
                        )}
                    </p>
                </div>

                {/* TC-02 — Options dropdown. Refresh / Export PDF / Set Date Range / Customize. */}
                <div ref={optionsRef} className="relative">
                    <button
                        onClick={() => setOptionsOpen(o => !o)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-redwood-bg-surface border border-redwood-border hover:border-redwood-border rounded-xl text-sm font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                        aria-haspopup="menu"
                        aria-expanded={optionsOpen}
                    >
                        <MoreVertical size={16} /> Options
                    </button>
                    {optionsOpen && (
                        <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-redwood-bg-surface border border-redwood-border rounded-xl shadow-2xl py-2 z-40">
                            <button
                                onClick={() => void handleRefresh()}
                                disabled={refreshing}
                                role="menuitem"
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-redwood-text-main hover:bg-white/5 disabled:opacity-50 text-left"
                            >
                                <RefreshCw size={16} className={refreshing ? 'animate-spin text-orange-600' : 'text-orange-600'} />
                                Refresh Data
                            </button>
                            <button
                                onClick={handleExportPDF}
                                role="menuitem"
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-redwood-text-main hover:bg-white/5 text-left"
                            >
                                <Download size={16} className="text-blue-600" />
                                Export as PDF
                            </button>
                            <button
                                onClick={handleOpenDateRange}
                                role="menuitem"
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-redwood-text-main hover:bg-white/5 text-left"
                            >
                                <Calendar size={16} className="text-emerald-600" />
                                Set Date Range
                            </button>
                            <div className="h-px bg-white/10 my-1" />
                            <button
                                onClick={handleCustomize}
                                role="menuitem"
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-redwood-text-main hover:bg-white/5 text-left"
                            >
                                <Sliders size={16} className="text-purple-600" />
                                Customize
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* TC-02 — Inline date range picker, shown when "Set Date Range" is chosen. */}
            {showDateRange && (
                <div className="bg-redwood-bg-surface border-2 border-emerald-200 rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className="text-sm font-black text-redwood-text-main uppercase tracking-widest">Chart Date Range</p>
                            <p className="text-xs text-redwood-text-muted mt-1">Filters the Monthly Performance chart below. KPIs stay at all-time totals.</p>
                        </div>
                        <button onClick={() => setShowDateRange(false)} className="p-2 hover:bg-white/10 rounded-lg text-redwood-text-muted"><X size={16} /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-black text-redwood-text-main uppercase mb-2">From</label>
                            <input type="date" value={dashFrom} onChange={e => setDashFrom(e.target.value)}
                                className="w-full border-2 border-redwood-border rounded-lg px-3 py-3 text-sm font-bold outline-none focus:border-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-redwood-text-main uppercase mb-2">To</label>
                            <input type="date" value={dashTo} onChange={e => setDashTo(e.target.value)}
                                className="w-full border-2 border-redwood-border rounded-lg px-3 py-3 text-sm font-bold outline-none focus:border-emerald-500" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setDashFrom(''); setDashTo(''); }}
                                className="px-4 py-3 bg-white/10 hover:bg-white/15 text-xs font-black uppercase tracking-widest rounded-lg">Clear</button>
                            <button onClick={() => { setShowDateRange(false); flashToast('Date range applied to charts.'); }}
                                className="px-6 py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700">Apply</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Key Metrics Cards — 5 Soltol-themed KPI tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {([
                    {
                        label: 'Total Income',
                        value: `$${metrics.totalIncome.toLocaleString()}`,
                        sub: 'From all invoices',
                        badge: 'MTD',
                        color: '#22C55E',
                        light: '#86EFAC',
                        tint:  'rgba(34,197,94,0.12)',
                        border:'rgba(34,197,94,0.2)',
                        icon: TrendingUp,
                        isWarn: false,
                        spark: 'income' as SparkKey,
                        prediction: { text: '↑ Forecast $490k by May 31', variant: 'teal' as PredictionVariant },
                    },
                    {
                        label: 'AR Outstanding',
                        value: `$${metrics.unpaidAmount.toLocaleString()}`,
                        sub: `${metrics.overdueCount} overdue invoices`,
                        badge: 'Aging',
                        color: '#EF4444',
                        light: '#FCA5A5',
                        tint:  'rgba(239,68,68,0.12)',
                        border:'rgba(239,68,68,0.2)',
                        icon: AlertTriangle,
                        isWarn: true,
                        spark: 'ar' as SparkKey,
                        prediction: { text: '⚠ Chase Qahir today — 32d overdue', variant: 'red' as PredictionVariant },
                    },
                    {
                        label: 'Active Orders',
                        value: String(salesOrdersCount),
                        sub: 'Sales orders open',
                        badge: 'Open',
                        color: '#F59E0B',
                        light: '#FCD34D',
                        tint:  'rgba(245,158,11,0.12)',
                        border:'rgba(245,158,11,0.2)',
                        icon: ShoppingCart,
                        isWarn: false,
                        spark: 'ap' as SparkKey,
                        prediction: { text: '+ Schedule $18k payment run Friday', variant: 'amber' as PredictionVariant },
                    },
                    {
                        label: 'Net Profit',
                        value: `$${metrics.netProfit.toLocaleString()}`,
                        sub: 'Income − Expenses',
                        badge: 'MTD',
                        color: '#4F8EF7',
                        light: '#93C5FD',
                        tint:  'rgba(79,142,247,0.14)',
                        border:'rgba(79,142,247,0.28)',
                        icon: Wallet,
                        isWarn: false,
                        spark: 'total' as SparkKey,
                        prediction: { text: '↑ On track for $88k by month-end', variant: 'teal' as PredictionVariant },
                    },
                    {
                        label: 'Low Stock Alerts',
                        value: String(metrics.lowStock),
                        sub: 'Below reorder point',
                        badge: 'Critical',
                        color: '#00D4AA',
                        light: '#5EEAD4',
                        tint:  'rgba(0,212,170,0.10)',
                        border:'rgba(0,212,170,0.2)',
                        icon: AlertTriangle,
                        isWarn: metrics.lowStock > 0,
                        spark: 'lowstock' as SparkKey,
                        prediction: { text: '⚠ Expired batch in quarantine — D1', variant: 'red' as PredictionVariant },
                    },
                ] as const).map((k, i) => {
                    const Icon = k.icon;
                    return (
                        <div
                            key={i}
                            className="relative overflow-hidden bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-[14px] py-[13px] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)] hover:border-white/20"
                        >
                            {/* Top accent gradient stripe */}
                            <div
                                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[14px]"
                                style={{ background: `linear-gradient(90deg, ${k.color}, ${k.light})` }}
                            />

                            {/* Label row + status badge */}
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-redwood-text-muted">
                                    <Icon size={13} style={{ color: k.color }} />
                                    {k.label}
                                </div>
                                <span
                                    className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full"
                                    style={{
                                        background: k.tint,
                                        color: k.light,
                                        border: `1px solid ${k.border}`,
                                    }}
                                >
                                    {k.badge}
                                </span>
                            </div>

                            {/* Big value — Syne font, color-tinted */}
                            <div
                                className="text-[22px] font-semibold leading-[1.1] tracking-[-0.5px] mb-[3px]"
                                style={{ fontFamily: "'Syne', sans-serif", color: k.color }}
                            >
                                {k.value}
                            </div>

                            {/* Sub-label */}
                            <div
                                className="text-[10px] flex items-center gap-1"
                                style={{ color: k.isWarn ? '#FCA5A5' : '#3E5678' }}
                            >
                                {k.sub}
                            </div>

                            {/* Sparkline — 7-point trend silhouette */}
                            <Sparkline data={SPARKLINE_DATA[k.spark]} color={k.color} />

                            {/* Prediction chip */}
                            <div
                                className="text-[9px] mt-1 px-2 py-[2px] rounded-full inline-flex items-center"
                                style={{
                                    background: PREDICTION_PALETTE[k.prediction.variant].bg,
                                    color:      PREDICTION_PALETTE[k.prediction.variant].color,
                                    border:     `1px solid ${PREDICTION_PALETTE[k.prediction.variant].border}`,
                                }}
                            >
                                {k.prediction.text}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* AI Business Insights — collapsible.  Static copy (spec).
                Click header or chevron to expand; teaser always shows
                a one-line summary so the panel is useful when closed. */}
            <div className="bg-redwood-bg-surface border border-[rgba(79,142,247,0.28)] rounded-[14px] overflow-hidden">
                <div
                    onClick={() => setAiOpen(v => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAiOpen(v => !v); } }}
                    aria-expanded={aiOpen}
                    className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none hover:bg-white/5"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#4F8EF7]" aria-hidden="true" />
                        <span className="text-[12px] font-semibold text-redwood-text-main">AI Business Insights</span>
                        <span className="text-[10px] text-redwood-text-muted">Powered by Claude</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-[#22C55E] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.2)] rounded-full px-2 py-[2px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse inline-block" />
                            Live
                        </span>
                        <span className="text-[10px] text-redwood-text-muted inline-flex items-center gap-1">
                            {aiOpen ? 'Collapse' : 'Expand'}
                            <ChevronDown
                                size={12}
                                style={{ transform: aiOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
                            />
                        </span>
                    </div>
                </div>

                {/* Teaser — visible only when collapsed */}
                {!aiOpen && (
                    <div className="px-4 pb-2.5 text-[11px] text-redwood-text-muted border-t border-redwood-border">
                        ⬛ Today: <strong className="text-redwood-text-main">Qahir</strong> $3,875 overdue 32d ·{' '}
                        <strong className="text-redwood-text-main">AP $18k</strong> due Friday · Income on track for $490k ·{' '}
                        <button
                            onClick={(e) => { e.stopPropagation(); setAiOpen(true); }}
                            className="text-[#4F8EF7] underline ml-1 hover:no-underline"
                        >
                            Expand for full AI insights →
                        </button>
                    </div>
                )}

                {/* Full content — visible only when expanded */}
                {aiOpen && (
                    <div className="px-4 py-3 text-[12px] text-redwood-text-muted leading-[1.8] border-t border-redwood-border">
                        <span style={{ color: '#FCA5A5', fontWeight: 500 }}>⚠ Critical:</span>{' '}
                        <strong className="text-redwood-text-main">Qahir Enterprises</strong> is 32d overdue —{' '}
                        <strong className="text-redwood-text-main">$3,875</strong> at risk. Stop credit immediately and issue demand letter today. ·{' '}
                        <span style={{ color: '#FCD34D', fontWeight: 500 }}>Cash alert:</span>{' '}
                        <strong className="text-redwood-text-main">$52,300</strong> AP outstanding with{' '}
                        <strong className="text-redwood-text-main">$18k</strong> due in 7 days. ·{' '}
                        <span style={{ color: '#86EFAC', fontWeight: 500 }}>✓ Strong month:</span>{' '}
                        MTD income <strong className="text-redwood-text-main">$411,832</strong> on track for projected{' '}
                        <strong className="text-redwood-text-main">$490k</strong>.
                    </div>
                )}
            </div>

            {/* 2. Charts Row — Soltol two-panel design */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-[10px]">
                {/* Financial Performance — left, wider */}
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="text-[13px] font-semibold text-redwood-text-main">Financial Performance</div>
                            <div className="text-[10px] text-redwood-text-muted">Sales vs Expenses</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="flex bg-[#142540] rounded-md overflow-hidden border border-redwood-border">
                                {(['3m', '6m', 'ytd', '1y'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setChartRange(r)}
                                        className={`px-[9px] py-1 text-[10px] font-medium transition-colors ${
                                            chartRange === r
                                                ? 'bg-[#4F8EF7] text-white'
                                                : 'bg-transparent text-redwood-text-muted hover:text-redwood-text-main'
                                        }`}
                                    >
                                        {r === 'ytd' ? 'YTD' : r.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <button onClick={askAI} className="text-[10px] text-[#4F8EF7] hover:underline">
                                Ask AI →
                            </button>
                        </div>
                    </div>
                    <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyPerformanceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8BA3C7' }} stroke="rgba(255,255,255,0.12)" />
                                <YAxis tick={{ fontSize: 11, fill: '#8BA3C7' }} stroke="rgba(255,255,255,0.12)" />
                                <Tooltip contentStyle={{ backgroundColor: '#0f1f33', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#EEF2FF' }} />
                                <Bar dataKey="sales" name="Total Sales" fill="#4F8EF7" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expenses" name="Total Expenses" fill="rgba(79,142,247,0.3)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex gap-[14px] mt-2">
                        <div className="flex items-center gap-[5px] text-[10px] text-redwood-text-muted">
                            <div className="w-2 h-2 rounded-sm" style={{ background: '#4F8EF7' }} />
                            Total Sales
                        </div>
                        <div className="flex items-center gap-[5px] text-[10px] text-redwood-text-muted">
                            <div className="w-2 h-2 rounded-sm" style={{ background: 'rgba(79,142,247,0.3)' }} />
                            Total Expenses
                        </div>
                    </div>
                </div>

                {/* Inventory Distribution — right, donut + side legend */}
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="text-[13px] font-semibold text-redwood-text-main">Inventory Distribution</div>
                            <div className="text-[10px] text-redwood-text-muted">Stock by product line</div>
                        </div>
                        <button onClick={askAI} className="text-[10px] text-[#4F8EF7] hover:underline">
                            Ask AI →
                        </button>
                    </div>
                    <div className="flex items-center gap-[14px] mt-2">
                        <div className="w-[100px] h-[100px] flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={inventoryDonutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={32}
                                        outerRadius={50}
                                        paddingAngle={2}
                                        dataKey="value"
                                        isAnimationActive={false}
                                    >
                                        {inventoryDonutData.map((d, i) => (
                                            <Cell key={`cell-${i}`} fill={d.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f1f33', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#EEF2FF' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-[7px] flex-1 min-w-0">
                            {inventoryDonutData.length === 0 ? (
                                <div className="text-[10px] text-redwood-text-muted">No inventory data</div>
                            ) : (
                                inventoryDonutData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-[7px]">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                                        <span className="text-[10px] text-redwood-text-muted flex-1 truncate">{d.name}</span>
                                        <span className="text-[10px] font-semibold" style={{ color: d.color }}>{d.pct}%</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Bottom Row — Recent Invoices + Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-[10px]">
                {/* Recent Invoices — compact dark table */}
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="text-[13px] font-semibold text-redwood-text-main">Recent Invoices</div>
                            <div className="text-[10px] text-redwood-text-muted">Latest activity · click a row for detail</div>
                        </div>
                        <button
                            onClick={() => navigate('/sales/invoices')}
                            className="text-[10px] text-[#4F8EF7] hover:underline"
                        >
                            View all →
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[11px]">
                            <thead>
                                <tr>
                                    <th className="text-left text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Invoice #</th>
                                    <th className="text-left text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Customer</th>
                                    <th className="text-left text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Date</th>
                                    <th className="text-left text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Terms</th>
                                    <th className="text-right text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Net</th>
                                    <th className="text-right text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">VAT 15%</th>
                                    <th className="text-right text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Total</th>
                                    <th className="text-center text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Lock</th>
                                    <th className="text-left text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Tax Reg</th>
                                    <th className="text-left text-[9.5px] font-semibold uppercase tracking-[0.05em] text-redwood-text-muted border-b border-redwood-border px-2.5 py-1.5 whitespace-nowrap">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center text-[11px] text-redwood-text-muted px-2.5 py-6">No recent invoices</td></tr>
                                ) : recentOrders.map((order) => {
                                    const s = String(order.status).toLowerCase();
                                    const pill =
                                        s === 'paid' || s === 'completed' ?
                                            { bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.2)' } :
                                        s === 'overdue' ?
                                            { bg: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: 'rgba(239,68,68,0.2)' } :
                                            { bg: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: 'rgba(245,158,11,0.2)' };
                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => navigate(`/sales/invoices/${order.id}`)}
                                            className="cursor-pointer transition-colors hover:bg-[rgba(79,142,247,0.07)]"
                                        >
                                            <td className="px-2.5 py-2 border-b border-white/5">
                                                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#93C5FD' }}>{order.id}</span>
                                            </td>
                                            <td className="px-2.5 py-2 border-b border-white/5 text-redwood-text-main">{order.customer}</td>
                                            <td className="px-2.5 py-2 border-b border-white/5 text-redwood-text-muted">{order.date}</td>

                                            {/* Terms — pill: blue for normal terms, red for overdue */}
                                            <td className="px-2.5 py-2 border-b border-white/5">
                                                <span
                                                    className={`text-[10px] px-2 py-[2px] rounded-full font-mono border whitespace-nowrap ${
                                                        order.isOverdue
                                                            ? 'bg-[rgba(239,68,68,0.12)] text-[#FCA5A5] border-[rgba(239,68,68,0.2)]'
                                                            : 'bg-[rgba(79,142,247,0.10)] text-[#93C5FD] border-[rgba(79,142,247,0.28)]'
                                                    }`}
                                                >
                                                    {order.isOverdue ? 'Overdue' : (order.terms || 'COD')}
                                                </span>
                                            </td>

                                            <td className="px-2.5 py-2 border-b border-white/5 text-right text-redwood-text-muted">${order.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-2.5 py-2 border-b border-white/5 text-right" style={{ color: '#93C5FD' }}>${order.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-2.5 py-2 border-b border-white/5 text-right">
                                                <strong className="text-redwood-text-main">${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            </td>

                                            {/* Lock — green padlock if paid, amber open padlock otherwise */}
                                            <td className="px-2.5 py-2 border-b border-white/5 text-center">
                                                {String(order.status).toLowerCase() === 'paid'
                                                    ? <Lock size={13} className="inline-block" style={{ color: '#22C55E' }} aria-label="Locked (paid)" />
                                                    : <Unlock size={13} className="inline-block" style={{ color: '#F59E0B' }} aria-label="Unlocked (unpaid)" />}
                                            </td>

                                            {/* Tax Reg — static "Missing" until source field exists */}
                                            <td className="px-2.5 py-2 border-b border-white/5">
                                                <span className="text-[9px] text-[#FCA5A5]">Missing</span>
                                            </td>

                                            <td className="px-2.5 py-2 border-b border-white/5">
                                                <span
                                                    className="text-[9px] font-semibold px-2 py-[2px] rounded-full"
                                                    style={{ background: pill.bg, color: pill.color, border: `1px solid ${pill.border}` }}
                                                >
                                                    {order.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Tax Reg warning banner — static, single instance.
                        Sits below the table inside the same panel card so
                        the red callout shares the panel's border radius. */}
                    <div className="mt-2 px-3 py-2 bg-[rgba(239,68,68,0.07)] border border-[rgba(239,68,68,0.18)] rounded-[8px] text-[10px] text-[#FCA5A5] flex items-start gap-2">
                        <AlertTriangle size={13} className="flex-shrink-0 mt-[1px]" aria-hidden="true" />
                        <span>
                            <strong>Tax Registration Number</strong> is missing from all invoices. This is a legal requirement.
                            Add your VAT reg number in Settings → Company Profile to auto-populate on every invoice.
                        </span>
                    </div>
                </div>

                {/* RIGHT column — stacked: Quick Stats → Van Status → Today's Checklist */}
                <div className="flex flex-col gap-[10px]">
                {/* Quick Stats — operational list */}
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-[13px] font-semibold text-redwood-text-main">Quick Stats</div>
                        <div className="text-[10px] text-redwood-text-muted">Operational</div>
                    </div>
                    <div className="flex flex-col gap-[5px]">
                        {([
                            { icon: Users,        label: 'Total Customers',     value: customersCount,         color: undefined as string | undefined },
                            { icon: UserPlus,     label: 'New This Month',      value: newCustomersThisMonth,  color: '#00D4AA' },
                            { icon: Truck,        label: 'Active Vans',         value: vansCount,              color: undefined },
                            { icon: Package,      label: 'Products in Catalog', value: metrics.productCount,   color: undefined },
                            { icon: ShoppingCart, label: 'Total Orders MTD',    value: salesOrdersCount,       color: undefined },
                        ]).map((row, i) => {
                            const Icon = row.icon;
                            return (
                                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-[#142540] border border-redwood-border rounded-[6px] transition-colors hover:bg-[#1a2d4e]">
                                    <div className="flex items-center gap-1.5 text-[11px] text-redwood-text-muted">
                                        <Icon size={13} style={row.color ? { color: row.color } : { color: '#3E5678' }} />
                                        {row.label}
                                    </div>
                                    <div className="text-[12px] font-semibold" style={row.color ? { color: row.color } : { color: '#EEF2FF' }}>
                                        {row.value}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* System Health */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[rgba(34,197,94,0.10)] border border-[rgba(34,197,94,0.15)] rounded-[6px] mt-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                        <span className="text-[10px] text-[#86EFAC] font-medium">All Systems Operational</span>
                    </div>
                </div>

                {/* Van Status — 2-up tile grid driven by aiContext.vans */}
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="text-[13px] font-semibold text-redwood-text-main flex items-center gap-1.5">
                            <Truck size={13} className="text-redwood-text-muted" />
                            Van Status
                        </div>
                        <button
                            onClick={() => navigate('/logistics/operations')}
                            className="text-[10px] text-[#4F8EF7] hover:underline"
                        >
                            Field view →
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {((aiContext.vans as any[]) || []).slice(0, 2).map((van: any, i: number) => {
                            const isOnline = van.status === 'active' || van.isOnline;
                            return (
                                <div
                                    key={i}
                                    className={`rounded-[8px] p-2.5 border bg-[#142540] ${isOnline ? 'border-[rgba(34,197,94,0.25)]' : 'border-[rgba(245,158,11,0.25)]'}`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold text-redwood-text-main">
                                            {van.name || `Van 0${i + 1}`}
                                        </span>
                                        <span
                                            className={`text-[9px] font-semibold px-1.5 py-[1px] rounded-full border ${
                                                isOnline
                                                    ? 'bg-[rgba(34,197,94,0.12)] text-[#86EFAC] border-[rgba(34,197,94,0.2)]'
                                                    : 'bg-[rgba(245,158,11,0.12)] text-[#FCD34D] border-[rgba(245,158,11,0.2)]'
                                            }`}
                                        >
                                            {isOnline ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                    {van.driverName && <div className="text-[10px] text-redwood-text-muted">Driver: {van.driverName}</div>}
                                    {van.location && <div className="text-[10px] text-redwood-text-muted">{van.location}</div>}
                                    <div className="text-[10px] text-redwood-text-muted mt-0.5">
                                        Stock on van: {van.currentStock ?? van.stock ?? 0} units
                                    </div>
                                    {Number(van.offlineInvoices) > 0 && (
                                        <div className="mt-1.5 text-[9px] bg-[rgba(245,158,11,0.12)] text-[#FCD34D] border border-[rgba(245,158,11,0.2)] rounded-[5px] px-2 py-1 flex items-center gap-1">
                                            ☁ {van.offlineInvoices} offline invoices — sync now
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {((aiContext.vans as any[]) || []).length === 0 && (
                            <div className="col-span-2 text-[10px] text-redwood-text-muted text-center py-3">
                                No van data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Today's Checklist — local toggle state */}
                <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="text-[13px] font-semibold text-redwood-text-main flex items-center gap-1.5">
                            <ListChecks size={13} className="text-redwood-text-muted" />
                            Today's Checklist
                        </div>
                        <span className="text-[10px] text-redwood-text-muted">{checkLeft} left</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {checklistItems.map((item, i) => (
                            <div
                                key={i}
                                onClick={() => toggleCheck(i)}
                                role="checkbox"
                                aria-checked={item.done}
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCheck(i); } }}
                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] border cursor-pointer transition-colors ${
                                    item.done
                                        ? 'bg-[rgba(34,197,94,0.07)] border-[rgba(34,197,94,0.15)]'
                                        : 'bg-[#142540] border-redwood-border hover:bg-[#1a2d4e]'
                                }`}
                            >
                                <div className={`w-3.5 h-3.5 rounded-[3px] border-[1.5px] flex items-center justify-center flex-shrink-0 transition-colors ${
                                    item.done ? 'bg-[#22C55E] border-[#22C55E]' : 'border-[#3E5678]'
                                }`}>
                                    {item.done && (
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </div>
                                <span className={`text-[10px] flex-1 ${item.done ? 'line-through text-redwood-text-muted' : 'text-redwood-text-main'}`}>
                                    {item.label}
                                </span>
                                {item.tag && (
                                    <span
                                        className={`text-[8px] font-semibold px-1.5 py-[1px] rounded-full border ${
                                            item.tag === 'urgent' || item.tag === 'critical'
                                                ? 'bg-[rgba(239,68,68,0.12)] text-[#FCA5A5] border-[rgba(239,68,68,0.2)]'
                                                : 'bg-[rgba(245,158,11,0.12)] text-[#FCD34D] border-[rgba(245,158,11,0.2)]'
                                        }`}
                                    >
                                        {item.tag}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                </div>  {/* close RIGHT column wrapper */}

            </div>
        </div>
    );
}
