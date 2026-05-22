import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Bell,
  Globe,
  FileText,
  Package,
  Receipt,
  AlertCircle,
  Wallet,
  LayoutDashboard,
  Smartphone,
  Shield,
  TrendingUp,
  AlertTriangle,
  X,
  Calendar,
  UserX,
  Plus,
} from 'lucide-react';
import { AppRoutes } from './routes';
import Sidebar from '../components/layout/Sidebar';
import AIAssistant from '../components/AIAssistant';
import VoiceAssistant from '../components/VoiceAssistant/VoiceAssistant';
import CommandBar from '../components/VoiceAssistant/CommandBar';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getInvoices, getCustomers, getProducts, getPayments } from '../services/api';
import { getPurchaseOrders } from '../services/purchasesService';

// Available roles for the cycling role pill in the top nav.  Cosmetic
// only — does not affect permissions, just the displayed label.
const ROLES = ['System Admin', 'Accountant', 'Sales Manager', 'Warehouse', 'Junior'] as const;

// Route to navigate to when cycling INTO each role.  Pure UX affordance —
// the role label is the user-facing "context" they're switching to; the
// route opens the most-relevant page for that context.  No auth /
// permissions logic — the route is the only side effect.
const ROLE_ROUTES: Record<typeof ROLES[number], string> = {
  'System Admin':  '/',
  'Accountant':    '/finance/accounting',
  'Sales Manager': '/sales/dashboard',
  'Warehouse':     '/products',
  'Junior':        '/',
};

