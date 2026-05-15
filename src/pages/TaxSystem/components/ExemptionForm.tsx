// Reusable add/edit form for a TaxExemption certificate.
// Inline panel (not a modal), same shape as RuleForm / NexusForm.

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type { ExemptionType, TaxExemption } from '../data/types';
import { EXEMPTION_TYPES, EXEMPTION_TYPE_LABELS, EXEMPTION_ANY_JURISDICTION } from '../data/constants';

interface Props {
    initial?: Partial<TaxExemption>;
    onSubmit: (payload: Partial<TaxExemption>) => Promise<string | null>;
    onCancel: () => void;
}

export function ExemptionForm({ initial, onSubmit, onCancel }: Props) {
    const editing = !!initial?.id;
    const [form, setForm] = useState({
        customerId: initial?.customerId || '',
        customerName: initial?.customerName || '',
        jurisdiction: initial?.jurisdiction || '',
        exemptionType: (initial?.exemptionType || 'resale') as ExemptionType,
        certificateNumber: initial?.certificateNumber || '',
        issuedDate: initial?.issuedDate || '',
        expiryDate: initial?.expiryDate || '',
        notes: initial?.notes || '',
        isActive: initial?.isActive ?? true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setForm({
            customerId: initial?.customerId || '',
            customerName: initial?.customerName || '',
            jurisdiction: initial?.jurisdiction || '',
            exemptionType: (initial?.exemptionType || 'resale') as ExemptionType,
            certificateNumber: initial?.certificateNumber || '',
            issuedDate: initial?.issuedDate || '',
            expiryDate: initial?.expiryDate || '',
            notes: initial?.notes || '',
            isActive: initial?.isActive ?? true,
        });
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initial?.id]);

    const handleSubmit = async () => {
        setError(null);
        if (!form.customerId.trim()) { setError('Customer ID is required'); return; }
        if (!form.jurisdiction.trim()) { setError('Jurisdiction is required (use * for any)'); return; }
        if (!form.certificateNumber.trim()) { setError('Certificate number is required'); return; }
        if (form.expiryDate && form.issuedDate && form.expiryDate < form.issuedDate) {
            setError('Expiry date cannot be before issued date');
            return;
        }
        setSaving(true);
        try {
            const err = await onSubmit({
                customerId: form.customerId.trim(),
                customerName: form.customerName.trim() || undefined,
                jurisdiction: form.jurisdiction.trim(),
                exemptionType: form.exemptionType,
                certificateNumber: form.certificateNumber.trim(),
                issuedDate: form.issuedDate || undefined,
                expiryDate: form.expiryDate || undefined,
                notes: form.notes.trim() || undefined,
                isActive: form.isActive,
            });
            if (err) setError(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-purple-600 uppercase tracking-widest">
                    {editing ? '✏️ Edit Exemption' : '➕ New Exemption Certificate'}
                </h3>
                <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700">
                    <X size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Customer ID *</label>
                    <input
                        type="text"
                        value={form.customerId}
                        onChange={e => setForm(p => ({ ...p, customerId: e.target.value }))}
                        placeholder="e.g. CUST-1042 or acme-corp"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Customer Name</label>
                    <input
                        type="text"
                        value={form.customerName}
                        onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))}
                        placeholder="Display label (optional)"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Jurisdiction *</label>
                    <input
                        type="text"
                        value={form.jurisdiction}
                        onChange={e => setForm(p => ({ ...p, jurisdiction: e.target.value }))}
                        placeholder="e.g. US-NY  ·  or * for any"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                        Use <code className="font-mono">{EXEMPTION_ANY_JURISDICTION}</code> for federal-level certs that apply everywhere.
                    </p>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Exemption Type</label>
                    <select
                        value={form.exemptionType}
                        onChange={e => setForm(p => ({ ...p, exemptionType: e.target.value as ExemptionType }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                    >
                        {EXEMPTION_TYPES.map(t => <option key={t} value={t}>{EXEMPTION_TYPE_LABELS[t]}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Certificate Number *</label>
                    <input
                        type="text"
                        value={form.certificateNumber}
                        onChange={e => setForm(p => ({ ...p, certificateNumber: e.target.value }))}
                        placeholder="e.g. ST-119.1-0042"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-400"
                    />
                </div>
                <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                            className="w-4 h-4 accent-purple-600"
                        />
                        <span className="text-sm font-bold text-gray-700">Certificate is active</span>
                    </label>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Issued Date</label>
                    <input
                        type="date"
                        value={form.issuedDate}
                        onChange={e => setForm(p => ({ ...p, issuedDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Expiry Date</label>
                    <input
                        type="date"
                        value={form.expiryDate}
                        onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Leave blank for non-expiring.</p>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Notes</label>
                    <input
                        type="text"
                        value={form.notes}
                        onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Optional context"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
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
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded-xl text-sm font-black transition-all"
                >
                    <Check size={14} />
                    {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Certificate')}
                </button>
                <button onClick={onCancel} className="px-4 py-2.5 text-sm font-black text-gray-500 hover:text-gray-800">
                    Cancel
                </button>
            </div>
        </div>
    );
}
