// TaxFilingList — landing page for /tax/filing.
//
// Replaces the mocked TaxFiling.tsx stub from Session 1E era.  Pulls
// real filings from GET /api/v2/filing/list and renders them as cards
// with status badge, completion bar, action buttons (Resume / View /
// Download PDF / Amend).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Plus, RefreshCw, FileText, Download,
    ExternalLink, Edit3, AlertCircle, Loader2, Calendar,
} from 'lucide-react';
import {
    getFilingList,
    downloadFilingPdf,
    type FilingListItem,
    type FilingStatus,
} from '../services/filingApi';
import ProgressBar from './components/ProgressBar';


export default function TaxFilingList() {
    const navigate = useNavigate();
    const [filings, setFilings] = useState<FilingListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { reload(); }, []);

    const reload = async () => {
        setLoading(true);
        setError(null);
        const { data, error: apiError } = await getFilingList();
        setLoading(false);
        if (apiError) {
            setError(apiError);
            return;
        }
        setFilings(data || []);
    };

    return (
        <div className="space-y-6 max-w-[1100px] mx-auto pb-10 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate('/tax')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"
                >
                    <ArrowLeft size={14} /> Back to Tax
                </button>
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center">
                            <FileText size={22} className="text-orange-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                Tax Filings
                            </h1>
                            <p className="text-xs text-gray-500 mt-1">
                                Federal income tax returns — drafts, in-progress, and submitted filings.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={reload}
                            disabled={loading}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide"
                        >
                            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button
                            onClick={() => navigate('/tax/filing/new')}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wide shadow-md"
                        >
                            <Plus size={14} /> Start New Filing
                        </button>
                    </div>
                </div>
            </div>

            {/* Filings list */}
            {loading ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400">
                    <Loader2 size={28} className="animate-spin mx-auto mb-2" />
                    <p className="font-bold text-sm">Loading filings…</p>
                </div>
            ) : error ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-rose-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h2 className="text-sm font-black text-rose-900 uppercase mb-1">Could not load filings</h2>
                        <p className="text-sm text-rose-700">{error}</p>
                    </div>
                    <button onClick={reload} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase">
                        Retry
                    </button>
                </div>
            ) : filings.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
                    <FileText size={32} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 font-bold uppercase text-sm">No filings yet</p>
                    <p className="text-gray-400 text-xs mt-1">Click "Start New Filing" above to begin your first one.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filings.map(f => (
                        <FilingCard key={f.filing_id} filing={f} onAction={reload} />
                    ))}
                </div>
            )}
        </div>
    );
}


// ─── Per-filing card ─────────────────────────────────────────────────


const STATUS_BADGE: Record<FilingStatus, { bg: string; text: string; label: string }> = {
    draft:       { bg: 'bg-gray-100',    text: 'text-gray-700',    label: 'Draft' },
    in_progress: { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'In Progress' },
    ready:       { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready to File' },
    submitted:   { bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Submitted' },
    accepted:    { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'IRS Accepted' },
    rejected:    { bg: 'bg-rose-100',    text: 'text-rose-700',    label: 'IRS Rejected' },
    cancelled:   { bg: 'bg-gray-100',    text: 'text-gray-500',    label: 'Cancelled' },
};


function FilingCard({ filing }: { filing: FilingListItem; onAction: () => void }) {
    const navigate = useNavigate();
    const [pdfBusy, setPdfBusy] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const badge = STATUS_BADGE[filing.status] ?? STATUS_BADGE.draft;
    const canResume = filing.status === 'in_progress' || filing.status === 'draft';
    const canView = filing.status === 'ready' || filing.status === 'submitted' || filing.status === 'accepted';
    const canAmend = filing.status === 'ready' || filing.status === 'accepted';
    const created = filing.created_at ? new Date(filing.created_at).toLocaleDateString() : '—';

    const handlePdfDownload = async () => {
        setPdfError(null);
        setPdfBusy(true);
        const { error } = await downloadFilingPdf({
            filingId: filing.filing_id,
            pdfUrl: filing.pdf_url,
            filename: `form_${filing.form_type}_${filing.tax_year}_${filing.filing_id}.pdf`,
        });
        setPdfBusy(false);
        if (error) setPdfError(error);
    };

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileText size={20} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                                Form {filing.form_type} · {filing.tax_year}
                            </h3>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                {badge.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                            <span className="flex items-center gap-1">
                                <Calendar size={12} /> Created {created}
                            </span>
                            <span className="font-mono">#{filing.filing_id}</span>
                        </div>
                        <div className="max-w-md">
                            <div className="flex items-center gap-2 text-xs mb-1">
                                <span className="font-bold text-gray-500 uppercase tracking-wider">Completion</span>
                                <span className="font-mono font-black text-gray-700">{filing.completion_pct}%</span>
                            </div>
                            <ProgressBar value={filing.completion_pct} />
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    {filing.estimated_liability !== null && filing.estimated_liability > 0 && (
                        <>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                                Tax Liability
                            </p>
                            <p className="font-mono font-black text-lg text-orange-700">
                                {filing.estimated_liability.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                            </p>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-50 flex-wrap">
                {canResume && (
                    <button
                        onClick={() => navigate(`/tax/filing/wizard/${filing.filing_id}`)}
                        className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-2"
                    >
                        Resume <ExternalLink size={12} />
                    </button>
                )}
                {canView && (
                    <button
                        onClick={() => navigate(`/tax/filing/preview/${filing.filing_id}`)}
                        className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-2"
                    >
                        View Details
                    </button>
                )}
                {filing.pdf_url && (
                    <div className="flex flex-col items-end gap-1">
                        <button
                            type="button"
                            onClick={handlePdfDownload}
                            disabled={pdfBusy}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-2"
                        >
                            {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            {pdfBusy ? 'Downloading…' : 'PDF'}
                        </button>
                        {pdfError && (
                            <p className="text-[10px] font-bold text-rose-600 max-w-[200px] text-right">{pdfError}</p>
                        )}
                    </div>
                )}
                {canAmend && (
                    <button
                        onClick={() => navigate(`/tax/filing/wizard/${filing.filing_id}`)}
                        className="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 rounded-xl text-xs font-black uppercase tracking-wide flex items-center gap-2"
                    >
                        <Edit3 size={12} /> Amend
                    </button>
                )}
            </div>
        </div>
    );
}
