import { useState } from 'react';
import { Package, Download, FileText, Filter, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import FormInput from '../../components/forms/FormInput';

const productSalesData = [
    { product: 'Product A', qty_sold: 342, revenue: 410400, cost: 273600, profit: 136800, margin: 33.3 },
    { product: 'Product B', qty_sold: 289, revenue: 245650, cost: 173400, profit: 72250, margin: 29.4 },
    { product: 'Product C', qty_sold: 215, revenue: 322500, cost: 215000, profit: 107500, margin: 33.3 },
    { product: 'Product D', qty_sold: 178, revenue: 213600, cost: 142400, profit: 71200, margin: 33.3 },
    { product: 'Product E', qty_sold: 142, revenue: 170400, cost: 113600, profit: 56800, margin: 33.3 },
];

export default function SalesByProductReport() {
    const [dateFrom, setDateFrom] = useState('2024-01-01');
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedProduct, setSelectedProduct] = useState('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');
    const [selectedSalesman, setSelectedSalesman] = useState('all');

    const handleExportExcel = () => {
        alert('Exporting to Excel...');
    };

    const handleExportPDF = () => {
        alert('Exporting to PDF...');
    };

    const handleDrillDown = (product: string) => {
        alert(`Drilling down to invoices for: ${product}`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Package size={24} className="text-purple-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Sales by Product Report</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium">Product performance analysis with profitability</p>
                </div>
            </div>

            {/* Filter Panel */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border-2 border-purple-200 shadow-md">
                <h3 className="text-[12px] font-black text-redwood-text-main uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Filter size={16} className="text-purple-600" /> Filter Panel
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <FormInput
                        label="Date From"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        icon={<Calendar size={16} />}
                    />
                    <FormInput
                        label="Date To"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        icon={<Calendar size={16} />}
                    />

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Product</label>
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-purple-300 rounded-sm text-[13px] font-bold focus:border-purple-600 outline-none"
                        >
                            <option value="all">All Products</option>
                            <option value="product-a">Product A</option>
                            <option value="product-b">Product B</option>
                            <option value="product-c">Product C</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Warehouse/Van</label>
                        <select
                            value={selectedWarehouse}
                            onChange={(e) => setSelectedWarehouse(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-purple-300 rounded-sm text-[13px] font-bold focus:border-purple-600 outline-none"
                        >
                            <option value="all">All Locations</option>
                            <option value="wh-1">Warehouse 1</option>
                            <option value="van-1">Van 1</option>
                            <option value="van-2">Van 2</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest">Salesman</label>
                        <select
                            value={selectedSalesman}
                            onChange={(e) => setSelectedSalesman(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-purple-300 rounded-sm text-[13px] font-bold focus:border-purple-600 outline-none"
                        >
                            <option value="all">All Salesmen</option>
                            <option value="ahmed">Ahmed Khan</option>
                            <option value="sara">Sara Ali</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button className="px-6 py-2 bg-white border-2 border-purple-300 text-[11px] font-black text-purple-700 uppercase tracking-wide rounded-lg hover:bg-purple-50 transition-all">
                        Reset Filters
                    </button>
                    <button className="px-8 py-2 bg-purple-600 text-white text-[11px] font-black uppercase tracking-wide rounded-lg hover:bg-purple-700 transition-all shadow-md">
                        Apply Filters
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                <h3 className="text-[16px] font-black text-redwood-text-main mb-6">Revenue & Profit by Product</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productSalesData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="product" tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                            <YAxis tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #dfe3e8', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }} />
                            <Bar dataKey="revenue" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Report Grid */}
            <div className="bg-white rounded-lg border-2 border-redwood-border shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-purple-50 border-b-2 border-purple-200 flex justify-between items-center">
                    <h3 className="text-[14px] font-black text-redwood-text-main uppercase tracking-wide">Product Performance Matrix</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black rounded-md hover:bg-emerald-700 transition-all flex items-center gap-2"
                        >
                            <Download size={14} /> Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="px-4 py-2 bg-rose-600 text-white text-[10px] font-black rounded-md hover:bg-rose-700 transition-all flex items-center gap-2"
                        >
                            <FileText size={14} /> PDF
                        </button>
                    </div>
                </div>

                <table className="w-full">
                    <thead>
                        <tr className="bg-redwood-bg-light border-b border-redwood-border">
                            <th className="px-6 py-4 text-left text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Product</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Qty Sold</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Revenue</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Cost</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Profit</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Margin %</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-redwood-bg-light">
                        {productSalesData.map((item, i) => (
                            <tr key={i} className="hover:bg-purple-50/30 transition-colors">
                                <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main">{item.product}</td>
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-redwood-text-main">{item.qty_sold}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-redwood-text-main">{item.revenue.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-rose-600">{item.cost.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-emerald-600">{item.profit.toLocaleString()}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className={`text-[13px] font-black px-3 py-1 rounded ${item.margin >= 33 ? 'bg-emerald-100 text-emerald-700' :
                                            item.margin >= 25 ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                        }`}>
                                        {item.margin.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => handleDrillDown(item.product)}
                                        className="px-4 py-2 bg-purple-600 text-white text-[10px] font-black rounded-md hover:bg-purple-700 transition-all"
                                    >
                                        Drill Down
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-purple-100 border-t-2 border-purple-300">
                            <td className="px-6 py-4 text-[13px] font-black text-redwood-text-main uppercase">Total</td>
                            <td className="px-6 py-4 text-right text-[14px] font-black text-redwood-text-main">
                                {productSalesData.reduce((sum, item) => sum + item.qty_sold, 0)}
                            </td>
                            <td className="px-6 py-4 text-right text-[16px] font-black text-redwood-text-main">
                                {productSalesData.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right text-[16px] font-black text-rose-600">
                                {productSalesData.reduce((sum, item) => sum + item.cost, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right text-[16px] font-black text-emerald-600">
                                {productSalesData.reduce((sum, item) => sum + item.profit, 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4"></td>
                            <td className="px-6 py-4"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
