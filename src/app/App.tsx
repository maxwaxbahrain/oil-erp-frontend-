import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronRight,
  HelpCircle,
  Bell,
  Globe
} from 'lucide-react';
import { AppRoutes } from './routes';
import Sidebar from '../components/layout/Sidebar';
import AIAssistant from '../components/AIAssistant';
import { useState, useEffect } from 'react';
import { getInvoices, getCustomers, getProducts, getPayments } from '../services/api';
import { getPurchaseOrders } from '../services/purchasesService';

function App() {
  const location = useLocation();
  const [aiCtx, setAiCtx] = useState<any>({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [] });

  useEffect(() => {
    Promise.all([
      getInvoices().catch(() => []),
      getCustomers().catch(() => []),
      getProducts().catch(() => []),
      getPayments().catch(() => []),
      getPurchaseOrders().catch(() => [])
    ]).then(([inv, cust, prod, pays, pos]) => {
      setAiCtx({ invoices: inv, customers: cust, products: prod, payments: pays, purchaseOrders: pos });
    });
  }, []);

  // Global keyboard shortcut: Escape key = go back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.history.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = useNavigate();

  if (location.pathname.startsWith('/invoice/')) {
    return (
      <div className="min-h-screen bg-[#f0f2f4] text-gray-900 font-inter antialiased">
        <AppRoutes />
      </div>
    );
  }

  const paths = location.pathname.split('/').filter(p => p);
  const breadcrumb = paths.length > 0
    ? paths.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' '))
    : ['Dashboard Overview'];

  return (
    <div className="flex h-screen bg-[#F0F2F5] overflow-hidden text-redwood-text-main font-inter">
      {/* Sidebar - Precision Redwood SideNav */}
      <Sidebar />

      {/* Main Orchestration Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] bg-white border-b border-redwood-border px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm print:hidden">
          <div className="flex items-center gap-6">
            <button className="p-2 text-redwood-text-muted hover:bg-redwood-bg-light rounded-sm transition-all border border-transparent hover:border-redwood-border">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3 py-1 px-3 bg-redwood-bg-light rounded-sm border border-redwood-border/50">
              <span className="text-[11px] font-black text-redwood-secondary tracking-widest uppercase">Global</span>
              <ChevronRight size={14} className="text-redwood-border" />
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-redwood-primary" />
                <span className="text-[11px] font-bold text-redwood-text-main">{breadcrumb.join(' / ')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* BUG #1 FIX: Removed Query ERP Records search bar */}

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert('Notifications: No new alerts')}
                className="p-2.5 text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-brand rounded-sm transition-all relative group"
              >
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-redwood-brand rounded-full border-2 border-white ring-2 ring-redwood-brand/20"></span>
              </button>
              <button className="p-2.5 text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-primary rounded-sm transition-all">
                <HelpCircle size={20} />
              </button>

              <div className="h-8 w-[1px] bg-redwood-border mx-3"></div>

              <div
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 pl-2 cursor-pointer group"
              >
                <div className="text-right flex flex-col justify-center">
                  <span className="text-[13px] font-black text-redwood-text-main leading-none mb-1">System Admin</span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] text-redwood-secondary font-black uppercase tracking-widest">Master Control</span>
                  </div>
                </div>
                <div
                  onClick={() => navigate('/portal')}
                  className="relative cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-sm bg-redwood-slate flex items-center justify-center text-white text-xs font-black shadow-md group-hover:bg-redwood-brand transition-all overflow-hidden border-2 border-white">
                    AQ
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white shadow-sm"></div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scalable Viewport Canvas */}
        <div className="flex-1 overflow-y-auto p-10 scroll-smooth bg-[#F8F9FA]">
          <div className="max-w-[1600px] mx-auto min-h-full">
            <AppRoutes />
          </div>
        </div>

        {/* AI Accountant - Available on all pages */}
        <AIAssistant context={aiCtx} />

        {/* Global Identity Footer */}
        <footer className="h-10 bg-white border-t border-redwood-border px-8 flex items-center justify-between text-[10px] font-bold text-redwood-text-muted uppercase tracking-[0.2em] shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            <span className="text-redwood-brand whitespace-nowrap shrink-0">SOLTOL ONE · Business Platform</span>
            <div className="h-3 w-[1px] bg-redwood-border shrink-0" />
            <span className="whitespace-nowrap shrink-0">Platform: v1.0.0</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              Powered by AI
            </span>
            <span className="text-redwood-text-main">© 2025 SOLTOL ONE</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
