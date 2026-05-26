// Tax Management — landing hub (UI-only). Routes unchanged; presentation
// aligned with Soltol ERP redwood theme + tax management mockup.

import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Bot,
    BookOpen,
    Calculator,
    ChevronRight,
    FileText,
    LayoutDashboard,
    MapPin,
    Receipt,
    ShieldAlert,
    Sparkles,
} from 'lucide-react';

// ─── Style tokens (dark redwood — match AccountsDashboard / JournalVoucher) ─

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
    padding: '8px 10px',
    background: 'var(--color-redwood-row-bg)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '6px',
    marginBottom: '4px',
    fontSize: '10px',
};

const linkBtn: CSSProperties = {
    fontSize: 9,
    color: '#4F8EF7',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    whiteSpace: 'nowrap',
};

// ─── Static mockup data (display only — no API / calc logic) ─────────────────

const UPCOMING_PILLS = [
    { form: 'Form 941', days: 14, date: 'Jun 30', color: '#EF4444', bg: 'rgba(239,68,68,.18)' },
    { form: 'Form 1120', days: 45, date: 'Jul 15', color: '#F59E0B', bg: 'rgba(245,158,11,.18)' },
    { form: 'Schedule C', days: 45, date: 'Jul 15', color: '#FCD34D', bg: 'rgba(252,211,77,.15)' },
    { form: 'Form 940', days: 218, date: 'Jan 31', color: '#22C55E', bg: 'rgba(34,197,94,.18)' },
];

const TAX_TOOLS = [
    {
        path: '/tax/calculator',
        icon: Calculator,
        badge: 'Live' as const,
        badgeColor: '#22C55E',
        badgeBg: 'rgba(34,197,94,.18)',
        title: 'Tax Calculator',
        description: 'Full invoice-shaped tax calculator — seller/buyer state, multi-line items, category-aware.',
        footer: 'Open calculator →',
        iconBg: 'rgba(251,146,60,.15)',
        iconColor: '#FB923C',
    },
    {
        path: '/tax/transactions',
        icon: Receipt,
        badge: 'Live' as const,
        badgeColor: '#4F8EF7',
        badgeBg: 'rgba(79,142,247,.18)',
        title: 'Transactions',
        description: 'Every saved tax calculation. Filter by state, date, customer, or category. Export to CSV.',
        footer: 'View transactions →',
        iconBg: 'rgba(79,142,247,.15)',
        iconColor: '#93C5FD',
    },
    {
        path: '/tax/rates',
        icon: MapPin,
        badge: 'Live' as const,
        badgeColor: '#A78BFA',
        badgeBg: 'rgba(167,139,250,.18)',
        title: 'US State Rates',
        description: 'Read-only table of all 50 states + DC. Combined state + average local rates.',
        footer: 'Open rate table →',
        iconBg: 'rgba(167,139,250,.15)',
        iconColor: '#C4B5FD',
    },
    {
        path: '/tax/filing',
        icon: FileText,
        badge: 'Beta' as const,
        badgeColor: '#F59E0B',
        badgeBg: 'rgba(245,158,11,.18)',
        title: 'Tax Filings',
        description: 'File and manage federal tax returns. AI-driven wizard for Form 1120, 1040, Schedule C, and 941.',
        footer: 'Start filing →',
        iconBg: 'rgba(34,197,94,.12)',
        iconColor: '#86EFAC',
    },
    {
        path: '/tax/forms',
        icon: BookOpen,
        badge: 'Live' as const,
        badgeColor: '#818CF8',
        badgeBg: 'rgba(129,140,248,.18)',
        title: 'Forms Library',
        description: 'Browse all 96 IRS forms. Search by name, filter by category, auto-file supported returns.',
        footer: 'Browse library →',
        iconBg: 'rgba(129,140,248,.15)',
        iconColor: '#A5B4FC',
    },
    {
        path: '/tax/dashboard',
        icon: LayoutDashboard,
        badge: 'Live' as const,
        badgeColor: '#94A3B8',
        badgeBg: 'rgba(148,163,184,.15)',
        title: 'Tax Dashboard',
        description: 'Forms due this month, year-to-date liability, recent filings, and upcoming deadlines.',
        footer: 'Open dashboard →',
        iconBg: 'rgba(148,163,184,.12)',
        iconColor: '#CBD5E1',
    },
];

