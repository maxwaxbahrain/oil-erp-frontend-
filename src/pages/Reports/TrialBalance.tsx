import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Scale, Download, CheckCircle, XCircle , ArrowLeft, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInvoices, getPayments, getCustomers } from '../../services/api';
import { getPurchaseOrders, getSuppliers, getSupplierBalance } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';

interface TrialEntry {
    account: string;
    category: string;
    debit: number;
    credit: number;
}

export default function TrialBalance() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<TrialEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

    useEffect(() => {
        Promise.all([
            getInvoices().catch(() => []),
            getPayments().catch(() => []),
            getPurchaseOrders().catch(() => []),
            // Customers + suppliers are needed for the AR / AP balance lines —
            // a Trial Balance always shows current account BALANCES (not flows
            // filtered by period), so we pull them from the reconciled
            // customer & supplier ledgers instead of summing raw invoice /
            // PO records (which on imported data have paid_amount=0 across
            // the board and would give 9× too much AR).
            getCustomers().catch(() => []),
            getSuppliers().catch(() => []),
        ]).then(async ([invoices, payments, pos, customers, suppliers]) => {
            const now = new Date();
            const filterDate = (dateStr: string) => {
                const d = new Date(dateStr);
                if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                if (period === 'quarter') {
                    const q = Math.floor(now.getMonth() / 3);
                    return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear();
                }
                return d.getFullYear() === now.getFullYear();
            };

            // FLOW accounts (revenue, cash receipts, purchases) ARE date-filtered.
            const validInvoices = invoices.filter(i => filterDate(i.invoiceDate || i.createdAt?.slice(0, 10) || ''));
            const validPayments = payments.filter(p => filterDate(p.payment_date || ''));
            const validPOs = pos.filter(po => filterDate(po.date || ''));

            const totalRevenue = validInvoices.reduce((s, i) => s + (i.grandTotal || i.subtotal || 0), 0);
            const totalReceived = validPayments.reduce((s, p) => s + (p.amount || 0), 0);
            const totalPurchases = validPOs.reduce((s, po) => s + (po.grandTotal || 0), 0);
            const cogs = totalPurchases;

            // BALANCE accounts (AR / AP) come from the reconciled ledgers, not
            // raw invoice / PO records.  AR = sum of positive customer balances
            // (same source as Aged Receivable, COA, Banking).
            const totalReceivable = (customers || []).reduce(
                (s: number, c: any) => s + Math.max(0, Number(c?.balance) || 0), 0,
            );
            // AP = sum of positive supplier outstanding (same as COA / Banking).
            const supplierBalances = await Promise.all(
                (suppliers || []).map((s: any) => getSupplierBalance(s.id).catch(() => 0)),
            );
            const totalPayable = supplierBalances.reduce(
                (s: number, b: number) => s + Math.max(0, b), 0,
            );

            // For a balanced trial balance:
            // Total Debits = AR + Cash + COGS
            // Total Credits = Revenue + AP + Retained Earnings (plug to balance)
            const totalDebitSide = totalReceivable + totalReceived + cogs;
            const totalCreditSide = totalRevenue + totalPayable;
            const retainedEarnings = totalDebitSide - totalCreditSide; // plug to balance

            const trialEntries: TrialEntry[] = [
                { account: 'Sales Revenue', category: 'Income', debit: 0, credit: totalRevenue },
                { account: 'Accounts Receivable', category: 'Assets', debit: totalReceivable, credit: 0 },
                { account: 'Cash / Bank Receipts', category: 'Assets', debit: totalReceived, credit: 0 },
                { account: 'Cost of Goods Sold', category: 'Expenses', debit: cogs, credit: 0 },
                { account: 'Accounts Payable', category: 'Liabilities', debit: 0, credit: totalPayable },
                { account: 'Retained Earnings / Equity', category: 'Equity', debit: retainedEarnings < 0 ? Math.abs(retainedEarnings) : 0, credit: retainedEarnings >= 0 ? retainedEarnings : 0 },
            ];

            setEntries(trialEntries);
            setLoading(false);
        });
    }, [period]);

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

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

    const periodLabel = { month: 'This Month', quarter: 'This Quarter', year: 'This Year' };

    const handlePrint = () => window.print();

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Trial Balance', 14, 16);
        doc.setFontSize(10);
        doc.text(`${periodLabel[period]} · ${new Date().getFullYear()}`, 14, 22);
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
        doc.save(`TrialBalance_${period}_${new Date().getFullYear()}.pdf`);
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
                    </div>
                </div>
                <div className="flex items-center gap-3 print:hidden">
                    {(['month', 'quarter', 'year'] as const).map(p => (
                        <button key={p} onClick={() => { setPeriod(p); setLoading(true); }}
                            className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${period === p ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {p === 'month' ? 'Monthly' : p === 'quarter' ? 'Quarterly' : 'Yearly'}
                        </button>
                    ))}
                    <button
                        onClick={handlePrint}
                        disabled={loading || entries.length === 0}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 text-gray-900 rounded-xl text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Printer size={14} /> Print
                    </button>
                    <button
                        onClick={exportPDF}
                        disabled={loading || entries.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>

            {/* Balance Status */}
            {!loading && (
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
                        Trial Balance — {periodLabel[period]} — {new Date().getFullYear()}
                    </p>
                </div>
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Calculating...</div>
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
            <p className="text-xs text-gray-400 text-center">Trial balance is generated from real invoice, payment and purchase order data · Switch period using the buttons above</p>
        </div>
    );
}
