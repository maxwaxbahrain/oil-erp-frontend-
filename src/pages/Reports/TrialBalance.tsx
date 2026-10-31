import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { Scale, Download, CheckCircle, XCircle, ArrowLeft, Printer, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../services/settingsService';
import { getGLTrialBalance, type GLTrialBalance, type GLTrialBalanceRow } from '../../services/glService';
import { formatLocalDate } from '../../utils/dates';
import { localIsoDate } from '../../utils/localDate';

interface TrialEntry {
    account: string;
    category: string;
    debit: number;
    credit: number;
}

const GL_COVERAGE_NOTE =
    'Generated from the general ledger. Includes invoices, customer payments, expenses, opening balances, goods receipts (GRN), and supplier payments.';

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

const tdStyle: CSSProperties = {
    padding: '8px 10px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

const dateInputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 32px 8px 10px',
    borderRadius: 8,
    border: '1px solid var(--color-redwood-border)',
    background: 'var(--color-redwood-row-bg)',
    color: 'var(--color-redwood-text-main)',
    fontSize: 10,
    fontFamily: 'inherit',
    outline: 'none',
};

export function trialBalanceTodayISO(now: Date = new Date()): string {
    return localIsoDate(now);
}

/** Last calendar day of the month before `now`'s month. */
export function trialBalanceEndOfLastMonthISO(now: Date = new Date()): string {
    return localIsoDate(new Date(now.getFullYear(), now.getMonth(), 0));
}

/** Last calendar day of the quarter before `now`'s quarter. */
export function trialBalanceEndOfLastQuarterISO(now: Date = new Date()): string {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return localIsoDate(new Date(now.getFullYear(), quarterStartMonth, 0));
}

/** Dec 31 of the year before `now`'s year. */
export function trialBalanceEndOfLastYearISO(now: Date = new Date()): string {
    return localIsoDate(new Date(now.getFullYear() - 1, 11, 31));
}

function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

function glTypeToCategory(type: string): string {
    switch ((type || '').toLowerCase()) {
        case 'asset': return 'Assets';
        case 'liability': return 'Liabilities';
        case 'equity': return 'Equity';
        case 'revenue': return 'Income';
        case 'expense': return 'Expenses';
        default: return type || 'Other';
    }
}

function accountLabel(row: GLTrialBalanceRow): string {
    return row.code ? `${row.code} — ${row.name}` : row.name;
}

export function mapGlRowsGross(accounts: GLTrialBalanceRow[]): TrialEntry[] {
    return accounts
        .filter(row => (row.debit || 0) > 0 || (row.credit || 0) > 0)
        .map(row => ({
            account: accountLabel(row),
            category: glTypeToCategory(row.type),
            debit: row.debit || 0,
            credit: row.credit || 0,
        }));
}

export function mapGlRowsNet(accounts: GLTrialBalanceRow[]): TrialEntry[] {
    return accounts
        .map(row => {
            const net = roundMoney((row.debit || 0) - (row.credit || 0));
            return {
                account: accountLabel(row),
                category: glTypeToCategory(row.type),
                debit: net > 0 ? net : 0,
                credit: net < 0 ? roundMoney(Math.abs(net)) : 0,
            };
        })
        .filter(row => row.debit > 0 || row.credit > 0);
}

export function sumColumn(entries: TrialEntry[], side: 'debit' | 'credit'): number {
    return roundMoney(entries.reduce((sum, e) => sum + (e[side] || 0), 0));
}

function catBadgeStyle(cat: string): CSSProperties {
    const base: CSSProperties = {
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.3px',
    };
    switch (cat) {
        case 'Income': return { ...base, background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)' };
        case 'Assets': return { ...base, background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)' };
        case 'Liabilities': return { ...base, background: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red-tint)' };
        case 'Expenses': return { ...base, background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)' };
        case 'Equity': return { ...base, background: 'var(--color-badge-teal-bg)', color: 'var(--color-redwood-text-main)' };
        default: return { ...base, background: 'var(--color-badge-blue-bg)', color: 'var(--color-redwood-text-muted)' };
    }
}

export default function TrialBalance() {
    const navigate = useNavigate();
    const [tb, setTb] = useState<GLTrialBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [asOf, setAsOf] = useState<string>(() => trialBalanceTodayISO());
    const [showGross, setShowGross] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getGLTrialBalance(asOf)
            .then(data => {
                if (cancelled) return;
                setTb(data);
                setLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setTb(null);
                setError(err instanceof Error ? err.message : 'Failed to load trial balance from the general ledger.');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [asOf, reloadKey]);

    const grossEntries = useMemo(() => (tb ? mapGlRowsGross(tb.accounts) : []), [tb]);
    const netEntries = useMemo(() => (tb ? mapGlRowsNet(tb.accounts) : []), [tb]);
    const entries = showGross ? grossEntries : netEntries;

    const totalDebit = showGross
        ? (tb?.total_debit ?? 0)
        : sumColumn(netEntries, 'debit');
    const totalCredit = showGross
        ? (tb?.total_credit ?? 0)
        : sumColumn(netEntries, 'credit');
    const isBalanced = showGross
        ? (tb?.is_balanced ?? false)
        : Math.abs(totalDebit - totalCredit) < 0.005;

    const asOfLabel = tb?.as_of ?? asOf;
    const headingDate = formatLocalDate(asOfLabel) || asOfLabel;

    const handlePrint = () => window.print();

    const exportPDF = () => {
        if (!tb) return;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Trial balance', 14, 16);
        doc.setFontSize(10);
        doc.text(`General ledger as of ${headingDate}`, 14, 22);
        doc.text(
            showGross ? '(Gross movements)' : '(Net balances)',
            14, 27,
        );
        doc.text(
            isBalanced
                ? `Balanced · Totals: ${formatCurrency(totalDebit)}`
                : `IMBALANCED · Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`,
            14, 33,
        );
        autoTable(doc, {
            startY: 38,
            head: [['Account', 'Category', 'Debit', 'Credit']],
            body: entries.map(e => [
                e.account,
                e.category,
                e.debit > 0 ? formatCurrency(e.debit) : '—',
                e.credit > 0 ? formatCurrency(e.credit) : '—',
            ]),
            foot: [['TOTAL', '', formatCurrency(totalDebit), formatCurrency(totalCredit)]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`TrialBalance_${asOfLabel}.pdf`);
    };

    const presetBtn = (label: string, value: string) => (
        <button
            key={label}
            type="button"
            onClick={() => setAsOf(value)}
            style={{
                ...ghostBtn,
                borderColor: asOf === value ? 'rgba(79,142,247,.45)' : 'var(--color-redwood-border)',
                color: asOf === value ? '#93C5FD' : 'var(--color-redwood-text-muted)',
                background: asOf === value ? 'rgba(79,142,247,.15)' : ghostBtn.background as string,
            }}
        >
            {label}
        </button>
    );

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 24, maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(79,142,247,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Scale size={18} style={{ color: '#4F8EF7' }} />
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
                            Trial balance
                        </h1>
                        <p style={{ fontSize: 9.5, color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
                            Trial balance — as of {headingDate}
                        </p>
                        <p style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)', margin: '6px 0 0', maxWidth: 520 }}>
                            {GL_COVERAGE_NOTE}
                        </p>
                    </div>
                </div>
                <div className="print:hidden" style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" onClick={handlePrint} disabled={loading || !!error || entries.length === 0} style={{ ...ghostBtn, opacity: loading || !!error || entries.length === 0 ? 0.45 : 1 }}>
                        <Printer size={12} /> Print
                    </button>
                    <button
                        type="button"
                        onClick={exportPDF}
                        disabled={loading || !!error || !tb}
                        style={{ ...ghostBtn, opacity: loading || !!error || !tb ? 0.45 : 1 }}
                    >
                        <Download size={12} /> Export PDF
                    </button>
                </div>
            </div>

            <div style={{ ...panel, padding: '14px 16px' }} className="print:hidden">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ minWidth: 180, flex: '1 1 180px' }}>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: 'var(--color-redwood-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                            As of
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="date"
                                aria-label="As of"
                                value={asOf}
                                onChange={(e) => setAsOf(e.target.value)}
                                style={dateInputStyle}
                            />
                            <Calendar size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-redwood-text-muted)', pointerEvents: 'none' }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {presetBtn('Today', trialBalanceTodayISO())}
                        {presetBtn('End of last month', trialBalanceEndOfLastMonthISO())}
                        {presetBtn('End of last quarter', trialBalanceEndOfLastQuarterISO())}
                        {presetBtn('End of last year', trialBalanceEndOfLastYearISO())}
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--color-redwood-text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                        <input
                            type="checkbox"
                            checked={showGross}
                            onChange={(e) => setShowGross(e.target.checked)}
                            aria-label="Show gross movements"
                        />
                        Show gross movements
                    </label>
                </div>
            </div>

            {error && (
                <div style={{ ...panel, background: 'rgba(239,68,68,.08)', borderColor: 'rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }} role="alert">
                    <XCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-brand-red-tint)', margin: 0, flex: '1 1 200px' }}>{error}</p>
                    <button
                        type="button"
                        onClick={() => setReloadKey((k) => k + 1)}
                        disabled={loading}
                        style={{ ...ghostBtn, color: '#93C5FD', borderColor: 'rgba(79,142,247,.35)' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && tb && (
                <div style={{
                    ...panel,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: isBalanced ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)',
                    borderColor: isBalanced ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)',
                }}>
                    {isBalanced
                        ? <CheckCircle size={16} style={{ color: 'var(--color-brand-green-tint)' }} />
                        : <XCircle size={16} style={{ color: 'var(--color-brand-red-tint)' }} />}
                    <p style={{ fontSize: 10, fontWeight: 600, color: isBalanced ? 'var(--color-brand-green-tint)' : 'var(--color-brand-red-tint)', margin: 0 }}>
                        {isBalanced
                            ? `Trial balance is balanced — total debits = total credits (${formatCurrency(totalDebit)})`
                            : `Imbalance detected — difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                    </p>
                </div>
            )}

            <div style={{ ...panel, padding: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-redwood-border)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                        Trial balance — as of {headingDate}
                        {showGross ? ' · gross movements' : ' · net balances'}
                    </p>
                </div>
                {loading ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600 }}>
                        Loading general ledger trial balance…
                    </div>
                ) : error ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-brand-red-tint)', fontSize: 11, fontWeight: 600 }}>
                        Could not load trial balance.
                    </div>
                ) : entries.length === 0 ? (
                    <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 11, fontWeight: 600 }}>
                        No posted GL activity as of {headingDate}.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '40%' }}>Account name</th>
                                    <th style={thStyle}>Category</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Debit</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e, i) => (
                                    <tr key={i}>
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{e.account}</td>
                                        <td style={tdStyle}>
                                            <span style={catBadgeStyle(e.category)}>{e.category}</span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: e.debit > 0 ? 'var(--color-brand-red-tint)' : 'transparent' }}>
                                            {e.debit > 0 ? formatCurrency(e.debit) : '—'}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 600, color: e.credit > 0 ? 'var(--color-brand-green-tint)' : 'transparent' }}>
                                            {e.credit > 0 ? formatCurrency(e.credit) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'rgba(255,255,255,.06)' }}>
                                    <td colSpan={2} style={{ ...tdStyle, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px' }}>Grand total</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-red-tint)' }}>{formatCurrency(totalDebit)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: 'var(--color-brand-green-tint)' }}>{formatCurrency(totalCredit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
            <p style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)', textAlign: 'center', margin: 0 }}>{GL_COVERAGE_NOTE}</p>
        </div>
    );
}
