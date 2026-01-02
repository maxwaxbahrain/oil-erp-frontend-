
import { FileText, Package, Users, DollarSign, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SalesOverview() {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Sales Dashboard</h1>
                <p className="text-[13px] text-redwood-text-muted font-medium mt-1">Complete sales analytics and management hub</p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Total Sales</div>
                    <div className="text-3xl font-black text-redwood-text-main">$124,580</div>
                    <div className="text-[12px] text-emerald-600 font-semibold mt-2">+18.5% vs last month</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Total Orders</div>
                    <div className="text-3xl font-black text-redwood-text-main">342</div>
                    <div className="text-[12px] text-redwood-text-muted font-semibold mt-2">This month</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Avg Order Value</div>
                    <div className="text-3xl font-black text-redwood-text-main">$364</div>
                    <div className="text-[12px] text-blue-600 font-semibold mt-2">+5.2% increase</div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-redwood-border shadow-sm">
                    <div className="text-[11px] font-bold text-redwood-text-muted uppercase tracking-wider mb-2">Gross Profit</div>
                    <div className="text-3xl font-black text-redwood-text-main">$42,180</div>
                    <div className="text-[12px] text-emerald-600 font-semibold mt-2">33.8% margin</div>
                </div>
            </div>

            {/* Sales Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link to="/sales/orders" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <FileText size={28} className="text-blue-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Sales Orders</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Manage and track all sales orders</p>
                </Link>

                <Link to="/sales/invoices" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-emerald-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <FileText size={28} className="text-emerald-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Invoices</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">View and manage invoices</p>
                </Link>

                <Link to="/sales/credit-notes" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-rose-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <FileText size={28} className="text-rose-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Credit Notes</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Manage returns and credits</p>
                </Link>

                <Link to="/sales/by-product" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-purple-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <Package size={28} className="text-purple-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Sales by Product</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Product performance analysis</p>
                </Link>

                <Link to="/sales/by-customer" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-cyan-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <Users size={28} className="text-cyan-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Sales by Customer</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Customer sales breakdown</p>
                </Link>

                <Link to="/sales/by-salesman" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-amber-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <Users size={28} className="text-amber-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Sales by Salesman</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Salesperson performance tracking</p>
                </Link>

                <Link to="/sales/profit-analysis" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-green-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <DollarSign size={28} className="text-green-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Profit per Invoice</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Invoice profitability analysis</p>
                </Link>

                <Link to="/sales/van-performance" className="bg-white p-8 rounded-lg border-2 border-redwood-border hover:border-redwood-brand transition-all shadow-sm hover:shadow-md group">
                    <div className="w-14 h-14 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-redwood-brand transition-colors">
                        <Truck size={28} className="text-indigo-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-[16px] font-black text-redwood-text-main mb-2">Van Sales Performance</h3>
                    <p className="text-[12px] text-redwood-text-muted font-medium">Van-wise sales tracking</p>
                </Link>
            </div>
        </div>
    );
}
