import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Target,
  FileText,
  BarChart3,
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Download,
  ChevronRight
} from 'lucide-react';
import SalesOrderList from '../../modules/sales/SalesOrderList';

export default function SalesDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in max-w-[1500px] mx-auto pb-10">
      {/* Revenue Control Hub */}
      <div className="bg-white p-4 border border-redwood-border rounded-sm shadow-sm flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-lg font-black text-redwood-text-main tracking-tight uppercase">Revenue Operations & Governance</h1>
          <p className="text-[10px] text-redwood-brand font-black tracking-[0.2em] uppercase mt-0.5">Global Order Intake Matrix</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all shadow-sm flex items-center gap-2 uppercase tracking-wide">
            <Download size={14} /> Revenue Report
          </button>
          <button
            onClick={() => navigate('/sales/orders/new')}
            className="px-5 py-2 bg-redwood-brand border border-transparent rounded-sm text-white text-[11px] font-black hover:brightness-95 transition-all flex items-center gap-2 shadow-lg uppercase tracking-widest"
          >
            <Plus size={16} /> New Sales Execution
          </button>
        </div>
      </div>

      {/* Sales Performance Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm flex flex-col justify-between group cursor-pointer hover:border-redwood-brand transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="text-redwood-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Gross Sales (Period)</div>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-redwood-text-main tracking-tight">4,820,500.00</div>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-sm uppercase tracking-widest shadow-inner">+12.4% vs L-Period</div>
        </div>

        <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm flex flex-col justify-between group cursor-pointer hover:border-redwood-primary transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="text-redwood-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Closed Conversion</div>
            <Target size={16} className="text-redwood-primary" />
          </div>
          <div className="text-2xl font-black text-redwood-text-main tracking-tight">84.2% Rate</div>
          <div className="mt-4 w-full h-1.5 bg-redwood-bg-light rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-redwood-primary shadow-sm" style={{ width: '84.2%' }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm flex flex-col justify-between group cursor-pointer hover:border-redwood-brand transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="text-redwood-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Pending Order Audit</div>
            <FileText size={16} className="text-orange-500" />
          </div>
          <div className="text-2xl font-black text-redwood-text-main tracking-tight">12 Documents</div>
          <div className="mt-4 text-[10px] font-black text-redwood-brand uppercase tracking-widest italic opacity-80">Awaiting Compliance</div>
        </div>

        <div className="bg-redwood-midnight p-6 rounded-sm border border-white/5 shadow-2xl flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="text-redwood-secondary text-[10px] font-black uppercase tracking-[0.2em]">Order Volume Grid</div>
            <BarChart3 size={16} className="text-redwood-brand" />
          </div>
          <div className="text-2xl font-black text-white tracking-tight">1,284 Units</div>
          <div className="mt-4 flex gap-1 h-3 items-end">
            {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
              <div key={i} className="flex-1 bg-redwood-brand/40 group-hover:bg-redwood-brand rounded-t-sm transition-colors" style={{ height: `${h}% ` }}></div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 bg-white border border-redwood-border rounded-sm shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          <div className="p-5 border-b border-redwood-bg-light bg-white flex flex-wrap gap-4 justify-between items-center">
            <div className="flex items-center gap-4 flex-1 min-w-[350px]">
              <div className="relative flex-1 group">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-redwood-text-muted group-focus-within:text-redwood-brand transition-colors" />
                <input
                  type="text"
                  placeholder="Global Audit: Search by Customer Entity, Order Reference, or GL Code..."
                  className="w-full pl-10 pr-4 py-2.5 bg-redwood-bg-light border border-redwood-border rounded-sm text-[12px] font-semibold focus:bg-white focus:border-redwood-brand focus:ring-4 focus:ring-redwood-brand/5 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-5 py-2.5 border border-redwood-border rounded-sm text-redwood-text-muted text-[11px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-redwood-bg-light transition-all shadow-sm">
                <Filter size={14} /> Hierarchy Filter
              </button>
            </div>
          </div>

          <div className="flex-1 bg-white p-6">
            <SalesOrderList />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white border border-redwood-border p-8 rounded-sm flex items-center gap-10 shadow-sm group">
          <div className="flex-1">
            <h3 className="text-lg font-black text-redwood-text-main tracking-tight mb-2 uppercase">Global Revenue Strategy Portal</h3>
            <p className="text-[13px] text-redwood-text-muted font-medium leading-relaxed mb-6">Manage multi-regional sales directives, target benchmarks, and strategic account distributions from the enterprise control matrix.</p>
            <button className="flex items-center gap-2 px-8 py-3 bg-redwood-slate text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-black transition-all shadow-lg">
              Access Directives Hub <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="w-40 h-40 bg-redwood-bg-light rounded-sm flex items-center justify-center text-redwood-border border border-redwood-border transition-colors group-hover:text-redwood-brand">
            <ShoppingCart size={64} strokeWidth={1} />
          </div>
        </div>

        <div className="bg-redwood-brand p-8 rounded-sm text-white shadow-2xl flex flex-col justify-center relative overflow-hidden group">
          <div className="relative z-10">
            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] mb-2 text-white/60">Intelligent Forecast</h4>
            <div className="text-3xl font-black tracking-tighter mb-4">+18.5% Growth</div>
            <p className="text-[12px] text-white/80 font-medium border-t border-white/20 pt-4 leading-relaxed">System-generated projection for the next fiscal period based on strategic sales pipelines.</p>
          </div>
          <TrendingUp size={120} className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 transition-transform duration-700" strokeWidth={1} />
        </div>
      </div>

      {/* Sales Order List */}
      <SalesOrderList />
    </div>
  );
}
