import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { Scale, Download, CheckCircle, XCircle, ArrowLeft, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../services/settingsService';
import { getGLTrialBalance, type GLTrialBalance, type GLTrialBalanceRow } from '../../services/glService';

interface TrialEntry {
    account: string;
    category: string;
    debit: number;
    credit: number;
}

const GL_COVERAGE_NOTE =
    'Generated from the general ledger. Includes invoices, customer payments, expenses, opening balances, goods receipts (GRN), and supplier payments.';

function asOfForPeriod(period: 'month' | 'quarter' | 'year'): string {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const y = now.getFullYear();
    const m = now.getMonth();
    let end: Date;
    if (period === 'month') {
        end = new Date(y, m + 1, 0);
    } else if (period === 'quarter') {
        const qEndMonth = Math.floor(m / 3) * 3 + 2;
        end = new Date(y, qEndMonth + 1, 0);
    } else {
        end = new Date(y, 11, 31);
    }
    const endIso = end.toISOString().slice(0, 10);
    return endIso > today ? today : endIso;
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

function mapGlRows(accounts: GLTrialBalanceRow[]): TrialEntry[] {
    return accounts
        .filter(row => (row.debit || 0) > 0 || (row.credit || 0) > 0)
        .map(row => ({
            account: row.code ? `${row.code} — ${row.name}` : row.name,
            category: glTypeToCategory(row.type),
            debit: row.debit || 0,
            credit: row.credit || 0,
        }));
}

export default function TrialBalance() {
    const navigate = useNavigate();
    const [tb, setTb] = useState<GLTrialBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

    const requestedAsOf = useMemo(() => asOfForPeriod(period), [period]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getGLTrialBalance(requestedAsOf)
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
    }, [requestedAsOf]);

    const entries = useMemo(() => (tb ? mapGlRows(tb.accounts) : []), [tb]);
    const totalDebit = tb?.total_debit ?? 0;
    const totalCredit = tb?.total_credit ?? 0;
    const isBalanced = tb?.is_balanced ?? false;
    const asOfLabel = tb?.as_of ?? requestedAsOf;

    const catColor = (cat: string) => {
        switch (cat) {
            case 'Income': return 'bg-emerald-100 text-emerald-700';
            case 'Assets': return 'bg-blue-100 text-blue-700';
            case 'Liabilities': return 'bg-red-100 text-red-700';
            case 'Expenses': return 'bg-orange-100 text-orange-700';
            case 'Equity': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const periodLabel = {
        month: 'Monthly (as of month-end)',
        quarter: 'Quarterly (as of quarter-end)',
        year: 'Yearly (as of year-end)',
    };

    const handlePrint = () => window.print();

    const exportPDF = () => {
        if (!tb) return;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Trial Balance', 14, 16);
        doc.setFontSize(10);
        doc.text(`General ledger as of ${asOfLabel}`, 14, 22);
        doc.text(
            isBalanced
                ? `Balanced · Totals: ${formatCurrency(totalDebit)}`
                : `IMBALANCED · Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`,
            14, 28,
        );
        autoTable(doc, {
            startY: 34,
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

    return (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                        <Scale size={24} className="text-indigo-600" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all print:hidden"><ArrowLeft size={14} /> Back</button>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Trial Balance</h1>
                        <p className="text-xs text-gray-500 mt-0.5">All debits must equal all credits · {periodLabel[period]}</p>
                        <p className="text-[11px] text-gray-400 mt-1 max-w-xl">{GL_COVERAGE_NOTE}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 print:hidden">
                    {(['month', 'quarter', 'year'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${period === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {p === 'month' ? 'Monthly' : p === 'quarter' ? 'Quarterly' : 'Yearly'}
                        </button>
                    ))}
                    <button
                        onClick={handlePrint}
                        disabled={loading || !!error || entries.length === 0}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 text-gray-900 rounded-xl text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Printer size={14} /> Print
                    </button>
                    <button
                        onClick={exportPDF}
                        disabled={loading || !!error || !tb}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-2xl p-4 flex items-center gap-3 bg-red-50 border border-red-200">
                    <XCircle size={20} className="text-red-600 shrink-0" />
                    <p className="text-sm font-black text-red-700">{error}</p>
                </div>
            )}

            {/* Balance Status */}
            {!loading && !error && tb && (
                <div className={`rounded-2xl p-4 flex items-center gap-3 ${isBalanced ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    {isBalanced
                        ? <><CheckCircle size={20} className="text-emerald-600" /><p className="text-sm font-black text-emerald-700">Trial Balance is balanced — Total Debits = Total Credits ({formatCurrency(totalDebit)})</p></>
                        : <><XCircle size={20} className="text-red-600" /><p className="text-sm font-black text-red-700">Imbalance detected — Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</p></>
                    }
                </div>
            )}

            {/* Trial Balance Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-wide">
                        Trial Balance — as of {asOfLabel}
                    </p>
                </div>
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Loading general ledger trial balance…</div>
                ) : error ? (
                    <div className="p-16 text-center text-red-500 font-bold">Could not load trial balance.</div>
                ) : entries.length === 0 ? (
                    <div className="p-16 text-center text-gray-400 font-bold">No posted GL activity as of {asOfLabel}.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-[40%]">Account Name</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Debit</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {entries.map((e, i) => (
                                    <tr key={i} className="hover:bg-gray-50 transition-all">
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{e.account}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${catColor(e.category)}`}>{e.category}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black font-mono text-gray-900 text-right">
                                            {e.debit > 0 ? formatCurrency(e.debit) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black font-mono text-gray-900 text-right">
                                            {e.credit > 0 ? formatCurrency(e.credit) : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-900 text-white">
                                    <td colSpan={2} className="px-6 py-4 text-xs font-black uppercase">Grand Total</td>
                                    <td className="px-6 py-4 text-sm font-black font-mono text-right">{formatCurrency(totalDebit)}</td>
                                    <td className="px-6 py-4 text-sm font-black font-mono text-right">{formatCurrency(totalCredit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 text-center">{GL_COVERAGE_NOTE}</p>
        </div>
    );
}
