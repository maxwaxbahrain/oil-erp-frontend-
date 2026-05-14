import { useNavigate } from 'react-router-dom';
import { useState, useEffect, Fragment } from 'react';
import { Clock, Download, AlertTriangle, CheckCircle , ArrowLeft, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPurchaseOrders, type SupplierPayment, type PurchaseOrder } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';

interface AgedSupplier {
    supplierId: string;
    supplierName: string;
    current: number;
    days30: number;
    days60: number;
    days90: number;
    total: number;
    orders: (PurchaseOrder & { remaining: number })[];
}

export default function AgedPayable() {
    const navigate = useNavigate();
    const [data, setData] = useState<AgedSupplier[]>([]);
    const [paidThisMonth, setPaidThisMonth] = useState({ amount: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        // QuickBooks-style FIFO supplier-payment application.
        // Supplier payments live in a separate localStorage bucket and are
        // NOT written back to each PO's `amount_paid` field, so without this
        // every PO would look fully unpaid. We instead:
        //   1. Read all POs.
        //   2. Read all supplier payments.
        //   3. Per supplier, sort POs oldest-first and consume that supplier's
        //      payment credit from the oldest open PO first.
        getPurchaseOrders().then(orders => {
            const allPayments: SupplierPayment[] = (() => {
                try { return JSON.parse(localStorage.getItem('supplier_payments') || '[]'); }
                catch { return []; }
            })();

            // Sum payments per supplier and remember which fell in the current
            // calendar month (drives the "Paid this month" KPI).
            const creditBySupplier: Record<string, number> = {};
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            let paidAmt = 0;
            let paidCount = 0;
            allPayments.forEach(p => {
                const sid = String(p.supplierId || '');
                if (sid) creditBySupplier[sid] = (creditBySupplier[sid] || 0) + (Number(p.amount) || 0);
                const t = new Date(p.date || 0).getTime();
                if (!Number.isNaN(t) && t >= monthStart) {
                    paidAmt += Number(p.amount) || 0;
                    paidCount += 1;
                }
            });
            setPaidThisMonth({ amount: paidAmt, count: paidCount });

            // Group POs by supplier (skip ones already flagged 'Paid').
            const bySupplier: Record<string, PurchaseOrder[]> = {};
            orders.forEach(po => {
                if (po.payment_status === 'Paid') return;
                const sid = po.supplierId || po.supplierName || 'Unknown';
                (bySupplier[sid] = bySupplier[sid] || []).push(po);
            });

            const today = new Date();
            const daysOldOf = (po: PurchaseOrder) => {
                const d = po.date ? new Date(po.date) : today;
                return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
            };

            const supplierMap: Record<string, AgedSupplier> = {};
            Object.entries(bySupplier).forEach(([sid, list]) => {
                // Oldest POs absorb payment credit first.
                const sorted = [...list].sort(
                    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
                );
                let credit = creditBySupplier[sid] || 0;
                sorted.forEach(po => {
                    const total = Number(po.grandTotal) || 0;
                    const explicitPaid = Number(po.amount_paid) || 0;
                    let remaining = total - explicitPaid;
                    if (credit > 0 && remaining > 0.01) {
                        const used = Math.min(credit, remaining);
                        credit -= used;
                        remaining -= used;
                    }
                    if (remaining <= 0.01) return; // fully paid → don't bucket

                    const name = po.supplierName || 'Unknown';
                    if (!supplierMap[sid]) {
                        supplierMap[sid] = { supplierId: sid, supplierName: name, current: 0, days30: 0, days60: 0, days90: 0, total: 0, orders: [] };
                    }
                    const days = daysOldOf(po);
                    if (days <= 30)      supplierMap[sid].current += remaining;
                    else if (days <= 60) supplierMap[sid].days30  += remaining;
                    else if (days <= 90) supplierMap[sid].days60  += remaining;
                    else                 supplierMap[sid].days90  += remaining;
                    supplierMap[sid].total += remaining;
                    supplierMap[sid].orders.push({ ...po, remaining });
                });
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

    const handlePrint = () => window.print();

    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text('Aged Payable Report', 14, 16);
        doc.setFontSize(10);
        doc.text(`As of ${new Date().toLocaleDateString()}`, 14, 22);
        doc.text(`${filtered.length} suppliers · Total payable: ${formatCurrency(totals.total)}`, 14, 28);
        autoTable(doc, {
            startY: 34,
            head: [['Supplier', 'Current (0–30d)', '31–60 Days', '61–90 Days', '90+ Days', 'Total']],
            body: filtered.map(s => [
                s.supplierName,
                s.current > 0 ? formatCurrency(s.current) : '—',
                s.days30 > 0 ? formatCurrency(s.days30) : '—',
                s.days60 > 0 ? formatCurrency(s.days60) : '—',
                s.days90 > 0 ? formatCurrency(s.days90) : '—',
                formatCurrency(s.total),
            ]),
            foot: [[
                'TOTAL',
                formatCurrency(totals.current),
                formatCurrency(totals.days30),
                formatCurrency(totals.days60),
                formatCurrency(totals.days90),
                formatCurrency(totals.total),
            ]],
            styles: { fontSize: 9 },
            headStyles: { fillColor: [33, 33, 33] },
            footStyles: { fillColor: [33, 33, 33], textColor: 255, fontStyle: 'bold' },
        });
        doc.save(`AgedPayable_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

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
                        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3 transition-all print:hidden"><ArrowLeft size={14} /> Back</button>
                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Aged Payable</h1>
                        <p className="text-xs text-gray-500 mt-0.5">As of {new Date().toLocaleDateString()} · Outstanding supplier balances by age</p>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-gray-300 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Payable</p>
                    <p className="text-2xl font-black font-mono text-gray-900">{loading ? '...' : formatCurrency(totals.total)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{filtered.length} supplier{filtered.length === 1 ? '' : 's'} with balance</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Overdue (61d+)</p>
                    <p className="text-2xl font-black font-mono text-red-600">{loading ? '...' : formatCurrency(totals.days60 + totals.days90)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Settle these first</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Paid this month</p>
                    <p className="text-2xl font-black font-mono text-emerald-700">{loading ? '...' : formatCurrency(paidThisMonth.amount)}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{paidThisMonth.count} payment{paidThisMonth.count === 1 ? '' : 's'} sent to suppliers</p>
                </div>
            </div>

            {/* Aging buckets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Current (0–30d)', value: totals.current, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                    { label: '31–60 Days',       value: totals.days30,  color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-100' },
                    { label: '61–90 Days',       value: totals.days60,  color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100' },
                    { label: '90+ Days',         value: totals.days90,  color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-100' },
                ].map((b, i) => (
                    <div key={i} className={`rounded-2xl p-5 border ${b.bg} ${b.border}`}>
                        <p className={`text-sm font-semibold ${b.color}`}>{b.label}</p>
                        <p className={`text-2xl font-black font-mono ${b.color} mt-1`}>{loading ? '...' : formatCurrency(b.value)}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-wide">{filtered.length} Suppliers with Outstanding Balances</p>
                    <div className="relative">
                        <input type="text" placeholder="Search supplier..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-orange-400 w-52" />
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
                                        <Fragment key={s.supplierId}>
                                            <tr className="hover:bg-gray-50 cursor-pointer transition-all"
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
                                                <tr className="bg-gray-50">
                                                    <td colSpan={7} className="px-5 py-3">
                                                        <div className="space-y-2">
                                                            {s.orders.map(po => (
                                                                <div key={po.id} className="grid grid-cols-5 items-center gap-3 text-xs bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                    <span className="font-black text-gray-700">{po.poNumber}</span>
                                                                    <span className="text-gray-500">{po.date?.slice(0, 10)}</span>
                                                                    <span className={`font-black ${po.status === 'Pending' ? 'text-yellow-600' : 'text-blue-600'}`}>{po.status}</span>
                                                                    <span className="text-right font-mono text-gray-500">Total {formatCurrency(po.grandTotal || 0)}</span>
                                                                    <span className="text-right font-black font-mono text-rose-700">Owed {formatCurrency(po.remaining)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
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
