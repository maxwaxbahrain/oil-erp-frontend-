import { useNavigate } from 'react-router-dom';
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
    ArrowLeft,
    BookOpen,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Download,
    Printer,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../services/settingsService';
import {
    downloadDayBookCsv,
    getDayBook,
    getGLAccounts,
    type DayBookEntry,
    type DayBookQuery,
    type DayBookResponse,
    type DayBookSummary,
    type GLAccount,
} from '../../services/glService';

const RANGE_TOO_WIDE = 'Date range cannot exceed 92 days';
const RANGE_BACKWARDS = 'end_date must be on or after start_date';

const GROUP_CARDS: Array<{ label: string; groups: string[] }> = [
    { label: 'Sales', groups: ['sales'] },
    { label: 'Receipts', groups: ['receipts'] },
    { label: 'Purchases', groups: ['purchases'] },
    { label: 'Payments + Expenses', groups: ['payments', 'expenses'] },
    { label: 'Bank', groups: ['bank'] },
    { label: 'Journal', groups: ['journal'] },
];

function localTodayISO(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function parseISO(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

function isoAddDays(iso: string, days: number): string {
    const dt = new Date(parseISO(iso));
    dt.setUTCDate(dt.getUTCDate() + days);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Inclusive day count. Same-day range is 1. */
function inclusiveSpan(start: string, end: string): number {
    return Math.round((parseISO(end) - parseISO(start)) / 86400000) + 1;
}

function rangeError(start: string, end: string): string | null {
    if (end < start) return RANGE_BACKWARDS;
    if (parseISO(end) - parseISO(start) > 92 * 86400000) return RANGE_TOO_WIDE;
    return null;
}

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Could not load ledger data.';
}

function timeLabel(createdAt: string | null): string {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function groupBadgeClass(group: string): string {
    switch (group) {
        case 'sales':
            return 'bg-blue-100 text-blue-700';
        case 'receipts':
            return 'bg-emerald-100 text-emerald-700';
        case 'purchases':
            return 'bg-orange-100 text-orange-700';
        case 'payments':
            return 'bg-amber-100 text-amber-800';
        case 'expenses':
            return 'bg-rose-100 text-rose-700';
        case 'bank':
            return 'bg-cyan-100 text-cyan-800';
        default:
            return 'bg-purple-100 text-purple-700';
    }
}

function groupTotals(summary: DayBookSummary, groups: string[]): { count: number; total: number } {
    const rows = summary.by_type.filter((row) => groups.includes(row.group));
    return {
        count: rows.reduce((sum, row) => sum + row.count, 0),
        total: rows.reduce((sum, row) => sum + row.total_amount, 0),
    };
}

const errorBanner: CSSProperties = {
    background: 'rgba(239,68,68,.08)',
    border: '1px solid rgba(239,68,68,.35)',
    borderRadius: '10px',
    padding: '10px 12px',
    color: 'var(--color-brand-red-tint)',
    fontSize: 11,
    fontWeight: 600,
};

export default function DayBook() {
    const navigate = useNavigate();
    const today = localTodayISO();
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [sourceType, setSourceType] = useState('');
    const [accountId, setAccountId] = useState<number | undefined>(undefined);
    const [accounts, setAccounts] = useState<GLAccount[] | null>(null);
    const [book, setBook] = useState<DayBookResponse | null>(null);
    const [typeOptions, setTypeOptions] = useState<DayBookSummary['by_type']>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [expandAll, setExpandAll] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getGLAccounts()
            .then((rows) => {
                if (!cancelled) setAccounts(rows);
            })
            .catch(() => {
                if (!cancelled) setAccounts(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const problem = rangeError(startDate, endDate);
        if (problem) {
            setBook(null);
            setError(problem);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        const query: DayBookQuery = {
            startDate,
            endDate,
            ...(sourceType ? { sourceType } : {}),
            ...(accountId != null ? { accountId } : {}),
        };
        getDayBook(query)
            .then((data) => {
                if (cancelled) return;
                setBook(data);
                setTypeOptions((prev) => {
                    const map = new Map(prev.map((row) => [row.source_type, row]));
                    for (const row of data.summary.by_type) {
                        if (row.source_type) map.set(row.source_type, row);
                    }
                    return Array.from(map.values());
                });
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setBook(null);
                setError(errorMessage(err));
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [startDate, endDate, sourceType, accountId]);

    const multiDay = startDate !== endDate;
    const entries = book?.entries ?? [];
    const summary = book?.summary;

    const entriesByDay = useMemo(() => {
        const groups = new Map<string, DayBookEntry[]>();
        for (const entry of entries) {
            const key = entry.entry_date || '';
            const list = groups.get(key) ?? [];
            list.push(entry);
            groups.set(key, list);
        }
        return groups;
    }, [entries]);

    const dayOrder = summary?.by_day?.length
        ? summary.by_day.map((day) => day.date)
        : Array.from(entriesByDay.keys());

    const isExpanded = (id: number) => expandAll || expanded.has(id);

    const toggleRow = (id: number) => {
        setExpandAll(false);
        setExpanded((prev) => {
            const next = new Set(expandAll ? new Set(entries.map((entry) => entry.id)) : prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const shiftRange = (direction: -1 | 1) => {
        const span = Math.max(1, inclusiveSpan(startDate, endDate));
        const delta = direction * (startDate === endDate ? 1 : span);
        setStartDate(isoAddDays(startDate, delta));
        setEndDate(isoAddDays(endDate, delta));
        setLoading(true);
    };

    const queryForExport = (): DayBookQuery => ({
        startDate,
        endDate,
        ...(sourceType ? { sourceType } : {}),
        ...(accountId != null ? { accountId } : {}),
    });

    const handlePrint = () => window.print();

    const handleCsv = () => {
        downloadDayBookCsv(queryForExport()).catch((err: unknown) => setError(errorMessage(err)));
    };

    const exportPDF = () => {
        if (!summary) return;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Day Book Report', 14, 16);
        doc.setFontSize(10);
        doc.text(`Range: ${startDate} → ${endDate}`, 14, 22);
        doc.text(
            `${summary.entry_count} vouchers · Period amount: ${formatCurrency(summary.total_amount)} · Ledger Dr ${formatCurrency(summary.total_debit)} / Cr ${formatCurrency(summary.total_credit)}`,
            14,
            28,
        );
        const body: string[][] = [];
        for (const entry of entries) {
            body.push([
                timeLabel(entry.created_at),
                entry.voucher_type,
                entry.entry_number,
                entry.party_name || '—',
                entry.memo || '',
                formatCurrency(entry.amount),
                '',
                '',
            ]);
            for (const line of entry.lines) {
                body.push([
                    '',
                    '',
                    line.account_code || '',
                    line.account_name || '',
                    line.memo || '',
                    '',
                    line.debit > 0 ? formatCurrency(line.debit) : '—',
                    line.credit > 0 ? formatCurrency(line.credit) : '—',
                ]);
            }
        }
        autoTable(doc, {
            startY: 34,
            head: [['Time', 'Voucher', 'No.', 'Party', 'Narration', 'Amount', 'Debit', 'Credit']],
            body,
            foot: [
                ['PERIOD TOTAL', '', '', '', '', formatCurrency(summary.total_amount), '', ''],
                [
                    `Ledger: Dr ${formatCurrency(summary.total_debit)} · Cr ${formatCurrency(summary.total_credit)} · ${summary.balanced ? 'Balanced' : 'Out of balance'}`,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`DayBook_${startDate}_to_${endDate}.pdf`);
    };

    const showBook = !loading && !error && book != null;
    const isToday = startDate === today && endDate === today;

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                        <BookOpen size={24} className="text-purple-600" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all print:hidden">
                            <ArrowLeft size={14} /> Back
                        </button>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Day Book</h1>
                        <p className="text-xs text-gray-500 mt-0.5">All vouchers for the period · from the general ledger</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={handlePrint}
                        disabled={loading || !!error || entries.length === 0}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 text-gray-900 rounded-xl text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Printer size={14} /> Print
                    </button>
                    <button
                        onClick={handleCsv}
                        disabled={loading || !!error || !!rangeError(startDate, endDate)}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 text-gray-900 rounded-xl text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download size={14} /> Export CSV
                    </button>
                    <button
                        onClick={exportPDF}
                        disabled={loading || !!error || entries.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 flex-wrap print:hidden">
                <button type="button" onClick={() => shiftRange(-1)} aria-label="Previous period" className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
                    <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex items-center gap-3 flex-1 justify-center flex-wrap">
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase">
                        From
                        <input
                            type="date"
                            aria-label="From"
                            value={startDate}
                            onChange={(e) => { setStartDate(e.target.value); setLoading(true); }}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 font-mono"
                        />
                    </label>
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase">
                        To
                        <input
                            type="date"
                            aria-label="To"
                            value={endDate}
                            onChange={(e) => { setEndDate(e.target.value); setLoading(true); }}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 font-mono"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => { setStartDate(today); setEndDate(today); setLoading(true); }}
                        className={`px-3 py-1 text-xs font-black rounded-lg uppercase ${isToday ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Today
                    </button>
                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase">
                        Type
                        <select
                            aria-label="Type"
                            value={sourceType}
                            onChange={(e) => { setSourceType(e.target.value); setLoading(true); }}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 font-bold bg-white"
                        >
                            <option value="">All types</option>
                            {typeOptions.map((row) => (
                                <option key={row.source_type || row.voucher_type} value={row.source_type || ''}>
                                    {row.voucher_type}
                                </option>
                            ))}
                        </select>
                    </label>
                    {accounts && (
                        <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase">
                            Account
                            <select
                                aria-label="Account"
                                value={accountId ?? ''}
                                onChange={(e) => {
                                    setAccountId(e.target.value ? Number(e.target.value) : undefined);
                                    setLoading(true);
                                }}
                                className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 font-bold bg-white"
                            >
                                <option value="">All accounts</option>
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.code} — {account.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                </div>
                <button type="button" onClick={() => shiftRange(1)} aria-label="Next period" className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
                    <ChevronRight size={18} className="text-gray-600" />
                </button>
            </div>

            {loading && !error && (
                <div className="space-y-3" aria-busy="true" aria-label="Loading day book">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                    <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
                </div>
            )}

            {error && !loading && (
                <div style={errorBanner} role="alert">
                    {error}
                </div>
            )}

            {showBook && summary && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Vouchers</p>
                            <p className="text-xl font-black font-mono text-gray-900">{summary.entry_count}</p>
                        </div>
                        {GROUP_CARDS.map((card) => {
                            const stats = groupTotals(summary, card.groups);
                            return (
                                <div key={card.label} className="bg-white border border-gray-100 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{card.label}</p>
                                    <p className="text-xl font-black font-mono text-gray-900">{formatCurrency(stats.total)}</p>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1">{stats.count} vouchers</p>
                                </div>
                            );
                        })}
                        <div className="bg-white border border-gray-100 rounded-2xl p-4">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Ledger Check</p>
                            <p className="text-sm font-black font-mono text-gray-900">{formatCurrency(summary.total_debit)}</p>
                            <p className="text-sm font-black font-mono text-gray-900">{formatCurrency(summary.total_credit)}</p>
                            <span className={`inline-block mt-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase ${summary.balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {summary.balanced ? 'Balanced' : 'Out of balance'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-gray-700 uppercase tracking-wide">
                                {entries.length} vouchers · {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
                            </p>
                            {entries.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpandAll((open) => !open);
                                        setExpanded(new Set());
                                    }}
                                    className="text-[10px] font-black uppercase text-gray-500 hover:text-gray-800 print:hidden"
                                >
                                    {expandAll ? 'Collapse all' : 'Expand all'}
                                </button>
                            )}
                        </div>
                        {entries.length === 0 ? (
                            <div className="p-16 text-center">
                                <BookOpen size={48} className="mx-auto text-gray-200 mb-3" />
                                <p className="text-gray-400 font-bold text-sm">No vouchers posted for this period</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            {['Time', 'Voucher', 'No.', 'Party', 'Narration', 'Amount', 'Debit', 'Credit', ''].map((heading) => (
                                                <th
                                                    key={heading || 'expand'}
                                                    className={`px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest ${heading === 'Amount' || heading === 'Debit' || heading === 'Credit' ? 'text-right' : ''}`}
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {(multiDay ? dayOrder : ['']).map((day) => {
                                            const dayEntries = multiDay ? (entriesByDay.get(day) ?? []) : entries;
                                            const daySummary = summary.by_day.find((row) => row.date === day);
                                            if (multiDay && dayEntries.length === 0) return null;
                                            return (
                                                <Fragment key={day || 'single'}>
                                                    {multiDay && (
                                                        <tr className="bg-purple-50">
                                                            <td colSpan={9} className="px-5 py-3 text-xs font-black text-purple-800 uppercase">
                                                                {day}
                                                                {daySummary ? ` · ${daySummary.count} · ${formatCurrency(daySummary.total_amount)}` : ''}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {dayEntries.map((entry) => {
                                                        const open = isExpanded(entry.id);
                                                        const reversed = entry.status === 'reversed';
                                                        return (
                                                            <Fragment key={entry.id}>
                                                                <tr
                                                                    data-voucher-row={entry.id}
                                                                    onClick={() => toggleRow(entry.id)}
                                                                    className="hover:bg-gray-50 transition-all cursor-pointer"
                                                                    style={reversed ? { opacity: 0.55 } : undefined}
                                                                >
                                                                    <td className="px-5 py-4 text-xs font-mono text-gray-400">{timeLabel(entry.created_at)}</td>
                                                                    <td className="px-5 py-4">
                                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${groupBadgeClass(entry.group)}`}>{entry.voucher_type}</span>
                                                                        {reversed && <span className="ml-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-gray-200 text-gray-600">Reversed</span>}
                                                                        {entry.source_type === 'reversal' && <span className="ml-2 px-2 py-1 rounded-lg text-[10px] font-black uppercase bg-purple-100 text-purple-700">Reversal</span>}
                                                                    </td>
                                                                    <td className={`px-5 py-4 text-xs font-mono font-bold text-orange-600 ${reversed ? 'line-through' : ''}`}>{entry.entry_number}</td>
                                                                    <td className="px-5 py-4 text-sm text-gray-600">{entry.party_name || '—'}</td>
                                                                    <td className="px-5 py-4 text-sm font-bold text-gray-900">{entry.memo || '—'}</td>
                                                                    <td className="px-5 py-4 text-sm font-black font-mono text-gray-900 text-right">{formatCurrency(entry.amount)}</td>
                                                                    <td className="px-5 py-4 text-sm font-mono text-gray-300 text-right">—</td>
                                                                    <td className="px-5 py-4 text-sm font-mono text-gray-300 text-right">—</td>
                                                                    <td className="px-5 py-4 text-gray-400">
                                                                        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
                                                                    </td>
                                                                </tr>
                                                                {open && entry.lines.map((line, index) => (
                                                                    <tr key={`${entry.id}-line-${index}`} data-line-row={entry.id} className="bg-gray-50/80">
                                                                        <td className="px-5 py-2" />
                                                                        <td className="px-5 py-2 text-xs font-mono text-gray-500">{line.account_code || '—'}</td>
                                                                        <td className="px-5 py-2 text-sm text-gray-700" colSpan={2}>{line.account_name || '—'}</td>
                                                                        <td className="px-5 py-2 text-xs text-gray-500">{line.memo || '—'}</td>
                                                                        <td className="px-5 py-2 text-sm font-mono text-right text-red-700">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                                                                        <td className="px-5 py-2 text-sm font-mono text-right text-emerald-700">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                                                                        <td />
                                                                    </tr>
                                                                ))}
                                                            </Fragment>
                                                        );
                                                    })}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-900 text-white">
                                            <td colSpan={5} className="px-5 py-4 text-xs font-black uppercase">Period Total</td>
                                            <td className="px-5 py-4 text-sm font-black font-mono text-right">{formatCurrency(summary.total_amount)}</td>
                                            <td colSpan={3} />
                                        </tr>
                                        <tr className="bg-gray-800 text-white">
                                            <td colSpan={9} className="px-5 py-3 text-xs font-bold">
                                                Ledger: Dr {formatCurrency(summary.total_debit)} · Cr {formatCurrency(summary.total_credit)} ·{' '}
                                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${summary.balanced ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                                                    {summary.balanced ? 'Balanced' : 'Out of balance'}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
