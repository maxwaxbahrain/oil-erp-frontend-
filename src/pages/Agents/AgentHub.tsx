import { useNavigate } from 'react-router-dom';
import { Bot, Headphones, Brain, ArrowRight, Users, Package, FileText, TrendingUp } from 'lucide-react';

const AGENTS = [
    {
        id: 'customer-service',
        icon: Headphones,
        name: 'Customer Service Agent',
        tagline: 'ARIA — Your 24/7 Customer Intelligence Agent',
        description: 'Handles customer queries, checks order status, invoice details, account balances, and delivery updates. Knows every customer, every invoice, every product in the system.',
        path: '/agents/customer-service',
        color: 'blue',
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-600',
        badgeBg: 'bg-blue-600',
        capabilities: ['Order & invoice status', 'Account balance checks', 'Delivery tracking', 'Product availability', 'Payment history'],
        status: 'Live',
    },
    {
        id: 'business-advisor',
        icon: Brain,
        name: 'Marcus — Business Advisor',
        tagline: 'Strategic intelligence for every decision',
        description: 'Your senior business advisor. Analyzes revenue, forecasts demand, flags risks, and gives actionable recommendations based on live ERP data.',
        path: '/agents/business-advisor',
        color: 'orange',
        bgColor: 'bg-orange-50',
        iconColor: 'text-orange-600',
        badgeBg: 'bg-orange-600',
        capabilities: ['Revenue forecasting', 'Demand analysis', 'Risk alerts', 'Supplier negotiations', 'Cash flow advice'],
        status: 'Live',
    },
];

const STATS = [
    { icon: Users, label: 'Customers in ERP', getValue: () => '160+' },
    { icon: FileText, label: 'Invoices tracked', getValue: () => 'Live' },
    { icon: Package, label: 'Products catalogued', getValue: () => 'All' },
    { icon: TrendingUp, label: 'AI model', getValue: () => 'Claude Haiku' },
];

export default function AgentHub() {
    const navigate = useNavigate();

    return (
        <div className="space-y-8 max-w-[1100px] mx-auto pb-12 animate-in fade-in duration-500">

            {/* Hero */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-5" style={{backgroundImage: 'radial-gradient(circle at 70% 50%, #f97316 0%, transparent 60%)'}} />
                <div className="relative flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                        <Bot size={32} className="text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">AI Agent Center</h1>
                        <p className="text-gray-400 text-sm">Powered by Claude · Connected to live ERP data</p>
                    </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed max-w-2xl mb-6">
                    Every agent is trained on your live business data — customers, invoices, products, orders, payments. They don't give generic answers. They know <em>your</em> business.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {STATS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={i} className="bg-white/10 rounded-xl p-3 flex items-center gap-2">
                                <Icon size={16} className="text-orange-400 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-black text-white">{s.getValue()}</p>
                                    <p className="text-[10px] text-gray-400">{s.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Agent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {AGENTS.map(agent => {
                    const Icon = agent.icon;
                    return (
                        <div key={agent.id}
                            onClick={() => navigate(agent.path)}
                            className="bg-white border-2 border-gray-100 rounded-2xl p-6 cursor-pointer hover:border-gray-300 hover:shadow-lg transition-all group">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-12 h-12 ${agent.bgColor} rounded-xl flex items-center justify-center`}>
                                    <Icon size={24} className={agent.iconColor} />
                                </div>
                                <span className={`text-[10px] font-black text-white px-3 py-1 rounded-full ${agent.badgeBg}`}>{agent.status}</span>
                            </div>
                            <h3 className="text-base font-black text-gray-900 mb-1">{agent.name}</h3>
                            <p className="text-xs font-bold text-gray-400 mb-3">{agent.tagline}</p>
                            <p className="text-sm text-gray-600 leading-relaxed mb-4">{agent.description}</p>
                            <div className="space-y-1.5 mb-5">
                                {agent.capabilities.map((cap, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                        {cap}
                                    </div>
                                ))}
                            </div>
                            <div className={`flex items-center gap-2 text-sm font-black ${agent.iconColor} group-hover:gap-3 transition-all`}>
                                Open Agent <ArrowRight size={14} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* How it works */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">How agents access your data</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { step: '01', title: 'You ask a question', desc: 'Type naturally — "What does Ahmed owe us?" or "Which products are low on stock?"' },
                        { step: '02', title: 'Agent loads your ERP', desc: 'Pulls live data: customers, invoices, products, payments, orders in real-time.' },
                        { step: '03', title: 'Precise answer', desc: 'Responds with exact figures, names, dates — not generic answers.' },
                    ].map((s, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <span className="text-2xl font-black text-gray-200">{s.step}</span>
                            <div>
                                <p className="text-sm font-black text-gray-800">{s.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
