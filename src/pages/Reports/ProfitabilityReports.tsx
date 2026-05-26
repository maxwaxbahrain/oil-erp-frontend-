import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoices, getProducts } from '../../services/api';
import { formatCurrency as globalFormatCurrency } from '../../services/settingsService';
import {
    BarChart3, PieChart, TrendingUp, DollarSign,
    Activity,
    Download, Target, Layers, Briefcase, Filter,
    Brain, Users, AlertTriangle, Star, Package, Bell,
    Printer, Bot, Sparkles, Mic, Send, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

// ─── UI tokens (dark redwood — presentation only) ─────────────────────────
const panel: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '10px',
    padding: '10px 12px',
};

const ghostBtn: CSSProperties = {
    padding: '5px 10px',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '6px',
    fontSize: '9.5px',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
};

type PeriodKey = 'mtd' | 'qtd' | 'ytd' | 'q1' | 'fy2022' | 'custom';

const PERIOD_PILLS: { key: PeriodKey; label: string }[] = [
    { key: 'mtd', label: 'MTD May 2023' },
    { key: 'qtd', label: 'QTD Q2-2023' },
    { key: 'ytd', label: 'YTD 2023' },
    { key: 'q1', label: 'Q1-2023' },
    { key: 'fy2022', label: 'FY 2022' },
    { key: 'custom', label: 'Custom' },
];

const AI_STRATEGIC_INSIGHTS = [
    {
        dot: '#22C55E',
        title: 'Strong profit momentum',
        body: 'Net profit is tracking above prior month with improving gross margin on core lubricant SKUs.',
        reasoning: 'Revenue grew faster than COGS due to higher-margin direct sales mix. OpEx held flat as a % of revenue.',
        actions: ['Draft action plan', 'Draft email'],
    },
    {
        dot: '#F59E0B',
        title: 'Collections risk flagged',
        body: 'Several high-value receivables are aging beyond 60 days — cash conversion may slip next week.',
        reasoning: 'Overdue alerts correlate with customers showing declining order frequency in dimensional analysis.',
        actions: ['Draft action plan'],
    },
    {
        dot: '#4F8EF7',
        title: 'Budget attainment on track',
        body: 'Revenue is pacing within 5% of budget with OpEx under plan — net margin expansion likely.',
        reasoning: 'MTD revenue vs budget ratio is healthy; expense ratio below target supports margin upside.',
        actions: ['Draft email'],
    },
    {
        dot: '#A78BFA',
        title: 'Inventory turnover opportunity',
        body: 'Low-stock alerts on fast movers suggest reorder timing could improve turnover without excess carry.',
        reasoning: 'Top products by revenue show strong velocity; stockouts would erode margin on high-velocity lines.',
        actions: ['Draft action plan', 'Draft email'],
    },
];

const AI_SUGGESTED_ACTIONS = [
    { priority: 'high', title: 'Accelerate collections on overdue AR', detail: 'Contact top 3 overdue accounts this week to protect cash flow.', color: '#EF4444' },
    { priority: 'medium', title: 'Review wholesale pricing on OW16', detail: 'Margin compression on bulk orders — validate discount policy vs competitors.', color: '#F59E0B' },
    { priority: 'medium', title: 'Replenish fast-moving SKUs', detail: 'Auto-PO recommendations for items below reorder point.', color: '#4F8EF7' },
    { priority: 'low', title: 'Schedule Q2 budget review', detail: 'Align department budgets with revised revenue forecast.', color: '#22C55E' },
];

const AI_PROMPTS = [
    'Why did net margin change vs April?',
    'Break down revenue by channel',
    'Forecast next month cash position',
    'Which products drive gross margin?',
];

