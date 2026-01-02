import { useEffect, useState } from 'react';
import { Truck, Package, Clock, ShieldCheck, AlertCircle, Plus, MoreVertical, Filter, Download, ExternalLink, Search, Map, RefreshCw } from 'lucide-react';
import { vanService, type Van } from '../../services/vanService';

const VanSalesDashboard = () => {
    const [vans, setVans] = useState<Van[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadVans();
    }, []);

    const loadVans = async () => {
        try {
            const data = await vanService.getAll();
            setVans(data);
        } catch (error) {
            console.error('Error loading vans:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
            {/* Fleet Operations Action Bar */}
            <div className="bg-white p-5 border border-redwood-border rounded-sm shadow-sm flex flex-wrap gap-6 justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-redwood-brand/5 border border-redwood-brand/20 rounded-sm flex items-center justify-center text-redwood-brand shadow-inner">
                        <Truck size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-redwood-text-main tracking-tighter uppercase">Logistics & Fleet Operations Matrix</h1>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em]">Real-Time Distribution Intelligence</span>
                            <span className="w-1 h-1 bg-redwood-border rounded-full"></span>
                            <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Tracking: Global Clusters</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all shadow-sm flex items-center gap-2 uppercase tracking-widest">
                        <Filter size={14} /> OPS FILTERS
                    </button>
                    <button className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all shadow-sm flex items-center gap-2 uppercase tracking-widest">
                        <Download size={14} /> FLEET EXPORT
                    </button>
                    <button className="px-6 py-2.5 bg-redwood-brand border border-transparent rounded-sm text-white text-[11px] font-black hover:brightness-95 transition-all flex items-center gap-2 shadow-lg uppercase tracking-widest">
                        <Plus size={16} /> ASSET REGISTRATION
                    </button>
                </div>
            </div>

            {/* Logistics KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm group hover:border-redwood-brand transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Fleet Availability</div>
                        <div className="p-2 bg-redwood-bg-light rounded-sm text-redwood-brand group-hover:bg-redwood-brand group-hover:text-white transition-all">
                            <Truck size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-redwood-text-main tracking-tight">92.4%</div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-sm uppercase tracking-widest">+2.4% vs L-Period</div>
                </div>

                <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm group hover:border-redwood-brand transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Material Throughput</div>
                        <div className="p-2 bg-redwood-bg-light rounded-sm text-redwood-text-muted group-hover:bg-redwood-brand group-hover:text-white transition-all">
                            <Package size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-redwood-text-main tracking-tight">1.2M</div>
                    <div className="mt-4 text-[10px] font-black text-redwood-brand uppercase tracking-widest italic opacity-80 underline decoration-dotted">Live Distribution Value</div>
                </div>

                <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm group hover:border-emerald-500 transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Operational Safety</div>
                        <div className="p-2 bg-emerald-50 rounded-sm text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                            <ShieldCheck size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 tracking-tight">100.0%</div>
                    <div className="mt-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest italic">Zero Accidents Logged</div>
                </div>

                <div className="bg-redwood-midnight p-6 border border-white/5 rounded-sm shadow-2xl group overflow-hidden">
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-redwood-secondary text-[11px] font-black uppercase tracking-[0.2em]">Exceptions Found</div>
                            <div className="p-2 bg-redwood-brand/20 rounded-sm text-redwood-brand">
                                <AlertCircle size={16} />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-white tracking-tight">03 Critical</div>
                        <div className="mt-4 text-[10px] font-black text-redwood-brand uppercase tracking-widest animate-pulse">Awaiting Remediation</div>
                    </div>
                    <Map size={120} className="absolute -right-8 -bottom-8 text-white/5 group-hover:scale-110 transition-transform duration-1000" strokeWidth={1} />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Fleet monitoring hub */}
                <div className="bg-white rounded-sm border border-redwood-border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    <div className="px-6 py-5 border-b border-redwood-bg-light bg-redwood-bg-light/30 flex justify-between items-center">
                        <h3 className="text-[12px] font-black text-redwood-text-main uppercase tracking-[0.2em] flex items-center gap-3">
                            <Truck size={18} className="text-redwood-brand" />
                            Fleet Monitoring Hub
                        </h3>
                        <div className="flex items-center gap-2">
                            <div className="relative group">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-redwood-text-muted" />
                                <input type="text" placeholder="Search Asset..." className="pl-9 pr-3 py-1.5 bg-white border border-redwood-border rounded-sm text-[11px] font-bold focus:border-redwood-brand outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 divide-y divide-redwood-bg-light/50">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full p-20">
                                <RefreshCw className="w-10 h-10 text-redwood-brand animate-spin mb-4" />
                                <p className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.3em]">Synchronizing Fleet Protocols...</p>
                            </div>
                        ) : (
                            vans.map((van) => (
                                <div key={van.id} className="p-6 flex items-center justify-between hover:bg-redwood-bg-light/20 transition-all group cursor-pointer border-l-4 border-transparent hover:border-l-redwood-brand">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-sm bg-redwood-bg-light border border-redwood-border flex flex-col items-center justify-center text-redwood-text-muted text-[10px] font-black transition-all group-hover:bg-white group-hover:text-redwood-brand shadow-inner">
                                            <div className="text-[8px] opacity-60">ID</div>
                                            {van.van_number.slice(-4)}
                                        </div>
                                        <div>
                                            <div className="text-[15px] font-black text-redwood-text-main uppercase tracking-tighter leading-none mb-1.5 group-hover:text-redwood-brand transition-colors">{van.van_number}</div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-[10px] text-redwood-text-muted font-black uppercase tracking-widest">{van.driver_name}</div>
                                                <span className="w-1 h-1 bg-redwood-border rounded-full"></span>
                                                <div className="text-[10px] text-redwood-text-muted/60 font-mono italic">{van.vehicle_number || 'REG-PENDING'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-10">
                                        <div className="hidden sm:block text-right">
                                            <div className="text-[9px] font-black text-redwood-text-muted/60 uppercase mb-0.5 tracking-[0.2em]">Asset Capacity</div>
                                            <div className="text-[13px] font-black text-redwood-text-main font-mono tracking-tighter">{van.capacity_liters?.toLocaleString() || 0} LTRS</div>
                                        </div>
                                        <div className={`text-[10px] font-black px-3 py-1 rounded-sm tracking-[0.2em] uppercase border ${van.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm'
                                            : 'bg-redwood-bg-light text-redwood-text-muted border-redwood-border'
                                            }`}>
                                            {van.status}
                                        </div>
                                        <button className="p-2 text-redwood-border hover:text-redwood-brand transition-all">
                                            <MoreVertical size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                        {!loading && vans.length === 0 && (
                            <div className="p-20 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-redwood-bg-light border border-redwood-border rounded-sm flex items-center justify-center text-redwood-border mb-6 shadow-inner">
                                    <Truck size={32} />
                                </div>
                                <h4 className="text-[12px] font-black text-redwood-text-main uppercase tracking-[0.3em] mb-3">Material Master Record Missing</h4>
                                <p className="text-[11px] text-redwood-text-muted font-bold max-w-[280px] leading-relaxed italic uppercase tracking-widest">No terminal assets have been reconciled with the central deployment ledger.</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-redwood-bg-light/30 border-t border-redwood-border text-center">
                        <button className="text-[11px] font-black text-redwood-brand hover:underline uppercase tracking-[0.3em] flex items-center gap-2 mx-auto decoration-2 underline-offset-4">
                            <Plus size={14} /> REGISTER GLOBAL DEPLOYMENT ASSET
                        </button>
                    </div>
                </div>

                {/* Material distribution ledger */}
                <div className="bg-white rounded-sm border border-redwood-border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    <div className="px-6 py-5 border-b border-redwood-bg-light bg-redwood-bg-light/30 flex justify-between items-center">
                        <h3 className="text-[12px] font-black text-redwood-text-main uppercase tracking-[0.2em] flex items-center gap-3">
                            <Package size={18} className="text-redwood-brand" />
                            Material Distribution Ledger
                        </h3>
                        <button className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em] border border-redwood-brand/20 px-4 py-1.5 rounded-sm hover:bg-redwood-brand hover:text-white transition-all shadow-sm">
                            HISTORICAL BATCH LOG
                        </button>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
                        <div className="relative mb-10">
                            <div className="w-20 h-20 bg-redwood-bg-light border border-redwood-border rounded-sm flex items-center justify-center text-redwood-border shadow-inner">
                                <Clock size={40} />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border border-redwood-border rounded-sm flex items-center justify-center text-redwood-brand shadow-lg">
                                <ExternalLink size={16} />
                            </div>
                        </div>
                        <h4 className="text-[16px] font-black text-redwood-text-main tracking-tighter mb-3 uppercase">Operational Queue Status: Latent</h4>
                        <p className="text-redwood-text-muted font-black uppercase tracking-[0.2em] text-[11px] mb-10 italic">No material dispatches are currently scheduled in the distribution pipeline.</p>
                        <button className="px-10 py-3 bg-redwood-slate text-white rounded-sm text-[11px] font-black hover:bg-black transition-all shadow-2xl flex items-center gap-3 uppercase tracking-widest">
                            <Plus size={18} className="text-redwood-brand" /> INITIATE DISPATCH MATRIX
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VanSalesDashboard;

