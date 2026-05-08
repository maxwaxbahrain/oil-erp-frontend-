import { useState, useEffect } from 'react';
import {
    AlertTriangle,
    Package,
    Zap,
    ShoppingCart,
    XCircle,
    ArrowRight,
    RefreshCw,
    Bell
} from 'lucide-react';
import clsx from 'clsx';
import { getProducts, type Product } from '../../services/productService';

interface LowStockProduct {
    id: string;
    name: string;
    sku: string;
    category: string;
    currentStock: number;
    requiredStock: number;
    needed: number;
    status: 'Out of Stock' | 'Low Stock' | 'Critical';
}

export default function LowStockAlerts() {
    const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'All' | 'Out of Stock' | 'Low Stock' | 'Critical'>('All');

    useEffect(() => {
        loadLowStockProducts();
    }, []);

    const loadLowStockProducts = async () => {
        setLoading(true);
        try {
            const products = await getProducts();
            const lowStock: LowStockProduct[] = [];

            products.forEach((product: Product) => {
                // Calculate total current stock across all locations
                const currentStock = product.locations.reduce((sum, loc) => sum + (loc.currentStock ?? 0), 0);
                const requiredStock = product.reorderLevel || 0;

                // Only include if stock is below reorder level
                if (currentStock < requiredStock) {
                    const needed = requiredStock - currentStock;
                    let status: 'Out of Stock' | 'Low Stock' | 'Critical';

                    if (currentStock === 0) {
                        status = 'Out of Stock';
                    } else if (currentStock < requiredStock * 0.3) {
                        status = 'Critical';
                    } else {
                        status = 'Low Stock';
                    }

                    lowStock.push({
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        category: product.category,
                        currentStock,
                        requiredStock,
                        needed,
                        status
                    });
                }
            });

            // Sort by severity: Out of Stock > Critical > Low Stock
            lowStock.sort((a, b) => {
                const order = { 'Out of Stock': 0, 'Critical': 1, 'Low Stock': 2 };
                return order[a.status] - order[b.status];
            });

            setLowStockProducts(lowStock);
        } catch (error) {
            console.error('Failed to load low stock products:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = lowStockProducts.filter(p =>
        activeFilter === 'All' || p.status === activeFilter
    );

    const counts = {
        'Out of Stock': lowStockProducts.filter(p => p.status === 'Out of Stock').length,
        'Low Stock': lowStockProducts.filter(p => p.status === 'Low Stock').length,
        'Critical': lowStockProducts.filter(p => p.status === 'Critical').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading stock alerts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stock Health Dashboard Header */}
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-4">
                        <AlertTriangle className="text-gray-900" size={32} />
                        Low Stock Alert
                    </h2>
                    <p className="text-gray-500 mt-2 text-sm font-medium uppercase tracking-widest leading-relaxed">
                        Products below minimum required stock levels
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={loadLowStockProducts}
                        className="px-6 py-4 bg-gray-50 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-white hover:border-gray-900 transition-all border border-transparent"
                    >
                        <RefreshCw size={18} className="inline mr-2" /> Refresh
                    </button>
                    <button className="px-10 py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200">
                        <ShoppingCart size={20} /> Create Bulk Purchase Order
                    </button>
                </div>
            </div>

            {/* Quick Status Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { id: 'All', label: 'All Alerts', count: lowStockProducts.length, color: 'text-gray-900', bg: 'bg-white', icon: Bell },
                    { id: 'Out of Stock', label: 'Out of Stock', count: counts['Out of Stock'], color: 'text-rose-600', bg: 'bg-rose-50', icon: XCircle },
                    { id: 'Critical', label: 'Critical', count: counts['Critical'], color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertTriangle },
                    { id: 'Low Stock', label: 'Low Stock', count: counts['Low Stock'], color: 'text-amber-600', bg: 'bg-amber-50', icon: Package },
                ].map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setActiveFilter(f.id as any)}
                        className={clsx(
                            "p-8 rounded-3xl border transition-all text-left group relative overflow-hidden",
                            activeFilter === f.id
                                ? "bg-gray-900 border-gray-900 shadow-2xl"
                                : "bg-white border-gray-100 hover:border-gray-900 shadow-sm"
                        )}
                    >
                        <div className={clsx(
                            "absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700",
                            activeFilter === f.id ? "text-white" : f.color
                        )}>
                            <f.icon size={80} />
                        </div>
                        <span className={clsx(
                            "text-[10px] font-black uppercase tracking-widest block mb-4",
                            activeFilter === f.id ? "text-gray-400" : "text-gray-400"
                        )}>{f.label}</span>
                        <div className="flex items-baseline gap-3">
                            <p className={clsx(
                                "text-4xl font-black tracking-tighter",
                                activeFilter === f.id ? "text-white" : "text-gray-900"
                            )}>{f.count}</p>
                            <span className={clsx(
                                "text-[10px] font-bold uppercase",
                                activeFilter === f.id ? "text-gray-500" : "text-gray-400"
                            )}>Products</span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Low Stock Table */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Stock Requirements</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Current vs Required Stock Levels</p>
                </div>

                {filteredProducts.length === 0 ? (
                    <div className="p-20 text-center">
                        <Zap size={64} className="mx-auto text-emerald-500 mb-6 animate-pulse" />
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Everything looks good!</h3>
                        <p className="text-gray-400 text-sm font-medium mt-2">
                            {activeFilter === 'All'
                                ? 'All products are above minimum stock levels.'
                                : `No products in "${activeFilter}" status.`}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b-2 border-gray-100">
                                <tr>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Name</th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Current</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Required</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Needed</th>
                                    <th className="px-8 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="font-bold text-gray-900 text-sm">{product.name}</div>
                                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">SKU: {product.sku}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">{product.category}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={clsx(
                                                "text-xl font-black font-mono",
                                                product.currentStock === 0 ? "text-rose-600" : "text-gray-900"
                                            )}>{product.currentStock}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="text-xl font-black font-mono text-gray-900">{product.requiredStock}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-100">
                                                <span className="text-lg font-black font-mono text-amber-700">{product.needed}</span>
                                                <span className="text-[9px] font-black text-amber-600 uppercase">more</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className={clsx(
                                                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                                product.status === 'Out of Stock' ? "bg-rose-500 text-white" :
                                                    product.status === 'Critical' ? "bg-orange-500 text-white" : "bg-amber-500 text-white"
                                            )}>
                                                {product.status === 'Out of Stock' ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                                                {product.status}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button className="px-6 py-3 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center gap-2 ml-auto opacity-0 group-hover:opacity-100">
                                                <ShoppingCart size={14} /> Order Now
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* One-Click Actions */}
            <div className="bg-gray-50 p-12 rounded-[40px] border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-8 flex items-center gap-3">
                    🚀 One-Click Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <button className="p-8 bg-white border border-gray-100 rounded-3xl hover:border-gray-900 transition-all group text-left">
                        <ShoppingCart className="text-gray-400 mb-4 group-hover:text-gray-900 transition-colors" size={32} />
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2">Create Purchase Order</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">Combine all low stock items into a single order run.</p>
                        <ArrowRight className="mt-6 text-gray-300 group-hover:text-gray-900 transition-colors" size={20} />
                    </button>
                    <button className="p-8 bg-white border border-gray-100 rounded-3xl hover:border-gray-900 transition-all group text-left">
                        <RefreshCw className="text-gray-400 mb-4 group-hover:text-gray-900 transition-colors" size={32} />
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2">Transfer Stock</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">Move stock from overstocked locations to empty ones.</p>
                        <ArrowRight className="mt-6 text-gray-300 group-hover:text-gray-900 transition-colors" size={20} />
                    </button>
                    <button className="p-8 bg-white border border-gray-100 rounded-3xl hover:border-gray-900 transition-all group text-left">
                        <Bell className="text-gray-400 mb-4 group-hover:text-gray-900 transition-colors" size={32} />
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2">Set Alert Thresholds</h4>
                        <p className="text-[10px] font-bold text-gray-400 uppercase leading-relaxed">Configure automatic alerts for each product category.</p>
                        <ArrowRight className="mt-6 text-gray-300 group-hover:text-gray-900 transition-colors" size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
