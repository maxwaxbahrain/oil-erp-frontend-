// SubmitStep — wizard Step 5 (final).
// Shows final summary, requires user to acknowledge every warning,
// generates PDF on demand, finalizes the filing via POST /submit,
// shows success state with download buttons.

import { useState } from 'react';
import { CheckCircle2, Download, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import {
    submitFiling,
    generatePdf,
    pdfDownloadUrl,
    type SubmitResponse,
    type PdfGenerationResponse,
} from '../../services/filingApi';
import { useNavigate } from 'react-router-dom';

interface SubmitStepProps {
    filingId: number;
    formType: string;
    taxYear: number;
    entityEin: string;
    estimatedLiability: number | null;
    warnings: string[];
}

function fmt(value: number | null): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function SubmitStep({
    filingId, formType, taxYear, entityEin, estimatedLiability, warnings,
}: SubmitStepProps) {
    const navigate = useNavigate();
    const [acked, setAcked] = useState<Set<number>>(new Set());
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfResult, setPdfResult] = useState<PdfGenerationResponse | null>(null);
    const [submitBusy, setSubmitBusy] = useState(false);
    const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const allAcked = warnings.length === 0 || acked.size === warnings.length;

    const toggleAck = (idx: number) => {
        setAcked(prev => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const handleGeneratePdf = async () => {
        setError(null);
        setPdfBusy(true);
        const { data, error: apiError } = await generatePdf(filingId);
        setPdfBusy(false);
        if (apiError || !data) {
            setError(apiError || 'PDF generation failed.');
            return;
        }
        setPdfResult(data);
    };

    const handleSubmit = async () => {
        if (!allAcked) {
            setError('Please acknowledge every warning before submitting.');
            return;
        }
        setError(null);
        setSubmitBusy(true);
        const { data, error: apiError } = await submitFiling(filingId, true, true);
        setSubmitBusy(false);
        if (apiError || !data) {
            setError(apiError || 'Submit failed.');
            return;
        }
        setSubmitResult(data);
    };

    // ─── Success view ───────────────────────────────────────────────
    if (submitResult) {
        return (
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center space-y-5 animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={48} className="text-emerald-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-1">
                        Filing Complete
                    </h2>
                    <p className="text-sm text-gray-500">
                        Status: <span className="font-black text-emerald-700">Ready for Filing</span>
                    </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 space-y-2 max-w-md mx-auto">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-bold">Form</span>
                        <span className="font-mono font-black">Form {submitResult.session_id ? formType : formType} · {taxYear}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-bold">Entity</span>
                        <span className="font-mono font-black">{entityEin}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500 font-bold">Tax Liability</span>
                        <span className="font-mono font-black text-orange-700">
                            {fmt(submitResult.tax_liability)}
                        </span>
                    </div>
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                    {submitResult.pdf_url && (
                        <a
                            href={pdfDownloadUrl(filingId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black uppercase tracking-wide transition-all shadow-md"
                        >
                            <Download size={16} /> Download PDF
                        </a>
                    )}
                    <button
                        onClick={() => navigate('/tax/filing')}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-black uppercase tracking-wide transition-all"
                    >
                        Back to Filings
                    </button>
                </div>

                <p className="text-xs text-gray-400 italic max-w-md mx-auto">
                    E-file coming soon.  For now, download the PDF for paper filing or hand off to your professional e-filer.
                </p>
            </div>
        );
    }

    // ─── Pre-submit view ────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Final summary */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={20} className="text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-gray-900 tracking-tight">
                            Form {formType} — Tax Year {taxYear}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            Entity: {entityEin}
                        </p>
                    </div>
                </div>

                <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-4 mb-4">
                    <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">
                        Final Tax Liability
                    </p>
                    <p className="font-mono font-black text-3xl text-orange-700">
                        {fmt(estimatedLiability)}
                    </p>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Status</span>
                    <span className="inline-flex items-center px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                        Ready to File
                    </span>
                </div>
            </div>

            {/* Warnings to acknowledge */}
            {warnings.length > 0 && (
                <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={20} className="text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                                Acknowledge Warnings ({acked.size}/{warnings.length})
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                You must acknowledge each warning before submitting.
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {warnings.map((w, idx) => (
                            <label
                                key={idx}
                                className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl cursor-pointer hover:bg-amber-100"
                            >
                                <input
                                    type="checkbox"
                                    checked={acked.has(idx)}
                                    onChange={() => toggleAck(idx)}
                                    className="mt-0.5 w-4 h-4 accent-amber-600"
                                />
                                <p className="text-sm text-gray-800 leading-relaxed">{w}</p>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                    Generate &amp; Submit
                </h3>

                {/* Generate PDF first */}
                {pdfResult ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                            <CheckCircle2 size={16} /> PDF Ready ·{' '}
                            <span className="font-mono">{(pdfResult.file_size / 1024).toFixed(0)} KB</span>
                        </div>
                        <a
                            href={pdfDownloadUrl(filingId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase"
                        >
                            <Download size={14} /> Download
                        </a>
                    </div>
                ) : (
                    <button
                        onClick={handleGeneratePdf}
                        disabled={pdfBusy}
                        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-orange-300 hover:bg-orange-50 disabled:opacity-40 text-orange-700 rounded-xl text-sm font-black uppercase tracking-wide transition-all"
                    >
                        {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {pdfBusy ? 'Generating PDF…' : 'Generate PDF Preview'}
                    </button>
                )}

                {/* Submit (transitions status, optionally regenerates PDF) */}
                <button
                    onClick={handleSubmit}
                    disabled={submitBusy || !allAcked}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-black uppercase tracking-wide transition-all shadow-md"
                >
                    {submitBusy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {submitBusy ? 'Submitting…' : 'Submit Filing'}
                </button>
                {!allAcked && warnings.length > 0 && (
                    <p className="text-xs text-amber-700 text-center">
                        Acknowledge all {warnings.length} warning{warnings.length === 1 ? '' : 's'} above to enable submit.
                    </p>
                )}
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-bold text-rose-700 flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}
        </div>
    );
}
