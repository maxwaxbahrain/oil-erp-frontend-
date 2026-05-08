import {
    Store, MapPin, Truck, Calendar, ShoppingBag,
    Search, Plus, CornerUpLeft
} from 'lucide-react';
import clsx from 'clsx';

const DEALERS = [
    { id: 'DLR-001', name: 'ABC Mini Mart', type: 'Mini Mart', route: 'Route A', lastVisit: 'Yesterday', owner: 'John Doe', address: '789 Store St, NYC', sales: 12450, status: 'Active' },
    { id: 'DLR-002', name: 'City Supermarket', type: 'Supermarket', route: 'Route B', lastVisit: '3 days ago', owner: 'Jane Smith', address: '456 Main Ave, NYC', sales: 45200, status: 'Active' },
    { id: 'DLR-003', name: 'Corner Grocery', type: 'Grocery Store', route: 'Route A', lastVisit: 'Yesterday', owner: 'Bob Wilson', address: '12 Oak Ln, NYC', sales: 8500, status: 'Inactive' },
];

import { Link } from 'react-router-dom';

// ...

export default function DealerNetwork() {
    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <Link to="/users/dashboard" className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 hover:text-redwood-brand mb-2">
                        <CornerUpLeft size={12} /> Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Store className="text-redwood-brand" /> Dealer Network
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Retailers • Routes • CRM
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-gray-50">
                        Assign Route
                    </button>
                    <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 shadow-md">
                        <Plus size={14} /> Add Dealer
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* Stats */}
                <div className="flex gap-4 mb-6">
                    {['Supermarkets (250)', 'Mini Marts (450)', 'Restaurants (120)'].map(cat => (
                        <div key={cat} className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold text-gray-600 uppercase shadow-sm">
                            {cat}
                        </div>
                    ))}
                </div>

                {/* Filter */}
                <div className="bg-white border border-redwood-border p-4 rounded-sm flex gap-4 mb-4 shadow-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input type="text" placeholder="Search dealers..." className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-redwood-brand" />
                    </div>
                    <div className="flex gap-2">
                        <select className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-xs font-bold text-gray-600 uppercase focus:outline-none">
                            <option>All Routes</option>
                            <option>Route A</option>
                            <option>Route B</option>
                        </select>
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {DEALERS.map(dealer => (
                        <div key={dealer.id} className="bg-white border border-redwood-border rounded-sm p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-50 rounded flex items-center justify-center text-amber-600">
                                        <ShoppingBag size={20} />
                                    </div>
                                    <div>
                                        <div className="font-black text-redwood-text-main">{dealer.name}</div>
                                        <div className="text-[10px] uppercase text-gray-400 font-bold">{dealer.type}</div>
                                    </div>
                                </div>
                                <span className={clsx("w-2 h-2 rounded-full", dealer.status === 'Active' ? "bg-emerald-500" : "bg-gray-300")}></span>
                            </div>

                            <div className="space-y-2 mb-4 border-t border-gray-100 pt-3">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <MapPin size={12} className="text-gray-400" /> {dealer.address}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Truck size={12} className="text-gray-400" /> {dealer.route}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <Calendar size={12} className="text-gray-400" /> Visited: {dealer.lastVisit}
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-gray-50 p-2 rounded-sm border border-gray-100">
                                <div>
                                    <div className="text-[9px] uppercase text-gray-400 font-bold">Total Sales</div>
                                    <div className="text-sm font-black">${dealer.sales.toLocaleString()}</div>
                                </div>
                                <button className="px-3 py-1 bg-white border border-gray-200 text-[10px] font-bold uppercase rounded hover:bg-gray-100">Profile</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
