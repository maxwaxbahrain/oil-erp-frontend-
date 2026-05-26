import { useState, useEffect, useMemo, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertTriangle,
    ArrowUpCircle,
    Bot,
    ChevronRight,
    Landmark,
    Link2,
    RefreshCw,
    Sparkles,
} from 'lucide-react';
import { getInvoices, getPayments, getCustomers } from '../../services/api';
import { getExpenses, type Expense } from '../../services/expenseService';

// ─── Style tokens (dark redwood — match Banking / FinanceDashboard) ───
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
    padding: '5px 8px',
    background: 'var(--color-redwood-row-bg)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '6px',
    marginBottom: '4px',
    fontSize: '10px',
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

type PeriodKey = 'mtd' | 'qtd' | 'ytd' | 'q1' | 'fy2025' | 'custom';

function formatUsd(n: number): string {
    const abs = Math.abs(n);
    const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return n < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatUsdCompact(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return formatUsd(n);
}

function inPeriod(dateStr: string | undefined, period: PeriodKey): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    const y = d.getFullYear();
    const m = d.getMonth();
    switch (period) {
        case 'mtd':
            return y === 2026 && m === 4; // May 2026
        case 'qtd':
            return y === 2026 && m >= 3 && m <= 5; // Q2 2026
        case 'ytd':
            return y === 2026;
        case 'q1':
            return y === 2026 && m <= 2;
        case 'fy2025':
            return y === 2025;
        case 'custom':
        default:
            return true;
    }
}

function kpiCard(cfg: {
    stripe: string;
    label: string;
    badge: string;
    badgeBg: string;
    badgeColor: string;
    value: string;
    valueColor: string;
    sub: string;
    subIcon?: 'up' | 'down' | 'warn';
}) {
    const subColor =
        cfg.subIcon === 'up'
            ? 'var(--color-brand-green-tint)'
            : cfg.subIcon === 'down'
              ? 'var(--color-brand-red-tint)'
              : cfg.subIcon === 'warn'
                ? 'var(--color-brand-amber-tint)'
                : 'var(--color-redwood-text-subtle)';
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
            <div style={{ fontSize: '8.5px', color: subColor, marginTop: '2px' }}>{cfg.sub}</div>
        </div>
    );
}

const PERIOD_PILLS: { key: PeriodKey; label: string }[] = [
    { key: 'mtd', label: 'MTD May 2026' },
    { key: 'qtd', label: 'QTD Q2-2026' },
    { key: 'ytd', label: 'YTD 2026' },
    { key: 'q1', label: 'Q1-2026' },
    { key: 'fy2025', label: 'FY 2025' },
    { key: 'custom', label: 'Custom range' },
];

const AI_INSIGHTS = [
    {
        title: 'Revenue Growth',
        type: 'positive' as const,
        body: 'MTD revenue is tracking 12.4% above Q1 average. Top contributor: Bettano 0W16 line (+18% vs prior month).',
        badge: 'Opportunity',
    },
    {
        title: 'Meezan Diagnosis',
        type: 'warning' as const,
        body: 'Meezan Islamic Business account shows $42K unreconciled variance. 3 transactions pending manual match since May 18.',
        badge: 'Action needed',
    },
    {
        title: 'Tax Deadline',
        type: 'info' as const,
        body: 'Quarterly estimated tax payment due Jun 15, 2026. Current liability estimate based on 15% on net taxable income.',
        badge: 'Jun 15',
    },
    {
        title: 'Profit Margin',
        type: 'positive' as const,
        body: 'Net margin holding at 88.3% after operating expenses. Burn rate stable — runway exceeds 14 months at current spend.',
        badge: 'Healthy',
    },
];

const FORECAST_MONTHS = [
    { month: 'Jun 2026', value: 428_500, confidence: 'High', confBg: 'rgba(34,197,94,.18)', confColor: '#22C55E' },
    { month: 'Jul 2026', value: 445_200, confidence: 'Medium', confBg: 'rgba(245,158,11,.18)', confColor: '#F59E0B' },
    { month: 'Aug 2026', value: 461_800, confidence: 'Medium', confBg: 'rgba(245,158,11,.18)', confColor: '#F59E0B' },
];