const AI_CHIPS = [
    'When is Form 1120 due this year?',
    "What's the difference between Form 1120 and Schedule C?",
    'Am I eligible for the QBI deduction?',
    'How does the R&D credit work?',
];

const DEADLINE_ROWS = [
    {
        icon: FileText,
        title: 'Form 941 — Q2 2026',
        subtitle: "Employer's Quarterly Federal Tax Return",
        days: 14,
        date: 'Jun 30, 2026',
        color: '#EF4444',
        bg: 'rgba(239,68,68,.18)',
        action: 'Start filing →',
        path: '/tax/filing',
    },
    {
        icon: FileText,
        title: 'Form 1120 — FY 2025',
        subtitle: 'US Corporation Income Tax Return',
        days: 45,
        date: 'Jul 15, 2026',
        color: '#F59E0B',
        bg: 'rgba(245,158,11,.18)',
        action: 'Start filing →',
        path: '/tax/filing',
    },
    {
        icon: FileText,
        title: 'Schedule C — FY 2025',
        subtitle: 'Profit or Loss From Business (Sole Prop)',
        days: 45,
        date: 'Jul 15, 2026',
        color: '#FCD34D',
        bg: 'rgba(252,211,77,.15)',
        action: 'Start filing →',
        path: '/tax/filing',
    },
    {
        icon: FileText,
        title: 'Form 940 — FY 2025',
        subtitle: "Employer's Annual Federal Unemployment Tax",
        days: 218,
        date: 'Jan 31, 2027',
        color: '#22C55E',
        bg: 'rgba(34,197,94,.18)',
        action: 'View →',
        path: '/tax/forms',
    },
    {
        icon: Sparkles,
        title: 'Quarterly Estimated Tax — Q3',
        subtitle: 'Form 1040-ES payment for self-employed / pass-through',
        days: 21,
        date: 'Jun 15, 2026',
        color: '#EF4444',
        bg: 'rgba(239,68,68,.18)',
        action: 'View →',
        path: '/tax/forms',
    },
];

const JURISDICTIONS = [
    { flag: '🇦🇪', name: 'UAE', tax: 'VAT 5% · Excise' },
    { flag: '🇵🇰', name: 'Pakistan', tax: 'GST · WHT · FBR' },
    { flag: '🇬🇧', name: 'United Kingdom', tax: 'VAT · CT · PAYE' },
    { flag: '🇪🇺', name: 'European Union', tax: 'VAT · OSS · IOSS' },
];

function kpiGlance(cfg: {
    stripe: string;
    label: string;
    value: string;
    valueColor: string;
    sub: string;
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
            <div style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', marginBottom: 5 }}>
                {cfg.label}
            </div>
            <div
                style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: cfg.valueColor,
                    fontFamily: "'Syne',sans-serif",
                    lineHeight: 1,
                }}
            >
                {cfg.value}
            </div>
            <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-subtle)', marginTop: 3 }}>
                {cfg.sub}
            </div>
        </div>
    );
}

