import { DollarSign, TrendingUp } from 'lucide-react';

const profitData = [
    { invoice: 'INV-2024-0892', customer: 'ABC Retail Store', revenue: 12450, cost: 8200, profit: 4250, margin: 34.1 },
    { invoice: 'INV-2024-0891', customer: 'XYZ Mart', revenue: 9800, cost: 6500, profit: 3300, margin: 33.7 },
    { invoice: 'INV-2024-0890', customer: 'MNQ Store', revenue: 8200, cost: 5800, profit: 2400, margin: 29.3 },
    { invoice: 'INV-2024-0889', customer: 'Global Foods', revenue: 15600, cost: 10200, profit: 5400, margin: 34.6 },
    { invoice: 'INV-2024-0888', customer: 'City Supermarket', revenue: 6800, cost: 4900, profit: 1900, margin: 27.9 },
];

export default function ProfitAnalysis() {
    const totalRevenue = profitData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCost = profitData.reduce((sum, item) => sum + item.cost, 0);
    const totalProfit = profitData.reduce((sum, item) => sum + item.profit, 0);
    const avgMargin = (totalProfit / totalRevenue) * 100;

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                    <DollarSign size={24} className="text-green-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Profit per Invoice</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium">Invoice profitability and margin analysis</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Total Revenue</div>
                    <div className="text-3xl font-black text-redwood-text-main">${totalRevenue.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Total Cost</div>
                    <div className="text-3xl font-black text-rose-600">${totalCost.toLocaleString()}</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Total Profit</div>
                    <div className="text-3xl font-black text-emerald-600">${totalProfit.toLocaleString()}</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-6 rounded-lg border-2 border-emerald-200 shadow-sm">
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <TrendingUp size={14} /> Avg Margin
                    </div>
                    <div className="text-3xl font-black text-emerald-600">{avgMargin.toFixed(1)}%</div>
                </div>
            </div>

            {/* Profit Table */}
            <div className="bg-white rounded-lg border border-redwood-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-redwood-bg-light bg-redwood-bg-light/30">
                    <h3 className="text-[14px] font-black text-redwood-text-main uppercase tracking-wide">Invoice Profitability Breakdown</h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-redwood-bg-light border-b border-redwood-border">
                            <th className="px-6 py-4 text-left text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Invoice</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Customer</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Revenue</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Cost</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Profit</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Margin %</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-redwood-bg-light">
                        {profitData.map((item, i) => (
                            <tr key={i} className="hover:bg-redwood-bg-light/30 transition-colors">
                                <td className="px-6 py-4 text-[13px] font-black text-redwood-brand font-mono">{item.invoice}</td>
                                <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main">{item.customer}</td>
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-redwood-text-main">${item.revenue.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-rose-600">${item.cost.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-emerald-600">${item.profit.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className={`text-[13px] font-black ${item.margin >= 33 ? 'text-emerald-600' : item.margin >= 28 ? 'text-amber-600' : 'text-rose-600'}`}>
                                            {item.margin.toFixed(1)}%
                                        </span>
                                        <div className="w-16 h-2 bg-redwood-bg-light rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${item.margin >= 33 ? 'bg-emerald-500' : item.margin >= 28 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                style={{ width: `${item.margin}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
