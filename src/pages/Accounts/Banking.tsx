import { useState, useEffect } from 'react';
import { Landmark, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft, RefreshCw, Download, Search, DollarSign, CreditCard, Building2 } from 'lucide-react';
import { getPayments, getInvoices, type Payment, type Invoice } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

interface Transaction {
    id: string;
    date: string;
    description: string;
    type: 'Credit' | 'Debit';
    amount: number;
    balance: number;
    reference: string;
    category: string;
}

export default function Banking() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'Credit' | 'Debit'>('all');

    useEffect(() => {
        Promise.all([getPayments(), getInvoices()])
            .then(([p, i]) => {
                setPayments(p);
                setInvoices(i);
            })
            .finally(() => setLoading(false));
    }, []);

    // Build transaction ledger from real payments + invoices
    const transactions: Transaction[] = [
        // Payments received from customers (Credits)
        ...payments.map((p, idx) => ({
            id: `PAY-${p.id || idx}`,
            date: p.date || new Date().toISOString().split('T')[0],
            description: `Payment received`,
            type: 'Credit' as const,
            amount: p.amount || 0,
            balance: 0,
            reference: `PAY-${String(p.id || idx).slice(0, 6).toUpperCase()}`,
            category: 'Customer Payment'
        })),
        // Unpaid invoices (outstanding receivables as Debits)
        ...invoices
            .filter(i => ['Unpaid', 'Partial', 'Overdue'].includes(i.status || ''))
            .map((inv, idx) => ({
                id: `INV-${inv.id || idx}`,
                date: inv.invoiceDate || inv.createdAt?.slice(0, 10) || new Date().toISOString().split('T')[0],
                description: `Invoice ${inv.invoiceNumber || ''} — ${inv.customerName || 'Customer'}`,
                type: 'Debit' as const,
                amount: inv.total || inv.subtotal || 0,
                balance: 0,
                reference: inv.invoiceNumber || `INV-${idx}`,
                category: 'Sales Invoice'
            }))
    ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((tx, idx, arr) => {
            // Calculate running balance
            const bal = arr.slice(idx).reduce((sum, t) => sum + (t.type === 'Credit' ? t.amount : -t.amount), 0);
            return { ...tx, balance: bal };
        });

    const totalCredits = transactions.filter(t => t.type === 'Credit').reduce((s, t) => s + t.amount, 0);
    const totalDebits = transactions.filter(t => t.type === 'Debit').reduce((s, t) => s + t.amount, 0);
    const netBalance = totalCredits - totalDebits;

    const filtered = transactions.filter(t => {
        const matchFilter = filter === 'all' || t.type === filter;
        const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.reference.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-10">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-2xl text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                        <Landmark size={28} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight uppercase">Banking & Reconciliation</h1>
                        <p className="text-gray-400 text-sm mt-1">Real-time transaction ledger • Bettano LLC</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold transition-all">
                    <Download size={16} /> Export Statement
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Net Balance', value: formatCurrency(netBalance), icon: DollarSign, color: netBalance >= 0 ? 'text-emerald-600' : 'text-red-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: 'Total Receipts', value: formatCurrency(totalCredits), icon: ArrowDownLeft, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: 'Outstanding', value: formatCurrency(totalDebits), icon: ArrowUpRight, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
                    { label: 'Transactions', value: String(transactions.length), icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                ].map((kpi, i) => (
                    <div key={i} className={`bg-white rounded-2xl border ${kpi.border} p-5 shadow-sm`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{kpi.label}</span>
                            <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center`}>
                                <kpi.icon size={18} className={kpi.color} />
                            </div>
                        </div>
                        <div className={`text-2xl font-black font-mono ${kpi.color}`}>
                            {loading ? '...' : kpi.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* Bank Account Card */}
            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Building2 size={20} />
                        <span className="text-sm font-black uppercase tracking-widest opacity-80">Main Operating Account</span>
                    </div>
                    <span className="text-xs font-black bg-white/20 px-3 py-1 rounded-full">ACTIVE</span>
                </div>
                <div className="text-3xl font-black font-mono mb-1">{loading ? '...' : formatCurrency(netBalance)}</div>
                <p className="text-orange-100 text-sm">Available Balance</p>
                <div className="mt-4 flex items-center gap-6 text-sm">
                    <div>
                        <p className="opacity-60 text-xs uppercase">Payments Received</p>
                        <p className="font-black">{payments.length} records</p>
                    </div>
                    <div>
                        <p className="opacity-60 text-xs uppercase">Outstanding Invoices</p>
                        <p className="font-black">{invoices.filter(i => ['Unpaid', 'Partial', 'Overdue'].includes(i.status || '')).length} pending</p>
                    </div>
                </div>
            </div>

            {/* Transaction Ledger */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
                    <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw size={16} className="text-orange-500" /> Transaction Ledger
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 w-56"
                            />
                        </div>
                        {(['all', 'Credit', 'Debit'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-xs font-black uppercase rounded-xl transition-all ${filter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center text-gray-400 font-bold">Loading transactions...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-20 text-center">
                        <Landmark size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold uppercase text-sm">No transactions found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Date', 'Description', 'Reference', 'Category', 'Type', 'Amount', 'Balance'].map(h => (
                                        <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.slice(0, 50).map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50 transition-all">
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{tx.date}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{tx.description}</td>
                                        <td className="px-6 py-4 text-xs font-mono text-orange-600 font-bold">{tx.reference}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] font-black rounded-lg uppercase">{tx.category}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1 text-xs font-black ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {tx.type === 'Credit' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-black font-mono ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {tx.type === 'Credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black font-mono text-gray-700">{formatCurrency(tx.balance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filtered.length > 50 && (
                            <div className="p-4 text-center text-xs text-gray-400 font-bold border-t">
                                Showing 50 of {filtered.length} transactions
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
