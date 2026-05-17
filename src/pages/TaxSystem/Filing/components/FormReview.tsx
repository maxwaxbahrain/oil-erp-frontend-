// FormReview — wizard Step 4.
// Table of all 18 form lines with inline-edit, plus deduction
// opportunities (green box, checkboxes per opportunity), plus tax
// summary footer (taxable income / tax / balance due).

import { useState } from 'react';
import { Edit2, Tag, AlertCircle } from 'lucide-react';
import type { MappedField, DeductionOpportunity } from '../../services/filingApi';
import { submitAnswer } from '../../services/filingApi';
import SourceBadge from './SourceBadge';

interface FormReviewProps {
    filingId: number;
    mappedFields: Record<string, MappedField>;
    deductionOpportunities: DeductionOpportunity[];
    estimatedLiability: number | null;
    onContinue: () => void;
    onUpdate: (newMappedFields: Record<string, MappedField>, estimatedLiability: number | null) => void;
}

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

const LINE_NUMS: Record<string, string> = {
    '1120_line_1a_gross_receipts':   '1a',
    '1120_line_1b_returns':          '1b',
    '1120_line_1c_net_receipts':     '1c',
    '1120_line_2_cogs':              '2',
    '1120_line_3_gross_profit':      '3',
    '1120_line_4_dividends':         '4',
    '1120_line_7_total_income':      '11',
    '1120_line_12_officer_comp':     '12',
    '1120_line_13_salaries':         '13',
    '1120_line_14_repairs':          '14',
    '1120_line_15_bad_debts':        '15',
    '1120_line_16_rents':            '16',
    '1120_line_17_taxes':            '17',
    '1120_line_18_interest':         '18',
    '1120_line_20_depreciation':     '20',
    '1120_line_26_total_deductions': '27',
    '1120_line_28_taxable_income':   '28',
    '1120_line_30_tax':              '31',
};

function fmt(value: number | string | null): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function FormReview({
    filingId, mappedFields, deductionOpportunities, onContinue, onUpdate,
    // estimatedLiability is in props for symmetry with the other step components
    // but FormReview computes the summary from mapped_fields directly.
}: FormReviewProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftValue, setDraftValue] = useState<string>('');
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmedDeductions, setConfirmedDeductions] = useState<Set<string>>(new Set());

    const taxable = mappedFields['1120_line_28_taxable_income']?.value;
    const tax = mappedFields['1120_line_30_tax']?.value;
    const balance = typeof tax === 'number' ? tax : null;

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
        onUpdate(data.mapped_fields, data.estimated_liability);
    };

    const toggleDeduction = (kind: string) => {
        setConfirmedDeductions(prev => {
            const next = new Set(prev);
            if (next.has(kind)) next.delete(kind);
            else next.add(kind);
            return next;
        });
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Form lines table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Form 1120 Lines · Review Before Submission
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Click any value to edit.  Calculated rows update automatically.
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['Line', 'Label', 'Value', 'Source', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {Object.entries(mappedFields).map(([fid, info]) => {
                                const label = LABELS[fid] || fid;
                                const lineNo = LINE_NUMS[fid] || '—';
                                const isEditing = editingId === fid;
                                const canEdit = info.source !== 'calculated';
                                return (
                                    <tr key={fid} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono font-black text-gray-700 text-xs">{lineNo}</td>
                                        <td className="px-4 py-3 text-sm text-gray-800">{label}</td>
                                        <td className="px-4 py-3 text-right">
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 justify-end">
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
                                                        className="px-2 py-1 bg-orange-500 text-white rounded text-[10px] font-black uppercase disabled:opacity-40"
                                                    >
                                                        {savingId === fid ? '…' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingId(null); setError(null); }}
                                                        disabled={savingId === fid}
                                                        className="text-[10px] text-gray-500 hover:text-gray-800 font-black uppercase"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="font-mono font-bold text-gray-900">{fmt(info.value)}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <SourceBadge source={info.source} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {!isEditing && canEdit && (
                                                <button
                                                    onClick={() => beginEdit(fid, info.value)}
                                                    className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-500 hover:text-blue-700"
                                                    title="Edit value"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Deduction opportunities */}
            {deductionOpportunities.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Tag size={20} className="text-emerald-700" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-emerald-900 uppercase tracking-wider">
                                Potential Deductions — Review
                            </h3>
                            <p className="text-xs text-emerald-700 mt-0.5">
                                These were flagged by our scanner.  Confirm each one you plan to claim.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {deductionOpportunities.map(opp => (
                            <label
                                key={opp.deduction_type}
                                className="flex items-start gap-3 p-3 bg-white border border-emerald-100 rounded-xl cursor-pointer hover:bg-emerald-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={confirmedDeductions.has(opp.deduction_type)}
                                    onChange={() => toggleDeduction(opp.deduction_type)}
                                    className="mt-0.5 w-4 h-4 accent-emerald-600"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-black text-gray-900">{opp.description}</p>
                                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">{opp.rationale}</p>
                                    {opp.estimated_value !== null && (
                                        <p className="text-xs font-mono font-black text-emerald-700 mt-1">
                                            Estimated: {fmt(opp.estimated_value)}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-gray-500 italic mt-1">{opp.action_required}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Tax summary */}
            <div className="bg-gray-900 rounded-2xl p-5 text-white">
                <div className="grid grid-cols-3 gap-4">
                    <SummaryStat label="Taxable Income" value={fmt(taxable ?? null)} />
                    <SummaryStat label="Tax at 21%" value={fmt(tax ?? null)} accent="orange" />
                    <SummaryStat
                        label="Balance Due"
                        value={fmt(balance)}
                        accent={balance && balance > 0 ? 'rose' : 'emerald'}
                    />
                </div>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    onClick={onContinue}
                    className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-black uppercase tracking-wide transition-all shadow-md"
                >
                    Continue to Submit →
                </button>
            </div>
        </div>
    );
}


function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: 'orange' | 'rose' | 'emerald' }) {
    const valueClass = accent === 'orange'
        ? 'text-orange-300'
        : accent === 'rose'
            ? 'text-rose-300'
            : accent === 'emerald'
                ? 'text-emerald-300'
                : 'text-white';
    return (
        <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className={`font-mono font-black text-xl ${valueClass}`}>{value}</p>
        </div>
    );
}

// Also need estimatedLiability prop pass-through hint
export type { FormReviewProps };
