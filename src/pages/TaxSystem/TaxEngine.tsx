// TaxEngine — landing page for the Tax Engine module.
//
// Session 1A (foundation): health badge + quick calculator + read-only rules.
// Session 1B: full CRUD for rules.
// Session 1C (this update): tabs (Rules / Nexus / Calculator), nexus CRUD,
//                           calculator enforces nexus.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Plus, Edit2, Trash2, MapPin } from 'lucide-react';
import { HealthBadge } from './components/HealthBadge';
import { RuleForm } from './components/RuleForm';
import { NexusForm } from './components/NexusForm';
import {
    listTaxRules,
    createTaxRule,
    updateTaxRule,
    deleteTaxRule,
    listNexus,
    createNexus,
    updateNexus,
    deleteNexus,
} from './integrations/taxEngineApi';
import { calculateTax } from './engine';
import { TAX_ENGINE_VERSION, NEXUS_TYPE_LABELS } from './data/constants';
import type { TaxRule, TaxNexus } from './data/types';
import { formatCurrency } from '../../services/settingsService';

// Calculator was pulled out of the tab strip in Session 1C-fix because it's
// the primary thing users hit the Tax Engine for — keeping it tucked
// behind a tab as the *last* option meant users had to click through
// twice on first visit to see any calculation. It now lives above the
// tabs and is always visible.
type Tab = 'rules' | 'nexus';

