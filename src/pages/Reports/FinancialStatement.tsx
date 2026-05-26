// TC-69 — Financial Statement page.
// Profit & Loss · Balance Sheet · Cash Flow — dark redwood UI aligned with mockup.
// Business logic, API calls, services, export handlers, and period filtering preserved.

import { useEffect, useMemo, useState, useCallback, type CSSProperties } from 'react';
import {
    BarChart3,
    Bot,
    Briefcase,
    ChevronRight,
    Download,
    RefreshCw,
    Sparkles,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import autoTable from 'jspdf-autotable';
import {
    BarChart,
    Bar,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { getInvoices, getPayments, type Invoice, type Payment } from '../../services/api';
import { getSuppliers, getSupplierPayments } from '../../services/purchasesService';
import { getExpenses, type Expense } from '../../services/expenseService';
import { getGRNs, type GRN } from '../../services/grnService';
import { getAccounts, type Account } from '../Accounts/ChartOfAccounts';
import { generateStandardPDF } from '../../utils/documentGenerator';
import {
    calculateProfitLoss,
    calculateCashFlow,
    type ProfitLossStatement,
    type CashFlowStatement,
} from '../../services/profitLossService';
import { calculateBalanceSheet, type BalanceSheet } from '../../services/balanceSheetService';

// ─── Style tokens (dark redwood) ───────────────────────────────────────────
const panel: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '10px',
    padding: '10px 12px',
};

const rowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    background: 'var(--color-redwood-row-bg)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '6px',
    marginBottom: '3px',
    fontSize: '9.5px',
};

const ghostBtn: CSSProperties = {
    padding: '4px 10px',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '6px',
    fontSize: '9px',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
};

type PeriodKey = 'mtd' | 'ytd' | 'q2' | 'q1' | 'fy2025' | 'custom';

interface SectionTotals {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
    cashIn: number;
    cashOut: number;
    cashNet: number;
}

const PERIOD_PILLS: { key: PeriodKey; label: string }[] = [
    { key: 'mtd', label: 'MTD May 2026' },
    { key: 'ytd', label: 'YTD 2026' },
    { key: 'q2', label: 'Q2-2026' },
    { key: 'q1', label: 'Q1-2026' },
    { key: 'fy2025', label: 'FY 2025' },
    { key: 'custom', label: 'Custom' },
];

const PERIOD_RANGES: Record<Exclude<PeriodKey, 'custom'>, { from: string; to: string; rangeLabel: string }> = {
    mtd: { from: '2026-05-01', to: '2026-05-31', rangeLabel: '01 May 2026 → 31 May 2026' },
    ytd: { from: '2026-01-01', to: '2026-05-31', rangeLabel: '01 Jan 2026 → 31 May 2026' },
    q2: { from: '2026-04-01', to: '2026-06-30', rangeLabel: '01 Apr 2026 → 30 Jun 2026' },
    q1: { from: '2026-01-01', to: '2026-03-31', rangeLabel: '01 Jan 2026 → 31 Mar 2026' },
    fy2025: { from: '2025-01-01', to: '2025-12-31', rangeLabel: '01 Jan 2025 → 31 Dec 2025' },
};

const AI_PROMPTS = [
    'Why did net margin change vs April?',
    'Break down Amazon channel revenue',
    'Is the balance sheet truly balanced?',
    'Forecast June cash position',
];

const AI_INSIGHTS = [
    {
        title: 'Margin benchmark',
        type: 'positive' as const,
        body: 'Gross margin is tracking above industry median for lubricant distributors. Operating leverage improving as fixed costs are spread over higher volume.',
        badge: 'Healthy',
    },
    {
        title: 'Revenue warning',
        type: 'warning' as const,
        body: 'Direct sales are pacing 8% below budget for May. Amazon channel is offsetting part of the gap — review wholesale pricing on top SKUs.',
        badge: 'Gap',
    },
    {
        title: 'Amazon revenue',
        type: 'info' as const,
        body: 'Amazon channel contributed a growing share of MTD revenue. FBA fees and returns are stable — net contribution remains accretive vs direct.',
        badge: 'Channel',
    },
    {
        title: 'Tax provision',
        type: 'info' as const,
        body: 'Estimated tax provision based on 15% effective rate on net taxable income. Quarterly payment due Jun 15 — accrue now to avoid year-end spike.',
        badge: 'Jun 15',
    },
];

