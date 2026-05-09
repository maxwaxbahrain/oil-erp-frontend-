import { useState, useEffect } from 'react';
import { BookOpen, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { getInvoices, getPayments } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';
import { getPurchaseOrders } from '../../services/purchasesService';

interface DayEntry {
    id: string;
    time: string;
    type: 'Invoice' | 'Payment' | 'Purchase Order' | 'Credit Note';
    description: string;
    reference: string;
    debit: number;
    credit: number;
    party: string;
}

export default function DayBook() {
    const [entries, setEntries] = useState<DayEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        Promise.all([
            getInvoices().catch(() => []),
            getPayments().catch(() => []),
            getPurchaseOrders().catch(() => [])
        ]).then(([invoices, payments, pos]) => {
            const all: DayEntry[] = [
                ...invoices
                    .filter(inv => {
                        const d = inv.invoiceDate || inv.createdAt?.slice(0, 10) || '';
                        return d === selectedDate;
                    })
                    .map(inv => ({
                        id: `inv-${inv.id}`,
                        time: inv.createdAt ? new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
                        type: 'Invoice' as const,
                        description: `Sales Invoice to ${inv.customerName || 'Customer'}`,
                        reference: inv.invoiceNumber || String(inv.id),
                        debit: 0,
                        credit: inv.grandTotal || inv.subtotal || 0,
                        party: inv.customerName || 'Customer'
                    })),
                ...payments
                    .filter(p => {
                        const d = p.payment_date || '';
                        return d === selectedDate;
                    })
                    .map(p => ({
                        id: `pay-${p.id}`,
                        time: '—',
                        type: 'Payment' as const,
                        description: `Payment received`,
                        // customer_id available but no name in Payment interface
                        reference: `PAY-${String(p.id).slice(0, 6).toUpperCase()}`,
                        debit: p.amount || 0,
                        credit: 0,
                        party: 'Customer'
                    })),
                ...pos
                    .filter(po => {
                        const d = po.date?.slice(0, 10) || '';
                        return d === selectedDate;
                    })
                    .map(po => ({
                        id: `po-${po.id}`,
                        time: '—',
                        type: 'Purchase Order' as const,
                        description: `Purchase from ${po.supplierName}`,
                        reference: po.poNumber,
                        debit: po.grandTotal || 0,
                        credit: 0,
                        party: po.supplierName
                    }))
            ].sort((a, b) => a.time.localeCompare(b.time));

            setEntries(all);
            setLoading(false);
        });
    }, [selectedDate]);

    const changeDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d.toISOString().split('T')[0]);
        setLoading(true);
    };

    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);

    const typeStyle = (t: string) => {
        switch (t) {
            case 'Invoice': return 'bg-blue-100 text-blue-700';
            case 'Payment': return 'bg-emerald-100 text-emerald-700';
            case 'Purchase Order': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                        <BookOpen size={24} className="text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Day Book</h1>
                        <p className="text-xs text-gray-500 mt-0.5">All transactions for a single day · used by accountants daily</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 transition-all">
                    <Download size={14} /> Print Day
                </button>
            </div>

            {/* Date Navigator */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
                <button onClick={() => changeDate(-1)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
                    <ChevronLeft size={18} className="text-gray-600" />
                </button>
                <div className="flex items-center gap-4 flex-1 justify-center">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={e => { setSelectedDate(e.target.value); setLoading(true); }}
                        className="px-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 font-mono"
                    />
                    {isToday && <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-black rounded-lg uppercase">Today</span>}
                    <span className="text-sm text-gray-500 font-bold">
                        {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                </div>
                <button onClick={() => changeDate(1)} disabled={isToday} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-30">
                    <ChevronRight size={18} className="text-gray-600" />
                </button>
            </div>

            {/* Day Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Transactions', value: String(entries.length), color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-200', isCurrency: false },
                    { label: 'Total Sales', value: formatCurrency(totalCredit), color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', isCurrency: true },
                    { label: 'Total Payments In', value: formatCurrency(entries.filter(e => e.type === 'Payment').reduce((s, e) => s + e.debit, 0)), color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', isCurrency: true },
                    { label: 'Purchases', value: formatCurrency(entries.filter(e => e.type === 'Purchase Order').reduce((s, e) => s + e.debit, 0)), color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', isCurrency: true },
                ].map((k, i) => (
                    <div key={i} className={`${k.bg} border ${k.border} rounded-2xl p-4`}>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{k.label}</p>
                        <p className={`text-xl font-black font-mono ${k.color}`}>{loading ? '...' : k.value}</p>
                    </div>
                ))}
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-wide">
                        {loading ? 'Loading...' : `${entries.length} transactions on ${selectedDate}`}
                    </p>
                </div>
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Loading...</div>
                ) : entries.length === 0 ? (
                    <div className="p-16 text-center">
                        <BookOpen size={48} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400 font-bold text-sm">No transactions on this date</p>
                        <p className="text-gray-300 text-xs mt-1">Try a different date using the navigator above</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Time', 'Type', 'Description', 'Party', 'Reference', 'Debit', 'Credit'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {entries.map(e => (
                                    <tr key={e.id} className="hover:bg-gray-50 transition-all">
                                        <td className="px-5 py-4 text-xs font-mono text-gray-400">{e.time}</td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${typeStyle(e.type)}`}>{e.type}</span>
                                        </td>
                                        <td className="px-5 py-4 text-sm font-bold text-gray-900">{e.description}</td>
                                        <td className="px-5 py-4 text-sm text-gray-600">{e.party}</td>
                                        <td className="px-5 py-4 text-xs font-mono text-orange-600 font-bold">{e.reference}</td>
                                        <td className="px-5 py-4 text-sm font-black font-mono text-red-700">
                                            {e.debit > 0 ? <span className="flex items-center gap-1"><TrendingDown size={12} />{formatCurrency(e.debit)}</span> : '—'}
                                        </td>
                                        <td className="px-5 py-4 text-sm font-black font-mono text-emerald-700">
                                            {e.credit > 0 ? <span className="flex items-center gap-1"><TrendingUp size={12} />{formatCurrency(e.credit)}</span> : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-900 text-white">
                                    <td colSpan={5} className="px-5 py-4 text-xs font-black uppercase">Day Total</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totalDebit)}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totalCredit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
