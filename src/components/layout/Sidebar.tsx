import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NewsTicker from '../NewsTicker';
import { useAuth } from '../../contexts/AuthContext';
import {
    ADMIN_ROLES,
    DELIVERY_ROLES,
    FINANCE_ROLES,
    MANAGEMENT_ROLES,
    SALES_INTEL_ROLES,
    isSidebarPathAllowed,
} from '../../utils/rbac';
import {
    LayoutDashboard,
    Package,
    Truck,
    BarChart2,
    FileText,
    Users,
    Settings,
    ChevronRight,
    RefreshCw,
    Globe,
    Briefcase,
    PieChart,
    UserCheck,
    TrendingUp,
    User,
    MapPin
, CalendarDays , Tag , BookOpen , Scale , Clock , AlertTriangle , Brain , ShoppingCart , DollarSign , Bot , Headphones , Shield , Newspaper , Megaphone , Zap , Send , Calculator  , Database , Receipt , Upload , CheckCircle2 , Mail , LogOut , Sparkles , Lock , Activity , Inbox } from 'lucide-react';
import clsx from 'clsx';
import { getCompanyProfile } from '../../services/settingsService';
import { isProduction } from '../../config/appEnv';
import { isRouteLocked } from '../../config/lockedFeatures';
import { MODULE_FLAGS } from '../../config/moduleFlags';
import { LockedNavIcon } from '../common/SubscriptionRequired';


