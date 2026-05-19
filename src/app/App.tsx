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
import { useState, useEffect, useRef } from 'react';
import { getInvoices, getCustomers, getProducts, getPayments } from '../services/api';
import { getPurchaseOrders } from '../services/purchasesService';

function App() {
  const location = useLocation();
  const [aiCtx, setAiCtx] = useState<any>({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const notifsRef = useRef<HTMLDivElement>(null);

  // TC-03 — Build a short list of "notifications" from live ERP data
  // so the dropdown shows something concrete instead of the canned
  // alert() that the tester didn't recognize as a popup.
  const notifs = (() => {
    const items: { label: string; severity: 'info' | 'warn' }[] = [];
    const overdue = (aiCtx.invoices as any[]).filter(i => String(i.status || '').toLowerCase() === 'overdue').length;
    if (overdue) items.push({ label: `${overdue} overdue invoice${overdue === 1 ? '' : 's'}`, severity: 'warn' });
    const lowStock = (aiCtx.products as any[]).filter(p => Number(p.current_stock || 0) < 10).length;
    if (lowStock) items.push({ label: `${lowStock} product${lowStock === 1 ? '' : 's'} low on stock`, severity: 'warn' });
    return items;
  })();

  // Close the notification dropdown when clicking outside it.
  useEffect(() => {
    if (!notifsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setNotifsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifsOpen]);

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

  // TC-06 — Auto-collapse the sidebar on narrow viewports (mobile /
  // portrait) so the 260px Sidebar.tsx doesn't eat half the screen.
  // The Menu button (TC-02) remains the manual toggle either way.
  // Re-evaluated on every resize so flipping a tablet to landscape
  // restores the sidebar without a refresh.
  useEffect(() => {
    const apply = () => setSidebarCollapsed(window.innerWidth < 768);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
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
      {/* Sidebar - Precision Redwood SideNav.  The Menu button in the
          header below toggles `sidebarCollapsed`.  On mobile (< md)
          the sidebar becomes a drawer: fixed-positioned overlay with
          a tap-to-dismiss backdrop.  On desktop (>= md) it returns to
          a static flex child.  Sidebar.tsx stays prop-free. */}
      {!sidebarCollapsed && (
        <>
          {/* Mobile-only backdrop — tap to close the drawer. */}
          <div
            onClick={() => setSidebarCollapsed(true)}
            className="md:hidden fixed inset-0 bg-black/40 z-30"
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-40 md:static md:z-auto flex">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main Orchestration Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-[64px] bg-white border-b border-redwood-border px-3 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm print:hidden">
          <div className="flex items-center gap-2 sm:gap-6">
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              aria-label="Toggle sidebar"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              className="p-2 text-redwood-text-muted hover:bg-redwood-bg-light rounded-sm transition-all border border-transparent hover:border-redwood-border"
            >
              <Menu size={20} />
            </button>
            {/* Breadcrumb pill hidden on phones — header would overflow. */}
            <div className="hidden md:flex items-center gap-3 py-1 px-3 bg-redwood-bg-light rounded-sm border border-redwood-border/50">
              <span className="text-[11px] font-black text-redwood-secondary tracking-widest uppercase">Global</span>
              <ChevronRight size={14} className="text-redwood-border" />
              <div className="flex items-center gap-2">
                <Globe size={12} className="text-redwood-primary" />
                <span className="text-[11px] font-bold text-redwood-text-main">{breadcrumb.join(' / ')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6">
            {/* BUG #1 FIX: Removed Query ERP Records search bar */}

            <div className="flex items-center gap-2">
              <div className="relative" ref={notifsRef}>
                <button
                  onClick={() => setNotifsOpen(v => !v)}
                  aria-label="Notifications"
                  aria-expanded={notifsOpen}
                  className="p-2.5 text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-brand rounded-sm transition-all relative group"
                >
                  <Bell size={20} />
                  {notifs.length > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-redwood-brand rounded-full border-2 border-white ring-2 ring-redwood-brand/20"></span>
                  )}
                </button>
                {notifsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-redwood-border rounded-sm shadow-lg z-40 overflow-hidden">
                    <div className="px-4 py-2 border-b border-redwood-border bg-redwood-bg-light text-[11px] font-black text-redwood-text-muted uppercase tracking-widest">
                      Notifications
                    </div>
                    {notifs.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[12px] text-redwood-text-muted">
                        No new notifications
                      </div>
                    ) : (
                      <ul className="divide-y divide-redwood-border/30">
                        {notifs.map((n, i) => (
                          <li key={i} className="px-4 py-3 flex items-start gap-2 text-[12px]">
                            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.severity === 'warn' ? 'bg-amber-500' : 'bg-redwood-brand'}`}></span>
                            <span className="text-redwood-text-main">{n.label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => alert(
                  'SOLTOL ONE · Business Platform v1.0.0\n\n' +
                  'Keyboard shortcuts:\n' +
                  '  Esc  — Go back to the previous screen\n\n' +
                  'For support, contact your administrator.'
                )}
                aria-label="Help"
                title="Help & shortcuts"
                className="p-2.5 text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-primary rounded-sm transition-all"
              >
                <HelpCircle size={20} />
              </button>

              <div className="hidden sm:block h-8 w-[1px] bg-redwood-border mx-3"></div>

              <div
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 pl-2 cursor-pointer group"
              >
                {/* Name + status block hidden on phones; avatar stays visible. */}
                <div className="hidden sm:flex text-right flex-col justify-center">
                  <span className="text-[13px] font-black text-redwood-text-main leading-none mb-1">System Admin</span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[9px] text-redwood-secondary font-black uppercase tracking-widest">Master Control</span>
                  </div>
                </div>
                <div
                  // TC-07 — Stop the click from bubbling up to the outer
                  // wrapper (which navigates to /settings). Without this,
                  // clicking the AQ avatar fires BOTH handlers and the
                  // user lands on /settings instead of /portal — the
                  // exact symptom QA flagged ("AQ button does nothing").
                  onClick={(e) => { e.stopPropagation(); navigate('/portal'); }}
                  className="relative cursor-pointer"
                  role="button"
                  aria-label="Open employee portal"
                  tabIndex={0}
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-10 scroll-smooth bg-[#F8F9FA]">
          <div className="max-w-[1600px] mx-auto min-h-full">
            <AppRoutes />
          </div>
        </div>

        {/* AI Accountant - Available on all pages */}
        <AIAssistant context={aiCtx} />

        {/* Global Identity Footer */}
        <footer className="h-10 bg-white border-t border-redwood-border px-3 sm:px-8 flex items-center justify-between text-[10px] font-bold text-redwood-text-muted uppercase tracking-[0.2em] shadow-[0_-1px_3px_rgba(0,0,0,0.02)] print:hidden">
          <div className="flex items-center gap-4 flex-wrap min-w-0">
            <span className="text-redwood-brand whitespace-nowrap shrink-0">SOLTOL ONE</span>
            {/* Version + tagline hidden on phones to avoid footer overflow. */}
            <div className="hidden sm:block h-3 w-[1px] bg-redwood-border shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap shrink-0">Platform: v1.0.0</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <span className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              Powered by AI
            </span>
            <span className="text-redwood-text-main">© 2025</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
