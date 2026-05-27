import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Brain,
    TrendingUp,
    ShoppingCart,
    Users,
    ArrowRight,
    Lock,
    Briefcase,
    Bot,
    Search,
    Sparkles,
    DollarSign,
    MessageCircle,
    Send,
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

function openMarcusAdvisor() {
    window.dispatchEvent(new CustomEvent('soltol:open-ai-advisor'));
}

type FeatureCard = {
    icon: typeof ShoppingCart;
    title: string;
    description: string;
    path: string | null;
    badge: string;
    badgeTone: 'live' | 'marcus';
    accent: string;
};

const AI_FEATURES: FeatureCard[] = [
    {
        icon: ShoppingCart,
        title: 'Auto PO generation',
        description: 'Stock hits minimum → AI instantly creates a draft purchase order. Never run out again.',
        path: '/ai/auto-po',
        badge: 'Live',
        badgeTone: 'live',
        accent: C.orange,
    },
    {
        icon: Search,
        title: 'Anomaly detection',
        description: 'AI monitors every transaction and flags unusual demand spikes, pricing errors, or suspicious patterns.',
        path: '/ai/anomaly',
        badge: 'Live',
        badgeTone: 'live',
        accent: C.red,
    },
    {
        icon: Sparkles,
        title: 'Smart demand forecasting',
        description: 'AI forecasts with supplier lead time, seasonality, and market signals — not just averages.',
        path: '/reports/demand-forecast',
        badge: 'Live',
        badgeTone: 'live',
        accent: C.blue,
    },
    {
        icon: TrendingUp,
        title: 'Revenue forecast',
        description: 'AI predicts next month revenue with low/mid/high confidence ranges + market intelligence.',
        path: '/ai/revenue-forecast',
        badge: 'Live',
        badgeTone: 'live',
        accent: C.green,
    },
    {
        icon: Users,
        title: 'Customer-level forecast',
        description: 'Predict what each customer will order next month. Plan deliveries by route and customer.',
        path: '/ai/customer-forecast',
        badge: 'Live',
        badgeTone: 'live',
        accent: C.purple,
    },
    {
        icon: MessageCircle,
        title: 'Natural language queries',
        description: '"Which products will I run out of next week?" — Ask in plain English, get instant answers.',
        path: null,
        badge: 'Via Marcus',
        badgeTone: 'marcus',
        accent: C.orange,
    },
];

const EXAMPLE_QUESTIONS = [
    'Why is turnover low?',
    'Best products to promote?',
    'Cash flow next month?',
];

const FORECAST_BARS = [42, 55, 48, 62, 58, 71, 68, 74, 80, 76, 88, 92];

const BUILDING_NEXT = [
    { label: 'Revenue forecast', badge: 'In progress', tone: C.green },
    { label: 'AI supplier negotiation', badge: 'Q3 2026', tone: C.orange },
    { label: 'Customer credit risk', badge: 'Q3 2026', tone: C.orange },
    { label: 'AI route optimisation', badge: 'Q4 2026', tone: C.blue },
];

function LiveBadge({ label, tone }: { label: string; tone: 'live' | 'marcus' }) {
    const isLive = tone === 'live';
    return (
        <span
            style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: isLive ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)',
                color: isLive ? '#86EFAC' : '#FCD34D',
                border: `1px solid ${isLive ? 'rgba(34,197,94,.35)' : 'rgba(245,158,11,.35)'}`,
            }}
        >
            {label}
        </span>
    );
}