const BANK_ACCOUNTS = [
    { name: 'MAIN OPERATING ACCOUNT', ref: 'BETTANO-LLC-PRIMARY', status: 'Live' as const, dot: '#22C55E', label: 'Reconciled' },
    { name: 'MEEZAN ISLAMIC BUSINESS', ref: '99-8821-4-OPERATIONS', status: 'In review' as const, dot: '#F59E0B', label: 'In review' },
    { name: 'STANDARD CHARTERED CORE', ref: '11-4412-1-SUPPLY', status: 'Live' as const, dot: '#22C55E', label: 'Reconciled' },
    { name: 'CENTRAL OPERATIONAL FUND', ref: '00-0000-0-DRAWER', status: 'Manual' as const, dot: '#8BA3C7', label: 'Manual' },
];

const AI_PROMPTS = [
    'Why is Meezan account unreconciled?',
    'Forecast Q3 cash position',
    'Which expenses drove burn this month?',
    'Tax liability breakdown for Q2',
];

const AccountsDashboard = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [period, setPeriod] = useState<PeriodKey>('mtd');
    const [aiQuestion, setAiQuestion] = useState('');
    const [cols, setCols] = useState({ kpi: 4, twoCol: true });

    useEffect(() => {
        const update = () =>
            setCols({
                kpi: window.innerWidth >= 1200 ? 4 : window.innerWidth >= 640 ? 2 : 1,
                twoCol: window.innerWidth >= 1024,
            });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const loadDashboard = useCallback(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        Promise.all([
            getInvoices().catch(() => [] as any),
            getPayments().catch(() => [] as any),
            getCustomers().catch(() => [] as any),
            getExpenses().catch(() => [] as Expense[]),
        ])
            .then(([inv, pays, custs, exps]) => {
                if (cancelled) return;
                setInvoices(inv);
                setPayments(pays);
                setCustomers(custs);
                setExpenses(exps);
            })
            .catch((e: any) => {
                if (!cancelled) setLoadError(e?.message || 'Could not load accounting data.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const cleanup = loadDashboard();
        return cleanup;
    }, [loadDashboard]);

    const metrics = useMemo(() => {
        const invInPeriod = invoices.filter((i) =>
            inPeriod(i.invoiceDate || i.date, period),
        );
        const revenue = invInPeriod.reduce(
            (s, i) => s + (Number(i.grandTotal) || Number(i.subtotal) || 0),
            0,
        );
        const taxLiability = invInPeriod.reduce(
            (s, i) => s + (Number(i.taxAmount) || 0),
            0,
        );
        const expInPeriod = expenses.filter(
            (e) => e.status !== 'Draft' && inPeriod(e.date, period),
        );
        const totalExpenses = expInPeriod.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const netProfit = revenue - totalExpenses;
        const marginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        const ar = (customers || []).reduce(
            (s: number, c: any) => s + Math.max(0, Number(c?.balance) || 0),
            0,
        );
        const cashOnHand = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const overdueCount = invoices.filter((i) => i.status === 'Overdue').length;

        const paysInPeriod = payments.filter((p) => inPeriod(p.payment_date, period));
        const cashIn = paysInPeriod.reduce((s, p) => s + (Number(p.amount) || 0), 0);

        const budgetRevenue = 450_000;
        const budgetExpenses = 55_000;
        const budgetProfit = budgetRevenue - budgetExpenses;

        const burnRate = totalExpenses > 0 ? totalExpenses / Math.max(1, new Date().getDate()) : 0;
        const budgetUtil = revenue > 0 ? Math.min(100, (revenue / budgetRevenue) * 100) : 0;

        return {
            revenue,
            totalExpenses,
            netProfit,
            marginPct,
            taxLiability,
            ar,
            cashOnHand,
            overdueCount,
            cashIn,
            budgetRevenue,
            budgetExpenses,
            budgetProfit,
            burnRate,
            budgetUtil,
        };
    }, [invoices, payments, customers, expenses, period]);

    const plLines = useMemo(() => {
        const { revenue, totalExpenses, netProfit } = metrics;
        const cogs = totalExpenses * 0.35;
        const gross = revenue - cogs;
        return {
            income: [
                { label: 'Product sales', value: revenue * 0.92 },
                { label: 'Service revenue', value: revenue * 0.08 },
            ],
            expenses: [
                { label: 'COGS & inventory', value: cogs },
                { label: 'Operating expenses', value: totalExpenses - cogs },
                { label: 'Payroll & benefits', value: totalExpenses * 0.15 },
            ],
            grossRevenue: revenue,
            grossProfit: gross,
            netProfit,
        };
    }, [metrics]);

    const cashFlow = useMemo(() => {
        const operatingIn = metrics.cashIn;
        const operatingOut = metrics.totalExpenses * 0.85;
        const investing = metrics.totalExpenses * 0.08;
        const financing = metrics.totalExpenses * 0.07;
        return {
            operating: [
                { label: 'Customer receipts', value: operatingIn, positive: true },
                { label: 'Supplier & expense payouts', value: -operatingOut, positive: false },
            ],
            investing: [{ label: 'Equipment & assets', value: -investing, positive: false }],
            financing: [{ label: 'Loan & equity movements', value: -financing, positive: false }],
            net: operatingIn - operatingOut - investing - financing,
        };
    }, [metrics]);

    const bankBalances = useMemo(() => {
        const { cashOnHand, ar } = metrics;
        return [
            { ...BANK_ACCOUNTS[0], balance: cashOnHand },
            { ...BANK_ACCOUNTS[1], balance: ar * 0.12 },
            { ...BANK_ACCOUNTS[2], balance: cashOnHand * 0.34 },
            { ...BANK_ACCOUNTS[3], balance: 45_000 },
        ];
    }, [metrics]);

    const handleAskAi = () => {
        const q = aiQuestion.trim() || AI_PROMPTS[0];
        alert(
            `AI CFO (preview)\n\n"${q}"\n\nConnect the AI CFO endpoint to get live answers from your ledger data.`,
        );
    };

    if (loading) {
        return (
            <div style={{ padding: '80px 16px', textAlign: 'center', color: 'var(--color-redwood-text-muted)' }}>
                <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', color: '#4F8EF7' }} />
                <p style={{ fontSize: 12, fontWeight: 500 }}>Loading finance overview…</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '100px' }}>
            {loadError && (
                <div
                    style={{
                        ...panel,
                        background: 'var(--color-badge-red-bg)',
                        borderColor: 'rgba(239,68,68,.28)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                    }}
                >
                    <AlertTriangle size={18} style={{ color: 'var(--color-brand-red-tint)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand-red-tint)' }}>
                            Accounting data unavailable
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 4 }}>
                            {loadError}
                        </p>
                    </div>
                    <button type="button" onClick={loadDashboard} style={ghostBtn}>
                        <RefreshCw size={12} /> Retry
                    </button>
                </div>
            )}

            {/* 1 — Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    flexWrap: 'wrap',
                }}
            >
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
                        <Activity size={18} style={{ color: '#A78BFA' }} />
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
                            Finance overview
                        </h1>
                        <p style={{ fontSize: '9.5px', color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            General ledger · P&amp;L · cash flow · tax · multi-account · AI Insights
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => navigate('/finance/journal-voucher')} style={ghostBtn}>
                        <ArrowUpCircle size={12} /> Post entry
                    </button>
                    <button type="button" onClick={() => navigate('/finance/banking')} style={ghostBtn}>
                        <Link2 size={12} /> Reconcile
                    </button>
                </div>
            </div>

            {/* 2 — Period selectors */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                }}
            >
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
                                borderColor:
                                    period === p.key ? 'rgba(124,58,237,.45)' : 'var(--color-redwood-border)',
                                background:
                                    period === p.key ? 'rgba(124,58,237,.18)' : 'rgba(255,255,255,.04)',
                                color: period === p.key ? '#C4B5FD' : 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <span style={{ fontSize: 9, color: '#22C55E', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    ● Live — updated 2 min ago
                </span>
            </div>

            {/* 3 — KPI grid 2×4 */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols.kpi}, 1fr)`,
                    gap: 8,
                }}
            >
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                    label: 'Total Revenue',
                    badge: 'MTD',
                    badgeBg: 'rgba(34,197,94,.18)',
                    badgeColor: '#22C55E',
                    value: formatUsd(metrics.revenue),
                    valueColor: 'var(--color-brand-green)',
                    sub: '↑ 12.4% vs prior period',
                    subIcon: 'up',
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
                    label: 'Total Expenses',
                    badge: 'MTD',
                    badgeBg: 'rgba(239,68,68,.18)',
                    badgeColor: '#EF4444',
                    value: formatUsd(metrics.totalExpenses),
                    valueColor: 'var(--color-brand-red)',
                    sub: `${expenses.filter((e) => e.status !== 'Draft').length} posted entries`,
                    subIcon: 'down',
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#00D4AA,#5EEAD4)',
                    label: 'Net Profit',
                    badge: `${metrics.marginPct.toFixed(1)}%`,
                    badgeBg: 'rgba(0,212,170,.12)',
                    badgeColor: '#00D4AA',
                    value: formatUsd(metrics.netProfit),
                    valueColor: '#00D4AA',
                    sub: `Margin ${metrics.marginPct.toFixed(1)}% after expenses`,
                    subIcon: 'up',
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                    label: 'Tax Liability Est.',
                    badge: '15%',
                    badgeBg: 'rgba(124,58,237,.18)',
                    badgeColor: '#A78BFA',
                    value: formatUsd(metrics.taxLiability || metrics.netProfit * 0.15),
                    valueColor: '#A78BFA',
                    sub: 'Estimated on taxable income',
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                    label: 'Cash on Hand',
                    badge: 'Today',
                    badgeBg: 'rgba(79,142,247,.18)',
                    badgeColor: '#93C5FD',
                    value: formatUsd(metrics.cashOnHand),
                    valueColor: 'var(--color-brand-blue)',
                    sub: 'Customer receipts collected',
                    subIcon: 'up',
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                    label: 'Accounts Receivable',
                    badge: 'Aging',
                    badgeBg: 'rgba(245,158,11,.18)',
                    badgeColor: '#F59E0B',
                    value: formatUsd(metrics.ar),
                    valueColor: 'var(--color-brand-amber)',
                    sub: `${metrics.overdueCount} entities overdue`,
                    subIcon: metrics.overdueCount > 0 ? 'warn' : undefined,
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#FB923C,#FDBA74)',
                    label: 'Budget Utilisation',
                    badge: `${metrics.budgetUtil.toFixed(0)}%`,
                    badgeBg: 'rgba(251,146,60,.15)',
                    badgeColor: '#FB923C',
                    value: `${metrics.budgetUtil.toFixed(0)}%`,
                    valueColor: '#FB923C',
                    sub: `Of ${formatUsdCompact(metrics.budgetRevenue)} revenue budget`,
                })}
                {kpiCard({
                    stripe: 'linear-gradient(90deg,#EF4444,#F472B6)',
                    label: 'Burn Rate',
                    badge: '/day',
                    badgeBg: 'rgba(239,68,68,.12)',
                    badgeColor: '#FCA5A5',
                    value: formatUsd(metrics.burnRate),
                    valueColor: 'var(--color-brand-red)',
                    sub: 'Avg daily operating spend',
                })}
            </div>

            {/* 4 — AI CFO Insights */}
            <div style={panel}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                    }}
                >
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-redwood-text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Sparkles size={14} style={{ color: '#A78BFA' }} />
                        AI CFO — 4 insights ready
                    </span>
                    <button
                        type="button"
                        onClick={() => navigate('/ai/hub')}
                        style={{
                            fontSize: 9,
                            color: '#4F8EF7',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        View all →
                    </button>
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: cols.twoCol ? 'repeat(2, 1fr)' : '1fr',
                        gap: 6,
                    }}
                >
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
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        gap: 6,
                                        marginBottom: 4,
                                    }}
                                >
                                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                        {ins.title}
                                    </span>
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
                                <p style={{ fontSize: 8.5, color: 'var(--color-redwood-text-muted)', margin: 0, lineHeight: 1.45 }}>
                                    {ins.body}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 5 — P&L + Cash Flow */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
                    gap: 8,
                }}
            >
                <div style={panel}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                        P&amp;L Statement
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginBottom: 6, fontWeight: 600 }}>
                        INCOME
                    </div>
                    {plLines.income.map((l) => (
                        <div key={l.label} style={rowStyle}>
                            <span style={{ color: 'var(--color-redwood-text-muted)' }}>{l.label}</span>
                            <span style={{ color: 'var(--color-brand-green)', fontWeight: 600 }}>{formatUsd(l.value)}</span>
                        </div>
                    ))}
                    <div style={{ ...rowStyle, marginTop: 6, borderColor: 'rgba(34,197,94,.25)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Gross revenue</span>
                        <span style={{ color: 'var(--color-brand-green)', fontWeight: 700 }}>{formatUsd(plLines.grossRevenue)}</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', margin: '8px 0 6px', fontWeight: 600 }}>
                        EXPENSES
                    </div>
                    {plLines.expenses.map((l) => (
                        <div key={l.label} style={rowStyle}>
                            <span style={{ color: 'var(--color-redwood-text-muted)' }}>{l.label}</span>
                            <span style={{ color: 'var(--color-brand-red)', fontWeight: 600 }}>{formatUsd(l.value)}</span>
                        </div>
                    ))}
                    <div
                        style={{
                            ...rowStyle,
                            marginTop: 6,
                            background: 'rgba(0,212,170,.08)',
                            borderColor: 'rgba(0,212,170,.25)',
                        }}
                    >
                        <span style={{ fontWeight: 700, color: '#00D4AA' }}>Net profit</span>
                        <span style={{ color: '#00D4AA', fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>
                            {formatUsd(plLines.netProfit)}
                        </span>
                    </div>
                </div>

                <div style={panel}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                        Cash Flow
                    </div>
                    {(['operating', 'investing', 'financing'] as const).map((section) => {
                        const title =
                            section === 'operating'
                                ? 'Operating'
                                : section === 'investing'
                                  ? 'Investing'
                                  : 'Financing';
                        const lines = cashFlow[section];
                        return (
                            <div key={section} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', marginBottom: 4, fontWeight: 600 }}>
                                    {title.toUpperCase()}
                                </div>
                                {lines.map((l) => (
                                    <div key={l.label} style={rowStyle}>
                                        <span style={{ color: 'var(--color-redwood-text-muted)' }}>{l.label}</span>
                                        <span
                                            style={{
                                                color: l.positive ? 'var(--color-brand-green)' : 'var(--color-brand-red)',
                                                fontWeight: 600,
                                            }}
                                        >
                                            {l.positive ? '+' : ''}
                                            {formatUsd(Math.abs(l.value))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                    <div style={{ ...rowStyle, background: 'rgba(79,142,247,.08)', borderColor: 'rgba(79,142,247,.2)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-brand-blue)' }}>Net cash flow</span>
                        <span style={{ color: 'var(--color-brand-blue)', fontWeight: 700 }}>{formatUsd(cashFlow.net)}</span>
                    </div>
                </div>
            </div>

            {/* 6 — AI Revenue Forecast */}
            <div style={panel}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                    AI Revenue Forecast
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: cols.twoCol ? 'repeat(3, 1fr)' : '1fr',
                        gap: 8,
                    }}
                >
                    {FORECAST_MONTHS.map((f) => (
                        <div
                            key={f.month}
                            style={{
                                padding: '10px 12px',
                                background: 'var(--color-redwood-row-bg)',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: 8,
                                textAlign: 'center',
                            }}
                        >
                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>
                                {f.month}
                            </div>
                            <div
                                style={{
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: 'var(--color-brand-green)',
                                    fontFamily: "'Syne',sans-serif",
                                }}
                            >
                                {formatUsd(f.value)}
                            </div>
                            <span
                                style={{
                                    display: 'inline-block',
                                    marginTop: 6,
                                    fontSize: 7,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    background: f.confBg,
                                    color: f.confColor,
                                }}
                            >
                                {f.confidence} confidence
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 7 — Corporate Liquidity */}
            <div style={panel}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                    }}
                >
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-redwood-text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Landmark size={14} style={{ color: '#4F8EF7' }} />
                        Corporate Liquidity
                    </span>
                    <button
                        type="button"
                        onClick={() => navigate('/finance/banking')}
                        style={{ fontSize: 9, color: '#4F8EF7', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        Manage accounts →
                    </button>
                </div>
                {bankBalances.map((b, i) => (
                    <div
                        key={b.ref}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            background: i % 2 === 0 ? 'var(--color-redwood-row-bg)' : 'transparent',
                            border: '1px solid var(--color-redwood-border)',
                            borderRadius: 6,
                            marginBottom: 4,
                            cursor: 'pointer',
                        }}
                        onClick={() => navigate('/finance/banking')}
                        onKeyDown={(e) => e.key === 'Enter' && navigate('/finance/banking')}
                        role="button"
                        tabIndex={0}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                {b.name}
                            </div>
                            <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginTop: 2 }}>
                                REF: {b.ref}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>
                                    {b.status === 'Live' ? formatUsd(b.balance) : formatUsdCompact(b.balance)}
                                </div>
                                <div
                                    style={{
                                        fontSize: 8,
                                        color: b.dot,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: 4,
                                        marginTop: 2,
                                    }}
                                >
                                    <span
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: b.dot,
                                            display: 'inline-block',
                                        }}
                                    />
                                    {b.status === 'Live' ? 'Live / Reconciled' : b.label}
                                </div>
                            </div>
                            <ChevronRight size={14} style={{ color: 'var(--color-redwood-text-subtle)' }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* 8 — Budget vs Actual */}
            <div style={panel}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8 }}>
                    Budget vs Actual
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            {['Line item', 'Budget', 'Actual', 'Variance', 'Progress'].map((h) => (
                                <th
                                    key={h}
                                    style={{
                                        fontSize: 8,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        color: 'var(--color-redwood-text-subtle)',
                                        padding: '4px 6px',
                                        borderBottom: '1px solid var(--color-redwood-border)',
                                        textAlign: h === 'Line item' ? 'left' : 'right',
                                    }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            {
                                label: 'Revenue',
                                budget: metrics.budgetRevenue,
                                actual: metrics.revenue,
                                color: '#22C55E',
                            },
                            {
                                label: 'Expenses',
                                budget: metrics.budgetExpenses,
                                actual: metrics.totalExpenses,
                                color: '#EF4444',
                            },
                            {
                                label: 'Net Profit',
                                budget: metrics.budgetProfit,
                                actual: metrics.netProfit,
                                color: '#00D4AA',
                            },
                        ].map((row) => {
                            const pct = row.budget > 0 ? Math.min(100, (row.actual / row.budget) * 100) : 0;
                            const variance = row.actual - row.budget;
                            return (
                                <tr key={row.label}>
                                    <td
                                        style={{
                                            fontSize: 10,
                                            padding: '6px',
                                            borderBottom: '1px solid var(--color-redwood-border)',
                                            color: 'var(--color-redwood-text-main)',
                                        }}
                                    >
                                        {row.label}
                                    </td>
                                    <td
                                        style={{
                                            fontSize: 10,
                                            padding: '6px',
                                            textAlign: 'right',
                                            borderBottom: '1px solid var(--color-redwood-border)',
                                            color: 'var(--color-redwood-text-muted)',
                                        }}
                                    >
                                        {formatUsd(row.budget)}
                                    </td>
                                    <td
                                        style={{
                                            fontSize: 10,
                                            padding: '6px',
                                            textAlign: 'right',
                                            borderBottom: '1px solid var(--color-redwood-border)',
                                            fontWeight: 600,
                                            color: row.color,
                                        }}
                                    >
                                        {formatUsd(row.actual)}
                                    </td>
                                    <td
                                        style={{
                                            fontSize: 10,
                                            padding: '6px',
                                            textAlign: 'right',
                                            borderBottom: '1px solid var(--color-redwood-border)',
                                            color: variance >= 0 ? '#22C55E' : '#EF4444',
                                        }}
                                    >
                                        {variance >= 0 ? '+' : ''}
                                        {formatUsd(variance)}
                                    </td>
                                    <td
                                        style={{
                                            padding: '6px',
                                            borderBottom: '1px solid var(--color-redwood-border)',
                                            minWidth: 90,
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: 4,
                                                background: 'rgba(255,255,255,.06)',
                                                borderRadius: 999,
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div
                                                style={{
                                                    height: '100%',
                                                    width: `${pct}%`,
                                                    background: row.color,
                                                    borderRadius: 999,
                                                }}
                                            />
                                        </div>
                                        <div style={{ fontSize: 8, textAlign: 'right', color: row.color, marginTop: 2 }}>
                                            {pct.toFixed(0)}%
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 9 — Footer AI bar */}
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
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                        Ask AI CFO
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                        placeholder="Ask about revenue, tax, cash flow, budgets…"
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
};

export default AccountsDashboard;
