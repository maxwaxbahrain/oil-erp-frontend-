import { useNavigate } from 'react-router-dom';
import { useState, useEffect, Fragment, type CSSProperties } from 'react';
import { Clock, Download, AlertTriangle, CheckCircle, ArrowLeft, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAgedReceivable, type AgedReceivableCustomer } from '../../services/api';
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

export default function AgedReceivable() {
    const navigate = useNavigate();
    const [data, setData] = useState<AgedReceivableCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [asOf] = useState(() => localIsoDate());

    useEffect(() => {
        getAgedReceivable(asOf)
            .then((report) => {
                setData(report.customers);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [asOf]);

    const filtered = data.filter(c => c.customer_name.toLowerCase().includes(search.toLowerCase()));
    const totals = filtered.reduce((acc, c) => ({
        current: acc.current + c.current,
        days30: acc.days30 + c.days30,
        days60: acc.days60 + c.days60,
        days90: acc.days90 + c.days90,
        gross: acc.gross + c.gross,
        credits: acc.credits + c.credits,
        net: acc.net + c.net,
    }), { current: 0, days30: 0, days60: 0, days90: 0, gross: 0, credits: 0, net: 0 });

    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Aged Receivable Report', 14, 16);
        doc.setFontSize(10);
        doc.text(`As of ${formatLocalDate(asOf) || asOf}`, 14, 22);
        doc.text(`${filtered.length} customers · Gross: ${formatCurrency(totals.gross)} · Net: ${formatCurrency(totals.net)}`, 14, 28);
        autoTable(doc, {
            startY: 34,
            head: [['Customer', 'Status', 'Current (0–30d)', '31–60 Days', '61–90 Days', '90+ Days', 'Credits', 'Net']],
            body: filtered.map(c => [
                c.customer_name,
                ageBadge(c).label,
                c.current > 0 ? formatCurrency(c.current) : '—',
                c.days30 > 0 ? formatCurrency(c.days30) : '—',
                c.days60 > 0 ? formatCurrency(c.days60) : '—',
                c.days90 > 0 ? formatCurrency(c.days90) : '—',
                c.credits > 0 ? formatCurrency(c.credits) : '—',
                formatCurrency(c.net),
            ]),
            foot: [[
                'TOTAL',
                '',
                formatCurrency(totals.current),
                formatCurrency(totals.days30),
                formatCurrency(totals.days60),
                formatCurrency(totals.days90),
                formatCurrency(totals.credits),
                formatCurrency(totals.net),
            ]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`AgedReceivable_${asOf}.pdf`);
    };

    const handlePrint = () => window.print();

    const ageBadge = (c: AgedReceivableCustomer): { label: string; tier: AgeBadgeTier } => {
        if (c.days90 > 0) return { label: '90+ days', tier: 'days90' };
        if (c.days60 > 0) return { label: '60+ days', tier: 'days60' };
        if (c.days30 > 0) return { label: '30+ days', tier: 'days30' };
        return { label: 'Current', tier: 'current' };
    };

    const bucketCards: { label: string; value: number; color: string }[] = [
        { label: 'Current (0–30d)', value: totals.current, color: 'var(--color-brand-green-tint)' },
        { label: '31–60 Days', value: totals.days30, color: 'var(--color-brand-amber-tint)' },
        { label: '61–90 Days', value: totals.days60, color: 'var(--color-brand-amber-tint)' },
        { label: '90+ Days', value: totals.days90, color: 'var(--color-brand-red-tint)' },
        { label: 'Gross outstanding', value: totals.gross, color: 'var(--color-redwood-text-main)' },
        { label: 'Net (ledger closing)', value: totals.net, color: 'var(--color-brand-blue-tint)' },
    ];

    const actionsDisabled = loading || filtered.length === 0;

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24, maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Clock size={18} style={{ color: 'var(--color-brand-red-tint)' }} />
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
                            Aged receivable
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            As of {formatLocalDate(asOf) || asOf} · Opening balance is its own row. Net is the customer ledger closing.
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {bucketCards.map((b) => (
                    <div key={b.label} style={{ ...panel, padding: '12px 14px' }}>
                        <p style={bucketLabelStyle}>{b.label}</p>
                        <p style={{ ...bucketValueStyle, color: b.color }}>{loading ? '...' : formatCurrency(b.value)}</p>
                    </div>
                ))}
            </div>

            <div style={{ ...panel, padding: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                        {filtered.length} Customers with Outstanding Balances
                    </p>
                    <input
                        type="text"
                        placeholder="Search customer..."
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
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <CheckCircle size={40} style={{ color: 'var(--color-brand-green-tint)', opacity: 0.45, margin: '0 auto 12px' }} />
                        <p style={{ color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600, margin: 0 }}>All customers are up to date!</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Customer</th>
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
                                {filtered.map(c => {
                                    const badge = ageBadge(c);
                                    const invoiceCount = c.lines.filter(line => line.kind === 'invoice').length;
                                    return (
                                        <Fragment key={c.customer_id}>
                                            <tr
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setExpanded(expanded === c.customer_id ? null : c.customer_id)}
                                            >
                                                <td style={tdStyle}>
                                                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{c.customer_name}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 9.5, color: 'var(--color-redwood-text-muted)' }}>{invoiceCount} invoice{invoiceCount !== 1 ? 's' : ''}</p>
                                                </td>
                                                <td style={tdStyle}>
                                                    <span style={statusBadgeStyle(badge.tier)}>{badge.label}</span>
                                                </td>
                                                <td style={{ ...tdMonoRight, color: c.current > 0 ? 'var(--color-brand-green-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {c.current > 0 ? formatCurrency(c.current) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: c.days30 > 0 ? 'var(--color-brand-amber-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {c.days30 > 0 ? formatCurrency(c.days30) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: c.days60 > 0 ? 'var(--color-brand-amber-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {c.days60 > 0 ? formatCurrency(c.days60) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: c.days90 > 0 ? 'var(--color-brand-red-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {c.days90 > 0 ? (
                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                                            <AlertTriangle size={12} />
                                                            {formatCurrency(c.days90)}
                                                        </span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, color: c.credits > 0 ? 'var(--color-brand-green-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                    {c.credits > 0 ? formatCurrency(c.credits) : '—'}
                                                </td>
                                                <td style={{ ...tdMonoRight, fontWeight: 700 }}>{formatCurrency(c.net)}</td>
                                            </tr>
                                            {expanded === c.customer_id && (
                                                <tr>
                                                    <td colSpan={8} style={{ ...tdStyle, background: 'rgba(255,255,255,.03)', padding: '10px 14px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {c.lines.map(line => (
                                                                <div
                                                                    key={`${line.kind}-${line.label}-${line.date}`}
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
                                                                    <span style={{ color: 'var(--color-redwood-text-muted)', flex: '0 0 auto' }}>{line.kind === 'opening' ? 'Opening balance' : line.kind === 'opening_credit' ? 'Opening credit' : line.stored_as || line.status || ''}</span>
                                                                    <span style={{ fontWeight: 700, fontFamily: 'ui-monospace,monospace', color: 'var(--color-redwood-text-main)', flex: '0 0 auto' }}>{formatCurrency(line.amount)}</span>
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
                Click any row to expand the opening, invoices, and credits · Net matches the customer statement
            </p>
        </div>
    );
}