export default function TaxSettings() {
    const navigate = useNavigate();
    const [aiQuestion, setAiQuestion] = useState('');
    const [cols, setCols] = useState({ tools: 3, glance: 3, jurisdictions: 4 });

    useEffect(() => {
        const update = () =>
            setCols({
                tools: window.innerWidth >= 900 ? 3 : window.innerWidth >= 560 ? 2 : 1,
                glance: window.innerWidth >= 720 ? 3 : 1,
                jurisdictions: window.innerWidth >= 720 ? 4 : window.innerWidth >= 400 ? 2 : 1,
            });
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const handleAskAi = () => {
        navigate('/tax/advisor');
    };

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '48px' }}>
            {/* 1 — Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'rgba(251,146,60,.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Calculator size={18} style={{ color: '#FB923C' }} />
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
                        Tax management
                    </h1>
                    <p style={{ fontSize: '9.5px', color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                        US sales-tax rules · calculations · transactions · filings · rate references — all in one place
                    </p>
                </div>
            </div>

            {/* 2 — Upcoming Banner (maroon) */}
            <div
                style={{
                    ...panel,
                    background: 'linear-gradient(135deg, rgba(127,29,29,.55) 0%, rgba(69,10,10,.45) 100%)',
                    borderColor: 'rgba(239,68,68,.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '.4px',
                            color: '#FCA5A5',
                            marginRight: 4,
                        }}
                    >
                        Upcoming
                    </span>
                    {UPCOMING_PILLS.map((p) => (
                        <button
                            key={p.form}
                            type="button"
                            onClick={() => navigate('/tax/filing')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                borderRadius: 999,
                                border: `1px solid ${p.color}33`,
                                background: p.bg,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            <span style={{ fontSize: 9, fontWeight: 700, color: p.color }}>{p.form}</span>
                            <span style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>
                                {p.days} days · {p.date}
                            </span>
                        </button>
                    ))}
                </div>
                <button type="button" onClick={() => navigate('/tax/dashboard')} style={linkBtn}>
                    View all <ChevronRight size={12} />
                </button>
            </div>

            {/* 3 — US Tax Rates At A Glance */}
            <div>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-redwood-text-main)',
                        marginBottom: 8,
                    }}
                >
                    US Tax Rates At A Glance
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols.glance}, 1fr)`,
                        gap: 8,
                    }}
                >
                    {kpiGlance({
                        stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                        label: 'Average Combined Rate',
                        value: '8.9%',
                        valueColor: 'var(--color-brand-blue)',
                        sub: 'state + local average',
                    })}
                    {kpiGlance({
                        stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                        label: 'No-Tax States',
                        value: '5 states',
                        valueColor: 'var(--color-brand-green)',
                        sub: 'MT · OR · NH · DE · AK',
                    })}
                    {kpiGlance({
                        stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                        label: 'Amazon NY Avg',
                        value: '8.52%',
                        valueColor: 'var(--color-brand-amber)',
                        sub: 'marketplace facilitator',
                    })}
                </div>
            </div>

            {/* 4 — Tax Tools Grid (3×2) */}
            <div>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-redwood-text-main)',
                        marginBottom: 8,
                    }}
                >
                    Tax Tools
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols.tools}, 1fr)`,
                        gap: 8,
                    }}
                >
                    {TAX_TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.path}
                                type="button"
                                onClick={() => navigate(tool.path)}
                                style={{
                                    ...panel,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 8,
                                    transition: 'border-color .15s',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: tool.iconBg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Icon size={16} style={{ color: tool.iconColor }} />
                                    </div>
                                    <span
                                        style={{
                                            fontSize: 7,
                                            fontWeight: 700,
                                            padding: '2px 6px',
                                            borderRadius: 999,
                                            background: tool.badgeBg,
                                            color: tool.badgeColor,
                                            textTransform: 'uppercase',
                                            letterSpacing: '.3px',
                                        }}
                                    >
                                        {tool.badge}
                                    </span>
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: 'var(--color-redwood-text-main)',
                                            marginBottom: 3,
                                        }}
                                    >
                                        {tool.title}
                                    </div>
                                    <p
                                        style={{
                                            fontSize: 8.5,
                                            color: 'var(--color-redwood-text-muted)',
                                            margin: 0,
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {tool.description}
                                    </p>
                                </div>
                                <span style={{ fontSize: 9, color: '#4F8EF7', fontWeight: 600, marginTop: 'auto' }}>
                                    {tool.footer}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 5 — AI Tax Advisor */}
            <div
                style={{
                    ...panel,
                    background:
                        'linear-gradient(135deg, rgba(124,58,237,.1) 0%, var(--color-redwood-bg-surface) 55%)',
                    borderColor: 'rgba(167,139,250,.35)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'rgba(124,58,237,.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Bot size={18} style={{ color: '#C4B5FD' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--color-redwood-text-main)',
                                }}
                            >
                                AI Tax Advisor
                            </span>
                            <span
                                style={{
                                    fontSize: 7,
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 999,
                                    background: 'rgba(124,58,237,.2)',
                                    color: '#C4B5FD',
                                    border: '1px solid rgba(167,139,250,.3)',
                                }}
                            >
                                Powered by Claude
                            </span>
                        </div>
                        <p
                            style={{
                                fontSize: 8.5,
                                color: 'var(--color-redwood-text-muted)',
                                margin: '4px 0 0',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 4,
                                lineHeight: 1.4,
                            }}
                        >
                            <ShieldAlert size={11} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 1 }} />
                            Educational use only — not a licensed CPA. Consult a qualified tax professional for filing
                            decisions.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {AI_CHIPS.map((q) => (
                        <button
                            key={q}
                            type="button"
                            onClick={() => navigate('/tax/advisor')}
                            style={{
                                padding: '5px 10px',
                                borderRadius: 999,
                                fontSize: 8.5,
                                fontWeight: 500,
                                cursor: 'pointer',
                                border: '1px solid rgba(167,139,250,.25)',
                                background: 'rgba(124,58,237,.08)',
                                color: 'var(--color-redwood-text-muted)',
                                fontFamily: 'inherit',
                            }}
                        >
                            {q}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="text"
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                        placeholder="Ask about forms, deductions, deadlines, or tax strategy…"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-redwood-border)',
                            background: 'var(--color-redwood-row-bg)',
                            color: 'var(--color-redwood-text-main)',
                            fontSize: 10,
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
                            background: '#7C3AED',
                            color: '#fff',
                            fontSize: 10,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Ask <ArrowRight size={12} />
                    </button>
                </div>
            </div>

            {/* 6 — Upcoming US Tax Deadlines */}
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
                        }}
                    >
                        Upcoming US Tax Deadlines
                    </span>
                    <button type="button" onClick={() => navigate('/tax/dashboard')} style={linkBtn}>
                        View all <ChevronRight size={12} />
                    </button>
                </div>
                {DEADLINE_ROWS.map((row) => {
                    const Icon = row.icon;
                    return (
                        <div key={row.title} style={{ ...rowStyle, gap: 10 }}>
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 6,
                                    background: row.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <Icon size={14} style={{ color: row.color }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        fontWeight: 600,
                                        color: 'var(--color-redwood-text-main)',
                                    }}
                                >
                                    {row.title}
                                </div>
                                <div style={{ fontSize: 8.5, color: 'var(--color-redwood-text-muted)' }}>
                                    {row.subtitle}
                                </div>
                            </div>
                            <span
                                style={{
                                    fontSize: 8,
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    background: row.bg,
                                    color: row.color,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {row.days}d · {row.date}
                            </span>
                            <button type="button" onClick={() => navigate(row.path)} style={linkBtn}>
                                {row.action}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* 7 — Footer: More jurisdictions coming soon */}
            <div style={panel}>
                <div
                    style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--color-redwood-text-main)',
                        marginBottom: 8,
                    }}
                >
                    More jurisdictions coming soon
                </div>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols.jurisdictions}, 1fr)`,
                        gap: 8,
                    }}
                >
                    {JURISDICTIONS.map((j) => (
                        <div
                            key={j.name}
                            style={{
                                padding: '10px 12px',
                                background: 'var(--color-redwood-row-bg)',
                                border: '1px solid var(--color-redwood-border)',
                                borderRadius: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 20 }}>{j.flag}</span>
                                <div>
                                    <div
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            color: 'var(--color-redwood-text-main)',
                                        }}
                                    >
                                        {j.name}
                                    </div>
                                    <div style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>
                                        {j.tax}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: 6,
                                    fontSize: 8.5,
                                    fontWeight: 600,
                                    cursor: 'not-allowed',
                                    border: '1px solid var(--color-redwood-border)',
                                    background: 'rgba(255,255,255,.03)',
                                    color: 'var(--color-redwood-text-subtle)',
                                    fontFamily: 'inherit',
                                    width: '100%',
                                }}
                            >
                                Coming soon
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
