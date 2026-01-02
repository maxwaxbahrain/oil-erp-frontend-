import {
    MapPin,
    Plus,
    Truck,
    Smartphone,
    Store,
    ArrowRight,
    AlertTriangle,
    CheckCircle2,
    Activity,
    Info,
    History
} from 'lucide-react';
import clsx from 'clsx';

interface StockLocation {
    id: string;
    name: string;
    type: 'Warehouse' | 'Van' | 'Store';
    utilization: number;
    occupancy: string;
    status: 'Healthy' | 'Overcapacity' | 'Underutilized';
    lastAudit: string;
    assignedPersonnel?: string;
    itemCount: number;
}

const MOCK_LOCATIONS: StockLocation[] = [
    { id: 'LOC-001', name: 'Main Distribution Center', type: 'Warehouse', utilization: 85, occupancy: '850/1000m³', status: 'Healthy', lastAudit: 'Jan 15, 2024', itemCount: 1250 },
    { id: 'LOC-002', name: 'Van 01 (Downtown)', type: 'Van', utilization: 92, occupancy: '46/50 Units', status: 'Overcapacity', lastAudit: 'Jan 22, 2024', assignedPersonnel: 'John Doe', itemCount: 46 },
    { id: 'LOC-003', name: 'Van 02 (Industrial Area)', type: 'Van', utilization: 45, occupancy: '22/50 Units', status: 'Underutilized', lastAudit: 'Jan 20, 2024', assignedPersonnel: 'Jane Smith', itemCount: 22 },
    { id: 'LOC-004', name: 'Al-Quoz Service Point', type: 'Store', utilization: 65, occupancy: '65/100m³', status: 'Healthy', lastAudit: 'Jan 10, 2024', itemCount: 85 },
];

export default function StockLocations() {

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase flex items-center gap-3">
                        <MapPin className="text-redwood-brand" size={32} />
                        Network Stock Locations
                    </h1>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Multi-node Spatial Inventory Intelligence</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-8 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200">
                        <Plus size={20} /> Register New Node
                    </button>
                </div>
            </div>

            {/* Global Utilization Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Network Health', value: '78%', sub: 'Avg Utilization', icon: Activity, color: 'text-emerald-500' },
                    { label: 'Total Nodes', value: '24', sub: 'Active Locations', icon: MapPin, color: 'text-blue-500' },
                    { label: 'Critical Capacity', value: '03', sub: 'Nodes > 90%', icon: AlertTriangle, color: 'text-red-500' },
                    { label: 'Audits Due', value: '05', sub: 'Pending for Q1', icon: History, color: 'text-amber-500' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">{stat.label}</span>
                            <p className="text-4xl font-black text-gray-900 tracking-tighter">{stat.value}</p>
                            <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase">{stat.sub}</p>
                        </div>
                        <stat.icon className={clsx("absolute top-0 right-0 p-4 opacity-5 translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700", stat.color)} size={100} />
                    </div>
                ))}
            </div>

            {/* Locations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {MOCK_LOCATIONS.map((loc) => (
                    <div key={loc.id} className="bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:border-redwood-brand/20 transition-all group overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 translate-x-8 -translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700">
                            {loc.type === 'Warehouse' ? <Truck size={200} /> : loc.type === 'Van' ? <Smartphone size={200} /> : <Store size={200} />}
                        </div>

                        <div className="flex justify-between items-start mb-10 relative">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-100 group-hover:bg-redwood-brand group-hover:text-white transition-all duration-500 shadow-inner">
                                    {loc.type === 'Warehouse' ? <Truck size={32} /> : loc.type === 'Van' ? <Smartphone size={32} /> : <Store size={32} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">{loc.name}</h3>
                                        <span className={clsx(
                                            "text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-widest border",
                                            loc.status === 'Healthy' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                loc.status === 'Overcapacity' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                        )}>{loc.status}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 flex items-center gap-2">
                                        ID: {loc.id} | <MapPin size={10} /> {loc.type}
                                    </p>
                                </div>
                            </div>
                            <button className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:text-redwood-brand transition-colors"><Info size={20} /></button>
                        </div>

                        <div className="space-y-8 relative">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-500">
                                    <span>Spatial Utilization</span>
                                    <span>{loc.utilization}%</span>
                                </div>
                                <div className="h-2.5 bg-gray-50 rounded-full border border-gray-100 overflow-hidden">
                                    <div
                                        className={clsx(
                                            "h-full transition-all duration-1000",
                                            loc.utilization > 90 ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]' :
                                                loc.utilization < 50 ? 'bg-amber-400' : 'bg-emerald-500'
                                        )}
                                        style={{ width: `${loc.utilization}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">{loc.occupancy}</span>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Audit: {loc.lastAudit}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-50">
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Items Held</p>
                                    <p className="text-xl font-black text-gray-900 tracking-tight">{loc.itemCount.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Personnel</p>
                                    <p className="text-xl font-black text-gray-900 tracking-tight">{loc.assignedPersonnel || 'Automated'}</p>
                                </div>
                            </div>

                            <button className="w-full py-5 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-gray-900 hover:text-white transition-all flex items-center justify-center gap-3">
                                View Node Details <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Strategic Optimization AI Tool */}
            <div className="bg-gradient-to-br from-gray-950 to-gray-900 p-12 rounded-3xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-5">
                    <History size={280} className="text-redwood-brand" />
                </div>
                <div className="relative">
                    <div className="flex items-center gap-4 mb-10">
                        <div className="w-14 h-14 bg-redwood-brand/20 border border-redwood-brand/30 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-2xl">
                            <CheckCircle2 className="text-redwood-brand" size={28} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">AI Node Rebalancer</h3>
                            <p className="text-[10px] font-black text-redwood-brand uppercase tracking-widest">Optimizing Geo-Spatial Stock Density</p>
                        </div>
                    </div>

                    <div className="p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md mb-8">
                        <p className="text-lg font-black text-white uppercase tracking-tight mb-4 flex items-center gap-3">
                            <Smartphone className="text-blue-400" size={24} />
                            Urgent Rebalance Suggested (VAN 01 & 02)
                        </p>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed mb-8">
                            Van 01 is at 92% capacity and losing sales opportunities for key oils. Van 02 is at 45% and has surplus. Suggest moving <span className="text-white">15 units of Bettano 15W40</span> to Van 01 to capture $22k pending demand.
                        </p>
                        <div className="flex gap-4">
                            <button className="px-8 py-3 bg-redwood-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg shadow-redwood-brand/20 transition-all">Authorize Transfer</button>
                            <button className="px-8 py-3 bg-white/5 text-gray-400 border border-white/10 text-[10px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">Details</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
