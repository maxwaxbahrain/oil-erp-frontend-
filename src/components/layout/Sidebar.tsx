import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Home,
    LayoutDashboard,
    Send,
    FileText,
    User,
    Database,
    ShoppingCart,
    Shield,
    BarChart2,
    Package,
    RefreshCw,
    Coins,
    Receipt,
    CheckCircle2,
    Upload,
    MapPin,
    Globe,
    BookOpen,
    Calculator,
    AlertTriangle,
    Box,
    Truck,
    Sparkles,
    Bot,
    Headphones,
    Brain,
    Mail,
    Zap,
    DollarSign,
    TrendingUp,
    Newspaper,
    Megaphone,
    Users,
    Tag,
    PieChart,
    Mic,
    Briefcase,
    Settings,
    ChevronRight,
    Lock,
    Activity,
    Search,
} from 'lucide-react';
import clsx from 'clsx';

// ── Badge tone palette (shared by NavItem + GroupHeader).  Three
//    tones — red / amber / teal — matching the rest of the Soltol UI.
type BadgeTone = 'red' | 'amber' | 'teal';
type Badge = { text: string; tone: BadgeTone };

const BADGE_CLASS: Record<BadgeTone, string> = {
    red:   'bg-[rgba(239,68,68,0.18)] text-[#FCA5A5]',
    amber: 'bg-[rgba(245,158,11,0.18)] text-[#FCD34D]',
    teal:  'bg-[rgba(0,212,170,0.15)] text-[#5EEAD4]',
};

function BadgePill({ text, tone }: Badge) {
    return (
        <span className={clsx('text-[8px] font-bold px-[5px] py-[1px] rounded-full flex-shrink-0', BADGE_CLASS[tone])}>
            {text}
        </span>
    );
}

