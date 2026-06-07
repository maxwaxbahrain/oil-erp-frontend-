import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Phone, Mail, MessageSquare, Calendar, Plus, MoreVertical,
    CheckCircle, Clock, Target,
    DollarSign, Trash2, X, Check, ArrowLeft,
    Building2, Star
} from 'lucide-react';
import { authFetch } from '../../api/axios';
import { getCustomers, type Customer } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

// ── Types ─────────────────────────────────────────────────────
type DealStage = 'lead' | 'contacted' | 'qualified' | 'proposal' | 'negotiating' | 'won' | 'lost';
type ActivityType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'follow_up' | 'site_visit';
type Priority = 'low' | 'medium' | 'high';

interface Deal {
    id: string;
    title: string;
    customerId?: string;
    customerName: string;
    phone?: string;
    email?: string;
    stage: DealStage;
    value: number;
    probability: number;
    priority: Priority;
    product?: string;
    notes?: string;
    assignedTo?: string;
    createdAt: string;
    expectedCloseDate?: string;
    activities: Activity[];
    tags?: string[];
    source?: string;
}

interface Activity {
    id: string;
    dealId: string;
    type: ActivityType;
    title: string;
    notes?: string;
    dueDate: string;
    done: boolean;
    createdAt: string;
}

// ── Constants ─────────────────────────────────────────────────
const STAGES: Record<DealStage, { label: string; color: string; bg: string; prob: number }> = {
    lead:        { label: 'New Lead',     color: 'text-gray-600',   bg: 'bg-gray-100',    prob: 10 },
    contacted:   { label: 'Contacted',   color: 'text-blue-600',   bg: 'bg-blue-100',    prob: 25 },
    qualified:   { label: 'Qualified',   color: 'text-purple-600', bg: 'bg-purple-100',  prob: 40 },
    proposal:    { label: 'Proposal',    color: 'text-amber-600',  bg: 'bg-amber-100',   prob: 60 },
    negotiating: { label: 'Negotiating', color: 'text-orange-600', bg: 'bg-orange-100',  prob: 75 },
    won:         { label: '✅ Won',       color: 'text-emerald-700',bg: 'bg-emerald-100', prob: 100 },
    lost:        { label: '❌ Lost',      color: 'text-red-600',    bg: 'bg-red-100',     prob: 0 },
};

const STAGE_ORDER: DealStage[] = ['lead','contacted','qualified','proposal','negotiating','won','lost'];

const ACT_ICONS: Record<ActivityType, any> = {
    call: Phone, email: Mail, whatsapp: MessageSquare,
    meeting: Calendar, follow_up: CheckCircle, site_visit: Building2,
};

const ACT_LABELS: Record<ActivityType, string> = {
    call: 'Phone Call', email: 'Email', whatsapp: 'WhatsApp',
    meeting: 'Meeting', follow_up: 'Follow-Up', site_visit: 'Site Visit',
};

const PRODUCTS = [
    'Soltol 5W30 API SP', 'Soltol 5W20 API SP', 'Soltol 0W20 API SP',
    'Soltol 5W40 API SP', 'Soltol ATF DEX III', 'Soltol 10W40 API SN',
    'Mixed Oil Products', 'Bulk Order — All Products',
];

const SOURCES = ['Cold Call','Referral','Walk-in','WhatsApp','Website','Trade Show','Existing Customer','Email Campaign'];

// ── Storage ───────────────────────────────────────────────────
const CRM_KEY = 'bettano_crm_deals';
function getDeals(): Deal[] {
    try { return JSON.parse(localStorage.getItem(CRM_KEY) || '[]'); } catch { return []; }
}
function saveDeal(deal: Deal) {
    const deals = getDeals();
    const idx = deals.findIndex(d => d.id === deal.id);
    if (idx >= 0) deals[idx] = deal; else deals.unshift(deal);
    localStorage.setItem(CRM_KEY, JSON.stringify(deals));
}
function deleteDeal(id: string) {
    localStorage.setItem(CRM_KEY, JSON.stringify(getDeals().filter(d => d.id !== id)));
}

