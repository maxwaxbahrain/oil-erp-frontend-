import {
    ShoppingCart,
    Truck,
    Wallet,
    TrendingUp,
    AlertTriangle,
    FileText,
    ArrowRight,
    TrendingDown,
    Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// --- Mock Data ---

const monthlyPerformanceData = [
    { month: 'Jan', sales: 45000, expenses: 32000 },
    { month: 'Feb', sales: 52000, expenses: 35000 },
    { month: 'Mar', sales: 49000, expenses: 31000 },
    { month: 'Apr', sales: 61000, expenses: 42000 },
    { month: 'May', sales: 58000, expenses: 38000 },
    { month: 'Jun', sales: 72000, expenses: 48000 },
    { month: 'Jul', sales: 68000, expenses: 45000 },
];

const inventoryPieData = [
    { name: 'Beverages', value: 400 },
    { name: 'Food', value: 300 },
    { name: 'Household', value: 300 },
    { name: 'Personal Care', value: 200 },
];

const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const recentOrders = [
    { id: 'ORD-001', customer: 'Fresh Mart', date: '2025-01-15', amount: 1250, status: 'Completed' },
    { id: 'ORD-002', customer: 'Quick Stop', date: '2025-01-15', amount: 850, status: 'Pending' },
    { id: 'ORD-003', customer: 'City Grocers', date: '2025-01-14', amount: 2100, status: 'Completed' },
    { id: 'ORD-004', customer: 'Corner Shop', date: '2025-01-14', amount: 450, status: 'Processing' },
    { id: 'ORD-005', customer: 'Super Save', date: '2025-01-13', amount: 3200, status: 'Completed' },
];

export default function Dashboard() {
    const navigate = useNavigate();

    const stats = [
        { label: 'Total Income', value: '$84,250', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+12% vs last mth' },
        { label: 'Total Expenses', value: '$42,800', icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50', trend: '-5% vs last mth' },
        { label: 'Net Profit', value: '$41,450', icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+18% margin' },
        { label: 'Unpaid Invoices', value: '$12,300', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50', trend: '8 invoices overdue' },
        { label: 'Low Stock Alerts', value: '15', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', trend: '5 critical items' },
        { label: 'Total Orders', value: '1,245', icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50', trend: '+85 this week' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-10">
            {/* Header & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Dashboard Overview</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">Real-time performance metrics and insights.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/sales/orders/new')}
                        className="px-5 py-2.5 bg-redwood-brand text-white text-[13px] font-bold rounded-md hover:brightness-95 transition-all shadow-lg flex items-center gap-2"
                    >
                        <ShoppingCart size={16} /> New Sale
                    </button>
                    <button
                        onClick={() => navigate('/van-sales')}
                        className="px-5 py-2.5 bg-white border border-redwood-border text-redwood-text-main text-[13px] font-bold rounded-md hover:bg-gray-50 transition-all flex items-center gap-2"
                    >
                        <Truck size={16} /> Van Sales
                    </button>
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
                            <p className="text-[12px] text-redwood-text-muted font-medium">Sales vs Expenses (Last 7 Months)</p>
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
                        <p className="text-[12px] text-redwood-text-muted font-medium">Stock value by category</p>
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
                            <p className="text-[12px] text-redwood-text-muted font-medium">Latest sales transactions</p>
                        </div>
                        <button onClick={() => navigate('/sales/orders')} className="text-[12px] font-bold text-redwood-brand hover:underline flex items-center gap-1">
                            View All <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider">Order ID</th>
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
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                                order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-blue-100 text-blue-700'
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
                            <div className="text-[24px] font-black text-redwood-brand mb-1">98%</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">On-Time Delivery</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-emerald-600 mb-1">24h</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Avg. Turnaround</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-blue-600 mb-1">12</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">Active Vans</div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg text-center border border-gray-100">
                            <div className="text-[24px] font-black text-purple-600 mb-1">450</div>
                            <div className="text-[10px] font-bold text-redwood-text-muted uppercase">New Customers</div>
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
