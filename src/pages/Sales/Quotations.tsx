import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Calendar, User, DollarSign, Package, Search, Filter } from 'lucide-react';
import { getSalesOrders, hydrateSalesOrdersWithCustomers, type SalesOrder } from '../../services/salesService';

export default function Quotations() {
    const navigate = useNavigate();
    const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    // TC-36 — Filter state.  Page previously had no filtering UI at all.
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'draft' | 'confirmed' | 'delivered' | 'invoiced' | 'cancelled'>('All');

    useEffect(() => {
        loadSalesOrders();
    }, []);

    async function loadSalesOrders() {
        try {
            const orders = await getSalesOrders();
            const hydrated = await hydrateSalesOrdersWithCustomers(orders);
            const sorted = hydrated.sort((a, b) =>
                new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
            );
            setSalesOrders(sorted);
        } catch (error) {
            console.error('Failed to load sales orders:', error);
        } finally {
            setLoading(false);
        }
    }

    const getStatusColor = (status: string) => {
        if (status === 'draft' || status === 'pending') return 'bg-slate-200 text-slate-800 border-slate-300';
        if (status === 'confirmed' || status === 'approved') return 'bg-blue-100 text-blue-800 border-blue-300';
        if (status === 'delivered') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (status === 'invoiced') return 'bg-violet-100 text-violet-800 border-violet-300';
        if (status === 'cancelled') return 'bg-red-100 text-red-700 border-red-300';
        return 'bg-gray-100 text-gray-700 border-gray-300';
    };

    // TC-36 — Apply search + status filter.  Search matches order
    // number OR customer name (case-insensitive).  An empty search
    // term + statusFilter === 'All' returns everything.
    const filteredOrders = salesOrders.filter(o => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q
            || (o.so_number || '').toLowerCase().includes(q)
            || (o.customer_name || o.customer?.name || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#800020] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-sm font-bold text-gray-600">Loading quotations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-[#800020] p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-[#800020] rounded-xl flex items-center justify-center shadow-lg">
                                <FileText size={32} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-gray-900">SALES QUOTATIONS</h1>
                                <p className="text-sm text-[#800020] font-black mt-1">ALL SALES ORDERS & QUOTATIONS</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/sales/orders/new')}
                            className="px-8 py-4 bg-[#800020] text-white text-sm font-black uppercase rounded-xl hover:brightness-110 shadow-2xl transition-all flex items-center gap-3"
                        >
                            <Plus size={20} />
                            Create New Order
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#800020]">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-gray-500 uppercase">Total Orders</p>
                                <p className="text-3xl font-black text-[#800020] mt-2">{salesOrders.length}</p>
                            </div>
                            <div className="w-12 h-12 bg-[#800020]/10 rounded-lg flex items-center justify-center">
                                <FileText size={24} className="text-[#800020]" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border-2 border-amber-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-gray-500 uppercase">Draft</p>
                                <p className="text-3xl font-black text-amber-700 mt-2">
                                    {salesOrders.filter(o => o.status === 'draft').length}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Package size={24} className="text-amber-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border-2 border-emerald-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-gray-500 uppercase">Confirmed</p>
                                <p className="text-3xl font-black text-emerald-700 mt-2">
                                    {salesOrders.filter(o => o.status === 'confirmed').length}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <DollarSign size={24} className="text-emerald-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6 border-2 border-[#800020]">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-black text-gray-500 uppercase">Total Value</p>
                                <p className="text-2xl font-black text-[#800020] mt-2 font-mono">
                                    ${salesOrders.reduce((sum, o) => sum + o.total, 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-[#800020]/10 rounded-lg flex items-center justify-center">
                                <DollarSign size={24} className="text-[#800020]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* TC-36 — Filter strip */}
                <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by order number or customer name…"
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#800020]"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:outline-none focus:border-[#800020]"
                            aria-label="Filter by status"
                        >
                            <option value="All">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="delivered">Delivered</option>
                            <option value="invoiced">Invoiced</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                {/* Orders List */}
                <div className="bg-white rounded-xl shadow-md border-2 border-[#800020] overflow-hidden">
                    <div className="px-8 py-5 bg-gradient-to-r from-[#800020] to-[#a00028]">
                        <h2 className="text-sm font-black text-white uppercase flex items-center gap-3">
                            <FileText size={20} className="text-white/80" />
                            Sales Orders ({filteredOrders.length}{filteredOrders.length !== salesOrders.length ? ` of ${salesOrders.length}` : ''})
                        </h2>
                    </div>

                    {filteredOrders.length === 0 ? (
                        <div className="p-24 text-center bg-gray-50/50">
                            <div className="w-20 h-20 bg-[#800020]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileText size={40} className="text-[#800020]" />
                            </div>
                            <h3 className="text-sm font-black text-gray-400 uppercase mb-2">
                                {salesOrders.length === 0 ? 'No orders found' : 'No orders match your filter'}
                            </h3>
                            <p className="text-xs text-gray-500 font-bold max-w-xs mx-auto mb-6">
                                {salesOrders.length === 0
                                    ? 'Start by creating your first sales order.'
                                    : 'Try a different search term or status.'}
                            </p>
                            <button
                                onClick={() => salesOrders.length === 0
                                    ? navigate('/sales/orders/new')
                                    : (setSearchTerm(''), setStatusFilter('All'))}
                                className="px-8 py-3 bg-[#800020] text-white text-xs font-black uppercase rounded-lg hover:brightness-110 transition-all inline-flex items-center gap-2"
                            >
                                {salesOrders.length === 0 ? <><Plus size={16} /> Create First Order</> : 'Clear filters'}
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {filteredOrders.map((order) => (
                                <div key={order.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-3">
                                                <h3 className="text-lg font-black text-gray-900 font-mono">
                                                    {order.so_number}
                                                </h3>
                                                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase border-2 ${getStatusColor(order.status)}`}>
                                                    {order.status}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-gray-400" />
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Customer</span>
                                                        <span className="font-black text-gray-900">
                                                            {order.customer_name || order.customer?.name || 'Customer #' + order.customer_id}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-gray-400" />
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Order Date</span>
                                                        <span className="font-black text-gray-900">
                                                            {new Date(order.order_date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Package size={16} className="text-gray-400" />
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Items</span>
                                                        <span className="font-black text-gray-900">{order.items.length} items</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <DollarSign size={16} className="text-gray-400" />
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase block">Total</span>
                                                        <span className="font-black text-gray-900 font-mono">
                                                            ${order.total.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
