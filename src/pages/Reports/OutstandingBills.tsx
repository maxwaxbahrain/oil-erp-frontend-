import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FileText, Download, Filter, AlertCircle, CheckCircle , ArrowLeft, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInvoices, getPayments, type Invoice } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

export default function OutstandingBills() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Unpaid' | 'Partial' | 'Overdue'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');

    // QuickBooks-style status derivation from actual amounts/dates, NOT the
    // static inv.status string (the backend marks every new invoice 'unpaid'
    // even if paid_amount is partial/full, so filters that match on
    // inv.status === 'Partial' / 'Overdue' silently match nothing).
    const balanceOf = (i: Invoice) => (Number(i.grandTotal) || 0) - (Number(i.amount_paid) || 0);
    const isFullyPaid = (i: Invoice) => balanceOf(i) <= 0.01;
    const isPartial = (i: Invoice) => Number(i.amount_paid) > 0 && balanceOf(i) > 0.01;
    const isUnpaid = (i: Invoice) => Number(i.amount_paid || 0) === 0 && balanceOf(i) > 0.01;
    const isOverdue = (i: Invoice) => {
        if (balanceOf(i) <= 0.01 || !i.dueDate) return false;
        const due = new Date(i.dueDate);
        if (Number.isNaN(due.getTime())) return false;
        // QuickBooks rule: 'due today' is NOT overdue. Compare day-only.
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return dueDay < today;
    };
    const computedStatus = (i: Invoice): 'Paid' | 'Partial' | 'Overdue' | 'Unpaid' => {
        if (isFullyPaid(i)) return 'Paid';
        if (isOverdue(i)) return 'Overdue';
        if (isPartial(i)) return 'Partial';
        return 'Unpaid';
    };

    useEffect(() => {
        // QuickBooks-style: auto-apply each customer's payments to their oldest
        // open invoices first (FIFO). Backend invoices all have paid_amount=0
        // because customer payments live in a separate Transactions table and
        // are never linked to specific invoices. Without this, every invoice
        // shows fully unpaid and 100% of revenue looks overdue.
        Promise.all([getInvoices(), getPayments().catch(() => [])]).then(([allInvoices, allPayments]) => {
            // Total payment credit available per customer.
            const creditByCustomer: Record<string, number> = {};
            (allPayments || []).forEach((p: any) => {
                const cid = String(p?.customer_id ?? '');
                if (!cid) return;
                creditByCustomer[cid] = (creditByCustomer[cid] || 0) + (Number(p?.amount) || 0);
            });

            // Apply credits to invoices oldest-first per customer.
            const invoicesByCustomer: Record<string, Invoice[]> = {};
            allInvoices.forEach(inv => {
                const cid = String(inv.customerId || '');
                (invoicesByCustomer[cid] = invoicesByCustomer[cid] || []).push(inv);
            });

            const applied: Invoice[] = [];
            Object.keys(invoicesByCustomer).forEach(cid => {
                const list = [...invoicesByCustomer[cid]].sort(
                    (a, b) => new Date(a.invoiceDate || a.createdAt || 0).getTime()
                        - new Date(b.invoiceDate || b.createdAt || 0).getTime(),
                );
                let credit = creditByCustomer[cid] || 0;
                list.forEach(inv => {
                    const explicitPaid = Number(inv.amount_paid) || 0;
                    const total = Number(inv.grandTotal) || 0;
                    let remaining = total - explicitPaid;
                    let appliedFromCredit = 0;
                    if (credit > 0 && remaining > 0.01) {
                        appliedFromCredit = Math.min(credit, remaining);
                        credit -= appliedFromCredit;
                        remaining -= appliedFromCredit;
                    }
                    applied.push({
                        ...inv,
                        amount_paid: explicitPaid + appliedFromCredit,
                        remaining_balance: Math.max(0, remaining),
                    });
                });
            });

            // Show only invoices that still have a balance after applying credits.
            setInvoices(applied.filter(i => !isFullyPaid(i)));
            setLoading(false);
        });
    }, []);

    const filtered = invoices
        .filter(inv => {
            if (statusFilter === 'all') return true;
            if (statusFilter === 'Unpaid') return isUnpaid(inv) && !isOverdue(inv);
            if (statusFilter === 'Partial') return isPartial(inv);
            if (statusFilter === 'Overdue') return isOverdue(inv);
            return true;
        })
        .filter(inv =>
            !search ||
            inv.customerName?.toLowerCase().includes(search.toLowerCase()) ||
            inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'amount') return balanceOf(b) - balanceOf(a);
            if (sortBy === 'customer') return (a.customerName || '').localeCompare(b.customerName || '');
            return new Date(b.invoiceDate || 0).getTime() - new Date(a.invoiceDate || 0).getTime();
        });

    // KPIs use the computed buckets so they reflect what's really in the data.
    const totalOutstanding = filtered.reduce((s, i) => s + balanceOf(i), 0);
    const totalOverdue = filtered.filter(isOverdue).reduce((s, i) => s + balanceOf(i), 0);
    const totalPartial = filtered.filter(isPartial).reduce((s, i) => s + balanceOf(i), 0);

    const statusStyle = (s?: string) => {
        switch (s) {
            case 'Overdue': return 'bg-red-100 text-red-700';
            case 'Partial': return 'bg-yellow-100 text-yellow-700';
            case 'Paid': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-orange-100 text-orange-700';
        }
    };

    const daysOverdue = (inv: Invoice) => {
        if (!inv.dueDate) return null;
        const days = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
        return days > 0 ? days : null;
    };

    const handlePrint = () => window.print();

    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Outstanding Bills', 14, 16);
        doc.setFontSize(10);
        doc.text(`As of ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`${filtered.length} invoices · Total outstanding: ${formatCurrency(totalOutstanding)}`, 14, 28);
        autoTable(doc, {
            startY: 34,
            head: [['Invoice #', 'Customer', 'Date', 'Due Date', 'Status', 'Days Overdue', 'Total', 'Paid', 'Outstanding']],
            body: filtered.map(inv => {
                const dO = daysOverdue(inv);
                const total = Number(inv.grandTotal) || 0;
                const paid = Number(inv.amount_paid) || 0;
                return [
                    inv.invoiceNumber || '',
                    inv.customerName || '',
                    inv.invoiceDate || '',
                    inv.dueDate || '',
                    computedStatus(inv),
                    dO != null ? `${dO} days` : '—',
                    formatCurrency(total),
                    formatCurrency(paid),
                    formatCurrency(total - paid),
                ];
            }),
            foot: [['TOTAL', '', '', '', '', '', '', '', formatCurrency(totalOutstanding)]],
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`OutstandingBills_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                        <FileText size={24} className="text-orange-600" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all print:hidden"><ArrowLeft size={14} /> Back</button>
                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Outstanding Bills</h1>
                        <p className="text-xs text-gray-500 mt-0.5">All unpaid & partial invoices · {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={handlePrint}
                        disabled={loading || filtered.length === 0}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-gray-900 text-gray-900 rounded-xl text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Printer size={14} /> Print
                    </button>
                    <button
                        onClick={exportPDF}
                        disabled={loading || filtered.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download size={14} /> Export PDF
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Outstanding', value: totalOutstanding, color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-200' },
                    { label: 'Overdue', value: totalOverdue, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                    { label: 'Partial Paid', value: totalPartial, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                    { label: 'Total Invoices', value: filtered.length, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', isCount: true },
                ].map((k, i) => (
                    <div key={i} className={`${k.bg} border ${k.border} rounded-2xl p-4`}>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{k.label}</p>
                        <p className={`text-xl font-black font-mono ${k.color}`}>
                            {loading ? '...' : (k as any).isCount ? filtered.length : formatCurrency(k.value as number)}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <input
                        type="text"
                        placeholder="Search by customer or invoice #..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-gray-400" />
                    {(['all', 'Unpaid', 'Partial', 'Overdue'] as const).map(f => (
                        <button key={f} onClick={() => setStatusFilter(f)}
                            className={`px-3 py-1.5 text-xs font-black uppercase rounded-xl transition-all ${statusFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                            {f === 'all' ? 'All' : f}
                        </button>
                    ))}
                </div>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 bg-white"
                >
                    <option value="date">Sort: Date</option>
                    <option value="amount">Sort: Amount</option>
                    <option value="customer">Sort: Customer</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Loading invoices...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center">
                        <CheckCircle size={48} className="mx-auto text-emerald-300 mb-3" />
                        <p className="text-gray-400 font-bold">No outstanding bills found!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Invoice #', 'Customer', 'Invoice Date', 'Due Date', 'Status', 'Total', 'Paid', 'Balance'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(inv => {
                                    const balance = (inv.grandTotal || 0) - (inv.amount_paid || 0);
                                    const overdueDays = daysOverdue(inv);
                                    return (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-all">
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black text-orange-600 font-mono">{inv.invoiceNumber}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-gray-900">{inv.customerName}</p>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-gray-500 font-mono">{inv.invoiceDate}</td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm text-gray-500 font-mono">{inv.dueDate || 'N/A'}</p>
                                                {overdueDays && (
                                                    <p className="text-[10px] text-red-600 font-black flex items-center gap-1 mt-0.5">
                                                        <AlertCircle size={10} /> {overdueDays}d overdue
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {(() => {
                                                    const cs = computedStatus(inv);
                                                    return <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${statusStyle(cs)}`}>{cs}</span>;
                                                })()}
                                            </td>
                                            <td className="px-5 py-4 text-sm font-black font-mono text-gray-900">{formatCurrency(inv.grandTotal || 0)}</td>
                                            <td className="px-5 py-4 text-sm font-mono text-emerald-600">{inv.amount_paid ? formatCurrency(inv.amount_paid) : '—'}</td>
                                            <td className="px-5 py-4 text-sm font-black font-mono text-red-700">{formatCurrency(balance)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-900 text-white">
                                    <td colSpan={5} className="px-5 py-4 text-xs font-black uppercase">Total — {filtered.length} invoices</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(filtered.reduce((s, i) => s + (i.grandTotal || 0), 0))}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(filtered.reduce((s, i) => s + (i.amount_paid || 0), 0))}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totalOutstanding)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
