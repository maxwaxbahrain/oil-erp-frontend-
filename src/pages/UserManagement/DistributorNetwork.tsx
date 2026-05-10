import { useState } from 'react';
import {
    Handshake, Plus, Map, List,
    TrendingUp, Building2, Phone, Mail, CornerUpLeft
} from 'lucide-react';
import clsx from 'clsx';

const DISTRIBUTORS = [
    { id: 'DIST-001', name: 'ABC Distributors Inc.', region: 'Northeast', tier: 'Platinum', status: 'Active', sales: 156890, monthTarget: 150000, credit: 500000, balance: 45680, contact: 'Ahmed Khan' },
    { id: 'DIST-002', name: 'XYZ Distribution Co.', region: 'West Coast', tier: 'Gold', status: 'Active', sales: 89000, monthTarget: 100000, credit: 250000, balance: 12000, contact: 'John Doe' },
    { id: 'DIST-003', name: 'Global Traders LLC', region: 'Midwest', tier: 'Silver', status: 'Inactive', sales: 0, monthTarget: 50000, credit: 100000, balance: 0, contact: 'Mike Smith' },
];

import { Link } from 'react-router-dom';

// ...

export default function DistributorNetwork() {
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <Link to="/users/dashboard" className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 hover:text-redwood-brand mb-2">
                        <CornerUpLeft size={12} /> Back to Dashboard
                    </Link>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Handshake className="text-redwood-brand" /> Distributor Network
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Partner Management • Territory • Performance
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="flex bg-gray-100 rounded-sm p-1 border border-gray-200">
                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx("px-3 py-1 rounded-sm text-xs font-bold uppercase flex items-center gap-2", viewMode === 'list' ? "bg-white shadow text-redwood-text-main" : "text-gray-500 hover:text-gray-700")}
                        >
                            <List size={14} /> List
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={clsx("px-3 py-1 rounded-sm text-xs font-bold uppercase flex items-center gap-2", viewMode === 'map' ? "bg-white shadow text-redwood-text-main" : "text-gray-500 hover:text-gray-700")}
                        >
                            <Map size={14} /> Map
                        </button>
                    </div>
                    <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-redwood-brand/90 shadow-md">
                        <Plus size={14} /> Add Distributor
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* KPI Cards */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Monthly Sales</div>
                        <div className="text-3xl font-black text-redwood-text-main mt-1">$2.5M</div>
                        <div className="text-xs font-bold text-emerald-600 mt-2 flex items-center gap-1">
                            <TrendingUp size={12} /> +12.5% vs last month
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Active Distributors</div>
                        <div className="text-3xl font-black text-blue-600 mt-1">230</div>
                        <div className="text-xs font-bold text-gray-500 mt-2"> / 245 Total</div>
                    </div>
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Avg Order Value</div>
                        <div className="text-3xl font-black text-purple-600 mt-1">$125K</div>
                        <div className="text-xs font-bold text-gray-500 mt-2">Per Month</div>
                    </div>
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Top Performer</div>
                        <div className="text-xl font-black text-amber-600 mt-1 truncate">ABC Distributors</div>
                        <div className="text-xs font-bold text-gray-500 mt-2">Northeast Region</div>
                    </div>
                </div>

                {viewMode === 'map' ? (
                    <div className="h-[500px] bg-blue-50 border border-blue-100 rounded-sm flex items-center justify-center flex-col text-blue-300">
                        <Map size={64} className="mb-4" />
                        <div className="text-xl font-bold uppercase">Map View Visualization</div>
                        <div className="text-sm">Coming Soon</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white border border-redwood-border p-4 rounded-sm flex gap-4">
                            <div className="relative flex-1">
                                <input type="text" placeholder="Search distributors..." className="w-full pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-redwood-brand" />
                            </div>
                            <div className="flex gap-2">
                                <select className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-xs font-bold text-gray-600 uppercase focus:outline-none">
                                    <option>All Tiers</option>
                                    <option>Platinum</option>
                                    <option>Gold</option>
                                </select>
                                <select className="px-4 py-2 bg-white border border-gray-200 rounded-sm text-xs font-bold text-gray-600 uppercase focus:outline-none">
                                    <option>All Regions</option>
                                </select>
                            </div>
                        </div>

                        {/* List */}
                        {DISTRIBUTORS.map(dist => (
                            <div key={dist.id} className="bg-white border border-redwood-border rounded-sm p-6 hover:shadow-md transition-shadow group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                            <Building2 className="text-gray-400" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-black text-redwood-text-main">{dist.name}</h3>
                                                {dist.tier === 'Platinum' && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">💎 Platinum</span>}
                                                {dist.tier === 'Gold' && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">🥇 Gold</span>}
                                                {dist.tier === 'Silver' && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1">🥈 Silver</span>}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                <span className="font-mono">{dist.id}</span>
                                                <span className="flex items-center gap-1"><Map size={10} /> {dist.region}</span>
                                                <span className={clsx("font-bold uppercase", dist.status === 'Active' ? 'text-emerald-600' : 'text-gray-400')}>{dist.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="px-3 py-1.5 border border-gray-200 rounded text-xs font-bold uppercase hover:bg-gray-50">View Profile</button>
                                        <button className="px-3 py-1.5 bg-redwood-brand text-white border border-redwood-brand rounded text-xs font-bold uppercase hover:bg-redwood-brand/90">Details</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-6 pt-4 border-t border-gray-100">
                                    <div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Owner / Contact</div>
                                        <div className="text-sm font-bold">{dist.contact}</div>
                                        <div className="flex gap-2 mt-1">
                                            <Mail size={12} className="text-gray-400 cursor-pointer hover:text-blue-600" />
                                            <Phone size={12} className="text-gray-400 cursor-pointer hover:text-blue-600" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Performance (Dec)</div>
                                        <div className="flex items-end gap-2">
                                            <div className="text-sm font-black">${dist.sales.toLocaleString()}</div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">/ ${dist.monthTarget.toLocaleString()}</div>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className={clsx("h-full rounded-full", dist.sales >= dist.monthTarget ? "bg-emerald-500" : "bg-amber-500")}
                                                style={{ width: `${Math.min((dist.sales / dist.monthTarget) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Outstanding Balance</div>
                                        <div className="text-sm font-black text-redwood-text-main">${dist.balance.toLocaleString()}</div>
                                        <div className="text-[10px] text-emerald-600 font-bold mt-1">Credit Avail: ${(dist.credit - dist.balance).toLocaleString()}</div>
                                    </div>
                                    <div className="flex items-center justify-end">
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block uppercase">Payment On-Time</div>
                                            <div className="text-[10px] text-gray-400 mt-1">Last Order: 2 days ago</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
