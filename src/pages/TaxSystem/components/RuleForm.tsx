// Reusable add/edit form for a TaxRule.
// Inline panel (not a modal) so it sits naturally between the page
// header and the rules table. Same shape for both create and edit
// because the only structural difference is the title + submit label.

import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import type { TaxRule, TaxType } from '../data/types';
import { TAX_TYPES } from '../data/constants';

interface Props {
    initial?: Partial<TaxRule>;        // populated → edit mode
    onSubmit: (payload: Partial<TaxRule>) => Promise<string | null>; // returns error msg or null
    onCancel: () => void;
}

export function RuleForm({ initial, onSubmit, onCancel }: Props) {
    const editing = !!initial?.id;
    const [form, setForm] = useState({
        jurisdiction: initial?.jurisdiction || '',
        name: initial?.name || '',
        rate: initial?.rate !== undefined ? String(initial.rate) : '',
        taxType: (initial?.taxType || 'sales') as TaxType,
        productCategory: initial?.productCategory || '',
        isActive: initial?.isActive ?? true,
        notes: initial?.notes || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If the parent swaps which rule is being edited (e.g. user clicks a
    // different row's pencil while the form is open), reset state from
    // the new initial values.
    useEffect(() => {
        setForm({
            jurisdiction: initial?.jurisdiction || '',
            name: initial?.name || '',
            rate: initial?.rate !== undefined ? String(initial.rate) : '',
            taxType: (initial?.taxType || 'sales') as TaxType,
            productCategory: initial?.productCategory || '',
            isActive: initial?.isActive ?? true,
            notes: initial?.notes || '',
        });
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial?.id]);

    const handleSubmit = async () => {
        setError(null);
        if (!form.jurisdiction.trim()) { setError('Jurisdiction is required'); return; }
        if (!form.name.trim()) { setError('Name is required'); return; }
        const rateNum = parseFloat(form.rate);
        if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
            setError('Rate must be a number between 0 and 100');
            return;
        }
        setSaving(true);
        try {
            const err = await onSubmit({
                jurisdiction: form.jurisdiction.trim().toUpperCase(),
                name: form.name.trim(),
                rate: rateNum,
                taxType: form.taxType,
                productCategory: form.productCategory.trim() || undefined,
                isActive: form.isActive,
                notes: form.notes.trim() || undefined,
            });
            if (err) setError(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-orange-600 uppercase tracking-widest">
                    {editing ? '✏️ Edit Rule' : '➕ New Tax Rule'}
                </h3>
                <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700">
                    <X size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Jurisdiction *</label>
                    <input
                        type="text"
                        value={form.jurisdiction}
                        onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))}
                        placeholder="e.g. US-NY, US-CA, BH, GB"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Stored uppercase. Use ISO-like codes (US-NY, GB, BH).</p>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Rule Name *</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. NY State Sales Tax"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Rate (%) *</label>
                    <input
                        type="number"
                        step="0.001"
                        value={form.rate}
                        onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                        placeholder="e.g. 8.875"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Tax Type</label>
                    <select
                        value={form.taxType}
                        onChange={e => setForm(p => ({ ...p, taxType: e.target.value as TaxType }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    >
                        {TAX_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Product Category</label>
                    <input
                        type="text"
                        value={form.productCategory}
                        onChange={e => setForm(p => ({ ...p, productCategory: e.target.value }))}
                        placeholder="Leave blank to apply to all"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    />
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                            className="w-4 h-4 accent-orange-600"
                        />
                        <span className="text-sm font-bold text-gray-700">Rule is active</span>
                    </label>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Notes</label>
                    <input
                        type="text"
                        value={form.notes}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional context for this rule"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                    />
                </div>
            </div>

            {error && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    ❌ {error}
                </div>
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl text-sm font-black transition-all"
                >
                    <Check size={14} />
                    {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Rule')}
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2.5 text-sm font-black text-gray-500 hover:text-gray-800"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
