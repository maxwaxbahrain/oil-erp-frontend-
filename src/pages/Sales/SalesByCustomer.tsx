import { Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const customerSalesData = [
    { customer: 'ABC Retail Store', sales: 52400, orders: 45 },
    { customer: 'XYZ Mart', sales: 48200, orders: 38 },
    { customer: 'MNQ Store', sales: 39800, orders: 32 },
    { customer: 'Global Foods', sales: 28500, orders: 24 },
    { customer: 'City Supermarket', sales: 22100, orders: 19 },
];

export default function SalesByCustomer() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-cyan-50 rounded-lg flex items-center justify-center">
                    <Users size={24} className="text-cyan-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Sales by Customer</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium">Customer-wise sales breakdown and analysis</p>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                <h3 className="text-[16px] font-black text-redwood-text-main mb-6">Top Customers by Revenue</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={customerSalesData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                            <YAxis dataKey="customer" type="category" tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" width={150} />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dfe3e8', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }} />
                            <Bar dataKey="sales" fill="#06b6d4" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Customer Table */}
            <div className="bg-white rounded-lg border border-redwood-border shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-redwood-bg-light border-b border-redwood-border">
                            <th className="px-6 py-4 text-left text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Customer</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Orders</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Revenue</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-redwood-bg-light">
                        {customerSalesData.map((item, i) => (
                            <tr key={i} className="hover:bg-redwood-bg-light/30 transition-colors">
                                <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main">{item.customer}</td>
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-redwood-text-main">{item.orders}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-redwood-text-main">${item.sales.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
