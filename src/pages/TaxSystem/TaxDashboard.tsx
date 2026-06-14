// Tax Dashboard — Session 3C.
//
// Replaces the 175-line orphaned mock stub.  Loads real data from
// three backend endpoints on mount:
//   GET /api/v2/filing/dashboard/summary    — 4 stat-card values
//   GET /api/v2/filing/dashboard/upcoming   — top-8 catalog deadlines
//   GET /api/v2/filing/list                 — recent filings (slice top 5)
//
// Layout follows the spec literally:
//   row 1: 4 stat cards
//   row 2: Upcoming Deadlines  |  AI Advisor Preview
//   row 3: Recent Filings table
//   row 4: Top Forms Due table
//
// Card visual language matches the rest of /tax/* (rounded-2xl,
// orange/violet accents, lucide-react icons, font-black headers).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, ArrowRight, Calendar, DollarSign, CheckCircle, Sparkles,
    MessageSquare, FileText, Loader2, AlertCircle, Download,
} from 'lucide-react';
import {
    getDashboardSummary,
    getUpcomingDeadlines,
    getFilingList,
    downloadFilingPdf,
    type DashboardSummary,
    type UpcomingDeadline,
    type FilingListItem,
} from './services/filingApi';


// ─── Currency formatter ─────────────────────────────────────────────


const fmtUSD = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });


// ─── Stat card ──────────────────────────────────────────────────────


interface StatCardProps {
    icon: typeof Calendar;
    title: string;
    value: string;
    subtitle: string;
    accent: 'red' | 'blue' | 'amber' | 'green' | 'purple';
}

