import type { CSSProperties, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Headphones,
    Users,
    Package,
    FileText,
    Lock,
    Shield,
    Bot,
    DollarSign,
    BarChart3,
    Map,
    Sparkles,
} from 'lucide-react';
import { getCurrentUser } from '../../store/authStore';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    purple: '#7C3AED',
    orange: '#F59E0B',
    red: '#EF4444',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const panel: CSSProperties = {
    background: C.bg2,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
};

function formatUsd(n: number): string {
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AQ';
}

function LiveBadge() {
    return (
        <span
            style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: 'rgba(34,197,94,.15)',
                color: '#86EFAC',
                border: '1px solid rgba(34,197,94,.35)',
            }}
        >
            Live
        </span>
    );
}

function OilBarrelIcon() {
    return (
        <div
            style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(239,68,68,.15)',
                border: '1px solid rgba(239,68,68,.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
            }}
            aria-hidden
        >
            🛢️
        </div>
    );
}

const PRIMARY_AGENTS = [
    {
        id: 'aria',
        name: 'ARIA',
        subtitle: 'Customer Intelligence Agent',
        icon: Headphones,
        iconBg: 'rgba(79,142,247,.18)',
        iconColor: C.blue,
        path: '/agents/customer-service',
        buttonLabel: 'Open ARIA →',
        buttonColor: C.blue,
        description:
            'Handles customer queries, knows every customer, invoice, and order in your ERP — account balances, delivery status, and payment history in seconds.',
        capabilities: [
            'Order & invoice status',
            'Account balance checks',
            'Delivery tracking',
            'Product availability',
            'Payment history',
        ],
        chatQuestion: 'What does Qahir Trading owe us?',
        chatAnswer: (
            <>
                Qahir Trading has an outstanding balance of <strong style={{ color: C.text }}>{formatUsd(12450)}</strong>{' '}
                across 3 unpaid invoices. Oldest is 42 days overdue ({formatUsd(4200)}). Last payment received{' '}
                {formatUsd(8000)} on 14 Apr 2026.
            </>
        ),
        footer: 'Available to all staff · 24/7',
    },
    {
        id: 'bettano',
        name: 'Bettano',
        subtitle: 'Senior Business Advisor',
        icon: null,
        path: '/agents/business-advisor',
        buttonLabel: 'Open Bettano →',
        buttonColor: C.orange,
        description:
            'Your senior business advisor. Analyses revenue, forecasts demand, flags risks, and gives CFO-level thinking from live ERP data.',
        capabilities: ['Revenue forecasting', 'Risk alerts', 'Cash flow & margin strategy', 'Demand analysis', 'Supplier negotiations'],
        chatQuestion: 'Why is my inventory turnover so low?',
        chatAnswer: (
            <>
                Turnover is 2.1× vs industry 4.5×. Top drag: slow-moving 0W20 ({formatUsd(18600)} locked stock). AI recommends
                a 12% price promotion on 3 SKUs and reducing reorder qty on Bettano 5W30 by 20%.
            </>
        ),
        footer: 'Restricted access · Owner + CFO',
    },
] as const;

const SPECIALIST_AGENTS = [
    {
        id: 'finance',
        title: 'Finance Agent',
        icon: DollarSign,
        iconBg: 'rgba(34,197,94,.12)',
        iconColor: C.green,
        description: 'P&L analysis, tax guidance, financial ratios, and cash flow insights.',
        questions: ['What is our gross margin?', 'Tax liability this quarter?'],
        buttonColor: C.green,
        path: '/finance/dashboard',
    },
    {
        id: 'warehouse',
        title: 'Warehouse Agent',
        icon: Package,
        iconBg: 'rgba(245,158,11,.12)',
        iconColor: C.orange,
        description: 'Stock levels, reorder alerts, GRN status, and warehouse movement.',
        questions: ['Which SKUs are below minimum?', 'GRNs pending today?'],
        buttonColor: C.orange,
        path: '/products',
    },
    {
        id: 'sales',
        title: 'Sales Agent',
        icon: BarChart3,
        iconBg: 'rgba(124,58,237,.12)',
        iconColor: C.purple,
        description: 'Sales performance, customer profitability, and route revenue.',
        questions: ['Top customers this month?', 'Best margin products?'],
        buttonColor: C.purple,
        path: '/reports/sales',
    },
    {
        id: 'route',
        title: 'Route Agent',
        icon: Map,
        iconBg: 'rgba(79,142,247,.12)',
        iconColor: C.blue,
        description: 'Delivery optimisation, stop sequencing, and van route planning.',
        questions: ['Optimise Route A today?', 'Stops with highest revenue?'],
        buttonColor: C.blue,
        path: '/logistics/routes',
    },
] as const;

