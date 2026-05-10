import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Send, Zap, RefreshCw } from 'lucide-react';
import { getCustomers, getInvoices, type Customer } from '../../services/api';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const CAMPAIGNS_KEY = 'bettano_campaigns';

interface Campaign {
    id: string;
    name: string;
    type: string;
    channels: string[];
    status: 'draft' | 'scheduled' | 'sent';
    audience: string;
    audienceCount: number;
    createdAt: string;
    scheduledAt?: string;
    content?: Record<string, string>;
}

interface Segment {
    id: string;
    name: string;
    desc: string;
    color: string;
    customers: Customer[];
    criteria: string;
}

function getCampaigns(): Campaign[] {
    try { return JSON.parse(localStorage.getItem(CAMPAIGNS_KEY) || '[]'); } catch { return []; }
}

// ─── Customer Segments Page ───────────────────────────────────
export function CustomerSegments() {
    const navigate = useNavigate();
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        Promise.all([getCustomers(), getInvoices()]).then(([custs, invs]) => {
            const today = new Date();
            const spend: Record<string, number> = {};
            const lastOrder: Record<string, Date> = {};
            invs.forEach(i => {
                spend[String(i.customerId)] = (spend[String(i.customerId)] || 0) + i.grandTotal;
                const d = new Date(i.invoiceDate);
                if (!lastOrder[String(i.customerId)] || d > lastOrder[String(i.customerId)]) lastOrder[String(i.customerId)] = d;
            });

            const built: Segment[] = [
                {
                    id: 'vip', name: '👑 VIP Customers', desc: 'Top 20% by spend', color: 'bg-purple-100 text-purple-700 border-purple-200',
                    criteria: 'Total spend > average',
                    customers: custs.filter(c => (spend[String(c.id)] || 0) > Object.values(spend).reduce((s, v) => s + v, 0) / Math.max(Object.keys(spend).length, 1)).slice(0, 30),
                },
                {
                    id: 'active', name: '🟢 Active (30 days)', desc: 'Ordered in last 30 days', color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    criteria: 'Last order within 30 days',
                    customers: custs.filter(c => { const d = lastOrder[String(c.id)]; return d && (today.getTime() - d.getTime()) < 30 * 86400000; }),
                },
                {
                    id: 'at_risk', name: '⚠️ At Risk (60-90d)', desc: 'Haven\'t ordered in 60-90 days', color: 'bg-amber-100 text-amber-700 border-amber-200',
                    criteria: 'Last order 60-90 days ago',
                    customers: custs.filter(c => { const d = lastOrder[String(c.id)]; if (!d) return false; const days = (today.getTime() - d.getTime()) / 86400000; return days >= 60 && days < 90; }),
                },
                {
                    id: 'lapsed', name: '🔴 Lapsed (90d+)', desc: 'Not ordered in 90+ days', color: 'bg-red-100 text-red-700 border-red-200',
                    criteria: 'Last order 90+ days ago',
                    customers: custs.filter(c => { const d = lastOrder[String(c.id)]; if (!d) return false; return (today.getTime() - d.getTime()) / 86400000 >= 90; }),
                },
                {
                    id: 'new', name: '🆕 New Customers', desc: 'Joined in last 90 days', color: 'bg-blue-100 text-blue-700 border-blue-200',
                    criteria: 'Created within 90 days',
                    customers: custs.filter(c => { const d = new Date(c.created_at || ''); return !isNaN(d.getTime()) && (today.getTime() - d.getTime()) < 90 * 86400000; }).slice(0, 20),
                },
                {
                    id: 'with_email', name: '📧 Has Email', desc: 'Email campaign ready', color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                    criteria: 'Has email address',
                    customers: custs.filter(c => c.email),
                },
                {
                    id: 'with_phone', name: '📱 Has Phone', desc: 'WhatsApp / SMS ready', color: 'bg-green-100 text-green-700 border-green-200',
                    criteria: 'Has phone number',
                    customers: custs.filter(c => c.phone),
                },
                {
                    id: 'all', name: '👥 All Customers', desc: 'Full customer base', color: 'bg-gray-100 text-gray-700 border-gray-200',
                    criteria: 'All customers',
                    customers: custs,
                },
            ];
            setSegments(built);
            setLoading(false);
        });
    }, []);

    const getAISegmentIdeas = async () => {
        setAiLoading(true);
        try {
            const summary = segments.map(s => `${s.name}: ${s.customers.length} customers`).join(', ');
            const res = await fetch(`${API}/ai/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: 'You are a marketing strategist for a NYC oil distribution company. Give 3 specific campaign ideas based on customer segments. Max 150 words. No markdown.',
                    max_tokens: 400,
                    messages: [{ role: 'user', content: `My customer segments: ${summary}. Give 3 targeted campaign ideas.` }]
                })
            });
            const d = await res.json();
            setAiInsight(d.reply || '');
        } catch { setAiInsight('Could not reach AI.'); }
        finally { setAiLoading(false); }
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10">
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/marketing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3"><ArrowLeft size={14} /> Marketing Hub</button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black uppercase">Customer Segments</h1>
                        <p className="text-gray-400 text-xs mt-0.5">Auto-segmented from ERP data · Click any segment to create a campaign</p>
                    </div>
                    <button onClick={getAISegmentIdeas} disabled={aiLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl text-sm font-black transition-all">
                        {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />} AI Campaign Ideas
                    </button>
                </div>
            </div>

            {aiInsight && (
                <div className="bg-gray-900 rounded-2xl p-5 text-white">
                    <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-2">AI Campaign Recommendations</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{aiInsight}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {segments.map(seg => (
                    <div key={seg.id} onClick={() => navigate(`/marketing/campaigns/new?segment=${seg.id}&count=${seg.customers.length}`)}
                        className={`bg-white rounded-2xl border-2 p-4 cursor-pointer hover:shadow-md transition-all ${seg.color}`}>
                        <p className="text-base font-black mb-1">{seg.name}</p>
                        <p className="text-xs mb-3">{seg.desc}</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black">{loading ? '...' : seg.customers.length}</span>
                            <span className="text-xs font-bold">customers</span>
                        </div>
                        <p className="text-[10px] mt-2 opacity-60">Tap to create campaign →</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Campaign Manager Page ────────────────────────────────────
export function CampaignManager() {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    useEffect(() => { setCampaigns(getCampaigns()); }, []);

    const STATUS_STYLE: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-600',
        scheduled: 'bg-amber-100 text-amber-700',
        sent: 'bg-emerald-100 text-emerald-700',
    };

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10">
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/marketing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3"><ArrowLeft size={14} /> Marketing Hub</button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black uppercase">Campaign Manager</h1>
                        <p className="text-gray-400 text-xs mt-0.5">{campaigns.length} campaigns · Create, schedule, and track</p>
                    </div>
                    <button onClick={() => navigate('/marketing/studio')}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl text-sm font-black transition-all shadow-lg">
                        <Plus size={16} /> New Campaign
                    </button>
                </div>
            </div>

            {campaigns.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <Send size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-500 font-black text-lg">No campaigns yet</p>
                    <p className="text-gray-400 text-sm mt-1">Create your first campaign in the AI Content Studio</p>
                    <button onClick={() => navigate('/marketing/studio')} className="mt-4 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-black">
                        Open Content Studio →
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>{['Campaign', 'Channels', 'Audience', 'Status', 'Created'].map(h => (
                                <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                            ))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {campaigns.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-5 py-4 font-black text-sm text-gray-900">{c.name}</td>
                                    <td className="px-5 py-4 text-sm text-gray-500">{c.channels.join(', ')}</td>
                                    <td className="px-5 py-4 text-sm text-gray-500">{c.audienceCount} customers</td>
                                    <td className="px-5 py-4"><span className={`text-[10px] font-black px-2 py-1 rounded-full ${STATUS_STYLE[c.status]}`}>{c.status}</span></td>
                                    <td className="px-5 py-4 text-xs font-mono text-gray-400">{c.createdAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Marketing Analytics Page ─────────────────────────────────
export function MarketingAnalytics() {
    const navigate = useNavigate();

    const MOCK_STATS = [
        { channel: '📧 Email', sent: 145, opened: 89, clicked: 34, rate: '61%' },
        { channel: '💬 WhatsApp', sent: 160, opened: 142, clicked: 98, rate: '89%' },
        { channel: '📱 SMS', sent: 130, opened: 115, clicked: 45, rate: '88%' },
        { channel: '📘 Facebook', reach: 2400, engaged: 340, clicked: 89, rate: '14%' },
        { channel: '📸 Instagram', reach: 1800, engaged: 420, clicked: 67, rate: '23%' },
        { channel: '💼 LinkedIn', reach: 890, engaged: 123, clicked: 45, rate: '14%' },
    ];

    return (
        <div className="space-y-5 max-w-[1100px] mx-auto pb-10">
            <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-2xl p-6 text-white">
                <button onClick={() => navigate('/marketing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3"><ArrowLeft size={14} /> Marketing Hub</button>
                <h1 className="text-xl font-black uppercase">Marketing Analytics</h1>
                <p className="text-gray-400 text-xs mt-0.5">Track performance across all channels</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Reach', value: '5,370', icon: '👁', color: 'text-blue-600' },
                    { label: 'Total Engaged', value: '1,114', icon: '🤝', color: 'text-purple-600' },
                    { label: 'Total Clicks', value: '378', icon: '👆', color: 'text-emerald-600' },
                    { label: 'Avg. Engagement', value: '34%', icon: '📈', color: 'text-orange-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                        <span className="text-2xl">{s.icon}</span>
                        <p className={`text-2xl font-black mt-2 ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-sm font-black text-gray-700">Channel Performance</p>
                    <p className="text-xs text-gray-400 mt-0.5">Connect your accounts to see live data · Sample data shown below</p>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50"><tr>
                        {['Channel', 'Sent/Reach', 'Opened/Engaged', 'Clicked', 'Rate'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                        ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                        {MOCK_STATS.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-5 py-4 font-black text-sm">{row.channel}</td>
                                <td className="px-5 py-4 text-sm font-mono text-gray-700">{(row as any).sent || (row as any).reach}</td>
                                <td className="px-5 py-4 text-sm font-mono text-gray-700">{(row as any).opened || (row as any).engaged}</td>
                                <td className="px-5 py-4 text-sm font-mono text-emerald-600 font-black">{row.clicked}</td>
                                <td className="px-5 py-4">
                                    <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{row.rate}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <p className="text-sm font-black text-amber-800 mb-2">Connect Your Accounts for Live Analytics</p>
                <p className="text-xs text-amber-700">To see real data, connect your social media and email accounts. Currently showing sample data.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                    {['📧 Mailchimp', '💬 WhatsApp Business', '📘 Meta Business', '📱 Twilio SMS'].map((ch, i) => (
                        <button key={i} className="text-xs px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-amber-700 font-bold hover:bg-amber-100 transition-all">
                            Connect {ch}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
