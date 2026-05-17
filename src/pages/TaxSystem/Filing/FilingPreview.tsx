// FilingPreview — read-only review of a completed filing.
// /tax/filing/preview/:filingId
// Shows full form lines + warnings + tax summary + Download PDF + Amend.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Download, Edit3, Loader2, AlertCircle,
    FileText, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
    getPreview, pdfDownloadUrl,
    type PreviewResponse, type FilingStatus,
} from '../services/filingApi';
import SourceBadge from './components/SourceBadge';
import ProgressBar from './components/ProgressBar';


const STATUS_BADGE: Record<FilingStatus, { bg: string; text: string; label: string }> = {
    draft:       { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'Draft' },
    in_progress: { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'In Progress' },
    ready:       { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready to File' },
    submitted:   { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Submitted' },
    accepted:    { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'IRS Accepted' },
    rejected:    { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'IRS Rejected' },
    cancelled:   { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelled' },
};


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


export default function FilingPreview() {
    const navigate = useNavigate();
    const params = useParams<{ filingId: string }>();
    const filingId = Number(params.filingId);

    const [preview, setPreview] = useState<PreviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!filingId || isNaN(filingId)) {
            setError('Invalid filing ID.');
            setLoading(false);
            return;
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filingId]);

    const load = async () => {
        setLoading(true);
        setError(null);
        const { data, error: apiError } = await getPreview(filingId);
        setLoading(false);
        if (apiError || !data) {
            setError(apiError || 'Could not load filing preview.');
            return;
        }
        setPreview(data);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !preview) {
        return (
            <div className="max-w-2xl mx-auto pt-10">
                <button onClick={() => navigate('/tax/filing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-4">
                    <ArrowLeft size={14} /> Back to filings
                </button>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-rose-600 mt-0.5" />
                    <div>
                        <h2 className="text-sm font-black text-rose-900 uppercase mb-1">Could not load preview</h2>
                        <p className="text-sm text-rose-700">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const badge = STATUS_BADGE[preview.status] ?? STATUS_BADGE.draft;
    const taxLine = preview.lines.find(l => l.field_id === '1120_line_30_tax');
    const tax = typeof taxLine?.value === 'number' ? taxLine.value : null;

    return (
        <div className="space-y-5 max-w-3xl mx-auto pb-10 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate('/tax/filing')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3"
                >
                    <ArrowLeft size={14} /> Back to filings
                </button>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                            <FileText size={22} className="text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                Form {preview.form_type} · Tax Year {preview.tax_year}
                            </h1>
                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                Filing #{preview.filing_id}
                            </p>
                        </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                    </span>
                </div>

                <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                            <span>Completion</span>
                            <span className="text-orange-700 font-mono text-base">{preview.completion_pct}%</span>
                        </div>
                        <ProgressBar value={preview.completion_pct} />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-50 flex-wrap">
                    <a
                        href={pdfDownloadUrl(preview.filing_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wide"
                    >
                        <Download size={14} /> Download PDF
                    </a>
                    {(preview.status === 'ready' || preview.status === 'accepted') && (
                        <button
                            onClick={() => navigate(`/tax/filing/wizard/${preview.filing_id}`)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 rounded-xl text-xs font-black uppercase tracking-wide"
                        >
                            <Edit3 size={14} /> Amend
                        </button>
                    )}
                </div>
            </div>

            {/* Warnings */}
            {preview.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-3">
                        <AlertTriangle size={20} className="text-amber-700 flex-shrink-0 mt-0.5" />
                        <h3 className="text-sm font-black text-amber-900 uppercase tracking-wider">
                            Warnings ({preview.warnings.length})
                        </h3>
                    </div>
                    <ul className="space-y-2">
                        {preview.warnings.map((w, idx) => (
                            <li key={idx} className="text-sm text-amber-900 leading-relaxed flex items-start gap-2">
                                <span className="text-amber-600 mt-0.5">•</span>
                                <span>{w}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Schedule L info */}
            {!preview.schedule_l_required && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-emerald-800">
                        Schedule L not required (receipts under $250k threshold).
                    </p>
                </div>
            )}

            {/* Form lines */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Form Lines · {preview.lines.length}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                {['Field ID', 'Label', 'Value', 'Source'].map(h => (
                                    <th key={h} className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {preview.lines.map(line => (
                                <tr key={line.field_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-[10px] text-gray-400">{line.field_id}</td>
                                    <td className="px-4 py-3 text-sm text-gray-800">{LABELS[line.field_id] || line.field_id}</td>
                                    <td className="px-4 py-3 text-sm font-mono font-bold text-right">{fmt(line.value)}</td>
                                    <td className="px-4 py-3">
                                        <SourceBadge source={line.source} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Final tax summary */}
            {tax !== null && (
                <div className="bg-gray-900 rounded-2xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                Estimated Tax Liability
                            </p>
                            <p className="font-mono font-black text-3xl text-orange-300">
                                {fmt(tax)}
                            </p>
                        </div>
                        {preview.deduction_opportunities.length > 0 && (
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                    Deduction Opportunities
                                </p>
                                <p className="font-mono font-black text-lg text-emerald-300">
                                    {preview.deduction_opportunities.length} flagged
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
