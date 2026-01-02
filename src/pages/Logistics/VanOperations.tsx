import { useState } from 'react';
import {
    Truck, Package, ArrowRightLeft, ClipboardList,
    CheckCircle, TrendingUp,
    Search, Plus, Save, User
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import clsx from 'clsx';

// --- Mock Data ---
const PRODUCTS = [
    { id: 'COKE-500', name: 'Coca Cola 500ml', category: 'Beverages', whStock: 5000, price: 1.5, unit: 'Bottle' },
    { id: 'LAYS-REG', name: 'Lays Chips Regular', category: 'Snacks', whStock: 3200, price: 2.0, unit: 'Pack' },
    { id: 'BREAD-WHT', name: 'Bread Loaf White', category: 'Bakery', whStock: 1500, price: 2.0, unit: 'Loaf' },
    { id: 'WATER-1L', name: 'Spring Water 1L', category: 'Beverages', whStock: 8000, price: 1.0, unit: 'Bottle' },
];

const VANS = [
    { id: 'VAN-101', driver: 'John Smith', route: 'Route A', status: 'Active' },
    { id: 'VAN-102', driver: 'Mike Johnson', route: 'Route B', status: 'Active' },
    { id: 'VAN-103', driver: 'Sarah Lee', route: 'Route C', status: 'Loading' },
];

const OVERVIEW_STATS = {
    warehouseStock: 450000,
    inVansStock: 125000,
    soldToday: 56550,
    revenueToday: 45680,
    activeVans: 15,
    totalVans: 18,
    ordersToday: 245,
    podCaptured: 198
};

// --- Components ---

const StatCard = ({ label, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-[10px] font-black uppercase text-redwood-text-muted tracking-widest mb-1">{label}</p>
            <h3 className="text-2xl font-black text-redwood-text-main mb-1">{value}</h3>
            {subtext && <p className={clsx("text-xs font-bold", colorClass)}>{subtext}</p>}
        </div>
        <div className={clsx("p-3 rounded-full bg-opacity-10", colorClass.replace('text-', 'bg-').replace('600', '100'))}>
            <Icon size={20} className={colorClass} />
        </div>
    </div>
);

export default function VanOperations() {
    const [activeTab, setActiveTab] = useState<'overview' | 'loading' | 'unloading' | 'inventory'>('overview');
    const [selectedVan, setSelectedVan] = useState<string>('VAN-101');
    const [cart, setCart] = useState<any[]>([]);

    // Loading Logic Simulation
    const addToLoad = (product: any) => {
        const existing = cart.find(p => p.id === product.id);
        if (existing) {
            setCart(cart.map(p => p.id === product.id ? { ...p, qty: p.qty + 10 } : p));
        } else {
            setCart([...cart, { ...product, qty: 10 }]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Truck className="text-redwood-brand" /> Van Operations Center
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Logistics • Inventory • Reconciliation
                    </p>
                </div>
                <div className="flex gap-2">
                    {['overview', 'loading', 'unloading', 'inventory'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={clsx(
                                "px-6 py-2 rounded-sm text-xs font-black uppercase tracking-wide transition-all",
                                activeTab === tab
                                    ? "bg-redwood-brand text-white shadow-md"
                                    : "bg-white border border-redwood-border text-redwood-text-muted hover:bg-gray-50"
                            )}
                        >
                            {tab === 'inventory' ? 'Live Stock' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">

                {/* 1. OVERVIEW DASHBOARD */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard
                                label="Warehouse Stock"
                                value={`$${OVERVIEW_STATS.warehouseStock.toLocaleString()}`}
                                width="w-full"
                                icon={Package}
                                colorClass="text-redwood-brand"
                            />
                            <StatCard
                                label="Stock in Vans"
                                value={`$${OVERVIEW_STATS.inVansStock.toLocaleString()}`}
                                icon={Truck}
                                colorClass="text-blue-600"
                            />
                            <StatCard
                                label="Revenue Today"
                                value={`$${OVERVIEW_STATS.revenueToday.toLocaleString()}`}
                                subtext="Target: $50,000"
                                icon={TrendingUp}
                                colorClass="text-emerald-600"
                            />
                            <StatCard
                                label="POD Captured"
                                value={`${OVERVIEW_STATS.podCaptured}/${OVERVIEW_STATS.ordersToday}`}
                                subtext="81% Completion"
                                icon={ClipboardList}
                                colorClass="text-amber-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Inventory Flow */}
                            <div className="lg:col-span-2 bg-white border border-redwood-border rounded-sm p-6">
                                <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <ArrowRightLeft size={16} /> Inventory Movement (Today)
                                </h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: 'Opening', value: 450000, fill: '#1f2937' },
                                            { name: 'Loaded to Vans', value: 125000, fill: '#3B82F6' },
                                            { name: 'Sold', value: 56550, fill: '#10B981' },
                                            { name: 'Returned', value: 2450, fill: '#F59E0B' },
                                            { name: 'Current WH', value: 381900, fill: '#C74634' },
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* System Status List */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6">
                                <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest mb-6">System Health</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-emerald-50 text-emerald-800 rounded-sm">
                                        <div className="flex items-center gap-3">
                                            <Truck size={18} /> <span className="text-xs font-bold uppercase">Active Vans</span>
                                        </div>
                                        <span className="font-black text-lg">15/18</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-blue-50 text-blue-800 rounded-sm">
                                        <div className="flex items-center gap-3">
                                            <User size={18} /> <span className="text-xs font-bold uppercase">Salesmen Online</span>
                                        </div>
                                        <span className="font-black text-lg">15/18</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-redwood-bg-light text-redwood-brand rounded-sm">
                                        <div className="flex items-center gap-3">
                                            <Package size={18} /> <span className="text-xs font-bold uppercase">Orders Today</span>
                                        </div>
                                        <span className="font-black text-lg">245</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. LOADING SCREEN */}
                {activeTab === 'loading' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right duration-500">
                        {/* Left: Product Catalog */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white border border-redwood-border rounded-sm p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest">Select Products to Load</h3>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input type="text" placeholder="Search SKU..." className="pl-9 pr-4 py-2 border border-redwood-border rounded-sm text-xs w-64 focus:outline-none focus:border-redwood-brand" />
                                        </div>
                                    </div>
                                </div>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-redwood-bg-light text-[10px] font-black uppercase text-redwood-text-muted">
                                        <tr>
                                            <th className="p-3">Product</th>
                                            <th className="p-3">Category</th>
                                            <th className="p-3 text-right">WH Stock</th>
                                            <th className="p-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-redwood-border">
                                        {PRODUCTS.map(product => (
                                            <tr key={product.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-bold text-redwood-text-main">
                                                    <div>{product.name}</div>
                                                    <div className="text-[10px] text-gray-400">{product.id}</div>
                                                </td>
                                                <td className="p-3 text-xs text-gray-500">{product.category}</td>
                                                <td className="p-3 text-right font-mono">{product.whStock}</td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => addToLoad(product)} className="p-2 hover:bg-redwood-bg-light rounded text-redwood-brand">
                                                        <Plus size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right: Loading Manifest */}
                        <div className="space-y-6">
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-lg border-t-4 border-t-redwood-brand">
                                <div className="mb-6 pb-6 border-b border-redwood-border">
                                    <label className="block text-[10px] font-bold text-redwood-text-muted uppercase mb-1">Select Van</label>
                                    <select
                                        value={selectedVan} onChange={(e) => setSelectedVan(e.target.value)}
                                        className="w-full p-2 border border-redwood-border rounded-sm font-bold text-redwood-text-main bg-gray-50"
                                    >
                                        {VANS.map(v => <option key={v.id} value={v.id}>{v.id} - {v.driver}</option>)}
                                    </select>
                                    <div className="mt-4 flex justify-between text-xs">
                                        <span className="text-gray-500">Route:</span>
                                        <span className="font-bold">{VANS.find(v => v.id === selectedVan)?.route}</span>
                                    </div>
                                </div>

                                <h4 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Loading Manifest</h4>
                                {cart.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs italic">No items added to load</div>
                                ) : (
                                    <div className="space-y-3 mb-6">
                                        {cart.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-gray-200 pb-2">
                                                <div>
                                                    <div className="font-bold">{item.name}</div>
                                                    <div className="text-[10px] text-gray-400">{item.id}</div>
                                                </div>
                                                <div className="font-mono font-bold">x{item.qty}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3 pt-4 border-t border-redwood-border">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Total Items:</span>
                                        <span>{cart.reduce((acc, item) => acc + item.qty, 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black text-redwood-brand">
                                        <span>Total Value:</span>
                                        <span>${cart.reduce((acc, item) => acc + (item.qty * item.price), 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                <button className="w-full mt-6 py-3 bg-redwood-brand text-white font-black uppercase text-xs rounded-sm hover:bg-redwood-brand/90 transition-all flex items-center justify-center gap-2">
                                    <Save size={16} /> Confirm Load
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. UNLOADING SCREEN */}
                {activeTab === 'unloading' && (
                    <div className="max-w-4xl mx-auto bg-white border border-redwood-border rounded-sm p-8 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start mb-8 border-b border-redwood-border pb-6">
                            <div>
                                <h2 className="text-xl font-black text-redwood-text-main uppercase tracking-tight">End of Day Reconciliation</h2>
                                <p className="text-xs text-redwood-text-muted mt-1">Process returns and close daily route</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black text-redwood-text-main">6:30 PM</div>
                                <div className="text-xs font-bold text-emerald-600 uppercase">On Time</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mb-8">
                            <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Opening Value</div>
                                <div className="text-xl font-black text-gray-800">$8,500.00</div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-sm border border-emerald-200">
                                <div className="text-[10px] text-emerald-600 uppercase font-bold">Sold Today</div>
                                <div className="text-xl font-black text-emerald-800">$4,580.00</div>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-sm border border-amber-200">
                                <div className="text-[10px] text-amber-600 uppercase font-bold">Expected Return</div>
                                <div className="text-xl font-black text-amber-800">$3,920.00</div>
                            </div>
                        </div>

                        <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Return Inventory Verification</h3>
                        <table className="w-full text-left text-sm mb-8 border border-redwood-border">
                            <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500">
                                <tr>
                                    <th className="p-3">Product</th>
                                    <th className="p-3 text-right">Loaded</th>
                                    <th className="p-3 text-right">Sold</th>
                                    <th className="p-3 text-right bg-amber-50 text-amber-900 border-l border-amber-200">Return Qty</th>
                                    <th className="p-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                <tr>
                                    <td className="p-3 font-bold">Coca Cola 500ml</td>
                                    <td className="p-3 text-right text-gray-500">50</td>
                                    <td className="p-3 text-right text-gray-500">25</td>
                                    <td className="p-3 text-right font-bold bg-amber-50/50 border-l border-amber-100">25</td>
                                    <td className="p-3 text-right"><CheckCircle size={16} className="ml-auto text-emerald-500" /></td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-bold">Lays Chips Regular</td>
                                    <td className="p-3 text-right text-gray-500">30</td>
                                    <td className="p-3 text-right text-gray-500">12</td>
                                    <td className="p-3 text-right font-bold bg-amber-50/50 border-l border-amber-100">18</td>
                                    <td className="p-3 text-right"><CheckCircle size={16} className="ml-auto text-emerald-500" /></td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="flex justify-end gap-3">
                            <button className="px-6 py-3 bg-white border border-redwood-border text-redwood-text-main font-bold uppercase text-xs rounded-sm hover:bg-gray-50">
                                Report Discrepancy
                            </button>
                            <button className="px-6 py-3 bg-redwood-brand text-white font-black uppercase text-xs rounded-sm hover:bg-redwood-brand/90 shadow-md">
                                Complete Unloading & Close Day
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. LIVE INVENTORY */}
                {activeTab === 'inventory' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Live Updates Active (30s refresh)</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Warehouse Status */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-redwood-brand"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-black text-redwood-text-main uppercase">Warehouse Stock</h3>
                                        <p className="text-xs text-gray-500">Main Facility</p>
                                    </div>
                                    <Package className="text-redwood-brand opacity-20" size={48} />
                                </div>
                                <div className="mt-6">
                                    <div className="text-4xl font-black text-redwood-text-main">$381,900</div>
                                    <div className="text-xs font-bold text-emerald-600 mt-1">85% of Total Asset Value</div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Stock Healthy</span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase rounded">Updated: Just now</span>
                                </div>
                            </div>

                            {/* Van Fleet Status */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-black text-redwood-text-main uppercase">Fleet Inventory</h3>
                                        <p className="text-xs text-gray-500">Across 15 Active Vans</p>
                                    </div>
                                    <Truck className="text-blue-500 opacity-20" size={48} />
                                </div>
                                <div className="mt-6">
                                    <div className="text-4xl font-black text-redwood-text-main">$68,100</div>
                                    <div className="text-xs font-bold text-blue-600 mt-1">15% of Total Asset Value</div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded">Active Selling</span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase rounded">Sync: Live</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Movements */}
                        <div className="bg-white border border-redwood-border rounded-sm p-6">
                            <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Recent Stock Movements</h3>
                            <div className="space-y-0">
                                {[
                                    { time: '2 mins ago', text: 'VAN-101 sold $45 (Order #10245)', type: 'sale' },
                                    { time: '5 mins ago', text: 'VAN-103 sold $32 (Order #10244)', type: 'sale' },
                                    { time: '8 mins ago', text: 'VAN-102 return $15 (Damaged)', type: 'return' },
                                    { time: '10 mins ago', text: 'VAN-101 sold $28 (Order #10243)', type: 'sale' },
                                ].map((move, i) => (
                                    <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0 text-sm">
                                        <div className="text-xs font-mono text-gray-400 w-20">{move.time}</div>
                                        <div className={clsx("w-2 h-2 rounded-full", move.type === 'sale' ? 'bg-emerald-500' : 'bg-rose-500')}></div>
                                        <div className="font-medium text-gray-700">{move.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
