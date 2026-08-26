import { useState, useEffect } from 'react';
import { authFetch } from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, RefreshCw } from 'lucide-react';
import { getCustomers, getInvoices, type Customer } from '../../services/api';

const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

interface Segment {
    id: string;
    name: string;
    desc: string;
    color: string;
    customers: Customer[];
    criteria: string;
}

// ─── Customer Segments Page ───────────────────────────────────
export function CustomerSegments() {
    const navigate = useNavigate();
    const [segments, setSegments] = useState<Segment[]>([]);
    const [loading, setLoading] = useState(true);
    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            getCustomers().catch(() => []),
            getInvoices().catch(() => [])
        ]).then(([custs, invs]) => {
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
        }).catch(() => setLoading(false));
    }, []);

    const getAISegmentIdeas = async () => {
        setAiLoading(true);
        try {
            const summary = segments.map(s => `${s.name}: ${s.customers.length} customers`).join(', ');
            const res = await authFetch(`${API}/ai/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: 'You are a marketing strategist for a NYC oil distribution company. Give 3 specific campaign ideas based on customer segments. Max 150 words. No markdown.',
                    max_tokens: 400,
                    messages: [{ role: 'user', content: `My customer segments: ${summary}. Give 3 targeted campaign ideas.` }]
                })
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
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
                    // TC-80 — Was navigating to `/marketing/campaigns/new`,
                    // a route that does NOT exist in routes.tsx. The
                    // catch-all `path="*"` then redirected to `/` (the
                    // dashboard) — the exact symptom QA reported. Send
                    // users to the existing CampaignManager route with
                    // segment context as query params; CampaignManager
                    // reads those and surfaces a banner so the user
                    // knows which segment they came from.
                    <div key={seg.id}
                        onClick={() => navigate(`/marketing/campaigns?segment=${encodeURIComponent(seg.id)}&segmentName=${encodeURIComponent(seg.name)}&count=${seg.customers.length}`)}
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