function FeatureCardContent({ feature, onOpen }: { feature: FeatureCard; onOpen: () => void }) {
    const Icon = feature.icon;

    const renderBody = () => {
        if (feature.title === 'Auto PO generation') {
            return (
                <>
                    <p style={{ fontSize: 10, color: C.muted, margin: '0 0 8px' }}>Latest AI action today · 06:00 AM</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {['Bettano 0W16', 'Bettano 0W20'].map((item) => (
                            <div
                                key={item}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    background: C.bg3,
                                    border: '1px solid rgba(255,255,255,.05)',
                                }}
                            >
                                <span style={{ fontSize: 10.5, color: C.text }}>{item}</span>
                                <span
                                    style={{
                                        fontSize: 8.5,
                                        fontWeight: 700,
                                        padding: '2px 6px',
                                        borderRadius: 999,
                                        background: 'rgba(245,158,11,.15)',
                                        color: '#FCD34D',
                                    }}
                                >
                                    Draft PO created
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        if (feature.title === 'Anomaly detection') {
            return (
                <>
                    <p style={{ fontSize: 10, color: C.muted, margin: '0 0 8px' }}>3 anomalies detected</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)' }}>
                            <span style={{ fontSize: 10.5, color: C.text, fontWeight: 600 }}>ROE 4.0%</span>
                            <span style={{ fontSize: 9.5, color: C.red, marginLeft: 8, fontWeight: 700 }}>High risk</span>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)' }}>
                            <span style={{ fontSize: 10.5, color: C.text, fontWeight: 600 }}>Zenoil pricing error</span>
                            <span style={{ fontSize: 9.5, color: C.orange, marginLeft: 8, fontWeight: 700 }}>Review</span>
                        </div>
                    </div>
                    <p style={{ fontSize: 9.5, color: C.dim, margin: '8px 0 0' }}>Last checked: 2 min ago</p>
                </>
            );
        }

        if (feature.title === 'Smart demand forecasting') {
            return (
                <>
                    <p style={{ fontSize: 10, color: C.muted, margin: '0 0 8px' }}>30-day forecast · 0W16</p>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48, marginBottom: 8 }}>
                        {FORECAST_BARS.map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: 1,
                                    height: `${h}%`,
                                    background: `linear-gradient(180deg, ${C.blue}, rgba(79,142,247,.35))`,
                                    borderRadius: '2px 2px 0 0',
                                    opacity: 0.85,
                                }}
                            />
                        ))}
                    </div>
                    <p style={{ fontSize: 10, color: C.text, margin: 0 }}>
                        <span style={{ fontWeight: 700 }}>0W16:</span> 96 units predicted ·{' '}
                        <span style={{ color: C.green, fontWeight: 700 }}>81% confidence</span>
                    </p>
                </>
            );
        }

        if (feature.title === 'Revenue forecast') {
            const low = 380000;
            const mid = 414000;
            const high = 460000;
            return (
                <>
                    <p style={{ fontSize: 10, color: C.muted, margin: '0 0 8px' }}>June 2026 projection</p>
                    <svg viewBox="0 0 200 44" style={{ width: '100%', height: 44, marginBottom: 8 }}>
                        <polyline
                            fill="none"
                            stroke={C.green}
                            strokeWidth="2"
                            points="0,36 25,30 50,32 75,24 100,26 125,18 150,20 175,12 200,8"
                        />
                        <polyline
                            fill="none"
                            stroke="rgba(79,142,247,.35)"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            points="0,38 25,34 50,36 75,30 100,32 125,26 150,28 175,22 200,18"
                        />
                    </svg>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {[
                            { label: 'Low', value: low },
                            { label: 'Mid', value: mid },
                            { label: 'High', value: high },
                        ].map((box) => (
                            <div
                                key={box.label}
                                style={{
                                    textAlign: 'center',
                                    padding: '6px 4px',
                                    borderRadius: 6,
                                    background: C.bg3,
                                    border: '1px solid rgba(255,255,255,.06)',
                                }}
                            >
                                <div style={{ fontSize: 8.5, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>{box.label}</div>
                                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text, marginTop: 2 }}>{formatUsd(box.value)}</div>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: 9.5, color: C.green, fontWeight: 700, margin: '8px 0 0' }}>+10% vs May</p>
                </>
            );
        }

        if (feature.title === 'Customer-level forecast') {
            return (
                <>
                    <p style={{ fontSize: 10, color: C.muted, margin: '0 0 8px' }}>June predictions · at-risk accounts</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {['Qahir Trading', 'Ali A&R Motors', 'Riaz SNR Auto'].map((name) => (
                            <div
                                key={name}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    background: C.bg3,
                                }}
                            >
                                <span style={{ fontSize: 10.5, color: C.text }}>{name}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: C.orange }}>At risk</span>
                            </div>
                        ))}
                    </div>
                    <p style={{ fontSize: 9.5, color: C.dim, margin: '8px 0 0' }}>186 customers forecast</p>
                </>
            );
        }

        return (
            <>
                <p style={{ fontSize: 10.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.45 }}>{feature.description}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {['Run-out risk next week?', 'Top margin products?', 'Overdue collections?'].map((pill) => (
                        <span
                            key={pill}
                            style={{
                                fontSize: 9,
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: 'rgba(79,142,247,.1)',
                                border: '1px solid rgba(79,142,247,.25)',
                                color: '#93C5FD',
                            }}
                        >
                            {pill}
                        </span>
                    ))}
                </div>
            </>
        );
    };

    const footerText =
        feature.title === 'Auto PO generation'
            ? '2 draft POs awaiting approval'
            : feature.title === 'Natural language queries'
              ? 'Open Marcus →'
              : 'Open →';

    return (
        <div
            style={{
                ...panel,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'border-color .15s, transform .15s',
                borderTop: `3px solid ${feature.accent}`,
            }}
            onClick={onOpen}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(79,142,247,.35)';
                e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: `${feature.accent}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Icon size={18} color={feature.accent} />
                </div>
                <LiveBadge label={feature.badge} tone={feature.badgeTone} />
            </div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>{feature.title}</h3>
            <div style={{ flex: 1 }}>{renderBody()}</div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 12,
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: feature.path ? C.muted : C.blue,
                }}
            >
                {footerText} <ArrowRight size={12} />
            </div>
        </div>
    );
}

export default function AIHub() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [askInput, setAskInput] = useState('');

    const liveDateLabel = useMemo(
        () =>
            new Date().toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            }),
        []
    );

    const handleFeatureOpen = (feature: FeatureCard) => {
        if (feature.path) {
            navigate(feature.path);
        } else {
            openMarcusAdvisor();
        }
    };

    const handleAskMarcus = () => {
        openMarcusAdvisor();
        setAskInput('');
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
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>● Live • {liveDateLabel}</span>
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
                        {userInitials(currentUser.name)}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 32px' }}>
                {/* Page header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                            <Brain size={24} color="#EC4899" />
                            AI intelligence hub
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 5, marginBottom: 0, maxWidth: 560 }}>
                            Powered by Claude AI · All features use your real live business data · never generic
                        </p>
                    </div>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 999,
                            background: 'rgba(124,58,237,.15)',
                            color: '#C4B5FD',
                            border: '1px solid rgba(124,58,237,.35)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        14 AI sessions this month
                    </span>
                </div>

                {/* Stats bar */}
                <div style={{ ...panel, padding: '14px 16px', marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[
                            { icon: Briefcase, label: '6 AI features', sub: 'Live in production', color: C.text },
                            { icon: Sparkles, label: 'Powered by Claude Haiku', sub: 'Fast + cost-efficient', color: C.purple },
                            { icon: DollarSign, label: 'Cost per query: ~$0.001', sub: 'Typical session cost', color: C.green },
                            { icon: Lock, label: 'Data stays in your account', sub: 'No training on your data', color: C.text },
                        ].map((stat) => {
                            const StatIcon = stat.icon;
                            return (
                                <div key={stat.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: C.bg3,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <StatIcon size={15} color={stat.color === C.purple ? C.purple : stat.color === C.green ? C.green : C.muted} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 11, fontWeight: 700, color: stat.color, margin: 0, lineHeight: 1.3 }}>{stat.label}</p>
                                        <p style={{ fontSize: 9.5, color: C.dim, margin: '3px 0 0' }}>{stat.sub}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div
                        style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: '1px solid rgba(255,255,255,.06)',
                            fontSize: 10.5,
                            color: C.muted,
                            lineHeight: 1.5,
                        }}
                    >
                        <span style={{ color: C.green, fontWeight: 700 }}>✓ Uses your real invoices, customers, stock</span>
                        {' · '}
                        Your ERP is AI-native — every feature below analyses actual business data and takes intelligent action automatically.
                    </div>
                </div>

                {/* Marcus hero */}
                <div
                    style={{
                        ...panel,
                        padding: 18,
                        marginBottom: 16,
                        background: 'linear-gradient(135deg, rgba(76,29,149,.45) 0%, rgba(15,31,51,.95) 55%, rgba(10,23,38,1) 100%)',
                        border: '1px solid rgba(124,58,237,.35)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: 'rgba(79,142,247,.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <Bot size={24} color={C.blue} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <h2 style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: 0 }}>Marcus — your AI business advisor</h2>
                                    <span
                                        style={{
                                            fontSize: 9,
                                            fontWeight: 700,
                                            padding: '2px 8px',
                                            borderRadius: 999,
                                            background: 'rgba(79,142,247,.2)',
                                            color: '#93C5FD',
                                            border: '1px solid rgba(79,142,247,.35)',
                                        }}
                                    >
                                        Always on
                                    </span>
                                </div>
                                <p style={{ fontSize: 11, color: C.muted, margin: '5px 0 0', maxWidth: 520, lineHeight: 1.45 }}>
                                    24/7 expert on your data — customers, cash flow, inventory, pricing, and strategy. Ask anything in plain English.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/agents/business-advisor')}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '8px 14px',
                                borderRadius: 8,
                                border: 'none',
                                background: C.blue,
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                flexShrink: 0,
                            }}
                        >
                            Open Marcus <ArrowRight size={14} />
                        </button>
                    </div>

                    {/* Chat mockup */}
                    <div
                        style={{
                            background: 'rgba(0,0,0,.25)',
                            border: '1px solid rgba(255,255,255,.08)',
                            borderRadius: 10,
                            padding: 14,
                            marginBottom: 12,
                        }}
                    >
                        <div style={{ marginBottom: 12 }}>
                            <p style={{ fontSize: 9, color: C.dim, margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase' }}>You</p>
                            <p style={{ fontSize: 11.5, color: C.text, margin: 0, fontWeight: 600 }}>
                                Why is my inventory turnover so low?
                            </p>
                        </div>
                        <div>
                            <p style={{ fontSize: 9, color: '#93C5FD', margin: '0 0 4px', fontWeight: 700 }}>Marcus</p>
                            <p style={{ fontSize: 11, color: C.muted, margin: 0, lineHeight: 1.55 }}>
                                Turnover is 4.2× vs your 6× target. OW16 and 0W20 are overstocked (+38 days cover) while Mobil 5W30 is understocked.
                                I recommend pausing Bettano reorders for 2 weeks and shifting van capacity to high-velocity SKUs. Two draft POs are
                                awaiting your approval — I&apos;d review those first.
                            </p>
                        </div>
                    </div>

                    {/* Prompt bar */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {EXAMPLE_QUESTIONS.map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={openMarcusAdvisor}
                                    style={{
                                        fontSize: 9.5,
                                        padding: '5px 10px',
                                        borderRadius: 999,
                                        background: 'rgba(255,255,255,.06)',
                                        border: '1px solid rgba(255,255,255,.1)',
                                        color: C.muted,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                            <input
                                type="text"
                                value={askInput}
                                onChange={(e) => setAskInput(e.target.value)}
                                placeholder="Ask Marcus anything…"
                                style={{
                                    width: 200,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    background: C.bg3,
                                    border: '1px solid rgba(255,255,255,.1)',
                                    color: C.text,
                                    fontSize: 10.5,
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleAskMarcus}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: C.purple,
                                    color: '#fff',
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                Ask <Send size={12} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* AI Features grid */}
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>AI features</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        {AI_FEATURES.map((feature) => (
                            <FeatureCardContent
                                key={feature.title}
                                feature={feature}
                                onOpen={() => handleFeatureOpen(feature)}
                            />
                        ))}
                    </div>
                </div>

                {/* Building next */}
                <div style={{ ...panel, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Building next</h2>
                        <span style={{ fontSize: 9.5, color: C.dim, fontWeight: 600 }}>estimated Q3 2026</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {BUILDING_NEXT.map((item) => (
                            <div
                                key={item.label}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    background: C.bg3,
                                }}
                            >
                                <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>{item.label}</span>
                                <span
                                    style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: 999,
                                        background: `${item.tone}18`,
                                        color: item.tone === C.green ? '#86EFAC' : item.tone === C.orange ? '#FCD34D' : '#93C5FD',
                                        border: `1px solid ${item.tone}44`,
                                    }}
                                >
                                    {item.badge}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 16,
                        padding: '12px 0 0',
                        borderTop: '1px solid rgba(255,255,255,.06)',
                    }}
                >
                    <p style={{ fontSize: 10, color: C.dim, margin: 0, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.45, maxWidth: 620 }}>
                        <Lock size={12} color={C.dim} style={{ flexShrink: 0 }} />
                        Claude Haiku processes your queries with explicit approval. Your data is never used to train external models.
                    </p>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '5px 12px',
                            borderRadius: 999,
                            background: 'rgba(34,197,94,.12)',
                            color: '#86EFAC',
                            border: '1px solid rgba(34,197,94,.28)',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Powered by Claude AI
                    </span>
                </div>
            </div>
        </div>
    );
}
