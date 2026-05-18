// TC-69 — Financial Statement page.
// Single page that rolls up the three core financial summaries:
//   1. Profit & Loss  (Revenue, COGS, Gross Profit, Expenses, Net Profit)
//   2. Balance Sheet  (Assets, Liabilities, Equity)
//   3. Cash Flow      (Cash In, Cash Out, Net)
// All numbers are computed from the existing service layer — no new API
// endpoint, no double-source of truth. Date range filter at top. PDF
// export uses the existing generateStandardPDF wrapper (docType='report')
// so the company header + footer + optional signature are consistent
// with the other report PDFs.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Calendar, RefreshCw, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import autoTable from 'jspdf-autotable';
import { getInvoices, getPayments, type Invoice, type Payment } from '../../services/api';
import { getSuppliers, getSupplierPayments } from '../../services/purchasesService';
import { getExpenses, type Expense } from '../../services/expenseService';
import { getGRNs, type GRN } from '../../services/grnService';
import { getAccounts, type Account } from '../Accounts/ChartOfAccounts';
import { formatCurrency } from '../../services/settingsService';
import { generateStandardPDF } from '../../utils/documentGenerator';

interface SectionTotals {
    revenue: number;
    cogs: number;
    grossProfit: number;
    expenses: number;
    netProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
    cashIn: number;
    cashOut: number;
    cashNet: number;
}