// ── Empty deal ────────────────────────────────────────────────
const emptyDeal = (): Omit<Deal, 'id' | 'createdAt' | 'activities'> => ({
    title: '', customerName: '', phone: '', email: '', stage: 'lead',
    value: 0, probability: 10, priority: 'medium', product: '', notes: '',
    expectedCloseDate: '', source: 'Cold Call', tags: [],
});

// ── Deal Card Component ────────────────────────────────────────
function DealCard({ deal, onEdit, onDelete, onMove, onActivity }: {
    deal: Deal;
    onEdit: (d: Deal) => void;
    onDelete: (id: string) => void;
    onMove: (id: string, stage: DealStage) => void;
    onActivity: (d: Deal) => void;
}) {
    const [menu, setMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const pending = deal.activities.filter(a => !a.done);
    const overdue = pending.filter(a => new Date(a.dueDate) < new Date());
    const _stage = STAGES[deal.stage]; void _stage;

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            onClick={() => onEdit(deal)}>
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 truncate">{deal.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">{deal.customerName}</p>
                </div>
                <div className="flex items-center gap-1 ml-2 relative" ref={menuRef}>
                    {deal.priority === 'high' && <Star size={12} className="text-amber-500 fill-amber-500" />}
                    <button onClick={e => { e.stopPropagation(); setMenu(!menu); }}
                        className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all">
                        <MoreVertical size={14} className="text-gray-400" />
                    </button>
                    {menu && (
                        <div className="absolute top-6 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-40 overflow-hidden">
                            <button onClick={e => { e.stopPropagation(); onActivity(deal); setMenu(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 font-bold flex items-center gap-2">
                                <Calendar size={12} className="text-blue-500" /> Add Activity
                            </button>
                            {STAGE_ORDER.filter(s => s !== deal.stage).slice(0, 4).map(s => (
                                <button key={s} onClick={e => { e.stopPropagation(); onMove(deal.id, s); setMenu(false); }}
                                    className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 text-gray-600">
                                    Move to {STAGES[s].label}
                                </button>
                            ))}
                            <button onClick={e => { e.stopPropagation(); onDelete(deal.id); setMenu(false); }}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-red-50 text-red-500 font-bold flex items-center gap-2 border-t border-gray-100">
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-black text-gray-900">{deal.value > 0 ? formatCurrency(deal.value) : '—'}</span>
                <span className="text-[10px] font-black text-gray-400">{deal.probability}% likely</span>
            </div>

            {deal.product && <p className="text-[10px] text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-bold truncate mb-2">{deal.product}</p>}

            <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                <div className="flex items-center gap-2">
                    {deal.phone && <Phone size={10} className="text-gray-300" />}
                    {deal.email && <Mail size={10} className="text-gray-300" />}
                    {pending.length > 0 && (
                        <span className={`flex items-center gap-0.5 font-bold ${overdue.length > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                            <Clock size={10} /> {pending.length} {overdue.length > 0 ? '(overdue!)' : ''}
                        </span>
                    )}
                </div>
                {deal.expectedCloseDate && <span className="font-mono">{deal.expectedCloseDate}</span>}
            </div>
        </div>
    );
}

// ── Main CRM Component ────────────────────────────────────────
export default function CRM() {
    const navigate = useNavigate();
    const [deals, setDeals] = useState<Deal[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [view, setView] = useState<'pipeline' | 'list' | 'activities'>('pipeline');
    const [showForm, setShowForm] = useState(false);
    const [editDeal, setEditDeal] = useState<Deal | null>(null);
    const [formData, setFormData] = useState(emptyDeal());
    const [showActForm, setShowActForm] = useState<Deal | null>(null);
    const [actForm, setActForm] = useState<Partial<Activity>>({ type: 'call', title: '', dueDate: new Date().toISOString().slice(0,10), done: false, notes: '' });
    const [custSearch, setCustSearch] = useState('');
    const [custResults, setCustResults] = useState<Customer[]>([]);
    const [filterStage, setFilterStage] = useState<DealStage | 'all'>('all');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setDeals(getDeals());
        getCustomers().then(setCustomers).catch(() => {});
    }, []);

    const refresh = () => setDeals(getDeals());

    const handleSaveDeal = () => {
        if (!formData.title.trim() || !formData.customerName.trim()) {
            alert('Title and customer name are required.'); return;
        }
        setSaving(true);
        const deal: Deal = {
            ...formData,
            id: editDeal?.id || `DEAL-${Date.now()}`,
            createdAt: editDeal?.createdAt || new Date().toISOString().slice(0,10),
            activities: editDeal?.activities || [],
        };
        saveDeal(deal);
        refresh();
        setShowForm(false);
        setEditDeal(null);
        setFormData(emptyDeal());
        setSaving(false);
    };

    const openEdit = (deal: Deal) => {
        setEditDeal(deal);
        setFormData({ title: deal.title, customerName: deal.customerName, phone: deal.phone, email: deal.email,
            stage: deal.stage, value: deal.value, probability: deal.probability, priority: deal.priority,
            product: deal.product, notes: deal.notes, expectedCloseDate: deal.expectedCloseDate, source: deal.source || 'Cold Call', tags: deal.tags || [] });
        setShowForm(true);
    };

    const moveDeal = (id: string, stage: DealStage) => {
        const deal = getDeals().find(d => d.id === id);
        if (!deal) return;
        saveDeal({ ...deal, stage, probability: STAGES[stage].prob });
        refresh();
    };

    const handleAddActivity = () => {
        if (!showActForm || !actForm.title?.trim()) { alert('Activity title required.'); return; }
        const deal = getDeals().find(d => d.id === showActForm.id);
        if (!deal) return;
        const act: Activity = {
            id: `ACT-${Date.now()}`,
            dealId: deal.id,
            type: actForm.type as ActivityType || 'call',
            title: actForm.title || '',
            notes: actForm.notes,
            dueDate: actForm.dueDate || new Date().toISOString().slice(0,10),
            done: false,
            createdAt: new Date().toISOString().slice(0,10),
        };
        saveDeal({ ...deal, activities: [...deal.activities, act] });
        refresh();
        setShowActForm(null);
        setActForm({ type: 'call', title: '', dueDate: new Date().toISOString().slice(0,10), done: false, notes: '' });
    };

    const toggleActivity = (dealId: string, actId: string) => {
        const deal = getDeals().find(d => d.id === dealId);
        if (!deal) return;
        saveDeal({ ...deal, activities: deal.activities.map(a => a.id === actId ? { ...a, done: !a.done } : a) });
        refresh();
    };

    const searchCust = (q: string) => {
        setCustSearch(q);
        if (q.length < 2) { setCustResults([]); return; }
        setCustResults(customers.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6));
    };

    const upd = (field: string, val: any) => setFormData(p => ({ ...p, [field]: val }));

    // Stats
    const activeDeals = deals.filter(d => d.stage !== 'won' && d.stage !== 'lost');
    const wonDeals = deals.filter(d => d.stage === 'won');
    const totalPipeline = activeDeals.reduce((s, d) => s + d.value * d.probability / 100, 0);
    const allActivities = deals.flatMap(d => d.activities);
    const pendingActs = allActivities.filter(a => !a.done);
    const overdueActs = pendingActs.filter(a => new Date(a.dueDate) < new Date());

    const filtered = deals.filter(d => filterStage === 'all' || d.stage === filterStage);
    const pipelineStages = STAGE_ORDER.filter(s => s !== 'won' && s !== 'lost');

    return (
        <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-5 text-white flex-shrink-0">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                            <Target size={20} className="text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-tight">CRM — Sales Pipeline</h1>
                            <p className="text-gray-400 text-[11px]">Track every lead from first contact to closed deal</p>
                        </div>
                    </div>
                    <button onClick={() => { setEditDeal(null); setFormData(emptyDeal()); setShowForm(true); }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black transition-all">
                        <Plus size={16} /> New Deal
                    </button>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {[
                        { label: 'Active Deals', value: activeDeals.length, color: 'text-white', icon: Target },
                        { label: 'Pipeline Value', value: formatCurrency(totalPipeline), color: 'text-emerald-400', icon: DollarSign },
                        { label: 'Won This Period', value: wonDeals.length, color: 'text-emerald-400', icon: CheckCircle },
                        { label: overdueActs.length > 0 ? '⚠ Overdue Activities' : 'Pending Activities', value: pendingActs.length, color: overdueActs.length > 0 ? 'text-red-400' : 'text-amber-400', icon: Clock },
                    ].map((k, i) => {
                        const Icon = k.icon;
                        return (
                            <div key={i} className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
                                <Icon size={18} className={k.color} />
                                <div>
                                    <p className={`text-base font-black ${k.color}`}>{k.value}</p>
                                    <p className="text-[10px] text-gray-400">{k.label}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Tabs + Filter */}
            <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
                <div className="flex gap-2">
                    {[['pipeline','🗂 Pipeline'],['list','📋 List'],['activities','📅 Activities']].map(([v, l]) => (
                        <button key={v} onClick={() => setView(v as any)}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                            {l}
                        </button>
                    ))}
                </div>
                {view === 'list' && (
                    <div className="flex gap-2 flex-wrap">
                        {(['all', ...STAGE_ORDER] as const).map(s => (
                            <button key={s} onClick={() => setFilterStage(s)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${filterStage === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                                {s === 'all' ? 'All' : STAGES[s as DealStage].label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── PIPELINE VIEW ── */}
            {view === 'pipeline' && (
                <div className="flex gap-3 overflow-x-auto pb-4 flex-1 min-h-0">
                    {pipelineStages.map(stage => {
                        const stageDeals = deals.filter(d => d.stage === stage);
                        const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
                        const s = STAGES[stage];
                        return (
                            <div key={stage} className="flex-shrink-0 w-64">
                                <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${s.bg}`}>
                                    <div>
                                        <p className={`text-xs font-black ${s.color}`}>{s.label}</p>
                                        <p className="text-[10px] text-gray-400">{stageDeals.length} deals · {formatCurrency(stageValue)}</p>
                                    </div>
                                    <button onClick={() => { setFormData({ ...emptyDeal(), stage }); setEditDeal(null); setShowForm(true); }}
                                        className={`w-6 h-6 ${s.bg} rounded-lg flex items-center justify-center hover:opacity-70 transition-all`}>
                                        <Plus size={12} className={s.color} />
                                    </button>
                                </div>
                                <div className="space-y-2 min-h-[100px]">
                                    {stageDeals.map(deal => (
                                        <DealCard key={deal.id} deal={deal}
                                            onEdit={openEdit}
                                            onDelete={id => { deleteDeal(id); refresh(); }}
                                            onMove={moveDeal}
                                            onActivity={setShowActForm} />
                                    ))}
                                    {stageDeals.length === 0 && (
                                        <div className="border-2 border-dashed border-gray-100 rounded-xl p-4 text-center cursor-pointer hover:border-gray-300 transition-all"
                                            onClick={() => { setFormData({ ...emptyDeal(), stage }); setEditDeal(null); setShowForm(true); }}>
                                            <p className="text-[10px] text-gray-400 font-bold">+ Add deal</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {/* Won + Lost mini columns */}
                    {(['won','lost'] as DealStage[]).map(stage => {
                        const stageDeals = deals.filter(d => d.stage === stage);
                        const s = STAGES[stage];
                        return (
                            <div key={stage} className="flex-shrink-0 w-52">
                                <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${s.bg}`}>
                                    <div>
                                        <p className={`text-xs font-black ${s.color}`}>{s.label}</p>
                                        <p className="text-[10px] text-gray-400">{stageDeals.length} deals</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {stageDeals.slice(0, 5).map(deal => (
                                        <div key={deal.id} className="bg-white rounded-xl border border-gray-100 p-2.5 cursor-pointer hover:shadow-sm transition-all"
                                            onClick={() => openEdit(deal)}>
                                            <p className="text-xs font-black text-gray-700 truncate">{deal.title}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{deal.customerName}</p>
                                            {deal.value > 0 && <p className="text-xs font-black text-gray-600 mt-0.5">{formatCurrency(deal.value)}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── LIST VIEW ── */}
            {view === 'list' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 font-bold">No deals yet. Click "New Deal" to add one.</div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                                <tr>{['Deal','Customer','Product','Value','Stage','Close Date','Activities',''].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(deal => {
                                    const s = STAGES[deal.stage];
                                    const pending = deal.activities.filter(a => !a.done).length;
                                    const overdue = deal.activities.filter(a => !a.done && new Date(a.dueDate) < new Date()).length;
                                    return (
                                        <tr key={deal.id} className="hover:bg-gray-50 cursor-pointer transition-all" onClick={() => openEdit(deal)}>
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-black text-gray-900">{deal.title}</p>
                                                {deal.priority === 'high' && <span className="text-[9px] text-amber-600 font-bold">★ High Priority</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-700">{deal.customerName}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {deal.phone && (
                                                        <a href={`https://wa.me/${deal.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            className="text-[9px] text-green-600 font-bold flex items-center gap-0.5 hover:underline">
                                                            💬 {deal.phone}
                                                        </a>
                                                    )}
                                                    {deal.email && !deal.phone && <span className="text-[9px] text-gray-400">{deal.email}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-500">{deal.product || '—'}</td>
                                            <td className="px-4 py-3 text-sm font-black font-mono text-gray-900">{deal.value > 0 ? formatCurrency(deal.value) : '—'}</td>
                                            <td className="px-4 py-3"><span className={`text-[10px] font-black px-2 py-1 rounded-full ${s.bg} ${s.color}`}>{s.label}</span></td>
                                            <td className="px-4 py-3 text-xs font-mono text-gray-400">{deal.expectedCloseDate || '—'}</td>
                                            <td className="px-4 py-3">
                                                {pending > 0 && (
                                                    <span className={`text-[10px] font-black ${overdue > 0 ? 'text-red-500' : 'text-amber-500'}`}>
                                                        {overdue > 0 ? `⚠ ${overdue} overdue` : `${pending} pending`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <button onClick={e => { e.stopPropagation(); setShowActForm(deal); }} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400 transition-all" title="Add activity">
                                                        <Plus size={13} />
                                                    </button>
                                                    <button onClick={e => { e.stopPropagation(); deleteDeal(deal.id); refresh(); }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-all">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── ACTIVITIES VIEW ── */}
            {view === 'activities' && (
                <div className="flex-1 overflow-y-auto space-y-3">
                    {pendingActs.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 font-bold">
                            <CheckCircle size={48} className="mx-auto text-gray-200 mb-3" />
                            All caught up! No pending activities.
                        </div>
                    ) : (
                        <>
                            {overdueActs.length > 0 && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                                    <p className="text-sm font-black text-red-700 mb-3">⚠ {overdueActs.length} Overdue Activities</p>
                                    <div className="space-y-2">
                                        {overdueActs.map(act => {
                                            const deal = deals.find(d => d.id === act.dealId);
                                            const Icon = ACT_ICONS[act.type];
                                            return (
                                                <div key={act.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-red-100">
                                                    <button onClick={() => toggleActivity(act.dealId, act.id)}
                                                        className="w-5 h-5 rounded border-2 border-red-300 flex-shrink-0 hover:bg-red-100 transition-all" />
                                                    <Icon size={14} className="text-red-400 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-900">{act.title}</p>
                                                        <p className="text-[10px] text-gray-400">{deal?.customerName} · Due: {act.dueDate}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100">
                                    <p className="text-sm font-black text-gray-700">Upcoming Activities ({pendingActs.filter(a => new Date(a.dueDate) >= new Date()).length})</p>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {pendingActs.filter(a => new Date(a.dueDate) >= new Date()).sort((a,b) => a.dueDate.localeCompare(b.dueDate)).map(act => {
                                        const deal = deals.find(d => d.id === act.dealId);
                                        const Icon = ACT_ICONS[act.type];
                                        return (
                                            <div key={act.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-all">
                                                <button onClick={() => toggleActivity(act.dealId, act.id)}
                                                    className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0 hover:bg-gray-100 transition-all" />
                                                <Icon size={14} className="text-gray-400 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-800">{act.title}</p>
                                                    <p className="text-[10px] text-gray-400">{deal?.customerName || '—'} · {ACT_LABELS[act.type]} · Due: {act.dueDate}</p>
                                                    {act.notes && <p className="text-[10px] text-gray-400 italic mt-0.5">{act.notes}</p>}
                                                </div>
                                                <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{act.dueDate}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── DEAL FORM MODAL ── */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">{editDeal ? 'Edit Deal' : 'New Deal'}</h2>
                            <button onClick={() => setShowForm(false)} className="w-7 h-7 bg-gray-100 hover:bg-red-50 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 transition-all">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Deal Title *</label>
                                    <input value={formData.title} onChange={e => upd('title', e.target.value)}
                                        placeholder="e.g. 50 drums 5W30 for ABC Auto"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                </div>
                                <div className="relative">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Customer Name *</label>
                                    <input value={formData.customerName || custSearch}
                                        onChange={e => { upd('customerName', e.target.value); searchCust(e.target.value); }}
                                        placeholder="Type to search or enter new"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                    {custResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto">
                                            {custResults.map(c => (
                                                <button key={c.id} onClick={() => { upd('customerName', c.name); upd('phone', c.phone || ''); upd('email', c.email || ''); setCustResults([]); setCustSearch(''); }}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 text-sm font-bold text-gray-800 border-b border-gray-50">
                                                    {c.name} {c.phone ? `· ${c.phone}` : ''}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Stage</label>
                                    <select value={formData.stage} onChange={e => { upd('stage', e.target.value); upd('probability', STAGES[e.target.value as DealStage].prob); }}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                                        {STAGE_ORDER.map(s => <option key={s} value={s}>{STAGES[s].label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Deal Value (USD)</label>
                                    <input type="number" value={formData.value || ''} onChange={e => upd('value', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-400" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Win Probability %</label>
                                    <input type="number" min={0} max={100} value={formData.probability} onChange={e => upd('probability', parseInt(e.target.value) || 0)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Product</label>
                                    <select value={formData.product} onChange={e => upd('product', e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                                        <option value="">Select product...</option>
                                        {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Priority</label>
                                    <select value={formData.priority} onChange={e => upd('priority', e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">⭐ High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Source</label>
                                    <select value={formData.source} onChange={e => upd('source', e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                                        {SOURCES.map(s => <option key={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Expected Close Date</label>
                                    <input type="date" value={formData.expectedCloseDate || ''} onChange={e => upd('expectedCloseDate', e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Phone</label>
                                    <input value={formData.phone || ''} onChange={e => upd('phone', e.target.value)}
                                        placeholder="+1 347 000 0000"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Email</label>
                                    <input value={formData.email || ''} onChange={e => upd('email', e.target.value)}
                                        placeholder="customer@example.com"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Notes</label>
                                    <textarea value={formData.notes || ''} onChange={e => upd('notes', e.target.value)} rows={2}
                                        placeholder="Customer details, requirements, conversation notes..."
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
                                </div>
                            </div>

                            {/* Activities list in edit mode */}
                            {/* AI Deal Analysis */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <button
                                    onClick={async () => {
                                        const API2 = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
                                        const btn = document.getElementById('ai-deal-btn');
                                        if (btn) btn.textContent = 'Analyzing...';
                                        try {
                                            const res = await authFetch(`${API2}/ai/chat`, {
                                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    system: 'You are a CRM sales advisor for Soltol oil distributor NYC. Give concise deal advice in 3-4 sentences. Be specific and actionable.',
                                                    max_tokens: 300,
                                                    messages: [{ role: 'user', content: `Analyze this deal: Customer: ${editDeal?.customerName}, Product: ${editDeal?.product || 'Oil products'}, Value: $${editDeal?.value}, Stage: ${editDeal?.stage}, Probability: ${editDeal?.probability}%, Source: ${editDeal?.source}. Notes: ${editDeal?.notes || 'None'}. Give me the top 2 actions to close this deal.` }]
                                                })
                                            });
                                            if (!res.ok) {
                                                let detail = '';
                                                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                                                throw new Error(detail || `HTTP ${res.status}`);
                                            }
                                            const d = await res.json();
                                            const el = document.getElementById('ai-deal-result');
                                            if (el) { el.textContent = d.reply || 'No analysis returned.'; el.style.display = 'block'; }
                                        } catch {
                                            const el = document.getElementById('ai-deal-result');
                                            if (el) { el.textContent = 'AI unavailable. Check backend connection.'; el.style.display = 'block'; }
                                        }
                                        if (btn) btn.textContent = '⚡ AI Deal Advisor';
                                    }}
                                    id="ai-deal-btn"
                                    className="w-full py-2 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-gray-700 transition-all"
                                >
                                    ⚡ AI Deal Advisor
                                </button>
                                <div id="ai-deal-result" className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-700 leading-relaxed hidden" />
                            </div>

                            {editDeal && editDeal.activities.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Activities</p>
                                    <div className="space-y-1.5">
                                        {editDeal.activities.map(act => {
                                            const Icon = ACT_ICONS[act.type];
                                            return (
                                                <div key={act.id} className={`flex items-center gap-2 p-2.5 rounded-xl border ${act.done ? 'bg-gray-50 border-gray-100' : 'bg-amber-50 border-amber-100'}`}>
                                                    <button onClick={() => toggleActivity(editDeal.id, act.id)}
                                                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${act.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                                                        {act.done && <Check size={10} className="text-white" />}
                                                    </button>
                                                    <Icon size={13} className={act.done ? 'text-gray-300' : 'text-amber-500'} />
                                                    <p className={`text-xs flex-1 ${act.done ? 'text-gray-400 line-through' : 'font-bold text-gray-700'}`}>{act.title}</p>
                                                    <span className="text-[10px] font-mono text-gray-400">{act.dueDate}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button onClick={handleSaveDeal} disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 disabled:opacity-50 transition-all">
                                    <Check size={14} /> {editDeal ? 'Save Changes' : 'Create Deal'}
                                </button>
                                {editDeal && (
                                    <button onClick={() => setShowActForm(editDeal)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-black hover:bg-blue-100 transition-all border border-blue-200">
                                        <Plus size={14} /> Add Activity
                                    </button>
                                )}
                                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-black text-gray-400 hover:text-gray-700">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ACTIVITY FORM MODAL ── */}
            {showActForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowActForm(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Add Activity — {showActForm.customerName}</h2>
                            <button onClick={() => setShowActForm(null)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 transition-all"><X size={14} /></button>
                        </div>
                        <div className="p-5 space-y-3">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Activity Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.entries(ACT_LABELS) as [ActivityType, string][]).map(([type, label]) => {
                                        const Icon = ACT_ICONS[type];
                                        return (
                                            <button key={type} onClick={() => setActForm(p => ({ ...p, type }))}
                                                className={`flex items-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${actForm.type === type ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-100 text-gray-500 hover:border-gray-200'}`}>
                                                <Icon size={13} /> {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Activity Title *</label>
                                <input value={actForm.title} onChange={e => setActForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="e.g. Follow up on quotation, Schedule delivery"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Due Date</label>
                                <input type="date" value={actForm.dueDate} onChange={e => setActForm(p => ({ ...p, dueDate: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Notes</label>
                                <textarea value={actForm.notes} onChange={e => setActForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                                    placeholder="What to discuss or follow up on..."
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
                            </div>
                            <div className="flex gap-3 pt-1">
                                <button onClick={handleAddActivity} className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-black hover:bg-gray-700 transition-all">
                                    <Check size={14} /> Add Activity
                                </button>
                                <button onClick={() => setShowActForm(null)} className="px-4 py-2.5 text-sm font-black text-gray-400 hover:text-gray-700">Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