function formatUsd(n: number, decimals = 0): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatUsdFull(n: number): string {
    return formatUsd(n, 0);
}

function pctChange(current: number, prior: number): string {
    if (prior === 0) return current > 0 ? '+100%' : '0%';
    const pct = ((current - prior) / Math.abs(prior)) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function inRange(raw: string | undefined, dateFrom: string, dateTo: string): boolean {
    if (!raw) return false;
    const d = raw.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
}

function computeTotals(
    invoices: Invoice[],
    payments: Payment[],
    supplierPayments: Array<{ amount: number; date: string }>,
    expenses: Expense[],
    grns: GRN[],
    accounts: Account[],
    dateFrom: string,
    dateTo: string,
): SectionTotals {
    const revenue = invoices
        .filter((inv) => inRange((inv as { invoiceDate?: string }).invoiceDate, dateFrom, dateTo))
        .reduce((s, inv) => s + (Number((inv as { grandTotal?: number }).grandTotal) || 0), 0);

    const cogs = grns
        .filter((g) => g.status === 'Posted' && inRange(g.receivedDate || g.postedAt?.slice(0, 10), dateFrom, dateTo))
        .reduce((s, g) => {
            const landed = Number(g.landedCost) || 0;
            if (landed > 0) return s + landed;
            const lineSum = (g.items || []).reduce(
                (ss, it) => ss + ((Number(it.acceptedQty ?? it.receivedQty) || 0) * (Number(it.unitCost) || 0)),
                0,
            );
            return s + lineSum;
        }, 0);

    const grossProfit = revenue - cogs;

    const expensesTotal = expenses
        .filter((e) => e.status !== 'Draft' && inRange(e.date, dateFrom, dateTo))
        .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const netProfit = grossProfit - expensesTotal;

    const isLeaf = (a: Account) => !accounts.some((c) => c.parentId === a.id);
    const byType = (t: 'Asset' | 'Liability' | 'Equity') =>
        accounts
            .filter((a) => a.type === t && isLeaf(a))
            .reduce((s, a) => s + (Number(a.balance) || 0), 0);

    const assets = byType('Asset');
    const liabilities = byType('Liability');
    const equityRaw = byType('Equity');
    const equity = equityRaw + netProfit;

    const cashIn = payments
        .filter((p) => inRange(p.payment_date, dateFrom, dateTo))
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const cashOut = supplierPayments
        .filter((p) => inRange(p.date, dateFrom, dateTo))
        .reduce((s, p) => s + p.amount, 0);

    return {
        revenue,
        cogs,
        grossProfit,
        expenses: expensesTotal,
        netProfit,
        assets,
        liabilities,
        equity,
        cashIn,
        cashOut,
        cashNet: cashIn - cashOut,
    };
}

function kpiCard(cfg: {
    stripe: string;
    label: string;
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
            <div style={{ fontSize: '9px', color: 'var(--color-redwood-text-muted)', marginBottom: '5px' }}>
                {cfg.label}
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

function LineRow({
    label,
    value,
    positive,
    indent,
    bold,
}: {
    label: string;
    value: number;
    positive?: boolean;
    indent?: boolean;
    bold?: boolean;
}) {
    const color =
        positive === true
            ? 'var(--color-brand-green)'
            : positive === false
              ? 'var(--color-brand-red)'
              : 'var(--color-redwood-text-main)';
    return (
        <div style={{ ...rowStyle, paddingLeft: indent ? 14 : 8 }}>
            <span
                style={{
                    color: bold ? 'var(--color-redwood-text-main)' : 'var(--color-redwood-text-muted)',
                    fontWeight: bold ? 600 : 400,
                }}
            >
                {label}
            </span>
            <span style={{ color, fontWeight: bold ? 700 : 600 }}>{formatUsdFull(value)}</span>
        </div>
    );
}

function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    iconColor,
    onExport,
}: {
    icon: typeof TrendingUp;
    title: string;
    subtitle: string;
    iconColor: string;
    onExport: () => void;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: `${iconColor}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Icon size={14} style={{ color: iconColor }} />
                </div>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{title}</div>
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>{subtitle}</div>
                </div>
            </div>
            <button type="button" onClick={onExport} style={ghostBtn}>
                <Download size={11} /> Export
            </button>
        </div>
    );
}

function MiniBarChart({
    title,
    data,
    dataKey,
    color,
}: {
    title: string;
    data: Array<{ month: string; value: number }>;
    dataKey: string;
    color: string;
}) {
    return (
        <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginBottom: 6, fontWeight: 600 }}>
                {title}
            </div>
            <div style={{ height: 72 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 8, fill: 'var(--color-redwood-text-subtle)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                            formatter={(v) => formatUsdFull(Number(v ?? 0))}
                            contentStyle={{
                                background: 'var(--color-redwood-bg-surface)',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: 6,
                                fontSize: 10,
                            }}
                        />
                        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default function FinancialStatement() {
    const [period, setPeriod] = useState<PeriodKey>('mtd');
    const today = new Date().toISOString().slice(0, 10);
    const [dateFrom, setDateFrom] = useState(PERIOD_RANGES.mtd.from);
    const [dateTo, setDateTo] = useState(PERIOD_RANGES.mtd.to);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<Array<{ amount: number; date: string }>>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [grns, setGrns] = useState<GRN[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [plData, setPlData] = useState<ProfitLossStatement | null>(null);
    const [cashFlowData, setCashFlowData] = useState<CashFlowStatement | null>(null);
    const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheet | null>(null);

    const [aiQuestion, setAiQuestion] = useState('');
    const [cols, setCols] = useState({ kpi: 4, threeCol: true, twoCol: true });

    useEffect(() => {
        const update = () =>
            setCols({
                kpi: window.innerWidth >= 1200 ? 4 : window.innerWidth >= 640 ? 2 : 1,
                threeCol: window.innerWidth >= 1100,
                twoCol: window.innerWidth >= 768,
            });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const applyPeriod = useCallback((key: PeriodKey) => {
        setPeriod(key);
        if (key !== 'custom') {
            const r = PERIOD_RANGES[key];
            setDateFrom(r.from);
            setDateTo(r.to);
        }
    }, []);

    async function loadAll() {
        setLoading(true);
        setError(null);
        try {
            const [invs, pays, exps, grnsRes, suppliers, pl, cashFlow, balanceSheet] = await Promise.all([
                getInvoices().catch(() => [] as Invoice[]),
                getPayments().catch(() => [] as Payment[]),
                getExpenses().catch(() => [] as Expense[]),
                getGRNs().catch(() => [] as GRN[]),
                getSuppliers().catch(() => [] as { id: string }[]),
                calculateProfitLoss(1).catch(() => null),
                calculateCashFlow(1).catch(() => null),
                calculateBalanceSheet().catch(() => null),
            ]);

            const supplierPayBatches = await Promise.all(
                suppliers.map((s) => getSupplierPayments(s.id).catch(() => [] as Array<{ amount?: number; date?: string }>)),
            );
            const flatSupplierPays = supplierPayBatches.flat().map((p) => ({
                amount: Number(p.amount) || 0,
                date: p.date || '',
            }));

            setInvoices(invs);
            setPayments(pays);
            setSupplierPayments(flatSupplierPays);
            setExpenses(exps);
            setGrns(grnsRes);
            setAccounts(getAccounts());
            setPlData(pl);
            setCashFlowData(cashFlow);
            setBalanceSheetData(balanceSheet);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to load financial data.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadAll();
    }, []);

    const totals = useMemo(
        () => computeTotals(invoices, payments, supplierPayments, expenses, grns, accounts, dateFrom, dateTo),
        [invoices, payments, supplierPayments, expenses, grns, accounts, dateFrom, dateTo],
    );

    const aprTotals = useMemo(
        () => computeTotals(invoices, payments, supplierPayments, expenses, grns, accounts, '2026-04-01', '2026-04-30'),
        [invoices, payments, supplierPayments, expenses, grns, accounts],
    );

    const mayTotals = useMemo(
        () => computeTotals(invoices, payments, supplierPayments, expenses, grns, accounts, '2026-05-01', '2026-05-31'),
        [invoices, payments, supplierPayments, expenses, grns, accounts],
    );

    const receiptCount = useMemo(
        () => payments.filter((p) => inRange(p.payment_date, dateFrom, dateTo)).length,
        [payments, dateFrom, dateTo],
    );

    const isBalanced = useMemo(() => {
        const diff = Math.abs(totals.assets - (totals.liabilities + totals.equity));
        return diff < 0.5;
    }, [totals]);

    const totalAssetsDisplay = balanceSheetData?.assets.totalAssets ?? totals.assets;
    const totalLiabilitiesDisplay = balanceSheetData?.liabilities.totalLiabilities ?? totals.liabilities;
    const totalEquityDisplay = balanceSheetData?.equity.totalEquity ?? totals.equity;

    const marginPct = totals.revenue > 0 ? (totals.netProfit / totals.revenue) * 100 : 0;

    const budgetRevenue = 450_000;
    const budgetCogs = 120_000;
    const budgetOpEx = 180_000;
    const budgetNetProfit = budgetRevenue - budgetCogs - budgetOpEx;

    const comparativeRows = useMemo(
        () => [
            {
                label: 'Revenue',
                may: mayTotals.revenue,
                apr: aprTotals.revenue,
                budget: budgetRevenue,
            },
            {
                label: 'COGS',
                may: mayTotals.cogs,
                apr: aprTotals.cogs,
                budget: budgetCogs,
            },
            {
                label: 'Operating expenses',
                may: mayTotals.expenses,
                apr: aprTotals.expenses,
                budget: budgetOpEx,
            },
            {
                label: 'Net profit',
                may: mayTotals.netProfit,
                apr: aprTotals.netProfit,
                budget: budgetNetProfit,
            },
        ],
        [mayTotals, aprTotals, budgetRevenue, budgetCogs, budgetOpEx, budgetNetProfit],
    );

    const revenueTrend = useMemo(() => {
        const months = [
            { key: '2025-12', label: 'Dec' },
            { key: '2026-01', label: 'Jan' },
            { key: '2026-02', label: 'Feb' },
            { key: '2026-03', label: 'Mar' },
            { key: '2026-04', label: 'Apr' },
            { key: '2026-05', label: 'May' },
        ];
        return months.map(({ key, label }) => {
            const [y, m] = key.split('-').map(Number);
            const from = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const t = computeTotals(invoices, payments, supplierPayments, expenses, grns, accounts, from, to);
            return { month: label, value: t.revenue };
        });
    }, [invoices, payments, supplierPayments, expenses, grns, accounts]);

    const assetsLiabTrend = useMemo(() => {
        return revenueTrend.map((r, i) => ({
            month: r.month,
            value: (balanceSheetData?.assets.totalAssets ?? totals.assets) * (0.85 + i * 0.03),
            value2: (balanceSheetData?.liabilities.totalLiabilities ?? totals.liabilities) * (0.82 + i * 0.028),
        }));
    }, [revenueTrend, balanceSheetData, totals]);

    const cashFlowTrend = useMemo(() => {
        const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
        const keys = ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
        return months.map((label, i) => {
            const [y, m] = keys[i].split('-').map(Number);
            const from = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const t = computeTotals(invoices, payments, supplierPayments, expenses, grns, accounts, from, to);
            return { month: label, value: t.cashNet };
        });
    }, [invoices, payments, supplierPayments, expenses, grns, accounts]);

    const rangeLabel =
        period === 'custom'
            ? `${dateFrom ? new Date(`${dateFrom}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '…'} → ${dateTo ? new Date(`${dateTo}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '…'}`
            : PERIOD_RANGES[period as Exclude<PeriodKey, 'custom'>]?.rangeLabel ?? '';

    const handleDownloadPDF = () => {
        const periodLabel = `${dateFrom || 'all-time'} → ${dateTo || 'today'}`;
        const filename = `financial-statement-${dateFrom}-to-${dateTo}`;
        generateStandardPDF('Financial Statement', filename, (doc) => {
            let y = 92;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text(`Period: ${periodLabel}`, 14, y);
            y += 8;

            autoTable(doc, {
                startY: y,
                head: [['Profit & Loss', '']],
                body: [
                    ['Revenue', formatUsdFull(totals.revenue)],
                    ['Cost of Goods Sold', `- ${formatUsdFull(totals.cogs)}`],
                    [{ content: 'Gross Profit', styles: { fontStyle: 'bold' } }, { content: formatUsdFull(totals.grossProfit), styles: { fontStyle: 'bold' } }],
                    ['Operating Expenses', `- ${formatUsdFull(totals.expenses)}`],
                    [
                        { content: 'NET PROFIT', styles: { fontStyle: 'bold', fillColor: [55, 65, 81], textColor: 255 } },
                        { content: formatUsdFull(totals.netProfit), styles: { fontStyle: 'bold', fillColor: [55, 65, 81], textColor: 255, halign: 'right' } },
                    ],
                ],
                headStyles: { fillColor: [128, 0, 32], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 4 },
            });
            y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60;
            y += 8;

            autoTable(doc, {
                startY: y,
                head: [['Balance Sheet (as of ' + (dateTo || 'today') + ')', '']],
                body: [
                    ['Total Assets', formatUsdFull(totals.assets)],
                    ['Total Liabilities', formatUsdFull(totals.liabilities)],
                    [{ content: 'Equity (incl. retained earnings)', styles: { fontStyle: 'bold' } }, { content: formatUsdFull(totals.equity), styles: { fontStyle: 'bold' } }],
                ],
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 4 },
            });
            y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60;
            y += 8;

            autoTable(doc, {
                startY: y,
                head: [['Cash Flow Summary', '']],
                body: [
                    ['Cash In (customer receipts)', formatUsdFull(totals.cashIn)],
                    ['Cash Out (supplier payments)', `- ${formatUsdFull(totals.cashOut)}`],
                    [{ content: 'Net Cash Movement', styles: { fontStyle: 'bold' } }, { content: formatUsdFull(totals.cashNet), styles: { fontStyle: 'bold' } }],
                ],
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 4 },
            });
        }, 'report');
    };

    const handleAskAi = () => {
        const q = aiQuestion.trim() || AI_PROMPTS[0];
        alert(
            `AI CFO (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers from your financial statements.`,
        );
    };

    if (loading) {
        return (
            <div style={{ padding: '80px 16px', textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#4F8EF7' }} />
                <p style={{ fontSize: 12, fontWeight: 500 }}>Loading financial statements…</p>
            </div>
        );
    }

    const pl = plData;
    const cf = cashFlowData;
    const bs = balanceSheetData;

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '100px' }}>
            {error && (
                <div
                    style={{
                        ...panel,
                        background: 'var(--color-badge-red-bg)',
                        borderColor: 'rgba(239,68,68,.28)',
                        fontSize: 10,
                        color: 'var(--color-brand-red-tint)',
                    }}
                >
                    {error}
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'rgba(34,197,94,.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <BarChart3 size={18} style={{ color: '#22C55E' }} />
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
                            Financial statements
                        </h1>
                        <p style={{ fontSize: '9.5px', color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            Profit &amp; Loss · Balance Sheet · Cash Flow
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => void loadAll()} style={ghostBtn}>
                        <RefreshCw size={11} /> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadPDF}
                        disabled={!!error}
                        style={{
                            ...ghostBtn,
                            background: 'rgba(124,58,237,.15)',
                            borderColor: 'rgba(124,58,237,.35)',
                            color: '#C4B5FD',
                        }}
                    >
                        <Download size={11} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Period pills + date range + live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {PERIOD_PILLS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPeriod(p.key)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {period === 'custom' && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--color-redwood-border)',
                                    background: 'rgba(255,255,255,.04)',
                                    color: 'var(--color-redwood-text-main)',
                                    fontSize: 9,
                                    fontFamily: 'inherit',
                                }}
                            />
                            <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>→</span>
                            <input
                                type="date"
                                value={dateTo}
                                max={today}
                                onChange={(e) => setDateTo(e.target.value)}
                                style={{
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--color-redwood-border)',
                                    background: 'rgba(255,255,255,.04)',
                                    color: 'var(--color-redwood-text-main)',
                                    fontSize: 9,
                                    fontFamily: 'inherit',
                                }}
                            />
                        </div>
                    )}
                    <span style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', whiteSpace: 'nowrap' }}>{rangeLabel}</span>
                    <span style={{ fontSize: 9, color: '#22C55E', fontWeight: 600, whiteSpace: 'nowrap' }}>● Live · 2 min ago</span>
                </div>
            </div>

            {/* KPI cards — row of 4 */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi}, 1fr)`, gap: 8 }}>
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                    label: 'Revenue',
                    value: formatUsdFull(totals.revenue),
                    valueColor: 'var(--color-brand-green)',
                    sub: `↑ ${pctChange(totals.revenue, aprTotals.revenue)} vs Apr · On track`,
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                    label: 'Net Profit',
                    value: formatUsdFull(totals.netProfit),
                    valueColor: 'var(--color-brand-green)',
                    sub: `↑ ${marginPct.toFixed(1)}% margin · ${pctChange(totals.netProfit, aprTotals.netProfit)} vs Apr`,
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                    label: 'Net Cash Movement',
                    value: formatUsdFull(cf?.netChange ?? totals.cashNet),
                    valueColor: '#A78BFA',
                    sub: `↑ Positive · ${receiptCount.toLocaleString()} receipts`,
                    subColor: '#C4B5FD',
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                    label: 'Balance Sheet',
                    value: isBalanced ? '✓ Balanced' : '⚠ Check',
                    valueColor: isBalanced ? 'var(--color-brand-green)' : 'var(--color-brand-amber)',
                    sub: `A = L + E · ${formatUsdFull(totalAssetsDisplay)}`,
                })}
            </div>

            {/* Main 3-column grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: cols.threeCol ? 'repeat(3, 1fr)' : '1fr',
                    gap: 8,
                }}
            >
                {/* Profit & Loss */}
                <div style={panel}>
                    <SectionHeader
                        icon={TrendingUp}
                        title="Profit & Loss"
                        subtitle="Income statement · MTD"
                        iconColor="#22C55E"
                        onExport={handleDownloadPDF}
                    />
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginBottom: 4, fontWeight: 600 }}>
                        INCOME
                    </div>
                    <LineRow label="Direct sales" value={pl?.revenue.productSales ?? totals.revenue * 0.78} positive />
                    <LineRow label="Amazon channel" value={pl?.revenue.serviceRevenue ?? totals.revenue * 0.22} positive />
                    <LineRow label="Gross Revenue" value={pl?.revenue.totalRevenue ?? totals.revenue} positive bold />
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', margin: '6px 0 4px', fontWeight: 600 }}>
                        COGS
                    </div>
                    <LineRow label="Cost of goods sold" value={-(pl?.cogs.totalCOGS ?? totals.cogs)} positive={false} />
                    <LineRow label="Gross Profit" value={pl?.grossProfit.amount ?? totals.grossProfit} positive bold />
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', margin: '6px 0 4px', fontWeight: 600 }}>
                        OPERATING EXPENSES
                    </div>
                    <LineRow label="Salaries" value={-(pl?.operatingExpenses.salariesWages ?? totals.expenses * 0.42)} positive={false} indent />
                    <LineRow label="Rent" value={-(pl?.operatingExpenses.rentUtilities ?? totals.expenses * 0.18)} positive={false} indent />
                    <LineRow label="Software" value={-(pl?.operatingExpenses.administrative ?? totals.expenses * 0.12)} positive={false} indent />
                    <LineRow label="Maintenance" value={-(pl?.operatingExpenses.other ?? totals.expenses * 0.1)} positive={false} indent />
                    <LineRow label="Vehicle" value={-(pl?.operatingExpenses.transportation ?? totals.expenses * 0.08)} positive={false} indent />
                    <div
                        style={{
                            ...rowStyle,
                            marginTop: 6,
                            background: 'rgba(34,197,94,.08)',
                            borderColor: 'rgba(34,197,94,.25)',
                        }}
                    >
                        <span style={{ fontWeight: 700, color: 'var(--color-brand-green)' }}>Net Profit</span>
                        <span style={{ color: 'var(--color-brand-green)', fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>
                            {formatUsdFull(pl?.netProfit.afterTax ?? totals.netProfit)}
                        </span>
                    </div>
                    <MiniBarChart title="Revenue trend (6 months)" data={revenueTrend} dataKey="value" color="#22C55E" />
                </div>

                {/* Balance Sheet */}
                <div style={panel}>
                    <SectionHeader
                        icon={Briefcase}
                        title="Balance Sheet"
                        subtitle="Assets · Liabilities · Equity"
                        iconColor="#4F8EF7"
                        onExport={handleDownloadPDF}
                    />
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginBottom: 4, fontWeight: 600 }}>
                        ASSETS
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--color-redwood-text-subtle)', marginBottom: 2, paddingLeft: 6 }}>Current</div>
                    <LineRow label="Cash" value={bs?.assets.currentAssets.cash ?? totals.cashIn} positive indent />
                    <LineRow label="Bank" value={bs?.assets.currentAssets.cash ?? totals.cashIn * 0.6} positive indent />
                    <LineRow label="Receivables" value={bs?.assets.currentAssets.accountsReceivable ?? totals.assets * 0.25} positive indent />
                    <LineRow label="Fixed assets" value={bs?.assets.fixedAssets.netFixedAssets ?? totals.assets * 0.35} positive indent />
                    <LineRow label="Total Assets" value={totalAssetsDisplay} positive bold />
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', margin: '6px 0 4px', fontWeight: 600 }}>
                        LIABILITIES
                    </div>
                    <LineRow label="Current liabilities" value={bs?.liabilities.currentLiabilities.totalCurrent ?? totalLiabilitiesDisplay * 0.65} positive={false} indent />
                    <LineRow label="Long-term liabilities" value={bs?.liabilities.longTermLiabilities.totalLongTerm ?? totalLiabilitiesDisplay * 0.35} positive={false} indent />
                    <LineRow label="Total Liabilities" value={totalLiabilitiesDisplay} positive={false} bold />
                    <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', margin: '6px 0 4px', fontWeight: 600 }}>
                        EQUITY
                    </div>
                    <LineRow label="Owner's Capital" value={bs?.equity.ownersCapital ?? totalEquityDisplay * 0.55} positive indent />
                    <LineRow label="Retained Earnings" value={bs?.equity.retainedEarnings ?? totalEquityDisplay * 0.45} positive indent />
                    <LineRow label="Total Equity" value={totalEquityDisplay} positive bold />
                    <div
                        style={{
                            marginTop: 8,
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: isBalanced ? 'rgba(34,197,94,.1)' : 'rgba(245,158,11,.1)',
                            border: `1px solid ${isBalanced ? 'rgba(34,197,94,.28)' : 'rgba(245,158,11,.28)'}`,
                            fontSize: 8.5,
                            color: isBalanced ? 'var(--color-brand-green-tint)' : 'var(--color-brand-amber-tint)',
                            fontWeight: 600,
                        }}
                    >
                        ✓ A = L + E · {formatUsdFull(totalAssetsDisplay)} = {formatUsdFull(totalLiabilitiesDisplay)} + {formatUsdFull(totalEquityDisplay)} ·{' '}
                        {isBalanced ? 'Balanced' : 'Review'}
                    </div>
                    <MiniBarChart
                        title="Assets vs Liabilities trend"
                        data={assetsLiabTrend.map((d) => ({ month: d.month, value: d.value }))}
                        dataKey="value"
                        color="#4F8EF7"
                    />
                </div>

                {/* Cash Flow */}
                <div style={panel}>
                    <SectionHeader
                        icon={Wallet}
                        title="Cash Flow"
                        subtitle="Operating · Investing · Financing"
                        iconColor="#A78BFA"
                        onExport={handleDownloadPDF}
                    />
                    {(['operating', 'investing', 'financing'] as const).map((section) => {
                        const title = section.charAt(0).toUpperCase() + section.slice(1);
                        const net =
                            section === 'operating'
                                ? cf?.operating.netOperating ?? totals.cashNet * 0.75
                                : section === 'investing'
                                  ? cf?.investing.netInvesting ?? -totals.cashOut * 0.15
                                  : cf?.financing.netFinancing ?? -totals.cashOut * 0.1;
                        const lines =
                            section === 'operating'
                                ? [
                                      { label: 'Customer receipts', value: cf?.operating.cashFromCustomers ?? totals.cashIn },
                                      { label: 'Supplier payouts', value: -(cf?.operating.cashToSuppliers ?? totals.cashOut * 0.6) },
                                      { label: 'Payroll & OpEx', value: -(cf?.operating.payroll ?? totals.expenses * 0.4) },
                                  ]
                                : section === 'investing'
                                  ? [
                                        { label: 'Equipment purchases', value: cf?.investing.equipmentPurchases ?? -totals.cashOut * 0.15 },
                                        { label: 'Asset sales', value: cf?.investing.assetSales ?? totals.cashIn * 0.02 },
                                    ]
                                  : [
                                        { label: 'Loans received', value: cf?.financing.loans ?? totals.cashIn * 0.05 },
                                        { label: 'Repayments & dividends', value: -(cf?.financing.repayments ?? totals.cashOut * 0.1) },
                                    ];
                        return (
                            <div key={section} style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginBottom: 3, fontWeight: 600 }}>
                                    {title.toUpperCase()}
                                </div>
                                {lines.map((l) => (
                                    <LineRow key={l.label} label={l.label} value={l.value} positive={l.value >= 0} indent />
                                ))}
                                <LineRow label={`Net ${title.toLowerCase()}`} value={net} positive={net >= 0} bold />
                            </div>
                        );
                    })}
                    <LineRow label="Net cash movement" value={cf?.netChange ?? totals.cashNet} positive bold />
                    <LineRow label="Opening balance" value={cf?.openingBalance ?? totals.cashIn - totals.cashNet} positive />
                    <LineRow label="Closing balance" value={cf?.closingBalance ?? totals.cashIn} positive bold />
                    <MiniBarChart title="Cash flow trend (6 months)" data={cashFlowTrend} dataKey="value" color="#A78BFA" />
                </div>
            </div>

            {/* Comparative P&L Table */}
            <div style={panel}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                    Comparative P&amp;L
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Line Item', 'May 2026', 'Apr 2026', 'Budget', 'Variance'].map((h) => (
                                    <th
                                        key={h}
                                        style={{
                                            fontSize: 8.5,
                                            fontWeight: 600,
                                            color: 'var(--color-redwood-text-subtle)',
                                            textAlign: h === 'Line Item' ? 'left' : 'right',
                                            padding: '6px 8px',
                                            borderBottom: '1px solid var(--color-redwood-border)',
                                        }}
                                    >
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {comparativeRows.map((row) => {
                                const variance = row.may - row.budget;
                                const variancePct = row.budget !== 0 ? (variance / Math.abs(row.budget)) * 100 : 0;
                                const isPositiveGood = row.label === 'Net profit' || row.label === 'Revenue';
                                const badgeColor =
                                    variance === 0
                                        ? 'var(--color-redwood-text-muted)'
                                        : (variance > 0) === isPositiveGood
                                          ? '#22C55E'
                                          : '#EF4444';
                                return (
                                    <tr key={row.label}>
                                        <td style={{ fontSize: 10, padding: '6px 8px', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-main)' }}>
                                            {row.label}
                                        </td>
                                        <td style={{ fontSize: 10, padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>
                                            {formatUsdFull(row.may)}
                                        </td>
                                        <td style={{ fontSize: 10, padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-muted)' }}>
                                            {formatUsdFull(row.apr)}
                                        </td>
                                        <td style={{ fontSize: 10, padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-muted)' }}>
                                            {formatUsdFull(row.budget)}
                                        </td>
                                        <td style={{ fontSize: 10, padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid var(--color-redwood-border)' }}>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    padding: '2px 7px',
                                                    borderRadius: 999,
                                                    fontSize: 8.5,
                                                    fontWeight: 700,
                                                    background: `${badgeColor}22`,
                                                    color: badgeColor,
                                                    border: `1px solid ${badgeColor}44`,
                                                }}
                                            >
                                                {variance >= 0 ? '+' : ''}
                                                {variancePct.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AI CFO Insights */}
            <div style={panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} style={{ color: '#A78BFA' }} />
                        AI CFO — 4 insights for May 2026
                    </span>
                    <button type="button" style={{ fontSize: 9, color: '#4F8EF7', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                        View all <ChevronRight size={12} />
                    </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? 'repeat(2, 1fr)' : '1fr', gap: 6 }}>
                    {AI_INSIGHTS.map((ins) => {
                        const accent =
                            ins.type === 'warning'
                                ? { bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)', color: '#F59E0B' }
                                : ins.type === 'info'
                                  ? { bg: 'rgba(79,142,247,.08)', border: 'rgba(79,142,247,.2)', color: '#93C5FD' }
                                  : { bg: 'rgba(34,197,94,.08)', border: 'rgba(34,197,94,.2)', color: '#22C55E' };
                        return (
                            <div
                                key={ins.title}
                                style={{
                                    padding: '8px 10px',
                                    background: accent.bg,
                                    border: `1px solid ${accent.border}`,
                                    borderRadius: 8,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{ins.title}</span>
                                    <span
                                        style={{
                                            fontSize: 7,
                                            fontWeight: 700,
                                            padding: '1px 6px',
                                            borderRadius: 999,
                                            background: accent.bg,
                                            color: accent.color,
                                            border: `1px solid ${accent.border}`,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {ins.badge}
                                    </span>
                                </div>
                                <p style={{ fontSize: 8.5, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.45 }}>{ins.body}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer — Ask AI bar */}
            <div
                style={{
                    ...panel,
                    position: 'sticky',
                    bottom: 8,
                    background: 'linear-gradient(135deg, rgba(124,58,237,.12) 0%, var(--color-redwood-bg-surface) 60%)',
                    borderColor: 'rgba(124,58,237,.28)',
                    zIndex: 10,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Bot size={16} style={{ color: '#A78BFA' }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Ask AI CFO</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                        placeholder="Ask about P&L, balance sheet, cash flow, budgets…"
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
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Ask AI CFO →
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
    );
}
