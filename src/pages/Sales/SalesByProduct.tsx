import { useState, useEffect } from 'react';
import { getInvoices, getProducts, type Invoice } from '../../services/api';
import { Package, Download, FileText, Filter, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import FormInput from '../../components/forms/FormInput';

export default function SalesByProductReport() {
    const [dateFrom, setDateFrom] = useState('2024-01-01');
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
    const [selectedProduct, setSelectedProduct] = useState('all');
    const [selectedWarehouse, setSelectedWarehouse] = useState('all');
    const [selectedSalesman, setSelectedSalesman] = useState('all');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        Promise.all([
            getInvoices(),
            getProducts().catch(() => []),
        ]).then(([inv, prods]) => {
            setInvoices(inv);
            setProducts(prods || []);
        });
    }, []);

    // Build product sales from real invoices
    const productMap: Record<string, { product: string; qty_sold: number; revenue: number; cost: number | null; profit: number | null; margin: number | null; missingCost: boolean }> = {};
    invoices
        .filter(inv => inv.status !== 'Paid')
        .filter(inv => {
            const d = inv.invoiceDate || inv.createdAt?.slice(0, 10) || '';
            return d >= dateFrom && d <= dateTo;
        })
        .filter(inv => selectedWarehouse === 'all' || (inv.van || '') === selectedWarehouse)
        .filter(inv => selectedSalesman === 'all' || (inv.salesman || '') === selectedSalesman)
        .forEach(inv => {
            (inv.lineItems || []).forEach((item: any) => {
                const name = item.product || item.description || 'Unknown Product';
                if (selectedProduct !== 'all' && name !== selectedProduct) return;
                if (!productMap[name]) productMap[name] = { product: name, qty_sold: 0, revenue: 0, cost: 0, profit: 0, margin: null, missingCost: false };
                const qty = item.quantity || 0;
                const rev = (item.rate || 0) * qty;
                const unitCost = item.cost == null || Number(item.cost) <= 0 ? null : Number(item.cost);
                productMap[name].qty_sold += qty;
                productMap[name].revenue += rev;
                if (unitCost === null) {
                    productMap[name].cost = null;
                    productMap[name].profit = null;
                    productMap[name].missingCost = true;
                } else if (!productMap[name].missingCost) {
                    const cost = unitCost * qty;
                    productMap[name].cost = (productMap[name].cost || 0) + cost;
                    productMap[name].profit = (productMap[name].profit || 0) + (rev - cost);
                }
            });
        });
    Object.values(productMap).forEach(p => {
        p.margin = p.revenue > 0 && p.profit !== null ? Math.round((p.profit / p.revenue) * 1000) / 10 : null;
    });
    const productSalesData = Object.values(productMap).sort((a, b) => b.revenue - a.revenue);
    const productOptions = Array.from(new Set([
        ...products.map((p: any) => p.name).filter(Boolean),
        ...Object.keys(productMap),
    ])).sort();
    const warehouseOptions = Array.from(new Set(invoices.map(inv => inv.van).filter(Boolean))).sort();
    const salesmanOptions = Array.from(new Set(invoices.map(inv => inv.salesman).filter(Boolean))).sort();
    const totalCost = productSalesData.some(item => item.cost === null)
        ? null
        : productSalesData.reduce((sum, item) => sum + (item.cost || 0), 0);
    const totalProfit = productSalesData.some(item => item.profit === null)
        ? null
        : productSalesData.reduce((sum, item) => sum + (item.profit || 0), 0);
    const formatMaybeNumber = (value: number | null) => value === null ? '—' : value.toLocaleString();

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
                            {productOptions.map(product => (
                                <option key={product} value={product}>{product}</option>
                            ))}
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
                            {warehouseOptions.map(location => (
                                <option key={location} value={location}>{location}</option>
                            ))}
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
                            {salesmanOptions.map(salesman => (
                                <option key={salesman} value={salesman}>{salesman}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedProduct('all');
                            setSelectedWarehouse('all');
                            setSelectedSalesman('all');
                        }}
                        className="px-6 py-2 bg-white border-2 border-purple-300 text-[11px] font-black text-purple-700 uppercase tracking-wide rounded-lg hover:bg-purple-50 transition-all"
                    >
                        Reset Filters
                    </button>
                    <button type="button" className="px-8 py-2 bg-purple-600 text-white text-[11px] font-black uppercase tracking-wide rounded-lg hover:bg-purple-700 transition-all shadow-md">
                        Apply Filters
                    </button>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                <h3 className="text-[16px] font-black text-redwood-text-main mb-6">Revenue & Profit by Product</h3>
                <div className="h-80">
                    {productSalesData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm font-bold text-redwood-text-muted">No data</div>
                    ) : (
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
                    )}
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
                                <td className="px-6 py-4 text-right text-[13px] font-bold text-rose-600">{formatMaybeNumber(item.cost)}</td>
                                <td className="px-6 py-4 text-right text-[14px] font-black text-emerald-600">{formatMaybeNumber(item.profit)}</td>
                                <td className="px-6 py-4 text-right">
                                    {item.margin === null ? (
                                        <span className="text-[13px] font-black px-3 py-1 rounded bg-gray-100 text-gray-500">—</span>
                                    ) : (
                                    <span className={`text-[13px] font-black px-3 py-1 rounded ${item.margin >= 33 ? 'bg-emerald-100 text-emerald-700' :
                                            item.margin >= 25 ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                        }`}>
                                        {item.margin.toFixed(1)}%
                                    </span>
                                    )}
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
                        {productSalesData.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-[13px] font-bold text-redwood-text-muted">
                                    No data
                                </td>
                            </tr>
                        )}
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
                                {formatMaybeNumber(totalCost)}
                            </td>
                            <td className="px-6 py-4 text-right text-[16px] font-black text-emerald-600">
                                {formatMaybeNumber(totalProfit)}
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
