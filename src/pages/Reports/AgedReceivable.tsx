import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Clock, Download, Search, AlertTriangle, CheckCircle , ArrowLeft } from 'lucide-react';
import { getInvoices, type Invoice } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

interface AgedCustomer {
    customerId: string;
    customerName: string;
    current: number;      // 0-30 days
    days30: number;       // 31-60 days
    days60: number;       // 61-90 days
    days90: number;       // 90+ days
    total: number;
    invoices: Invoice[];
}

export default function AgedReceivable() {
    const navigate = useNavigate();
    const [data, setData] = useState<AgedCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [asOf] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        getInvoices().then(invoices => {
            const today = new Date();
            const unpaid = invoices.filter(inv =>
                ['Unpaid', 'Partial', 'Overdue'].includes(inv.status || '')
            );

            const customerMap: Record<string, AgedCustomer> = {};
            unpaid.forEach(inv => {
                const name = inv.customerName || 'Unknown';
                const id = inv.customerId || name;
                if (!customerMap[id]) {
                    customerMap[id] = { customerId: id, customerName: name, current: 0, days30: 0, days60: 0, days90: 0, total: 0, invoices: [] };
                }
                const due = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate || inv.createdAt || today);
                const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
                const balance = (inv.grandTotal || inv.subtotal || 0) - (inv.amount_paid || 0);
                if (balance <= 0) return;
                if (daysOverdue <= 0) customerMap[id].current += balance;
                else if (daysOverdue <= 30) customerMap[id].days30 += balance;
                else if (daysOverdue <= 60) customerMap[id].days60 += balance;
                else customerMap[id].days90 += balance;
                customerMap[id].total += balance;
                customerMap[id].invoices.push(inv);
            });

            setData(Object.values(customerMap).sort((a, b) => b.total - a.total));
            setLoading(false);
        });
    }, []);

    const filtered = data.filter(c => c.customerName.toLowerCase().includes(search.toLowerCase()));
    const totals = filtered.reduce((acc, c) => ({
        current: acc.current + c.current,
        days30: acc.days30 + c.days30,
        days60: acc.days60 + c.days60,
        days90: acc.days90 + c.days90,
        total: acc.total + c.total
    }), { current: 0, days30: 0, days60: 0, days90: 0, total: 0 });

    const ageBadge = (c: AgedCustomer) => {
        if (c.days90 > 0) return { label: '90+ days', color: 'bg-red-100 text-red-700' };
        if (c.days60 > 0) return { label: '60+ days', color: 'bg-orange-100 text-orange-700' };
        if (c.days30 > 0) return { label: '30+ days', color: 'bg-yellow-100 text-yellow-700' };
        return { label: 'Current', color: 'bg-green-100 text-green-700' };
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                        <Clock size={24} className="text-red-600" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"><ArrowLeft size={14} /> Back</button>
                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Aged Receivable</h1>
                        <p className="text-xs text-gray-500 mt-0.5">As of {asOf} · Outstanding customer balances by age</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 transition-all">
                    <Download size={14} /> Export PDF
                </button>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Current (0–30d)', value: totals.current, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: '31–60 Days', value: totals.days30, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                    { label: '61–90 Days', value: totals.days60, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                    { label: '90+ Days', value: totals.days90, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                    { label: 'Total Outstanding', value: totals.total, color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-300' },
                ].map((b, i) => (
                    <div key={i} className={`${b.bg} border ${b.border} rounded-2xl p-4`}>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{b.label}</p>
                        <p className={`text-lg font-black font-mono ${b.color}`}>{loading ? '...' : formatCurrency(b.value)}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-wide">{filtered.length} Customers with Outstanding Balances</p>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search customer..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 w-52"
                        />
                    </div>
                </div>
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center">
                        <CheckCircle size={48} className="mx-auto text-emerald-300 mb-3" />
                        <p className="text-gray-400 font-bold">All customers are up to date!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Customer', 'Status', 'Current (0–30d)', '31–60 Days', '61–90 Days', '90+ Days', 'Total'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(c => {
                                    const badge = ageBadge(c);
                                    return (
                                        <>
                                            <tr
                                                key={c.customerId}
                                                className="hover:bg-gray-50 cursor-pointer transition-all"
                                                onClick={() => setExpanded(expanded === c.customerId ? null : c.customerId)}
                                            >
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-black text-gray-900">{c.customerName}</p>
                                                    <p className="text-xs text-gray-400">{c.invoices.length} invoice{c.invoices.length !== 1 ? 's' : ''}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${badge.color}`}>{badge.label}</span>
                                                </td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-emerald-700">{c.current > 0 ? formatCurrency(c.current) : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-yellow-700">{c.days30 > 0 ? formatCurrency(c.days30) : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-orange-700">{c.days60 > 0 ? formatCurrency(c.days60) : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-red-700">{c.days90 > 0 ? <span className="flex items-center gap-1"><AlertTriangle size={12} />{formatCurrency(c.days90)}</span> : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-black font-mono text-gray-900">{formatCurrency(c.total)}</td>
                                            </tr>
                                            {expanded === c.customerId && (
                                                <tr key={`${c.customerId}-exp`} className="bg-gray-50">
                                                    <td colSpan={7} className="px-5 py-3">
                                                        <div className="space-y-2">
                                                            {c.invoices.map(inv => (
                                                                <div key={inv.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                    <span className="font-black text-gray-700">{inv.invoiceNumber}</span>
                                                                    <span className="text-gray-500">{inv.invoiceDate}</span>
                                                                    <span className="text-gray-500">Due: {inv.dueDate || 'N/A'}</span>
                                                                    <span className={`font-black ${inv.status === 'Overdue' ? 'text-red-600' : 'text-orange-600'}`}>{inv.status}</span>
                                                                    <span className="font-black font-mono text-gray-900">{formatCurrency((inv.grandTotal || 0) - (inv.amount_paid || 0))}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                                <tr className="bg-gray-900 text-white">
                                    <td className="px-5 py-4 text-xs font-black uppercase tracking-wide" colSpan={2}>Total</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totals.current)}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totals.days30)}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totals.days60)}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totals.days90)}</td>
                                    <td className="px-5 py-4 text-sm font-black font-mono">{formatCurrency(totals.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 text-center">Click any row to expand invoice details · Sorted by total outstanding (highest first)</p>
        </div>
    );
}
