import { useNavigate } from 'react-router-dom';
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
    ArrowLeft,
    BookOpen,
    CheckCircle,
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
import { formatLocalDate } from '../../utils/dates';
import { localIsoDate, localMonthStartIso } from '../../utils/localDate';

const RANGE_TOO_WIDE = 'Date range cannot exceed 92 days';
const RANGE_BACKWARDS = 'end_date must be on or after start_date';

const GROUP_CARDS: Array<{ label: string; groups: string[]; valueColor: string }> = [
    { label: 'Sales', groups: ['sales'], valueColor: 'var(--color-brand-green-tint)' },
    { label: 'Receipts', groups: ['receipts'], valueColor: 'var(--color-brand-green-tint)' },
    { label: 'Purchases', groups: ['purchases'], valueColor: 'var(--color-brand-red-tint)' },
    { label: 'Payments + Expenses', groups: ['payments', 'expenses'], valueColor: 'var(--color-brand-red-tint)' },
    { label: 'Bank', groups: ['bank'], valueColor: 'var(--color-brand-blue-tint)' },
    { label: 'Journal', groups: ['journal'], valueColor: 'var(--color-redwood-text-main)' },
];

const panel: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '10px',
    padding: '10px 12px',
};

const ghostBtn: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    borderRadius: '6px',
    fontSize: '9.5px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    flexShrink: 0,
};

const thStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--color-redwood-border)',
    textAlign: 'left',
};

const thRight: CSSProperties = {
    ...thStyle,
    textAlign: 'right',
};

const tdStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

const tdMonoRight: CSSProperties = {
    ...tdStyle,
    textAlign: 'right',
    fontFamily: 'ui-monospace,monospace',
    fontWeight: 600,
};

const dateInputStyle: CSSProperties = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    outline: 'none',
};

const selectStyle: CSSProperties = {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    cursor: 'pointer',
};

const bucketLabelStyle: CSSProperties = {
    fontSize: 8.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    margin: '0 0 4px',
};

const bucketValueStyle: CSSProperties = {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'ui-monospace,monospace',
};

const dayGroupRowStyle: CSSProperties = {
    ...tdStyle,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    background: 'rgba(255,255,255,.06)',
    borderBottom: '1px solid var(--color-redwood-border)',
};

const footerRowStyle: CSSProperties = {
    ...tdStyle,
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    background: 'rgba(255,255,255,.06)',
};

function presetGhost(active: boolean): CSSProperties {
    return {
        ...ghostBtn,
        borderColor: active ? 'rgba(79,142,247,.45)' : 'var(--color-redwood-border)',
        background: active ? 'rgba(79,142,247,.15)' : 'rgba(255,255,255,.04)',
        color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
    };
}