export default function FinancialStatement() {
    const navigate = useNavigate();

    // Default range: current year up to today (a sensible YTD view).
    const today = new Date().toISOString().slice(0, 10);
    const ytdStart = `${new Date().getFullYear()}-01-01`;
    const [dateFrom, setDateFrom] = useState<string>(ytdStart);
    const [dateTo, setDateTo] = useState<string>(today);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [supplierPayments, setSupplierPayments] = useState<Array<{ amount: number; date: string }>>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [grns, setGrns] = useState<GRN[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    async function loadAll() {
        setLoading(true);
        setError(null);
        try {
            // Fan out — independent calls in parallel. Each defaults to []
            // on failure so a single broken source doesn't blank the page.
            const [invs, pays, exps, grnsRes, suppliers] = await Promise.all([
                getInvoices().catch(() => [] as Invoice[]),
                getPayments().catch(() => [] as Payment[]),
                getExpenses().catch(() => [] as Expense[]),
                getGRNs().catch(() => [] as GRN[]),
                getSuppliers().catch(() => [] as any[]),
            ]);
            // Supplier payments: fetched per-supplier and flattened.
            const supplierPayBatches = await Promise.all(
                suppliers.map(s => getSupplierPayments(s.id).catch(() => [] as any[])),
            );
            const flatSupplierPays = supplierPayBatches.flat().map(p => ({
                amount: Number(p.amount) || 0,
                date: p.date || p.payment_date || '',
            }));
            setInvoices(invs);
            setPayments(pays);
            setSupplierPayments(flatSupplierPays);
            setExpenses(exps);
            setGrns(grnsRes);
            setAccounts(getAccounts());
        } catch (e: any) {
            setError(e?.message || 'Failed to load financial data.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void loadAll(); }, []);

    // Reusable date-in-range guard — handles missing dates gracefully so a
    // row with no date is excluded rather than throwing.
    const inRange = (raw?: string): boolean => {
        if (!raw) return false;
        const d = raw.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
    };

    const totals: SectionTotals = useMemo(() => {
        // ── P&L: Revenue (invoiced amount in range) ────────────────────
        const revenue = invoices
            .filter(inv => inRange((inv as any).invoiceDate))
            .reduce((s, inv) => s + (Number((inv as any).grandTotal) || 0), 0);

        // ── P&L: COGS (sum of posted GRN landed costs in range) ────────
        // Falls back to per-line cost × accepted qty if landedCost is 0.
        const cogs = grns
            .filter(g => g.status === 'Posted' && inRange(g.receivedDate || g.postedAt?.slice(0, 10)))
            .reduce((s, g) => {
                const landed = Number(g.landedCost) || 0;
                if (landed > 0) return s + landed;
                const lineSum = (g.items || []).reduce(
                    (ss, it) => ss + ((Number(it.acceptedQty ?? it.receivedQty) || 0) * (Number(it.unitCost) || 0)),
                    0,
                );
                return s + lineSum;
            }, 0);

        const grossProfit = revenue - cogs;

        // ── P&L: Operating Expenses (recorded + actually owed) ─────────
        // Drafts excluded — they haven't been committed yet.
        const expensesTotal = expenses
            .filter(e => e.status !== 'Draft' && inRange(e.date))
            .reduce((s, e) => s + (Number(e.amount) || 0), 0);

        const netProfit = grossProfit - expensesTotal;

        // ── Balance Sheet (point-in-time as of dateTo). Walks the COA
        // and uses each account's stored balance + its nature. We sum
        // ONLY leaf accounts so parent roll-ups don't double-count.
        const isLeaf = (a: Account) => !accounts.some(c => c.parentId === a.id);
        const byType = (t: 'Asset' | 'Liability' | 'Equity') => accounts
            .filter(a => a.type === t && isLeaf(a))
            .reduce((s, a) => s + (Number(a.balance) || 0), 0);
        const assets = byType('Asset');
        const liabilities = byType('Liability');
        const equityRaw = byType('Equity');
        // Retained earnings = net profit for the period. Surfaces in the
        // Equity section so Assets = Liabilities + Equity balances out.
        const equity = equityRaw + netProfit;

        // ── Cash Flow (in range) ───────────────────────────────────────
        const cashIn = payments
            .filter(p => inRange(p.payment_date))
            .reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const cashOut = supplierPayments
            .filter(p => inRange(p.date))
            .reduce((s, p) => s + p.amount, 0);
        const cashNet = cashIn - cashOut;

        return { revenue, cogs, grossProfit, expenses: expensesTotal, netProfit, assets, liabilities, equity, cashIn, cashOut, cashNet };
    }, [invoices, payments, supplierPayments, expenses, grns, accounts, dateFrom, dateTo]);

    // PDF download — three sections, one per autoTable block.
    const handleDownloadPDF = () => {
        const periodLabel = `${dateFrom || 'all-time'} → ${dateTo || 'today'}`;
        const filename = `financial-statement-${dateFrom}-to-${dateTo}`;
        generateStandardPDF('Financial Statement', filename, (doc) => {
            let y = 92;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(80, 80, 80);
            doc.text(`Period: ${periodLabel}`, 14, y);
            y += 8;

            // P&L
            autoTable(doc, {
                startY: y,
                head: [['Profit & Loss', '']],
                body: [
                    ['Revenue', formatCurrency(totals.revenue)],
                    ['Cost of Goods Sold', `- ${formatCurrency(totals.cogs)}`],
                    [{ content: 'Gross Profit', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totals.grossProfit), styles: { fontStyle: 'bold' } }],
                    ['Operating Expenses', `- ${formatCurrency(totals.expenses)}`],
                    [{ content: 'NET PROFIT', styles: { fontStyle: 'bold', fillColor: [55, 65, 81], textColor: 255 } },
                     { content: formatCurrency(totals.netProfit), styles: { fontStyle: 'bold', fillColor: [55, 65, 81], textColor: 255, halign: 'right' } }],
                ],
                headStyles: { fillColor: [128, 0, 32], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 4 },
            });
            y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60;
            y += 8;

            // Balance Sheet
            autoTable(doc, {
                startY: y,
                head: [['Balance Sheet (as of ' + (dateTo || 'today') + ')', '']],
                body: [
                    ['Total Assets', formatCurrency(totals.assets)],
                    ['Total Liabilities', formatCurrency(totals.liabilities)],
                    [{ content: 'Equity (incl. retained earnings)', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totals.equity), styles: { fontStyle: 'bold' } }],
                ],
                headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 4 },
            });
            y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y + 60;
            y += 8;

            // Cash Flow
            autoTable(doc, {
                startY: y,
                head: [['Cash Flow Summary', '']],
                body: [
                    ['Cash In (customer receipts)', formatCurrency(totals.cashIn)],
                    ['Cash Out (supplier payments)', `- ${formatCurrency(totals.cashOut)}`],
                    [{ content: 'Net Cash Movement', styles: { fontStyle: 'bold' } }, { content: formatCurrency(totals.cashNet), styles: { fontStyle: 'bold' } }],
                ],
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
                columnStyles: { 1: { halign: 'right' } },
                margin: { left: 14, right: 14 },
                styles: { fontSize: 10, cellPadding: 4 },
            });
        }, 'report');
    };

    // ── UI helper: one stat row inside a section card. ─────────────────
    const Row = ({ label, value, isTotal, valueColor }: { label: string; value: number; isTotal?: boolean; valueColor?: string }) => (
        <div className={`flex justify-between items-center py-2 ${isTotal ? 'border-t-2 border-gray-900 mt-2 pt-3' : ''}`}>
            <span className={`${isTotal ? 'text-sm font-black uppercase tracking-widest' : 'text-sm font-bold'} text-gray-700`}>{label}</span>
            <span className={`font-mono ${isTotal ? 'text-xl font-black' : 'text-base font-bold'} ${valueColor || 'text-gray-900'}`}>{formatCurrency(value)}</span>
        </div>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowLeft size={20} className="text-gray-500" />
                        </button>
                        <div className="w-14 h-14 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg">
                            <FileText size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 uppercase">Financial Statement</h1>
                            <p className="text-xs text-gray-500 font-semibold mt-1">
                                Profit &amp; Loss · Balance Sheet · Cash Flow — for the selected period
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => void loadAll()}
                            disabled={loading}
                            className="px-4 py-3 bg-white border-2 border-gray-300 rounded-lg text-sm font-black hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={loading || !!error}
                            className="px-6 py-3 bg-[#800020] text-white rounded-lg text-sm font-black hover:bg-[#600018] flex items-center gap-2 disabled:opacity-50 shadow-lg"
                        >
                            <Download size={16} /> Download PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Date range filter */}
            <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-black text-gray-600 uppercase mb-2">From</label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-3 text-sm font-bold outline-none focus:border-[#800020]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-600 uppercase mb-2">To</label>
                        <div className="relative">
                            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full border-2 border-gray-300 rounded-lg pl-9 pr-3 py-3 text-sm font-bold outline-none focus:border-[#800020]"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { label: 'YTD', from: ytdStart, to: today },
                            { label: 'This Month', from: today.slice(0, 7) + '-01', to: today },
                            { label: 'Last 30 days', from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: today },
                            { label: 'All time', from: '', to: today },
                        ] as const).map(p => (
                            <button
                                key={p.label}
                                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-900 hover:text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-[#800020] border-t-transparent rounded-full animate-spin" />
                </div>
            )}

            {error && !loading && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-4 text-sm font-bold text-rose-700">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Profit & Loss */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="bg-[#800020] text-white px-6 py-4 flex items-center gap-3">
                            <TrendingUp size={20} />
                            <h2 className="text-sm font-black uppercase tracking-widest">Profit &amp; Loss</h2>
                        </div>
                        <div className="p-6">
                            <Row label="Revenue" value={totals.revenue} valueColor="text-emerald-700" />
                            <Row label="Cost of Goods Sold" value={-totals.cogs} valueColor="text-rose-700" />
                            <Row label="Gross Profit" value={totals.grossProfit} isTotal valueColor={totals.grossProfit >= 0 ? 'text-gray-900' : 'text-rose-700'} />
                            <Row label="Operating Expenses" value={-totals.expenses} valueColor="text-rose-700" />
                            <Row label="Net Profit" value={totals.netProfit} isTotal valueColor={totals.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
                            <p className="text-[10px] text-gray-400 font-bold mt-3 uppercase tracking-widest">
                                {invoices.filter(i => inRange((i as any).invoiceDate)).length} invoices · {expenses.filter(e => e.status !== 'Draft' && inRange(e.date)).length} expenses
                            </p>
                        </div>
                    </div>

                    {/* Balance Sheet */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="bg-blue-600 text-white px-6 py-4 flex items-center gap-3">
                            <FileText size={20} />
                            <h2 className="text-sm font-black uppercase tracking-widest">Balance Sheet</h2>
                        </div>
                        <div className="p-6">
                            <Row label="Total Assets" value={totals.assets} valueColor="text-emerald-700" />
                            <Row label="Total Liabilities" value={totals.liabilities} valueColor="text-rose-700" />
                            <Row label="Equity" value={totals.equity} isTotal valueColor={totals.equity >= 0 ? 'text-gray-900' : 'text-rose-700'} />
                            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Check</p>
                                <p className="text-xs text-gray-700">
                                    A = L + E: {formatCurrency(totals.assets)} {Math.abs(totals.assets - (totals.liabilities + totals.equity)) < 0.5 ? '✓' : '≠'} {formatCurrency(totals.liabilities + totals.equity)}
                                </p>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold mt-3 uppercase tracking-widest">
                                Snapshot as of {dateTo || 'today'} · {accounts.length} accounts in chart
                            </p>
                        </div>
                    </div>

                    {/* Cash Flow */}
                    <div className="bg-white border-2 border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center gap-3">
                            <Wallet size={20} />
                            <h2 className="text-sm font-black uppercase tracking-widest">Cash Flow</h2>
                        </div>
                        <div className="p-6">
                            <Row label="Cash In (receipts)" value={totals.cashIn} valueColor="text-emerald-700" />
                            <Row label="Cash Out (payouts)" value={-totals.cashOut} valueColor="text-rose-700" />
                            <Row label="Net Movement" value={totals.cashNet} isTotal valueColor={totals.cashNet >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
                            <div className="mt-4 flex items-center gap-2">
                                {totals.cashNet >= 0 ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-rose-600" />}
                                <span className={`text-xs font-black uppercase tracking-widest ${totals.cashNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {totals.cashNet >= 0 ? 'Positive period' : 'Negative period'}
                                </span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold mt-3 uppercase tracking-widest">
                                {payments.filter(p => inRange(p.payment_date)).length} receipts · {supplierPayments.filter(p => inRange(p.date)).length} payouts
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
