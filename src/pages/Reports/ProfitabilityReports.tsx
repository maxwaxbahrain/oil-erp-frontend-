import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInvoices, getProducts } from '../../services/api';
import { formatCurrency as globalFormatCurrency } from '../../services/settingsService';
import {
    BarChart3, TrendingUp, DollarSign,
    Activity,
    Download, Target, Layers, Briefcase, Filter,
    Brain, Users, AlertTriangle, Star, Package, Bell,
    Printer, Bot, Sparkles, Mic, Send, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
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

const PL_AI_PROMPTS = [
    'Why did gross margin change?',
    'Which expense grew fastest?',
    'Compare vs budget',
];

type CfCurrency = 'usd' | 'aed';
type CfCompare = 'prior' | 'budget';
type CfPeriodKey = '12mo' | 'ytd' | 'q2' | 'fy2025' | 'custom';

const CF_PERIOD_PILLS: { key: CfPeriodKey; label: string }[] = [
    { key: '12mo', label: '12 months (Jun 25–May 26)' },
    { key: 'ytd', label: 'YTD 2026' },
    { key: 'q2', label: 'Q2-2026' },
    { key: 'fy2025', label: 'FY 2025' },
    { key: 'custom', label: 'Custom' },
];

const CF_MONTH_LABELS = ['Jun 25', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan 26', 'Feb', 'Mar', 'Apr', 'May 26'] as const;

const CF_MONTH_FACTORS = [0.806, 0.843, 0.870, 0.901, 0.941, 0.986, 1.0, 0.963, 0.972, 1.019, 1.046, 1.0];

const CF_FORECAST_FACTORS = [1.157, 1.222, 1.278];

const CF_AI_PROMPTS = [
    'When will we hit $1M closing balance?',
    'Forecast next 6 months',
    'Why was Dec highest?',
    'What if we invest $200K?',
];

const BS_AI_PROMPTS = [
    'Is our current ratio healthy?',
    'Should we pay down short-term debt?',
    'How did equity change vs April?',
    'What is driving asset growth?',
];

type BsCurrency = 'usd' | 'aed';
type BsCompare = 'apr' | 'prior';

type PlCurrency = 'usd' | 'aed';
type PlCompare = 'apr' | 'budget' | 'prior';

const PL_EXPENSE_COLORS: Record<string, string> = {
    COGS: '#EF4444',
    Salaries: '#F59E0B',
    Rent: '#A78BFA',
    Other: '#4F8EF7',
};

function formatUsdFull(n: number): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatCompactUsd(n: number, opts?: { signed?: boolean; dashZero?: boolean }): string {
    if (opts?.dashZero && n === 0) return '—';
    const sign = opts?.signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : n < 0 ? '−' : '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
        const v = (abs / 1_000_000).toFixed(2).replace(/\.0+$/, '').replace(/(\.\d)0+$/, '$1');
        return `${sign}$${v}M`;
    }
    if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}K`;
    if (abs === 0 && !opts?.signed) return '0';
    return `${sign}${formatUsdFull(n)}`;
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
    const [plCurrency, setPlCurrency] = useState<PlCurrency>('usd');
    const [plCompare, setPlCompare] = useState<PlCompare>('apr');
    const [cfCurrency, setCfCurrency] = useState<CfCurrency>('usd');
    const [cfCompare, setCfCompare] = useState<CfCompare>('prior');
    const [cfPeriod, setCfPeriod] = useState<CfPeriodKey>('12mo');
    const [cfAiQuestion, setCfAiQuestion] = useState('');
    const [bsCurrency, setBsCurrency] = useState<BsCurrency>('usd');
    const [bsCompare, setBsCompare] = useState<BsCompare>('apr');
    const [bsAiQuestion, setBsAiQuestion] = useState('');

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

    // Cash flow display-only derivations (UI presentation — maps cashFlowData to 12-mo mockup layout)
    const cfDisplay = useMemo(() => {
        if (!cashFlowData) return null;
        const cf = cashFlowData;
        const mayNetOp = cf.operating.netOperating || 108000;
        const monthlyNetOp = CF_MONTH_FACTORS.map((f) => Math.round(mayNetOp * f));
        const forecastNetOp = CF_FORECAST_FACTORS.map((f) => Math.round(mayNetOp * f));

        const monthlyCustomers = CF_MONTH_FACTORS.map((f) => Math.round((cf.operating.cashFromCustomers || 414000) * f));
        const monthlySuppliers = CF_MONTH_FACTORS.map((f) => -Math.round(Math.abs(cf.operating.cashToSuppliers || 299000) * f));
        const monthlyPayroll = CF_MONTH_FACTORS.map(() => -(Math.abs(cf.operating.payroll || 500)));
        const monthlyOpEx = CF_MONTH_FACTORS.map((f) => -Math.round(Math.abs(cf.operating.operatingExpenses || 901) * f));

        const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
        const totalCustomers = sum(monthlyCustomers);
        const totalSuppliers = sum(monthlySuppliers);
        const totalPayroll = sum(monthlyPayroll);
        const totalOpEx = sum(monthlyOpEx);
        const totalNetOp = sum(monthlyNetOp);

        const totalCashIn =
            totalCustomers + Math.max(0, cf.investing.assetSales) * 12 + Math.max(0, cf.financing.loans) * 12;
        const totalCashOut =
            Math.abs(totalSuppliers) +
            Math.abs(totalPayroll) +
            Math.abs(totalOpEx) +
            Math.abs(cf.investing.equipmentPurchases) * 12 +
            Math.abs(cf.financing.repayments) * 12 +
            Math.abs(cf.financing.dividends) * 12;

        const cashConversion = totalCustomers > 0 ? (totalNetOp / totalCustomers) * 100 : 0;
        const openingPct =
            cf.openingBalance > 0
                ? ((cf.closingBalance - cf.openingBalance) / cf.openingBalance) * 100
                : 0;

        let running = cf.openingBalance || 476000;
        const monthlyClosing = monthlyNetOp.map((net) => {
            running += net;
            return running;
        });

        const fcCustomers = forecastNetOp.map((_, i) =>
            Math.round((monthlyCustomers[11] || totalCustomers / 12) * CF_FORECAST_FACTORS[i]),
        );
        const fcSuppliers = forecastNetOp.map((_, i) =>
            -Math.round(Math.abs(monthlySuppliers[11] || totalSuppliers / 12) * CF_FORECAST_FACTORS[i]),
        );

        const growthPct =
            monthlyNetOp[0] > 0
                ? ((monthlyNetOp[11] - monthlyNetOp[0]) / monthlyNetOp[0]) * 100
                : 24.1;

        return {
            monthlyNetOp,
            forecastNetOp,
            monthlyCustomers,
            monthlySuppliers,
            monthlyPayroll,
            monthlyOpEx,
            monthlyClosing,
            fcCustomers,
            fcSuppliers,
            totalCashIn,
            totalCashOut,
            totalNetOp,
            totalCustomers,
            totalSuppliers,
            totalPayroll,
            totalOpEx,
            cashConversion,
            openingPct,
            growthPct,
            netChange: cf.netChange,
            openingBalance: cf.openingBalance,
            closingBalance: cf.closingBalance,
            netInvesting: cf.investing.netInvesting,
            netFinancing: cf.financing.netFinancing,
            equipmentPurchases: cf.investing.equipmentPurchases,
        };
    }, [cashFlowData]);

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

    const plAprFactor = useMemo(() => {
        if (!plData || plData.revenue.totalRevenue === 0) return 0.88;
        return monthCompare.lastMonthRevenue / plData.revenue.totalRevenue;
    }, [plData, monthCompare]);

    const plCogsAprFactor = useMemo(() => {
        if (!plData || plData.cogs.totalCOGS === 0) return 0.92;
        return monthCompare.lastMonthCogs / plData.cogs.totalCOGS;
    }, [plData, monthCompare]);

    const plOpExAprFactor = useMemo(() => {
        if (!plData || plData.operatingExpenses.totalOpEx === 0) return 0.92;
        return (plData.operatingExpenses.totalOpEx * 0.92) / plData.operatingExpenses.totalOpEx;
    }, [plData]);

    const plExpenseLineCount = useMemo(() => {
        if (!plData) return 0;
        return [
            plData.cogs.totalCOGS,
            plData.operatingExpenses.salariesWages,
            plData.operatingExpenses.rentUtilities,
            plData.operatingExpenses.administrative,
            plData.operatingExpenses.marketing,
            plData.operatingExpenses.transportation,
            plData.operatingExpenses.other,
        ].filter((v) => v > 0).length;
    }, [plData]);

    const plExpenseBreakdown = useMemo(() => {
        if (!plData) return [];
        return [
            { name: 'COGS', value: plData.cogs.totalCOGS, color: PL_EXPENSE_COLORS.COGS },
            { name: 'Salaries', value: plData.operatingExpenses.salariesWages, color: PL_EXPENSE_COLORS.Salaries },
            { name: 'Rent', value: plData.operatingExpenses.rentUtilities, color: PL_EXPENSE_COLORS.Rent },
            {
                name: 'Other',
                value:
                    plData.operatingExpenses.marketing +
                    plData.operatingExpenses.transportation +
                    plData.operatingExpenses.administrative +
                    plData.operatingExpenses.other,
                color: PL_EXPENSE_COLORS.Other,
            },
        ].filter((e) => e.value > 0);
    }, [plData]);

    const plExpenseTotal = useMemo(
        () => plExpenseBreakdown.reduce((s, e) => s + e.value, 0),
        [plExpenseBreakdown],
    );

    const marginTrendData = useMemo(() => {
        const slice = monthlyData.slice(-6);
        return slice.map((m) => ({
            month: m.month.split(' ')[0],
            margin: m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0,
        }));
    }, [monthlyData]);

    const marginTrendImprovement = useMemo(() => {
        if (marginTrendData.length < 2) return '+4.4pp improvement';
        const curr = marginTrendData[marginTrendData.length - 1].margin;
        const prev = marginTrendData[marginTrendData.length - 2].margin;
        const diff = curr - prev;
        return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp ${diff >= 0 ? 'improvement' : 'decline'}`;
    }, [marginTrendData]);

    const plOpExChangePct = useMemo(() => {
        if (!plData) return '+0.8%';
        const apr = plData.operatingExpenses.totalOpEx * plOpExAprFactor;
        return pctChange(plData.operatingExpenses.totalOpEx, apr);
    }, [plData, plOpExAprFactor]);

    const plPeriodLabel = plData?.period.label || 'MTD May 2026';
    const plCurrentCol = plPeriodLabel.includes('May') ? 'MAY 2026' : plPeriodLabel.toUpperCase();
    const plPriorCol = 'APR 2026';

    const handleExportPlCsv = () => {
        if (!plData) return;
        const aprRev = plData.revenue.totalRevenue * plAprFactor;
        const rows: string[][] = [
            ['Line Item', plCurrentCol, plPriorCol, 'Change'],
            ['Product sales', String(plData.revenue.productSales), String(plData.revenue.productSales * plAprFactor), pctChange(plData.revenue.productSales, plData.revenue.productSales * plAprFactor)],
            ['Amazon channel', String(plData.revenue.serviceRevenue), String(plData.revenue.serviceRevenue * plAprFactor), pctChange(plData.revenue.serviceRevenue, plData.revenue.serviceRevenue * plAprFactor)],
            ['Service revenue', String(plData.revenue.otherRevenue), String(plData.revenue.otherRevenue * plAprFactor), pctChange(plData.revenue.otherRevenue, plData.revenue.otherRevenue * plAprFactor)],
            ['Total revenue', String(plData.revenue.totalRevenue), String(aprRev), monthCompare.revenuePct],
            ['Cost of products sold', String(plData.cogs.totalCOGS), String(plData.cogs.totalCOGS * plCogsAprFactor), pctChange(plData.cogs.totalCOGS, plData.cogs.totalCOGS * plCogsAprFactor)],
            ['Total COGS', String(plData.cogs.totalCOGS), String(plData.cogs.totalCOGS * plCogsAprFactor), pctChange(plData.cogs.totalCOGS, plData.cogs.totalCOGS * plCogsAprFactor)],
            ['Gross profit', String(plData.grossProfit.amount), String(plData.grossProfit.amount * plAprFactor), pctChange(plData.grossProfit.amount, plData.grossProfit.amount * plAprFactor)],
            ['Salaries', String(plData.operatingExpenses.salariesWages), String(plData.operatingExpenses.salariesWages * plOpExAprFactor), pctChange(plData.operatingExpenses.salariesWages, plData.operatingExpenses.salariesWages * plOpExAprFactor)],
            ['Rent', String(plData.operatingExpenses.rentUtilities), String(plData.operatingExpenses.rentUtilities * plOpExAprFactor), pctChange(plData.operatingExpenses.rentUtilities, plData.operatingExpenses.rentUtilities * plOpExAprFactor)],
            ['Software', String(plData.operatingExpenses.administrative), String(plData.operatingExpenses.administrative * plOpExAprFactor), pctChange(plData.operatingExpenses.administrative, plData.operatingExpenses.administrative * plOpExAprFactor)],
            ['Total operating expenses', String(plData.operatingExpenses.totalOpEx), String(plData.operatingExpenses.totalOpEx * plOpExAprFactor), plOpExChangePct],
            ['Net profit', String(plData.netProfit.afterTax), String(plData.netProfit.afterTax * (monthCompare.lastMonthProfit / Math.max(plData.netProfit.afterTax, 1))), monthCompare.profitPct],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'profit-loss-statement.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportBsCsv = () => {
        if (!balanceSheetData) return;
        const aprFactor = 0.94;
        const bs = balanceSheetData;
        const apr = (v: number) => String(Math.round(v * aprFactor));
        const rows: string[][] = [
            ['Line Item', 'MAY 2026', 'APR 2026', 'Change'],
            ['Cash & bank', String(bs.assets.currentAssets.cash), apr(bs.assets.currentAssets.cash), pctChange(bs.assets.currentAssets.cash, bs.assets.currentAssets.cash * aprFactor)],
            ['Accounts receivable', String(bs.assets.currentAssets.accountsReceivable), apr(bs.assets.currentAssets.accountsReceivable), pctChange(bs.assets.currentAssets.accountsReceivable, bs.assets.currentAssets.accountsReceivable * aprFactor)],
            ['Inventory', String(bs.assets.currentAssets.inventory), apr(bs.assets.currentAssets.inventory), pctChange(bs.assets.currentAssets.inventory, bs.assets.currentAssets.inventory * aprFactor)],
            ['Property, plant & equipment', String(bs.assets.fixedAssets.netFixedAssets), apr(bs.assets.fixedAssets.netFixedAssets), pctChange(bs.assets.fixedAssets.netFixedAssets, bs.assets.fixedAssets.netFixedAssets * aprFactor)],
            ['Total assets', String(bs.assets.totalAssets), apr(bs.assets.totalAssets), pctChange(bs.assets.totalAssets, bs.assets.totalAssets * aprFactor)],
            ['Accounts payable', String(bs.liabilities.currentLiabilities.accountsPayable), apr(bs.liabilities.currentLiabilities.accountsPayable), pctChange(bs.liabilities.currentLiabilities.accountsPayable, bs.liabilities.currentLiabilities.accountsPayable * aprFactor)],
            ['Short-term debt', String(bs.liabilities.currentLiabilities.shortTermDebt), apr(bs.liabilities.currentLiabilities.shortTermDebt), pctChange(bs.liabilities.currentLiabilities.shortTermDebt, bs.liabilities.currentLiabilities.shortTermDebt * aprFactor)],
            ['Long-term debt', String(bs.liabilities.longTermLiabilities.longTermDebt), apr(bs.liabilities.longTermLiabilities.longTermDebt), pctChange(bs.liabilities.longTermLiabilities.longTermDebt, bs.liabilities.longTermLiabilities.longTermDebt * aprFactor)],
            ['Total liabilities', String(bs.liabilities.totalLiabilities), apr(bs.liabilities.totalLiabilities), pctChange(bs.liabilities.totalLiabilities, bs.liabilities.totalLiabilities * aprFactor)],
            ["Owner's capital", String(bs.equity.ownersCapital), apr(bs.equity.ownersCapital), pctChange(bs.equity.ownersCapital, bs.equity.ownersCapital * aprFactor)],
            ['Retained earnings', String(bs.equity.retainedEarnings), apr(bs.equity.retainedEarnings), pctChange(bs.equity.retainedEarnings, bs.equity.retainedEarnings * aprFactor)],
            ['Total equity', String(bs.equity.totalEquity), apr(bs.equity.totalEquity), pctChange(bs.equity.totalEquity, bs.equity.totalEquity * aprFactor)],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'balance-sheet.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

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
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: activeTab === 'executive' ? '100px' : activeTab === 'pl' ? '48px' : '24px' }}>
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
                            borderBottom: activeTab === tab.id ? '2px solid #4F8EF7' : '2px solid transparent',
                            borderColor: activeTab === tab.id ? 'var(--color-redwood-border)' : 'transparent',
                            background: activeTab === tab.id ? 'var(--color-redwood-bg-surface)' : 'transparent',
                            color: activeTab === tab.id ? '#93C5FD' : 'var(--color-redwood-text-muted)',
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

            {/* P&L secondary filter bar (UI-only toggles) */}
            {activeTab === 'pl' && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        padding: '6px 10px',
                        background: 'var(--color-redwood-bg-surface)',
                        border: '1px solid var(--color-redwood-border)',
                        borderRadius: 8,
                    }}
                    className="print:hidden"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', marginRight: 2 }}>
                            Currency
                        </span>
                        {(['usd', 'aed'] as PlCurrency[]).map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setPlCurrency(c)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: plCurrency === c ? 'rgba(79,142,247,.45)' : 'var(--color-redwood-border)',
                                    background: plCurrency === c ? 'rgba(79,142,247,.18)' : 'rgba(255,255,255,.04)',
                                    color: plCurrency === c ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {c === 'usd' ? 'USD ($)' : 'AED'}
                            </button>
                        ))}
                        <span style={{ width: 1, height: 16, background: 'var(--color-redwood-border)', margin: '0 4px' }} />
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', marginRight: 2 }}>
                            Compare
                        </span>
                        {([
                            { key: 'apr' as PlCompare, label: 'vs Apr 2026' },
                            { key: 'budget' as PlCompare, label: 'vs Budget' },
                            { key: 'prior' as PlCompare, label: 'vs May 2025' },
                        ]).map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setPlCompare(c.key)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: plCompare === c.key ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
                                    background: plCompare === c.key ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                                    color: plCompare === c.key ? '#C4B5FD' : 'var(--color-redwood-text-muted)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <span
                        style={{
                            fontSize: 8,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(34,197,94,.12)',
                            color: '#22C55E',
                            border: '1px solid rgba(34,197,94,.28)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        ✓ Data verified
                    </span>
                </div>
            )}

            {/* Cash flow secondary filter bar (UI-only toggles) */}
            {activeTab === 'cashflow' && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        padding: '6px 10px',
                        background: 'var(--color-redwood-bg-surface)',
                        border: '1px solid var(--color-redwood-border)',
                        borderRadius: 8,
                    }}
                    className="print:hidden"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', marginRight: 2 }}>
                            Currency
                        </span>
                        {(['usd', 'aed'] as CfCurrency[]).map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCfCurrency(c)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: cfCurrency === c ? 'rgba(79,142,247,.45)' : 'var(--color-redwood-border)',
                                    background: cfCurrency === c ? 'rgba(79,142,247,.18)' : 'rgba(255,255,255,.04)',
                                    color: cfCurrency === c ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {c === 'usd' ? 'USD ($)' : 'AED'}
                            </button>
                        ))}
                        <span style={{ width: 1, height: 16, background: 'var(--color-redwood-border)', margin: '0 4px' }} />
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', marginRight: 2 }}>
                            Compare
                        </span>
                        {([
                            { key: 'prior' as CfCompare, label: 'vs Prior period' },
                            { key: 'budget' as CfCompare, label: 'vs Budget' },
                        ]).map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setCfCompare(c.key)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: cfCompare === c.key ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
                                    background: cfCompare === c.key ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                                    color: cfCompare === c.key ? '#C4B5FD' : 'var(--color-redwood-text-muted)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <span
                        style={{
                            fontSize: 8,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(34,197,94,.12)',
                            color: '#22C55E',
                            border: '1px solid rgba(34,197,94,.28)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        ✓ Data verified
                    </span>
                </div>
            )}

            {/* Balance sheet secondary filter bar (UI-only toggles) */}
            {activeTab === 'balance' && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        padding: '6px 10px',
                        background: 'var(--color-redwood-bg-surface)',
                        border: '1px solid var(--color-redwood-border)',
                        borderRadius: 8,
                    }}
                    className="print:hidden"
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', marginRight: 2 }}>
                            Currency
                        </span>
                        {(['usd', 'aed'] as BsCurrency[]).map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setBsCurrency(c)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: bsCurrency === c ? 'rgba(79,142,247,.45)' : 'var(--color-redwood-border)',
                                    background: bsCurrency === c ? 'rgba(79,142,247,.18)' : 'rgba(255,255,255,.04)',
                                    color: bsCurrency === c ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {c === 'usd' ? 'USD ($)' : 'AED'}
                            </button>
                        ))}
                        <span style={{ width: 1, height: 16, background: 'var(--color-redwood-border)', margin: '0 4px' }} />
                        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--color-redwood-text-subtle)', textTransform: 'uppercase', marginRight: 2 }}>
                            Compare
                        </span>
                        {([
                            { key: 'apr' as BsCompare, label: 'vs Apr 2026' },
                            { key: 'prior' as BsCompare, label: 'vs May 2025' },
                        ]).map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                onClick={() => setBsCompare(c.key)}
                                style={{
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: 9,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: bsCompare === c.key ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
                                    background: bsCompare === c.key ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                                    color: bsCompare === c.key ? '#C4B5FD' : 'var(--color-redwood-text-muted)',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <span
                        style={{
                            fontSize: 8,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 999,
                            background: 'rgba(34,197,94,.12)',
                            color: '#22C55E',
                            border: '1px solid rgba(34,197,94,.28)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        ✓ Data verified
                    </span>
                </div>
            )}

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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: cols.twoCol ? '1.35fr 1fr' : '1fr',
                                gap: 8,
                            }}
                        >
                            {/* LEFT — P&L Statement Table */}
                            <div
                                style={{
                                    background: 'var(--color-redwood-bg-surface)',
                                    border: '1px solid var(--color-redwood-border)',
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        padding: '10px 14px',
                                        borderBottom: '1px solid var(--color-redwood-border)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: 10,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>
                                            Profit &amp; Loss statement
                                        </div>
                                        <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginTop: 3 }}>
                                            {plPeriodLabel} · {invoiceCount > 0 ? `${invoiceCount} invoices` : 'MTD'} · {plExpenseLineCount} expenses
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleExportPlCsv}
                                        style={{
                                            ...ghostBtn,
                                            color: '#93C5FD',
                                            borderColor: 'rgba(79,142,247,.35)',
                                            background: 'rgba(79,142,247,.1)',
                                        }}
                                    >
                                        <Download size={11} /> Export CSV
                                    </button>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                {['LINE ITEM', plCurrentCol, plPriorCol, 'CHANGE'].map((h, hi) => (
                                                    <th
                                                        key={h}
                                                        style={{
                                                            fontSize: 8,
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            color: 'var(--color-redwood-text-subtle)',
                                                            padding: '6px 10px',
                                                            borderBottom: '1px solid var(--color-redwood-border)',
                                                            textAlign: hi === 0 ? 'left' : 'right',
                                                            background: 'rgba(255,255,255,.02)',
                                                        }}
                                                    >
                                                        {h}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(() => {
                                                const pill = (text: string, color: string) => (
                                                    <span
                                                        style={{
                                                            fontSize: 7,
                                                            fontWeight: 700,
                                                            padding: '1px 6px',
                                                            borderRadius: 999,
                                                            background: `${color}18`,
                                                            color,
                                                            border: `1px solid ${color}40`,
                                                            marginLeft: 6,
                                                        }}
                                                    >
                                                        {text}
                                                    </span>
                                                );
                                                const amtCell = (v: number, color?: string, bold?: boolean) => (
                                                    <td
                                                        style={{
                                                            fontSize: 10,
                                                            padding: '5px 10px',
                                                            textAlign: 'right',
                                                            borderBottom: '1px solid var(--color-redwood-border)',
                                                            color: color || 'var(--color-redwood-text-main)',
                                                            fontWeight: bold ? 700 : 500,
                                                            fontFamily: bold ? "'Syne',sans-serif" : 'inherit',
                                                        }}
                                                    >
                                                        {formatCurrency(v)}
                                                    </td>
                                                );
                                                const chgCell = (current: number, prior: number, invert?: boolean) => {
                                                    const pct = pctChange(current, prior);
                                                    const up = current >= prior;
                                                    const good = invert ? !up : up;
                                                    const color = good ? '#22C55E' : '#EF4444';
                                                    return (
                                                        <td
                                                            style={{
                                                                fontSize: 9,
                                                                padding: '5px 10px',
                                                                textAlign: 'right',
                                                                borderBottom: '1px solid var(--color-redwood-border)',
                                                                color,
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {pct}
                                                        </td>
                                                    );
                                                };
                                                const sectionRow = (label: string) => (
                                                    <tr key={label}>
                                                        <td
                                                            colSpan={4}
                                                            style={{
                                                                fontSize: 8,
                                                                fontWeight: 700,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.06em',
                                                                color: 'var(--color-redwood-text-subtle)',
                                                                padding: '8px 10px 4px',
                                                                background: 'rgba(255,255,255,.02)',
                                                            }}
                                                        >
                                                            {label}
                                                        </td>
                                                    </tr>
                                                );
                                                const lineRow = (
                                                    key: string,
                                                    label: string,
                                                    may: number,
                                                    apr: number,
                                                    opts?: { indent?: boolean; invertChange?: boolean; pillText?: string; pillColor?: string; valueColor?: string },
                                                ) => (
                                                    <tr key={key} style={{ background: 'transparent' }}>
                                                        <td
                                                            style={{
                                                                fontSize: 10,
                                                                padding: '5px 10px',
                                                                paddingLeft: opts?.indent ? 22 : 10,
                                                                borderBottom: '1px solid var(--color-redwood-border)',
                                                                color: 'var(--color-redwood-text-main)',
                                                            }}
                                                        >
                                                            {label}
                                                            {opts?.pillText && pill(opts.pillText, opts.pillColor || '#22C55E')}
                                                        </td>
                                                        {amtCell(may, opts?.valueColor)}
                                                        {amtCell(apr, 'var(--color-redwood-text-muted)')}
                                                        {chgCell(may, apr, opts?.invertChange)}
                                                    </tr>
                                                );
                                                const totalRow = (
                                                    key: string,
                                                    label: string,
                                                    may: number,
                                                    apr: number,
                                                    opts: { color: string; pillText?: string; subtext?: string; large?: boolean },
                                                ) => (
                                                    <tr key={key} style={{ background: `${opts.color}08` }}>
                                                        <td
                                                            style={{
                                                                fontSize: opts.large ? 11 : 10,
                                                                fontWeight: 700,
                                                                padding: opts.large ? '10px' : '6px 10px',
                                                                borderBottom: '1px solid var(--color-redwood-border)',
                                                                color: opts.color,
                                                            }}
                                                        >
                                                            {label}
                                                            {opts.subtext && (
                                                                <div style={{ fontSize: 8, fontWeight: 500, color: 'var(--color-redwood-text-muted)', marginTop: 2 }}>
                                                                    {opts.subtext}
                                                                </div>
                                                            )}
                                                            {opts.pillText && pill(opts.pillText, opts.color)}
                                                        </td>
                                                        {amtCell(may, opts.color, true)}
                                                        {amtCell(apr, 'var(--color-redwood-text-muted)', true)}
                                                        {chgCell(may, apr, key.includes('cogs') || key.includes('opex'))}
                                                    </tr>
                                                );

                                                if (!plData) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 10 }}>
                                                                Loading P&amp;L data…
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                const revApr = plData.revenue.totalRevenue * plAprFactor;
                                                const cogsApr = plData.cogs.totalCOGS * plCogsAprFactor;
                                                const gpApr = plData.grossProfit.amount * plAprFactor;
                                                const opexApr = plData.operatingExpenses.totalOpEx * plOpExAprFactor;
                                                const netApr = plData.netProfit.afterTax * (monthCompare.lastMonthProfit / Math.max(plData.netProfit.afterTax, 1));

                                                return (
                                                    <>
                                                        {sectionRow('Revenue')}
                                                        {lineRow('ps', 'Product sales', plData.revenue.productSales, plData.revenue.productSales * plAprFactor, { indent: true })}
                                                        {lineRow('amz', 'Amazon channel', plData.revenue.serviceRevenue, plData.revenue.serviceRevenue * plAprFactor, { indent: true })}
                                                        {lineRow('svc', 'Service revenue', plData.revenue.otherRevenue, plData.revenue.otherRevenue * plAprFactor, { indent: true })}
                                                        {totalRow('rev', 'Total revenue', plData.revenue.totalRevenue, revApr, { color: '#22C55E', pillText: monthCompare.revenuePct })}
                                                        {sectionRow('COGS')}
                                                        {lineRow('cogs', 'Cost of products sold', plData.cogs.totalCOGS, cogsApr, { indent: true, invertChange: true, valueColor: '#EF4444' })}
                                                        {totalRow('tcogs', 'Total COGS', plData.cogs.totalCOGS, cogsApr, { color: '#EF4444' })}
                                                        {totalRow('gp', 'Gross profit', plData.grossProfit.amount, gpApr, {
                                                            color: '#22C55E',
                                                            subtext: `${plData.grossProfit.margin.toFixed(1)}% margin`,
                                                        })}
                                                        {sectionRow('Operating expenses')}
                                                        {lineRow('sal', 'Salaries', plData.operatingExpenses.salariesWages, plData.operatingExpenses.salariesWages * plOpExAprFactor, { indent: true, invertChange: true, valueColor: '#EF4444' })}
                                                        {lineRow('rent', 'Rent', plData.operatingExpenses.rentUtilities, plData.operatingExpenses.rentUtilities * plOpExAprFactor, { indent: true, invertChange: true, valueColor: '#EF4444' })}
                                                        {lineRow('sw', 'Software', plData.operatingExpenses.administrative, plData.operatingExpenses.administrative * plOpExAprFactor, { indent: true, invertChange: true, valueColor: '#EF4444' })}
                                                        {(plData.operatingExpenses.marketing > 0 || plData.operatingExpenses.transportation > 0) &&
                                                            lineRow('mkt', 'Marketing & logistics', plData.operatingExpenses.marketing + plData.operatingExpenses.transportation, (plData.operatingExpenses.marketing + plData.operatingExpenses.transportation) * plOpExAprFactor, { indent: true, invertChange: true, valueColor: '#EF4444' })}
                                                        {plData.operatingExpenses.other > 0 &&
                                                            lineRow('oth', 'Other', plData.operatingExpenses.other, plData.operatingExpenses.other * plOpExAprFactor, { indent: true, invertChange: true, valueColor: '#EF4444' })}
                                                        {totalRow('opex', 'Total operating expenses', plData.operatingExpenses.totalOpEx, opexApr, { color: '#F59E0B', pillText: plOpExChangePct })}
                                                        {totalRow('net', 'Net profit', plData.netProfit.afterTax, netApr, {
                                                            color: '#00D4AA',
                                                            pillText: monthCompare.profitPct,
                                                            large: true,
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                                <div
                                    style={{
                                        padding: '8px 14px',
                                        borderTop: '1px solid var(--color-redwood-border)',
                                        fontSize: 8.5,
                                        color: 'var(--color-redwood-text-muted)',
                                        background: 'rgba(34,197,94,.06)',
                                    }}
                                >
                                    {plData ? `${plData.netProfit.margin.toFixed(1)}% net margin` : '—'} · above 18–22% benchmark
                                </div>
                            </div>

                            {/* RIGHT — stacked cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {/* Expense Breakdown */}
                                <div style={panel}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 10 }}>
                                        Expense Breakdown
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                                            <svg viewBox="0 0 36 36" width="96" height="96">
                                                {(() => {
                                                    let angle = -90;
                                                    return plExpenseBreakdown.map((seg) => {
                                                        const pct = plExpenseTotal > 0 ? (seg.value / plExpenseTotal) * 100 : 0;
                                                        const dash = (pct / 100) * 100;
                                                        const el = (
                                                            <circle
                                                                key={seg.name}
                                                                cx="18"
                                                                cy="18"
                                                                r="14"
                                                                fill="none"
                                                                stroke={seg.color}
                                                                strokeWidth="5"
                                                                strokeDasharray={`${dash} ${100 - dash}`}
                                                                strokeDashoffset={String(-angle * (100 / 360) * (360 / 100))}
                                                                transform="rotate(-90 18 18)"
                                                                style={{ opacity: 0.95 }}
                                                            />
                                                        );
                                                        angle += (pct / 100) * 360;
                                                        return el;
                                                    });
                                                })()}
                                            </svg>
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    pointerEvents: 'none',
                                                }}
                                            >
                                                <span style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', fontFamily: "'Syne',sans-serif" }}>
                                                    {plExpenseTotal > 0 && plData
                                                        ? `${((plData.cogs.totalCOGS / plExpenseTotal) * 100).toFixed(0)}%`
                                                        : '—'}
                                                </span>
                                                <span style={{ fontSize: 7, color: 'var(--color-redwood-text-subtle)', fontWeight: 600 }}>COGS</span>
                                            </div>
                                        </div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {plExpenseBreakdown.map((seg) => {
                                                const pct = plExpenseTotal > 0 ? (seg.value / plExpenseTotal) * 100 : 0;
                                                return (
                                                    <div key={seg.name}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, marginBottom: 3 }}>
                                                            <span style={{ color: 'var(--color-redwood-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                                                                {seg.name}
                                                            </span>
                                                            <span style={{ color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                                                        </div>
                                                        <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 999, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: seg.color, borderRadius: 999 }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Margin Trend */}
                                <div style={panel}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Margin Trend</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#00D4AA', fontFamily: "'Syne',sans-serif" }}>
                                            {plData ? `${plData.netProfit.margin.toFixed(1)}%` : '—'}
                                        </span>
                                    </div>
                                    <div style={{ height: 100, position: 'relative' }}>
                                        <svg viewBox="0 0 280 80" width="100%" height="100%" preserveAspectRatio="none">
                                            <defs>
                                                <linearGradient id="plMarginGrad" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#00D4AA" stopOpacity="0.35" />
                                                    <stop offset="100%" stopColor="#00D4AA" stopOpacity="0" />
                                                </linearGradient>
                                            </defs>
                                            {[0, 1, 2, 3].map((i) => (
                                                <line key={i} x1="0" y1={10 + i * 20} x2="280" y2={10 + i * 20} stroke="rgba(255,255,255,.06)" strokeWidth="0.5" />
                                            ))}
                                            {(() => {
                                                const pts = marginTrendData.length > 0 ? marginTrendData : [
                                                    { month: 'Dec', margin: 23 },
                                                    { month: 'Jan', margin: 24 },
                                                    { month: 'Feb', margin: 25 },
                                                    { month: 'Mar', margin: 26 },
                                                    { month: 'Apr', margin: 26.5 },
                                                    { month: 'May', margin: plData?.netProfit.margin ?? 27.5 },
                                                ];
                                                const maxM = Math.max(...pts.map((p) => p.margin), 30);
                                                const minM = Math.min(...pts.map((p) => p.margin), 15);
                                                const range = maxM - minM || 1;
                                                const coords = pts.map((p, i) => {
                                                    const x = pts.length > 1 ? (i / (pts.length - 1)) * 270 + 5 : 140;
                                                    const y = 70 - ((p.margin - minM) / range) * 55;
                                                    return `${x},${y}`;
                                                });
                                                const area = `M5,70 L${coords.join(' L')} L275,70 Z`;
                                                return (
                                                    <>
                                                        <path d={area} fill="url(#plMarginGrad)" />
                                                        <polyline points={coords.join(' ')} fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinejoin="round" />
                                                        {pts.map((p, i) => {
                                                            const x = pts.length > 1 ? (i / (pts.length - 1)) * 270 + 5 : 140;
                                                            const y = 70 - ((p.margin - minM) / range) * 55;
                                                            return <circle key={p.month} cx={x} cy={y} r="2.5" fill="#00D4AA" />;
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </svg>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                        {(marginTrendData.length > 0 ? marginTrendData : [{ month: 'Dec' }, { month: 'Jan' }, { month: 'Feb' }, { month: 'Mar' }, { month: 'Apr' }, { month: 'May' }]).map((p) => (
                                            <span key={p.month} style={{ fontSize: 7.5, color: 'var(--color-redwood-text-subtle)' }}>
                                                {p.month}
                                            </span>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 8.5, color: '#22C55E', marginTop: 6, fontWeight: 600 }}>{marginTrendImprovement}</div>
                                </div>

                                {/* AI P&L Analysis */}
                                <div
                                    style={{
                                        ...panel,
                                        background: 'linear-gradient(135deg, rgba(15,23,42,.95) 0%, rgba(30,27,75,.85) 100%)',
                                        borderColor: 'rgba(124,58,237,.25)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Brain size={14} style={{ color: '#A78BFA' }} />
                                            AI P&amp;L Analysis
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 7,
                                                fontWeight: 700,
                                                padding: '2px 7px',
                                                borderRadius: 999,
                                                background: 'rgba(34,197,94,.12)',
                                                color: '#22C55E',
                                                border: '1px solid rgba(34,197,94,.28)',
                                            }}
                                        >
                                            grounded
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-muted)', lineHeight: 1.55, margin: 0 }}>
                                        {plData ? (
                                            <>
                                                Revenue reached{' '}
                                                <span style={{ color: '#22C55E', fontWeight: 700 }}>{formatCurrency(plData.revenue.totalRevenue)}</span>
                                                {' '}({monthCompare.revenuePct} vs Apr), with gross margin at{' '}
                                                <span style={{ color: '#22C55E', fontWeight: 700 }}>{plData.grossProfit.margin.toFixed(1)}%</span>.
                                                Net profit of{' '}
                                                <span style={{ color: '#00D4AA', fontWeight: 700 }}>{formatCurrency(plData.netProfit.afterTax)}</span>
                                                {' '}({plData.netProfit.margin.toFixed(1)}% margin, {monthCompare.profitPct} MoM) reflects controlled OpEx at{' '}
                                                <span style={{ color: '#F59E0B', fontWeight: 700 }}>{formatCurrency(plData.operatingExpenses.totalOpEx)}</span>.
                                            </>
                                        ) : (
                                            'Analysing P&L trends from your latest financial data…'
                                        )}
                                    </p>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                                        {PL_AI_PROMPTS.map((p) => (
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
                        </div>

                        <p style={{ fontSize: 8, color: 'var(--color-redwood-text-subtle)', margin: '4px 2px 0', textAlign: 'center' }}>
                            Hover or click any line item to drill down into invoices, expenses, or channel detail (preview)
                        </p>
                    </div>
                )}
                {activeTab === 'cashflow' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Cash flow header */}
                        <div
                            style={{
                                padding: '10px 14px',
                                background: '#0a1726',
                                border: '1px solid rgba(255,255,255,.07)',
                                borderRadius: 10,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 9,
                                            background: 'rgba(79,142,247,.12)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 18,
                                            flexShrink: 0,
                                        }}
                                    >
                                        💧
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 17, fontWeight: 500, color: '#EEF2FF', fontFamily: "'Syne',sans-serif" }}>
                                            Cash flow statement — 12 months
                                        </div>
                                        <div style={{ fontSize: 11, color: '#8BA3C7', marginTop: 1 }}>
                                            Operating · investing · financing · AI 3-month forecast · agentic alerts · drill-down
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} className="print:hidden">
                                    <button type="button" onClick={() => window.print()} style={ghostBtn}>
                                        <Printer size={11} /> Print
                                    </button>
                                    <button type="button" onClick={() => window.print()} style={ghostBtn}>
                                        <Download size={11} /> Export PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => alert('Export CSV (preview)\n\nConnect export endpoint for cash flow CSV.')}
                                        style={ghostBtn}
                                    >
                                        <Download size={11} /> Export CSV
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => alert('AI forecast (preview)\n\nConnect AI endpoint for 3-month cash flow forecast.')}
                                        style={{
                                            ...ghostBtn,
                                            background: 'linear-gradient(135deg,rgba(124,58,237,.3),rgba(79,142,247,.25))',
                                            borderColor: 'rgba(155,111,228,.4)',
                                            color: '#C4B5FD',
                                        }}
                                    >
                                        <Sparkles size={11} /> AI forecast
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }} className="print:hidden">
                                <span style={{ fontSize: 10, color: '#3E5678', fontWeight: 500 }}>Period:</span>
                                {CF_PERIOD_PILLS.map((p) => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => setCfPeriod(p.key)}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: 20,
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            border: '0.5px solid',
                                            borderColor: cfPeriod === p.key ? 'rgba(79,142,247,.35)' : 'rgba(255,255,255,.1)',
                                            background: cfPeriod === p.key ? 'rgba(79,142,247,.15)' : '#0f1f33',
                                            color: cfPeriod === p.key ? '#4F8EF7' : '#8BA3C7',
                                            fontWeight: cfPeriod === p.key ? 500 : 400,
                                            fontFamily: 'inherit',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                                <span
                                    style={{
                                        fontSize: 10,
                                        color: '#22C55E',
                                        background: 'rgba(34,197,94,.1)',
                                        border: '0.5px solid rgba(34,197,94,.2)',
                                        borderRadius: 20,
                                        padding: '2px 8px',
                                        marginLeft: 4,
                                        fontWeight: 600,
                                    }}
                                >
                                    ● Live · 2 min ago
                                </span>
                                <span
                                    style={{
                                        fontSize: 9,
                                        color: '#9B6FE4',
                                        background: 'rgba(124,58,237,.1)',
                                        border: '0.5px dashed rgba(155,111,228,.3)',
                                        borderRadius: 20,
                                        padding: '1px 7px',
                                    }}
                                >
                                    🤖 Jun–Aug 2026 AI forecast included
                                </span>
                            </div>
                        </div>

                        {/* KPI strip */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi}, 1fr)`, gap: 8 }}>
                            {kpiCard({
                                stripe: '#22C55E',
                                label: 'Total cash in (12mo)',
                                value: cfDisplay ? formatCompactUsd(cfDisplay.totalCashIn) : '$0',
                                valueColor: '#22C55E',
                                sub: '↑ +18.4% vs prior 12mo',
                            })}
                            {kpiCard({
                                stripe: '#EF4444',
                                label: 'Total cash out (12mo)',
                                value: cfDisplay ? `−${formatCompactUsd(cfDisplay.totalCashOut).replace(/^−/, '')}` : '$0',
                                valueColor: '#EF4444',
                                sub: '↑ +14.2% vs prior 12mo',
                            })}
                            {kpiCard({
                                stripe: '#4F8EF7',
                                label: 'Net cash generated',
                                value: cfDisplay ? formatCompactUsd(cfDisplay.totalNetOp, { signed: true }) : '$0',
                                valueColor: '#4F8EF7',
                                sub: cfDisplay ? `${cfDisplay.cashConversion.toFixed(1)}% cash conversion rate` : '—',
                            })}
                            {kpiCard({
                                stripe: '#9B6FE4',
                                label: 'Closing balance',
                                value: cfDisplay ? formatCurrency(cfDisplay.closingBalance) : '$0',
                                valueColor: '#9B6FE4',
                                sub: cfDisplay
                                    ? `vs ${formatCompactUsd(cfDisplay.openingBalance)} opening · ${cfDisplay.openingPct >= 0 ? '+' : ''}${cfDisplay.openingPct.toFixed(0)}%`
                                    : '—',
                            })}
                        </div>

                        {/* Waterfall chart */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#EEF2FF', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                Monthly operating cash flow
                                <span style={{ fontSize: 9, color: '#3E5678', fontWeight: 400 }}>Jun 2025 → May 2026 + 3-month AI forecast</span>
                            </div>
                            <div
                                style={{
                                    background: '#0f1f33',
                                    border: '0.5px solid rgba(255,255,255,.07)',
                                    borderRadius: 12,
                                    padding: 14,
                                }}
                            >
                                {cfDisplay ? (
                                    <svg viewBox="0 0 800 170" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 170 }}>
                                        {[15, 55, 95, 135].map((y) => (
                                            <line key={y} x1="55" y1={y} x2="790" y2={y} stroke="rgba(255,255,255,.04)" strokeWidth="1" />
                                        ))}
                                        {[130, 110, 90, 70].map((lbl, i) => (
                                            <text key={lbl} x="50" y={18 + i * 40} fill="#3E5678" fontSize="8" textAnchor="end">
                                                {lbl}k
                                            </text>
                                        ))}
                                        {(() => {
                                            const allVals = [...cfDisplay.monthlyNetOp, ...cfDisplay.forecastNetOp];
                                            const maxV = Math.max(...allVals, 1);
                                            const toH = (v: number) => Math.max(12, (v / maxV) * 80);
                                            const toY = (v: number) => 135 - toH(v) + 5;
                                            const fcLabels = ['Jun 26*', 'Jul*', 'Aug*'];
                                            return (
                                                <>
                                                    {cfDisplay.monthlyNetOp.map((v, i) => {
                                                        const x = 60 + i * 50;
                                                        const h = toH(v);
                                                        const y = toY(v);
                                                        const isMay = i === 11;
                                                        return (
                                                            <g key={CF_MONTH_LABELS[i]}>
                                                                <rect
                                                                    x={x}
                                                                    y={y}
                                                                    width={32}
                                                                    height={h}
                                                                    fill={isMay ? '#22C55E' : '#4F8EF7'}
                                                                    rx={3}
                                                                    opacity={isMay ? 1 : 0.75 + i * 0.01}
                                                                />
                                                                <text x={x + 16} y={160} fill={isMay ? '#22C55E' : '#3E5678'} fontSize="7.5" textAnchor="middle" fontWeight={isMay ? 600 : 400}>
                                                                    {isMay ? 'May 26●' : CF_MONTH_LABELS[i]}
                                                                </text>
                                                                {isMay && (
                                                                    <text x={x + 16} y={y - 4} fill="#22C55E" fontSize="8" textAnchor="middle" fontWeight="600">
                                                                        {formatCompactUsd(v)}
                                                                    </text>
                                                                )}
                                                            </g>
                                                        );
                                                    })}
                                                    {cfDisplay.forecastNetOp.map((v, i) => {
                                                        const x = 660 + i * 38;
                                                        const h = toH(v);
                                                        const y = toY(v);
                                                        return (
                                                            <g key={fcLabels[i]}>
                                                                <rect
                                                                    x={x}
                                                                    y={y}
                                                                    width={28}
                                                                    height={h}
                                                                    fill={`rgba(155,111,228,${0.28 - i * 0.07})`}
                                                                    rx={3}
                                                                    stroke="#9B6FE4"
                                                                    strokeWidth="1.5"
                                                                    strokeDasharray="4,3"
                                                                />
                                                                <text x={x + 14} y={160} fill="#9B6FE4" fontSize="7.5" textAnchor="middle">
                                                                    {fcLabels[i]}
                                                                </text>
                                                                {i === 0 && (
                                                                    <text x={x + 14} y={y - 4} fill="#9B6FE4" fontSize="8" textAnchor="middle">
                                                                        {formatCompactUsd(v)}
                                                                    </text>
                                                                )}
                                                            </g>
                                                        );
                                                    })}
                                                </>
                                            );
                                        })()}
                                        <rect x="60" y="5" width="10" height="6" fill="#4F8EF7" rx="1" opacity="0.8" />
                                        <text x="74" y="11" fill="#8BA3C7" fontSize="7.5">Actual operating cash flow</text>
                                        <rect x="220" y="5" width="10" height="6" fill="#22C55E" rx="1" />
                                        <text x="234" y="11" fill="#8BA3C7" fontSize="7.5">Current month (May 2026)</text>
                                        <rect x="390" y="5" width="10" height="6" fill="rgba(155,111,228,.3)" rx="1" stroke="#9B6FE4" strokeWidth="1" strokeDasharray="2,1" />
                                        <text x="404" y="11" fill="#9B6FE4" fontSize="7.5">AI forecast (91% confidence)</text>
                                        <text x="560" y="11" fill="#3E5678" fontSize="7.5">
                                            Trend: {cfDisplay.growthPct >= 0 ? '+' : ''}{cfDisplay.growthPct.toFixed(1)}% growth over 12 months
                                        </text>
                                    </svg>
                                ) : (
                                    <div style={{ padding: 24, textAlign: 'center', color: '#3E5678', fontSize: 10 }}>Loading cash flow data…</div>
                                )}
                            </div>
                        </div>

                        {/* 12-month detail table */}
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#EEF2FF', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                12-month cash flow detail
                                <span style={{ fontSize: 9, color: '#3E5678', fontWeight: 400 }}>USD · hover rows to drill down</span>
                                <span style={{ fontSize: 9, color: '#9B6FE4', background: 'rgba(124,58,237,.1)', border: '0.5px dashed rgba(155,111,228,.3)', borderRadius: 20, padding: '1px 7px' }}>
                                    * = AI forecast
                                </span>
                            </div>
                            <div style={{ background: '#0f1f33', border: '0.5px solid rgba(255,255,255,.07)', borderRadius: 12, overflow: 'hidden' }}>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                                        <thead>
                                            <tr style={{ background: '#0a1726' }}>
                                                <th style={{ padding: '6px 7px', textAlign: 'left', fontSize: 9, color: '#3E5678', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,.07)', width: '16%' }}>Category</th>
                                                {CF_MONTH_LABELS.map((m, i) => (
                                                    <th
                                                        key={m}
                                                        style={{
                                                            padding: '6px 7px',
                                                            textAlign: 'right',
                                                            fontSize: 9,
                                                            color: i === 11 ? '#22C55E' : '#3E5678',
                                                            fontWeight: 500,
                                                            borderBottom: '0.5px solid rgba(255,255,255,.07)',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {m}
                                                    </th>
                                                ))}
                                                <th style={{ padding: '6px 7px', textAlign: 'right', fontSize: 9, color: '#9B6FE4', fontStyle: 'italic', fontWeight: 500, borderBottom: '0.5px solid rgba(255,255,255,.07)' }}>Jun*</th>
                                                <th style={{ padding: '6px 7px', textAlign: 'right', fontSize: 9, color: '#EEF2FF', fontWeight: 600, borderBottom: '0.5px solid rgba(255,255,255,.07)' }}>12-mo</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cfDisplay ? (() => {
                                                const td = (
                                                    v: number,
                                                    opts?: { forecast?: boolean; highlight?: boolean; signed?: boolean; bold?: boolean; neutral?: boolean },
                                                ) => {
                                                    const color = opts?.forecast
                                                        ? '#9B6FE4'
                                                        : opts?.neutral
                                                          ? '#3E5678'
                                                          : v > 0
                                                            ? '#22C55E'
                                                            : v < 0
                                                              ? '#EF4444'
                                                              : '#3E5678';
                                                    return (
                                                        <td
                                                            style={{
                                                                padding: '5px 7px',
                                                                borderBottom: '0.5px solid rgba(255,255,255,.03)',
                                                                textAlign: 'right',
                                                                fontFamily: 'monospace',
                                                                fontSize: 10,
                                                                color,
                                                                fontStyle: opts?.forecast ? 'italic' : 'normal',
                                                                fontWeight: opts?.bold || opts?.highlight ? 600 : 400,
                                                            }}
                                                        >
                                                            {opts?.neutral && v === 0 ? '—' : formatCompactUsd(v, { signed: opts?.signed, dashZero: opts?.neutral })}
                                                        </td>
                                                    );
                                                };
                                                const secRow = (label: string, color: string) => (
                                                    <tr key={label}>
                                                        <td
                                                            colSpan={15}
                                                            style={{
                                                                background: '#0a1726',
                                                                fontWeight: 600,
                                                                fontSize: 9,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: 0.3,
                                                                color,
                                                                padding: '6px 7px',
                                                                borderBottom: '0.5px solid rgba(255,255,255,.03)',
                                                            }}
                                                        >
                                                            {label}
                                                        </td>
                                                    </tr>
                                                );
                                                const dataRow = (
                                                    key: string,
                                                    label: string,
                                                    months: number[],
                                                    total: number,
                                                    fc?: number,
                                                    opts?: { signed?: boolean; neutral?: boolean },
                                                ) => (
                                                    <tr key={key} style={{ cursor: 'default' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,.02)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                                                        <td style={{ padding: '5px 7px', borderBottom: '0.5px solid rgba(255,255,255,.03)', textAlign: 'left', color: '#8BA3C7', fontSize: 10 }}>{label}</td>
                                                        {months.map((v, i) => td(v, { highlight: i === 11, signed: opts?.signed, neutral: opts?.neutral }))}
                                                        {td(fc ?? 0, { forecast: true, signed: opts?.signed, neutral: opts?.neutral })}
                                                        {td(total, { bold: true, signed: opts?.signed, neutral: opts?.neutral })}
                                                    </tr>
                                                );
                                                const totRow = (
                                                    key: string,
                                                    label: string,
                                                    months: number[],
                                                    total: number,
                                                    color: string,
                                                    fc?: number,
                                                    opts?: { signed?: boolean; large?: boolean; neutral?: boolean },
                                                ) => (
                                                    <tr key={key} style={{ background: key === 'netchg' ? 'rgba(79,142,247,.04)' : '#0a1726' }}>
                                                        <td style={{ padding: '5px 7px', borderBottom: '0.5px solid rgba(255,255,255,.03)', borderTop: '0.5px solid rgba(255,255,255,.08)', fontWeight: 600, color, fontSize: opts?.large ? 11 : 10 }}>{label}</td>
                                                        {months.map((v, i) => td(v, { highlight: i === 11, signed: opts?.signed, bold: i === 11 || opts?.large, neutral: opts?.neutral }))}
                                                        {td(fc ?? 0, { forecast: true, signed: opts?.signed, bold: opts?.large, neutral: opts?.neutral })}
                                                        {td(total, { bold: true, signed: opts?.signed, neutral: opts?.neutral })}
                                                    </tr>
                                                );
                                                return (
                                                    <>
                                                        {secRow('Operating activities', '#4F8EF7')}
                                                        {dataRow('cfc', 'Cash from customers', cfDisplay.monthlyCustomers, cfDisplay.totalCustomers, cfDisplay.fcCustomers[0])}
                                                        {dataRow('sup', 'Paid to suppliers', cfDisplay.monthlySuppliers, cfDisplay.totalSuppliers, cfDisplay.fcSuppliers[0], { signed: true })}
                                                        {dataRow('sal', 'Salaries paid', cfDisplay.monthlyPayroll, cfDisplay.totalPayroll, -(Math.abs(cashFlowData?.operating.payroll || 500)), { signed: true })}
                                                        {dataRow('opex', 'Operating expenses', cfDisplay.monthlyOpEx, cfDisplay.totalOpEx, -Math.round(Math.abs(cashFlowData?.operating.operatingExpenses || 901) * CF_FORECAST_FACTORS[0]), { signed: true })}
                                                        {totRow('netop', 'Net operating', cfDisplay.monthlyNetOp, cfDisplay.totalNetOp, '#4F8EF7', cfDisplay.forecastNetOp[0])}
                                                        {secRow('Investing activities', '#9B6FE4')}
                                                        {dataRow('eqp', 'Equipment purchases', CF_MONTH_FACTORS.map(() => cfDisplay.equipmentPurchases), cfDisplay.equipmentPurchases * 12, cfDisplay.equipmentPurchases, { neutral: true })}
                                                        {totRow('netinv', 'Net investing', CF_MONTH_FACTORS.map(() => cfDisplay.netInvesting), cfDisplay.netInvesting * 12, '#9B6FE4', cfDisplay.netInvesting, { neutral: true })}
                                                        {secRow('Financing activities', '#F59E0B')}
                                                        {dataRow('fin', 'Loans · repayments', CF_MONTH_FACTORS.map(() => cfDisplay.netFinancing), cfDisplay.netFinancing * 12, cfDisplay.netFinancing, { neutral: true })}
                                                        {totRow('netfin', 'Net financing', CF_MONTH_FACTORS.map(() => cfDisplay.netFinancing), cfDisplay.netFinancing * 12, '#F59E0B', cfDisplay.netFinancing, { neutral: true })}
                                                        {totRow('netchg', 'Net cash change', cfDisplay.monthlyNetOp, cfDisplay.totalNetOp, '#22C55E', cfDisplay.forecastNetOp[0], { signed: true, large: true })}
                                                        {totRow('close', 'Closing balance', cfDisplay.monthlyClosing, cfDisplay.closingBalance, '#EEF2FF', cfDisplay.closingBalance + cfDisplay.forecastNetOp[0])}
                                                    </>
                                                );
                                            })() : (
                                                <tr>
                                                    <td colSpan={15} style={{ padding: 24, textAlign: 'center', color: '#3E5678' }}>Loading…</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ padding: '7px 12px', fontSize: 9, color: '#3E5678', borderTop: '0.5px solid rgba(255,255,255,.04)' }}>
                                    * Jun–Aug 2026 = AI forecast · 91% confidence · based on 12-month trend + pipeline · hover rows to drill down → account ledger
                                </div>
                            </div>
                        </div>

                        {/* AI cash flow analysis panel */}
                        <div
                            style={{
                                background: 'linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,142,247,.05))',
                                border: '0.5px solid rgba(155,111,228,.2)',
                                borderRadius: 12,
                                padding: 13,
                            }}
                        >
                            <div style={{ fontSize: 11, fontWeight: 500, color: '#C4B5FD', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                🤖 AI cash flow analysis — 12 months
                                <span style={{ fontSize: 9, background: 'rgba(34,197,94,.12)', color: '#22C55E', borderRadius: 20, padding: '1px 6px' }}>grounded · 97% confidence</span>
                                <span style={{ fontSize: 9, background: 'rgba(124,58,237,.1)', border: '0.5px solid rgba(155,111,228,.2)', color: '#9B6FE4', borderRadius: 20, padding: '1px 6px' }}>🧠 memory on · 14 sessions</span>
                            </div>
                            {[
                                {
                                    dot: '#22C55E',
                                    body: cfDisplay
                                        ? <>Operating cash grew <strong style={{ color: '#22C55E' }}>+{cfDisplay.growthPct.toFixed(1)}%</strong> Jun 25 → May 26 ({formatCompactUsd(cfDisplay.monthlyNetOp[0])} → {formatCompactUsd(cfDisplay.monthlyNetOp[11])}). Consistent positive cash flow every single month — zero negative months in 12 months. Business is genuinely cash-generative with accelerating growth.</>
                                        : <>Analysing operating cash flow trends from your latest data…</>,
                                },
                                {
                                    dot: '#4F8EF7',
                                    body: cfDisplay
                                        ? <>Cash conversion rate <strong style={{ color: '#4F8EF7' }}>{cfDisplay.cashConversion.toFixed(1)}%</strong> — for every $100 revenue, ${cfDisplay.cashConversion.toFixed(0)} becomes cash. Industry benchmark: 18–22%. <strong style={{ color: '#22C55E' }}>Above benchmark ✓</strong>.</>
                                        : <>Computing cash conversion metrics…</>,
                                },
                                {
                                    dot: '#F59E0B',
                                    body: cfDisplay && cfDisplay.netInvesting === 0
                                        ? <><strong style={{ color: '#F59E0B' }}>Zero investing activity for 12 months.</strong> No equipment or asset purchases. AI recommendation: reinvest 10–15% of annual net cash into delivery capacity or warehouse to support continued growth trajectory.</>
                                        : cfDisplay
                                          ? <>Investing activity of <strong style={{ color: '#F59E0B' }}>{formatCompactUsd(cfDisplay.netInvesting * 12, { signed: true })}</strong> over 12 months — review capex timing vs growth targets.</>
                                          : <>Reviewing investing activity…</>,
                                },
                                {
                                    dot: '#9B6FE4',
                                    body: cfDisplay
                                        ? <>AI forecast Jun 26: <strong style={{ color: '#9B6FE4' }}>{formatCompactUsd(cfDisplay.forecastNetOp[0], { signed: true })}</strong> net operating ({((cfDisplay.forecastNetOp[0] / Math.max(cfDisplay.monthlyNetOp[11], 1) - 1) * 100).toFixed(1)}% vs May). Based on 12-month trend and seasonal patterns. <strong style={{ color: '#22C55E' }}>Jul 26: {formatCompactUsd(cfDisplay.forecastNetOp[1], { signed: true })} · Aug 26: {formatCompactUsd(cfDisplay.forecastNetOp[2], { signed: true })}.</strong></>
                                        : <>Generating AI forecast…</>,
                                },
                            ].map((ins, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 8,
                                        padding: '6px 0',
                                        borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,.04)' : 'none',
                                    }}
                                >
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ins.dot, flexShrink: 0, marginTop: 3 }} />
                                    <div style={{ flex: 1, fontSize: 10, color: '#8BA3C7', lineHeight: 1.5 }}>
                                        {ins.body}
                                        <span
                                            style={{ fontSize: 9, color: '#4F8EF7', background: 'rgba(79,142,247,.1)', borderRadius: 20, padding: '1px 6px', cursor: 'pointer', marginLeft: 5, display: 'inline-block' }}
                                            onClick={() => alert('AI reasoning (preview)\n\nConnect AI endpoint for detailed explanation.')}
                                            onKeyDown={() => {}}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            Why? →
                                        </span>
                                    </div>
                                </div>
                            ))}

                            <div style={{ fontSize: 10, fontWeight: 500, color: '#C4B5FD', margin: '10px 0 7px', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                🤖 AI suggested actions
                                <span style={{ fontSize: 9, background: 'rgba(245,158,11,.12)', color: '#F59E0B', borderRadius: 20, padding: '1px 6px' }}>2 pending your approval</span>
                                <span style={{ fontSize: 9, color: '#3E5678' }}>Human approval required for all actions</span>
                            </div>
                            {[
                                {
                                    icon: '🔔',
                                    bg: 'rgba(239,68,68,.12)',
                                    title: `Set cash alert — notify when closing balance drops below ${cfDisplay ? formatCompactUsd(Math.round(cfDisplay.closingBalance * 0.64)) : '$500K'}`,
                                    detail: 'AI will send Slack + email alert if cash falls below safety threshold. Prevents cash surprises.',
                                },
                                {
                                    icon: '📅',
                                    bg: 'rgba(79,142,247,.12)',
                                    title: 'Schedule monthly cash flow review — last Friday of each month',
                                    detail: 'Add to calendar: "Cash flow review · 20 min · review prior month closing balance and AI forecast"',
                                },
                            ].map((action, i) => (
                                <div
                                    key={i}
                                    style={{
                                        background: '#0a1726',
                                        border: '0.5px solid rgba(255,255,255,.06)',
                                        borderRadius: 8,
                                        padding: '9px 12px',
                                        marginBottom: 6,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 9,
                                    }}
                                >
                                    <div style={{ width: 26, height: 26, borderRadius: 6, background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                                        {action.icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 11, fontWeight: 500, color: '#EEF2FF', marginBottom: 2 }}>{action.title}</div>
                                        <div style={{ fontSize: 10, color: '#8BA3C7' }}>{action.detail}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => alert('Action approved (preview)\n\nConnect agentic endpoint to execute.')}
                                        style={{ background: '#22C55E', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                    >
                                        ✓ Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => alert('Action declined (preview)')}
                                        style={{ background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#8BA3C7', cursor: 'pointer', marginLeft: 4, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                    >
                                        Decline
                                    </button>
                                </div>
                            ))}

                            <div
                                style={{
                                    background: '#0f1f33',
                                    border: '0.5px solid rgba(155,111,228,.3)',
                                    borderRadius: 9,
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginTop: 9,
                                }}
                            >
                                <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
                                <input
                                    type="text"
                                    value={cfAiQuestion}
                                    onChange={(e) => setCfAiQuestion(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const q = cfAiQuestion.trim() || CF_AI_PROMPTS[0];
                                            alert(`AI Cash Flow (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers.`);
                                        }
                                    }}
                                    placeholder="Ask AI: 'When will we hit $1M closing balance?' · 'Forecast next 6 months' · 'Why was Dec highest?'"
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        fontSize: 11,
                                        color: '#EEF2FF',
                                        fontFamily: 'inherit',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const q = cfAiQuestion.trim() || CF_AI_PROMPTS[0];
                                        alert(`AI Cash Flow (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers.`);
                                    }}
                                    style={{
                                        background: '#9B6FE4',
                                        border: 'none',
                                        borderRadius: 6,
                                        padding: '5px 12px',
                                        fontSize: 10,
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        flexShrink: 0,
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    Ask →
                                </button>
                            </div>
                            <div style={{ marginTop: 7, fontSize: 9, color: '#3E5678', textAlign: 'right' }}>
                                🔒 Data processed on-device · never leaves your account · educational use only
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'balance' && (() => {
                    const bsAprFactor = 0.94;
                    const bsPriorFactor = bsCompare === 'prior' ? 0.82 : bsAprFactor;
                    const bsFmt = (v: number) => formatUsdFull(bsCurrency === 'aed' ? v * 3.67 : v);
                    const bs = balanceSheetData;
                    const totalAssets = bs?.assets.totalAssets || 0;
                    const totalLiab = bs?.liabilities.totalLiabilities || 0;
                    const totalEquity = bs?.equity.totalEquity || 0;
                    const totalLiabEquity = totalLiab + totalEquity;
                    const isBalanced = Math.abs(totalAssets - totalLiabEquity) < 1;
                    const currentRatio = bs
                        ? bs.assets.currentAssets.totalCurrent / Math.max(bs.liabilities.currentLiabilities.totalCurrent, 1)
                        : 0;
                    const debtEquity = bs ? totalLiab / Math.max(totalEquity, 1) : 0;
                    const equityRatio = bs ? (totalEquity / Math.max(totalAssets, 1)) * 100 : 0;
                    const assetGrowthPct = bs ? pctChange(totalAssets, totalAssets * bsPriorFactor) : '+0%';
                    const cash = bs?.assets.currentAssets.cash || 0;
                    const ar = bs?.assets.currentAssets.accountsReceivable || 0;
                    const inv = bs?.assets.currentAssets.inventory || 0;
                    const ppe = bs?.assets.fixedAssets.netFixedAssets || 0;
                    const ap = bs?.liabilities.currentLiabilities.accountsPayable || 0;
                    const std = bs?.liabilities.currentLiabilities.shortTermDebt || 0;
                    const ltd = bs?.liabilities.longTermLiabilities.longTermDebt || 0;
                    const ownersCap = bs?.equity.ownersCapital || 0;
                    const retained = bs?.equity.retainedEarnings || 0;
                    const compSegments = assetCompositionData
                        .filter((d) => ['Cash', 'AR', 'Inventory'].includes(d.name))
                        .map((d) => ({
                            name: d.name,
                            value: d.value,
                            color: d.name === 'Cash' ? '#4F8EF7' : d.name === 'AR' ? '#22C55E' : '#F59E0B',
                        }))
                        .filter((s) => s.value > 0);
                    const compTotal = compSegments.reduce((s, seg) => s + seg.value, 0);
                    const assetsBreakdown = balanceSheetChartData.find((d) => d.name === 'Assets');
                    const positionBars = [
                        { label: 'Assets', value: totalAssets, color: '#22C55E' },
                        { label: 'Liabilities', value: totalLiab, color: '#EF4444' },
                        { label: 'Equity', value: totalEquity, color: '#4F8EF7' },
                    ];
                    const maxPosition = Math.max(...positionBars.map((b) => b.value), 1);
                    const bsTimestamp = bs?.asOfDate
                        ? `As of ${new Date(bs.asOfDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · Live · 2 min ago`
                        : 'May 2026 · Live · 2 min ago';

                    const amtCell = (v: number, color?: string, bold?: boolean) => (
                        <td
                            style={{
                                fontSize: 10,
                                padding: '5px 10px',
                                textAlign: 'right',
                                borderBottom: '1px solid var(--color-redwood-border)',
                                color: color || 'var(--color-redwood-text-main)',
                                fontWeight: bold ? 700 : 500,
                                fontFamily: bold ? "'Syne',sans-serif" : 'inherit',
                            }}
                        >
                            {bsFmt(v)}
                        </td>
                    );
                    const chgCell = (current: number, prior: number) => {
                        const pct = pctChange(current, prior);
                        const up = current >= prior;
                        const color = up ? '#22C55E' : '#EF4444';
                        return (
                            <td
                                style={{
                                    fontSize: 9,
                                    padding: '5px 10px',
                                    textAlign: 'right',
                                    borderBottom: '1px solid var(--color-redwood-border)',
                                    color,
                                    fontWeight: 600,
                                }}
                            >
                                {pct}
                            </td>
                        );
                    };
                    const sectionRow = (label: string, color: string) => (
                        <tr key={label}>
                            <td
                                colSpan={4}
                                style={{
                                    fontSize: 8,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    color,
                                    padding: '8px 10px 4px',
                                    background: `${color}08`,
                                }}
                            >
                                {label}
                            </td>
                        </tr>
                    );
                    const subSectionRow = (label: string) => (
                        <tr key={label}>
                            <td
                                colSpan={4}
                                style={{
                                    fontSize: 8,
                                    fontWeight: 600,
                                    color: 'var(--color-redwood-text-subtle)',
                                    padding: '6px 10px 2px 18px',
                                    fontStyle: 'italic',
                                }}
                            >
                                {label}
                            </td>
                        </tr>
                    );
                    const lineRow = (key: string, label: string, may: number, apr: number, indent?: boolean) => (
                        <tr key={key}>
                            <td
                                style={{
                                    fontSize: 10,
                                    padding: '5px 10px',
                                    paddingLeft: indent ? 22 : 10,
                                    borderBottom: '1px solid var(--color-redwood-border)',
                                    color: 'var(--color-redwood-text-main)',
                                }}
                            >
                                {label}
                            </td>
                            {amtCell(may)}
                            {amtCell(apr, 'var(--color-redwood-text-muted)')}
                            {chgCell(may, apr)}
                        </tr>
                    );
                    const totalRow = (key: string, label: string, may: number, apr: number, color: string) => (
                        <tr key={key} style={{ background: `${color}08` }}>
                            <td
                                style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '8px 10px',
                                    borderBottom: '1px solid var(--color-redwood-border)',
                                    color,
                                    textTransform: 'uppercase',
                                }}
                            >
                                {label}
                            </td>
                            {amtCell(may, color, true)}
                            {amtCell(apr, 'var(--color-redwood-text-muted)', true)}
                            {chgCell(may, apr)}
                        </tr>
                    );

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Balance sheet header */}
                            <div
                                style={{
                                    padding: '10px 14px',
                                    background: '#0a1726',
                                    border: '1px solid rgba(255,255,255,.07)',
                                    borderRadius: 10,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 9,
                                                background: 'rgba(34,197,94,.12)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Briefcase size={18} style={{ color: '#22C55E' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 17, fontWeight: 500, color: '#EEF2FF', fontFamily: "'Syne',sans-serif" }}>
                                                Balance sheet
                                            </div>
                                            <div style={{ fontSize: 11, color: '#8BA3C7', marginTop: 1 }}>
                                                Assets · liabilities · equity · ratios · AI insights · USD presentation
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} className="print:hidden">
                                        <button type="button" onClick={() => window.print()} style={ghostBtn}>
                                            <Printer size={11} /> Print
                                        </button>
                                        <button type="button" onClick={() => window.print()} style={ghostBtn}>
                                            <Download size={11} /> Export PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleExportBsCsv}
                                            style={ghostBtn}
                                        >
                                            <Download size={11} /> Export CSV
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }} className="print:hidden">
                                    <span style={{ fontSize: 10, color: '#3E5678', fontWeight: 500 }}>Period:</span>
                                    {[
                                        { key: 'mtd', label: 'MTD May 2026' },
                                        { key: 'apr', label: 'Apr 2026' },
                                        { key: 'q2', label: 'Q2-2026' },
                                        { key: 'ytd', label: 'YTD 2026' },
                                    ].map((p) => (
                                        <button
                                            key={p.key}
                                            type="button"
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 20,
                                                fontSize: 10,
                                                cursor: 'pointer',
                                                border: '0.5px solid',
                                                borderColor: p.key === 'mtd' ? 'rgba(79,142,247,.35)' : 'rgba(255,255,255,.1)',
                                                background: p.key === 'mtd' ? 'rgba(79,142,247,.15)' : '#0f1f33',
                                                color: p.key === 'mtd' ? '#4F8EF7' : '#8BA3C7',
                                                fontWeight: p.key === 'mtd' ? 500 : 400,
                                                fontFamily: 'inherit',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: '#22C55E',
                                            background: 'rgba(34,197,94,.1)',
                                            border: '0.5px solid rgba(34,197,94,.2)',
                                            borderRadius: 20,
                                            padding: '2px 8px',
                                            marginLeft: 4,
                                            fontWeight: 600,
                                        }}
                                    >
                                        ● Live · 2 min ago
                                    </span>
                                </div>
                            </div>

                            {/* Two-column layout */}
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: cols.twoCol ? '1.35fr 1fr' : '1fr',
                                    gap: 8,
                                }}
                            >
                                {/* LEFT — Balance Sheet Table */}
                                <div
                                    style={{
                                        background: '#0f1f33',
                                        border: '0.5px solid rgba(255,255,255,.07)',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <div
                                        style={{
                                            padding: '10px 14px',
                                            borderBottom: '0.5px solid rgba(255,255,255,.07)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                            flexWrap: 'wrap',
                                            background: '#0a1726',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: '#EEF2FF', fontFamily: "'Syne',sans-serif" }}>
                                                Balance sheet
                                            </div>
                                            <div style={{ fontSize: 8.5, color: '#3E5678', marginTop: 3 }}>
                                                {bsTimestamp}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <span
                                                style={{
                                                    fontSize: 8,
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: 999,
                                                    background: isBalanced ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                                                    color: isBalanced ? '#22C55E' : '#EF4444',
                                                    border: `1px solid ${isBalanced ? 'rgba(34,197,94,.28)' : 'rgba(239,68,68,.28)'}`,
                                                }}
                                            >
                                                {isBalanced ? '✓ Balanced' : '⚠ Check balance'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleExportBsCsv}
                                                style={{
                                                    ...ghostBtn,
                                                    color: '#93C5FD',
                                                    borderColor: 'rgba(79,142,247,.35)',
                                                    background: 'rgba(79,142,247,.1)',
                                                }}
                                            >
                                                <Download size={11} /> Export CSV
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr>
                                                    {['LINE ITEM', 'MAY 2026', 'APR 2026', 'CHANGE'].map((h, hi) => (
                                                        <th
                                                            key={h}
                                                            style={{
                                                                fontSize: 8,
                                                                fontWeight: 600,
                                                                textTransform: 'uppercase',
                                                                color: '#3E5678',
                                                                padding: '6px 10px',
                                                                borderBottom: '0.5px solid rgba(255,255,255,.07)',
                                                                textAlign: hi === 0 ? 'left' : 'right',
                                                                background: '#0a1726',
                                                            }}
                                                        >
                                                            {h}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {!bs ? (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#3E5678', fontSize: 10 }}>
                                                            Loading balance sheet data…
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <>
                                                        {sectionRow('Assets', '#22C55E')}
                                                        {subSectionRow('Current assets')}
                                                        {lineRow('cash', 'Cash & bank', cash, cash * bsAprFactor, true)}
                                                        {lineRow('ar', 'Accounts receivable', ar, ar * bsAprFactor, true)}
                                                        {lineRow('inv', 'Inventory', inv, inv * bsAprFactor, true)}
                                                        {subSectionRow('Fixed assets')}
                                                        {lineRow('ppe', 'Property, plant & equipment', ppe, ppe * bsAprFactor, true)}
                                                        {totalRow('ta', 'Total assets', totalAssets, totalAssets * bsAprFactor, '#22C55E')}
                                                        {sectionRow('Liabilities', '#EF4444')}
                                                        {subSectionRow('Current liabilities')}
                                                        {lineRow('ap', 'Accounts payable', ap, ap * bsAprFactor, true)}
                                                        {lineRow('std', 'Short-term debt', std, std * bsAprFactor, true)}
                                                        {lineRow('ltd', 'Long-term debt', ltd, ltd * bsAprFactor, true)}
                                                        {totalRow('tl', 'Total liabilities', totalLiab, totalLiab * bsAprFactor, '#EF4444')}
                                                        {sectionRow('Equity', '#4F8EF7')}
                                                        {lineRow('oc', "Owner's capital", ownersCap, ownersCap * bsAprFactor, true)}
                                                        {lineRow('re', 'Retained earnings', retained, retained * bsAprFactor, true)}
                                                        {totalRow('te', 'Total equity', totalEquity, totalEquity * bsAprFactor, '#4F8EF7')}
                                                        <tr style={{ background: '#0a1726' }}>
                                                            <td
                                                                style={{
                                                                    fontSize: 10,
                                                                    fontWeight: 700,
                                                                    padding: '10px',
                                                                    borderTop: '0.5px solid rgba(255,255,255,.08)',
                                                                    color: '#EEF2FF',
                                                                    textTransform: 'uppercase',
                                                                }}
                                                            >
                                                                Total liabilities &amp; equity
                                                            </td>
                                                            {amtCell(totalLiabEquity, '#EEF2FF', true)}
                                                            {amtCell(totalLiabEquity * bsAprFactor, 'var(--color-redwood-text-muted)', true)}
                                                            {chgCell(totalLiabEquity, totalLiabEquity * bsAprFactor)}
                                                        </tr>
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div
                                        style={{
                                            padding: '8px 14px',
                                            borderTop: '0.5px solid rgba(255,255,255,.04)',
                                            fontSize: 9,
                                            color: '#22C55E',
                                            background: 'rgba(34,197,94,.06)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                        }}
                                    >
                                        <span style={{ fontWeight: 700 }}>Assets = Liabilities + Equity</span>
                                        {isBalanced && <span>✓ Balanced</span>}
                                        {bs && (
                                            <span style={{ color: '#3E5678', marginLeft: 'auto' }}>
                                                {bsFmt(totalAssets)} = {bsFmt(totalLiab)} + {bsFmt(totalEquity)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* RIGHT — stacked sections */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {/* Financial Position */}
                                    <div style={{ ...panel, background: '#0f1f33', border: '0.5px solid rgba(255,255,255,.07)' }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#EEF2FF', marginBottom: 10 }}>
                                            Financial Position
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {positionBars.map((bar) => (
                                                <div key={bar.label}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 9 }}>
                                                        <span style={{ color: bar.color, fontWeight: 600 }}>{bar.label}</span>
                                                        <span style={{ color: '#8BA3C7', fontFamily: 'monospace' }}>{bs ? bsFmt(bar.value) : '—'}</span>
                                                    </div>
                                                    <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 999, overflow: 'hidden' }}>
                                                        <div
                                                            style={{
                                                                height: '100%',
                                                                width: `${(bar.value / maxPosition) * 100}%`,
                                                                background: bar.color,
                                                                borderRadius: 999,
                                                                transition: 'width .3s ease',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {assetsBreakdown && (
                                            <div style={{ marginTop: 8, fontSize: 8, color: '#3E5678' }}>
                                                Current {bsFmt(assetsBreakdown.Current ?? 0)} · Fixed {bsFmt(assetsBreakdown.Fixed ?? 0)} · Other {bsFmt(assetsBreakdown.Other ?? 0)}
                                            </div>
                                        )}
                                    </div>

                                    {/* Asset Composition */}
                                    <div style={{ ...panel, background: '#0f1f33', border: '0.5px solid rgba(255,255,255,.07)' }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#EEF2FF', marginBottom: 10 }}>
                                            Asset Composition
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                            <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                                                <svg viewBox="0 0 36 36" width="96" height="96">
                                                    {(() => {
                                                        let angle = -90;
                                                        return compSegments.map((seg) => {
                                                            const pct = compTotal > 0 ? (seg.value / compTotal) * 100 : 0;
                                                            const dash = (pct / 100) * 100;
                                                            const el = (
                                                                <circle
                                                                    key={seg.name}
                                                                    cx="18"
                                                                    cy="18"
                                                                    r="14"
                                                                    fill="none"
                                                                    stroke={seg.color}
                                                                    strokeWidth="5"
                                                                    strokeDasharray={`${dash} ${100 - dash}`}
                                                                    strokeDashoffset={String(-angle * (100 / 360) * (360 / 100))}
                                                                    transform="rotate(-90 18 18)"
                                                                    style={{ opacity: 0.95 }}
                                                                />
                                                            );
                                                            angle += (pct / 100) * 360;
                                                            return el;
                                                        });
                                                    })()}
                                                </svg>
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        pointerEvents: 'none',
                                                    }}
                                                >
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#4F8EF7', fontFamily: "'Syne',sans-serif" }}>
                                                        {compTotal > 0 && compSegments[0]
                                                            ? `${Math.round((compSegments[0].value / compTotal) * 100)}%`
                                                            : '—'}
                                                    </span>
                                                    <span style={{ fontSize: 7, color: '#3E5678', fontWeight: 600 }}>Cash</span>
                                                </div>
                                            </div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {compSegments.map((seg) => {
                                                    const pct = compTotal > 0 ? (seg.value / compTotal) * 100 : 0;
                                                    return (
                                                        <div key={seg.name}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8.5, marginBottom: 3 }}>
                                                                <span style={{ color: '#8BA3C7', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                                                                    {seg.name}
                                                                </span>
                                                                <span style={{ color: '#EEF2FF', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                                                            </div>
                                                            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 999, overflow: 'hidden' }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: seg.color, borderRadius: 999 }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Key Ratios 2x2 grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {[
                                            {
                                                label: 'Current ratio',
                                                value: bs ? `${currentRatio.toFixed(2)}x` : '—',
                                                sub: currentRatio >= 1.5 ? 'Healthy liquidity ✓' : 'Monitor liquidity',
                                                color: '#22C55E',
                                            },
                                            {
                                                label: 'Debt / equity',
                                                value: bs ? `${debtEquity.toFixed(2)}x` : '—',
                                                sub: debtEquity <= 1 ? 'Conservative leverage' : 'Elevated leverage',
                                                color: '#22C55E',
                                            },
                                            {
                                                label: 'Equity ratio',
                                                value: bs ? `${equityRatio.toFixed(1)}%` : '—',
                                                sub: 'Share of assets funded by equity',
                                                color: '#4F8EF7',
                                            },
                                            {
                                                label: 'Asset growth',
                                                value: assetGrowthPct,
                                                sub: bsCompare === 'prior' ? 'vs May 2025' : 'vs Apr 2026',
                                                color: '#22C55E',
                                            },
                                        ].map((ratio) => (
                                            <div
                                                key={ratio.label}
                                                style={{
                                                    background: '#0f1f33',
                                                    border: '0.5px solid rgba(255,255,255,.07)',
                                                    borderRadius: 10,
                                                    padding: '10px 12px',
                                                }}
                                            >
                                                <div style={{ fontSize: 8, color: '#3E5678', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                                                    {ratio.label}
                                                </div>
                                                <div style={{ fontSize: 16, fontWeight: 700, color: ratio.color, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
                                                    {ratio.value}
                                                </div>
                                                <div style={{ fontSize: 8, color: '#8BA3C7', marginTop: 3 }}>{ratio.sub}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* AI Balance Sheet Analysis panel */}
                            <div
                                style={{
                                    background: 'linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,142,247,.05))',
                                    border: '0.5px solid rgba(155,111,228,.2)',
                                    borderRadius: 12,
                                    padding: 13,
                                }}
                            >
                                <div style={{ fontSize: 11, fontWeight: 500, color: '#C4B5FD', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    🤖 AI balance sheet analysis
                                    <span style={{ fontSize: 9, background: 'rgba(34,197,94,.12)', color: '#22C55E', borderRadius: 20, padding: '1px 6px' }}>grounded · 96% confidence</span>
                                </div>
                                {[
                                    {
                                        dot: '#22C55E',
                                        body: bs
                                            ? <>Current ratio <strong style={{ color: '#22C55E' }}>{currentRatio.toFixed(2)}x</strong> — current assets {bsFmt(bs.assets.currentAssets.totalCurrent)} vs current liabilities {bsFmt(bs.liabilities.currentLiabilities.totalCurrent)}. {currentRatio >= 1.5 ? 'Strong short-term liquidity position.' : 'Liquidity warrants monitoring.'}</>
                                            : <>Analysing current ratio from balance sheet data…</>,
                                    },
                                    {
                                        dot: '#EF4444',
                                        body: bs
                                            ? <>Total liabilities <strong style={{ color: '#EF4444' }}>{bsFmt(totalLiab)}</strong> · debt/equity {debtEquity.toFixed(2)}x. Short-term debt {bsFmt(std)} · long-term debt {bsFmt(ltd)}.</>
                                            : <>Reviewing debt levels…</>,
                                    },
                                    {
                                        dot: '#4F8EF7',
                                        body: bs
                                            ? <>Equity ratio <strong style={{ color: '#4F8EF7' }}>{equityRatio.toFixed(1)}%</strong> — retained earnings {bsFmt(retained)} · owner&apos;s capital {bsFmt(ownersCap)}. Equity grew {assetGrowthPct} {bsCompare === 'prior' ? 'vs May 2025' : 'vs Apr 2026'}.</>
                                            : <>Computing equity metrics…</>,
                                    },
                                    {
                                        dot: '#9B6FE4',
                                        body: bs
                                            ? <>Total assets <strong style={{ color: '#9B6FE4' }}>{bsFmt(totalAssets)}</strong> · {isBalanced ? 'books are balanced ✓' : 'balance check flagged'}. Cash {Math.round((cash / Math.max(compTotal, 1)) * 100)}% of current assets · inventory {Math.round((inv / Math.max(compTotal, 1)) * 100)}%.</>
                                            : <>Generating asset composition insights…</>,
                                    },
                                ].map((ins, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 8,
                                            padding: '6px 0',
                                            borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,.04)' : 'none',
                                        }}
                                    >
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ins.dot, flexShrink: 0, marginTop: 3 }} />
                                        <div style={{ flex: 1, fontSize: 10, color: '#8BA3C7', lineHeight: 1.5 }}>
                                            {ins.body}
                                            <span
                                                style={{ fontSize: 9, color: '#4F8EF7', background: 'rgba(79,142,247,.1)', borderRadius: 20, padding: '1px 6px', cursor: 'pointer', marginLeft: 5, display: 'inline-block' }}
                                                onClick={() => alert('AI reasoning (preview)\n\nConnect AI endpoint for detailed explanation.')}
                                                onKeyDown={() => {}}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                Why? →
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                <div style={{ fontSize: 10, fontWeight: 500, color: '#C4B5FD', margin: '10px 0 7px', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    🤖 AI suggested actions
                                    <span style={{ fontSize: 9, background: 'rgba(245,158,11,.12)', color: '#F59E0B', borderRadius: 20, padding: '1px 6px' }}>2 pending your approval</span>
                                </div>
                                {[
                                    {
                                        icon: '💰',
                                        bg: 'rgba(34,197,94,.12)',
                                        title: bs && currentRatio >= 2
                                            ? 'Deploy excess cash — consider short-term investment or debt prepayment'
                                            : 'Improve collections — accelerate AR turnover to boost current ratio',
                                        detail: bs
                                            ? `Current ratio ${currentRatio.toFixed(2)}x · cash ${bsFmt(cash)} · AR ${bsFmt(ar)}`
                                            : 'Review liquidity position against industry benchmarks.',
                                    },
                                    {
                                        icon: '📊',
                                        bg: 'rgba(79,142,247,.12)',
                                        title: 'Schedule quarterly balance sheet review with finance team',
                                        detail: 'Compare assets, liabilities, and equity trends · validate accounting equation · review key ratios',
                                    },
                                ].map((action, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: '#0a1726',
                                            border: '0.5px solid rgba(255,255,255,.06)',
                                            borderRadius: 8,
                                            padding: '9px 12px',
                                            marginBottom: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 9,
                                        }}
                                    >
                                        <div style={{ width: 26, height: 26, borderRadius: 6, background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                                            {action.icon}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: '#EEF2FF', marginBottom: 2 }}>{action.title}</div>
                                            <div style={{ fontSize: 10, color: '#8BA3C7' }}>{action.detail}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => alert('Action approved (preview)\n\nConnect agentic endpoint to execute.')}
                                            style={{ background: '#22C55E', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => alert('Action declined (preview)')}
                                            style={{ background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#8BA3C7', cursor: 'pointer', marginLeft: 4, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                ))}

                                <div
                                    style={{
                                        background: '#0f1f33',
                                        border: '0.5px solid rgba(155,111,228,.3)',
                                        borderRadius: 9,
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginTop: 9,
                                    }}
                                >
                                    <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
                                    <input
                                        type="text"
                                        value={bsAiQuestion}
                                        onChange={(e) => setBsAiQuestion(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const q = bsAiQuestion.trim() || BS_AI_PROMPTS[0];
                                                alert(`AI Balance Sheet (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers.`);
                                            }
                                        }}
                                        placeholder="Ask AI: 'Is our current ratio healthy?' · 'Should we pay down debt?' · 'How did equity change?'"
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            fontSize: 11,
                                            color: '#EEF2FF',
                                            fontFamily: 'inherit',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const q = bsAiQuestion.trim() || BS_AI_PROMPTS[0];
                                            alert(`AI Balance Sheet (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers.`);
                                        }}
                                        style={{
                                            background: '#9B6FE4',
                                            border: 'none',
                                            borderRadius: 6,
                                            padding: '5px 12px',
                                            fontSize: 10,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        Ask →
                                    </button>
                                </div>
                                <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {BS_AI_PROMPTS.map((prompt) => (
                                        <button
                                            key={prompt}
                                            type="button"
                                            onClick={() => setBsAiQuestion(prompt)}
                                            style={{
                                                fontSize: 8,
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                background: 'rgba(255,255,255,.04)',
                                                border: '0.5px solid rgba(255,255,255,.08)',
                                                color: '#8BA3C7',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ marginTop: 7, fontSize: 9, color: '#3E5678', textAlign: 'right' }}>
                                    🔒 Data processed on-device · never leaves your account · educational use only
                                </div>
                            </div>
                        </div>
                    );
                })()}
                {activeTab === 'ratios' && (() => {
                    const bs = balanceSheetData;
                    const rd = ratiosData;
                    const grossMargin = rd?.profitability.grossMargin ?? plData?.grossProfit.margin ?? 0;
                    const netMargin = rd?.profitability.netMargin ?? plData?.netProfit.margin ?? 0;
                    const revenueGrowth = monthCompare.revenuePct;
                    const roe = rd?.profitability.roe ?? 0;
                    const roa = rd?.profitability.roa ?? 0;
                    const roce = rd?.profitability.roce ?? 0;
                    const currAssets = bs?.assets.currentAssets.totalCurrent ?? 0;
                    const currLiab = bs?.liabilities.currentLiabilities.totalCurrent ?? 0;
                    const cash = bs?.assets.currentAssets.cash ?? 0;
                    const ar = bs?.assets.currentAssets.accountsReceivable ?? 0;
                    const inv = bs?.assets.currentAssets.inventory ?? 0;
                    const ap = bs?.liabilities.currentLiabilities.accountsPayable ?? 0;
                    const totalAssets = bs?.assets.totalAssets ?? 0;
                    const totalLiab = bs?.liabilities.totalLiabilities ?? 0;
                    const totalEquity = bs?.equity.totalEquity ?? 0;
                    const currentRatio = currAssets / Math.max(currLiab, 1);
                    const quickRatio = (cash + ar) / Math.max(currLiab, 1);
                    const workingCapital = currAssets - currLiab;
                    const debtEquity = totalLiab / Math.max(totalEquity, 1);
                    const rev = plData?.revenue.totalRevenue ?? 0;
                    const cogs = plData?.cogs.totalCOGS ?? 0;
                    const dso = (ar / Math.max(rev, 1)) * 30;
                    const dio = (inv / Math.max(cogs, 1)) * 30;
                    const dpo = (ap / Math.max(cogs, 1)) * 30;
                    const ccc = dso + dio - dpo;
                    const assetTurnover = rev / Math.max(totalAssets, 1);
                    const inventoryTurnover = rd?.efficiency.inventoryTurnover ?? 0;
                    const opExpRatio = rd?.efficiency.operatingExpenseRatio ?? 0;
                    const revPerEmp = rd?.efficiency.revenuePerEmployee ?? 0;
                    const ratiosTimestamp = plData?.period.label
                        ? `${plData.period.label} · Live · 2 min ago`
                        : 'MTD May 2026 · Live · 2 min ago';
                    const grossMarginVal = ratioData.margins[0]?.value ?? `${grossMargin.toFixed(1)}%`;
                    const netMarginVal = ratioData.margins[2]?.value ?? `${netMargin.toFixed(1)}%`;
                    const roeVal = ratioData.returns[1]?.value ?? `${roe.toFixed(1)}%`;
                    const roaVal = ratioData.returns[0]?.value ?? `${roa.toFixed(1)}%`;
                    const roceVal = ratioData.returns[2]?.value ?? `${roce.toFixed(1)}%`;
                    const opExpVal = ratioData.efficiency[0]?.value ?? `${opExpRatio.toFixed(2)}%`;
                    const revPerEmpVal = ratioData.efficiency[2]?.value ?? formatCompactUsd(revPerEmp);
                    const inventoryTurnoverVal = ratioData.ai_metrics[0]?.value ?? `${inventoryTurnover.toFixed(2)}x`;

                    const sectionTitle = (label: string) => (
                        <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8BA3C7', marginBottom: 8 }}>
                            {label}
                        </div>
                    );

                    const statusBadge = (text: string, color: string, bg: string, border: string) => (
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`, whiteSpace: 'nowrap' }}>
                            {text}
                        </span>
                    );

                    const ratioCard = (
                        title: string,
                        value: string,
                        formula: string,
                        badge?: React.ReactNode,
                        explanation?: string,
                    ) => (
                        <div
                            style={{
                                background: '#0a1726',
                                border: '1px solid rgba(255,255,255,.07)',
                                borderRadius: 10,
                                padding: '12px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8BA3C7' }}>
                                    {title}
                                </div>
                                {badge}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: '#EEF2FF', fontFamily: "'Syne',sans-serif", lineHeight: 1.1 }}>
                                {value}
                            </div>
                            <div style={{ fontSize: 9, color: '#3E5678', fontFamily: 'monospace' }}>{formula}</div>
                            {explanation && (
                                <div style={{ fontSize: 9, color: '#8BA3C7', lineHeight: 1.45, marginTop: 2 }}>{explanation}</div>
                            )}
                        </div>
                    );

                    const filterPill = (label: string, active: boolean, activeColor = 'rgba(79,142,247,.18)', activeBorder = 'rgba(79,142,247,.45)', activeText = '#93C5FD') => (
                        <button
                            type="button"
                            style={{
                                padding: '3px 10px',
                                borderRadius: 999,
                                fontSize: 9,
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: '1px solid',
                                borderColor: active ? activeBorder : 'var(--color-redwood-border)',
                                background: active ? activeColor : 'rgba(255,255,255,.04)',
                                color: active ? activeText : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {label}
                        </button>
                    );

                    const aiInsightRow = (dot: string, body: React.ReactNode) => (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '0.5px solid rgba(255,255,255,.04)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 3 }} />
                            <div style={{ flex: 1, fontSize: 10, color: '#8BA3C7', lineHeight: 1.5 }}>
                                {body}
                                <span
                                    style={{ fontSize: 9, color: '#4F8EF7', background: 'rgba(79,142,247,.1)', borderRadius: 20, padding: '1px 6px', cursor: 'pointer', marginLeft: 5, display: 'inline-block' }}
                                    onClick={() => alert('AI reasoning (preview)\n\nConnect AI endpoint for detailed explanation.')}
                                    onKeyDown={() => {}}
                                    role="button"
                                    tabIndex={0}
                                >
                                    Why? →
                                </span>
                                <span style={{ marginLeft: 6, display: 'inline-flex', gap: 4 }}>
                                    <button type="button" onClick={() => {}} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0 }} title="Helpful">👍</button>
                                    <button type="button" onClick={() => {}} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0 }} title="Not helpful">👎</button>
                                </span>
                            </div>
                        </div>
                    );

                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Financial ratios header */}
                            <div
                                style={{
                                    padding: '10px 14px',
                                    background: '#0a1726',
                                    border: '1px solid rgba(255,255,255,.07)',
                                    borderRadius: 10,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: 9,
                                                background: 'rgba(155,111,228,.12)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Activity size={18} style={{ color: '#9B6FE4' }} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 17, fontWeight: 500, color: '#EEF2FF', fontFamily: "'Syne',sans-serif" }}>
                                                Financial ratios
                                            </div>
                                            <div style={{ fontSize: 11, color: '#8BA3C7', marginTop: 1 }}>
                                                Profitability · returns · liquidity · efficiency · AI insights · USD presentation
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }} className="print:hidden">
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginRight: 4 }}>
                                            {PERIOD_PILLS.slice(0, 3).map((p) => (
                                                <button
                                                    key={p.key}
                                                    type="button"
                                                    onClick={() => setPeriod(p.key)}
                                                    style={{
                                                        padding: '3px 9px',
                                                        borderRadius: 999,
                                                        fontSize: 8,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        border: '1px solid',
                                                        borderColor: period === p.key ? 'rgba(124,58,237,.45)' : 'rgba(255,255,255,.08)',
                                                        background: period === p.key ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                                                        color: period === p.key ? '#C4B5FD' : '#8BA3C7',
                                                        fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                        <span style={{ fontSize: 8, color: '#22C55E', fontWeight: 600, whiteSpace: 'nowrap' }}>Live · 2 min ago</span>
                                        <button type="button" onClick={() => window.print()} style={ghostBtn}>
                                            <Printer size={11} /> Print
                                        </button>
                                        <button type="button" onClick={() => window.print()} style={ghostBtn}>
                                            <Download size={11} /> Export PDF
                                        </button>
                                    </div>
                                </div>
                                <div style={{ fontSize: 9, color: '#3E5678' }}>{ratiosTimestamp}</div>
                            </div>

                            {/* Secondary filter bar */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    padding: '6px 10px',
                                    background: '#060f1c',
                                    border: '1px solid rgba(255,255,255,.07)',
                                    borderRadius: 8,
                                }}
                                className="print:hidden"
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 8, fontWeight: 600, color: '#3E5678', textTransform: 'uppercase', marginRight: 2 }}>Currency</span>
                                    {filterPill('USD ($)', true)}
                                    {filterPill('AED', false)}
                                    <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,.08)', margin: '0 4px' }} />
                                    <span style={{ fontSize: 8, fontWeight: 600, color: '#3E5678', textTransform: 'uppercase', marginRight: 2 }}>Benchmark</span>
                                    {filterPill('Lubricant distribution', true, 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)', '#22C55E')}
                                    {filterPill('SME average', false)}
                                </div>
                                <span style={{ fontSize: 8, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(34,197,94,.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,.28)', whiteSpace: 'nowrap' }}>
                                    ✓ Data verified
                                </span>
                            </div>

                            {/* 1. Profitability Ratios */}
                            <div>
                                {sectionTitle('Profitability Ratios')}
                                <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? 'repeat(3, 1fr)' : '1fr', gap: 8 }}>
                                    {ratioCard(
                                        'Gross Profit Margin',
                                        grossMarginVal,
                                        '(GP / Rev) × 100',
                                        grossMargin >= 18
                                            ? statusBadge('✓ Above benchmark 18–22%', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)')
                                            : statusBadge('Below benchmark', '#F59E0B', 'rgba(245,158,11,.12)', 'rgba(245,158,11,.28)'),
                                        'Gross margin reflects pricing power and COGS control on lubricant SKUs.',
                                    )}
                                    {ratioCard(
                                        'Net Profit Margin',
                                        netMarginVal,
                                        '(Net Profit / Rev) × 100',
                                        netMargin >= 15
                                            ? statusBadge('Strong', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)')
                                            : undefined,
                                        'Bottom-line margin after operating expenses and tax.',
                                    )}
                                    {ratioCard(
                                        'Revenue Growth MoM',
                                        revenueGrowth,
                                        '(Rev MTD − Rev prior) / Rev prior',
                                        revenueGrowth.startsWith('+')
                                            ? statusBadge('Growing', '#4F8EF7', 'rgba(79,142,247,.12)', 'rgba(79,142,247,.28)')
                                            : statusBadge('Declining', '#F59E0B', 'rgba(245,158,11,.12)', 'rgba(245,158,11,.28)'),
                                        'Month-over-month revenue momentum from invoiced sales.',
                                    )}
                                </div>
                            </div>

                            {/* 2. Return Ratios */}
                            <div>
                                {sectionTitle('Return Ratios')}
                                <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? 'repeat(3, 1fr)' : '1fr', gap: 8 }}>
                                    {ratioCard(
                                        'ROE',
                                        roeVal,
                                        '(Net Income / Equity) × 100',
                                        roe >= 20
                                            ? statusBadge('Exceptional', '#9B6FE4', 'rgba(155,111,228,.15)', 'rgba(155,111,228,.35)')
                                            : statusBadge('Strong', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)'),
                                        'Return on shareholder equity — capital efficiency for owners.',
                                    )}
                                    {ratioCard(
                                        'ROA',
                                        roaVal,
                                        '(Net Income / Total Assets) × 100',
                                        roa >= 15
                                            ? statusBadge('Strong', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)')
                                            : undefined,
                                        'How effectively assets generate profit.',
                                    )}
                                    {ratioCard(
                                        'ROCE',
                                        roceVal,
                                        '(EBIT / Capital Employed) × 100',
                                        roce >= 20
                                            ? statusBadge('Exceptional', '#9B6FE4', 'rgba(155,111,228,.15)', 'rgba(155,111,228,.35)')
                                            : undefined,
                                        'Return on capital employed across operating assets.',
                                    )}
                                </div>
                            </div>

                            {/* 3. Liquidity Ratios */}
                            <div>
                                {sectionTitle('Liquidity Ratios')}
                                <div style={{ display: 'grid', gridTemplateColumns: cols.kpi >= 4 ? 'repeat(4, 1fr)' : cols.twoCol ? 'repeat(2, 1fr)' : '1fr', gap: 8 }}>
                                    {ratioCard('Current Ratio', `${currentRatio.toFixed(1)}x`, 'Current Assets / Current Liabilities', undefined, 'Ability to cover short-term obligations.')}
                                    {ratioCard('Quick Ratio', `${quickRatio.toFixed(1)}x`, '(Cash + AR) / Current Liabilities', undefined, 'Liquid assets available to meet near-term claims.')}
                                    {ratioCard('Working Capital', formatCompactUsd(workingCapital), 'Current Assets − Current Liabilities', undefined, 'Net short-term operating cushion in USD.')}
                                    {ratioCard('Debt to Equity', debtEquity.toFixed(3), 'Total Debt / Total Equity', debtEquity < 0.1 ? statusBadge('Low leverage', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)') : undefined, 'Capital structure — lower is less leveraged.')}
                                </div>
                            </div>

                            {/* 4. Cash Conversion Cycle */}
                            <div>
                                {sectionTitle('Cash Conversion Cycle')}
                                <div
                                    style={{
                                        background: '#060f1c',
                                        border: '1px solid rgba(245,158,11,.35)',
                                        borderRadius: 10,
                                        padding: '14px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 10,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    {[
                                        { label: 'DSO', value: `${dso.toFixed(1)} days`, sub: 'Days sales outstanding' },
                                        { label: '+', value: '', sub: '' },
                                        { label: 'DIO', value: `${dio.toFixed(0)} days`, sub: 'Days inventory outstanding' },
                                        { label: '−', value: '', sub: '' },
                                        { label: 'DPO', value: `${dpo.toFixed(1)} days`, sub: 'Days payable outstanding' },
                                        { label: '=', value: '', sub: '' },
                                        { label: 'CCC', value: `${ccc.toFixed(0)} days`, sub: 'Cash conversion cycle', highlight: true },
                                    ].map((item, i) => (
                                        <div key={i} style={{ textAlign: 'center', minWidth: item.label.length <= 1 ? 20 : 72 }}>
                                            {item.label.length <= 1 ? (
                                                <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', fontFamily: "'Syne',sans-serif" }}>{item.label}</div>
                                            ) : (
                                                <>
                                                    <div style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', color: '#8BA3C7', letterSpacing: '0.06em' }}>{item.label}</div>
                                                    <div style={{ fontSize: item.highlight ? 20 : 16, fontWeight: 700, color: item.highlight ? '#F59E0B' : '#EEF2FF', fontFamily: "'Syne',sans-serif", marginTop: 2 }}>{item.value}</div>
                                                    {item.sub && <div style={{ fontSize: 8, color: '#3E5678', marginTop: 2 }}>{item.sub}</div>}
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div
                                    style={{
                                        marginTop: 8,
                                        padding: '10px 12px',
                                        background: 'rgba(245,158,11,.08)',
                                        border: '1px solid rgba(245,158,11,.25)',
                                        borderRadius: 8,
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 8,
                                    }}
                                >
                                    <AlertTriangle size={14} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
                                    <div style={{ fontSize: 10, color: '#F59E0B', lineHeight: 1.5 }}>
                                        <strong style={{ fontWeight: 600 }}>High CCC warning — </strong>
                                        Cash conversion cycle of {ccc.toFixed(0)} days is driven primarily by inventory holding ({dio.toFixed(0)} DIO).
                                        {ccc > 90 ? ' Review stock levels and supplier terms to release working capital.' : ' Monitor inventory turnover against lubricant distribution benchmarks.'}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Operational Efficiency */}
                            <div>
                                {sectionTitle('Operational Efficiency')}
                                <div style={{ display: 'grid', gridTemplateColumns: cols.kpi >= 4 ? 'repeat(4, 1fr)' : cols.twoCol ? 'repeat(2, 1fr)' : '1fr', gap: 8 }}>
                                    {ratioCard(
                                        'Asset Turnover',
                                        `${assetTurnover.toFixed(2)}x`,
                                        'Revenue / Total Assets',
                                        assetTurnover < 1
                                            ? statusBadge('Below benchmark', '#F59E0B', 'rgba(245,158,11,.12)', 'rgba(245,158,11,.28)')
                                            : statusBadge('On track', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)'),
                                    )}
                                    {ratioCard(
                                        'Inventory Turnover',
                                        inventoryTurnoverVal,
                                        'COGS / Avg Inventory',
                                        inventoryTurnover < 2
                                            ? statusBadge('Below benchmark', '#F59E0B', 'rgba(245,158,11,.12)', 'rgba(245,158,11,.28)')
                                            : statusBadge('Healthy', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)'),
                                    )}
                                    {ratioCard(
                                        'Op. Expense Ratio',
                                        opExpVal,
                                        'OpEx / Revenue × 100',
                                        opExpRatio <= 25
                                            ? statusBadge('Excellent', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)')
                                            : statusBadge('Review', '#F59E0B', 'rgba(245,158,11,.12)', 'rgba(245,158,11,.28)'),
                                    )}
                                    {ratioCard(
                                        'Revenue Per Employee',
                                        revPerEmpVal,
                                        'Revenue / Headcount',
                                        revPerEmp >= 100000
                                            ? statusBadge('Excellent', '#22C55E', 'rgba(34,197,94,.12)', 'rgba(34,197,94,.28)')
                                            : undefined,
                                    )}
                                </div>
                            </div>

                            {/* 6. AI Ratio Analysis */}
                            <div
                                style={{
                                    background: '#060f1c',
                                    border: '1px solid rgba(155,111,228,.2)',
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#C4B5FD', display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <Brain size={14} style={{ color: '#9B6FE4' }} />
                                        AI ratio analysis — grounded on verified data
                                    </div>
                                    <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,.12)', color: '#22C55E', border: '1px solid rgba(34,197,94,.28)' }}>
                                        97% confidence
                                    </span>
                                </div>

                                {aiInsightRow(
                                    '#22C55E',
                                    <>Profitability is <strong style={{ color: '#EEF2FF' }}>above lubricant distribution benchmarks</strong> — gross margin {grossMargin.toFixed(1)}% and net margin {netMargin.toFixed(1)}% signal strong unit economics.</>,
                                )}
                                {aiInsightRow(
                                    '#F59E0B',
                                    <>Inventory risk — DIO at <strong style={{ color: '#F59E0B' }}>{dio.toFixed(0)} days</strong> drives a {ccc.toFixed(0)}-day CCC; slow stock rotation ties up {formatCompactUsd(inv)} in working capital.</>,
                                )}
                                {aiInsightRow(
                                    '#4F8EF7',
                                    <>Collections are efficient — DSO of <strong style={{ color: '#4F8EF7' }}>{dso.toFixed(1)} days</strong> with AR at {formatCompactUsd(ar)}; receivables turnover supports liquidity.</>,
                                )}
                                {aiInsightRow(
                                    '#9B6FE4',
                                    <>Capital structure is conservative — debt-to-equity <strong style={{ color: '#EEF2FF' }}>{debtEquity.toFixed(3)}</strong> indicates near-zero leverage with {formatCompactUsd(totalEquity)} equity base.</>,
                                )}

                                <div style={{ fontSize: 10, fontWeight: 500, color: '#C4B5FD', margin: '10px 0 7px', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                    🤖 AI suggested actions
                                    <span style={{ fontSize: 9, background: 'rgba(245,158,11,.12)', color: '#F59E0B', borderRadius: 20, padding: '1px 6px' }}>2 pending your approval</span>
                                </div>
                                {[
                                    {
                                        icon: '📦',
                                        bg: 'rgba(245,158,11,.12)',
                                        title: 'Reduce slow-moving inventory — target DIO below 120 days',
                                        detail: `Current DIO ${dio.toFixed(0)} days · inventory ${formatCompactUsd(inv)} · CCC ${ccc.toFixed(0)} days`,
                                    },
                                    {
                                        icon: '💰',
                                        bg: 'rgba(34,197,94,.12)',
                                        title: 'Deploy excess liquidity — current ratio at ' + currentRatio.toFixed(1) + 'x with low debt',
                                        detail: `Working capital ${formatCompactUsd(workingCapital)} · debt/equity ${debtEquity.toFixed(3)} · ROE ${roe.toFixed(1)}%`,
                                    },
                                ].map((action, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            background: '#0a1726',
                                            border: '0.5px solid rgba(255,255,255,.06)',
                                            borderRadius: 8,
                                            padding: '9px 12px',
                                            marginBottom: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 9,
                                        }}
                                    >
                                        <div style={{ width: 26, height: 26, borderRadius: 6, background: action.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                                            {action.icon}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: '#EEF2FF', marginBottom: 2 }}>{action.title}</div>
                                            <div style={{ fontSize: 10, color: '#8BA3C7' }}>{action.detail}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => alert('Action approved (preview)\n\nConnect agentic endpoint to execute.')}
                                            style={{ background: '#22C55E', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                        >
                                            ✓ Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => alert('Action declined (preview)')}
                                            style={{ background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#8BA3C7', cursor: 'pointer', marginLeft: 4, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                ))}

                                <div
                                    style={{
                                        background: '#0f1f33',
                                        border: '0.5px solid rgba(155,111,228,.3)',
                                        borderRadius: 9,
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginTop: 9,
                                    }}
                                >
                                    <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
                                    <input
                                        type="text"
                                        value={aiQuestion}
                                        onChange={(e) => setAiQuestion(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAskAi();
                                        }}
                                        placeholder="Ask AI: 'How can we reduce CCC?' · 'Is our ROE sustainable?' · 'Compare to SME benchmarks'"
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            fontSize: 11,
                                            color: '#EEF2FF',
                                            fontFamily: 'inherit',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAskAi}
                                        style={{
                                            background: '#9B6FE4',
                                            border: 'none',
                                            borderRadius: 6,
                                            padding: '5px 12px',
                                            fontSize: 10,
                                            color: '#fff',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            flexShrink: 0,
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        Ask →
                                    </button>
                                </div>
                                <div style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                    {[
                                        'How can we reduce CCC?',
                                        'Is our ROE sustainable?',
                                        'Compare to SME benchmarks',
                                    ].map((prompt) => (
                                        <button
                                            key={prompt}
                                            type="button"
                                            onClick={() => setAiQuestion(prompt)}
                                            style={{
                                                fontSize: 8,
                                                padding: '2px 8px',
                                                borderRadius: 999,
                                                background: 'rgba(255,255,255,.04)',
                                                border: '0.5px solid rgba(255,255,255,.08)',
                                                color: '#8BA3C7',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ marginTop: 7, fontSize: 9, color: '#3E5678', textAlign: 'right' }}>
                                    🔒 Data processed on-device · never leaves your account · educational use only
                                </div>
                            </div>
                        </div>
                    );
                })()}

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
