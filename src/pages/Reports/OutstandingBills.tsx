import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { FileText, Download, AlertCircle, CheckCircle, ArrowLeft, Printer, ChevronLeft, ChevronRight, Send, MessageCircle, Mail, Smartphone, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getInvoices, getPayments, type Invoice } from '../../services/api';
import { getCustomers } from '../../services/customerService';
import { formatCurrency } from '../../services/settingsService';

// Page-size for the bottom pager.
const PAGE_SIZE = 25;

// QuickBooks-style status derivation from actual amounts and dates.
const balanceOf = (i: Invoice) => (Number(i.grandTotal) || 0) - (Number(i.amount_paid) || 0);
const isFullyPaid = (i: Invoice) => balanceOf(i) <= 0.01;
const isPartial = (i: Invoice) => Number(i.amount_paid) > 0 && balanceOf(i) > 0.01;
const isUnpaidNoPayment = (i: Invoice) => Number(i.amount_paid || 0) === 0 && balanceOf(i) > 0.01;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const todayStart = () => startOfDay(new Date());

const daysPastDue = (i: Invoice): number => {
    if (!i.dueDate || balanceOf(i) <= 0.01) return 0;
    const due = new Date(i.dueDate);
    if (Number.isNaN(due.getTime())) return 0;
    return Math.floor((todayStart() - startOfDay(due)) / 86400000);
};

