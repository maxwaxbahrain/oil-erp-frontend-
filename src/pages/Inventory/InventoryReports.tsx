import {
    BarChart3,
    Download,
    Filter,
    Calendar,
    ArrowRight,
    TrendingUp,
    PieChart,
    Activity,
    DollarSign,
    Package,
    ArrowUpRight,
    Search,
    ChevronDown
} from 'lucide-react';
import clsx from 'clsx';

export default function InventoryReports() {

    const reports = [
        { title: 'Inventory Valuation', description: 'Financial audit of all material assets globally.', icon: DollarSign, color: 'text-emerald-500' },
        { title: 'Stock Movement', description: 'Real-time velocity and node transfer analysis.', icon: Activity, color: 'text-blue-500' },
        { title: 'Dead Stock Audit', description: 'Identifying capital locked in non-moving SKUs.', icon: Package, color: 'text-red-500' },
        { title: 'Supplier Accuracy', description: 'Lead time and quality performance audit.', icon: TrendingUp, color: 'text-amber-500' },
        { title: 'Loss & Leakage', description: 'Tracking field sales discrepancies and damages.', icon: BarChart3, color: 'text-redwood-brand' },
        { title: 'Forecasting Run', description: '30/60/90 day demand predicted by AI.', icon: PieChart, color: 'text-pink-500' },
    ];

    return (
        <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter uppercase flex items-center gap-3">
                        <BarChart3 className="text-redwood-brand" size={32} />
                        Inventory Intelligence Hub
                    </h1>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Enterprise Material Audit & Reporting</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-3 bg-gray-50 border border-gray-100 text-gray-600 text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 hover:bg-gray-100 transition-all">
                        <Calendar size={18} /> Jan 2024 <ChevronDown size={14} />
                    </button>
                    <button className="px-8 py-4 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-gray-200">
                        <Download size={20} /> Generate Global Audit
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm group">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Total Asset Valuation</span>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">$12.45M</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase flex items-center gap-1">
                        <ArrowUpRight size={12} /> +1.2% Growth
                    </p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Avg Turnover</span>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">8.2x</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">Global Weighted Average</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Stock Accuracy</span>
                    <p className="text-3xl font-black text-gray-900 tracking-tighter">99.4%</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-widest">Post-Audit Resilience</p>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-redwood-brand">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-4">Locked Capital</span>
                    <p className="text-3xl font-black text-redwood-brand tracking-tighter">$856k</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">In Slow/Dead Stocks</p>
                </div>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {reports.map((report, i) => (
                    <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:border-redwood-brand/20 transition-all group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 translate-x-8 -translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-700">
                            <report.icon size={120} />
                        </div>

                        <div className="flex items-center gap-5 mb-8 relative">
                            <div className={clsx("w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 group-hover:bg-redwood-brand group-hover:text-white transition-all duration-500 shadow-inner", report.color)}>
                                <report.icon size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">{report.title}</h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Automated Intelligence</p>
                            </div>
                        </div>

                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.05em] leading-relaxed mb-10 relative">
                            {report.description}
                        </p>

                        <div className="flex items-center justify-between pt-6 border-t border-gray-50 relative">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Last Run: 2h ago</span>
                            <button className="flex items-center gap-2 text-[10px] font-black text-redwood-brand uppercase tracking-widest hover:translate-x-1 transition-transform">
                                Run Report <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Custom Query Builder (Oracle Style) */}
            <div className="bg-gray-900 p-12 rounded-3xl shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 transform translate-x-12 -translate-y-12 opacity-5">
                    <Filter size={280} className="text-redwood-brand" />
                </div>
                <div className="relative">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                        <Search size={28} className="text-redwood-brand shadow-2xl shadow-redwood-brand/20" />
                        Universal Material Query Engine
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Global Filter String</label>
                            <input type="text" placeholder="e.g. status='active' AND velocity='fast' AND margin > 30%" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-sm outline-none focus:border-redwood-brand transition-all" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2 px-1">Sort Metric</label>
                            <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white font-black uppercase text-[10px] tracking-widest outline-none appearance-none">
                                <option>Revenue Contribution</option>
                                <option>Stock Age</option>
                                <option>Margin Efficiency</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button className="w-full py-4 bg-redwood-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg shadow-redwood-brand/20 transition-all">Execute Query</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