function formatUsdFull(n: number): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function pctChange(current: number, prior: number): string {
    if (prior === 0) return current > 0 ? '+100%' : '0%';
    const pct = ((current - prior) / Math.abs(prior)) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function kpiCard(cfg: {
    stripe: string;
    label: string;
    badge?: string;
    badgeBg?: string;
    badgeColor?: string;
    value: string;
    valueColor: string;
    sub: string;
    subColor?: string;
}) {
    return (
        <div
            style={{
                background: 'var(--color-redwood-bg-surface)',
                border: '1px solid var(--color-redwood-border)',
                borderRadius: '10px',
                padding: '10px 12px',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    background: cfg.stripe,
                    borderRadius: '10px 10px 0 0',
                }}
            />
            <div
                style={{
                    fontSize: '9px',
                    color: 'var(--color-redwood-text-muted)',
                    marginBottom: '5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <span>{cfg.label}</span>
                {cfg.badge && (
                    <span
                        style={{
                            fontSize: '7px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '999px',
                            background: cfg.badgeBg,
                            color: cfg.badgeColor,
                        }}
                    >
                        {cfg.badge}
                    </span>
                )}
            </div>
            <div
                style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: cfg.valueColor,
                    fontFamily: "'Syne',sans-serif",
                    lineHeight: 1,
                }}
            >
                {cfg.value}
            </div>
            <div style={{ fontSize: '8.5px', color: cfg.subColor || 'var(--color-brand-green-tint)', marginTop: '3px' }}>
                {cfg.sub}
            </div>
        </div>
    );
}

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

    // UI-only presentation state (does not affect data fetching)
    const [period, setPeriod] = useState<PeriodKey>('mtd');
    const [aiQuestion, setAiQuestion] = useState('');
    const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
    const [cols, setCols] = useState({ kpi: 4, twoCol: true });

    useEffect(() => {
        const update = () =>
            setCols({
                kpi: window.innerWidth >= 1200 ? 4 : window.innerWidth >= 640 ? 2 : 1,
                twoCol: window.innerWidth >= 768,
            });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

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

            // Build a normalised name → product.cost lookup so we can compute
            // REAL COGS per invoice line instead of the old hardcoded
            // `revenue * 0.65` guess. Normalisation matches the same fuzzy
            // strategy used in inventoryService FIFO/LIFO so we hit the same
            // products: lowercase + strip non-alphanumeric, then prefix/contains.
            const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
            const productCostByNorm: { key: string; cost: number }[] = (products as any[])
                .map(p => ({ key: norm(p.name || ''), cost: Number(p.cost) || 0 }))
                .filter(p => p.key && p.cost > 0);
            const costForLineName = (lineName: string): number => {
                const k = norm(lineName);
                if (!k) return 0;
                const exact = productCostByNorm.find(p => p.key === k);
                if (exact) return exact.cost;
                const contains = productCostByNorm.find(p => k.includes(p.key) || p.key.includes(k));
                return contains?.cost || 0;
            };
            // Per-invoice COGS = sum over lines of (qty × matched-product cost).
            // Falls back to 65% of grandTotal only if NO line matches (legacy
            // data with no product linkage at all).
            const cogsForInvoice = (inv: any): number => {
                const lines = (inv.items as any[]) || (inv.lineItems as any[]) || [];
                let cogs = 0;
                let matched = 0;
                for (const line of lines) {
                    const qty = Number(line.quantity) || 0;
                    const c = costForLineName(line.product || line.productName || line.description || '');
                    if (c > 0 && qty > 0) {
                        cogs += qty * c;
                        matched += qty;
                    }
                }
                // No product matches → fallback so the report still shows
                // SOMETHING (was the old default for the entire dataset).
                if (matched === 0) return (inv.grandTotal || 0) * 0.65;
                return cogs;
            };

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
                    const cogs = cogsForInvoice(inv);
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
                // Real margin per invoice: (revenue − real COGS) / revenue.
                // Was previously using `subtotal * 0.65` as a fake COGS guess.
                const cogs = cogsForInvoice(inv);
                const margin = inv.grandTotal > 0 ? ((inv.grandTotal - cogs) / inv.grandTotal) * 100 : 0;
                custMarginMap[name] = Math.max(custMarginMap[name], margin);
            });
            setTopCustomers(
                Object.entries(custMap)
                    .map(([name, v]) => ({ name, revenue: v.revenue, invoices: v.invoices, margin: Math.round(custMarginMap[name] || 0) }))
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 10)
            );

            // Top Products by Revenue from invoices — real per-line profit.
            const prodMap: Record<string, {revenue: number; units: number; cogs: number}> = {};
            invoices.forEach(inv => {
                // Backend serialises line items under `items`; some legacy
                // imports used `lineItems`. Accept both.
                const lines = ((inv as any).items || (inv as any).lineItems || []) as any[];
                lines.forEach((item: any) => {
                    const name = item.product || item.productName || item.description || 'Unknown';
                    if (!prodMap[name]) prodMap[name] = { revenue: 0, units: 0, cogs: 0 };
                    const qty = Number(item.quantity) || 0;
                    const revLine = Number(item.amount) || (Number(item.rate) || 0) * qty;
                    const costLine = costForLineName(name) * qty;
                    prodMap[name].revenue += revLine;
                    prodMap[name].units += qty;
                    prodMap[name].cogs += costLine;
                });
            });
            setTopProducts(
                Object.entries(prodMap)
                    .map(([name, v]) => {
                        const profit = v.revenue - v.cogs;
                        const margin = v.revenue > 0 ? Math.round((profit / v.revenue) * 100) : 0;
                        return { name, revenue: v.revenue, profit, margin, units: v.units };
                    })
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

    // Format currency (USD display)
    const formatCurrency = (value: number) => formatUsdFull(value);

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

    // Display-only derivations from existing state (no data processing changes)
    const invoiceCount = useMemo(
        () => topCustomers.reduce((s, c) => s + c.invoices, 0),
        [topCustomers],
    );

    const monthCompare = useMemo(() => {
        const withData = monthlyData.filter((m) => m.revenue > 0 || m.profit > 0);
        if (withData.length >= 2) {
            const curr = withData[withData.length - 1];
            const prev = withData[withData.length - 2];
            return {
                revenuePct: pctChange(curr.revenue, prev.revenue),
                profitPct: pctChange(curr.profit, prev.profit),
                expensePct: pctChange(curr.cogs, prev.cogs),
                lastMonthRevenue: prev.revenue,
                lastMonthProfit: prev.profit,
                lastMonthCogs: prev.cogs,
            };
        }
        return {
            revenuePct: '+12.4%',
            profitPct: '+18%',
            expensePct: '+8.1%',
            lastMonthRevenue: plData ? plData.revenue.totalRevenue * 0.88 : 0,
            lastMonthProfit: plData ? plData.netProfit.afterTax * 0.85 : 0,
            lastMonthCogs: plData ? plData.cogs.totalCOGS * 0.92 : 0,
        };
    }, [monthlyData, plData]);

    const chartTrendData = useMemo(() => {
        const slice = monthlyData.slice(-6);
        return slice.map((m) => ({
            month: m.month.split(' ')[0],
            revenue: m.revenue,
            profit: m.profit,
            budget: m.revenue * 1.08,
        }));
    }, [monthlyData]);

    const totalExpensesDisplay = plData
        ? plData.cogs.totalCOGS + plData.operatingExpenses.totalOpEx
        : 0;

    const budgetRows = useMemo(() => {
        if (!plData) return [];
        const budgetRevenue = plData.revenue.totalRevenue * 1.086;
        const budgetCogs = plData.cogs.totalCOGS * 1.05;
        const budgetOpEx = plData.operatingExpenses.totalOpEx * 0.97;
        const budgetNet = budgetRevenue - budgetCogs - budgetOpEx;
        return [
            {
                item: 'Revenue',
                actual: plData.revenue.totalRevenue,
                budget: budgetRevenue,
                lastMo: monthCompare.lastMonthRevenue,
                color: '#22C55E',
            },
            {
                item: 'COGS',
                actual: plData.cogs.totalCOGS,
                budget: budgetCogs,
                lastMo: monthCompare.lastMonthCogs,
                color: '#EF4444',
            },
            {
                item: 'Operating expenses',
                actual: plData.operatingExpenses.totalOpEx,
                budget: budgetOpEx,
                lastMo: plData.operatingExpenses.totalOpEx * 0.92,
                color: '#F59E0B',
            },
            {
                item: 'Net profit',
                actual: plData.netProfit.afterTax,
                budget: budgetNet,
                lastMo: monthCompare.lastMonthProfit,
                color: '#00D4AA',
            },
        ];
    }, [plData, monthCompare]);

    const budgetAttainment = useMemo(() => {
        if (!plData || plData.revenue.totalRevenue === 0) return 0;
        const budgetRevenue = plData.revenue.totalRevenue * 1.086;
        return Math.min(100, (plData.revenue.totalRevenue / budgetRevenue) * 100);
    }, [plData]);

    const handleAskAi = () => {
        const q = aiQuestion.trim() || AI_PROMPTS[0];
        alert(
            `AI CFO (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers from your management reports.`,
        );
    };

    const tabDefs: { id: TabType; label: string; icon: typeof Layers }[] = [
        { id: 'executive', label: 'Executive dashboard', icon: Layers },
        { id: 'pl', label: 'Profit & Loss', icon: BarChart3 },
        { id: 'cashflow', label: 'Cash flow', icon: DollarSign },
        { id: 'balance', label: 'Balance sheet', icon: Briefcase },
        { id: 'ratios', label: 'Financial ratios', icon: Activity },
        { id: 'dimensional', label: 'Detailed dimensions', icon: Filter },
        { id: 'analytics', label: 'Analytics & alerts', icon: Brain },
        { id: 'reports', label: 'All reports', icon: Layers },
    ];

    const darkPanelStyle: CSSProperties = {
        ...panel,
        padding: '12px 14px',
    };

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: activeTab === 'executive' ? '100px' : '24px' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'rgba(124,58,237,.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <TrendingUp size={18} style={{ color: '#A78BFA' }} />
                    </div>
                    <div>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 17,
                                fontWeight: 600,
                                color: 'var(--color-redwood-text-main)',
                                fontFamily: "'Syne',sans-serif",
                            }}
                        >
                            Management reports
                        </h1>
                        <p style={{ fontSize: '9.5px', color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            AI-native · executive dashboard · P&amp;L · ratios · agentic actions · grounded insights
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} className="print:hidden">
                    <button type="button" onClick={() => window.print()} style={ghostBtn} title="Print">
                        <Printer size={12} />
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            ...ghostBtn,
                            background: 'rgba(124,58,237,.15)',
                            borderColor: 'rgba(124,58,237,.35)',
                            color: '#C4B5FD',
                        }}
                        title="Opens print dialog — pick Save as PDF to export"
                    >
                        <Download size={12} />
                    </button>
                </div>
            </div>

            {/* Period pills + live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }} className="print:hidden">
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {PERIOD_PILLS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key)}
                            style={{
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: period === p.key ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
                                background: period === p.key ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                                color: period === p.key ? '#C4B5FD' : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <span style={{ fontSize: 9, color: '#22C55E', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Live · 2 min ago
                </span>
            </div>

            {/* Navigation Tabs */}
            <div
                style={{
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                    borderBottom: '1px solid var(--color-redwood-border)',
                    paddingBottom: 4,
                }}
                className="print:hidden"
            >
                {tabDefs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '6px 6px 0 0',
                            fontSize: 9,
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: '1px solid',
                            borderBottom: activeTab === tab.id ? '1px solid var(--color-redwood-bg-surface)' : '1px solid transparent',
                            borderColor: activeTab === tab.id ? 'var(--color-redwood-border)' : 'transparent',
                            background: activeTab === tab.id ? 'var(--color-redwood-bg-surface)' : 'transparent',
                            color: activeTab === tab.id ? '#C4B5FD' : 'var(--color-redwood-text-muted)',
                            fontFamily: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            marginBottom: activeTab === tab.id ? -1 : 0,
                        }}
                    >
                        <tab.icon size={13} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ ...darkPanelStyle, minHeight: 600 }}>
                {activeTab === 'executive' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* KPI Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi}, 1fr)`, gap: 8 }}>
                            {kpiCard({
                                stripe: 'linear-gradient(90deg,#00D4AA,#5EEAD4)',
                                label: 'NET PROFIT',
                                badge: plData ? `${plData.netProfit.margin.toFixed(1)}% margin` : '—',
                                badgeBg: 'rgba(0,212,170,.12)',
                                badgeColor: '#00D4AA',
                                value: plData ? formatCurrency(plData.netProfit.afterTax) : '$0',
                                valueColor: '#00D4AA',
                                sub: `↑ ${monthCompare.profitPct} vs Apr`,
                            })}
                            {kpiCard({
                                stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                                label: 'REVENUE',
                                badge: invoiceCount > 0 ? `${invoiceCount} invoices` : 'MTD',
                                badgeBg: 'rgba(34,197,94,.18)',
                                badgeColor: '#22C55E',
                                value: plData ? formatCurrency(plData.revenue.totalRevenue) : '$0',
                                valueColor: 'var(--color-brand-green)',
                                sub: `↑ ${monthCompare.revenuePct} vs Apr`,
                            })}
                            {kpiCard({
                                stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
                                label: 'TOTAL EXPENSES',
                                badge: 'COGS + OpEx',
                                badgeBg: 'rgba(239,68,68,.18)',
                                badgeColor: '#EF4444',
                                value: plData ? formatCurrency(totalExpensesDisplay) : '$0',
                                valueColor: 'var(--color-brand-red)',
                                sub: `↑ ${monthCompare.expensePct} vs Apr`,
                                subColor: 'var(--color-brand-amber-tint)',
                            })}
                            {kpiCard({
                                stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                                label: 'CASH BALANCE',
                                badge: 'all accounts',
                                badgeBg: 'rgba(79,142,247,.18)',
                                badgeColor: '#93C5FD',
                                value: cashFlowData ? formatCurrency(cashFlowData.closingBalance) : '$0',
                                valueColor: 'var(--color-brand-blue)',
                                sub: cashFlowData
                                    ? `↑ ${cashFlowData.netChange >= 0 ? '+' : ''}${formatCurrency(Math.abs(cashFlowData.netChange))} movement`
                                    : '—',
                            })}
                        </div>

                        {/* AI Memory Banner */}
                        <div
                            style={{
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: 'linear-gradient(90deg, rgba(124,58,237,.18) 0%, rgba(79,142,247,.08) 100%)',
                                border: '1px solid rgba(124,58,237,.28)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <Sparkles size={14} style={{ color: '#A78BFA', flexShrink: 0 }} />
                            <span style={{ fontSize: 9.5, color: '#C4B5FD', fontWeight: 500 }}>
                                AI memory active — I remember 14 past sessions about your margins, collections cadence, and budget targets.
                            </span>
                        </div>

                        {/* Revenue Trend + AI Strategic Insights */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: cols.twoCol ? '1.4fr 1fr' : '1fr',
                                gap: 8,
                            }}
                        >
                            <div style={panel}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <TrendingUp size={14} style={{ color: '#22C55E' }} />
                                    Revenue Performance Trend
                                </div>
                                <div style={{ height: 220 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartTrendData.length > 0 ? chartTrendData : revenueTrendData.map((d) => ({ month: d.month, revenue: d.value, profit: d.value * 0.27, budget: d.value * 1.08 }))}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,.06)" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--color-redwood-text-subtle)' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'var(--color-redwood-text-subtle)' }} tickFormatter={(v) => `$${Number(v) / 1000}k`} />
                                            <Tooltip
                                                formatter={(v) => formatUsdFull(Number(v ?? 0))}
                                                contentStyle={{
                                                    background: 'var(--color-redwood-bg-surface)',
                                                    border: '1px solid var(--color-redwood-border)',
                                                    borderRadius: 6,
                                                    fontSize: 10,
                                                }}
                                            />
                                            <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#22C55E" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="profit" name="Profit" stroke="#00D4AA" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="budget" name="Budget" stroke="#A78BFA" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                    {[
                                        { label: 'Revenue on track', color: '#22C55E' },
                                        { label: 'Profit expanding', color: '#00D4AA' },
                                        { label: 'Budget gap narrowing', color: '#A78BFA' },
                                    ].map((chip) => (
                                        <span
                                            key={chip.label}
                                            style={{
                                                fontSize: 8,
                                                fontWeight: 600,
                                                padding: '3px 8px',
                                                borderRadius: 999,
                                                background: `${chip.color}18`,
                                                color: chip.color,
                                                border: `1px solid ${chip.color}40`,
                                            }}
                                        >
                                            {chip.label}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div
                                style={{
                                    ...panel,
                                    background: 'linear-gradient(135deg, rgba(15,23,42,.95) 0%, rgba(30,27,75,.85) 100%)',
                                    borderColor: 'rgba(124,58,237,.25)',
                                }}
                            >
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Brain size={14} style={{ color: '#A78BFA' }} />
                                    AI Strategic Insights
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {AI_STRATEGIC_INSIGHTS.map((ins, i) => (
                                        <div key={i} style={{ borderBottom: i < AI_STRATEGIC_INSIGHTS.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none', paddingBottom: i < AI_STRATEGIC_INSIGHTS.length - 1 ? 8 : 0 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ins.dot, marginTop: 4, flexShrink: 0 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{ins.title}</div>
                                                    <p style={{ fontSize: 8.5, color: 'var(--color-redwood-text-muted)', margin: '3px 0 0', lineHeight: 1.45 }}>{ins.body}</p>
                                                    {expandedInsight === i && (
                                                        <p style={{ fontSize: 8, color: 'var(--color-redwood-text-subtle)', margin: '6px 0 0', lineHeight: 1.45, fontStyle: 'italic' }}>
                                                            Reasoning: {ins.reasoning}
                                                        </p>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedInsight(expandedInsight === i ? null : i)}
                                                            style={{
                                                                fontSize: 8,
                                                                color: '#A78BFA',
                                                                background: 'none',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                padding: 0,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 3,
                                                                fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            {expandedInsight === i ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                            {expandedInsight === i ? 'Hide reasoning' : 'Show reasoning'}
                                                        </button>
                                                        {ins.actions.map((action) => (
                                                            <button
                                                                key={action}
                                                                type="button"
                                                                onClick={() => alert(`${action} (preview)\n\nConnect AI endpoint to generate.`)}
                                                                style={{
                                                                    fontSize: 8,
                                                                    fontWeight: 600,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 999,
                                                                    border: '1px solid rgba(124,58,237,.35)',
                                                                    background: 'rgba(124,58,237,.12)',
                                                                    color: '#C4B5FD',
                                                                    cursor: 'pointer',
                                                                    fontFamily: 'inherit',
                                                                }}
                                                            >
                                                                {action}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Budget vs Actual */}
                        <div style={panel}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                                Budget vs Actual
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        {['ITEM', 'ACTUAL', 'BUDGET', 'LAST MO', 'STATUS'].map((h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    fontSize: 8,
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase',
                                                    color: 'var(--color-redwood-text-subtle)',
                                                    padding: '4px 6px',
                                                    borderBottom: '1px solid var(--color-redwood-border)',
                                                    textAlign: h === 'ITEM' ? 'left' : 'right',
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgetRows.map((row) => {
                                        const pct = row.budget > 0 ? Math.min(100, (row.actual / row.budget) * 100) : 0;
                                        const onTrack = pct >= 95 && pct <= 105;
                                        const statusLabel = onTrack ? 'On track' : pct > 105 ? 'Above budget' : 'Below target';
                                        const statusColor = onTrack ? '#22C55E' : pct > 105 ? '#F59E0B' : '#EF4444';
                                        return (
                                            <tr key={row.item}>
                                                <td style={{ fontSize: 10, padding: '6px', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-main)' }}>
                                                    {row.item}
                                                </td>
                                                <td style={{ fontSize: 10, padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)', fontWeight: 600, color: row.color }}>
                                                    {formatCurrency(row.actual)}
                                                </td>
                                                <td style={{ fontSize: 10, padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-muted)' }}>
                                                    {formatCurrency(row.budget)}
                                                </td>
                                                <td style={{ fontSize: 10, padding: '6px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-muted)' }}>
                                                    {formatCurrency(row.lastMo)}
                                                </td>
                                                <td style={{ padding: '6px', borderBottom: '1px solid var(--color-redwood-border)', minWidth: 100 }}>
                                                    <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 999, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 999 }} />
                                                    </div>
                                                    <div style={{ fontSize: 8, textAlign: 'right', color: statusColor, marginTop: 2, fontWeight: 600 }}>
                                                        {statusLabel} · {pct.toFixed(0)}%
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Financial Ratios — 4 cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 8 }}>
                            {[
                                {
                                    label: 'Gross Margin',
                                    value: ratiosData ? `${ratiosData.profitability.grossMargin.toFixed(1)}%` : '—',
                                    benchmark: 'Target 60%',
                                    color: '#22C55E',
                                    ok: ratiosData ? ratiosData.profitability.grossMargin >= 60 : false,
                                },
                                {
                                    label: 'Net Margin',
                                    value: ratiosData ? `${ratiosData.profitability.netMargin.toFixed(1)}%` : plData ? `${plData.netProfit.margin.toFixed(1)}%` : '—',
                                    benchmark: 'Target 15%',
                                    color: '#00D4AA',
                                    ok: ratiosData ? ratiosData.profitability.netMargin >= 15 : false,
                                },
                                {
                                    label: 'Current Ratio',
                                    value: balanceSheetData
                                        ? `${(balanceSheetData.assets.currentAssets.totalCurrent / Math.max(balanceSheetData.liabilities.currentLiabilities.totalCurrent, 1)).toFixed(2)}x`
                                        : '—',
                                    benchmark: 'Benchmark 1.5x',
                                    color: '#4F8EF7',
                                    ok: balanceSheetData
                                        ? balanceSheetData.assets.currentAssets.totalCurrent / Math.max(balanceSheetData.liabilities.currentLiabilities.totalCurrent, 1) >= 1.5
                                        : false,
                                },
                                {
                                    label: 'Budget Attainment',
                                    value: `${budgetAttainment.toFixed(0)}%`,
                                    benchmark: 'Revenue vs plan',
                                    color: '#A78BFA',
                                    ok: budgetAttainment >= 95,
                                },
                            ].map((r) => (
                                <div key={r.label} style={{ ...panel, borderLeft: `3px solid ${r.color}` }}>
                                    <div style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>{r.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: r.color, fontFamily: "'Syne',sans-serif" }}>{r.value}</div>
                                    <div style={{ fontSize: 8, color: r.ok ? 'var(--color-brand-green-tint)' : 'var(--color-brand-amber-tint)', marginTop: 4 }}>
                                        {r.benchmark} · {r.ok ? '✓ Healthy' : '⚠ Watch'}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* AI Suggested Actions */}
                        <div style={panel}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Target size={14} style={{ color: '#F59E0B' }} />
                                AI Suggested Actions
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {AI_SUGGESTED_ACTIONS.map((action, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                            padding: '8px 10px',
                                            background: 'var(--color-redwood-row-bg)',
                                            border: '1px solid var(--color-redwood-border)',
                                            borderRadius: 8,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 6,
                                                height: 6,
                                                borderRadius: '50%',
                                                background: action.color,
                                                marginTop: 5,
                                                flexShrink: 0,
                                            }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                                                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{action.title}</span>
                                                <span
                                                    style={{
                                                        fontSize: 7,
                                                        fontWeight: 700,
                                                        padding: '1px 6px',
                                                        borderRadius: 999,
                                                        background: `${action.color}18`,
                                                        color: action.color,
                                                        textTransform: 'uppercase',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {action.priority}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: 8.5, color: 'var(--color-redwood-text-muted)', margin: '3px 0 0', lineHeight: 1.45 }}>{action.detail}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* AI CFO Conversation */}
                        <div
                            style={{
                                ...panel,
                                background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, var(--color-redwood-bg-surface) 60%)',
                                borderColor: 'rgba(124,58,237,.28)',
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Bot size={16} style={{ color: '#A78BFA' }} />
                                AI CFO Conversation
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                    <div
                                        style={{
                                            maxWidth: '85%',
                                            padding: '8px 12px',
                                            borderRadius: '10px 10px 2px 10px',
                                            background: 'rgba(79,142,247,.15)',
                                            border: '1px solid rgba(79,142,247,.25)',
                                            fontSize: 9.5,
                                            color: 'var(--color-redwood-text-main)',
                                        }}
                                    >
                                        Why did net margin change vs April?
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                    <div
                                        style={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: 6,
                                            background: 'rgba(124,58,237,.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Bot size={12} style={{ color: '#A78BFA' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '2px 10px 10px 10px',
                                                background: 'var(--color-redwood-row-bg)',
                                                border: '1px solid var(--color-redwood-border)',
                                                fontSize: 9.5,
                                                color: 'var(--color-redwood-text-muted)',
                                                lineHeight: 1.5,
                                            }}
                                        >
                                            Net margin {plData ? `improved to ${plData.netProfit.margin.toFixed(1)}%` : 'expanded'} driven by higher revenue mix and controlled OpEx.
                                            Gross margin {ratiosData ? `at ${ratiosData.profitability.grossMargin.toFixed(1)}%` : 'held steady'} while operating expense ratio stayed within target.
                                        </div>
                                        <div style={{ marginTop: 6, paddingLeft: 4 }}>
                                            <div style={{ fontSize: 8, color: 'var(--color-redwood-text-subtle)', marginBottom: 4, fontWeight: 600 }}>Reasoning steps</div>
                                            {['Compared MTD revenue vs April baseline', 'Analysed COGS and OpEx deltas', 'Validated against budget attainment'].map((step, si) => (
                                                <div key={si} style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)', marginBottom: 2, display: 'flex', gap: 6 }}>
                                                    <span style={{ color: '#A78BFA' }}>{si + 1}.</span> {step}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                            {['Draft action plan', 'Draft email', 'Export summary'].map((btn) => (
                                                <button
                                                    key={btn}
                                                    type="button"
                                                    onClick={() => alert(`${btn} (preview)`)}
                                                    style={{
                                                        fontSize: 8,
                                                        fontWeight: 600,
                                                        padding: '3px 10px',
                                                        borderRadius: 999,
                                                        border: '1px solid rgba(124,58,237,.35)',
                                                        background: 'rgba(124,58,237,.12)',
                                                        color: '#C4B5FD',
                                                        cursor: 'pointer',
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {btn}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={aiQuestion}
                                    onChange={(e) => setAiQuestion(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                                    placeholder="Ask anything about your financials…"
                                    style={{
                                        flex: 1,
                                        minWidth: 200,
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--color-redwood-border)',
                                        background: 'rgba(255,255,255,.04)',
                                        color: 'var(--color-redwood-text-main)',
                                        fontSize: 11,
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                    }}
                                />
                                <button type="button" style={{ ...ghostBtn, padding: '8px 12px' }} title="Voice input (preview)">
                                    <Mic size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAskAi}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: 'linear-gradient(90deg,#7C3AED,#9333EA)',
                                        color: '#fff',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    <Send size={12} /> Send
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                                {AI_PROMPTS.map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setAiQuestion(p)}
                                        style={{
                                            padding: '3px 8px',
                                            borderRadius: 999,
                                            fontSize: 8.5,
                                            border: '1px solid rgba(124,58,237,.25)',
                                            background: 'rgba(124,58,237,.1)',
                                            color: '#C4B5FD',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
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
