import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Package,
    ArrowLeft,
    Edit2,
    Copy,
    TrendingUp,
    Zap,
    History,
    AlertTriangle,
    CheckCircle2,
    Download,
    Maximize2,
    ShoppingCart,
    Users,
    Activity,
    Target,
    RefreshCw,
    Smartphone,
    Truck,
    Store,
    Clock,
    DollarSign,
    Box,
    MessageSquare,
    Phone
} from 'lucide-react';
import { getProductById, type Product } from '../../services/productService';
import clsx from 'clsx';

type TabType = 'Performance' | 'Inventory' | 'Velocity' | 'Customers' | 'Pricing' | 'Suppliers' | 'Losses' | 'Forecast' | 'Action' | 'Documents';

export default function ProductOverview() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('Performance');

    useEffect(() => {
        if (id) {
            loadProduct(id);
        }
    }, [id]);

    async function loadProduct(prodId: string) {
        try {
            setLoading(true);
            const data = await getProductById(prodId);
            if (data) setProduct(data);
        } catch (error) {
            console.error('Failed to load product details:', error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-redwood-brand border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center">Decrypting Product DNA...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] bg-white rounded-xl border-2 border-dashed border-gray-100 p-12">
                <Package size={64} className="text-gray-200 mb-6" />
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Product Not Found</h2>
                <button onClick={() => navigate('/products')} className="mt-6 px-8 py-3 bg-redwood-brand text-white text-[11px] font-black uppercase tracking-widest rounded-sm">Back to Catalog</button>
            </div>
        );
    }

    const totalStock = product.locations.reduce((sum, l) => sum + l.currentStock, 0);

    return (
        <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 1. Page Header */}
            <div className="flex flex-col gap-6">
                <button
                    onClick={() => navigate('/products')}
                    className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-redwood-brand transition-colors w-fit"
                >
                    <ArrowLeft size={14} /> Back to Product Catalog
                </button>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-8">
                        <div className="w-24 h-24 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 relative group overflow-hidden shrink-0">
                            <Package size={40} className="text-gray-300 group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 size={20} className="text-gray-600" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">{product.name}</h1>
                                <span className={clsx(
                                    "px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest",
                                    product.velocityStatus === 'Fast' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-gray-50 text-gray-500"
                                )}>
                                    {product.velocityStatus} Mover
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SKU: {product.sku}</span>
                                <div className="w-1 h-1 bg-gray-200 rounded-full"></div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">BC: {product.barcode || 'N/A'}</span>
                                <div className="w-1 h-1 bg-gray-200 rounded-full"></div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category: {product.category}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                                <div className={clsx("w-2 h-2 rounded-full", product.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300')}></div>
                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{product.status}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button className="p-3 bg-gray-50 text-gray-400 border border-gray-100 rounded-xl hover:text-redwood-brand hover:bg-white hover:shadow-lg transition-all">
                            <RefreshCw size={20} />
                        </button>
                        <button className="px-5 py-3 bg-gray-50 text-gray-600 text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 border border-gray-100 hover:bg-white hover:shadow-lg transition-all">
                            <Copy size={16} /> Duplicate
                        </button>
                        <button onClick={() => navigate(`/products/edit/${product.id}`)} className="px-5 py-3 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 hover:bg-black transition-all shadow-xl">
                            <Edit2 size={16} /> Edit Product
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Executive Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                        <ShoppingCart size={80} />
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Total Sales (30d)</span>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-3xl font-black text-gray-900 tracking-tighter">{product.salesVelocity} Units</p>
                            <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-widest flex items-center gap-1">
                                <TrendingUp size={12} /> {product.salesTrend}% vs last
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                        <DollarSign size={80} />
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Net Profit Generated</span>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-3xl font-black text-gray-900 tracking-tighter">${(product.salesVelocity * product.netProfitPerUnit).toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">${product.netProfitPerUnit}/unit margin</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group border-l-4 border-l-redwood-brand">
                    <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                        <Box size={80} className="text-redwood-brand" />
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Current Stock Level</span>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-3xl font-black text-gray-900 tracking-tighter">{totalStock} Units</p>
                            <p className="text-[10px] font-bold text-amber-500 mt-1 uppercase tracking-widest">{product.daysStockRemaining} days supply remaining</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
                        <Activity size={80} />
                    </div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Gross Margin %</span>
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-3xl font-black text-emerald-600 tracking-tighter">{product.grossMarginPercent}%</p>
                            <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-widest flex items-center gap-1">
                                <TrendingUp size={12} /> Stable Performance
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. High-Fidelity Tab Navigation */}
            <div className="bg-white p-1 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
                <div className="flex items-center min-w-max">
                    {(['Performance', 'Inventory', 'Velocity', 'Customers', 'Pricing', 'Suppliers', 'Losses', 'Forecast', 'Action', 'Documents'] as TabType[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative shrink-0",
                                activeTab === tab
                                    ? "text-redwood-brand bg-gray-50 rounded-xl"
                                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50/50 rounded-xl"
                            )}
                        >
                            {activeTab === tab && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-redwood-brand rounded-full"></div>}
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Deep-Dive Panels */}
            <div className="grid grid-cols-1 gap-6">
                {activeTab === 'Performance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
                        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-12">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em]">Sales Metrics Comparison</h3>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Multi-period aggregation</p>
                                </div>
                                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
                                    {['7d', '30d', '90d', 'YTD'].map(p => (
                                        <button key={p} className={clsx("px-2 py-1 text-[8px] font-black rounded uppercase", p === '30d' ? "bg-white text-gray-900 shadow-sm" : "text-gray-400")}>{p}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6 bg-gray-50 p-8 rounded-2xl">
                                    <div>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Units Sold</span>
                                        <p className="text-3xl font-black text-gray-900 tracking-tighter">450</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Total Revenue</span>
                                        <p className="text-3xl font-black text-gray-900 tracking-tighter">$675,000</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Gross Profit</span>
                                        <span className="text-sm font-black text-emerald-600">$216,000 (32%)</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-100">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Net Profit</span>
                                        <span className="text-sm font-black text-emerald-600">$157,500 (23.3%)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 pt-8 border-t border-gray-50">
                                <div className="flex items-center gap-4 text-emerald-600">
                                    <TrendingUp size={20} />
                                    <p className="text-[11px] font-black uppercase tracking-widest">Growing Trend (+15% vs prev period)</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em] mb-12">Profitability Architecture</h3>
                            <div className="space-y-10">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500">
                                        <span>Revenue Stack</span>
                                        <span>100%</span>
                                    </div>
                                    <div className="flex h-12 rounded-2xl overflow-hidden border-2 border-gray-50">
                                        <div className="bg-gray-900 w-[68%] h-full flex items-center justify-center" title="COGS">
                                            <span className="text-[8px] font-black text-white px-2">COGS (68%)</span>
                                        </div>
                                        <div className="bg-emerald-500 w-[23.3%] h-full flex items-center justify-center" title="Net Profit">
                                            <span className="text-[8px] font-black text-white px-2">NET (23.3%)</span>
                                        </div>
                                        <div className="bg-blue-400 w-[8.7%] h-full flex items-center justify-center" title="OpEx">
                                            <span className="text-[8px] font-black text-white px-2">OP (8.7%)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-6 bg-redwood-brand/5 border border-redwood-brand/10 rounded-2xl">
                                        <p className="text-[10px] font-black text-redwood-brand uppercase tracking-widest mb-1">Company-Wide Impact</p>
                                        <p className="text-xl font-black text-gray-900 tracking-tight">20.8% Contribution to Total Revenue</p>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase mt-2">This is a primary revenue driver for the enterprise.</p>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-50">
                                    <div className="flex items-start gap-4 p-4 bg-gray-900 rounded-2xl">
                                        <Zap className="text-amber-400 shrink-0 mt-1" size={20} />
                                        <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase">
                                            <span className="text-white">AI Analysis:</span> Gross margin is improving despite cost pressure due to successful price positioning strategy.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Inventory' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex justify-between items-center mb-12">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Global Inventory Deployment</h3>
                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">Real-time stock across all nodes</p>
                                </div>
                                <div className="flex gap-3">
                                    <button className="px-6 py-3 bg-redwood-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg shadow-redwood-brand/20 transition-all">
                                        Rebalance Stock
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {product.locations.map(loc => (
                                    <div key={loc.id} className="p-8 bg-gray-50 rounded-2xl border border-gray-100 hover:border-redwood-brand/20 hover:bg-white hover:shadow-xl transition-all group relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700">
                                            {loc.type === 'Warehouse' ? <Truck size={100} /> : loc.type === 'Van' ? <Smartphone size={100} /> : <Store size={100} />}
                                        </div>

                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 border border-gray-100 shadow-sm group-hover:text-redwood-brand transition-colors">
                                                {loc.type === 'Warehouse' ? <Truck size={20} /> : loc.type === 'Van' ? <Smartphone size={20} /> : <Store size={20} />}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">{loc.name}</h4>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{loc.assignedTo || loc.type}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div>
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-[18px] font-black text-gray-900 tracking-tighter">{loc.currentStock}</span>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest pb-1">Units</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={clsx(
                                                            "h-full transition-all duration-1000",
                                                            loc.currentStock <= loc.reorderPoint ? 'bg-red-500' : 'bg-emerald-500'
                                                        )}
                                                        style={{ width: `${Math.min((loc.currentStock / (loc.maxStock || 500)) * 100, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Threshold</p>
                                                    <p className="text-[11px] font-black text-gray-900">{loc.reorderPoint}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Daily Cap</p>
                                                    <p className="text-[11px] font-black text-gray-900">{loc.maxStock}</p>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                                <span className={clsx(
                                                    "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest",
                                                    loc.currentStock <= loc.reorderPoint ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                    {loc.currentStock <= loc.reorderPoint ? '⚠️ Reorder' : '✅ Healthy'}
                                                </span>
                                                <span className="text-[9px] font-black text-gray-400">{loc.avgDailySales || 0} units/day</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-900 p-10 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-12">
                            <div className="md:w-1/3 text-center md:text-left">
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Replenishment Intelligence</h3>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Enterprise Accounting Standard Calculations</p>
                            </div>
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-8">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Avg Daily Sales</p>
                                    <p className="text-2xl font-black text-white tracking-tighter">15 Units</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Lead Time (Global)</p>
                                    <p className="text-2xl font-black text-white tracking-tighter">7 Days</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Safety Stock</p>
                                    <p className="text-2xl font-black text-white tracking-tighter">30 Units</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Reorder Level</p>
                                    <p className="text-2xl font-black text-redwood-brand tracking-tighter">135 Units</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Velocity' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                        <div className="lg:col-span-1 space-y-8">
                            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm text-center">
                                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-xl">
                                    <TrendingUp className="text-emerald-500" size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Fast Mover</h3>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">Current Classification</p>
                                <p className="text-[11px] font-bold text-gray-500 uppercase mt-8 leading-relaxed">
                                    This product is in the <span className="text-gray-900">TOP 30%</span> of your catalog by sales volume.
                                </p>

                                <div className="mt-12 space-y-4 text-left border-t border-gray-50 pt-8">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">98th Percentile (Top 2%)</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Turnover: 12x per Year</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 size={16} className="text-emerald-500" />
                                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Consistent Growth Node</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter mb-12">Velocity Trend Matrix</h3>
                            <div className="h-64 flex items-end justify-between gap-4 group px-4">
                                {[30, 45, 60, 40, 50, 80, 70, 90, 65, 55, 45, 50].map((h, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 bg-gray-50 hover:bg-redwood-brand transition-all duration-500 rounded-t-lg relative group/bar"
                                        style={{ height: `${h}%` }}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] font-black px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {Math.round(h * 6)} Units
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between mt-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-t border-gray-50 pt-8">
                                <span>3 Months Ago</span>
                                <span>Present Day</span>
                                <span>Projected Path</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Customers' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Buyer Base</span>
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">87 Customers</p>
                                <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-widest flex items-center gap-1">
                                    <TrendingUp size={12} /> 12 New this month
                                </p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Repeat Rate</span>
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">89.4%</p>
                                <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-widest">High Loyalty Score</p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-redwood-brand">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Churn Alerts</span>
                                <p className="text-3xl font-black text-redwood-brand tracking-tighter">23 At Risk</p>
                                <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">Action Required</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Retention Opportunity Identification</h3>
                                <button className="text-[10px] font-black text-redwood-brand uppercase tracking-widest hover:underline">View CRM Pipeline</button>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {[
                                    { name: 'Bilal Auto', last: '32d ago', gap: '17d overdue', risk: 'High', value: '$24k/mo' },
                                    { name: 'Falcon Traders', last: '28d ago', gap: '18d overdue', risk: 'Critical', value: '$18k/mo' },
                                    { name: 'Metro Garage', last: '22d ago', gap: '2d overdue', risk: 'Low', value: '$9k/mo' }
                                ].map((c, i) => (
                                    <div key={i} className="p-8 flex items-center justify-between hover:bg-gray-50/50 transition-all group">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-white rounded-full border border-gray-100 flex items-center justify-center text-gray-400 font-black text-sm">
                                                {c.name[0]}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">{c.name}</h4>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Last Purchase: {c.last} | <span className="text-red-500">{c.gap}</span></p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-12 text-right">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lost Revenue Risk</p>
                                                <p className="text-sm font-black text-red-600">{c.value}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button className="p-3 bg-redwood-brand text-white rounded-xl hover:brightness-110 transition-all shadow-md">
                                                    <Phone size={16} />
                                                </button>
                                                <button className="p-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-md">
                                                    <MessageSquare size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Pricing' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-12">Landed Cost Composition</h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl">
                                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Base Purchase (Ex-works)</span>
                                        <span className="text-lg font-black text-gray-900">${product.pricing.purchasePriceExWorks}</span>
                                    </div>
                                    <div className="space-y-3 px-2">
                                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <span>Freight & Shipping</span>
                                            <span>${product.pricing.freightShipping}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <span>Import Duty / Taxes</span>
                                            <span>${product.pricing.importDuty}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            <span>Handling Charges</span>
                                            <span>${product.pricing.otherDirectCosts}</span>
                                        </div>
                                    </div>
                                    <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-[12px] font-black text-gray-900 uppercase tracking-[0.2em]">Total Landed Cost (COGS)</span>
                                        <span className="text-2xl font-black text-redwood-brand">${product.pricing.landedCost}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-12">Commercial Position</h3>
                                    <div className="p-10 bg-gray-900 rounded-3xl shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Target size={120} className="text-white" />
                                        </div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Public Selling Price</label>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-black text-white tracking-tighter">${product.pricing.sellingPrice}</span>
                                            <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest ml-4">↗ {product.grossMarginPercent}% Margin</span>
                                        </div>

                                        <div className="mt-12 flex justify-between items-end border-t border-white/10 pt-8">
                                            <div>
                                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Net Unit Profit</p>
                                                <p className="text-2xl font-black text-white">${product.netProfitPerUnit}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Optimal</p>
                                                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">vs Market Average</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-8 flex gap-3">
                                    <button className="flex-1 py-4 bg-gray-50 text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-all border border-gray-100">Simulate Price Lift</button>
                                    <button className="flex-1 py-4 bg-redwood-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 transition-shadow shadow-lg shadow-redwood-brand/20">Apply New SRP</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Suppliers' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-start mb-12">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Primary Global Partner</h3>
                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1">Supply Chain Reliability Audit</p>
                                </div>
                                <div className="flex gap-1 text-amber-400">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Target key={i} size={20} fill={i <= (product.supplierReliabilityScore || 0) ? "currentColor" : "none"} />
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Partner Identity</span>
                                    <p className="text-sm font-black text-gray-900 uppercase">{product.primarySupplierName || 'Not Assigned'}</p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase">Dubai, United Arab Emirates</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AVG LEAD TIME</span>
                                    <p className="text-sm font-black text-gray-900 uppercase">{product.leadTimeDays} Standard Days</p>
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase">✅ 94% ON-TIME RATE</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cost Trend (12M)</span>
                                    <p className="text-sm font-black text-red-600 uppercase">↗ +7.9% INCREASE</p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase">VS REGIONAL INFLATION 5%</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QUALITY SCORE</span>
                                    <p className="text-sm font-black text-emerald-600 uppercase">0.5% DEFECT RATE</p>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase">API CERTIFIED COMPLIANCE</p>
                                </div>
                            </div>

                            <div className="mt-12 pt-8 border-t border-gray-50">
                                <div className="flex items-start gap-4 p-6 bg-redwood-brand/5 border border-redwood-brand/10 rounded-2xl">
                                    <Zap className="text-redwood-brand shrink-0" size={20} />
                                    <div>
                                        <p className="text-[11px] font-black text-gray-900 uppercase tracking-widest">Supplier Negotiation Alert</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase mt-1 leading-relaxed">
                                            Current supplier cost has outpaced inflation by 2.9%. AI suggests leveraging a quotes from "Supplier B" to negotiate a 5% volume discount ($256k annual saving potential).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Losses' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-red-500">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Total Hidden Losses</span>
                                <p className="text-3xl font-black text-red-600 tracking-tighter">$6,120</p>
                                <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Last 30 days aggregation</p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Van Leakage Rate</span>
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">3.0%</p>
                                <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-widest flex items-center gap-1">
                                    <AlertTriangle size={12} /> Above 2% threshold
                                </p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Customer Returns</span>
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">0.4%</p>
                                <p className="text-[10px] font-bold text-emerald-500 mt-1 uppercase tracking-widest">Excellent Reliability</p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Damage Loss</span>
                                <p className="text-3xl font-black text-gray-900 tracking-tighter">0.02%</p>
                                <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Optimal Handling</p>
                            </div>
                        </div>

                        <div className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-12">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Audit Trail: Field Sales Discrepancy</h3>
                                <button className="px-5 py-2.5 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-all border border-gray-100">Schedule Physical Audit</button>
                            </div>
                            <div className="space-y-6">
                                {[
                                    { date: 'Jan 25', issued: 50, sold: 47, leak: '6.0%', status: '⚠️ Critical' },
                                    { date: 'Jan 18', issued: 50, sold: 49, leak: '2.0%', status: '✅ Normal' },
                                    { date: 'Jan 11', issued: 50, sold: 50, leak: '0.0%', status: '✅ Perfect' }
                                ].map((row, i) => (
                                    <div key={i} className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-lg transition-all border border-transparent hover:border-gray-100 group">
                                        <div className="flex items-center gap-8">
                                            <div className="text-center w-16">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Period</p>
                                                <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{row.date}</p>
                                            </div>
                                            <div className="w-px h-10 bg-gray-200"></div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Flow</p>
                                                <p className="text-sm font-black text-gray-900 uppercase">Issued: {row.issued} | Sold: {row.sold}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Leakage Node</p>
                                            <div className="flex items-center justify-end gap-3">
                                                <span className={clsx("text-lg font-black", row.leak === '0.0%' ? 'text-emerald-500' : 'text-red-600')}>{row.leak}</span>
                                                <span className={clsx("text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest", row.status.includes('Critical') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}>{row.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Forecast' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="bg-gray-950 p-12 rounded-3xl shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-10 group-hover:translate-x-4 group-hover:-translate-y-4 transition-transform duration-1000">
                                <Zap size={280} className="text-redwood-brand" />
                            </div>

                            <div className="flex items-center gap-4 mb-12">
                                <div className="w-16 h-16 bg-redwood-brand/10 rounded-2xl flex items-center justify-center border border-redwood-brand/20 backdrop-blur-md">
                                    <Zap className="text-redwood-brand" size={32} />
                                </div>
                                <div className="">
                                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter">AI Demand Prediction (30 Days)</h3>
                                    <div className="flex items-center gap-3 mt-1 text-emerald-500">
                                        <Activity size={14} className="animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Model Confidence: 87% (High)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Projected Volume</p>
                                        <div className="flex items-baseline gap-4">
                                            <p className="text-5xl font-black text-white tracking-tighter">520 Units</p>
                                            <p className="text-xl font-black text-emerald-500 uppercase tracking-widest">↗ +15.6% Growth</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 pt-8 border-t border-white/10">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">PEAK WEEK</p>
                                            <p className="text-sm font-black text-white uppercase">WEEK 2 (FEB 4-10)</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">SEASONAL SENSITIVITY</p>
                                            <p className="text-sm font-black text-amber-400 uppercase">HIGH (SUMMER SURGE)</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 flex flex-col justify-between">
                                    <div>
                                        <p className="text-[11px] font-black text-white uppercase tracking-widest mb-6">AI BRAIN Insight</p>
                                        <p className="text-sm font-bold text-gray-300 leading-relaxed uppercase">
                                            "Prediction based on 3-year historical patterns and current +15% velocity node. Winter maintenance surge expected to add 30% baseline demand."
                                        </p>
                                    </div>
                                    <div className="pt-8 border-t border-white/10 flex justify-between items-center">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Reliability Band</p>
                                        <p className="text-[10px] font-black text-white uppercase tracking-widest">485 - 555 Units (95% CI)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Action' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-red-500 group hover:shadow-xl transition-all">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded">⚡ URGENT - DO NOW</span>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Loss Mitigation</span>
                                    </div>
                                    <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">REORDER STOCK IMMEDIATELY</h4>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed mb-8">
                                        Stockout risk detected in 28 days. Prevent <span className="text-red-600 font-black">$78k lost revenue</span> per week.
                                    </p>
                                    <div className="flex gap-3">
                                        <button className="flex-1 py-4 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-red-500/20">Create Purchase Order Now</button>
                                        <button className="p-4 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all"><Clock size={18} /></button>
                                    </div>
                                </div>

                                <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm border-l-4 border-l-amber-500 group hover:shadow-xl transition-all">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">⚠️ INVESTIGATE</span>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Operational Leakage</span>
                                    </div>
                                    <h4 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-2">VAN 1 STOCK DISCREPANCY</h4>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed mb-8">
                                        3% leakage rate detected (above 2% threshold). Audit required to recover <span className="text-amber-600 font-black">$6,120 locked value</span>.
                                    </p>
                                    <div className="flex gap-3">
                                        <button className="flex-1 py-4 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-amber-500/20">Start Van Audit</button>
                                        <button className="p-4 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all"><RefreshCw size={18} /></button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-950 p-12 rounded-3xl shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-5">
                                    <Zap size={220} className="text-redwood-brand" />
                                </div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-12 flex items-center gap-3">
                                    <Activity className="text-redwood-brand" size={24} />
                                    STRATEGIC DECISION SUPPORT
                                </h3>

                                <div className="space-y-8">
                                    <div className="flex items-start gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer">
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                                            <Target className="text-emerald-400" size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tighter">Increase Price by 3%</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Expected Profit Impact: +$20k/Mo | Risk: Low</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer">
                                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                                            <Package className="text-blue-400" size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tighter">Create "Oil Change Kit" Bundle</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Bettano 15W40 + Filter | Est. Revenue Lift: $78k/Mo</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all cursor-pointer">
                                        <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                                            <Users className="text-red-400" size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white uppercase tracking-tighter">Negotiate Supplier Rebate</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Target: 5% Discount on 3k+ units/year</p>
                                        </div>
                                    </div>
                                </div>
                                <button className="w-full mt-10 py-5 bg-white text-gray-950 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-gray-100 transition-all">Simulate All Strategic Outcomes</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'Documents' && (
                    <div className="flex flex-col items-center justify-center bg-white p-32 rounded-3xl border-2 border-dashed border-gray-100 text-center animate-in zoom-in-95 duration-500">
                        <History size={64} className="text-gray-200 mb-8" />
                        <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter">Material Document Vault</h3>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-4 max-w-sm">
                            Access all safety data sheets, regulatory certifications, and technical audit reports associated with this material SKU.
                        </p>
                        <button className="mt-12 px-10 py-4 bg-gray-50 border border-gray-100 text-[11px] font-black uppercase tracking-widest rounded-xl text-gray-600 hover:text-redwood-brand hover:bg-white hover:shadow-xl transition-all flex items-center gap-3">
                            <Download size={18} /> Download All Media Assets
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
