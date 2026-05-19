import { FileText, BarChart3, PieChart, Calendar, Download, Filter, ChevronRight, Bookmark, Target, TrendingUp, AlertCircle, RefreshCw, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReportsDashboard() {
    const navigate = useNavigate();
    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
            {/* Analytics Control Matrix */}
            <div className="bg-white p-5 border border-redwood-border rounded-sm shadow-sm flex flex-wrap gap-6 justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-redwood-brand/5 border border-redwood-brand/20 rounded-sm flex items-center justify-center text-redwood-brand shadow-inner">
                        <BarChart3 size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-redwood-text-main tracking-tighter uppercase">Intelligent Enterprise Analytics</h1>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em]">Decision Support Matrix</span>
                            <span className="w-1 h-1 bg-redwood-border rounded-full"></span>
                            <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Data Sync: Live Protocols</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/reports/demand-forecast')}
                        className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all shadow-sm flex items-center gap-2 uppercase tracking-widest"
                    >
                        <Calendar size={14} /> Time Horizon: Period-24
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-6 py-2.5 bg-redwood-brand border border-transparent rounded-sm text-white text-[11px] font-black hover:brightness-95 transition-all flex items-center gap-2 shadow-lg uppercase tracking-widest"
                    >
                        <Download size={16} /> Global Report Export
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Dimension Navigator */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-sm border border-redwood-border shadow-sm overflow-hidden p-2">
                        <h3 className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em] p-4 pb-2">Business Dimensions</h3>
                        <div className="space-y-1">
                            {[
                                { title: 'Revenue Performance',    icon: BarChart3, path: '/reports/sales',             active: true  },
                                { title: 'Material Liquidity',     icon: PieChart,  path: '/reports/outstanding-bills', active: false },
                                { title: 'Strategic Ledger',       icon: FileText,  path: '/reports/trial-balance',     active: false },
                                { title: 'Customer Risk Profile',  icon: Target,    path: '/reports/aged-receivable',   active: false },
                                { title: 'Audit Governance',       icon: Filter,    path: '/reports/day-book',          active: false },
                            ].map((report, i) => (
                                <button
                                    key={i}
                                    onClick={() => navigate(report.path)}
                                    className={`w-full flex items-center gap-4 p-4 rounded-sm transition-all group text-left ${report.active ? 'bg-redwood-bg-light border-l-4 border-redwood-brand' : 'hover:bg-redwood-bg-light border-l-4 border-transparent'}`}
                                >
                                    <div className={`${report.active ? 'text-redwood-brand' : 'text-redwood-text-muted group-hover:text-redwood-brand'} transition-colors`}>
                                        <report.icon size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <div className={`text-[12px] font-black uppercase tracking-tight ${report.active ? 'text-redwood-text-main' : 'text-redwood-text-muted group-hover:text-redwood-text-main'}`}>{report.title}</div>
                                    </div>
                                    <ChevronRight size={14} className={`${report.active ? 'text-redwood-brand opacity-100' : 'text-redwood-border opacity-0 group-hover:opacity-100'} transition-all`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-redwood-midnight p-8 rounded-sm text-white shadow-2xl relative overflow-hidden group">
                        <Bookmark size={32} className="text-redwood-brand mb-6" />
                        <h4 className="font-black text-[12px] mb-2 uppercase tracking-[0.3em]">Operational Presets</h4>
                        <p className="text-[11px] text-redwood-secondary font-medium mb-6 leading-relaxed">No strategic visualization markers have been cached for this user profile.</p>
                        <button
                            onClick={() => navigate('/reports/sales')}
                            className="text-[10px] font-black text-redwood-brand hover:underline uppercase tracking-[0.2em] flex items-center gap-2"
                        >
                            <Plus size={14} /> Design Benchmark View
                        </button>
                        <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" strokeWidth={1} />
                    </div>
                </div>

                {/* Intelligence Visualization Layer */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="bg-white p-12 rounded-sm border border-redwood-border shadow-sm min-h-[500px] flex flex-col items-center justify-center text-center relative overflow-hidden group">
                        {/* Background Data Stream Effect */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,117,143,0.03)_0,transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="relative mb-10">
                                <div className="w-24 h-24 rounded-sm border border-redwood-border flex items-center justify-center bg-white shadow-2xl relative z-10">
                                    <RefreshCw size={40} className="text-redwood-brand animate-spin" style={{ animationDuration: '3s' }} />
                                </div>
                                <div className="absolute -inset-4 border border-redwood-brand/20 animate-ping rounded-sm" style={{ animationDuration: '4s' }}></div>
                            </div>
                            <h4 className="font-black text-redwood-text-main text-3xl tracking-tighter mb-4 uppercase">Compiling Dimensional Insights</h4>
                            <p className="text-redwood-text-muted text-[13px] max-w-[500px] leading-relaxed mx-auto font-medium">System is currently aggregating transaction clusters and material dispersion data to initialize the executive forecast matrix.</p>
                        </div>

                        <div className="mt-12 flex gap-6 relative z-10">
                            <div className="flex items-center gap-2 px-4 py-2 bg-redwood-bg-light border border-redwood-border rounded-sm text-[10px] font-black text-redwood-text-muted uppercase tracking-widest shadow-sm">
                                <span className="w-2 h-2 bg-redwood-brand rounded-full animate-pulse"></span>
                                Reconciling Batch SO-9824
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-redwood-bg-light border border-redwood-border rounded-sm text-[10px] font-black text-redwood-text-muted uppercase tracking-widest shadow-sm">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                Ledger Invariant Verified
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-gradient-to-br from-redwood-brand to-redwood-slate p-8 rounded-sm text-white shadow-2xl shadow-redwood-brand/20 group relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-8">
                                    <h4 className="text-[11px] font-black text-white/60 uppercase tracking-[0.3em]">Market Penetration Velocity</h4>
                                    <div className="bg-white/10 p-2 rounded-sm border border-white/20"><TrendingUp size={18} /></div>
                                </div>
                                <div className="flex items-end gap-2 mb-8">
                                    <div className="text-5xl font-black tracking-tighter">84.2%</div>
                                    <div className="text-[12px] font-black text-emerald-400 mb-2 uppercase tracking-widest px-2 py-0.5 bg-emerald-400/10 rounded-sm">+4.1% PHASE</div>
                                </div>
                                <div className="w-full h-2 bg-white/10 rounded-sm overflow-hidden shadow-inner">
                                    <div className="h-full bg-white transition-all duration-1000 group-hover:scale-x-105 origin-left shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ width: '84.2%' }}></div>
                                </div>
                                <p className="text-[10px] text-white/60 mt-6 font-black uppercase tracking-[0.3em] flex items-center gap-2">
                                    <Target size={12} className="text-white" /> Growth Benchmark Surplus Detected
                                </p>
                            </div>
                            <BarChart3 size={150} className="absolute -right-8 -bottom-8 text-white/5 group-hover:rotate-6 transition-transform duration-700" strokeWidth={1} />
                        </div>

                        <div className="bg-white p-8 rounded-sm border border-redwood-border shadow-sm flex flex-col justify-between group">
                            <div className="flex justify-between items-start">
                                <h4 className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.3em]">Material Dispersion Index</h4>
                                <button
                                    onClick={() => navigate('/reports/outstanding-bills')}
                                    className="p-2 bg-redwood-bg-light border border-redwood-border rounded-sm text-redwood-text-muted hover:text-redwood-brand transition-all"
                                    aria-label="Filter material dispersion"
                                ><Filter size={18} /></button>
                            </div>

                            <div className="flex justify-center my-8 relative">
                                {/* Custom Circular Gauge CSS Effect */}
                                <div className="w-40 h-40 rounded-full border-[12px] border-redwood-bg-light border-t-redwood-brand border-l-emerald-500 transition-transform duration-1000 group-hover:rotate-[360deg] shadow-lg"></div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                                    <div className="text-4xl font-black text-redwood-text-main tracking-tighter">7.2</div>
                                    <div className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em] mt-1">Sigma Score</div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-redwood-bg-light">
                                <div className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                                    <span className="text-[11px] font-black text-redwood-text-muted uppercase tracking-widest">Inventory Velocity</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[12px] font-black text-redwood-text-main tracking-tight">8.4 REQ/D</span>
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center group/item hover:translate-x-1 transition-transform">
                                    <span className="text-[11px] font-black text-redwood-text-muted uppercase tracking-widest">Capital Variance</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[12px] font-black text-rose-500 tracking-tight">1.2% DEV</span>
                                        <AlertCircle size={14} className="text-rose-500" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