function voucherBadgeStyle(group: string): CSSProperties {
    const base: CSSProperties = {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.3px',
    };
    switch (group) {
        case 'sales':
        case 'receipts':
            return { ...base, background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)' };
        case 'purchases':
        case 'payments':
        case 'expenses':
            return { ...base, background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)' };
        case 'bank':
            return { ...base, background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)' };
        default:
            return { ...base, background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' };
    }
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
    const today = localIsoDate();
    const monthStart = localMonthStartIso();
    const [startDate, setStartDate] = useState(() => localMonthStartIso());
    const [endDate, setEndDate] = useState(() => localIsoDate());
    const [sourceType, setSourceType] = useState('');
    const [accountId, setAccountId] = useState<number | undefined>(undefined);
    const [accounts, setAccounts] = useState<GLAccount[] | null>(null);
    const [book, setBook] = useState<DayBookResponse | null>(null);
    const [typeOptions, setTypeOptions] = useState<DayBookSummary['by_type']>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [expandAll, setExpandAll] = useState(false);
    const [tileCols, setTileCols] = useState(4);

    useEffect(() => {
        const update = () => setTileCols(window.innerWidth >= 900 ? 4 : 2);
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

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
    }, [startDate, endDate, sourceType, accountId, reloadKey]);

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
        doc.text(`Range: ${formatLocalDate(startDate) || startDate} → ${formatLocalDate(endDate) || endDate}`, 14, 22);
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
                    `Ledger: Dr ${formatCurrency(summary.total_debit)} · Cr ${formatCurrency(summary.total_credit)} · ${summary.balanced ? 'Balanced' : 'Imbalanced'}`,
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
    const isThisMonth = startDate === monthStart && endDate === today;

    const applyToday = () => {
        setStartDate(today);
        setEndDate(today);
        setLoading(true);
    };

    const applyThisMonth = () => {
        setStartDate(localMonthStartIso());
        setEndDate(localIsoDate());
        setLoading(true);
    };

    const rangeHeading =
        startDate === endDate
            ? formatLocalDate(startDate) || startDate
            : `${formatLocalDate(startDate) || startDate} → ${formatLocalDate(endDate) || endDate}`;

    return (
        <div style={{ padding: 12, maxWidth: 1280, margin: '0 auto', paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'rgba(124,58,237,.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <BookOpen size={18} style={{ color: 'var(--color-brand-amber-tint)' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="print:hidden"
                            style={{ ...ghostBtn, display: 'inline-flex', marginBottom: 6, padding: '4px 8px' }}
                        >
                            <ArrowLeft size={12} /> Back
                        </button>
                        <h1
                            style={{
                                margin: 0,
                                fontSize: 17,
                                fontWeight: 600,
                                color: 'var(--color-redwood-text-main)',
                                fontFamily: "'Syne',sans-serif",
                            }}
                        >
                            Day book
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            All vouchers for the period · from the general ledger
                        </p>
                    </div>
                </div>
                <div className="print:hidden" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={loading || !!error || entries.length === 0}
                        style={{ ...ghostBtn, opacity: loading || !!error || entries.length === 0 ? 0.45 : 1 }}
                    >
                        <Printer size={12} /> Print
                    </button>
                    <button
                        type="button"
                        onClick={handleCsv}
                        disabled={loading || !!error || !!rangeError(startDate, endDate)}
                        style={{ ...ghostBtn, opacity: loading || !!error || !!rangeError(startDate, endDate) ? 0.45 : 1 }}
                    >
                        <Download size={12} /> Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={exportPDF}
                        disabled={loading || !!error || entries.length === 0}
                        style={{ ...ghostBtn, opacity: loading || !!error || entries.length === 0 ? 0.45 : 1 }}
                    >
                        <Download size={12} /> Export PDF
                    </button>
                </div>
            </div>

            <div style={{ ...panel, padding: '12px 14px' }} className="print:hidden">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => shiftRange(-1)} aria-label="Previous period" style={ghostBtn}>
                        <ChevronLeft size={14} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '1 1 200px', justifyContent: 'center' }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase' }}>
                            From
                            <input
                                type="date"
                                aria-label="From"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    setLoading(true);
                                }}
                                style={dateInputStyle}
                            />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase' }}>
                            To
                            <input
                                type="date"
                                aria-label="To"
                                value={endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    setLoading(true);
                                }}
                                style={dateInputStyle}
                            />
                        </label>
                        <button type="button" onClick={applyToday} style={presetGhost(isToday)}>
                            Today
                        </button>
                        <button type="button" onClick={applyThisMonth} style={presetGhost(isThisMonth)}>
                            This month
                        </button>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase' }}>
                            Type
                            <select
                                aria-label="Type"
                                value={sourceType}
                                onChange={(e) => {
                                    setSourceType(e.target.value);
                                    setLoading(true);
                                }}
                                style={selectStyle}
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
                            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 8, fontWeight: 700, color: 'var(--color-redwood-text-muted)', textTransform: 'uppercase' }}>
                                Account
                                <select
                                    aria-label="Account"
                                    value={accountId ?? ''}
                                    onChange={(e) => {
                                        setAccountId(e.target.value ? Number(e.target.value) : undefined);
                                        setLoading(true);
                                    }}
                                    style={selectStyle}
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
                    <button type="button" onClick={() => shiftRange(1)} aria-label="Next period" style={ghostBtn}>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {loading && !error && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true" aria-label="Loading day book">
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tileCols}, minmax(0, 1fr))`, gap: 8 }}>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{ ...panel, height: 72, opacity: 0.5 }} />
                        ))}
                    </div>
                    <div style={{ ...panel, height: 160, opacity: 0.5 }} />
                </div>
            )}

            {error && !loading && (
                <div style={{ ...errorBanner, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} role="alert">
                    <span style={{ flex: '1 1 200px' }}>{error}</span>
                    <button
                        type="button"
                        onClick={() => setReloadKey((k) => k + 1)}
                        className="print:hidden"
                        style={{ ...ghostBtn, color: 'var(--color-brand-blue-tint)', borderColor: 'rgba(79,142,247,.35)' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {showBook && summary && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tileCols}, minmax(0, 1fr))`, gap: 8 }}>
                        <div style={panel}>
                            <p style={bucketLabelStyle}>Vouchers</p>
                            <p style={{ ...bucketValueStyle, color: 'var(--color-redwood-text-main)' }}>{summary.entry_count}</p>
                        </div>
                        {GROUP_CARDS.map((card) => {
                            const stats = groupTotals(summary, card.groups);
                            return (
                                <div key={card.label} style={panel}>
                                    <p style={bucketLabelStyle}>{card.label}</p>
                                    <p style={{ ...bucketValueStyle, color: card.valueColor }}>{formatCurrency(stats.total)}</p>
                                    <p style={{ margin: '4px 0 0', fontSize: 9, color: 'var(--color-redwood-text-muted)' }}>{stats.count} vouchers</p>
                                </div>
                            );
                        })}
                        <div style={panel}>
                            <p style={bucketLabelStyle}>Ledger check</p>
                            <p style={{ ...bucketValueStyle, color: 'var(--color-redwood-text-main)', fontSize: 13 }}>
                                {formatCurrency(summary.total_debit)}
                            </p>
                            <p style={{ ...bucketValueStyle, color: 'var(--color-redwood-text-main)', fontSize: 13, marginTop: 2 }}>
                                {formatCurrency(summary.total_credit)}
                            </p>
                            <span
                                style={{
                                    display: 'inline-block',
                                    marginTop: 6,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: summary.balanced ? 'var(--color-badge-green-bg)' : 'var(--color-badge-red-bg)',
                                    color: summary.balanced ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)',
                                }}
                            >
                                {summary.balanced ? 'Balanced' : 'Imbalanced'}
                            </span>
                        </div>
                    </div>

                    <div style={{ ...panel, padding: 0 }}>
                        <div
                            style={{
                                padding: '12px 14px',
                                borderBottom: '1px solid var(--color-redwood-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                flexWrap: 'wrap',
                            }}
                        >
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                                {entries.length} vouchers · {rangeHeading}
                            </p>
                            {entries.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setExpandAll((open) => !open);
                                        setExpanded(new Set());
                                    }}
                                    className="print:hidden"
                                    style={{ ...ghostBtn, padding: '4px 8px', fontSize: 9 }}
                                >
                                    {expandAll ? 'Collapse all' : 'Expand all'}
                                </button>
                            )}
                        </div>
                        {entries.length === 0 ? (
                            <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                                <CheckCircle size={40} style={{ color: 'var(--color-redwood-text-muted)', opacity: 0.45, margin: '0 auto 12px' }} />
                                <p style={{ color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600, margin: 0 }}>
                                    No vouchers posted for this period
                                </p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={thStyle}>Time</th>
                                            <th style={thStyle}>Voucher</th>
                                            <th style={thStyle}>No.</th>
                                            <th style={thStyle}>Party</th>
                                            <th style={thStyle}>Narration</th>
                                            <th style={thRight}>Amount</th>
                                            <th style={thRight}>Debit</th>
                                            <th style={thRight}>Credit</th>
                                            <th style={{ ...thStyle, width: 32 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(multiDay ? dayOrder : ['']).map((day) => {
                                            const dayEntries = multiDay ? (entriesByDay.get(day) ?? []) : entries;
                                            const daySummary = summary.by_day.find((row) => row.date === day);
                                            if (multiDay && dayEntries.length === 0) return null;
                                            return (
                                                <Fragment key={day || 'single'}>
                                                    {multiDay && (
                                                        <tr>
                                                            <td colSpan={9} style={dayGroupRowStyle}>
                                                                {formatLocalDate(day) || day}
                                                                {daySummary
                                                                    ? ` · ${daySummary.count} · ${formatCurrency(daySummary.total_amount)}`
                                                                    : ''}
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
                                                                    style={{ cursor: 'pointer', opacity: reversed ? 0.55 : 1 }}
                                                                >
                                                                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                                        {timeLabel(entry.created_at)}
                                                                    </td>
                                                                    <td style={tdStyle}>
                                                                        <span style={voucherBadgeStyle(entry.group)}>{entry.voucher_type}</span>
                                                                        {reversed && (
                                                                            <span style={{ ...voucherBadgeStyle('journal'), marginLeft: 6, opacity: 0.85 }}>
                                                                                Reversed
                                                                            </span>
                                                                        )}
                                                                        {entry.source_type === 'reversal' && (
                                                                            <span style={{ ...voucherBadgeStyle('journal'), marginLeft: 6 }}>Reversal</span>
                                                                        )}
                                                                    </td>
                                                                    <td
                                                                        style={{
                                                                            ...tdMonoRight,
                                                                            color: 'var(--color-brand-amber-tint)',
                                                                            textDecoration: reversed ? 'line-through' : undefined,
                                                                        }}
                                                                    >
                                                                        {entry.entry_number}
                                                                    </td>
                                                                    <td style={{ ...tdStyle, color: 'var(--color-redwood-text-muted)' }}>{entry.party_name || '—'}</td>
                                                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{entry.memo || '—'}</td>
                                                                    <td style={tdMonoRight}>{formatCurrency(entry.amount)}</td>
                                                                    <td style={{ ...tdMonoRight, color: 'var(--color-redwood-text-muted)' }}>—</td>
                                                                    <td style={{ ...tdMonoRight, color: 'var(--color-redwood-text-muted)' }}>—</td>
                                                                    <td style={{ ...tdStyle, color: 'var(--color-redwood-text-muted)' }}>
                                                                        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
                                                                    </td>
                                                                </tr>
                                                                {open &&
                                                                    entry.lines.map((line, index) => (
                                                                        <tr key={`${entry.id}-line-${index}`} data-line-row={entry.id}>
                                                                            <td style={tdStyle} />
                                                                            <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                                                                                {line.account_code || '—'}
                                                                            </td>
                                                                            <td style={{ ...tdStyle, color: 'var(--color-redwood-text-muted)' }} colSpan={2}>
                                                                                {line.account_name || '—'}
                                                                            </td>
                                                                            <td style={{ ...tdStyle, fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>{line.memo || '—'}</td>
                                                                            <td style={tdStyle} />
                                                                            <td style={{ ...tdMonoRight, color: 'var(--color-brand-red-tint)' }}>
                                                                                {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                                                                            </td>
                                                                            <td style={{ ...tdMonoRight, color: 'var(--color-brand-green-tint)' }}>
                                                                                {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                                                                            </td>
                                                                            <td style={tdStyle} />
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
                                        <tr>
                                            <td colSpan={5} style={footerRowStyle}>
                                                Period total
                                            </td>
                                            <td style={{ ...tdMonoRight, ...footerRowStyle }}>{formatCurrency(summary.total_amount)}</td>
                                            <td colSpan={3} style={footerRowStyle} />
                                        </tr>
                                        <tr>
                                            <td colSpan={9} style={{ ...footerRowStyle, textTransform: 'none', fontWeight: 600, fontSize: 10 }}>
                                                Ledger: Dr {formatCurrency(summary.total_debit)} · Cr {formatCurrency(summary.total_credit)} ·{' '}
                                                <span
                                                    style={{
                                                        display: 'inline-block',
                                                        padding: '2px 8px',
                                                        borderRadius: 6,
                                                        fontSize: 9,
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        background: summary.balanced ? 'var(--color-badge-green-bg)' : 'var(--color-badge-red-bg)',
                                                        color: summary.balanced ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)',
                                                    }}
                                                >
                                                    {summary.balanced ? 'Balanced' : 'Imbalanced'}
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