const STAT_PILLS = [
    { icon: Users, label: '186 customers' },
    { icon: FileText, label: 'Invoices tracked live' },
    { icon: Package, label: '43 products' },
    { icon: Sparkles, label: 'Claude Haiku ~$0.001/query' },
    { icon: Lock, label: 'Data stays in your account' },
] as const;

const HOW_IT_WORKS = [
    {
        step: '01',
        title: 'You ask a question',
        desc: 'Type naturally — "What does Qahir Trading owe us?" or "Which products are low on stock?"',
    },
    {
        step: '02',
        title: 'Agent loads your ERP',
        desc: 'Pulls live data: customers, invoices, products, payments, and orders in real time.',
    },
    {
        step: '03',
        title: 'Precise answer',
        desc: 'Responds with actionable figures, names, and dates — not generic answers.',
    },
] as const;

export default function AgentHub() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();

    const openPath = (path: string) => (e: MouseEvent) => {
        e.stopPropagation();
        navigate(path);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
                background: C.bg,
                color: C.text,
                fontFamily: 'inherit',
                margin: '-24px -40px',
                width: 'calc(100% + 80px)',
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 28px',
                    borderBottom: '1px solid rgba(255,255,255,.06)',
                    background: C.bg2,
                }}
            >
                <span style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: '-0.3px' }}>
                    Soltol <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>ERP</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.green, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                        6 agents active
                    </span>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#fff',
                        }}
                    >
                        {userInitials(currentUser?.name ?? '')}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 28px' }}>
                {/* Page header */}
                <div style={{ marginBottom: 16 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>AI agent centre</h1>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 6, marginBottom: 0, maxWidth: 640, lineHeight: 1.5 }}>
                        Powered by Claude · Connected to live ERP data · They know <strong style={{ color: C.text }}>your</strong> business.
                    </p>
                </div>

                {/* Stats pills */}
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 18,
                    }}
                >
                    {STAT_PILLS.map((pill) => {
                        const PillIcon = pill.icon;
                        return (
                            <span
                                key={pill.label}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    padding: '6px 12px',
                                    borderRadius: 999,
                                    background: C.bg3,
                                    border: '1px solid rgba(255,255,255,.08)',
                                    color: C.muted,
                                }}
                            >
                                <PillIcon size={12} color={pill.icon === Lock ? C.green : C.muted} />
                                {pill.label}
                            </span>
                        );
                    })}
                </div>

                {/* Primary agents */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                    {PRIMARY_AGENTS.map((agent) => {
                        const Icon = agent.icon;
                        return (
                            <div
                                key={agent.id}
                                style={{
                                    ...panel,
                                    padding: 18,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    borderTop: `3px solid ${agent.id === 'aria' ? C.blue : C.red}`,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        {Icon ? (
                                            <div
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 12,
                                                    background: agent.iconBg,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                <Icon size={22} color={agent.iconColor} />
                                            </div>
                                        ) : (
                                            <OilBarrelIcon />
                                        )}
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{agent.name}</h2>
                                                <LiveBadge />
                                            </div>
                                            <p style={{ fontSize: 10, color: C.dim, margin: '4px 0 0', fontWeight: 600 }}>{agent.subtitle}</p>
                                        </div>
                                    </div>
                                </div>

                                <p style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.55, margin: '0 0 12px' }}>{agent.description}</p>

                                <div style={{ marginBottom: 12 }}>
                                    {agent.capabilities.map((cap) => (
                                        <div
                                            key={cap}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                fontSize: 10.5,
                                                color: C.muted,
                                                marginBottom: 4,
                                            }}
                                        >
                                            <span
                                                style={{
                                                    width: 5,
                                                    height: 5,
                                                    borderRadius: '50%',
                                                    background: C.green,
                                                    flexShrink: 0,
                                                }}
                                            />
                                            {cap}
                                        </div>
                                    ))}
                                </div>

                                {/* Chat preview */}
                                <div
                                    style={{
                                        background: C.bg3,
                                        borderRadius: 10,
                                        padding: 12,
                                        border: '1px solid rgba(255,255,255,.05)',
                                        marginBottom: 12,
                                        flex: 1,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: 10,
                                            color: C.text,
                                            padding: '6px 10px',
                                            borderRadius: 8,
                                            background: 'rgba(79,142,247,.12)',
                                            border: '1px solid rgba(79,142,247,.2)',
                                            marginBottom: 8,
                                            maxWidth: '92%',
                                        }}
                                    >
                                        {agent.chatQuestion}
                                    </div>
                                    <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.55 }}>{agent.chatAnswer}</div>
                                </div>

                                <p style={{ fontSize: 9.5, color: C.dim, margin: '0 0 12px', fontWeight: 600 }}>{agent.footer}</p>

                                <button
                                    type="button"
                                    onClick={openPath(agent.path)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 6,
                                        padding: '10px 16px',
                                        borderRadius: 8,
                                        border: 'none',
                                        background: agent.buttonColor,
                                        color: '#fff',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    {agent.buttonLabel}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Role-based access bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '14px 18px',
                        marginBottom: 18,
                        borderRadius: 10,
                        background: 'linear-gradient(90deg, rgba(76,29,149,.55) 0%, rgba(30,27,75,.85) 100%)',
                        border: '1px solid rgba(124,58,237,.35)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                        <Shield size={20} color="#C4B5FD" style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <p style={{ fontSize: 11.5, fontWeight: 700, color: C.text, margin: 0 }}>Role-based access</p>
                            <p style={{ fontSize: 10.5, color: C.muted, margin: '4px 0 0', lineHeight: 1.5 }}>
                                <strong style={{ color: '#93C5FD' }}>ARIA</strong> is available to all staff.{' '}
                                <strong style={{ color: '#FCD34D' }}>Bettano</strong> is restricted to Owner and CFO roles.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={openPath('/users/roles')}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,.15)',
                            background: 'rgba(255,255,255,.08)',
                            color: C.text,
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}
                    >
                        Manage roles
                    </button>
                </div>

                {/* Specialist agents */}
                <p
                    style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.dim,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        margin: '0 0 10px',
                    }}
                >
                    Specialist agents
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
                    {SPECIALIST_AGENTS.map((agent) => {
                        const SpecIcon = agent.icon;
                        return (
                            <div
                                key={agent.id}
                                style={{
                                    ...panel,
                                    padding: 14,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: agent.iconBg,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 10,
                                    }}
                                >
                                    <SpecIcon size={18} color={agent.iconColor} />
                                </div>
                                <h3 style={{ fontSize: 12.5, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>{agent.title}</h3>
                                <p style={{ fontSize: 10, color: C.muted, lineHeight: 1.45, margin: '0 0 10px', flex: 1 }}>
                                    {agent.description}
                                </p>
                                <div style={{ marginBottom: 12 }}>
                                    {agent.questions.map((q) => (
                                        <p key={q} style={{ fontSize: 9.5, color: C.dim, margin: '0 0 4px', fontStyle: 'italic' }}>
                                            &ldquo;{q}&rdquo;
                                        </p>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={openPath(agent.path)}
                                    style={{
                                        padding: '7px 12px',
                                        borderRadius: 6,
                                        border: 'none',
                                        background: agent.buttonColor,
                                        color: '#fff',
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        alignSelf: 'flex-start',
                                    }}
                                >
                                    Open
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* How agents access your data */}
                <div style={{ ...panel, padding: 18, marginBottom: 16 }}>
                    <p
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: C.dim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            margin: '0 0 14px',
                        }}
                    >
                        How agents access your data
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        {HOW_IT_WORKS.map((step) => (
                            <div key={step.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 28, fontWeight: 800, color: C.bg3, lineHeight: 1, flexShrink: 0 }}>{step.step}</span>
                                <div>
                                    <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{step.title}</p>
                                    <p style={{ fontSize: 10.5, color: C.muted, margin: '6px 0 0', lineHeight: 1.5 }}>{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 8,
                        borderTop: '1px solid rgba(255,255,255,.06)',
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: C.muted, fontWeight: 600 }}>
                        <Lock size={12} color={C.green} />
                        Privacy by design
                    </span>
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '5px 12px',
                            borderRadius: 999,
                            background: 'rgba(124,58,237,.15)',
                            color: '#C4B5FD',
                            border: '1px solid rgba(124,58,237,.3)',
                        }}
                    >
                        <Bot size={12} />
                        Powered by Claude AI
                    </span>
                </div>
            </div>
        </div>
    );
}
