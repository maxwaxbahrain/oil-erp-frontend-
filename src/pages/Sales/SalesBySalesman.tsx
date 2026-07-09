import { useEffect, useMemo, useState } from 'react';
import { Users, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getInvoices, type Invoice } from '../../services/api';
import { getSalesmen } from '../../services/employeeService';
import { buildSalesmanNameById, resolveSalesmanDisplayName } from '../../utils/salesmanDisplay';

const COLORS = ['#f59e0b', '#06b6d4', '#8b5cf6', '#10b981', '#ef4444'];

function invoiceSalesmanKey(inv: Invoice, salesmanById: Map<string, string>): string {
    const name = resolveSalesmanDisplayName({
        salesmanEmployeeId: inv.salesmanEmployeeId,
        notes: inv.notes,
        salesmanById,
    });
    return name === '—' ? 'Unassigned' : name;
}

export default function SalesBySalesman() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [salesmanById, setSalesmanById] = useState<Map<string, string>>(() => new Map());

    useEffect(() => {
        void Promise.all([getInvoices(), getSalesmen().catch(() => [])]).then(([inv, salesmen]) => {
            setInvoices(inv);
            setSalesmanById(buildSalesmanNameById(salesmen));
        });
    }, []);

    const salesmanData = useMemo(
        () =>
            Object.values(
                invoices.reduce<
                    Record<string, { name: string; sales: number; orders: number; commission: number | null }>
                >((acc, invoice) => {
                    const key = invoiceSalesmanKey(invoice, salesmanById);
                    if (!acc[key]) acc[key] = { name: key, sales: 0, orders: 0, commission: null };
                    acc[key].sales += Number(invoice.grandTotal) || 0;
                    acc[key].orders += 1;
                    return acc;
                }, {}),
            ).sort((a, b) => b.sales - a.sales),
        [invoices, salesmanById],
    );
    const topSalesman = salesmanData[0] || null;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Users size={24} className="text-amber-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Sales by Salesman</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium">Salesperson performance tracking and commission</p>
                </div>
            </div>

            {/* Top Performer Card */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-lg border-2 border-amber-200 shadow-md">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg">
                        <Award size={32} className="text-white" />
                    </div>
                    <div>
                        <div className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Top Performer This Month</div>
                        <div className="text-2xl font-black text-redwood-text-main">{topSalesman?.name || '—'}</div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg border border-amber-200">
                        <div className="text-[10px] font-bold text-redwood-text-muted uppercase tracking-wider">Sales</div>
                        <div className="text-2xl font-black text-redwood-text-main">{topSalesman ? `$${topSalesman.sales.toLocaleString()}` : '—'}</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-amber-200">
                        <div className="text-[10px] font-bold text-redwood-text-muted uppercase tracking-wider">Orders</div>
                        <div className="text-2xl font-black text-redwood-text-main">{topSalesman?.orders ?? '—'}</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-amber-200">
                        <div className="text-[10px] font-bold text-redwood-text-muted uppercase tracking-wider">Commission</div>
                        <div className="text-2xl font-black text-emerald-600">—</div>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                <h3 className="text-[16px] font-black text-redwood-text-main mb-6">Sales Performance Comparison</h3>
                <div className="h-80">
                    {salesmanData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm font-bold text-redwood-text-muted">No data</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesmanData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                                <YAxis tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dfe3e8', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }} />
                                <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
                                    {salesmanData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Salesman Table */}
            <div className="bg-white rounded-lg border border-redwood-border shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-redwood-bg-light border-b border-redwood-border">
                            <th className="px-6 py-4 text-left text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Rank</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Salesperson</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Orders</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Sales</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Commission</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-redwood-bg-light">
                        {salesmanData.map((item, i) => (
                            <tr key={i} className="hover:bg-redwood-bg-light/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black ${i === 0 ? 'bg-amber-500 text-white' : 'bg-redwood-bg-light text-redwood-text-muted'}`}>
                                        #{i + 1}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main">{item.name}</td>
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-redwood-text-main">{item.orders}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-redwood-text-main">${item.sales.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-emerald-600">—</td>
                            </tr>
                        ))}
                        {salesmanData.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-[13px] font-bold text-redwood-text-muted">
                                    No data
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