export default function TaxEngine() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('rules');

    // Rules
    const [rules, setRules] = useState<TaxRule[]>([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [editingRule, setEditingRule] = useState<Partial<TaxRule> | null>(null);

    // Nexus
    const [nexusList, setNexusList] = useState<TaxNexus[]>([]);
    const [loadingNexus, setLoadingNexus] = useState(true);
    const [editingNexus, setEditingNexus] = useState<Partial<TaxNexus> | null>(null);

    const [flash, setFlash] = useState<string | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [demoAmount, setDemoAmount] = useState('1000');
    const [demoJurisdiction, setDemoJurisdiction] = useState('US-NY');

    const reloadRules = async () => {
        setLoadingRules(true);
        try { setRules(await listTaxRules()); }
        finally { setLoadingRules(false); }
    };
    const reloadNexus = async () => {
        setLoadingNexus(true);
        try { setNexusList(await listNexus()); }
        finally { setLoadingNexus(false); }
    };

    useEffect(() => {
        reloadRules();
        reloadNexus();
        return () => {
            if (flashTimer.current) clearTimeout(flashTimer.current);
        };
    }, []);

    const showFlash = (msg: string) => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(msg);
        flashTimer.current = setTimeout(() => setFlash(null), 4000);
    };

    // ─── Rule handlers ─────────────────────────────────────────────────
    const handleRuleSubmit = async (payload: Partial<TaxRule>): Promise<string | null> => {
        if (editingRule?.id) {
            const { rule, error } = await updateTaxRule(String(editingRule.id), payload);
            if (error || !rule) return error || 'Failed to update rule';
            setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
            showFlash(`✅ Updated rule: ${rule.jurisdiction} · ${rule.name}`);
        } else {
            const { rule, error } = await createTaxRule(payload);
            if (error || !rule) return error || 'Failed to create rule';
            setRules(prev => [rule, ...prev]);
            showFlash(`✅ Created rule: ${rule.jurisdiction} · ${rule.name}`);
        }
        setEditingRule(null);
        listTaxRules().then(fresh => { if (fresh.length > 0) setRules(fresh); });
        return null;
    };
    const handleRuleDelete = async (rule: TaxRule) => {
        if (!confirm(`Delete rule "${rule.name}" (${rule.jurisdiction})?`)) return;
        const { ok, error } = await deleteTaxRule(rule.id);
        if (!ok) { alert(`❌ ${error || 'Failed to delete'}`); return; }
        setRules(prev => prev.filter(r => r.id !== rule.id));
        showFlash(`🗑 Deleted rule: ${rule.jurisdiction} · ${rule.name}`);
    };
    const handleRuleToggleActive = async (rule: TaxRule) => {
        const { rule: updated, error } = await updateTaxRule(rule.id, { isActive: !rule.isActive });
        if (error || !updated) { alert(`❌ ${error || 'Failed to update'}`); return; }
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    };
    const openRuleEdit = (r: TaxRule) => {
        setEditingRule(r);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    // ─── Nexus handlers ────────────────────────────────────────────────
    const handleNexusSubmit = async (payload: Partial<TaxNexus>): Promise<string | null> => {
        if (editingNexus?.id) {
            const { nexus, error } = await updateNexus(String(editingNexus.id), payload);
            if (error || !nexus) return error || 'Failed to update nexus';
            setNexusList(prev => prev.map(n => n.id === nexus.id ? nexus : n));
            showFlash(`✅ Updated nexus: ${nexus.jurisdiction}`);
        } else {
            const { nexus, error } = await createNexus(payload);
            if (error || !nexus) return error || 'Failed to create nexus';
            setNexusList(prev => [nexus, ...prev]);
            showFlash(`✅ Created nexus: ${nexus.jurisdiction}`);
        }
        setEditingNexus(null);
        listNexus().then(fresh => { if (fresh.length > 0) setNexusList(fresh); });
        return null;
    };
    const handleNexusDelete = async (n: TaxNexus) => {
        if (!confirm(`Delete nexus for ${n.jurisdiction}?`)) return;
        const { ok, error } = await deleteNexus(n.id);
        if (!ok) { alert(`❌ ${error || 'Failed to delete'}`); return; }
        setNexusList(prev => prev.filter(x => x.id !== n.id));
        showFlash(`🗑 Deleted nexus: ${n.jurisdiction}`);
    };
    const handleNexusToggleActive = async (n: TaxNexus) => {
        const { nexus, error } = await updateNexus(n.id, { isActive: !n.isActive });
        if (error || !nexus) { alert(`❌ ${error || 'Failed to update'}`); return; }
        setNexusList(prev => prev.map(x => x.id === nexus.id ? nexus : x));
    };
    const openNexusEdit = (n: TaxNexus) => {
        setEditingNexus(n);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    const amt = parseFloat(demoAmount) || 0;
    // Only pass nexusList to the calculator once the API has answered.
    // While loadingNexus is true the list is [], and an empty array means
    // "we KNOW there's no nexus" — which would briefly flash the amber
    // no-nexus warning even before we'd actually checked. Pass undefined
    // to skip enforcement during that window.
    const result = calculateTax(
        amt, demoJurisdiction, rules, undefined,
        loadingNexus ? undefined : nexusList,
    );

    const TABS: { id: Tab; label: string; count?: number }[] = [
        { id: 'rules', label: '📜 Rules', count: rules.length },
        { id: 'nexus', label: '📍 Nexus', count: nexusList.length },
    ];

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Flash banner */}
            {flash && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-bold text-emerald-700 animate-in slide-in-from-top-2">
                    {flash}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                            <Calculator size={22} className="text-orange-500" />
                            Tax Engine
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Module · version {TAX_ENGINE_VERSION}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <HealthBadge externalRuleCount={rules.length} />
                        {activeTab === 'rules' && (
                            <button
                                onClick={() => { setEditingRule({}); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0); }}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                            >
                                <Plus size={14} /> Add Rule
                            </button>
                        )}
                        {activeTab === 'nexus' && (
                            <button
                                onClick={() => { setEditingNexus({}); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0); }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                            >
                                <MapPin size={14} /> Add Nexus
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Calculator — pinned at the top, ALWAYS visible.
                Was previously buried as the third (last) tab so users
                couldn't see any calculation result without two extra clicks
                on first visit. */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                        🧮 Quick Calculator
                    </h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        live · re-runs as you type
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Amount</label>
                        <input
                            type="number"
                            value={demoAmount}
                            onChange={e => setDemoAmount(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Jurisdiction</label>
                        <input
                            type="text"
                            value={demoJurisdiction}
                            onChange={e => setDemoJurisdiction(e.target.value)}
                            placeholder="e.g. US-NY"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Computed Tax</label>
                        <div className={`rounded-xl px-4 py-2.5 border ${result.source === 'no-nexus' ? 'bg-amber-50 border-amber-200' : 'bg-orange-50 border-orange-200'}`}>
                            <p className={`text-lg font-black font-mono ${result.source === 'no-nexus' ? 'text-amber-700' : 'text-orange-700'}`}>
                                {formatCurrency(result.taxAmount)}
                            </p>
                            <p className={`text-[10px] font-bold ${result.source === 'no-nexus' ? 'text-amber-700' : 'text-orange-600'}`}>
                                {result.rate.toFixed(3)}% · source: {result.source}
                                {result.matchedRule ? ` · ${result.matchedRule.name}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
                {result.source === 'no-nexus' && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-bold text-amber-700">
                        ⚠️ No active nexus on file for <strong>{demoJurisdiction.toUpperCase()}</strong> — a rule rated {result.rate.toFixed(3)}% would have applied but tax is suppressed. Add an active nexus on the <strong>Nexus</strong> tab to start collecting.
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeTab === t.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                    >
                        {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
                    </button>
                ))}
            </div>

            {/* Rule editor */}
            {activeTab === 'rules' && editingRule !== null && (
                <RuleForm initial={editingRule} onSubmit={handleRuleSubmit} onCancel={() => setEditingRule(null)} />
            )}

            {/* Nexus editor */}
            {activeTab === 'nexus' && editingNexus !== null && (
                <NexusForm initial={editingNexus} onSubmit={handleNexusSubmit} onCancel={() => setEditingNexus(null)} />
            )}

            {/* ───── Rules tab ───── */}
            {activeTab === 'rules' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            Configured Rules · {rules.length}
                        </p>
                    </div>
                    {loadingRules ? (
                        <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                    ) : rules.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-400 font-bold uppercase text-sm">No tax rules configured yet</p>
                            <p className="text-gray-300 text-xs mt-1">Click <strong>Add Rule</strong> to create the first one.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Jurisdiction', 'Name', 'Type', 'Rate', 'Category', 'Active', 'Actions'].map(h => (
                                        <th key={h} className={`px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {rules.map(r => (
                                    <tr key={r.id} className="hover:bg-gray-50 group">
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 font-mono">{r.jurisdiction}</td>
                                        <td className="px-5 py-3 text-sm text-gray-700">{r.name}</td>
                                        <td className="px-5 py-3">
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{r.taxType}</span>
                                        </td>
                                        <td className="px-5 py-3 text-sm font-mono font-bold text-orange-600">{r.rate.toFixed(3)}%</td>
                                        <td className="px-5 py-3 text-xs text-gray-500">{r.productCategory || '—'}</td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => handleRuleToggleActive(r)}
                                                className={`relative w-9 h-5 rounded-full transition-all ${r.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                title={r.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${r.isActive ? 'left-4' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openRuleEdit(r)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700" title="Edit rule">
                                                    <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => handleRuleDelete(r)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600" title="Delete rule">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ───── Nexus tab ───── */}
            {activeTab === 'nexus' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100">
                        <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                            Nexus Registry · {nexusList.length}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Tax is only collected in jurisdictions with an <strong>active</strong> nexus. Even if a rule exists, no-nexus jurisdictions produce \$0 tax.
                        </p>
                    </div>
                    {loadingNexus ? (
                        <div className="p-12 text-center text-gray-400 font-bold">Loading…</div>
                    ) : nexusList.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-gray-400 font-bold uppercase text-sm">No nexus configured yet</p>
                            <p className="text-gray-300 text-xs mt-1">Click <strong>Add Nexus</strong> to record where you have an obligation to collect tax.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Jurisdiction', 'Type', 'Established', 'Threshold', 'Notes', 'Active', 'Actions'].map(h => (
                                        <th key={h} className={`px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {nexusList.map(n => (
                                    <tr key={n.id} className="hover:bg-gray-50 group">
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 font-mono">{n.jurisdiction}</td>
                                        <td className="px-5 py-3">
                                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{NEXUS_TYPE_LABELS[n.nexusType] || n.nexusType}</span>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-500 font-mono">{n.establishedDate || '—'}</td>
                                        <td className="px-5 py-3 text-xs text-gray-600 font-mono">
                                            {n.thresholdAmount != null ? formatCurrency(n.thresholdAmount) : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-500 max-w-[200px] truncate">{n.notes || '—'}</td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => handleNexusToggleActive(n)}
                                                className={`relative w-9 h-5 rounded-full transition-all ${n.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                                title={n.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${n.isActive ? 'left-4' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => openNexusEdit(n)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700" title="Edit nexus">
                                                    <Edit2 size={13} />
                                                </button>
                                                <button onClick={() => handleNexusDelete(n)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600" title="Delete nexus">
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            <p className="text-xs text-gray-400 text-center">
                Tax Engine v{TAX_ENGINE_VERSION} · Session 1C: nexus enforcement
            </p>
        </div>
    );
}
