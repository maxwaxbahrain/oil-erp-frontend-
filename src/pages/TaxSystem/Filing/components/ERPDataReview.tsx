// ERPDataReview — wizard Step 2.
// Shows what the ERP resolver pulled vs what's missing, with inline
// override capability for any ERP-sourced value.  Reads the session's
// mapped_fields map; calls submitAnswer() when the user overrides.

import { useState } from 'react';
import { Check, Database, AlertCircle, Edit2 } from 'lucide-react';
import type { MappedField } from '../../services/filingApi';
import { submitAnswer } from '../../services/filingApi';
import SourceBadge from './SourceBadge';
import ProgressBar from './ProgressBar';

interface ERPDataReviewProps {
    filingId: number;
    mappedFields: Record<string, MappedField>;
    completionPct: number;
    estimatedLiability: number | null;
    onContinue: () => void;
    onUpdate: (newMappedFields: Record<string, MappedField>, completionPct: number, estimatedLiability: number | null) => void;
}

// Friendly labels for our field_ids — fallback to the raw id if missing.
const LABELS: Record<string, string> = {
    '1120_line_1a_gross_receipts':   'Gross receipts or sales',
    '1120_line_1b_returns':          'Returns and allowances',
    '1120_line_1c_net_receipts':     'Net receipts',
    '1120_line_2_cogs':              'Cost of goods sold',
    '1120_line_3_gross_profit':      'Gross profit',
    '1120_line_4_dividends':         'Dividends',
    '1120_line_7_total_income':      'Total income',
    '1120_line_12_officer_comp':     'Officer compensation',
    '1120_line_13_salaries':         'Salaries and wages',
    '1120_line_14_repairs':          'Repairs and maintenance',
    '1120_line_15_bad_debts':        'Bad debts',
    '1120_line_16_rents':            'Rents',
    '1120_line_17_taxes':            'Taxes and licenses',
    '1120_line_18_interest':         'Interest',
    '1120_line_20_depreciation':     'Depreciation',
    '1120_line_26_total_deductions': 'Total deductions',
    '1120_line_28_taxable_income':   'Taxable income',
    '1120_line_30_tax':              'Total tax (21%)',
};

function fmt(value: number | string | null): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function ERPDataReview({
    filingId, mappedFields, completionPct, estimatedLiability, onContinue, onUpdate,
}: ERPDataReviewProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftValue, setDraftValue] = useState<string>('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const entries = Object.entries(mappedFields);
    const erpCount = entries.filter(([, m]) => m.source === 'erp').length;
    const calcCount = entries.filter(([, m]) => m.source === 'calculated').length;
    const userCount = entries.filter(([, m]) => m.source === 'user' || m.source === 'user-override').length;
    const missingCount = entries.filter(([, m]) => m.source === 'missing').length;

    const beginEdit = (fid: string, current: number | string | null) => {
        setEditingId(fid);
        setDraftValue(current === null ? '' : String(current));
        setError(null);
    };

    const saveEdit = async (fid: string) => {
        setSavingId(fid);
        setError(null);
        const numeric = parseFloat(draftValue);
        if (isNaN(numeric)) {
            setError('Please enter a valid number.');
            setSavingId(null);
            return;
        }
        const { data, error: apiError } = await submitAnswer(filingId, fid, numeric);
        setSavingId(null);
        if (apiError || !data) {
            setError(apiError || 'Failed to save value.');
            return;
        }
        setEditingId(null);
        onUpdate(data.mapped_fields, data.completion_pct, data.estimated_liability);
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Summary stats */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Database size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-black text-gray-900 tracking-tight">ERP Data Pulled</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            We've connected to your accounting data and resolved as many fields as possible.
                            Review the values below — click any to override.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <StatPill label="From ERP" value={erpCount} color="blue" />
                    <StatPill label="Calculated" value={calcCount} color="purple" />
                    <StatPill label="User Set" value={userCount} color="emerald" />
                    <StatPill label="Missing" value={missingCount} color="rose" />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gray-500 uppercase tracking-wider">Completion</span>
                        <span className="font-mono font-black text-2xl text-orange-700">{completionPct}%</span>
                    </div>
                    <ProgressBar value={completionPct} />
                </div>

                {estimatedLiability !== null && estimatedLiability > 0 && (
                    <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">
                            Estimated Tax Liability So Far
                        </p>
                        <p className="font-mono font-black text-2xl text-orange-700">
                            {fmt(estimatedLiability)}
                        </p>
                    </div>
                )}
            </div>

            {/* Field rows */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Form 1120 Lines · {entries.length}
                    </h3>
                </div>
                <div className="divide-y divide-gray-50">
                    {entries.map(([fid, info]) => {
                        const label = LABELS[fid] || fid;
                        const isEditing = editingId === fid;
                        const canEdit = info.source !== 'calculated';  // Rule 6 — calculated never editable

                        return (
                            <div key={fid} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                                <div className="flex-shrink-0">
                                    {info.source === 'missing' ? (
                                        <AlertCircle size={16} className="text-rose-400" />
                                    ) : (
                                        <Check size={16} className="text-emerald-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">{label}</p>
                                    <p className="text-[10px] text-gray-400 font-mono">{fid}</p>
                                </div>
                                <SourceBadge source={info.source} />
                                {isEditing ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={draftValue}
                                            onChange={e => setDraftValue(e.target.value)}
                                            className="w-32 border border-gray-300 rounded-lg px-2 py-1 text-sm font-mono text-right focus:outline-none focus:border-orange-400"
                                            autoFocus
                                            disabled={savingId === fid}
                                        />
                                        <button
                                            onClick={() => saveEdit(fid)}
                                            disabled={savingId === fid}
                                            className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-black uppercase disabled:opacity-40"
                                        >
                                            {savingId === fid ? '...' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => { setEditingId(null); setError(null); }}
                                            disabled={savingId === fid}
                                            className="px-3 py-1 text-gray-500 hover:text-gray-800 text-xs font-black uppercase"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-mono font-bold text-sm text-gray-900 w-32 text-right">
                                            {fmt(info.value)}
                                        </span>
                                        {canEdit && (
                                            <button
                                                onClick={() => beginEdit(fid, info.value)}
                                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700"
                                                title="Override value"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                        {!canEdit && (
                                            <div className="w-7" />
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-bold text-rose-700">
                    {error}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={onContinue}
                    className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-black uppercase tracking-wide transition-all shadow-md"
                >
                    Continue to Questions →
                </button>
            </div>
        </div>
    );
}


function StatPill({ label, value, color }: { label: string; value: number; color: 'blue' | 'purple' | 'emerald' | 'rose' }) {
    const map = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-100',
    } as const;
    return (
        <div className={`rounded-xl border px-3 py-2 ${map[color]}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
            <p className="font-mono text-lg font-black">{value}</p>
        </div>
    );
}