function App() {
  const location = useLocation();
  const [aiCtx, setAiCtx] = useState<any>({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [] });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const notifsRef = useRef<HTMLDivElement>(null);

  // Role pill — cycles through ROLES on click.  In-memory state only.
  const [roleIndex, setRoleIndex] = useState(0);
  const cycleRole = () => {
    const next = (roleIndex + 1) % ROLES.length;
    setRoleIndex(next);
    navigate(ROLE_ROUTES[ROLES[next]]);
  };

  // Alert bar — dismissible per-session.
  const [showAlertBar, setShowAlertBar] = useState(() => {
    try { return sessionStorage.getItem('soltol_alert_dismissed') !== '1'; } catch { return true; }
  });
  const alertCounts = useMemo(() => {
    const invs = (aiCtx.invoices as any[]) || [];
    const prods = (aiCtx.products as any[]) || [];
    const unpaidList = invs.filter((i) => {
      const s = String(i.status || '').toLowerCase();
      return s === 'unpaid' || s === 'pending' || s === 'partial' || s === 'overdue';
    });
    const unpaid = unpaidList.length;
    const unpaidTotal = unpaidList.reduce(
      (sum, i) => sum + (Number(i.remaining_balance ?? i.grandTotal) || 0), 0
    );
    const overdue = invs.filter((i) => String(i.status || '').toLowerCase() === 'overdue').length;
    const lowStock = prods.filter((p) => Number(p.current_stock || 0) < 10).length;
    return { unpaid, unpaidTotal, overdue, lowStock };
  }, [aiCtx]);

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

  // Soltol theme preview — bypass the Redwood shell so the preview
  // takes over the full viewport (mirrors the public-invoice branch).
  if (location.pathname.startsWith('/preview-soltol-theme')) {
    return <AppRoutes />;
  }

  const paths = location.pathname.split('/').filter(p => p);
  const breadcrumb = paths.length > 0
    ? paths.map(p => p.charAt(0).toUpperCase() + p.slice(1).replace('-', ' '))
    : ['Dashboard Overview'];

  return (
    <div className="flex h-screen bg-redwood-bg-light overflow-hidden text-redwood-text-main font-inter">
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
        <header className="h-[64px] bg-redwood-midnight border-b border-redwood-border px-3 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm print:hidden">
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
            <button
              type="button"
              onClick={cycleRole}
              title="Click to switch role"
              className="hidden sm:inline-flex items-center gap-1 bg-[rgba(79,142,247,0.14)] text-[#93C5FD] border border-[rgba(79,142,247,0.28)] rounded-full px-3 py-1 text-[11px] font-medium hover:bg-[rgba(79,142,247,0.22)] transition-colors whitespace-nowrap"
            >
              {ROLES[roleIndex]}
              <ChevronDown size={12} />
            </button>
          </div>

          {/* Header-center command bar — search + voice.  Hidden on
              phones (the header is too narrow to host the pill plus
              the right-cluster icons). */}
          <div className="hidden md:flex flex-1 max-w-[520px] mx-4 justify-center">
            <CommandBar />
          </div>

          {/* + New Invoice — blue header CTA matching preview.  Hidden
              on phones (narrow header).  Navigates only — no business
              logic, the invoice form on the other side owns that. */}
          <button
            type="button"
            onClick={() => navigate('/sales/invoices/new')}
            title="Create a new invoice"
            className="hidden md:inline-flex items-center gap-1.5 bg-[#4F8EF7] text-white hover:brightness-110 transition-all rounded-md px-3 h-9 text-[12px] font-semibold whitespace-nowrap shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            New Invoice
          </button>

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
                  <div className="absolute right-0 top-full mt-2 w-72 bg-redwood-bg-surface border border-redwood-border rounded-sm shadow-lg z-40 overflow-hidden">
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

        {/* Chips bar — RECENT AI prompts.  Click fills CommandBar input
            via the `soltol:fill-cmd` window event (CommandBar listens).
            No navigation — the prompt is queued in the search bar and
            the user reviews / hits Enter to submit. */}
        <div className="bg-redwood-midnight border-b border-redwood-border px-3 sm:px-8 py-1.5 flex items-center gap-1.5 overflow-x-auto print:hidden">
          <span className="text-[9px] text-redwood-text-muted whitespace-nowrap uppercase tracking-[0.06em] flex-shrink-0">RECENT:</span>
          {[
            { label: 'Ali Bettano 0W16',    text: 'Ali bought Bettano 0W16 SP 12x1 — 3 cases $56',          icon: FileText,    bg: 'rgba(79,142,247,0.14)',  color: '#93C5FD', border: 'rgba(79,142,247,0.22)' },
            { label: 'Leo Tire paid $239',  text: 'Leo Tire Shop paid $239 today',                          icon: Wallet,      bg: 'rgba(34,197,94,0.12)',   color: '#86EFAC', border: 'rgba(34,197,94,0.22)' },
            { label: 'Mobil 5W30 stock',    text: 'Check stock and reorder plan for Mobil 5W30',            icon: Package,     bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D', border: 'rgba(245,158,11,0.22)' },
            { label: 'Qahir demand letter', text: 'Qahir Enterprises 32 days overdue — draft demand letter', icon: AlertCircle, bg: 'rgba(239,68,68,0.12)',   color: '#FCA5A5', border: 'rgba(239,68,68,0.22)' },
            { label: 'VAT return Q1',       text: 'Generate VAT return report for this quarter',            icon: Receipt,     bg: 'rgba(167,139,250,0.12)', color: '#C4B5FD', border: 'rgba(167,139,250,0.22)' },
            { label: 'Today audit log',     text: 'Show full audit log for today — all user actions',       icon: Shield,      bg: 'rgba(0,212,170,0.10)',   color: '#5EEAD4', border: 'rgba(0,212,170,0.22)' },
            { label: 'Churn risk',          text: 'Which customers are at risk of churning this month?',    icon: UserX,       bg: 'rgba(34,197,94,0.12)',   color: '#86EFAC', border: 'rgba(34,197,94,0.22)' },
            { label: 'Payment run Fri',     text: 'AP $18k due in 7 days — schedule payment run',           icon: Calendar,    bg: 'rgba(255,255,255,0.05)', color: '#8BA3C7', border: 'rgba(255,255,255,0.12)' },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('soltol:fill-cmd', { detail: { text: c.text } })); } catch { /* ignore */ }
                }}
                title={c.text}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all hover:-translate-y-[1px] hover:brightness-110 flex-shrink-0 border"
                style={{ background: c.bg, color: c.color, borderColor: c.border }}
              >
                <Icon size={12} />
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Alert bar — shows only when there's something to alert about */}
        {showAlertBar && (alertCounts.unpaid > 0 || alertCounts.overdue > 0 || alertCounts.lowStock > 0) && (
          <div className="bg-[rgba(245,158,11,0.07)] border-b border-[rgba(245,158,11,0.16)] px-4 sm:px-8 py-2 flex items-center gap-2 text-[11px] text-[#FDE68A] print:hidden">
            <AlertTriangle size={14} className="text-[#F59E0B] flex-shrink-0" />
            <span className="flex-1 min-w-0">
              {alertCounts.unpaid > 0 && (
                <>
                  <strong>{alertCounts.unpaid} unpaid invoice{alertCounts.unpaid === 1 ? '' : 's'}</strong>
                  {alertCounts.unpaidTotal > 0 && ` totalling $${alertCounts.unpaidTotal.toLocaleString()}`}
                </>
              )}
              {alertCounts.unpaid > 0 && (alertCounts.overdue > 0 || alertCounts.lowStock > 0) && ' · '}
              {alertCounts.overdue > 0 && <>{alertCounts.overdue} overdue</>}
              {alertCounts.overdue > 0 && alertCounts.lowStock > 0 && ' · '}
              {alertCounts.lowStock > 0 && <>{alertCounts.lowStock} item{alertCounts.lowStock === 1 ? '' : 's'} low stock</>}
            </span>
            {alertCounts.unpaid > 0 && (
              <button onClick={() => navigate('/sales/invoices')} className="text-[#F59E0B] font-semibold underline hover:no-underline flex-shrink-0">Invoices →</button>
            )}
            {alertCounts.lowStock > 0 && (
              <button onClick={() => navigate('/products')} className="text-[#F59E0B] font-semibold underline hover:no-underline flex-shrink-0">Stock →</button>
            )}
            {alertCounts.overdue > 0 && (
              <button onClick={() => navigate('/reports/aged-receivable')} className="text-[#F59E0B] font-semibold underline hover:no-underline flex-shrink-0">Aged AR →</button>
            )}
            <button
              onClick={() => {
                try { sessionStorage.setItem('soltol_alert_dismissed', '1'); } catch { /* ignore */ }
                setShowAlertBar(false);
              }}
              className="ml-2 w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[#F59E0B] hover:bg-white/10 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Tab row — broad navigation categories with route mapping */}
        <div className="bg-redwood-midnight border-b border-redwood-border px-3 sm:px-8 flex items-center overflow-x-auto print:hidden">
          {[
            { key: 'overview',  label: 'Overview',       route: '/',                   icon: LayoutDashboard, prefix: ['/'],                                       badge: null,  badgeColor: null },
            { key: 'finance',   label: 'Finance & Tax',  route: '/finance/accounting', icon: Receipt,         prefix: ['/finance', '/tax'],                        badge: '30%', badgeColor: 'red' },
            { key: 'warehouse', label: 'Warehouse',      route: '/products',           icon: Package,         prefix: ['/products', '/inventory'],                 badge: '25%', badgeColor: 'red' },
            { key: 'mobile',    label: 'Field & Mobile', route: '/logistics/pod',      icon: Smartphone,      prefix: ['/logistics', '/pod', '/van-sales'],        badge: '20%', badgeColor: 'amber' },
            { key: 'security',  label: 'Security',       route: '/access-management',  icon: Shield,          prefix: ['/access-management', '/users'],            badge: '40%', badgeColor: 'amber' },
            { key: 'sales',     label: 'Sales & CRM',    route: '/sales/dashboard',    icon: TrendingUp,      prefix: ['/sales', '/customers', '/crm'],            badge: null,  badgeColor: null },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = t.key === 'overview'
              ? location.pathname === '/'
              : t.prefix.some((p) => location.pathname.startsWith(p));
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => navigate(t.route)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'text-redwood-text-main border-[#4F8EF7]'
                    : 'text-redwood-text-muted border-transparent hover:text-redwood-text-main'
                }`}
              >
                <Icon size={14} />
                {t.label}
                {t.badge && (
                  <span
                    className="text-[8px] font-semibold px-1.5 py-[1px] rounded-full ml-0.5"
                    style={
                      t.badgeColor === 'red'
                        ? { background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }
                        : { background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }
                    }
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scalable Viewport Canvas */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-10 scroll-smooth bg-redwood-bg-light">
          <div className="max-w-[1600px] mx-auto min-h-full">
            <AppRoutes />
          </div>
        </div>

        {/* AI Accountant - Available on all pages */}
        <AIAssistant context={aiCtx} />
        <VoiceAssistant />

        {/* Global Identity Footer */}
        <footer className="h-10 bg-redwood-midnight border-t border-redwood-border px-3 sm:px-8 flex items-center justify-between text-[10px] font-bold text-redwood-text-muted uppercase tracking-[0.2em] shadow-[0_-1px_3px_rgba(0,0,0,0.02)] print:hidden">
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
