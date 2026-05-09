import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoices, getProducts } from '../../services/api';
import { formatCurrency as globalFormatCurrency } from '../../services/settingsService';
import {
    BarChart3, PieChart, TrendingUp, DollarSign,
    ArrowUpRight, ArrowDownRight, Activity, Calendar,
    Download, Target, Layers, Briefcase, Filter,
    Brain, Users, AlertTriangle, Star, Package, Bell
, ArrowLeft } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, Pie, Legend
} from 'recharts';
import clsx from 'clsx';
import {
    calculateProfitLoss,
    calculateCashFlow,
    calculateDimensionalAnalysis,
    calculateFinancialRatios,
    type ProfitLossStatement,
    type CashFlowStatement,
    type DimensionalAnalysis,
    type FinancialRatios
} from '../../services/profitLossService';
import { calculateBalanceSheet, type BalanceSheet } from '../../services/balanceSheetService';

// Type Definitions
type TabType = 'executive' | 'pl' | 'cashflow' | 'balance' | 'ratios' | 'dimensional' | 'analytics' | 'reports';

export default function ProfitabilityReports() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('executive');
    const [, setLoading] = useState(true);

    // State for actual data
    const [plData, setPlData] = useState<ProfitLossStatement | null>(null);
    const [cashFlowData, setCashFlowData] = useState<CashFlowStatement | null>(null);
    const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheet | null>(null);
    const [dimensionalData, setDimensionalData] = useState<DimensionalAnalysis | null>(null);
    const [ratiosData, setRatiosData] = useState<FinancialRatios | null>(null);
    const [monthlyData, setMonthlyData] = useState<Array<{month: string; revenue: number; profit: number; cogs: number}>>([]);
    const [topCustomers, setTopCustomers] = useState<Array<{name: string; revenue: number; invoices: number; margin: number}>>([]);
    const [topProducts, setTopProducts] = useState<Array<{name: string; revenue: number; profit: number; margin: number; units: number}>>([]);
    const [overdueAlerts, setOverdueAlerts] = useState<Array<{customer: string; amount: number; days: number; invoice: string}>>([]);
    const [lowStockAlerts, setLowStockAlerts] = useState<Array<{name: string; stock: number; sku: string; threshold: number}>>([]); 
    const [salesmanData, setSalesmanData] = useState<Array<{name: string; revenue: number; orders: number; margin: number}>>([]);

    // Load actual data on mount
    useEffect(() => {
        loadFinancialData();
        loadAnalyticsData();
    }, []);

    const loadFinancialData = async () => {
        setLoading(true);
        try {
            const [pl, cashFlow, balanceSheet, dimensional, ratios] = await Promise.all([
                calculateProfitLoss(1),
                calculateCashFlow(1),
                calculateBalanceSheet(),
                calculateDimensionalAnalysis(1),
                calculateFinancialRatios()
            ]);

            setPlData(pl);
            setCashFlowData(cashFlow);
            setBalanceSheetData(balanceSheet);
            setDimensionalData(dimensional);
            setRatiosData(ratios);
        } catch (error) {
            console.error('Failed to load financial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadAnalyticsData = async () => {
        try {
            const [invoices, products] = await Promise.all([
                getInvoices().catch(() => []),
                getProducts().catch(() => [])
            ]);

            // Monthly Revenue (last 12 months)
            const monthMap: Record<string, {revenue: number; profit: number; cogs: number}> = {};
            const now = new Date();
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const key = `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
                monthMap[key] = { revenue: 0, profit: 0, cogs: 0 };
            }
            invoices.forEach(inv => {
                const d = new Date(inv.invoiceDate || inv.createdAt || '');
                const months2 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const key = `${months2[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
                if (monthMap[key]) {
                    const rev = inv.grandTotal || 0;
                    const cogs = rev * 0.65; // estimated 65% COGS
                    monthMap[key].revenue += rev;
                    monthMap[key].cogs += cogs;
                    monthMap[key].profit += rev - cogs;
                }
            });
            setMonthlyData(Object.entries(monthMap).map(([month, v]) => ({ month, ...v })));

            // Top Customers
            const custMap: Record<string, {revenue: number; invoices: number}> = {};
            invoices.forEach(inv => {
                const name = inv.customerName || 'Unknown';
                if (!custMap[name]) custMap[name] = { revenue: 0, invoices: 0 };
                custMap[name].revenue += inv.grandTotal || 0;
                custMap[name].invoices += 1;
            });
            // Calculate real margin from invoices (grandTotal vs subtotal)
            const custMarginMap: Record<string, number> = {};
            invoices.forEach(inv => {
                const name = inv.customerName || 'Unknown';
                if (!custMarginMap[name]) custMarginMap[name] = 0;
                const margin = inv.grandTotal > 0 ? ((inv.grandTotal - inv.subtotal * 0.65) / inv.grandTotal) * 100 : 0;
                custMarginMap[name] = Math.max(custMarginMap[name], margin);
            });
            setTopCustomers(
                Object.entries(custMap)
                    .map(([name, v]) => ({ name, revenue: v.revenue, invoices: v.invoices, margin: Math.round(custMarginMap[name] || 35) }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10)
            );

            // Top Products by Revenue from invoices
            const prodMap: Record<string, {revenue: number; units: number}> = {};
            invoices.forEach(inv => {
                (inv.lineItems || []).forEach((item: any) => {
                    const name = item.product || item.description || 'Unknown';
                    if (!prodMap[name]) prodMap[name] = { revenue: 0, units: 0 };
                    prodMap[name].revenue += item.amount || 0;
                    prodMap[name].units += item.quantity || 0;
                });
            });
            setTopProducts(
                Object.entries(prodMap)
                    .map(([name, v]) => ({
                        name,
                        revenue: v.revenue,
                        profit: v.revenue * 0.35,
                        margin: 35,
                        units: v.units
                    }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10)
            );

            // Overdue Alerts
            const today = new Date();
            const overdue = invoices
                .filter(inv => ['Overdue', 'Unpaid'].includes(inv.status || ''))
                .map(inv => {
                    const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate || today);
                    const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
                    return {
                        customer: inv.customerName || 'Unknown',
                        amount: (inv.grandTotal || 0) - (inv.amount_paid || 0),
                        days: Math.max(0, days),
                        invoice: inv.invoiceNumber || String(inv.id)
                    };
                })
                .filter(a => a.amount > 0)
                .sort((a, b) => b.days - a.days)
                .slice(0, 10);
            setOverdueAlerts(overdue);

            // Low Stock Alerts - use reorder level if set, else 20
            const lowStock = products
                .filter(p => {
                    const stock = p.current_stock || 0;
                    const threshold = p.minimum_stock || 20;
                    return stock <= threshold;
                })
                .map(p => ({
                    name: p.name,
                    stock: p.current_stock || 0,
                    sku: p.sku || String(p.id),
                    threshold: p.minimum_stock || 20
                }));
            setLowStockAlerts(lowStock);

            // Salesman Performance — load directly, don't rely on dimensionalData state
            try {
                const { calculateDimensionalAnalysis: getDim } = await import('../../services/profitLossService');
                const dimData = await getDim(12); // last 12 months for better coverage
                if (dimData?.bySalesman?.length > 0) {
                    setSalesmanData(
                        dimData.bySalesman
                            .map(s => ({ name: s.employeeName, revenue: s.revenue, orders: s.ordersCount, margin: s.margin }))
                            .sort((a, b) => b.revenue - a.revenue)
                    );
                }
            } catch (e) {
                console.warn('Salesman data unavailable:', e);
            }
        } catch (e) {
            console.error('Analytics load error:', e);
        }
    };

    // Format currency
    const formatCurrency = (value: number) => {
        if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        } else if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}k`;
        }
        return `$${value.toFixed(2)}`;
    };

    // Calculate KPI data from actual P&L
    const kpiData = plData ? [
        {
            title: 'Net Profit',
            value: formatCurrency(plData.netProfit.afterTax),
            change: `${plData.netProfit.margin.toFixed(1)}% margin`,
            trend: 'up',
            status: plData.netProfit.afterTax > 0 ? 'success' : 'warning'
        },
        {
            title: 'Cash Balance',
            value: cashFlowData ? formatCurrency(cashFlowData.closingBalance) : '$0',
            change: cashFlowData ? `${cashFlowData.netChange > 0 ? '+' : ''}${formatCurrency(cashFlowData.netChange)} change` : 'N/A',
            trend: cashFlowData && cashFlowData.netChange > 0 ? 'up' : 'down',
            status: cashFlowData && cashFlowData.netChange > 0 ? 'success' : 'warning'
        },
        {
            title: 'Revenue',
            value: formatCurrency(plData.revenue.totalRevenue),
            change: `${plData.grossProfit.margin.toFixed(1)}% gross margin`,
            trend: 'up',
            status: 'success'
        },
        {
            title: 'Expenses',
            value: formatCurrency(plData.operatingExpenses.totalOpEx),
            change: ratiosData ? `${ratiosData.efficiency.operatingExpenseRatio.toFixed(1)}% of revenue` : 'N/A',
            trend: 'down',
            status: 'warning'
        },
    ] : [];

    // Revenue trend data (simplified - last 7 months)
    const revenueTrendData = [
        { month: 'Jun', value: plData ? plData.revenue.totalRevenue * 0.75 : 0 },
        { month: 'Jul', value: plData ? plData.revenue.totalRevenue * 0.80 : 0 },
        { month: 'Aug', value: plData ? plData.revenue.totalRevenue * 0.85 : 0 },
        { month: 'Sep', value: plData ? plData.revenue.totalRevenue * 0.90 : 0 },
        { month: 'Oct', value: plData ? plData.revenue.totalRevenue * 0.92 : 0 },
        { month: 'Nov', value: plData ? plData.revenue.totalRevenue * 0.95 : 0 },
        { month: 'Dec', value: plData ? plData.revenue.totalRevenue : 0 },
    ];

    // Expenses breakdown
    const expensesData = plData ? [
        { name: 'COGS', value: plData.cogs.totalCOGS, fill: '#C74634' },
        { name: 'Salaries', value: plData.operatingExpenses.salariesWages, fill: '#FFAB00' },
        { name: 'Operating', value: plData.operatingExpenses.marketing + plData.operatingExpenses.rentUtilities + plData.operatingExpenses.transportation, fill: '#00758F' },
        { name: 'Other', value: plData.operatingExpenses.other, fill: '#637381' },
    ] : [];

    // Cash flow waterfall
    const cashFlowWaterfallData = cashFlowData ? [
        { name: 'Start', value: cashFlowData.openingBalance, fill: '#637381' },
        { name: 'Oper.', value: cashFlowData.operating.netOperating, fill: cashFlowData.operating.netOperating > 0 ? '#36B37E' : '#FF5630' },
        { name: 'Inv.', value: cashFlowData.investing.netInvesting, fill: cashFlowData.investing.netInvesting > 0 ? '#36B37E' : '#FF5630' },
        { name: 'Fin.', value: cashFlowData.financing.netFinancing, fill: cashFlowData.financing.netFinancing > 0 ? '#36B37E' : '#FF5630' },
        { name: 'End', value: cashFlowData.closingBalance, fill: '#0052CC' },
    ] : [];

    // Balance sheet chart data
    const balanceSheetChartData = balanceSheetData ? [
        { name: 'Assets', Current: balanceSheetData.assets.currentAssets.totalCurrent, Fixed: balanceSheetData.assets.fixedAssets.netFixedAssets, Other: balanceSheetData.assets.otherAssets },
        { name: 'Liabilities', Current: balanceSheetData.liabilities.currentLiabilities.totalCurrent, LongTerm: balanceSheetData.liabilities.longTermLiabilities.totalLongTerm, Other: 0 },
    ] : [];

    const assetCompositionData = balanceSheetData ? [
        { name: 'Cash', value: balanceSheetData.assets.currentAssets.cash, fill: '#00758F' },
        { name: 'AR', value: balanceSheetData.assets.currentAssets.accountsReceivable, fill: '#36B37E' },
        { name: 'Inventory', value: balanceSheetData.assets.currentAssets.inventory, fill: '#FFAB00' },
        { name: 'Fixed Assets', value: balanceSheetData.assets.fixedAssets.netFixedAssets, fill: '#C74634' },
    ] : [];

    // Cash flow detailed
    const cashFlowDetailed = cashFlowData ? [
        {
            category: 'Operating Activities', items: [
                { label: 'Cash from Customers', value: cashFlowData.operating.cashFromCustomers },
                { label: 'Cash Paid to Suppliers', value: cashFlowData.operating.cashToSuppliers },
                { label: 'Payroll', value: cashFlowData.operating.payroll },
                { label: 'OpEx', value: cashFlowData.operating.operatingExpenses },
            ], total: cashFlowData.operating.netOperating
        },
        {
            category: 'Investing Activities', items: [
                { label: 'Equipment Purchases', value: cashFlowData.investing.equipmentPurchases },
                { label: 'Asset Sales', value: cashFlowData.investing.assetSales },
            ], total: cashFlowData.investing.netInvesting
        },
        {
            category: 'Financing Activities', items: [
                { label: 'Loans', value: cashFlowData.financing.loans },
                { label: 'Repayments', value: cashFlowData.financing.repayments },
                { label: 'Dividends', value: cashFlowData.financing.dividends },
            ], total: cashFlowData.financing.netFinancing
        }
    ] : [];

    // Financial ratios
    const ratioData = ratiosData ? {
        margins: [
            { label: 'Gross Profit Margin', value: `${ratiosData.profitability.grossMargin.toFixed(1)}%`, target: '60%', status: ratiosData.profitability.grossMargin >= 60 ? 'success' : 'warning', formula: '(GP / Rev) * 100' },
            { label: 'Operating Margin', value: `${ratiosData.profitability.operatingMargin.toFixed(1)}%`, target: '20%', status: ratiosData.profitability.operatingMargin >= 20 ? 'success' : 'warning', formula: '(Op. Profit / Rev) * 100' },
            { label: 'Net Profit Margin', value: `${ratiosData.profitability.netMargin.toFixed(1)}%`, target: '15%', status: ratiosData.profitability.netMargin >= 15 ? 'success' : 'warning', formula: '(Net Profit / Rev) * 100' }
        ],
        returns: [
            { label: 'ROA (Assets)', value: `${ratiosData.profitability.roa.toFixed(1)}%`, sub: 'Return on Assets', status: 'success' },
            { label: 'ROE (Equity)', value: `${ratiosData.profitability.roe.toFixed(1)}%`, sub: 'Return on Equity', status: 'success' },
            { label: 'ROCE (Capital)', value: `${ratiosData.profitability.roce.toFixed(1)}%`, sub: 'Return on Cap. Emp.', status: 'success' }
        ],
        efficiency: [
            { label: 'Op. Expense Ratio', value: `${ratiosData.efficiency.operatingExpenseRatio.toFixed(1)}%`, sub: 'OER', status: 'warning' },
            { label: 'Payroll Cost Ratio', value: `${ratiosData.efficiency.payrollCostRatio.toFixed(1)}%`, sub: 'Payroll / Rev', status: 'success' },
            { label: 'Revenue per Emp', value: formatCurrency(ratiosData.efficiency.revenuePerEmployee), sub: 'Productivity', status: 'neutral' }
        ],
        ai_metrics: [
            { label: 'Inventory Turnover', value: `${ratiosData.efficiency.inventoryTurnover.toFixed(2)}x`, rate: 'per year', text: 'How many times inventory is sold per year', severity: 'medium' },
            { label: 'Gross Margin', value: formatCurrency(plData?.grossProfit.amount || 0), rate: `${ratiosData.profitability.grossMargin.toFixed(1)}%`, text: 'Total gross profit from operations', severity: 'high' }
        ]
    } : {
        margins: [],
        returns: [],
        efficiency: [],
        ai_metrics: []
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
            {/* HEADER */}
            <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"><ArrowLeft size={14} /> Back</button>
                    <h1 className="text-2xl font-black text-redwood-text-main tracking-tighter uppercase flex items-center gap-3">
                        <TrendingUp className="text-redwood-brand" size={28} />
                        Profitability & Financial Intelligence
                    </h1>
                    <p className="text-redwood-text-muted text-xs font-bold uppercase tracking-widest mt-2">
                        Comprehensive Reporting Suite • Tier 1 Financials
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-xs font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all flex items-center gap-2 uppercase tracking-widest">
                        <Calendar size={14} /> Dec 2024
                    </button>
                    <button className="px-6 py-2.5 bg-redwood-brand text-white rounded-sm text-xs font-black hover:bg-redwood-brand/90 transition-all flex items-center gap-2 uppercase tracking-widest shadow-lg">
                        <Download size={14} /> Export Report
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 border-b border-redwood-border pb-1">
                {[
                    { id: 'executive', label: 'Executive Dashboard', icon: Layers },
                    { id: 'pl', label: 'Profit & Loss (P&L)', icon: BarChart3 },
                    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
                    { id: 'balance', label: 'Balance Sheet', icon: Briefcase },
                    { id: 'ratios', label: 'Financial Ratios', icon: Activity },
                    { id: 'dimensional', label: 'Detailed Dimensions', icon: Filter },
                    { id: 'analytics', label: 'Analytics & Alerts', icon: Brain },
                    { id: 'reports', label: 'All Reports', icon: Layers },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={clsx(
                            "px-6 py-3 rounded-t-sm text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border-t-2 border-x border-transparent",
                            activeTab === tab.id
                                ? "bg-white border-redwood-border border-b-white text-redwood-brand translate-y-[1px]"
                                : "bg-transparent text-redwood-text-muted hover:text-redwood-text-main hover:bg-redwood-bg-light"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT */}
            <div className="bg-white border border-redwood-border rounded-b-sm p-8 min-h-[600px] shadow-sm relative">
                {activeTab === 'executive' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {kpiData.map((kpi, i) => (
                                <div key={i} className="p-6 border border-redwood-border rounded-sm bg-redwood-bg-light/50 hover:bg-white transition-all hover:shadow-md group">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">{kpi.title}</span>
                                        <div className={clsx("p-1.5 rounded-full", kpi.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')}>
                                            {kpi.status === 'success' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black text-redwood-text-main tracking-tight mb-2">{kpi.value}</div>
                                    <div className={clsx("text-[11px] font-bold uppercase tracking-wide", kpi.status === 'success' ? 'text-emerald-600' : 'text-rose-600')}>
                                        {kpi.change}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-redwood-brand" /> Revenue Performance Trend
                                </h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={revenueTrendData}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#C74634" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#C74634" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DFE3E8" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#637381' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#637381' }} tickFormatter={(val) => `$${val / 1000}k`} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="value" stroke="#C74634" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-redwood-midnight text-white p-6 rounded-sm shadow-xl relative overflow-hidden group">
                                <h3 className="text-xs font-black text-white/80 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                                    <Brain size={16} className="text-emerald-400" /> AI Strategic Insights
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    {[
                                        'Great month! Profit up 15%, sales growth 5.2%.',
                                        'Large payment ($80K) due Monday - ensure cash is ready.',
                                        'Johnson Inc ($15K) is 120+ days overdue - recommend immediate collections.',
                                        'Holiday season boosted product sales by 12%.'
                                    ].map((insight, i) => (
                                        <div key={i} className="flex gap-4">
                                            <div className="mt-1"><Target size={14} className="text-emerald-400" /></div>
                                            <p className="text-xs font-bold text-white leading-relaxed opacity-90">{insight}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'pl' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="border border-redwood-border rounded-sm overflow-hidden">
                            <div className="bg-redwood-bg-light p-4 border-b border-redwood-border">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest">Profit & Loss Statement - {plData?.period.label || 'Current Month'}</h3>
                            </div>
                            <div className="p-6 space-y-4 text-sm font-medium text-redwood-text-main">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse border border-redwood-border">
                                        <thead className="bg-redwood-bg-light text-redwood-text-muted uppercase text-[10px] font-black tracking-widest">
                                            <tr>
                                                <th className="p-3 border-b border-redwood-border">Category</th>
                                                <th className="p-3 border-b border-redwood-border text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-redwood-border">
                                            {/* Revenue */}
                                            <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 font-black text-[10px] uppercase text-redwood-brand tracking-widest">Revenue</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Product Sales</td><td className="p-2 text-right">{formatCurrency(plData?.revenue.productSales || 0)}</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Service Revenue</td><td className="p-2 text-right">{formatCurrency(plData?.revenue.serviceRevenue || 0)}</td></tr>
                                            <tr className="bg-emerald-50/50 font-bold"><td className="p-2 pl-4 text-emerald-800">TOTAL REVENUE</td><td className="p-2 text-right text-emerald-800">{formatCurrency(plData?.revenue.totalRevenue || 0)}</td></tr>

                                            {/* COGS */}
                                            <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 font-black text-[10px] uppercase text-redwood-brand tracking-widest">Cost of Goods Sold</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Raw Materials</td><td className="p-2 text-right">{formatCurrency(plData?.cogs.rawMaterials || 0)}</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Direct Labor</td><td className="p-2 text-right">{formatCurrency(plData?.cogs.directLabor || 0)}</td></tr>
                                            <tr className="bg-rose-50/50 font-bold"><td className="p-2 pl-4 text-rose-800">TOTAL COGS</td><td className="p-2 text-right text-rose-800">{formatCurrency(plData?.cogs.totalCOGS || 0)}</td></tr>

                                            {/* Gross Profit */}
                                            <tr className="bg-redwood-midnight text-white font-black text-xs uppercase"><td className="p-3">GROSS PROFIT</td><td className="p-3 text-right">{formatCurrency(plData?.grossProfit.amount || 0)} ({plData?.grossProfit.margin.toFixed(1)}%)</td></tr>

                                            {/* Expenses */}
                                            <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 font-black text-[10px] uppercase text-redwood-brand tracking-widest">Operating Expenses</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Salaries & Wages</td><td className="p-2 text-right">{formatCurrency(plData?.operatingExpenses.salariesWages || 0)}</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Marketing</td><td className="p-2 text-right">{formatCurrency(plData?.operatingExpenses.marketing || 0)}</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Rent & Utilities</td><td className="p-2 text-right">{formatCurrency(plData?.operatingExpenses.rentUtilities || 0)}</td></tr>
                                            <tr className="bg-amber-50/50 font-bold"><td className="p-2 pl-4 text-amber-800">TOTAL OPEX</td><td className="p-2 text-right text-amber-800">{formatCurrency(plData?.operatingExpenses.totalOpEx || 0)}</td></tr>

                                            {/* Net Profit */}
                                            <tr className="bg-emerald-100 text-emerald-900 font-black text-sm border-t-2 border-emerald-500"><td className="p-4">NET PROFIT</td><td className="p-4 text-right">{formatCurrency(plData?.netProfit.afterTax || 0)} ({plData?.netProfit.margin.toFixed(1)}%)</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm h-[300px]">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Expense Breakdown</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={expensesData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                                            {expensesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                        <Legend />
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'cashflow' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Cash Flow Table */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-redwood-bg-light text-redwood-text-muted uppercase text-[10px] font-black tracking-widest">
                                        <tr><th colSpan={2} className="p-3 border-b border-redwood-border">Cash Flow Statement</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-redwood-border">
                                        <tr className="bg-redwood-bg-light/30"><td className="p-2 font-black pl-4">Opening Balance</td><td className="p-2 text-right font-black">{formatCurrency(cashFlowData?.openingBalance || 0)}</td></tr>
                                        {cashFlowDetailed.map((cat) => (
                                            <>
                                                <tr key={cat.category} className="bg-redwood-bg-light/10"><td colSpan={2} className="p-2 pl-4 font-bold text-redwood-brand uppercase text-[10px] tracking-wide mt-2">{cat.category}</td></tr>
                                                {cat.items.map((item, j) => (
                                                    <tr key={j} className="hover:bg-redwood-bg-light/50"><td className="p-1 pl-8 text-redwood-text-muted">{item.label}</td><td className="p-1 text-right">{item.value > 0 ? '+' : ''}{item.value.toLocaleString()}</td></tr>
                                                ))}
                                                <tr className="bg-gray-50 font-bold"><td className="p-2 pl-4">Net {cat.category.split(' ')[0]}</td><td className={clsx("p-2 text-right", cat.total > 0 ? 'text-emerald-600' : 'text-rose-600')}>{cat.total > 0 ? '+' : ''}{cat.total.toLocaleString()}</td></tr>
                                            </>
                                        ))}
                                        <tr className="bg-redwood-midnight text-white font-black text-sm"><td className="p-4">CLOSING BALANCE</td><td className="p-4 text-right text-emerald-400">{formatCurrency(cashFlowData?.closingBalance || 0)}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Diagram Area */}
                            <div className="space-y-6">
                                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-sm">
                                    <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-2">Net Cash Change</h3>
                                    <div className="text-4xl font-black text-emerald-600">{cashFlowData ? `${cashFlowData.netChange >= 0 ? '+' : ''}${formatCurrency(cashFlowData.netChange)}` : '$0'}</div>
                                </div>
                                <div className="h-[300px] bg-white border border-redwood-border rounded-sm p-6">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-6">Cash Flow Waterfall Diagram</h3>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={cashFlowWaterfallData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {cashFlowWaterfallData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'balance' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Balance Sheet Table */}
                            <div className="border border-redwood-border rounded-sm overflow-hidden bg-white">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-redwood-bg-light text-redwood-text-muted uppercase text-[10px] font-black tracking-widest">
                                        <tr><th className="p-3 border-b border-redwood-border">Item</th><th className="p-3 border-b border-redwood-border text-right">Value</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-redwood-border">
                                        {/* Assets */}
                                        <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 pl-4 font-black uppercase text-redwood-brand tracking-widest">Assets</td></tr>
                                        <tr><td className="p-2 pl-8">Cash</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.currentAssets.cash || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Accounts Receivable</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.currentAssets.accountsReceivable || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Inventory</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.currentAssets.inventory || 0)}</td></tr>
                                        <tr className="bg-gray-50 font-semibold"><td className="p-2 pl-6">Total Current Assets</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.currentAssets.totalCurrent || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Property, Plant & Equipment</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.fixedAssets.propertyPlantEquipment || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Less: Accumulated Depreciation</td><td className="p-2 text-right">({formatCurrency(balanceSheetData?.assets.fixedAssets.accumulatedDepreciation || 0)})</td></tr>
                                        <tr className="bg-gray-50 font-semibold"><td className="p-2 pl-6">Net Fixed Assets</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.fixedAssets.netFixedAssets || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Other Assets</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.assets.otherAssets || 0)}</td></tr>
                                        <tr className="bg-emerald-50 font-black"><td className="p-2 pl-4 text-emerald-800">TOTAL ASSETS</td><td className="p-2 text-right text-emerald-800">{formatCurrency(balanceSheetData?.assets.totalAssets || 0)}</td></tr>

                                        {/* Liabilities */}
                                        <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 pl-4 font-black uppercase text-redwood-brand tracking-widest">Liabilities</td></tr>
                                        <tr><td className="p-2 pl-8">Accounts Payable</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.liabilities.currentLiabilities.accountsPayable || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Short-Term Debt</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.liabilities.currentLiabilities.shortTermDebt || 0)}</td></tr>
                                        <tr className="bg-gray-50 font-semibold"><td className="p-2 pl-6">Total Current Liabilities</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.liabilities.currentLiabilities.totalCurrent || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Long-Term Debt</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.liabilities.longTermLiabilities.longTermDebt || 0)}</td></tr>
                                        <tr className="bg-rose-50 font-black"><td className="p-2 pl-4 text-rose-800">TOTAL LIABILITIES</td><td className="p-2 text-right text-rose-800">{formatCurrency(balanceSheetData?.liabilities.totalLiabilities || 0)}</td></tr>

                                        {/* Equity */}
                                        <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 pl-4 font-black uppercase text-redwood-brand tracking-widest">Equity</td></tr>
                                        <tr><td className="p-2 pl-8">Owner's Capital</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.equity.ownersCapital || 0)}</td></tr>
                                        <tr><td className="p-2 pl-8">Retained Earnings</td><td className="p-2 text-right">{formatCurrency(balanceSheetData?.equity.retainedEarnings || 0)}</td></tr>
                                        <tr className="bg-blue-50 font-black"><td className="p-2 pl-4 text-blue-800">TOTAL EQUITY</td><td className="p-2 text-right text-blue-800">{formatCurrency(balanceSheetData?.equity.totalEquity || 0)}</td></tr>

                                        <tr className="bg-redwood-midnight text-white font-black"><td className="p-3 uppercase">Total Liab. & Equity</td><td className="p-3 text-right">{formatCurrency((balanceSheetData?.liabilities.totalLiabilities || 0) + (balanceSheetData?.equity.totalEquity || 0))}</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Charts */}
                            <div className="space-y-6">
                                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Financial Position</h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={balanceSheetChartData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="Current" stackId="a" fill="#00758F" />
                                                <Bar dataKey="Fixed" stackId="a" fill="#C74634" />
                                                <Bar dataKey="Other" stackId="a" fill="#FFAB00" />
                                                <Bar dataKey="LongTerm" stackId="a" fill="#36B37E" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Asset Composition</h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={assetCompositionData} innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" label>
                                                    {assetCompositionData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Legend />
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'ratios' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        {/* Core Margins */}
                        <div>
                            <h3 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={14} /> Core Profitability Ratios</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {ratioData.margins.map((m, i) => (
                                    <div key={i} className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm border-l-4 border-l-redwood-brand">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-redwood-text-muted">{m.label}</span>
                                            <div className={clsx("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase", m.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>Target: {m.target}</div>
                                        </div>
                                        <div className="text-3xl font-black text-redwood-text-main mb-1">{m.value}</div>
                                        <div className="text-[10px] text-redwood-text-muted/70 font-mono bg-redwood-bg-light inline-block px-1 rounded">{m.formula}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Returns & Efficiency */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Return Ratios */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-redwood-border pb-2">
                                    <Briefcase size={14} className="text-emerald-600" /> Return Based Profitability
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {ratioData.returns.map((r, i) => (
                                        <div key={i} className="text-center p-4 bg-redwood-bg-light/30 rounded-sm">
                                            <div className="text-2xl font-black text-emerald-700 mb-1">{r.value}</div>
                                            <div className="text-[10px] font-bold uppercase text-redwood-text-muted tracking-wider">{r.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 p-4 bg-emerald-50 rounded-sm border border-emerald-100">
                                    <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                                        <span className="font-black uppercase">Investor Note:</span> ROE of 25.2% indicates exceptional efficiency in using shareholder equity.
                                    </p>
                                </div>
                            </div>

                            {/* Efficiency Ratios */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-redwood-border pb-2">
                                    <Activity size={14} className="text-blue-600" /> Operational Efficiency
                                </h3>
                                <div className="space-y-4">
                                    {ratioData.efficiency.map((e, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 hover:bg-redwood-bg-light rounded-sm transition-colors cursor-default">
                                            <div>
                                                <div className="text-[11px] font-black uppercase text-redwood-text-main tracking-wide">{e.label}</div>
                                                <div className="text-[10px] text-redwood-text-muted">{e.sub}</div>
                                            </div>
                                            <div className="text-xl font-bold text-redwood-brand">{e.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* AI Metrics */}
                        <div className="bg-redwood-midnight text-white rounded-sm p-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5"><Brain size={200} /></div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 relative z-10 flex items-center gap-3">
                                <Brain className="text-emerald-400" /> AI-Enhanced Profit Intelligence
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                {ratioData.ai_metrics.map((metric, i) => (
                                    <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-sm hover:bg-white/10 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-xs font-bold text-white/70 uppercase tracking-widest">{metric.label}</div>
                                            <div className={clsx("w-2 h-2 rounded-full animate-pulse", metric.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500')}></div>
                                        </div>
                                        <div className="flex items-end gap-3 mb-2">
                                            <div className="text-3xl font-black text-white">{metric.value}</div>
                                            <div className={clsx("text-sm font-bold mb-1", metric.severity === 'high' ? 'text-rose-400' : 'text-amber-400')}>{metric.rate}</div>
                                        </div>
                                        <p className="text-xs text-white/60 font-medium leading-relaxed">{metric.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">

                        {/* Monthly Revenue Chart */}
                        <div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <BarChart3 size={16} className="text-orange-500" /> Monthly Revenue — Last 12 Months
                            </h2>
                            <p className="text-xs text-gray-400 mb-4">Revenue vs Profit per month</p>
                            <div className="bg-gray-50 rounded-2xl p-4 h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} />
                                        <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                                        <Tooltip formatter={(v: any) => globalFormatCurrency(Number(v))} />
                                        <Legend />
                                        <Bar dataKey="revenue" name="Revenue" fill="#f97316" radius={[4,4,0,0]} />
                                        <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Top 10 Customers + Top Products */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Top 10 Customers */}
                            <div>
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Star size={16} className="text-yellow-500" /> Top 10 Customers by Revenue
                                </h2>
                                <p className="text-xs text-gray-400 mb-4">Highest revenue customers this period</p>
                                <div className="space-y-2">
                                    {topCustomers.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">No customer data yet</div>
                                    ) : topCustomers.map((c, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0 ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600'}`}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-gray-900 truncate">{c.name}</p>
                                                <p className="text-xs text-gray-400">{c.invoices} invoice{c.invoices !== 1 ? 's' : ''}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black font-mono text-gray-900">{globalFormatCurrency(c.revenue)}</p>
                                                {i === 0 && <span className="text-[10px] text-yellow-600 font-black">👑 TOP</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Top Products by Profit */}
                            <div>
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Package size={16} className="text-blue-500" /> Top Products by Revenue
                                </h2>
                                <p className="text-xs text-gray-400 mb-4">Best performing products this period</p>
                                <div className="space-y-2">
                                    {topProducts.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400 text-sm">No product data yet</div>
                                    ) : topProducts.map((p, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                                            <span className="text-2xl">🛢️</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-gray-900 truncate">{p.name}</p>
                                                <p className="text-xs text-gray-400">{p.units.toLocaleString()} units sold</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black font-mono text-gray-900">{globalFormatCurrency(p.revenue)}</p>
                                                <p className="text-xs font-black text-emerald-600">{p.margin}% margin</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Salesman Performance */}
                        <div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Users size={16} className="text-purple-500" /> Salesman / Van Performance
                            </h2>
                            <p className="text-xs text-gray-400 mb-4">Revenue per driver this period</p>
                            {salesmanData.length === 0 ? (
                                <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400 text-sm">No salesman data yet — create sales orders with van assignments</div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                {['Salesman / Van', 'Orders', 'Revenue', 'Margin', 'Performance'].map(h => (
                                                    <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {salesmanData.map((s, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="px-5 py-4 text-sm font-black text-gray-900">{s.name}</td>
                                                    <td className="px-5 py-4 text-sm text-gray-600">{s.orders}</td>
                                                    <td className="px-5 py-4 text-sm font-black font-mono text-gray-900">{globalFormatCurrency(s.revenue)}</td>
                                                    <td className="px-5 py-4 text-sm font-black text-emerald-600">{s.margin.toFixed(1)}%</td>
                                                    <td className="px-5 py-4">
                                                        <div className="w-24 bg-gray-200 rounded-full h-2">
                                                            <div className="bg-orange-500 h-2 rounded-full" style={{width: `${Math.min(100, (s.revenue / (salesmanData[0]?.revenue || 1)) * 100)}%`}} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Alerts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            {/* Overdue Invoice Alerts */}
                            <div>
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Bell size={16} className="text-red-500" /> Overdue Invoice Alerts
                                    {overdueAlerts.length > 0 && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full">{overdueAlerts.length}</span>}
                                </h2>
                                <p className="text-xs text-gray-400 mb-4">Customers with unpaid invoices — take action now</p>
                                {overdueAlerts.length === 0 ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                                        <p className="text-emerald-700 font-black text-sm">✅ No overdue invoices!</p>
                                        <p className="text-emerald-500 text-xs mt-1">All customers are up to date</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {overdueAlerts.map((a, i) => (
                                            <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${a.days > 60 ? 'bg-red-50 border-red-200' : a.days > 30 ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">{a.customer}</p>
                                                    <p className="text-xs text-gray-500">{a.invoice} · {a.days > 0 ? `${a.days}d overdue` : 'Due today'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black font-mono text-red-700">{globalFormatCurrency(a.amount)}</p>
                                                    <span className={`text-[10px] font-black ${a.days > 60 ? 'text-red-600' : a.days > 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                                                        {a.days > 60 ? '🔴 Critical' : a.days > 30 ? '🟠 High' : '🟡 Medium'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Low Stock Alerts */}
                            <div>
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" /> Low Stock Alerts
                                    {lowStockAlerts.length > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full">{lowStockAlerts.length}</span>}
                                </h2>
                                <p className="text-xs text-gray-400 mb-4">Products below 20 units — reorder soon</p>
                                {lowStockAlerts.length === 0 ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                                        <p className="text-emerald-700 font-black text-sm">✅ All products well stocked!</p>
                                        <p className="text-emerald-500 text-xs mt-1">No products below reorder level</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {lowStockAlerts.map((s, i) => (
                                            <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-3 border ${s.stock === 0 ? 'bg-red-50 border-red-200' : s.stock < 10 ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">🛢️</span>
                                                    <div>
                                                        <p className="text-sm font-black text-gray-900">{s.name}</p>
                                                        <p className="text-xs text-gray-500">SKU: {s.sku}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-lg font-black font-mono ${s.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>{s.stock}</p>
                                                    <p className="text-[10px] font-black text-gray-500">units left</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Gross Margin per Product */}
                        <div>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-500" /> Gross Margin % by Product
                            </h2>
                            <p className="text-xs text-gray-400 mb-4">Which oil product makes you the most money</p>
                            {topProducts.length === 0 ? (
                                <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400 text-sm">No product sales data yet</div>
                            ) : (
                                <div className="bg-gray-50 rounded-2xl p-4 h-52">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topProducts.slice(0,5)} layout="vertical" margin={{ left: 80, right: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} width={75} />
                                            <Tooltip formatter={(v: any) => `${v}%`} />
                                            <Bar dataKey="margin" name="Gross Margin %" fill="#22c55e" radius={[0,4,4,0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                        <div>
                            <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-1">Accounts & Receivables</h2>
                            <p className="text-xs text-gray-400 mb-4">Track who owes you and what you owe suppliers</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { title: 'Aged Receivable', desc: 'Customers grouped by 0–30, 31–60, 61–90, 90+ days overdue', icon: '📅', color: 'border-red-200 bg-red-50', btn: 'bg-red-600', path: '/reports/aged-receivable' },
                                    { title: 'Aged Payable', desc: 'Supplier POs grouped by age — know what you owe Kenzol etc.', icon: '📤', color: 'border-amber-200 bg-amber-50', btn: 'bg-amber-600', path: '/reports/aged-payable' },
                                    { title: 'Outstanding Bills', desc: 'All unpaid & partial invoices in one place with filters', icon: '🧾', color: 'border-orange-200 bg-orange-50', btn: 'bg-orange-600', path: '/reports/outstanding-bills' },
                                ].map((r, i) => (
                                    <div key={i} className={`border-2 ${r.color} rounded-2xl p-5 flex flex-col justify-between gap-4`}>
                                        <div>
                                            <div className="text-3xl mb-3">{r.icon}</div>
                                            <h3 className="text-sm font-black text-gray-900 mb-1">{r.title}</h3>
                                            <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(r.path)}
                                            className={`${r.btn} text-white text-xs font-black uppercase px-4 py-2 rounded-xl hover:opacity-80 transition-all`}
                                        >
                                            Open Report →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-1">Financial Statements</h2>
                            <p className="text-xs text-gray-400 mb-4">Core accounting reports for month-end and audits</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { title: 'Day Book', desc: 'Every transaction for any selected date. Navigate day by day. Used by accountants daily.', icon: '📖', color: 'border-purple-200 bg-purple-50', btn: 'bg-purple-600', path: '/reports/day-book' },
                                    { title: 'Trial Balance', desc: 'All debits vs credits for month/quarter/year. Shows if books are balanced.', icon: '⚖️', color: 'border-indigo-200 bg-indigo-50', btn: 'bg-indigo-600', path: '/reports/trial-balance' },
                                ].map((r, i) => (
                                    <div key={i} className={`border-2 ${r.color} rounded-2xl p-5 flex flex-col justify-between gap-4`}>
                                        <div>
                                            <div className="text-3xl mb-3">{r.icon}</div>
                                            <h3 className="text-sm font-black text-gray-900 mb-1">{r.title}</h3>
                                            <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(r.path)}
                                            className={`${r.btn} text-white text-xs font-black uppercase px-4 py-2 rounded-xl hover:opacity-80 transition-all`}
                                        >
                                            Open Report →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'dimensional' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        {/* Dimensions Header */}
                        <div className="flex justify-between items-center bg-redwood-bg-light p-4 rounded-sm border border-redwood-border">
                            <h2 className="text-sm font-black text-redwood-text-main uppercase tracking-widest flex items-center gap-2">
                                <Filter size={16} className="text-redwood-brand" /> Profitability by Dimension
                            </h2>
                            <div className="text-xs text-redwood-text-muted">Analysis: Who, What, Where, Why</div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Customer Profitability */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <div className="bg-redwood-bg-light/50 p-3 border-b border-redwood-border flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-redwood-text-muted">Customer Profitability (Top & Bottom)</h3>
                                    <Users size={14} className="text-redwood-text-muted" />
                                </div>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                                        <tr><th className="p-3">Customer</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Margin</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {dimensionalData?.byCustomer.map((c, i) => (
                                            <tr key={i} className="hover:bg-redwood-bg-light/30">
                                                <td className="p-3 font-bold text-redwood-text-main flex flex-col">
                                                    <span>{c.customerName}</span>
                                                    <span className="text-[9px] text-gray-400 font-normal">Cost-to-Serve: ${c.costToServe}</span>
                                                </td>
                                                <td className="p-3 text-right">${c.revenue.toLocaleString()}</td>
                                                <td className={clsx("p-3 text-right font-bold", c.profit > 0 ? 'text-emerald-600' : 'text-rose-600')}>${c.profit.toLocaleString()}</td>
                                                <td className={clsx("p-3 text-right font-bold", c.margin > 20 ? 'text-emerald-600' : c.margin < 0 ? 'text-rose-600' : 'text-amber-600')}>{c.margin.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Salesman Performance */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <div className="bg-redwood-bg-light/50 p-3 border-b border-redwood-border flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-redwood-text-muted">Salesman Performance</h3>
                                    <Users size={14} className="text-redwood-text-muted" />
                                </div>
                                <div className="p-4 space-y-4">
                                    {dimensionalData?.bySalesman.map((s, i) => (
                                        <div key={i} className="flex flex-col gap-2 p-3 border border-redwood-border rounded-sm">
                                            <div className="flex justify-between font-black text-sm text-redwood-text-main">
                                                <span>{s.employeeName}</span>
                                                <span className="text-emerald-600">${s.profit.toLocaleString()} Profit</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-redwood-text-muted">
                                                <span>Revenue: ${s.revenue.toLocaleString()}</span>
                                                <span>Margin: {s.margin.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1">
                                                <div className="bg-redwood-brand h-1.5 rounded-full" style={{ width: `${Math.min(s.margin, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Product/SKU Profitability */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <div className="bg-redwood-bg-light/50 p-3 border-b border-redwood-border flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-redwood-text-muted">Product & SKU Insights</h3>
                                    <Briefcase size={14} className="text-redwood-text-muted" />
                                </div>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                                        <tr><th className="p-3">Product</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Margin</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {dimensionalData?.byProduct.map((p, i) => (
                                            <tr key={i} className={clsx("hover:bg-redwood-bg-light/30")}>
                                                <td className="p-3 font-bold text-redwood-text-main">
                                                    {p.productName}
                                                </td>
                                                <td className={clsx("p-3 text-right", p.profit > 0 ? 'text-emerald-600' : 'text-rose-600')}>${p.profit.toLocaleString()}</td>
                                                <td className="p-3 text-right font-mono">{p.margin.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Channel Profit */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Channel Profit Mix</h3>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dimensionalData?.byChannel || []} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                            <YAxis dataKey="channel" type="category" tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                            <Tooltip />
                                            <Bar dataKey="profit" name="Profit" fill="#00758F" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
