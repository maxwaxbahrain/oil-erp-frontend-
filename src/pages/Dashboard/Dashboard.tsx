import {
    ShoppingCart,
    Wallet,
    TrendingUp,
    AlertTriangle,
    FileText,
    ArrowRight,
    TrendingDown,
    Activity,
    MoreVertical,
    RefreshCw,
    Download,
    Calendar,
    Sliders,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getCustomers, getInvoices, getProducts, getSalesOrders, getVans, getPayments, type Invoice, type Product } from '../../services/api';
import { getPurchaseOrders } from '../../services/purchasesService';
// TC-02 — Dashboard Options dropdown.
import autoTable from 'jspdf-autotable';
import { generateStandardPDF } from '../../utils/documentGenerator';
import { formatCurrency } from '../../services/settingsService';
import { useEscape } from '../../hooks/useEscape';

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesOrdersCount, setSalesOrdersCount] = useState(0);
    const [vansCount, setVansCount] = useState(0);
    const [customersCount, setCustomersCount] = useState(0);
    const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
    const [dataError, setDataError] = useState(false);
    const [aiContext, setAiContext] = useState({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [] } as any);
    // TC-02 — Options dropdown state.
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [showDateRange, setShowDateRange] = useState(false);
    const [dashFrom, setDashFrom] = useState<string>('');
    const [dashTo, setDashTo] = useState<string>('');
    const optionsRef = useRef<HTMLDivElement>(null);

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
            setAiContext({ invoices: inv, customers, products: prod, payments: pays, purchaseOrders: pos });
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
    const monthlyPerformanceData = useMemo(() => {
        const now = new Date();
        const points: Array<{ month: string; sales: number; expenses: number }> = [];
        for (let i = 5; i >= 0; i--) {
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
    }, [filteredInvoices]);

    const inventoryPieData = useMemo(
        () => products.map((p) => ({ name: p.name, value: Number(p.current_stock) || 0 })).filter((x) => x.value > 0),
        [products]
    );

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
                amount: Number(i.grandTotal) || 0,
                status: i.status || 'Unpaid',
            }));
    }, [invoices, aiContext.customers]);

    const stats = [
        { label: 'Total Income', value: `$${metrics.totalIncome.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: dataError ? 'N/A' : 'From invoices' },
        { label: 'Total Expenses', value: '$0', icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'N/A' },
        { label: 'Net Profit', value: `$${metrics.netProfit.toLocaleString()}`, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50', trend: dataError ? 'N/A' : 'Income - Expenses' },
        { label: 'Unpaid Invoices', value: `$${metrics.unpaidAmount.toLocaleString()}`, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', trend: `${metrics.overdueCount} overdue` },
        { label: 'Low Stock Alerts', value: String(metrics.lowStock), icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'stock < 10' },
        { label: 'Total Orders', value: String(salesOrdersCount), icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'All sales orders' },
    ];

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

            {/* 1. Key Metrics Cards (Grid of 6) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-redwood-bg-surface p-5 rounded-lg border border-redwood-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${stat.bg}`}>
                                <stat.icon size={16} className={stat.color} />
                            </div>
                            {/* Optional: Trend Badge Area */}
                        </div>
                        <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-1">{stat.label}</div>
                        <div className="text-2xl font-black text-redwood-text-main leading-tight mb-2">{stat.value}</div>
                        <div className={`text-[10px] font-bold ${stat.color} flex items-center gap-1`}>
                            {stat.trend}
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Sales vs Expenses (Bar/Line) */}
                <div className="lg:col-span-2 bg-redwood-bg-surface p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-[16px] font-black text-redwood-text-main">Financial Performance</h3>
                            <p className="text-[12px] text-redwood-text-muted font-medium">Sales vs Expenses (Last 6 Months)</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyPerformanceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8BA3C7' }} stroke="rgba(255,255,255,0.12)" />
                                <YAxis tick={{ fontSize: 11, fill: '#8BA3C7' }} stroke="rgba(255,255,255,0.12)" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f1f33', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#EEF2FF' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px', color: '#EEF2FF' }} />
                                <Bar dataKey="sales" name="Total Sales" fill="#00758f" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expenses" name="Total Expenses" fill="#FF5630" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Inventory by Category (Pie Chart) */}
                <div className="bg-redwood-bg-surface p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-[16px] font-black text-redwood-text-main">Inventory Distribution</h3>
                            <p className="text-[12px] text-redwood-text-muted font-medium">Stock by product</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={inventoryPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {inventoryPieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f1f33', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#EEF2FF' }} />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, color: '#EEF2FF' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. Recent Orders & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent Orders List */}
                <div className="lg:col-span-2 bg-redwood-bg-surface rounded-lg border border-redwood-border shadow-sm overflow-hidden dash-table-container">
                    <div className="p-6 border-b border-redwood-border flex justify-between items-center">
                        <div>
                        <h3 className="text-[16px] font-black text-redwood-text-main">Recent Orders</h3>
                        <p className="text-[12px] text-redwood-text-muted font-medium">Latest real invoices</p>
                        </div>
                        <button onClick={() => navigate('/sales/orders')} className="text-[12px] font-bold text-redwood-brand hover:underline flex items-center gap-1">
                            View All <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 border-b border-redwood-border">
                                <tr>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Order/Invoice</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        onClick={() => navigate(`/sales/invoices/${order.id}`)}
                                        className="hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main">{order.id}</td>
                                        <td className="px-6 py-4 text-[13px] text-redwood-text-main">{order.customer}</td>
                                        <td className="px-6 py-4 text-[13px] text-redwood-text-muted">{order.date}</td>
                                        <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main text-right">${order.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${String(order.status).toLowerCase() === 'paid' || String(order.status).toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                String(order.status).toLowerCase() === 'unpaid' || String(order.status).toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                    String(order.status).toLowerCase() === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="bg-redwood-bg-surface p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-[16px] font-black text-redwood-text-main">Quick Stats</h3>
                        <p className="text-[12px] text-redwood-text-muted font-medium">Operational efficiency checks</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-lg text-center border border-redwood-border">
                            <div className="text-[24px] font-black text-redwood-brand mb-1">{vansCount}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Active Vans</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-lg text-center border border-redwood-border">
                            <div className="text-[24px] font-black text-emerald-600 mb-1">{newCustomersThisMonth}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">New Customers</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-lg text-center border border-redwood-border">
                            <div className="text-[24px] font-black text-blue-600 mb-1">{customersCount}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Total Customers</div>
                        </div>
                        <div className="p-4 bg-white/5 rounded-lg text-center border border-redwood-border">
                            <div className="text-[24px] font-black text-purple-600 mb-1">{metrics.productCount}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Products In Catalog</div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-redwood-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <Activity size={20} />
                            </div>
                            <div>
                                <div className="text-[12px] font-bold text-redwood-text-main">System Health</div>
                                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    All Systems Operational
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
