import { useState, useEffect } from 'react';
import { FileText, Search, Download, Filter, AlertCircle, CheckCircle } from 'lucide-react';
import { getInvoices, type Invoice } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

export default function OutstandingBills() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Unpaid' | 'Partial' | 'Overdue'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');

    useEffect(() => {
        getInvoices().then(inv => {
            setInvoices(inv.filter(i => ['Unpaid', 'Partial', 'Overdue'].includes(i.status || '')));
            setLoading(false);
        });
    }, []);

    const filtered = invoices
        .filter(inv => statusFilter === 'all' || inv.status === statusFilter)
        .filter(inv =>
            !search ||
            inv.customerName?.toLowerCase().includes(search.toLowerCase()) ||
            inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'amount') return (b.grandTotal || 0) - (a.grandTotal || 0);
            if (sortBy === 'customer') return (a.customerName || '').localeCompare(b.customerName || '');
            return new Date(b.invoiceDate || 0).getTime() - new Date(a.invoiceDate || 0).getTime();
        });

    const totalOutstanding = filtered.reduce((s, i) => s + (i.grandTotal || 0) - (i.amount_paid || 0), 0);
    const totalOverdue = filtered.filter(i => i.status === 'Overdue').reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalPartial = filtered.filter(i => i.status === 'Partial').reduce((s, i) => s + (i.grandTotal || 0) - (i.amount_paid || 0), 0);

    const statusStyle = (s?: string) => {
        switch (s) {
            case 'Overdue': return 'bg-red-100 text-red-700';
            case 'Partial': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-orange-100 text-orange-700';
        }
    };

    const daysOverdue = (inv: Invoice) => {
        if (!inv.dueDate) return null;
        const days = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
        return days > 0 ? days : null;
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
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Outstanding Bills</h1>
                        <p className="text-xs text-gray-500 mt-0.5">All unpaid & partial invoices · {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 transition-all">
                    <Download size={14} /> Export
                </button>
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
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by customer or invoice #..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400"
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
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${statusStyle(inv.status)}`}>{inv.status}</span>
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
