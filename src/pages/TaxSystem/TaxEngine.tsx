// TaxEngine — landing page for the Tax Engine module.
//
// Session 1A (foundation): health badge + quick calculator + read-only rules table.
// Session 1B (this update): full CRUD for rules — add, edit, delete, active toggle.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calculator, Plus, Edit2, Trash2 } from 'lucide-react';
import { HealthBadge } from './components/HealthBadge';
import { RuleForm } from './components/RuleForm';
import {
    listTaxRules,
    createTaxRule,
    updateTaxRule,
    deleteTaxRule,
} from './integrations/taxEngineApi';
import { calculateTax } from './engine';
import { TAX_ENGINE_VERSION } from './data/constants';
import type { TaxRule } from './data/types';
import { formatCurrency } from '../../services/settingsService';

export default function TaxEngine() {
    const navigate = useNavigate();
    const [rules, setRules] = useState<TaxRule[]>([]);
    const [loading, setLoading] = useState(true);

    // Rule editor state: null = closed, {} = create mode, {id…} = edit mode.
    const [editing, setEditing] = useState<Partial<TaxRule> | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    // Timer for clearing the flash. Tracked in a ref so successive
    // showFlash() calls cancel the previous timer (otherwise the older
    // 4-second timeout would clear a newer flash too early), and so the
    // pending timer can be cleared on unmount.
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [demoAmount, setDemoAmount] = useState('1000');
    const [demoJurisdiction, setDemoJurisdiction] = useState('US-NY');

    const reloadRules = async () => {
        setLoading(true);
        try { setRules(await listTaxRules()); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        reloadRules();
        return () => {
            if (flashTimer.current) clearTimeout(flashTimer.current);
        };
    }, []);

    const showFlash = (msg: string) => {
        if (flashTimer.current) clearTimeout(flashTimer.current);
        setFlash(msg);
        flashTimer.current = setTimeout(() => setFlash(null), 4000);
    };

    // Pencil-icon click handler — sets edit mode and scrolls the form
    // into view. Rows near the bottom of a long rules table were
    // opening the form off-screen at the top of the page.
    const openEdit = (rule: TaxRule) => {
        setEditing(rule);
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
    };

    const handleSubmit = async (payload: Partial<TaxRule>): Promise<string | null> => {
        if (editing?.id) {
            const { rule, error } = await updateTaxRule(String(editing.id), payload);
            if (error || !rule) return error || 'Failed to update rule';
            // Optimistic replace in local state, then re-fetch.
            setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
            showFlash(`✅ Updated: ${rule.jurisdiction} · ${rule.name}`);
        } else {
            const { rule, error } = await createTaxRule(payload);
            if (error || !rule) return error || 'Failed to create rule';
            setRules(prev => [rule, ...prev]);
            showFlash(`✅ Created: ${rule.jurisdiction} · ${rule.name}`);
        }
        setEditing(null);
        // Background reconcile to pick up any server-side normalisation.
        listTaxRules().then(fresh => { if (fresh.length > 0) setRules(fresh); });
        return null;
    };

    const handleDelete = async (rule: TaxRule) => {
        if (!confirm(`Delete rule "${rule.name}" (${rule.jurisdiction})?`)) return;
        const { ok, error } = await deleteTaxRule(rule.id);
        if (!ok) { alert(`❌ ${error || 'Failed to delete'}`); return; }
        setRules(prev => prev.filter(r => r.id !== rule.id));
        showFlash(`🗑 Deleted: ${rule.jurisdiction} · ${rule.name}`);
    };

    // Quick toggle without opening the form.
    const handleToggleActive = async (rule: TaxRule) => {
        const { rule: updated, error } = await updateTaxRule(rule.id, { isActive: !rule.isActive });
        if (error || !updated) { alert(`❌ ${error || 'Failed to update'}`); return; }
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
    };

    const amt = parseFloat(demoAmount) || 0;
    const result = calculateTax(amt, demoJurisdiction, rules);

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
                            Foundation module · version {TAX_ENGINE_VERSION}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <HealthBadge externalRuleCount={rules.length} />
                        <button
                            onClick={() => { setEditing({}); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0); }}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                        >
                            <Plus size={14} /> Add Rule
                        </button>
                    </div>
                </div>
            </div>

            {/* Rule editor (visible when adding or editing) */}
            {editing !== null && (
                <RuleForm
                    initial={editing}
                    onSubmit={handleSubmit}
                    onCancel={() => setEditing(null)}
                />
            )}

            {/* Quick calculator */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-4">Quick Calculator</h2>
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
                            placeholder="e.g. US-NY, US-CA, BH"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400"
                        />
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1.5">Computed Tax</label>
                        <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-2.5">
                            <p className="text-lg font-black font-mono text-orange-700">
                                {formatCurrency(result.taxAmount)}
                            </p>
                            <p className="text-[10px] text-orange-600 font-bold">
                                {result.rate.toFixed(3)}% · source: {result.source}
                                {result.matchedRule ? ` · ${result.matchedRule.name}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rules table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Configured Rules · {rules.length}
                    </p>
                </div>
                {loading ? (
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
                                        {/* Click to toggle active without opening the form */}
                                        <button
                                            onClick={() => handleToggleActive(r)}
                                            className={`relative w-9 h-5 rounded-full transition-all ${r.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                            title={r.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${r.isActive ? 'left-4' : 'left-0.5'}`} />
                                        </button>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button
                                                onClick={() => openEdit(r)}
                                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700"
                                                title="Edit rule"
                                            >
                                                <Edit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(r)}
                                                className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600"
                                                title="Delete rule"
                                            >
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

            <p className="text-xs text-gray-400 text-center">
                Tax Engine v{TAX_ENGINE_VERSION} · Session 1B: rule editor (add / edit / delete / toggle active)
            </p>
        </div>
    );
}