export default function Sidebar({
    openGroups: _openGroups,
    onToggleGroup: _onToggleGroup,
}: {
    openGroups?: Record<string, boolean>;
    onToggleGroup?: (key: string) => void;
} = {}) {
    const location = useLocation();
    const { user, hasRole, logout } = useAuth();

    const canSeeFinance = hasRole(...FINANCE_ROLES);
    const canSeeManagement = hasRole(...MANAGEMENT_ROLES);
    const canSeeDeliveries = hasRole(...DELIVERY_ROLES);
    const canSeeSalesIntel = hasRole(...SALES_INTEL_ROLES);
    const canSeeAdmin = hasRole(...ADMIN_ROLES);

    const showNav = (path: string) => isSidebarPathAllowed(user?.role, path);

    const roleLabel = user?.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : 'User';
    const [sections, setSections] = useState<{ [key: string]: boolean }>({
        sales: true,
        purchase: true,
        products: true,
        finance: false,
        expenses: true,
        reports: false,
        ai: true,
        marketing: true,
        agents: true,
        voice: true,
    });

    const toggleSection = (section: string) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
        if (!showNav(to)) return null;

        const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
        const showLock = isProduction && isRouteLocked(to);
        return (
            <Link
                to={to}
                className={clsx(
                    "flex items-center gap-3 px-4 py-2.5 transition-all duration-200 rounded-sm relative group mb-0.5",
                    isActive
                        ? "bg-redwood-brand text-white shadow-md z-10"
                        : "text-redwood-text-muted hover:bg-white/5 hover:text-white"
                )}
            >
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-white" />
                )}
                <Icon size={18} className={clsx(isActive ? "text-white" : "text-[#5d6b7b] group-hover:text-white")} />
                <span className="text-[12px] font-semibold tracking-wide flex-1">{label}</span>
                {showLock && <LockedNavIcon />}
            </Link>
        );
    };

    const SectionHeader = ({ label, isOpen, onClick }: { label: string, isOpen: boolean, onClick: () => void }) => (
        <button
            onClick={onClick}
            className={clsx(
                "w-full flex items-center justify-between px-4 py-2 mb-1 mt-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-80 transition-colors",
                isOpen ? "text-redwood-secondary" : "text-redwood-text-muted hover:text-white"
            )}
        >
            <span>{label}</span>
            <ChevronRight size={14} className={clsx("transition-transform duration-300", isOpen && "rotate-90")} />
        </button>
    );

    const showSalesSection = showNav('/customers') || showNav('/sales/orders');
    const showProcurement = showNav('/purchases/suppliers') || showNav('/receiving');
    const showPremium = (MODULE_FLAGS.pulse && showNav('/pulse'))
        || (MODULE_FLAGS.meeting_notes && showNav('/pulse/notes'))
        || (canSeeSalesIntel && (
            (MODULE_FLAGS.credit_intelligence && showNav('/credit'))
            || (MODULE_FLAGS.crm_pipeline && showNav('/crm'))
            || (MODULE_FLAGS.amazon && showNav('/amazon'))
        ))
        || (canSeeFinance && MODULE_FLAGS.tax_management && showNav('/tax'));
    const showAgentsSection = (MODULE_FLAGS.agent_hub && showNav('/agents'))
        || showNav('/agents/customer-service')
        || showNav('/agents/business-advisor')
        || (MODULE_FLAGS.email_auto_reply && showNav('/agents/email-reply'));
    const showMarketing = MODULE_FLAGS.marketing && showNav('/marketing');
    const showVoiceSection = (MODULE_FLAGS.voice_dashboard && showNav('/voice/dashboard'))
        || showNav('/voice/calls')
        || (MODULE_FLAGS.voice_analytics && showNav('/voice/analytics'))
        || (MODULE_FLAGS.voice_coaching_rules && showNav('/voice/coaching-rules'));
    const showAiIntelligence = showNav('/ai/hub')
        || (MODULE_FLAGS.ai_intelligence_landing && showNav('/ai'))
        || (MODULE_FLAGS.auto_po_generation && showNav('/ai/auto-po'))
        || (MODULE_FLAGS.anomaly_detection && showNav('/ai/anomaly'))
        || (MODULE_FLAGS.customer_forecast && showNav('/ai/customer-forecast'))
        || (MODULE_FLAGS.revenue_forecast && showNav('/ai/revenue-forecast'));

    return (
        <aside className="w-[260px] bg-redwood-midnight text-white flex flex-col z-40 border-r border-white/5 shadow-2xl h-full print:hidden">
            <div className="h-[64px] flex items-center px-4 border-b border-white/5 bg-redwood-midnight/50 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3 w-full">
                    <div className="w-9 h-9 bg-redwood-brand rounded-sm flex items-center justify-center text-white font-black text-sm shadow-lg rotate-3 flex-shrink-0">
                        <span className="drop-shadow-sm">S</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-black tracking-widest leading-none text-redwood-brand uppercase">SOLTOL ONE</span>
                        <span className="text-[13px] font-black tracking-tight leading-tight text-white uppercase truncate mt-0.5">{getCompanyProfile().name || 'Your Company'}</span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto scrollbar-hide pb-10">

                {(showNav('/') || showNav('/portal') || (canSeeAdmin && showNav('/migrate'))) && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-1">
                    Core
                </div>
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                {canSeeAdmin && <NavItem to="/migrate" icon={Database} label="📥 Data Migration" />}
                <NavItem to="/portal" icon={User} label="Employee Portal" />
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {showSalesSection && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Sales
                </div>
                <NavItem to="/customers" icon={Users} label="Customers" />
                <NavItem to="/sales/orders" icon={FileText} label="Orders" />
                <div>
                    <SectionHeader
                        label="Sales Orders"
                        isOpen={sections.sales}
                        onClick={() => toggleSection('sales')}
                    />
                    {sections.sales && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            <NavItem to="/sales/quotations" icon={FileText} label="Quotations" />
                            <NavItem to="/sales/invoices" icon={FileText} label="Invoices" />
                            {MODULE_FLAGS.sales_returns && (
                            <NavItem to="/sales/returns" icon={RefreshCw} label="Sales Returns" />
                            )}
                            <NavItem to="/sales/credit-notes" icon={FileText} label="Credit Notes" />
                            <NavItem to="/sales/price-lists" icon={Tag} label="Customer Price Lists" />
                            <NavItem to="/sales/recurring" icon={RefreshCw} label="Recurring Invoices" />
                        </div>
                    )}
                </div>
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {((canSeeDeliveries && (showNav('/logistics/pod') || showNav('/logistics/operations') || showNav('/logistics/routes')))
                  || (canSeeManagement && (showNav('/logistics/tracking') || showNav('/logistics/route-planning')))) && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Logistics & Delivery
                </div>
                {canSeeManagement && <NavItem to="/logistics/tracking" icon={MapPin} label="Live Van Tracking" />}
                {canSeeManagement && <NavItem to="/logistics/route-planning" icon={CalendarDays} label="Route Planning" />}
                <NavItem to="/logistics/pod" icon={BarChart2} label="POD - Driver App" />
                <NavItem to="/logistics/operations" icon={Truck} label="Van Operations" />
                <NavItem to="/logistics/routes" icon={MapPin} label="Route Navigator" />
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {showNav('/products') && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Inventory Control
                </div>
                <NavItem to="/products" icon={Package} label="Product Catalog" />
                {canSeeManagement && (
                    <>
                        <NavItem to="/products/reports" icon={PieChart} label="Inventory Reports" />
                        <NavItem to="/inventory/adjustments" icon={Package} label="Stock Adjustment" />
                    </>
                )}
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {showProcurement && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Procurement
                </div>
                <NavItem to="/purchases/suppliers" icon={Users} label="Suppliers" />
                <NavItem to="/receiving" icon={Inbox} label="Material Receipt (GRN)" />
                <div>
                    <SectionHeader
                        label="Purchase Orders"
                        isOpen={sections.purchase}
                        onClick={() => toggleSection('purchase')}
                    />
                    {sections.purchase && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            <NavItem to="/purchases" icon={FileText} label="Recent Orders" />
                            <NavItem to="/purchases/new" icon={Package} label="Create New PO" />
                        </div>
                    )}
                </div>
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {canSeeFinance && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Finance
                </div>
                <div>
                    <SectionHeader
                        label="Payments"
                        isOpen={sections.finance}
                        onClick={() => toggleSection('finance')}
                    />
                    {sections.finance && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            {MODULE_FLAGS.payroll && (
                            <NavItem to="/finance/payroll" icon={Users} label="Payroll" />
                            )}
                            <NavItem to="/finance/accounting" icon={Briefcase} label="Accounting" />
                        </div>
                    )}
                </div>
                <NavItem to="/finance/banking" icon={Globe} label="Banking" />
                <NavItem to="/finance/chart-of-accounts" icon={BookOpen} label="Chart of Accounts" />
                <NavItem to="/finance/all-ledger" icon={BookOpen} label="All-Accounts Ledger" />
                <NavItem to="/finance/financial-statement" icon={FileText} label="Financial Statement" />
                <NavItem to="/finance/journal-voucher" icon={FileText} label="Journal Voucher (JV)" />
                {MODULE_FLAGS.bad_debts_writeoff && (
                <NavItem to="/finance/bad-debts" icon={AlertTriangle} label="Bad Debts Write-Off" />
                )}
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {canSeeManagement && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Expenses
                </div>
                <div>
                    <SectionHeader
                        label="Expense Management"
                        isOpen={sections.expenses}
                        onClick={() => toggleSection('expenses')}
                    />
                    {sections.expenses && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            <NavItem to="/finance/expenses" icon={Receipt} label="Expenses" />
                            <NavItem to="/finance/expenses/approvals" icon={CheckCircle2} label="Approvals" />
                            <NavItem to="/finance/expenses/bulk-upload" icon={Upload} label="Bulk Upload" />
                            <NavItem to="/finance/expenses/mileage" icon={MapPin} label="Mileage" />
                            <NavItem to="/finance/expenses/reports" icon={BarChart2} label="Reports" />
                            <NavItem to="/finance/expenses/settings" icon={Settings} label="Settings" />
                        </div>
                    )}
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Reports
                </div>
                <div>
                    <SectionHeader
                        label="Financial Reports"
                        isOpen={sections.reports}
                        onClick={() => toggleSection('reports')}
                    />
                    {sections.reports && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            <NavItem to="/reports/financial" icon={PieChart} label="Financial Statements" />
                            <NavItem to="/reports/day-book" icon={BookOpen} label="Day Book" />
                            <NavItem to="/reports/trial-balance" icon={Scale} label="Trial Balance" />
                            <NavItem to="/reports/aged-receivable" icon={Clock} label="Aged Receivable" />
                            <NavItem to="/reports/aged-payable" icon={Clock} label="Aged Payable" />
                            <NavItem to="/reports/outstanding-bills" icon={FileText} label="Outstanding Bills" />
                            {MODULE_FLAGS.reports_profitability_sales && (
                            <NavItem to="/reports/sales" icon={TrendingUp} label="Profitability Reports" />
                            )}
                            {MODULE_FLAGS.demand_forecast && (
                            <NavItem to="/reports/demand-forecast" icon={TrendingUp} label="Demand Forecast" />
                            )}
                        </div>
                    )}
                </div>
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {showPremium && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-amber-400/70 px-4 py-2 mt-1">
                    Premium
                </div>
                {MODULE_FLAGS.pulse && (
                <NavItem to="/pulse" icon={Send} label="PULSE — Team Chat" />
                )}
                {MODULE_FLAGS.meeting_notes && (
                <NavItem to="/pulse/notes" icon={FileText} label="Meeting Notes" />
                )}
                {canSeeSalesIntel && (
                <>
                {MODULE_FLAGS.credit_intelligence && (
                <NavItem to="/credit" icon={Shield} label="Credit Intelligence" />
                )}
                {MODULE_FLAGS.crm_pipeline && (
                <NavItem to="/crm" icon={BarChart2} label="CRM Pipeline" />
                )}
                {MODULE_FLAGS.amazon && (
                <NavItem to="/amazon" icon={Package} label="Amazon" />
                )}
                </>
                )}
                {canSeeFinance && MODULE_FLAGS.tax_management && (
                <NavItem to="/tax" icon={Calculator} label="Tax Management" />
                )}
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {showAgentsSection && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-400/80 px-4 py-2 mt-1 flex items-center gap-1.5">
                    <span>🤖</span> AI Agents
                </div>
                <div>
                    <SectionHeader label="Agents" isOpen={sections.agents} onClick={() => toggleSection('agents')} />
                    {sections.agents && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-blue-500/20 ml-2">
                            {MODULE_FLAGS.agent_hub && (
                            <NavItem to="/agents" icon={Bot} label="Agent Hub" />
                            )}
                            <NavItem to="/agents/customer-service" icon={Headphones} label="ARIA — Customer Service" />
                            <NavItem to="/agents/business-advisor" icon={Brain} label="Marcus — Advisor" />
                            {MODULE_FLAGS.email_auto_reply && (
                            <NavItem to="/agents/email-reply" icon={Mail} label="Email Auto-Reply" />
                            )}
                        </div>
                    )}
                </div>
                </>
                )}

                {MODULE_FLAGS.business_news && showNav('/news') && (
                <>
                <NewsTicker />
                <NavItem to="/news" icon={Newspaper} label="Business News" />
                </>
                )}

                {showMarketing && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-pink-400/80 px-4 py-2 mt-1 flex items-center gap-1.5">
                    <span>📣</span> Marketing
                </div>
                <div>
                    <SectionHeader label="AI Marketing" isOpen={sections.marketing} onClick={() => toggleSection('marketing')} />
                    {sections.marketing && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-pink-500/20 ml-2">
                            <NavItem to="/marketing" icon={Megaphone} label="Marketing Hub" />
                            <NavItem to="/marketing/studio" icon={Zap} label="AI Content Studio" />
                            <NavItem to="/marketing/segments" icon={Users} label="Customer Segments" />
                            <NavItem to="/marketing/campaigns" icon={Send} label="Campaign Manager" />
                            <NavItem to="/marketing/analytics" icon={BarChart2} label="Analytics" />
                        </div>
                    )}
                </div>
                </>
                )}

                {showVoiceSection && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400/80 px-4 py-2 mt-1 flex items-center gap-1.5">
                    <span>🎤</span> Soltol Voice
                </div>
                <div>
                    <SectionHeader label="Voice AI" isOpen={sections.voice} onClick={() => toggleSection('voice')} />
                    {sections.voice && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-emerald-500/20 ml-2">
                            {MODULE_FLAGS.voice_dashboard && (
                            <NavItem to="/voice/dashboard" icon={LayoutDashboard} label="Voice Dashboard" />
                            )}
                            <NavItem to="/voice/calls" icon={Headphones} label="Call History" />
                            {MODULE_FLAGS.voice_analytics && (
                            <NavItem to="/voice/analytics" icon={Activity} label="Voice Analytics" />
                            )}
                            {MODULE_FLAGS.voice_coaching_rules && (
                            <NavItem to="/voice/coaching-rules" icon={Brain} label="Coaching Rules" />
                            )}
                        </div>
                    )}
                </div>
                </>
                )}

                {showAiIntelligence && (
                <>
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-orange-400/80 px-4 py-2 mt-1 flex items-center gap-1.5">
                    <span>⚡</span> AI Intelligence
                </div>
                <div>
                    <SectionHeader
                        label="AI Features"
                        isOpen={sections.ai}
                        onClick={() => toggleSection('ai')}
                    />
                    {sections.ai && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-orange-500/20 ml-2">
                            <NavItem to="/ai/hub" icon={Brain} label="AI Hub" />
                            {MODULE_FLAGS.ai_intelligence_landing && (
                            <NavItem to="/ai" icon={Sparkles} label="AI Intelligence" />
                            )}
                            {MODULE_FLAGS.auto_po_generation && (
                            <NavItem to="/ai/auto-po" icon={ShoppingCart} label="Auto PO Generation" />
                            )}
                            {MODULE_FLAGS.anomaly_detection && (
                            <NavItem to="/ai/anomaly" icon={AlertTriangle} label="Anomaly Detection" />
                            )}
                            {MODULE_FLAGS.customer_forecast && (
                            <NavItem to="/ai/customer-forecast" icon={Users} label="Customer Forecast" />
                            )}
                            {MODULE_FLAGS.revenue_forecast && (
                            <NavItem to="/ai/revenue-forecast" icon={DollarSign} label="Revenue Forecast" />
                            )}
                        </div>
                    )}
                </div>
                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {canSeeAdmin && (
                <>
                <NavItem to="/settings" icon={Settings} label="Settings" />
                <NavItem to="/settings/users" icon={UserCheck} label="User Management" />
                </>
                )}

            </nav>

            <div className="p-4 border-t border-white/5 text-[10px] text-redwood-text-muted bg-redwood-midnight/50">
                {user && (
                    <div className="mb-3">
                        <p className="text-[11px] font-semibold text-white truncate">{user.full_name || user.username}</p>
                        <p className="text-[10px] uppercase tracking-wider opacity-80">{roleLabel}</p>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => window.location.href = '/settings/password'}
                    className="mb-2 flex w-full items-center justify-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-redwood-text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                    <Lock size={14} />
                    Change password
                </button>
                <button
                    type="button"
                    onClick={logout}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-sm border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-redwood-text-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                    <LogOut size={14} />
                    Logout
                </button>
                {user?.username === 'admin' && (
                    <NavItem to="/superadmin" icon={Shield} label="Super Admin" />
                )}
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="uppercase tracking-widest font-bold">SYSTEM UPDATED</span>
                </div>
                <p className="opacity-60">SOLTOL ONE v1.0</p>
            </div>
        </aside>
    );
}
