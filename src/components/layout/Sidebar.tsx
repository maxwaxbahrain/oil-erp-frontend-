import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import NewsTicker from '../NewsTicker';
import { useAuth } from '../../contexts/AuthContext';
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
, Tag , BookOpen , AlertTriangle , Brain , ShoppingCart , DollarSign , Bot , Headphones , Shield , Newspaper , Megaphone , Zap , Send , Calculator  , Database , Receipt , Upload , CheckCircle2 , Mail , LogOut , Sparkles , Lock , Activity } from 'lucide-react';
import clsx from 'clsx';
import { getCompanyProfile } from '../../services/settingsService';


export default function Sidebar({
    openGroups: _openGroups,
    onToggleGroup: _onToggleGroup,
}: {
    openGroups?: Record<string, boolean>;
    onToggleGroup?: (key: string) => void;
} = {}) {
    const location = useLocation();
    const { user, hasRole, logout } = useAuth();

    const canSeeFinance = hasRole('admin', 'accountant');
    const canSeeDeliveries = hasRole('admin', 'manager', 'driver');
    const canSeeSales = hasRole('admin', 'manager', 'sales');
    const canSeeInventory = hasRole('admin', 'manager');
    const canSeeAdmin = hasRole('admin');

    const roleLabel = user?.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : 'User';
    // State for collapsible sections
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
        const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
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
                <span className="text-[12px] font-semibold tracking-wide">{label}</span>
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

    return (
        <aside className="w-[260px] bg-redwood-midnight text-white flex flex-col z-40 border-r border-white/5 shadow-2xl h-full print:hidden">
            {/* Sidebar Header */}
            <div className="h-[64px] flex items-center px-4 border-b border-white/5 bg-redwood-midnight/50 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3 w-full">
                    {/* SOLTOL ONE Logo */}
                    <div className="w-9 h-9 bg-redwood-brand rounded-sm flex items-center justify-center text-white font-black text-sm shadow-lg rotate-3 flex-shrink-0">
                        <span className="drop-shadow-sm">S</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                        {/* Software brand — always fixed */}
                        <span className="text-[11px] font-black tracking-widest leading-none text-redwood-brand uppercase">SOLTOL ONE</span>
                        {/* Client company name — changes per customer */}
                        <span className="text-[13px] font-black tracking-tight leading-tight text-white uppercase truncate mt-0.5">{getCompanyProfile().name || 'Your Company'}</span>
                    </div>
                </div>
            </div>

            {/* Navigation Content */}
            <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto scrollbar-hide pb-10">

                {/* CORE */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-1">
                    Core
                </div>
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/pulse/notes" icon={FileText} label="Meeting Notes" />
                <NavItem to="/migrate" icon={Database} label="📥 Data Migration" />
                <NavItem to="/portal" icon={User} label="Employee Portal" />

                <div className="h-px bg-white/5 my-3 mx-2" />

                {canSeeSales && (
                <>
                {/* SALES */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Sales
                </div>
                <NavItem to="/customers" icon={Users} label="Customers" />
                <NavItem to="/credit" icon={Shield} label="Credit Intelligence" />
                <NavItem to="/crm" icon={BarChart2} label="CRM Pipeline" />
                <NavItem to="/sales/orders" icon={FileText} label="Orders" />
                <NavItem to="/amazon" icon={Package} label="Amazon" />

                <div>
                    <SectionHeader
                        label="Sales Orders"
                        isOpen={sections.sales}
                        onClick={() => toggleSection('sales')}
                    />
                    {sections.sales && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            <NavItem to="/sales/quotations" icon={FileText} label="Quotations" />
                            {/* POD moved to Logistics */}
                            <NavItem to="/sales/invoices" icon={FileText} label="Invoices" />
                            <NavItem to="/sales/returns" icon={RefreshCw} label="Sales Returns" />
                            <NavItem to="/sales/credit-notes" icon={FileText} label="Credit Notes" />
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {canSeeDeliveries && (
                <>
                {/* LOGISTICS */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Logistics & Delivery
                </div>
                <NavItem to="/logistics/pod" icon={BarChart2} label="POD - Driver App" />
                <NavItem to="/logistics/operations" icon={Truck} label="Van Operations" />
                <NavItem to="/logistics/routes" icon={MapPin} label="Route Navigator" />

                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {canSeeInventory && (
                <>
                {/* PRODUCTS & INVENTORY */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Inventory Control
                </div>


                <div>
                    <SectionHeader
                        label="Product & Catalog"
                        isOpen={sections.products}
                        onClick={() => toggleSection('products')}
                    />
                    {sections.products && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-white/5 ml-2">
                            <NavItem to="/products" icon={Package} label="Product Catalog" />
                            <NavItem to="/products/reports" icon={PieChart} label="Inventory Reports" />
                <NavItem to="/inventory/adjustments" icon={Package} label="Stock Adjustment" />
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {/* PURCHASE */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Procurement
                </div>
                <NavItem to="/purchases/suppliers" icon={Users} label="Suppliers" />

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
                            <NavItem to="/receiving/new" icon={Truck} label="Material Receipt (GRN)" />
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 my-3 mx-2" />

                {canSeeFinance && (
                <>
                {/* FINANCE */}
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
                            <NavItem to="/finance/payroll" icon={Users} label="Payroll" />
                            <NavItem to="/finance/accounting" icon={Briefcase} label="Accounting" />
                        </div>
                    )}
                </div>

                {/* TASK 1 — Expenses module as its own collapsible with all sub-pages
                    visible. Matches the Sales Orders / Purchase Orders pattern. */}
                <div>
                    <SectionHeader
                        label="Expenses"
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

                <NavItem to="/finance/banking" icon={Globe} label="Banking" />
                <NavItem to="/finance/chart-of-accounts" icon={BookOpen} label="Chart of Accounts" />
                {/* ITEM 11 — Central All-Accounts Ledger. */}
                <NavItem to="/finance/all-ledger" icon={BookOpen} label="All-Accounts Ledger" />
                {/* TC-69 — Financial Statement (P&L, Balance Sheet, Cash Flow). */}
                <NavItem to="/finance/financial-statement" icon={FileText} label="Financial Statement" />
                <NavItem to="/finance/journal-voucher" icon={FileText} label="Journal Voucher (JV)" />
                <NavItem to="/finance/bad-debts" icon={AlertTriangle} label="Bad Debts Write-Off" />
                {/* ITEM 13 — Edit Payments sidebar link removed. Edits are
                    now initiated from per-row Edit buttons in the Customer
                    Payments tab; the PaymentEdit route remains as a
                    deep-link target (/finance/payment-edit?id=<paymentId>). */}
                <NavItem to="/tax" icon={Calculator} label="Tax Management" />

                <div className="h-px bg-white/5 my-3 mx-2" />
                </>
                )}

                {/* REPORTS */}
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
                            <NavItem to="/reports" icon={BarChart2} label="All Reports" />
                            <NavItem to="/reports/financial" icon={PieChart} label="Financial Statements" />
                        </div>
                    )}
                </div>

                <NavItem to="/reports/sales" icon={TrendingUp} label="Profitability Reports" />
                <NavItem to="/sales/price-lists" icon={Tag} label="Customer Price Lists" />
                <NavItem to="/sales/recurring" icon={RefreshCw} label="Recurring Invoices" />

                <div className="h-px bg-white/5 my-3 mx-2" />

                {/* AGENTS */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-blue-400/80 px-4 py-2 mt-1 flex items-center gap-1.5">
                    <span>🤖</span> AI Agents
                </div>
                <div>
                    <SectionHeader label="Agents" isOpen={sections.agents} onClick={() => toggleSection('agents')} />
                    {sections.agents && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-blue-500/20 ml-2">
                            <NavItem to="/agents" icon={Bot} label="Agent Hub" />
                            <NavItem to="/agents/customer-service" icon={Headphones} label="ARIA — Customer Service" />
                            <NavItem to="/agents/business-advisor" icon={Brain} label="Marcus — Advisor" />
                            <NavItem to="/agents/email-reply" icon={Mail} label="Email Auto-Reply" />
                        </div>
                    )}
                </div>

                {/* NEWS */}
                <NewsTicker />
                <NavItem to="/news" icon={Newspaper} label="Business News" />

                {/* MARKETING */}
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

                {/* SOLTOL VOICE */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400/80 px-4 py-2 mt-1 flex items-center gap-1.5">
                    <span>🎤</span> Soltol Voice
                </div>
                <div>
                    <SectionHeader label="Voice AI" isOpen={sections.voice} onClick={() => toggleSection('voice')} />
                    {sections.voice && (
                        <div className="space-y-0.5 pl-2 border-l-2 border-emerald-500/20 ml-2">
                            <NavItem to="/voice/dashboard" icon={LayoutDashboard} label="Voice Dashboard" />
                            <NavItem to="/voice/calls" icon={Headphones} label="Call History" />
                            <NavItem to="/voice/analytics" icon={Activity} label="Voice Analytics" />
                            <NavItem to="/voice/coaching-rules" icon={Brain} label="Coaching Rules" />
                            <NavItem to="/voice/onboard" icon={Briefcase} label="Onboard Tenant" />
                        </div>
                    )}
                </div>

                {/* AI INTELLIGENCE */}
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
                            <NavItem to="/ai" icon={Sparkles} label="AI Intelligence" />
                            <NavItem to="/ai/auto-po" icon={ShoppingCart} label="Auto PO Generation" />
                            <NavItem to="/ai/anomaly" icon={AlertTriangle} label="Anomaly Detection" />
                            <NavItem to="/ai/customer-forecast" icon={Users} label="Customer Forecast" />
                            <NavItem to="/ai/revenue-forecast" icon={DollarSign} label="Revenue Forecast" />
                            <NavItem to="/reports/demand-forecast" icon={TrendingUp} label="Demand Forecast" />
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 my-3 mx-2" />

                {canSeeAdmin && (
                <>
                {/* SETTINGS (at bottom) */}
                <NavItem to="/access-management" icon={Shield} label="User Access Management" />
                <NavItem to="/settings" icon={Settings} label="Settings" />
                <NavItem to="/settings/users" icon={UserCheck} label="User Management" />
                </>
                )}

            </nav>

            {/* Footer Info */}
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