const ACCENT: Record<StatCardProps['accent'], { bg: string; iconBg: string; iconText: string; valueText: string }> = {
    red:    { bg: 'bg-rose-50',    iconBg: 'bg-rose-100',    iconText: 'text-rose-600',   valueText: 'text-rose-700' },
    blue:   { bg: 'bg-blue-50',    iconBg: 'bg-blue-100',    iconText: 'text-blue-600',   valueText: 'text-blue-700' },
    amber:  { bg: 'bg-amber-50',   iconBg: 'bg-amber-100',   iconText: 'text-amber-600',  valueText: 'text-amber-700' },
    green:  { bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', valueText: 'text-emerald-700' },
    purple: { bg: 'bg-purple-50',  iconBg: 'bg-purple-100',  iconText: 'text-purple-600', valueText: 'text-purple-700' },
};

function StatCard({ icon: Icon, title, value, subtitle, accent }: StatCardProps) {
    const a = ACCENT[accent];
    return (
        <div className={`${a.bg} border border-gray-100 rounded-2xl p-5 flex flex-col gap-3 shadow-sm`}>
            <div className={`w-10 h-10 ${a.iconBg} rounded-xl flex items-center justify-center`}>
                <Icon size={18} className={a.iconText} />
            </div>
            <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    {title}
                </p>
                <p className={`text-2xl font-black mt-1 ${a.valueText} tracking-tight`}>
                    {value}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}


// ─── Days-remaining colour pill ─────────────────────────────────────
// red < 7, amber < 30, green otherwise.


function daysColour(days: number): { bg: string; text: string; label: string } {
    if (days < 0)  return { bg: 'bg-rose-100',    text: 'text-rose-700',   label: `${Math.abs(days)}d overdue` };
    if (days < 7)  return { bg: 'bg-rose-100',    text: 'text-rose-700',   label: `${days}d left` };
    if (days < 30) return { bg: 'bg-amber-100',   text: 'text-amber-700',  label: `${days}d left` };
    return            { bg: 'bg-emerald-100', text: 'text-emerald-700', label: `${days}d left` };
}


// ─── Status badge for the recent-filings table ──────────────────────


const STATUS_STYLE: Record<string, string> = {
    draft:        'bg-gray-100 text-gray-700',
    in_progress:  'bg-blue-100 text-blue-700',
    ready:        'bg-emerald-100 text-emerald-700',
    submitted:    'bg-violet-100 text-violet-700',
    accepted:     'bg-emerald-100 text-emerald-700',
    rejected:     'bg-rose-100 text-rose-700',
    cancelled:    'bg-gray-100 text-gray-500',
};


// ─── Page component ─────────────────────────────────────────────────


export default function TaxDashboard() {
    const navigate = useNavigate();

    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [upcoming, setUpcoming] = useState<UpcomingDeadline[]>([]);
    const [recent, setRecent] = useState<FilingListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // All three endpoints are independent and can fly in parallel.
        // Failed sub-requests degrade gracefully: the page renders
        // whatever data did load, with a banner if everything failed.
        Promise.all([
            getDashboardSummary(),
            getUpcomingDeadlines(8),
            getFilingList(),
        ]).then(([sumRes, upRes, listRes]) => {
            if (sumRes.data) setSummary(sumRes.data);
            if (upRes.data)  setUpcoming(upRes.data);
            if (listRes.data) setRecent(listRes.data.slice(0, 5));
            const errs = [sumRes.error, upRes.error, listRes.error].filter(Boolean) as string[];
            if (errs.length === 3) setError(errs[0] || 'Could not load dashboard data.');
            setLoading(false);
        });
    }, []);

    // Card 1 — Forms Due This Month.  Red when anything overdue.
    const dueCount    = summary?.forms_due_this_month?.count ?? 0;
    const overdue     = summary?.forms_due_this_month?.overdue ?? 0;
    const dueAccent   = overdue > 0 ? 'red' : 'blue';
    const dueSubtitle = overdue > 0 ? `${overdue} overdue` : 'all on track';

    // Card 2 — Tax Liability This Year.
    const liability   = summary?.tax_liability?.total ?? 0;
    const liabRows    = summary?.tax_liability?.by_form?.length ?? 0;

    // Card 3 — Forms Filed This Year.
    const filedCount  = summary?.forms_filed_this_year?.count ?? 0;

    // Card 4 — Credits Available.
    const credits     = summary?.credits_available?.total_estimated ?? 0;

    const taxYear = summary?.tax_year ?? new Date().getFullYear();

    const advisorChips = useMemo(() => [
        'What is my tax liability?',
        'Which forms do I need to file?',
        'How do I reduce my tax bill?',
    ], []);

    return (
        <div className="space-y-5 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-300">
            {/* Back link */}
            <div>
                <button
                    onClick={() => navigate('/tax')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 transition-all"
                >
                    <ArrowLeft size={14} /> Back to Tax Management
                </button>
            </div>

            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tax Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Live overview of your filings, deadlines, and tax liability.
                    </p>
                </div>
                <div className="px-3 py-1.5 bg-gray-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                    Tax Year {taxYear}
                </div>
            </div>

            {loading && (
                <div className="bg-white border border-gray-100 rounded-2xl p-10 flex items-center justify-center gap-3 text-gray-500">
                    <Loader2 size={18} className="animate-spin" />
                    <span className="text-sm font-medium">Loading dashboard data…</span>
                </div>
            )}

            {error && !loading && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {!loading && (
                <>
                    {/* Row 1 — Stat cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={Calendar}
                            title="Forms Due This Month"
                            value={String(dueCount)}
                            subtitle={dueSubtitle}
                            accent={dueAccent}
                        />
                        <StatCard
                            icon={DollarSign}
                            title="Tax Liability This Year"
                            value={fmtUSD(liability)}
                            subtitle={`across ${liabRows} filing${liabRows === 1 ? '' : 's'}`}
                            accent="amber"
                        />
                        <StatCard
                            icon={CheckCircle}
                            title="Forms Filed This Year"
                            value={String(filedCount)}
                            subtitle="ready or submitted"
                            accent="green"
                        />
                        <StatCard
                            icon={Sparkles}
                            title="Credits Available"
                            value={fmtUSD(credits)}
                            subtitle="estimated savings"
                            accent="purple"
                        />
                    </div>

                    {/* Row 2 — Upcoming Deadlines  |  AI Advisor */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Upcoming deadlines widget */}
                        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Calendar size={15} className="text-gray-400" />
                                    Upcoming Deadlines
                                </h2>
                                <button
                                    onClick={() => navigate('/tax/forms')}
                                    className="text-[10px] font-black text-gray-400 hover:text-gray-700 uppercase tracking-widest flex items-center gap-1"
                                >
                                    View all <ArrowRight size={11} />
                                </button>
                            </div>
                            {upcoming.length === 0 ? (
                                <div className="px-6 py-8 text-sm text-gray-400 text-center">
                                    No upcoming deadlines to show.
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-50">
                                    {upcoming.slice(0, 5).map(d => {
                                        const c = daysColour(d.days_remaining);
                                        return (
                                            <li key={d.form_id} className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-black text-gray-900 truncate">{d.name}</p>
                                                    <p className="text-[11px] text-gray-500 truncate">Due {d.deadline}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap ${c.bg} ${c.text}`}>
                                                    {c.label}
                                                </span>
                                                {d.can_auto_file ? (
                                                    <button
                                                        onClick={() => navigate(`/tax/filing/new?form_type=${d.form_id}`)}
                                                        className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all whitespace-nowrap"
                                                    >
                                                        Start Filing
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg whitespace-nowrap">
                                                        Coming Soon
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>

                        {/* AI Advisor preview */}
                        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                                    <MessageSquare size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-gray-900">Ask our Tax Advisor</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Powered by Claude AI</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {advisorChips.map(q => (
                                    <button
                                        key={q}
                                        onClick={() => navigate('/tax/advisor')}
                                        className="text-left text-xs px-3 py-2 bg-white/70 hover:bg-white border border-violet-200 hover:border-violet-300 rounded-lg text-gray-700 hover:text-violet-700 transition-all font-medium"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => navigate('/tax/advisor')}
                                className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black uppercase tracking-wide transition-all"
                            >
                                Open Tax Advisor <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Row 3 — Recent Filings */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <FileText size={15} className="text-gray-400" />
                                Recent Filings
                            </h2>
                            <button
                                onClick={() => navigate('/tax/filing')}
                                className="text-[10px] font-black text-gray-400 hover:text-gray-700 uppercase tracking-widest flex items-center gap-1"
                            >
                                View all <ArrowRight size={11} />
                            </button>
                        </div>
                        {recent.length === 0 ? (
                            <div className="px-6 py-8 text-sm text-gray-400 text-center">
                                No filings yet.{' '}
                                <button
                                    onClick={() => navigate('/tax/filing/new')}
                                    className="text-orange-600 hover:underline font-black"
                                >
                                    Start your first filing →
                                </button>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/60 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        <th className="text-left px-6 py-3">Form</th>
                                        <th className="text-left px-6 py-3">Year</th>
                                        <th className="text-left px-6 py-3">Status</th>
                                        <th className="text-right px-6 py-3">Tax Liability</th>
                                        <th className="text-right px-6 py-3">Completion</th>
                                        <th className="text-right px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {recent.map(f => {
                                        const liab = f.tax_liability ?? f.estimated_liability ?? null;
                                        const badge = STATUS_STYLE[f.status] || 'bg-gray-100 text-gray-600';
                                        return (
                                            <tr key={f.filing_id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-6 py-3 font-black text-gray-900">
                                                    {f.form_type.toUpperCase().replace('_', ' ')}
                                                </td>
                                                <td className="px-6 py-3 font-mono text-gray-600">{f.tax_year}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${badge}`}>
                                                        {f.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono">
                                                    {liab != null ? fmtUSD(liab) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-6 py-3 text-right font-mono text-gray-600">
                                                    {f.completion_pct != null ? `${Math.round(f.completion_pct)}%` : '—'}
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/tax/filing/wizard/${f.filing_id}`)}
                                                            className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-all"
                                                            title={f.status === 'draft' || f.status === 'in_progress' ? 'Resume filing' : 'View filing'}
                                                        >
                                                            {f.status === 'draft' || f.status === 'in_progress' ? 'Resume' : 'View'}
                                                        </button>
                                                        {f.pdf_url && (
                                                            <FilingPdfDownloadButton filing={f} />
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Row 4 — Top Forms Due (catalog) */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={15} className="text-gray-400" />
                                Top Forms Due (from 96-form catalog)
                            </h2>
                            <button
                                onClick={() => navigate('/tax/forms')}
                                className="text-[10px] font-black text-gray-400 hover:text-gray-700 uppercase tracking-widest flex items-center gap-1"
                            >
                                View all 96 forms <ArrowRight size={11} />
                            </button>
                        </div>
                        {upcoming.length === 0 ? (
                            <div className="px-6 py-8 text-sm text-gray-400 text-center">
                                No upcoming deadlines to show.
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/60 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        <th className="text-left px-6 py-3">Form</th>
                                        <th className="text-left px-6 py-3">Deadline</th>
                                        <th className="text-left px-6 py-3">Days Left</th>
                                        <th className="text-right px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {upcoming.map(d => {
                                        const c = daysColour(d.days_remaining);
                                        return (
                                            <tr key={d.form_id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-6 py-3">
                                                    <p className="font-black text-gray-900">{d.name}</p>
                                                    <p className="text-[11px] text-gray-500">{d.full_name}</p>
                                                </td>
                                                <td className="px-6 py-3 text-gray-600">{d.deadline}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap ${c.bg} ${c.text}`}>
                                                        {c.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    {d.can_auto_file ? (
                                                        <button
                                                            onClick={() => navigate(`/tax/filing/new?form_type=${d.form_id}`)}
                                                            className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all"
                                                        >
                                                            Auto-File
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-gray-100 text-gray-400 rounded-lg">
                                                            Coming Soon
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}


function FilingPdfDownloadButton({ filing }: { filing: FilingListItem }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClick = async () => {
        setError(null);
        setBusy(true);
        const { error: dlError } = await downloadFilingPdf({
            filingId: filing.filing_id,
            pdfUrl: filing.pdf_url,
            filename: `form_${filing.form_type}_${filing.tax_year}_${filing.filing_id}.pdf`,
        });
        setBusy(false);
        if (dlError) setError(dlError);
    };

    return (
        <div className="flex flex-col items-end gap-0.5">
            <button
                type="button"
                onClick={handleClick}
                disabled={busy}
                title={error ?? undefined}
                className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 text-blue-700 rounded-md transition-all flex items-center gap-1"
            >
                {busy ? <Loader2 size={9} className="animate-spin" /> : <Download size={9} />}
                {busy ? '…' : 'PDF'}
            </button>
            {error && (
                <span className="text-[9px] font-bold text-rose-600 max-w-[120px] text-right leading-tight">
                    {error}
                </span>
            )}
        </div>
    );
}