const isOverdue = (i: Invoice) => daysPastDue(i) > 0; // 'due today' is NOT overdue
const isDueSoon = (i: Invoice) => {
    if (!i.dueDate || balanceOf(i) <= 0.01) return false;
    const due = new Date(i.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const diffDays = Math.floor((startOfDay(due) - todayStart()) / 86400000);
    return diffDays >= 0 && diffDays <= 7;
};

const computedStatus = (i: Invoice): 'Paid' | 'Partial' | 'Overdue' | 'Due soon' | 'Unpaid' => {
    if (isFullyPaid(i)) return 'Paid';
    if (isOverdue(i)) return 'Overdue';
    if (isDueSoon(i)) return 'Due soon';
    if (isPartial(i)) return 'Partial';
    return 'Unpaid';
};

const statusBadge = (s: string) => {
    switch (s) {
        case 'Overdue':  return 'bg-rose-100 text-rose-700';
        case 'Due soon': return 'bg-amber-100 text-amber-700';
        case 'Partial':  return 'bg-yellow-100 text-yellow-700';
        case 'Paid':     return 'bg-emerald-100 text-emerald-700';
        default:         return 'bg-gray-100 text-gray-600';
    }
};

type FilterKey = 'all' | 'Overdue' | 'Due soon' | 'Partial' | 'Unpaid';

export default function OutstandingBills() {
    const navigate = useNavigate();
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [paidThisMonth, setPaidThisMonth] = useState({ amount: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
    const [customerFilter, setCustomerFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer' | 'due'>('due');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    // Customer contact lookup so reminders know phone + email per customer.
    const [contactsByCustomerId, setContactsByCustomerId] = useState<Record<string, { name: string; phone: string; email: string }>>({});
    const [reminderOpen, setReminderOpen] = useState(false);
    const defaultMessage = (name: string, amount: string) =>
        `Hi ${name || 'there'},\n\nThis is a friendly reminder that your account currently has an outstanding balance of ${amount}. Please settle at your earliest convenience.\n\nThank you,\nSoltol Team`;
    const [reminderMessage, setReminderMessage] = useState('');

    useEffect(() => {
        // QuickBooks-style: auto-apply each customer's payments to their oldest
        // open invoices first (FIFO). Backend invoices all have paid_amount=0
        // because customer payments live in a separate Transactions table and
        // are never linked to specific invoices.
        Promise.all([getInvoices(), getPayments().catch(() => []), getCustomers().catch(() => [])]).then(([invs, pays, customers]) => {
            const contacts: Record<string, { name: string; phone: string; email: string }> = {};
            (customers || []).forEach((c: any) => {
                const cid = String(c?.id ?? '');
                if (!cid) return;
                contacts[cid] = {
                    name: String(c?.name ?? '').trim(),
                    phone: String(c?.phone ?? '').trim(),
                    email: String(c?.email ?? '').trim(),
                };
            });
            setContactsByCustomerId(contacts);
            const creditByCustomer: Record<string, number> = {};
            (pays || []).forEach((p: any) => {
                const cid = String(p?.customer_id ?? '');
                if (!cid) return;
                creditByCustomer[cid] = (creditByCustomer[cid] || 0) + (Number(p?.amount) || 0);
            });

            // "Paid this month" = sum of payment amounts dated this calendar month.
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            let paidAmt = 0;
            let paidCount = 0;
            (pays || []).forEach((p: any) => {
                const t = new Date(p?.payment_date || 0).getTime();
                if (!Number.isNaN(t) && t >= monthStart) {
                    paidAmt += Number(p?.amount) || 0;
                    paidCount += 1;
                }
            });
            setPaidThisMonth({ amount: paidAmt, count: paidCount });

            // Apply credit oldest-first per customer.
            const invoicesByCustomer: Record<string, Invoice[]> = {};
            invs.forEach(inv => {
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
                    let fromCredit = 0;
                    if (credit > 0 && remaining > 0.01) {
                        fromCredit = Math.min(credit, remaining);
                        credit -= fromCredit;
                        remaining -= fromCredit;
                    }
                    applied.push({
                        ...inv,
                        amount_paid: explicitPaid + fromCredit,
                        remaining_balance: Math.max(0, remaining),
                    });
                });
            });

            setAllInvoices(applied.filter(i => !isFullyPaid(i)));
            setLoading(false);
        });
    }, []);

    // Customer list for the dropdown — distinct resolved names sorted alphabetically.
    const customerOptions = useMemo(() => {
        const set = new Set<string>();
        allInvoices.forEach(i => { set.add(nameOf(i)); });
        set.delete('Unknown');
        return Array.from(set).sort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allInvoices, contactsByCustomerId]);

    // Filter pipeline (uses resolved name so customers with empty customerName
    // are still matched correctly).
    const passesCustomer = (inv: Invoice) => customerFilter === 'all' || nameOf(inv) === customerFilter;
    const passesSearch = (inv: Invoice) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return nameOf(inv).toLowerCase().includes(q) ||
            (inv.invoiceNumber || '').toLowerCase().includes(q);
    };
    const passesStatus = (inv: Invoice) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'Overdue')  return isOverdue(inv);
        if (statusFilter === 'Due soon') return isDueSoon(inv);
        if (statusFilter === 'Partial')  return isPartial(inv);
        if (statusFilter === 'Unpaid')   return isUnpaidNoPayment(inv) && !isOverdue(inv) && !isDueSoon(inv);
        return true;
    };

    const baseScoped = allInvoices.filter(inv => passesCustomer(inv) && passesSearch(inv));
    const filtered = baseScoped.filter(passesStatus).sort((a, b) => {
        if (sortBy === 'amount')   return balanceOf(b) - balanceOf(a);
        if (sortBy === 'customer') return nameOf(a).localeCompare(nameOf(b));
        if (sortBy === 'date')     return new Date(b.invoiceDate || 0).getTime() - new Date(a.invoiceDate || 0).getTime();
        // 'due' — most overdue first, then soonest due
        return (new Date(a.dueDate || a.invoiceDate || 0).getTime()) - (new Date(b.dueDate || b.invoiceDate || 0).getTime());
    });

    // Filter pill counts use the customer+search scope (so a customer filter narrows the pill numbers too).
    const counts = {
        all: baseScoped.length,
        Overdue: baseScoped.filter(isOverdue).length,
        'Due soon': baseScoped.filter(isDueSoon).length,
        Partial: baseScoped.filter(isPartial).length,
        Unpaid: baseScoped.filter(i => isUnpaidNoPayment(i) && !isOverdue(i) && !isDueSoon(i)).length,
    };

    // KPI tile amounts based on customer+search scope (independent of which pill is selected).
    const totalOutstanding = baseScoped.reduce((s, i) => s + balanceOf(i), 0);
    const totalOverdue     = baseScoped.filter(isOverdue).reduce((s, i) => s + balanceOf(i), 0);
    const totalDueSoon     = baseScoped.filter(isDueSoon).reduce((s, i) => s + balanceOf(i), 0);

    // Aging buckets (past-due age) for the row of 4 aging cards.
    const aging = baseScoped.reduce(
        (acc, i) => {
            const d = daysPastDue(i);
            const bal = balanceOf(i);
            if (d <= 30)       acc.current += bal;
            else if (d <= 60)  acc.b30    += bal;
            else if (d <= 90)  acc.b60    += bal;
            else               acc.b90    += bal;
            return acc;
        },
        { current: 0, b30: 0, b60: 0, b90: 0 },
    );

    // Pagination
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageStart = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);
    useEffect(() => { setPage(1); }, [statusFilter, customerFilter, search, sortBy]);

    const allOnPageSelected = pageRows.length > 0 && pageRows.every(r => selected.has(String(r.id)));
    const toggleAllOnPage = () => {
        const next = new Set(selected);
        if (allOnPageSelected) pageRows.forEach(r => next.delete(String(r.id)));
        else pageRows.forEach(r => next.add(String(r.id)));
        setSelected(next);
    };
    const toggleRow = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    // Resolve a customer display name. Some imported invoices have an empty
    // customerName field; fall back to the live customer contact lookup so
    // the table never shows a blank Customer column for those rows.
    const nameOf = (inv: Invoice) => {
        const n = (inv.customerName || '').trim();
        if (n) return n;
        const cid = String(inv.customerId || '');
        return contactsByCustomerId[cid]?.name?.trim() || 'Unknown';
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
            head: [['Bill #', 'Customer', 'Bill date', 'Due date', 'Status', 'Days past due', 'Total', 'Paid', 'Balance']],
            body: filtered.map(inv => {
                const dp = daysPastDue(inv);
                const total = Number(inv.grandTotal) || 0;
                const paid = Number(inv.amount_paid) || 0;
                return [
                    inv.invoiceNumber || '',
                    nameOf(inv),
                    inv.invoiceDate || '',
                    inv.dueDate || '',
                    computedStatus(inv),
                    dp > 0 ? `${dp}d` : '—',
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

    const asOf = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                        <FileText size={24} className="text-orange-600" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all print:hidden"><ArrowLeft size={14} /> Back</button>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Outstanding bills</h1>
                        <p className="text-xs text-gray-500 mt-0.5">Accounts receivable · as of {asOf}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={exportPDF}
                        disabled={loading || filtered.length === 0}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Download size={14} /> Export
                    </button>
                    <button
                        onClick={() => {
                            if (selected.size === 0) {
                                alert('Select at least one bill (check the boxes in the table) to send a reminder.');
                                return;
                            }
                            setReminderOpen(true);
                        }}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={14} /> Send reminders
                    </button>
                    <button
                        onClick={handlePrint}
                        disabled={loading || filtered.length === 0}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                        <Printer size={14} /> Print
                    </button>
                </div>
            </div>

            {/* Top KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Total outstanding</p>
                    <p className="text-3xl font-black font-mono text-blue-700">{loading ? '...' : formatCurrency(totalOutstanding)}</p>
                    <p className="text-xs text-gray-400 mt-1">{baseScoped.length} bills open</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Overdue</p>
                    <p className="text-3xl font-black font-mono text-rose-600">{loading ? '...' : formatCurrency(totalOverdue)}</p>
                    <p className="text-xs text-gray-400 mt-1">{counts.Overdue} bills past due</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Due this week</p>
                    <p className="text-3xl font-black font-mono text-amber-600">{loading ? '...' : formatCurrency(totalDueSoon)}</p>
                    <p className="text-xs text-gray-400 mt-1">{counts['Due soon']} bills due soon</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 mb-1">Paid this month</p>
                    <p className="text-3xl font-black font-mono text-emerald-600">{loading ? '...' : formatCurrency(paidThisMonth.amount)}</p>
                    <p className="text-xs text-gray-400 mt-1">{paidThisMonth.count} payments received</p>
                </div>
            </div>

            {/* Aging buckets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl p-5 border bg-emerald-50 border-emerald-100">
                    <p className="text-sm font-semibold text-emerald-700">Current (0–30 days)</p>
                    <p className="text-2xl font-black font-mono text-emerald-700 mt-1">{loading ? '...' : formatCurrency(aging.current)}</p>
                </div>
                <div className="rounded-2xl p-5 border bg-yellow-50 border-yellow-100">
                    <p className="text-sm font-semibold text-yellow-700">31–60 days</p>
                    <p className="text-2xl font-black font-mono text-yellow-700 mt-1">{loading ? '...' : formatCurrency(aging.b30)}</p>
                </div>
                <div className="rounded-2xl p-5 border bg-orange-50 border-orange-100">
                    <p className="text-sm font-semibold text-orange-700">61–90 days</p>
                    <p className="text-2xl font-black font-mono text-orange-700 mt-1">{loading ? '...' : formatCurrency(aging.b60)}</p>
                </div>
                <div className="rounded-2xl p-5 border bg-rose-50 border-rose-100">
                    <p className="text-sm font-semibold text-rose-700">&gt;90 days (critical)</p>
                    <p className="text-2xl font-black font-mono text-rose-700 mt-1">{loading ? '...' : formatCurrency(aging.b90)}</p>
                </div>
            </div>

            {/* Filter pills + search */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3 flex-wrap print:hidden">
                {([
                    { key: 'all',       label: 'All',        n: counts.all },
                    { key: 'Overdue',   label: 'Overdue',    n: counts.Overdue },
                    { key: 'Due soon',  label: 'Due soon',   n: counts['Due soon'] },
                    { key: 'Partial',   label: 'Partial',    n: counts.Partial },
                    { key: 'Unpaid',    label: 'Unpaid',     n: counts.Unpaid },
                ] as { key: FilterKey; label: string; n: number }[]).map(p => (
                    <button
                        key={p.key}
                        onClick={() => setStatusFilter(p.key)}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${statusFilter === p.key
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                    >
                        {p.label} ({p.n})
                    </button>
                ))}
                <input
                    type="text"
                    placeholder="Customer, invoice #..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="ml-auto px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 w-64"
                />
            </div>

            {/* Customer dropdown + sort */}
            <div className="flex items-center gap-3 print:hidden">
                <select
                    value={customerFilter}
                    onChange={e => setCustomerFilter(e.target.value)}
                    className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 bg-white font-semibold"
                >
                    <option value="all">All customers</option>
                    {customerOptions.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as any)}
                    className="flex-1 px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 bg-white font-semibold"
                >
                    <option value="due">Sort: due date</option>
                    <option value="date">Sort: invoice date</option>
                    <option value="amount">Sort: balance (highest)</option>
                    <option value="customer">Sort: customer (A–Z)</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Loading invoices...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center">
                        <CheckCircle size={48} className="mx-auto text-emerald-300 mb-3" />
                        <p className="text-gray-400 font-bold">No outstanding bills match the current filter.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 w-8 print:hidden">
                                            <input
                                                type="checkbox"
                                                checked={allOnPageSelected}
                                                onChange={toggleAllOnPage}
                                                className="rounded"
                                            />
                                        </th>
                                        {['Bill #', 'Customer', 'Bill date', 'Due date', 'Status', 'Total', 'Balance'].map(h => (
                                            <th key={h} className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {pageRows.map(inv => {
                                        const balance = balanceOf(inv);
                                        const dpd = daysPastDue(inv);
                                        const cs = computedStatus(inv);
                                        const id = String(inv.id);
                                        return (
                                            <tr key={id} className="hover:bg-gray-50 transition-all">
                                                <td className="px-4 py-4 print:hidden">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(id)}
                                                        onChange={() => toggleRow(id)}
                                                        className="rounded"
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold text-gray-900 font-mono">{inv.invoiceNumber}</td>
                                                <td className="px-4 py-4 text-sm font-semibold text-gray-800">{nameOf(inv)}</td>
                                                <td className="px-4 py-4 text-sm text-gray-500 font-mono">{inv.invoiceDate || '—'}</td>
                                                <td className="px-4 py-4">
                                                    <p className="text-sm text-gray-500 font-mono">{inv.dueDate || '—'}</p>
                                                    {dpd > 0 && (
                                                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                                                            <AlertCircle size={10} /> {dpd}d overdue
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${statusBadge(cs)}`}>
                                                        {cs}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm font-bold font-mono text-gray-900">{formatCurrency(Number(inv.grandTotal) || 0)}</td>
                                                <td className="px-4 py-4 text-sm font-black font-mono text-rose-700">{formatCurrency(balance)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 print:hidden">
                            <p className="text-sm text-gray-500">
                                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} bills
                                {selected.size > 0 && <span className="ml-2 text-gray-700 font-bold">· {selected.size} selected</span>}
                            </p>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                {Array.from({ length: Math.min(5, pageCount) }, (_, i) => {
                                    // Show first 5 pages, or center on current if pageCount > 5
                                    let p = i + 1;
                                    if (pageCount > 5 && page > 3) p = Math.min(pageCount - 4, page - 2) + i;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${page === p
                                                ? 'bg-gray-900 text-white'
                                                : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                                    disabled={page === pageCount}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Send reminders modal */}
            {reminderOpen && (() => {
                // Group selected invoices by customer; sum balance per customer.
                const groups: Record<string, { name: string; phone: string; email: string; balance: number; bills: string[] }> = {};
                allInvoices.forEach(inv => {
                    const id = String(inv.id);
                    if (!selected.has(id)) return;
                    const cid = String(inv.customerId || '');
                    const contact = contactsByCustomerId[cid] || { name: '', phone: '', email: '' };
                    if (!groups[cid]) {
                        groups[cid] = { name: nameOf(inv), phone: contact.phone || '', email: contact.email || '', balance: 0, bills: [] };
                    }
                    groups[cid].balance += balanceOf(inv);
                    groups[cid].bills.push(inv.invoiceNumber || `#${inv.id}`);
                });
                const recipients = Object.values(groups);
                const cleanPhone = (p: string) => p.replace(/[^\d+]/g, '');
                const buildMessage = (name: string, balance: number) => {
                    const tpl = reminderMessage.trim() || defaultMessage(name, formatCurrency(balance));
                    return tpl
                        .replace(/\{name\}/g, name || 'there')
                        .replace(/\{amount\}/g, formatCurrency(balance));
                };
                const waLink = (phone: string, msg: string) => `https://wa.me/${cleanPhone(phone).replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`;
                const smsLink = (phone: string, msg: string) => `sms:${cleanPhone(phone)}?&body=${encodeURIComponent(msg)}`;
                const mailLink = (email: string, msg: string) => `mailto:${email}?subject=${encodeURIComponent('Outstanding balance reminder')}&body=${encodeURIComponent(msg)}`;
                return (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:hidden" onClick={() => setReminderOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div>
                                    <h2 className="text-lg font-black text-gray-900">Send reminders</h2>
                                    <p className="text-xs text-gray-500 mt-0.5">{recipients.length} customer{recipients.length !== 1 ? 's' : ''} · {selected.size} bill{selected.size !== 1 ? 's' : ''}</p>
                                </div>
                                <button onClick={() => setReminderOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="px-6 py-4 border-b border-gray-100">
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Message template <span className="text-gray-400 font-normal normal-case">(use <code className="bg-gray-100 px-1 rounded">{'{name}'}</code> and <code className="bg-gray-100 px-1 rounded">{'{amount}'}</code> placeholders)</span></label>
                                <textarea
                                    value={reminderMessage}
                                    onChange={e => setReminderMessage(e.target.value)}
                                    placeholder={defaultMessage('{name}', '{amount}')}
                                    rows={5}
                                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 font-mono"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">Leave blank to use the default template. Each customer's message will substitute their name and balance.</p>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {recipients.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-6">No recipients — close this dialog and select bills first.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {recipients.map((r, idx) => {
                                            const msg = buildMessage(r.name, r.balance);
                                            const hasPhone = !!r.phone;
                                            const hasEmail = !!r.email;
                                            return (
                                                <div key={idx} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div>
                                                            <p className="font-bold text-gray-900">{r.name}</p>
                                                            <p className="text-xs text-gray-500 mt-0.5">{r.bills.length} bill{r.bills.length !== 1 ? 's' : ''} · balance <span className="font-mono font-bold text-rose-700">{formatCurrency(r.balance)}</span></p>
                                                            <p className="text-[11px] text-gray-400 mt-1">📞 {r.phone || 'no phone'} · ✉ {r.email || 'no email'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <a
                                                            href={hasPhone ? waLink(r.phone, msg) : undefined}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            aria-disabled={!hasPhone}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${hasPhone ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'}`}
                                                        >
                                                            <MessageCircle size={14} /> WhatsApp
                                                        </a>
                                                        <a
                                                            href={hasPhone ? smsLink(r.phone, msg) : undefined}
                                                            aria-disabled={!hasPhone}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${hasPhone ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'}`}
                                                        >
                                                            <Smartphone size={14} /> SMS
                                                        </a>
                                                        <a
                                                            href={hasEmail ? mailLink(r.email, msg) : undefined}
                                                            aria-disabled={!hasEmail}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${hasEmail ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'}`}
                                                        >
                                                            <Mail size={14} /> Email
                                                        </a>
                                                        <button
                                                            onClick={() => { navigator.clipboard?.writeText(msg); }}
                                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-700 hover:bg-white transition-all"
                                                            title="Copy the rendered message to clipboard"
                                                        >
                                                            Copy text
                                                        </button>
                                                    </div>
                                                    <details className="mt-3">
                                                        <summary className="text-[11px] text-gray-500 cursor-pointer">Preview message</summary>
                                                        <pre className="mt-2 text-xs bg-white rounded p-3 whitespace-pre-wrap text-gray-700 border border-gray-100">{msg}</pre>
                                                    </details>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => setReminderOpen(false)}
                                    className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-700"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
