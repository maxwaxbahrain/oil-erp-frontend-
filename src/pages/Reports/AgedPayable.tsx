import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Clock, Download, Search, AlertTriangle, CheckCircle , ArrowLeft } from 'lucide-react';
import { getPurchaseOrders } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';

interface AgedSupplier {
    supplierId: string;
    supplierName: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    total: number;
    orders: any[];
}

export default function AgedPayable() {
    const navigate = useNavigate();
    const [data, setData] = useState<AgedSupplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        getPurchaseOrders().then(orders => {
            const today = new Date();
            const unpaid = orders.filter(o =>
                ['Pending', 'Approved', 'GRN', 'Draft'].includes(o.status) &&
                o.payment_status !== 'Paid'
            );

            const supplierMap: Record<string, AgedSupplier> = {};
            unpaid.forEach(po => {
                const name = po.supplierName || 'Unknown';
                const id = po.supplierId || name;
                if (!supplierMap[id]) {
                    supplierMap[id] = { supplierId: id, supplierName: name, current: 0, days30: 0, days60: 0, days90: 0, total: 0, orders: [] };
                }
                const poDate = po.date ? new Date(po.date) : today;
                const daysOld = Math.floor((today.getTime() - poDate.getTime()) / (1000 * 60 * 60 * 24));
                const balance = (po.grandTotal || 0) - (po.amount_paid || 0);
                if (balance <= 0) return;
                if (daysOld <= 30) supplierMap[id].current += balance;
                else if (daysOld <= 60) supplierMap[id].days30 += balance;
                else if (daysOld <= 90) supplierMap[id].days60 += balance;
                else supplierMap[id].days90 += balance;
                supplierMap[id].total += balance;
                supplierMap[id].orders.push(po);
            });

            setData(Object.values(supplierMap).sort((a, b) => b.total - a.total));
            setLoading(false);
        });
    }, []);

    const filtered = data.filter(s => s.supplierName.toLowerCase().includes(search.toLowerCase()));
    const totals = filtered.reduce((acc, s) => ({
        current: acc.current + s.current,
        days30: acc.days30 + s.days30,
        days60: acc.days60 + s.days60,
        days90: acc.days90 + s.days90,
        total: acc.total + s.total
    }), { current: 0, days30: 0, days60: 0, days90: 0, total: 0 });

    const ageBadge = (s: AgedSupplier) => {
        if (s.days90 > 0) return { label: '90+ days', color: 'bg-red-100 text-red-700' };
        if (s.days60 > 0) return { label: '60+ days', color: 'bg-orange-100 text-orange-700' };
        if (s.days30 > 0) return { label: '30+ days', color: 'bg-yellow-100 text-yellow-700' };
        return { label: 'Current', color: 'bg-green-100 text-green-700' };
    };

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Clock size={24} className="text-amber-600" />
                    </div>
                    <div>
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all"><ArrowLeft size={14} /> Back</button>
                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Aged Payable</h1>
                        <p className="text-xs text-gray-500 mt-0.5">As of {new Date().toLocaleDateString()} · Outstanding supplier balances by age</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-black uppercase hover:bg-gray-700 transition-all">
                    <Download size={14} /> Export PDF
                </button>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: 'Current (0–30d)', value: totals.current, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                    { label: '31–60 Days', value: totals.days30, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                    { label: '61–90 Days', value: totals.days60, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
                    { label: '90+ Days', value: totals.days90, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                    { label: 'Total Payable', value: totals.total, color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-300' },
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
                    <p className="text-sm font-black text-gray-700 uppercase tracking-wide">{filtered.length} Suppliers with Outstanding Balances</p>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search supplier..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 w-52" />
                    </div>
                </div>
                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-16 text-center">
                        <CheckCircle size={48} className="mx-auto text-emerald-300 mb-3" />
                        <p className="text-gray-400 font-bold">All suppliers are settled!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    {['Supplier', 'Status', 'Current (0–30d)', '31–60 Days', '61–90 Days', '90+ Days', 'Total Owed'].map(h => (
                                        <th key={h} className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.map(s => {
                                    const badge = ageBadge(s);
                                    return (
                                        <>
                                            <tr key={s.supplierId} className="hover:bg-gray-50 cursor-pointer transition-all"
                                                onClick={() => setExpanded(expanded === s.supplierId ? null : s.supplierId)}>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm font-black text-gray-900">{s.supplierName}</p>
                                                    <p className="text-xs text-gray-400">{s.orders.length} PO{s.orders.length !== 1 ? 's' : ''}</p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${badge.color}`}>{badge.label}</span>
                                                </td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-emerald-700">{s.current > 0 ? formatCurrency(s.current) : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-yellow-700">{s.days30 > 0 ? formatCurrency(s.days30) : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-orange-700">{s.days60 > 0 ? formatCurrency(s.days60) : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-mono font-bold text-red-700">{s.days90 > 0 ? <span className="flex items-center gap-1"><AlertTriangle size={12} />{formatCurrency(s.days90)}</span> : '—'}</td>
                                                <td className="px-5 py-4 text-sm font-black font-mono text-gray-900">{formatCurrency(s.total)}</td>
                                            </tr>
                                            {expanded === s.supplierId && (
                                                <tr key={`${s.supplierId}-exp`} className="bg-gray-50">
                                                    <td colSpan={7} className="px-5 py-3">
                                                        <div className="space-y-2">
                                                            {s.orders.map((po: any) => (
                                                                <div key={po.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                    <span className="font-black text-gray-700">{po.poNumber}</span>
                                                                    <span className="text-gray-500">{po.date?.slice(0, 10)}</span>
                                                                    <span className={`font-black ${po.status === 'Pending' ? 'text-yellow-600' : 'text-blue-600'}`}>{po.status}</span>
                                                                    <span className="font-black font-mono text-gray-900">{formatCurrency(po.grandTotal || 0)}</span>
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
                                    <td className="px-5 py-4 text-xs font-black uppercase" colSpan={2}>Total</td>
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
            <p className="text-xs text-gray-400 text-center">Click any row to expand PO details · Sorted by total owed (highest first)</p>
        </div>
    );
}
