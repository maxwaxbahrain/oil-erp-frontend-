import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  ChevronDown,
  Bell,
  FileText,
  Package,
  Receipt,
  AlertCircle,
  Wallet,
  LayoutDashboard,
  Home,
  Smartphone,
  Shield,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  BarChart2,
  Box,
  Truck,
  Star,
  Megaphone,
  Mic,
  AlertTriangle,
  X,
  Calendar,
  UserX,
  User,
  Settings,
  Sparkles,
  Sun,
  Moon,
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
const ROLES = ['System Admin', 'Accountant', 'Sales Manager', 'Warehouse', 'Van Driver', 'AI Hub', 'Junior'] as const;

// Route to navigate to when cycling INTO each role.  Pure UX affordance —
// the role label is the user-facing "context" they're switching to; the
// route opens the most-relevant page for that context.  No auth /
// permissions logic — the route is the only side effect.
const ROLE_ROUTES: Record<typeof ROLES[number], string> = {
  'System Admin':  '/',
  'Accountant':    '/finance/dashboard',
  'Sales Manager': '/sales/dashboard',
  'Warehouse':     '/warehouse/dashboard',
  'Van Driver':    '/van/dashboard',
  'AI Hub':        '/ai/hub',
  'Junior':        '/',
};

function App() {
  const location = useLocation();
  const [aiCtx, setAiCtx] = useState<any>({ invoices: [], customers: [], products: [], payments: [], purchaseOrders: [] });
  // sidebarOpen drives the full drawer overlay. A separate 54px icon
  // rail (rendered below) is ALWAYS visible on lg+ and isn't affected
  // by this state. Default closed on all viewports.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  // Sidebar group expand/collapse state is lifted here so it survives
  // any future Sidebar remount (drawer animations, hot reload, etc.).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    home: true,
  });
  const toggleGroup = (key: string) =>
    setOpenGroups((p) => ({ ...p, [key]: !p[key] }));
  // Open (not toggle) — rail-icon clicks expand the matching group
  // when they open the drawer.
  const openGroup = (key: string) =>
    setOpenGroups((p) => ({ ...p, [key]: true }));
  const [notifsOpen, setNotifsOpen] = useState(false);
  // Light/dark mode toggle — flips `light` class on <body>, persists
  // to localStorage key `soltol-theme`. Cosmetic only — no business logic.
  const [isLight, setIsLight] = useState<boolean>(() => {
    try { return localStorage.getItem('soltol-theme') === 'light'; } catch { return false; }
  });
  // On mount, apply saved preference immediately (defense-in-depth
  // alongside the [isLight] effect below).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('soltol-theme');
      if (saved === 'light') document.body.classList.add('light');
    } catch { /* ignore */ }
  }, []);
  // Sync body class + persist whenever isLight changes.
  useEffect(() => {
    if (isLight) {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    try { localStorage.setItem('soltol-theme', isLight ? 'light' : 'dark'); } catch { /* ignore */ }
  }, [isLight]);
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

  // Global keyboard shortcut: Escape closes the drawer overlay
  // (any viewport) before falling back to history.back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (sidebarOpen) {
        setSidebarOpen(false);
      } else {
        window.history.back();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  // TC-06 — Auto-collapse the sidebar on narrow viewports (mobile /
  // portrait) so the 260px Sidebar.tsx doesn't eat half the screen.
  // The Menu button (TC-02) remains the manual toggle either way.
  // Re-evaluated on every resize so flipping a tablet to landscape
  // restores the sidebar without a refresh.
  // Close drawer on any viewport resize for a clean transition
  // between layouts.
  useEffect(() => {
    const handleResize = () => setSidebarOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Body scroll lock while the drawer overlay is open (any viewport).
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  const navigate = useNavigate();

  if (location.pathname === '/login') {
    return <AppRoutes />;
  }

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

  return (
    <div className="flex h-screen bg-redwood-bg-light overflow-hidden text-redwood-text-main font-inter">
      {/* ── 54px icon RAIL — always visible on lg+, hidden on mobile.
          Click any rail icon to open the drawer with that group
          pre-expanded. Rail itself is in the flex flow and reserves
          54px of width; the drawer overlays on top of content. */}
      <nav
        className="hidden lg:flex"
        style={{
          width: '54px',
          flexShrink: 0,
          background: 'var(--color-redwood-midnight)',
          borderRight: '1px solid var(--color-redwood-border)',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 0',
          overflowY: 'auto',
        }}
        aria-label="Section rail"
      >
        {[
          { key: 'home',        label: 'Home',         Icon: Home,         bg: 'rgba(0,212,170,.12)',   color: '#00D4AA' },
          { key: 'sales',       label: 'Sales & CRM',  Icon: ShoppingCart, bg: 'rgba(34,197,94,.12)',   color: '#22C55E' },
          { key: 'finance',     label: 'Finance',      Icon: DollarSign,   bg: 'rgba(245,158,11,.12)',  color: '#F59E0B' },
          { key: 'reports',     label: 'Reports',      Icon: BarChart2,    bg: 'rgba(255,255,255,.06)', color: '#8BA3C7' },
          { key: 'inventory',   label: 'Inventory',    Icon: Box,          bg: 'rgba(255,255,255,.06)', color: '#8BA3C7' },
          { key: 'procurement', label: 'Procurement',  Icon: Package,      bg: 'rgba(255,255,255,.06)', color: '#8BA3C7' },
          { key: 'logistics',   label: 'Delivery',     Icon: Truck,        bg: 'rgba(255,255,255,.06)', color: '#8BA3C7' },
          { key: 'ai',          label: 'AI Tools',     Icon: Star,         bg: 'rgba(124,58,237,.14)',  color: '#A78BFA' },
          { key: 'marketing',   label: 'Marketing',    Icon: Megaphone,    bg: 'rgba(255,255,255,.06)', color: '#8BA3C7' },
          { key: 'voice',       label: 'Soltol Voice', Icon: Mic,          bg: 'rgba(0,212,170,.12)',   color: '#00D4AA' },
          { key: 'system',      label: 'Settings',     Icon: Settings,     bg: 'rgba(255,255,255,.06)', color: '#8BA3C7' },
        ].map((g) => {
          const Icon = g.Icon;
          return (
            <button
              key={g.key}
              type="button"
              title={g.label}
              aria-label={g.label}
              onClick={(e) => {
                e.stopPropagation();
                openGroup(g.key);
                setSidebarOpen(true);
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: g.bg,
                color: g.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                flexShrink: 0,
                transition: 'transform 0.12s ease, filter 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.06)';
                e.currentTarget.style.filter = 'brightness(1.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.filter = 'none';
              }}
            >
              <Icon size={16} strokeWidth={2} />
            </button>
          );
        })}
      </nav>

      {/* Overlay backdrop behind the drawer — tap to close. Shown on
          ALL viewports when the drawer is open (drawer is overlay
          on desktop too now). */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 40,
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        }}
      />
      {/* Drawer — the existing Sidebar component, animated in from
          the left edge. Position fixed on every viewport now (no
          lg:static). Slide handled via inline transform so theme.css
          stays untouched. */}
      <div
        className="fixed inset-y-0 left-0 z-[200]"
        style={{
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.08s ease-out',
          boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.6)' : 'none',
        }}
      >
        <Sidebar openGroups={openGroups} onToggleGroup={toggleGroup} />
      </div>

      {/* Main Orchestration Area */}
      <main
        className="flex-1 flex flex-col min-w-0 pb-[72px] lg:pb-0"
        onClick={() => {
          if (sidebarOpen) setSidebarOpen(false);
        }}
      >
        <header className="h-[64px] bg-redwood-midnight border-b border-redwood-border px-3 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm print:hidden">
          <div className="flex items-center gap-2 sm:gap-6">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle sidebar"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              className="p-2 text-redwood-text-muted hover:bg-redwood-bg-light rounded-sm transition-all border border-transparent hover:border-redwood-border"
            >
              <Menu size={20} />
            </button>
            {/* FIX 1 — Compact single-line "Soltol ERP" logo matching
                preview.html .logo-w. Hidden on phones so the header
                doesn't overflow next to the breadcrumb + role pill. */}
            <div className="hidden sm:flex items-center gap-[7px] flex-shrink-0">
              <div
                className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                style={{ background: '#4F8EF7', fontFamily: "'Syne',sans-serif" }}
              >
                S1
              </div>
              <div className="flex flex-col leading-none whitespace-nowrap">
                <span style={{ fontFamily: "'Syne',sans-serif", fontSize: '15px', fontWeight: 600, color: 'var(--color-redwood-text-main)', letterSpacing: '-0.3px' }}>
                  Soltol
                </span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: '8.5px', fontWeight: 400, color: 'var(--color-redwood-text-muted)', marginTop: '1px' }}>
                  ERP
                </span>
              </div>
            </div>
            {/* Breadcrumb pill removed — nav goes logo → role pill →
                search directly per latest mockup. */}
            <button
              type="button"
              onClick={cycleRole}
              title="Click to switch role"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(79,142,247,.12)',
                color: '#93C5FD',
                border: '1px solid rgba(79,142,247,.3)',
                borderRadius: '999px',
                padding: '0 11px',
                height: '38px',
                fontSize: '10.5px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79,142,247,.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79,142,247,.12)'; }}
            >
              <User size={11} strokeWidth={2.5} />
              {ROLES[roleIndex]}
              <ChevronDown size={10} strokeWidth={2.5} />
            </button>
          </div>

          {/* Header-center command bar — search + voice.  Hidden on
              phones (the header is too narrow to host the pill plus
              the right-cluster icons). */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              height: '38px',
              background: 'rgba(255,255,255,.05)',
              border: '1.5px solid rgba(79,142,247,.4)',
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              margin: '0 7px',
              overflow: 'hidden',
            }}
          >
            <CommandBar />
          </div>

          {/* + New Invoice — blue header CTA matching preview.  Hidden
              on phones (narrow header).  Navigates only — no business
              logic, the invoice form on the other side owns that. */}
          <button
            type="button"
            onClick={() => navigate('/sales/invoices/new')}
            title="Create a new invoice"
            style={{
              background: '#4F8EF7',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'filter 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Invoice
          </button>

          <div className="flex items-center gap-2 sm:gap-6">
            {/* BUG #1 FIX: Removed Query ERP Records search bar */}

            <div className="flex items-center gap-2">
              {/* FIX 4 — Live badge with pulsing green dot. */}
              <div
                className="inline-flex items-center gap-[5px] rounded-full font-semibold"
                style={{
                  background: 'rgba(34,197,94,.12)',
                  border: '1px solid rgba(34,197,94,.2)',
                  color: '#86EFAC',
                  padding: '3px 9px',
                  fontSize: '9px',
                }}
              >
                <span className="w-[5px] h-[5px] rounded-full animate-pulse" style={{ background: '#22C55E' }} />
                Live
              </div>
              {/* FIX 5 — Light/dark mode toggle. */}
              <button
                type="button"
                onClick={() => setIsLight((v) => !v)}
                aria-label="Toggle light/dark mode"
                title="Toggle light/dark mode"
                className="p-2.5 text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-text-main rounded-sm transition-all"
              >
                {isLight ? <Moon size={20} /> : <Sun size={20} />}
              </button>
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
              {/* FIX 6 — "?" Help replaced with ⚙ Settings gear. */}
              <button
                onClick={() => navigate('/settings')}
                aria-label="Settings"
                title="Settings"
                className="p-2.5 text-redwood-text-muted hover:bg-redwood-bg-light hover:text-redwood-text-main rounded-sm transition-all"
              >
                <Settings size={20} />
              </button>

              <div className="hidden sm:block h-8 w-[1px] bg-redwood-border mx-3"></div>

              <div
                onClick={() => navigate('/settings')}
                className="flex items-center gap-3 pl-2 cursor-pointer group"
              >
                {/* FIX 7 — "MASTER CONTROL" label removed from nav. */}
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
                  {/* AQ avatar — solid blue + white text hardcoded inline
                      (no Tailwind, no gradient, no border) so the light-mode
                      theme can't override it. */}
                  <div style={{
                    background: '#4F8EF7',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}>
                    AQ
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    background: '#10B981',
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,.6)',
                  }} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Chips bar — RECENT AI prompts.  Click fills CommandBar input
            via the `soltol:fill-cmd` window event (CommandBar listens).
            No navigation — the prompt is queued in the search bar and
            the user reviews / hits Enter to submit. */}
        <div className="bg-redwood-midnight border-b border-[rgba(255,255,255,0.07)] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto hide-scrollbar print:hidden">
          <span className="text-[8.5px] font-semibold text-redwood-text-muted whitespace-nowrap uppercase tracking-[0.05em] flex-shrink-0">RECENT:</span>
          {[
            { label: 'Ali Bettano 0W16',    text: 'Ali bought Bettano 0W16 SP 12x1 — 3 cases $56',          icon: FileText,    bg: 'rgba(255,255,255,0.05)', color: 'var(--color-redwood-text-muted)', border: 'rgba(255,255,255,0.10)' },
            { label: 'Leo Tire paid $239',  text: 'Leo Tire Shop paid $239 today',                          icon: Wallet,      bg: 'rgba(34,197,94,0.12)',   color: '#86EFAC', border: 'rgba(34,197,94,0.30)' },
            { label: 'Mobil 5W30 stock',    text: 'Check stock and reorder plan for Mobil 5W30',            icon: Package,     bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D', border: 'rgba(245,158,11,0.30)' },
            { label: 'Qahir demand letter', text: 'Qahir Enterprises 32 days overdue — draft demand letter', icon: AlertCircle, bg: 'rgba(239,68,68,0.12)',   color: '#FCA5A5', border: 'rgba(239,68,68,0.30)' },
            { label: 'VAT return Q1',       text: 'Generate VAT return report for this quarter',            icon: Receipt,     bg: 'rgba(255,255,255,0.05)', color: 'var(--color-redwood-text-muted)', border: 'rgba(255,255,255,0.10)' },
            { label: 'Today audit log',     text: 'Show full audit log for today — all user actions',       icon: Shield,      bg: 'rgba(0,212,170,0.10)',   color: '#5EEAD4', border: 'rgba(0,212,170,0.30)' },
            { label: 'Churn risk',          text: 'Which customers are at risk of churning this month?',    icon: UserX,       bg: 'rgba(245,158,11,0.12)',  color: '#FCD34D', border: 'rgba(245,158,11,0.30)' },
            { label: 'Payment run Fri',     text: 'AP $18k due in 7 days — schedule payment run',           icon: Calendar,    bg: 'rgba(255,255,255,0.05)', color: 'var(--color-redwood-text-muted)', border: 'rgba(255,255,255,0.10)' },
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
                className="flex items-center gap-1 px-2 h-[21px] rounded-full text-[9.5px] font-medium whitespace-nowrap transition-all hover:-translate-y-[1px] hover:brightness-110 flex-shrink-0 border"
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
          <div className="bg-[rgba(245,158,11,0.07)] border-b border-[rgba(245,158,11,0.14)] px-3 py-1.5 flex items-center gap-2 overflow-hidden text-[10px] text-redwood-text-muted print:hidden">
            <AlertTriangle size={14} className="text-[#F59E0B] flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              {alertCounts.unpaid > 0 && (
                <>
                  <strong style={{ color: '#FCD34D', fontWeight: 600 }}>{alertCounts.unpaid} unpaid invoice{alertCounts.unpaid === 1 ? '' : 's'}</strong>
                  {alertCounts.unpaidTotal > 0 && ` totalling $${alertCounts.unpaidTotal.toLocaleString()}`}
                </>
              )}
              {alertCounts.unpaid > 0 && (alertCounts.overdue > 0 || alertCounts.lowStock > 0) && ' · '}
              {alertCounts.overdue > 0 && <>{alertCounts.overdue} overdue</>}
              {alertCounts.overdue > 0 && alertCounts.lowStock > 0 && ' · '}
              {alertCounts.lowStock > 0 && <>{alertCounts.lowStock} item{alertCounts.lowStock === 1 ? '' : 's'} low stock</>}
            </span>
            {alertCounts.unpaid > 0 && (
              <button onClick={() => navigate('/sales/invoices')} className="text-[9.5px] text-[#F59E0B] font-semibold underline hover:no-underline flex-shrink-0">Invoices →</button>
            )}
            {alertCounts.lowStock > 0 && (
              <button onClick={() => navigate('/products')} className="text-[9.5px] text-[#F59E0B] font-semibold underline hover:no-underline flex-shrink-0">Stock →</button>
            )}
            {alertCounts.overdue > 0 && (
              <button onClick={() => navigate('/reports/aged-receivable')} className="text-[9.5px] text-[#F59E0B] font-semibold underline hover:no-underline flex-shrink-0">Aged AR →</button>
            )}
            <button
              onClick={() => {
                try { sessionStorage.setItem('soltol_alert_dismissed', '1'); } catch { /* ignore */ }
                setShowAlertBar(false);
              }}
              className="ml-2 w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[#3E5678] hover:bg-white/10 flex-shrink-0"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Tab row — broad navigation categories with route mapping */}
        <div className="bg-redwood-midnight border-b border-[rgba(255,255,255,0.07)] px-3 flex items-end overflow-x-auto hide-scrollbar print:hidden">
          {[
            { key: 'overview',  label: 'Overview',       route: '/',                   icon: LayoutDashboard, prefix: ['/'],                                       badge: null,  badgeColor: null },
            { key: 'finance',   label: 'Finance & Tax',  route: '/finance/dashboard',  icon: Receipt,         prefix: ['/finance', '/tax'],                        badge: '30%', badgeColor: 'red' },
            { key: 'warehouse', label: 'Warehouse',      route: '/warehouse/dashboard',icon: Package,         prefix: ['/warehouse', '/products', '/inventory'],   badge: '25%', badgeColor: 'red' },
            { key: 'mobile',    label: 'Field & Mobile', route: '/logistics/pod',      icon: Smartphone,      prefix: ['/logistics', '/pod', '/van-sales'],        badge: '20%', badgeColor: 'amber' },
            { key: 'security',  label: 'Security',       route: '/access-management',  icon: Shield,          prefix: ['/access-management', '/users'],            badge: '40%', badgeColor: 'amber' },
            { key: 'sales',     label: 'Sales & CRM',    route: '/sales/dashboard',    icon: TrendingUp,      prefix: ['/sales', '/customers', '/crm'],            badge: null,  badgeColor: null },
            { key: 'ai',        label: 'AI Hub',         route: '/ai/hub',             icon: Sparkles,        prefix: ['/ai'],                                     badge: null,  badgeColor: null },
            { key: 'pulse',     label: 'Pulse',          route: '/pulse',              icon: Megaphone,       prefix: ['/pulse'],                                  badge: null,  badgeColor: null },
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
                className={`flex items-center gap-[5px] px-[11px] h-[38px] text-[10.5px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'text-redwood-text-main border-[#4F8EF7]'
                    : 'text-redwood-text-muted border-transparent hover:text-redwood-text-main'
                }`}
              >
                <Icon size={14} />
                {t.label}
                {t.badge && (
                  <span
                    className="text-[7.5px] font-semibold px-1.5 py-[1px] rounded-full ml-0.5"
                    style={
                      t.badgeColor === 'red'
                        ? { background: 'rgba(239,68,68,0.18)', color: '#FCA5A5' }
                        : { background: 'rgba(245,158,11,0.18)', color: '#FCD34D' }
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
        <footer className="h-10 bg-redwood-midnight border-t border-redwood-border px-3 sm:px-8 hidden lg:flex items-center justify-between text-[10px] font-bold text-redwood-text-muted uppercase tracking-[0.2em] shadow-[0_-1px_3px_rgba(0,0,0,0.02)] print:hidden">
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

      {/* Mobile bottom nav — 5 quick-access routes. Hidden on lg+.
          Fixed-positioned overlay; <main> uses pb-[72px] lg:pb-0 to
          keep scrollable content above this bar. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 h-[56px] flex z-50 bg-redwood-midnight border-t border-[rgba(255,255,255,0.07)] print:hidden"
        aria-label="Mobile navigation"
      >
        {[
          { key: 'home',    label: 'Home',    icon: Home,            route: '/',                   prefix: ['/']                                      },
          { key: 'finance', label: 'Finance', icon: Receipt,         route: '/finance/dashboard',  prefix: ['/finance', '/tax']                       },
          { key: 'invoice', label: 'Invoice', icon: FileText,        route: '/sales/invoices',     prefix: ['/sales/invoices']                        },
          { key: 'stock',   label: 'Stock',   icon: Package,         route: '/products',           prefix: ['/products', '/inventory', '/warehouse']  },
          { key: 'menu',    label: 'Menu',    icon: Menu,            route: null,                  prefix: []                          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = item.key === 'home'
            ? location.pathname === '/'
            : item.prefix.some((p) => location.pathname.startsWith(p));
          return (
            <button
              key={item.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (item.key === 'menu') setSidebarOpen(true);
                else if (item.route) navigate(item.route);
              }}
              className="flex-1 flex flex-col items-center justify-center gap-[2px] text-[8.5px] py-1 cursor-pointer transition-colors"
              style={{ color: isActive ? '#4F8EF7' : '#3E5678' }}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-[#4F8EF7] mt-px" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
