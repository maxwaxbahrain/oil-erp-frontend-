import { useNavigate } from 'react-router-dom';
import { Brain, TrendingUp, AlertTriangle, ShoppingCart, Users, Zap, ArrowRight, CheckCircle2, DollarSign } from 'lucide-react';

const AI_FEATURES = [
    {
        icon: ShoppingCart,
        title: 'Auto PO Generation',
        description: 'Stock hits minimum → AI instantly creates a draft purchase order. Never run out again.',
        path: '/ai/auto-po',
        status: 'live',
        badge: 'Live',
        color: 'emerald',
    },
    {
        icon: AlertTriangle,
        title: 'Anomaly Detection',
        description: 'AI monitors every transaction and flags unusual demand spikes, pricing errors, or suspicious patterns.',
        path: '/ai/anomaly',
        status: 'live',
        badge: 'Live',
        color: 'orange',
    },
    {
        icon: TrendingUp,
        title: 'Smart Demand Forecasting',
        description: 'AI forecasts with supplier lead time, seasonality, and market signals — not just averages.',
        path: '/reports/demand-forecast',
        status: 'live',
        badge: 'Live',
        color: 'blue',
    },
    {
        icon: DollarSign,
        title: 'Revenue Forecast',
        description: 'AI predicts next month revenue with low/mid/high confidence ranges + market intelligence.',
        path: '/ai/revenue-forecast',
        status: 'live',
        badge: 'Live',
        color: 'blue',
    },
    {
        icon: Users,
        title: 'Customer-Level Forecast',
        description: 'Predict what each customer will order next month. Plan deliveries by route and customer.',
        path: '/ai/customer-forecast',
        status: 'live',
        badge: 'Live',
        color: 'purple',
    },
    {
        icon: Brain,
        title: 'AI Business Advisor',
        description: 'Marcus — your 24/7 expert advisor. Ask anything about your data, marketing, cash flow, strategy.',
        path: null,
        status: 'live',
        badge: 'Always On',
        color: 'gray',
        note: 'Click the AI Business Advisor button (bottom right) on any page'
    },
    {
        icon: Zap,
        title: 'Natural Language Queries',
        description: '"Which products will I run out of next week?" — Ask in plain English, get instant answers.',
        path: null,
        status: 'live',
        badge: 'Via Advisor',
        color: 'yellow',
        note: 'Use the AI Business Advisor button on any page'
    },
];

const COLOR_MAP: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-400',
    orange: 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400',
    blue: 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-400',
    purple: 'bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-400',
    gray: 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:border-yellow-400',
};

const BADGE_MAP: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-700',
    yellow: 'bg-yellow-100 text-yellow-700',
};

export default function AIHub() {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">

            {/* Hero */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <Brain size={28} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">AI Intelligence Hub</h1>
                        <p className="text-gray-400 text-sm">Powered by Claude AI · All features use your real live data</p>
                    </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                    Your ERP is now AI-native. Every feature below analyzes your actual business data — invoices, customers, products, orders — and takes intelligent action automatically.
                </p>
                <div className="flex items-center gap-4 mt-5 flex-wrap">
                    {[
                        { label: 'AI Features', value: '6' },
                        { label: 'Auto-Actions', value: 'PO + Alerts' },
                        { label: 'Powered by', value: 'Claude Haiku' },
                        { label: 'Cost per query', value: '~$0.001' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/10 rounded-xl px-4 py-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{s.label}</p>
                            <p className="text-sm font-black text-white">{s.value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AI_FEATURES.map((feature) => {
                    const Icon = feature.icon;
                    const colorClass = COLOR_MAP[feature.color];
                    const badgeClass = BADGE_MAP[feature.color];
                    return (
                        <div
                            key={feature.title}
                            onClick={() => feature.path && navigate(feature.path)}
                            className={`bg-white border-2 rounded-2xl p-5 shadow-sm transition-all ${colorClass} ${feature.path ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default opacity-90'}`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/60">
                                    <Icon size={20} />
                                </div>
                                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${badgeClass}`}>
                                    {feature.badge}
                                </span>
                            </div>
                            <h3 className="text-sm font-black text-gray-900 mb-2">{feature.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                            {feature.note && (
                                <p className="text-[10px] text-gray-400 mt-2 italic">{feature.note}</p>
                            )}
                            {feature.path && (
                                <div className="flex items-center gap-1 mt-3 text-xs font-black text-gray-400">
                                    Open <ArrowRight size={12} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Score Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <p className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">AI Score vs Doss (Competitor)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'ERP Completeness', score: 9, max: 10, color: 'emerald' },
                        { label: 'Domain Depth', score: 9, max: 10, color: 'emerald' },
                        { label: 'AI Forecasting', score: 9, max: 10, color: 'blue' },
                        { label: 'Auto-Actions', score: 9, max: 10, color: 'orange' },
                    ].map((s, i) => (
                        <div key={i} className="text-center">
                            <div className={`text-3xl font-black ${s.color === 'emerald' ? 'text-emerald-600' : s.color === 'blue' ? 'text-blue-600' : 'text-orange-600'}`}>
                                {s.score}<span className="text-gray-300 text-lg">/{s.max}</span>
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{s.label}</p>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                                <div className={`h-1.5 rounded-full ${s.color === 'emerald' ? 'bg-emerald-500' : s.color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'}`}
                                    style={{ width: `${(s.score / s.max) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 text-center mt-4">Scores improve as we build each AI feature</p>
            </div>

            {/* What's Coming */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Building Next</p>
                <div className="space-y-2">
                    {[
                        'Revenue forecast with confidence ranges (high/medium/low)',
                        'AI supplier negotiation advisor — when to buy, how much to pay',
                        'Customer credit risk scoring — AI flags risk before it happens',
                        'AI route optimization — best delivery sequence per van',
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-500">
                            <CheckCircle2 size={14} className="text-gray-300 flex-shrink-0" />
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
