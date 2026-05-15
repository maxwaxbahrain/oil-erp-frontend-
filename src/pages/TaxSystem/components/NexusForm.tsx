// Reusable add/edit form for a TaxNexus record.
// Same shape + behaviour as RuleForm so the page feels consistent.

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { NexusType, TaxNexus } from '../data/types';
import { NEXUS_TYPES, NEXUS_TYPE_LABELS } from '../data/constants';

interface Props {
    initial?: Partial<TaxNexus>;
    onSubmit: (payload: Partial<TaxNexus>) => Promise<string | null>;
    onCancel: () => void;
}

export function NexusForm({ initial, onSubmit, onCancel }: Props) {
    const editing = !!initial?.id;
    const [form, setForm] = useState({
        jurisdiction: initial?.jurisdiction || '',
        nexusType: (initial?.nexusType || 'physical') as NexusType,
        establishedDate: initial?.establishedDate || '',
        thresholdAmount: initial?.thresholdAmount != null ? String(initial.thresholdAmount) : '',
        notes: initial?.notes || '',
        isActive: initial?.isActive ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm({
            jurisdiction: initial?.jurisdiction || '',
            nexusType: (initial?.nexusType || 'physical') as NexusType,
            establishedDate: initial?.establishedDate || '',
            thresholdAmount: initial?.thresholdAmount != null ? String(initial.thresholdAmount) : '',
            notes: initial?.notes || '',
            isActive: initial?.isActive ?? true,
        });
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial?.id]);

    const handleSubmit = async () => {
        setError(null);
        if (!form.jurisdiction.trim()) { setError('Jurisdiction is required'); return; }
        let threshold: number | null = null;
        if (form.thresholdAmount.trim()) {
            const n = parseFloat(form.thresholdAmount);
            if (Number.isNaN(n) || n < 0) { setError('Threshold amount must be a non-negative number'); return; }
            threshold = n;
        }
        setSaving(true);
        try {
            const err = await onSubmit({
                jurisdiction: form.jurisdiction.trim().toUpperCase(),
                nexusType: form.nexusType,
                establishedDate: form.establishedDate || undefined,
                thresholdAmount: threshold,
                notes: form.notes.trim() || undefined,
                isActive: form.isActive,
            });
            if (err) setError(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest">
                    {editing ? '✏️ Edit Nexus' : '➕ New Nexus'}
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
                        placeholder="e.g. US-NY, US-CA, BH"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nexus Type</label>
                    <select
                        value={form.nexusType}
                        onChange={e => setForm(p => ({ ...p, nexusType: e.target.value as NexusType }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    >
                        {NEXUS_TYPES.map(t => <option key={t} value={t}>{NEXUS_TYPE_LABELS[t]}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Established Date</label>
                    <input
                        type="date"
                        value={form.establishedDate}
                        onChange={e => setForm(p => ({ ...p, establishedDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Threshold Amount</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.thresholdAmount}
                        onChange={e => setForm(p => ({ ...p, thresholdAmount: e.target.value }))}
                        placeholder="Optional (e.g. 100000 for economic nexus)"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Notes</label>
                    <input
                        type="text"
                        value={form.notes}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional context"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                </div>
                <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                            className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-sm font-bold text-gray-700">Nexus is active</span>
                    </label>
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
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl text-sm font-black transition-all"
                >
                    <Check size={14} />
                    {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Nexus')}
                </button>
                <button onClick={onCancel} className="px-4 py-2.5 text-sm font-black text-gray-500 hover:text-gray-800">
                    Cancel
                </button>
            </div>
        </div>
    );
}
