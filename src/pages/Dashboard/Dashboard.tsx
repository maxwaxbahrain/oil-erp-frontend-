import {
    ShoppingCart,
    Wallet,
    TrendingUp,
    AlertTriangle,
    FileText,
    ArrowRight,
    TrendingDown,
    Activity
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { getCustomers, getInvoices, getProducts, getSalesOrders, getVans, getPayments, type Invoice, type Product } from '../../services/api';
import { getPurchaseOrders } from '../../services/purchasesService';

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [salesOrdersCount, setSalesOrdersCount] = useState(0);
    const [vansCount, setVansCount] = useState(0);
    const [customersCount, setCustomersCount] = useState(0);
    const [newCustomersThisMonth, setNewCustomersThisMonth] = useState(0);
    const [dataError, setDataError] = useState(false);
    const [aiContext, setAiContext] = useState({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [] } as any);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [inv, prod, orders, vans, customers, pays, pos] = await Promise.all([
                    getInvoices().catch(() => []),
                    getProducts().catch(() => []),
                    getSalesOrders().catch(() => []),
                    getVans().catch(() => []),
                    getCustomers().catch(() => []),
                    getPayments().catch(() => []),
                    getPurchaseOrders().catch(() => []),
                ]);
                if (!cancelled) {
                    setAiContext({ invoices: inv, customers, products: prod, payments: pays, purchaseOrders: pos });
                }
                if (cancelled) return;
                setInvoices(Array.isArray(inv) ? inv : []);
                setProducts(Array.isArray(prod) ? prod : []);
                setSalesOrdersCount(Array.isArray(orders) ? orders.length : 0);
                setVansCount(Array.isArray(vans) ? vans.filter((v) => String(v.status).toLowerCase() === 'active').length : 0);
                const custList = Array.isArray(customers) ? customers : [];
                setCustomersCount(custList.length);

                const now = new Date();
                const thisMonth = custList.filter((c) => {
                    if (!c.created_at) return false;
                    const d = new Date(c.created_at);
                    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                }).length;
                setNewCustomersThisMonth(thisMonth);
                setDataError(false);
            } catch {
                if (!cancelled) setDataError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const metrics = useMemo(() => {
        const validIncomeInvoices = invoices.filter((i) => String(i.status || '').toLowerCase() !== 'cancelled');
        const totalIncome = validIncomeInvoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
        const totalExpenses = 0;
        const netProfit = totalIncome;
        const unpaid = invoices.filter((i) => ['unpaid', 'pending', 'partial', 'overdue'].includes(String(i.status || '').toLowerCase()));
        const unpaidAmount = unpaid.reduce((sum, i) => sum + (Number(i.remaining_balance ?? i.grandTotal) || 0), 0);
        const overdueCount = invoices.filter((i) => String(i.status || '').toLowerCase() === 'overdue').length;
        const lowStock = products.filter((p) => Number(p.current_stock || 0) < 10).length;
        const productCount = products.length;
        return { totalIncome, totalExpenses, netProfit, unpaidAmount, overdueCount, lowStock, productCount };
    }, [invoices, products]);

    const monthlyPerformanceData = useMemo(() => {
        const now = new Date();
        const points: Array<{ month: string; sales: number; expenses: number }> = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const keyYear = d.getFullYear();
            const keyMonth = d.getMonth();
            const monthLabel = d.toLocaleDateString(undefined, { month: 'short' });
            const sales = invoices
                .filter((inv) => {
                    const date = new Date(inv.invoiceDate || inv.createdAt);
                    return date.getFullYear() === keyYear && date.getMonth() === keyMonth;
                })
                .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
            points.push({ month: monthLabel, sales, expenses: 0 });
        }
        return points;
    }, [invoices]);

    const inventoryPieData = useMemo(
        () => products.map((p) => ({ name: p.name, value: Number(p.current_stock) || 0 })).filter((x) => x.value > 0),
        [products]
    );

    const recentOrders = useMemo(() => {
        const custMap: Record<string, string> = {};
        (aiContext.customers || []).forEach((c: any) => { custMap[String(c.id)] = c.name; });
        return [...invoices]
            .sort((a, b) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime())
            .slice(0, 8)
            .map((i) => ({
                id: i.invoiceNumber || String(i.id),
                customer: i.customerName || custMap[String(i.customerId)] || custMap[String((i as any).customer_id)] || 'Customer',
                date: i.invoiceDate || i.createdAt?.slice(0, 10) || '—',
                amount: Number(i.grandTotal) || 0,
                status: i.status || 'Unpaid',
            }));
    }, [invoices, aiContext.customers]);

    const stats = [
        { label: 'Total Income', value: `$${metrics.totalIncome.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: dataError ? 'N/A' : 'From invoices' },
        { label: 'Total Expenses', value: '$0', icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'N/A' },
        { label: 'Net Profit', value: `$${metrics.netProfit.toLocaleString()}`, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50', trend: dataError ? 'N/A' : 'Income - Expenses' },
        { label: 'Unpaid Invoices', value: `$${metrics.unpaidAmount.toLocaleString()}`, icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', trend: `${metrics.overdueCount} overdue` },
        { label: 'Low Stock Alerts', value: String(metrics.lowStock), icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'stock < 10' },
        { label: 'Total Orders', value: String(salesOrdersCount), icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50', trend: 'All sales orders' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-10">
            {/* Header & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Dashboard Overview</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">Real-time performance metrics and insights.</p>
                </div>

            </div>

            {/* 1. Key Metrics Cards (Grid of 6) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-lg border border-redwood-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                            <div className={`w-8 h-8 rounded-md flex items-center justify-center ${stat.bg}`}>
                                <stat.icon size={16} className={stat.color} />
                            </div>
                            {/* Optional: Trend Badge Area */}
                        </div>
                        <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-1">{stat.label}</div>
                        <div className="text-2xl font-black text-redwood-text-main leading-tight mb-2">{stat.value}</div>
                        <div className={`text-[10px] font-bold ${stat.color} flex items-center gap-1`}>
                            {stat.trend}
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Sales vs Expenses (Bar/Line) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-[16px] font-black text-redwood-text-main">Financial Performance</h3>
                            <p className="text-[12px] text-redwood-text-muted font-medium">Sales vs Expenses (Last 6 Months)</p>
                        </div>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyPerformanceData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                                <YAxis tick={{ fontSize: 11, fill: '#637381' }} stroke="#dfe3e8" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #dfe3e8', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '10px' }} />
                                <Bar dataKey="sales" name="Total Sales" fill="#00758f" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expenses" name="Total Expenses" fill="#FF5630" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Inventory by Category (Pie Chart) */}
                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-[16px] font-black text-redwood-text-main">Inventory Distribution</h3>
                            <p className="text-[12px] text-redwood-text-muted font-medium">Stock by product</p>
                    </div>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={inventoryPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {inventoryPieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. Recent Orders & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent Orders List */}
                <div className="lg:col-span-2 bg-white rounded-lg border border-redwood-border shadow-sm overflow-hidden dash-table-container">
                    <div className="p-6 border-b border-redwood-border flex justify-between items-center">
                        <div>
                        <h3 className="text-[16px] font-black text-redwood-text-main">Recent Orders</h3>
                        <p className="text-[12px] text-redwood-text-muted font-medium">Latest real invoices</p>
                        </div>
                        <button onClick={() => navigate('/sales/orders')} className="text-[12px] font-bold text-redwood-brand hover:underline flex items-center gap-1">
                            View All <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Order/Invoice</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Customer</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recentOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-[13px] font-bold text-redwood-text-main">{order.id}</td>
                                        <td className="px-6 py-4 text-[13px] text-gray-700">{order.customer}</td>
                                        <td className="px-6 py-4 text-[13px] text-gray-500">{order.date}</td>
                                        <td className="px-6 py-4 text-[13px] font-bold text-gray-900 text-right">${order.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${String(order.status).toLowerCase() === 'paid' || String(order.status).toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                String(order.status).toLowerCase() === 'unpaid' || String(order.status).toLowerCase() === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                    String(order.status).toLowerCase() === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-[16px] font-black text-redwood-text-main">Quick Stats</h3>
                        <p className="text-[12px] text-redwood-text-muted font-medium">Operational efficiency checks</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-redwood-brand mb-1">{vansCount}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Active Vans</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-emerald-600 mb-1">{newCustomersThisMonth}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">New Customers</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-blue-600 mb-1">{customersCount}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Total Customers</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-purple-600 mb-1">{metrics.productCount}</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Products In Catalog</div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                <Activity size={20} />
                            </div>
                            <div>
                                <div className="text-[12px] font-bold text-redwood-text-main">System Health</div>
                                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    All Systems Operational
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