export default function Sidebar() {
    const location = useLocation();

    // Per-group open/closed state.  HOME defaults to open so the user
    // always sees Dashboard.  Each entry is keyed by the group's `keyId`
    // below; toggleGroup flips one key without affecting the others
    // (multiple groups can be open at once — no accordion).
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
        home: true,
    });
    const toggleGroup = (key: string) =>
        setOpenGroups(p => ({ ...p, [key]: !p[key] }));

    // ── NavItem — one row inside a group.  Active state: tinted blue
    //    background + blue text + 2px right border (Soltol pattern).
    //    The `to !== '/'` guard prevents '/' from matching every route
    //    via startsWith.
    const NavItem = ({
        to, icon: Icon, label, badge,
    }: {
        to: string;
        icon: any;
        label: string;
        badge?: Badge;
    }) => {
        const isActive =
            location.pathname === to ||
            (to !== '/' && location.pathname.startsWith(to));
        return (
            <Link
                to={to}
                className={clsx(
                    'flex items-center gap-2 pl-9 pr-3 py-1.5 transition-colors text-[12px] relative',
                    isActive
                        ? 'bg-[rgba(79,142,247,0.10)] text-[#93C5FD] border-r-2 border-r-[#4F8EF7]'
                        : 'text-redwood-text-muted hover:bg-redwood-row-bg hover:text-redwood-text-main'
                )}
            >
                <Icon size={13} className={isActive ? 'text-[#4F8EF7]' : 'text-redwood-text-subtle'} />
                <span className="flex-1 truncate">{label}</span>
                {badge && <BadgePill text={badge.text} tone={badge.tone} />}
            </Link>
        );
    };

    // ── GroupHeader — the clickable bar that expands/collapses a group.
    //    Each group has its own icon bg color (the small rounded square
    //    on the left) plus an optional summary badge on the right.
    const GroupHeader = ({
        keyId, icon: Icon, iconBg, iconColor, label, badge,
    }: {
        keyId: string;
        icon: any;
        iconBg: string;
        iconColor: string;
        label: string;
        badge?: Badge;
    }) => (
        <div
            onClick={() => toggleGroup(keyId)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleGroup(keyId);
                }
            }}
            aria-expanded={!!openGroups[keyId]}
            className="flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none border-t border-redwood-border hover:bg-redwood-row-bg transition-colors first:border-t-0"
        >
            <div
                className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center flex-shrink-0"
                style={{ background: iconBg }}
            >
                <Icon size={12} style={{ color: iconColor }} />
            </div>
            <span className="text-[10px] font-semibold text-redwood-text-muted flex-1 tracking-[0.04em] uppercase truncate">
                {label}
            </span>
            {badge && <BadgePill text={badge.text} tone={badge.tone} />}
            <ChevronRight
                size={10}
                strokeWidth={2.5}
                className="text-redwood-text-subtle flex-shrink-0"
                style={{
                    transform: openGroups[keyId] ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                }}
            />
        </div>
    );

    return (
        <aside className="w-[280px] lg:w-[224px] bg-redwood-midnight text-redwood-text-main flex flex-col z-40 border-r border-redwood-border shadow-2xl h-full print:hidden">
            {/* Sidebar search — the SOLTOL ONE/tenant logo lives in the
                top nav header now (App.tsx). Mirrors preview.html .sbsearch. */}
            <div className="px-3 py-3 border-b border-redwood-border shrink-0">
                <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-redwood-text-muted pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search menu..."
                        className="w-full pl-9 pr-3 py-2 bg-redwood-bg-light border border-redwood-border rounded-md text-[12px] text-redwood-text-main placeholder:text-redwood-text-muted focus:border-redwood-brand focus:outline-none"
                    />
                </div>
            </div>

            {/* Groups — 11 collapsible sections in spec order */}
            <nav className="flex-1 overflow-y-auto scrollbar-hide">

                {/* ── HOME ────────────────────────────────────────── */}
                <GroupHeader
                    keyId="home"
                    icon={Home}
                    iconBg="rgba(79,142,247,0.2)"
                    iconColor="#93C5FD"
                    label="Home"
                />
                {openGroups.home && (
                    <div className="pb-1">
                        <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                        <NavItem to="/pulse" icon={Send} label="PULSE — Team Chat" />
                        <NavItem to="/pulse/notes" icon={FileText} label="Meeting Notes" />
                        <NavItem to="/portal" icon={User} label="Employee Portal" />
                        <NavItem to="/migrate" icon={Database} label="Data Migration" />
                    </div>
                )}

                {/* ── SALES & CRM ─────────────────────────────────── */}
                <GroupHeader
                    keyId="sales"
                    icon={ShoppingCart}
                    iconBg="rgba(34,197,94,0.15)"
                    iconColor="#86EFAC"
                    label="Sales & CRM"
                    badge={{ text: '9', tone: 'red' }}
                />
                {openGroups.sales && (
                    <div className="pb-1">
                        <NavItem to="/customers" icon={Users} label="Customers" />
                        <NavItem to="/credit" icon={Shield} label="Credit Intelligence" />
                        <NavItem to="/crm" icon={BarChart2} label="CRM Pipeline" />
                        <NavItem to="/sales/orders" icon={FileText} label="Orders" />
                        <NavItem to="/amazon" icon={Package} label="Amazon" />
                        <NavItem to="/sales/quotations" icon={FileText} label="Quotations" />
                        <NavItem to="/sales/invoices" icon={FileText} label="Invoices" badge={{ text: '9', tone: 'red' }} />
                        <NavItem to="/sales/returns" icon={RefreshCw} label="Sales Returns" />
                        <NavItem to="/sales/credit-notes" icon={FileText} label="Credit Notes" />
                    </div>
                )}

                {/* ── FINANCE ─────────────────────────────────────── */}
                <GroupHeader
                    keyId="finance"
                    icon={Coins}
                    iconBg="rgba(245,158,11,0.15)"
                    iconColor="#FCD34D"
                    label="Finance"
                    badge={{ text: '3', tone: 'amber' }}
                />
                {openGroups.finance && (
                    <div className="pb-1">
                        <NavItem to="/finance/expenses" icon={Receipt} label="Expenses" />
                        <NavItem to="/finance/expenses/approvals" icon={CheckCircle2} label="Approvals" badge={{ text: '3', tone: 'amber' }} />
                        <NavItem to="/finance/expenses/bulk-upload" icon={Upload} label="Bulk Upload" />
                        <NavItem to="/finance/expenses/mileage" icon={MapPin} label="Mileage" />
                        <NavItem to="/finance/banking" icon={Globe} label="Banking" />
                        <NavItem to="/finance/accounting" icon={Briefcase} label="Accounting" />
                        <NavItem to="/finance/chart-of-accounts" icon={BookOpen} label="Chart of Accounts" />
                        <NavItem to="/finance/all-ledger" icon={BookOpen} label="All-Accounts Ledger" />
                        <NavItem to="/finance/financial-statement" icon={FileText} label="Financial Statement" />
                        <NavItem to="/finance/journal-voucher" icon={FileText} label="Journal Voucher (JV)" />
                        <NavItem to="/finance/bad-debts" icon={AlertTriangle} label="Bad Debts Write-Off" />
                        <NavItem to="/tax" icon={Calculator} label="Tax Management" />
                    </div>
                )}

                {/* ── REPORTS ─────────────────────────────────────── */}
                <GroupHeader
                    keyId="reports"
                    icon={BarChart2}
                    iconBg="rgba(167,139,250,0.15)"
                    iconColor="#C4B5FD"
                    label="Reports"
                />
                {openGroups.reports && (
                    <div className="pb-1">
                        <NavItem to="/reports/sales" icon={TrendingUp} label="Profitability Reports" />
                        <NavItem to="/sales/price-lists" icon={Tag} label="Customer Price Lists" />
                        <NavItem to="/sales/recurring" icon={RefreshCw} label="Recurring Invoices" />
                        <NavItem to="/reports/financial" icon={PieChart} label="Financial Reports" />
                    </div>
                )}

                {/* ── INVENTORY ───────────────────────────────────── */}
                <GroupHeader
                    keyId="inventory"
                    icon={Box}
                    iconBg="rgba(249,115,22,0.15)"
                    iconColor="#FDBA74"
                    label="Inventory"
                    badge={{ text: '40', tone: 'amber' }}
                />
                {openGroups.inventory && (
                    <div className="pb-1">
                        <NavItem to="/products" icon={Package} label="Product Catalog" />
                        <NavItem to="/products/reports" icon={PieChart} label="Inventory Reports" />
                        <NavItem to="/inventory/adjustments" icon={Package} label="Stock Adjustment" />
                    </div>
                )}

                {/* ── PROCUREMENT ─────────────────────────────────── */}
                <GroupHeader
                    keyId="procurement"
                    icon={Truck}
                    iconBg="rgba(45,212,191,0.12)"
                    iconColor="#5EEAD4"
                    label="Procurement"
                />
                {openGroups.procurement && (
                    <div className="pb-1">
                        <NavItem to="/purchases/suppliers" icon={Users} label="Suppliers" />
                        <NavItem to="/purchases" icon={FileText} label="Recent Orders" />
                        <NavItem to="/purchases/new" icon={Package} label="Create New PO" />
                        <NavItem to="/receiving/new" icon={Truck} label="Material Receipt (GRN)" />
                    </div>
                )}

                {/* ── DELIVERY & LOGISTICS ────────────────────────── */}
                <GroupHeader
                    keyId="logistics"
                    icon={Truck}
                    iconBg="rgba(16,185,129,0.12)"
                    iconColor="#6EE7B7"
                    label="Delivery & Logistics"
                />
                {openGroups.logistics && (
                    <div className="pb-1">
                        <NavItem to="/logistics/pod" icon={BarChart2} label="POD — Driver App" />
                        <NavItem to="/logistics/operations" icon={Truck} label="Van Operations" badge={{ text: '2', tone: 'amber' }} />
                        <NavItem to="/logistics/routes" icon={MapPin} label="Route Navigator" />
                    </div>
                )}

                {/* ── AI TOOLS ────────────────────────────────────── */}
                <GroupHeader
                    keyId="ai"
                    icon={Sparkles}
                    iconBg="rgba(79,142,247,0.2)"
                    iconColor="#93C5FD"
                    label="AI Tools"
                    badge={{ text: '11', tone: 'teal' }}
                />
                {openGroups.ai && (
                    <div className="pb-1">
                        <NavItem to="/ai" icon={Brain} label="AI Hub" />
                        <NavItem to="/agents" icon={Bot} label="Agent Hub" />
                        <NavItem to="/agents/customer-service" icon={Headphones} label="ARIA — Customer Service" />
                        <NavItem to="/agents/business-advisor" icon={Brain} label="Marcus — Business Advisor" />
                        <NavItem to="/agents/email-reply" icon={Mail} label="Email Auto-Reply" />
                        <NavItem to="/ai/auto-po" icon={ShoppingCart} label="Auto PO Generation" />
                        <NavItem to="/ai/anomaly" icon={AlertTriangle} label="Anomaly Detection" />
                        <NavItem to="/ai/customer-forecast" icon={Users} label="Customer Forecast" />
                        <NavItem to="/ai/revenue-forecast" icon={DollarSign} label="Revenue Forecast" />
                        <NavItem to="/reports/demand-forecast" icon={TrendingUp} label="Demand Forecast" />
                        <NavItem to="/news" icon={Newspaper} label="Business News" />
                    </div>
                )}

                {/* ── MARKETING ───────────────────────────────────── */}
                <GroupHeader
                    keyId="marketing"
                    icon={Megaphone}
                    iconBg="rgba(236,72,153,0.15)"
                    iconColor="#F9A8D4"
                    label="Marketing"
                />
                {openGroups.marketing && (
                    <div className="pb-1">
                        <NavItem to="/marketing/studio" icon={Zap} label="AI Content Studio" />
                        <NavItem to="/marketing/segments" icon={Users} label="Customer Segments" />
                        <NavItem to="/marketing/campaigns" icon={Send} label="Campaign Manager" />
                        <NavItem to="/marketing/analytics" icon={BarChart2} label="Analytics" />
                    </div>
                )}

                {/* ── SOLTOL VOICE ────────────────────────────────── */}
                <GroupHeader
                    keyId="voice"
                    icon={Mic}
                    iconBg="rgba(34,197,94,0.12)"
                    iconColor="#86EFAC"
                    label="Soltol Voice"
                />
                {openGroups.voice && (
                    <div className="pb-1">
                        <NavItem to="/voice/dashboard" icon={LayoutDashboard} label="Voice Dashboard" />
                        <NavItem to="/voice/calls" icon={Headphones} label="Call History" />
                        <NavItem to="/voice/analytics" icon={Activity} label="Voice Analytics" />
                        <NavItem to="/voice/coaching-rules" icon={Brain} label="Coaching Rules" />
                    </div>
                )}

                {/* ── SYSTEM & SETTINGS ───────────────────────────── */}
                <GroupHeader
                    keyId="system"
                    icon={Settings}
                    iconBg="rgba(100,116,139,0.15)"
                    iconColor="#94A3B8"
                    label="System & Settings"
                />
                {openGroups.system && (
                    <div className="pb-1">
                        <NavItem to="/access-management" icon={Lock} label="User Access Management" />
                        <NavItem to="/settings/users" icon={Users} label="User Management" />
                        <NavItem to="/voice/onboard" icon={Briefcase} label="Onboard Tenant" />
                        <NavItem to="/settings" icon={Settings} label="Settings" />
                    </div>
                )}

            </nav>

            {/* Footer — status + help shortcuts (spec layout) */}
            <div className="p-2 border-t border-redwood-border flex gap-1">
                <button className="flex-1 flex items-center justify-center gap-1 p-1.5 bg-redwood-row-bg border border-redwood-border rounded-[5px] text-[9px] text-redwood-text-muted hover:bg-redwood-row-hover">
                    ● All systems OK
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 p-1.5 bg-redwood-row-bg border border-redwood-border rounded-[5px] text-[9px] text-redwood-text-muted hover:bg-redwood-row-hover">
                    ? Help
                </button>
            </div>
        </aside>
    );
}
