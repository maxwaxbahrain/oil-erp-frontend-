import { useNavigate } from 'react-router-dom';
import { useState, useEffect, Fragment, type CSSProperties, type ReactNode } from 'react';
import { Clock, Download, AlertTriangle, CheckCircle, ArrowLeft, Printer, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAgedPayable, type AgedPayableLine, type AgedPayableReport, type AgedPayableSupplier } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';
import { formatLocalDate } from '../../utils/dates';
import { localIsoDate } from '../../utils/localDate';

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

const searchInputStyle: CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    outline: 'none',
    width: 208,
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

type AgeBadgeTier = 'current' | 'days30' | 'days60' | 'days90';

function statusBadgeStyle(tier: AgeBadgeTier): CSSProperties {
    const base: CSSProperties = {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.3px',
    };
    switch (tier) {
        case 'current':
            return { ...base, background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)' };
        case 'days30':
            return { ...base, background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' };
        case 'days60':
            return { ...base, background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' };
        case 'days90':
            return { ...base, background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)' };
    }
}

function lineKindLabel(line: AgedPayableLine): string {
    switch (line.kind) {
        case 'opening':
            return 'Opening balance';
        case 'opening_credit':
            return 'Opening credit';
        case 'purchase_order':
            return line.status || 'PO';
        case 'credit':
            return 'Payment';
        case 'purchase_return':
            return 'Return';
        case 'refund':
        case 'refund_owed':
            return line.direction === 'owed' || line.kind === 'refund_owed' ? 'Refund (owed)' : 'Refund';
        default:
            return line.kind;
    }
}

function ageBadge(s: AgedPayableSupplier): { label: string; tier: AgeBadgeTier } {
    if (s.days90 > 0) return { label: '90+ days', tier: 'days90' };
    if (s.days60 > 0) return { label: '60+ days', tier: 'days60' };
    if (s.days30 > 0) return { label: '30+ days', tier: 'days30' };
    return { label: 'Current', tier: 'current' };
}

export default function AgedPayable() {
    const navigate = useNavigate();
    const [report, setReport] = useState<AgedPayableReport | null>(null);
    const [data, setData] = useState<AgedPayableSupplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [asOf] = useState(() => localIsoDate());
    const [reloadKey, setReloadKey] = useState(0);
    const [gridCols, setGridCols] = useState('repeat(4, minmax(0, 1fr))');

    useEffect(() => {
        const update = () => {
            setGridCols(window.innerWidth < 900 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))');
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getAgedPayable(asOf)
            .then((payload) => {
                if (cancelled) return;
                setReport(payload);
                setData(payload.suppliers);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                setReport(null);
                setData([]);
                setError(err instanceof Error ? err.message : 'Failed to load aged payable from the server.');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [asOf, reloadKey]);

    const filtered = data.filter(s => s.supplier_name.toLowerCase().includes(search.toLowerCase()));
    const totals = filtered.reduce((acc, s) => ({
        current: acc.current + s.current,
        days30: acc.days30 + s.days30,
        days60: acc.days60 + s.days60,
        days90: acc.days90 + s.days90,
        gross: acc.gross + s.gross,
        credits: acc.credits + s.credits,
        net: acc.net + s.net,
    }), { current: 0, days30: 0, days60: 0, days90: 0, gross: 0, credits: 0, net: 0 });

    const asOfLabel = report?.as_of ?? asOf;
    const headingDate = formatLocalDate(asOfLabel) || asOfLabel;
    const glBalance = report?.gl_ap_balance;
    const glDifference = report?.gl_difference ?? 0;
    const glTied = report != null && Math.abs(glDifference) < 0.005;

    const actionsDisabled = loading || !!error || filtered.length === 0;

    const exportPDF = () => {
        if (!report) return;
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Aged payable', 14, 16);
        doc.setFontSize(10);
        doc.text(`As of ${headingDate}`, 14, 22);
        autoTable(doc, {
            startY: 28,
            head: [['Supplier', 'Status', 'Current (0–30d)', '31–60 Days', '61–90 Days', '90+ Days', 'Credits', 'Net']],
            body: filtered.map(s => [
                s.supplier_name,
                ageBadge(s).label,
                s.current > 0 ? formatCurrency(s.current) : '—',
                s.days30 > 0 ? formatCurrency(s.days30) : '—',
                s.days60 > 0 ? formatCurrency(s.days60) : '—',
                s.days90 > 0 ? formatCurrency(s.days90) : '—',
                s.credits > 0 ? formatCurrency(s.credits) : '—',
                formatCurrency(s.net),
            ]),
            foot: [
                [
                    'Gross',
                    '',
                    formatCurrency(totals.current),
                    formatCurrency(totals.days30),
                    formatCurrency(totals.days60),
                    formatCurrency(totals.days90),
                    formatCurrency(totals.credits),
                    formatCurrency(totals.gross),
                ],
                [
                    'Net (ledger closing)',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    formatCurrency(totals.net),
                ],
            ],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 28;
        doc.text(
            `GL 2000: ${formatCurrency(report.gl_ap_balance)} · Difference: ${formatCurrency(report.gl_difference)}`,
            14,
            finalY + 8,
        );
        doc.save(`AgedPayable_${report.as_of}.pdf`);
    };

    const handlePrint = () => window.print();

    const bucketCards: { label: string; value: number | null; color: string; sub?: ReactNode }[] = [
        { label: 'Current (0–30d)', value: totals.current, color: 'var(--color-brand-green-tint)' },
        { label: '31–60 Days', value: totals.days30, color: 'var(--color-brand-amber-tint)' },
        { label: '61–90 Days', value: totals.days60, color: 'var(--color-brand-amber-tint)' },
        { label: '90+ Days', value: totals.days90, color: 'var(--color-brand-red-tint)' },
        { label: 'Gross outstanding', value: totals.gross, color: 'var(--color-redwood-text-main)' },
        { label: 'Credits', value: totals.credits, color: 'var(--color-brand-green-tint)' },
        { label: 'Net (ledger closing)', value: totals.net, color: 'var(--color-brand-blue-tint)' },
        {
            label: 'GL 2000',
            value: glBalance ?? null,
            color: 'var(--color-redwood-text-main)',
            sub: report && !error ? (
                glTied ? (
                    <p style={{ margin: '4px 0 0', fontSize: 9, fontWeight: 600, color: 'var(--color-brand-green-tint)' }}>Ties to GL</p>
                ) : (
                    <p style={{ margin: '4px 0 0', fontSize: 9, fontWeight: 600, color: 'var(--color-brand-red-tint)' }}>
                        Difference {formatCurrency(glDifference)}
                    </p>
                )
            ) : null,
        },
    ];

    const formatCardValue = (value: number | null) => {
        if (loading) return '...';
        if (error || value == null) return '—';
        return formatCurrency(value);
    };

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24, maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={18} style={{ color: 'var(--color-brand-amber-tint)' }} />
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
                        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'Syne',sans-serif" }}>
                            Aged payable
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            As of {headingDate} · Net is the supplier ledger closing · opening balance is its own row
                        </p>
                    </div>
                </div>
                <div className="print:hidden" style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={actionsDisabled}
                        style={{ ...ghostBtn, opacity: actionsDisabled ? 0.45 : 1 }}
                    >
                        <Printer size={12} /> Print
                    </button>
                    <button
                        type="button"
                        onClick={exportPDF}
                        disabled={actionsDisabled}
                        style={{ ...ghostBtn, opacity: actionsDisabled ? 0.45 : 1 }}
                    >
                        <Download size={12} /> Export PDF
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ ...panel, background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} role="alert">
                    <XCircle size={18} style={{ color: 'var(--color-brand-red-tint)', flexShrink: 0 }} />
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand-red-tint)', margin: 0, flex: '1 1 200px' }}>{error}</p>
                    <button
                        type="button"
                        onClick={() => setReloadKey(k => k + 1)}
                        disabled={loading}
                        style={{ ...ghostBtn, color: 'var(--color-brand-blue-tint)', borderColor: 'rgba(79,142,247,.35)' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
                {bucketCards.map((b) => (
                    <div key={b.label} style={{ ...panel, padding: '12px 14px' }}>
                        <p style={bucketLabelStyle}>{b.label}</p>
                        <p style={{ ...bucketValueStyle, color: b.color }}>{formatCardValue(b.value)}</p>
                        {b.sub}
                    </div>
                ))}
            </div>

            <div style={{ ...panel, padding: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                        {filtered.length} Suppliers with Outstanding Balances
                    </p>
                    <input
                        type="text"
                        placeholder="Search supplier..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="print:hidden"
                        style={searchInputStyle}
                    />
                </div>
                {loading ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600 }}>
                        Loading...
                    </div>
                ) : error ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-brand-red-tint)', fontSize: 11, fontWeight: 600 }}>
                        Could not load aged payable.
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <CheckCircle size={40} style={{ color: 'var(--color-brand-green-tint)', opacity: 0.45, margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600, margin: 0 }}>All suppliers are settled!</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Supplier</th>
                                    <th style={thStyle}>Status</th>
                                    <th style={thRight}>Current (0–30d)</th>
                                    <th style={thRight}>31–60 Days</th>
                                    <th style={thRight}>61–90 Days</th>
                                    <th style={thRight}>90+ Days</th>
                                    <th style={thRight}>Credits</th>
                                    <th style={thRight}>Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(s => {
                                    const badge = ageBadge(s);
                                    return (
                                        <Fragment key={s.supplier_id}>
                                            <tr
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setExpanded(expanded === s.supplier_id ? null : s.supplier_id)}
                                            >
                                                <td style={tdStyle}>
                                                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{s.supplier_name}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 9.5, color: 'var(--color-redwood-text-muted)' }}>{s.po_count} PO{s.po_count !== 1 ? 's' : ''}</p>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={statusBadgeStyle(badge.tier)}>{badge.label}</span>
                                                </td>
                                                <td style={{ ...tdMonoRight, color: s.current > 0 ? 'var(--color-brand-green-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {s.current > 0 ? formatCurrency(s.current) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: s.days30 > 0 ? 'var(--color-brand-amber-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {s.days30 > 0 ? formatCurrency(s.days30) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: s.days60 > 0 ? 'var(--color-brand-amber-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {s.days60 > 0 ? formatCurrency(s.days60) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: s.days90 > 0 ? 'var(--color-brand-red-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {s.days90 > 0 ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                                            <AlertTriangle size={12} />
                                                            {formatCurrency(s.days90)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: s.credits > 0 ? 'var(--color-brand-green-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {s.credits > 0 ? formatCurrency(s.credits) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, fontWeight: 700 }}>{formatCurrency(s.net)}</td>
                                            </tr>
                                            {expanded === s.supplier_id && (
                                                <tr>
                                                    <td colSpan={8} style={{ ...tdStyle, background: 'rgba(255,255,255,.03)', padding: '10px 14px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {s.lines.map(line => (
                                                                <div
                                                                    key={`${line.kind}-${line.label}-${line.date}-${line.amount}`}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'space-between',
                                                                        gap: 12,
                                                                        fontSize: 10,
                                                                        borderRadius: 8,
                                                                        padding: '8px 12px',
                                                                        border: '1px solid var(--color-redwood-border)',
                                                                        background: line.bucket ? 'var(--color-redwood-row-bg)' : 'rgba(79,142,247,.08)',
                                                                    }}
                                                                >
                                                                    <span style={{ fontWeight: 600, color: 'var(--color-redwood-text-main)', flex: '1 1 120px' }}>{line.label}</span>
                                                                    <span style={{ color: 'var(--color-redwood-text-muted)', flex: '0 0 auto' }}>{line.date ? (formatLocalDate(line.date) || line.date) : '—'}</span>
                                                                    <span style={{ color: 'var(--color-redwood-text-muted)', flex: '0 0 auto' }}>{lineKindLabel(line)}</span>
                                                                    <span style={{
                                                                        fontWeight: 700,
                                                                        fontFamily: 'ui-monospace,monospace',
                                                                        color: line.direction === 'owed' || line.kind === 'refund_owed'
                                                                            ? 'var(--color-brand-red-tint)'
                                                                            : 'var(--color-redwood-text-main)',
                                                                        flex: '0 0 auto',
                                                                    }}
                                                                    >
                                                                        {formatCurrency(line.amount)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                                <tr style={{ background: 'rgba(255,255,255,.06)' }}>
                                    <td style={{ ...tdStyle, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }} colSpan={2}>Gross</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700 }}>{formatCurrency(totals.current)}</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700 }}>{formatCurrency(totals.days30)}</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700 }}>{formatCurrency(totals.days60)}</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700, color: 'var(--color-brand-red-tint)' }}>{formatCurrency(totals.days90)}</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700, color: 'var(--color-brand-green-tint)' }}>{formatCurrency(totals.credits)}</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700 }}>{formatCurrency(totals.gross)}</td>
                                </tr>
                                <tr style={{ background: 'rgba(255,255,255,.06)' }}>
                                    <td style={{ ...tdStyle, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }} colSpan={7}>Net (ledger closing)</td>
                                    <td style={{ ...tdMonoRight, fontWeight: 700, color: 'var(--color-brand-blue-tint)' }}>{formatCurrency(totals.net)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', textAlign: 'center', margin: 0 }}>
                Click any row to expand POs, payments, returns, and credits · Net matches the supplier statement
            </p>
        </div>
    );
}
