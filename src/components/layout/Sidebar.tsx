import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    Truck,
    BarChart2,
    FileText,
    Users,
    Wallet,
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
, Tag , BookOpen , AlertTriangle , Edit2 , Brain , ShoppingCart , DollarSign } from 'lucide-react';
import clsx from 'clsx';
import { getCompanyProfile } from '../../services/settingsService';


export default function Sidebar() {
    const location = useLocation();

    // State for collapsible sections
    const [sections, setSections] = useState<{ [key: string]: boolean }>({
        sales: true,
        purchase: true,
        products: true,
        finance: false,
        reports: false,
        ai: true
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
        <aside className="w-[260px] bg-redwood-midnight text-white flex flex-col z-40 border-r border-white/5 shadow-2xl h-full">
            {/* Sidebar Header */}
            <div className="h-[64px] flex items-center px-6 border-b border-white/5 bg-redwood-midnight/50 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-redwood-brand rounded-sm flex items-center justify-center text-white font-bold text-lg shadow-lg rotate-3">
                        <span className="drop-shadow-sm">{(getCompanyProfile().name || 'E')[0].toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[14px] font-black tracking-tight leading-none text-white uppercase italic">{getCompanyProfile().name || 'ERP System'}</span>
                        <span className="text-[9px] text-redwood-brand font-black uppercase tracking-[0.2em] mt-0.5">{(getCompanyProfile() as any).category || 'Distribution'}</span>
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
                <NavItem to="/portal" icon={User} label="Employee Portal" />

                <div className="h-px bg-white/5 my-3 mx-2" />

                {/* SALES */}
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
                            {/* POD moved to Logistics */}
                            <NavItem to="/sales/invoices" icon={FileText} label="Invoices" />
                            <NavItem to="/sales/returns" icon={RefreshCw} label="Sales Returns" />
                            <NavItem to="/sales/credit-notes" icon={FileText} label="Credit Notes" />
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 my-3 mx-2" />

                {/* LOGISTICS */}
                <div className="text-[9px] font-black uppercase tracking-[0.25em] text-redwood-secondary/60 px-4 py-2 mt-3">
                    Logistics & Delivery
                </div>
                <NavItem to="/logistics/pod" icon={BarChart2} label="POD - Driver App" />
                <NavItem to="/logistics/operations" icon={Truck} label="Van Operations" />
                <NavItem to="/logistics/routes" icon={MapPin} label="Route Navigator" />

                <div className="h-px bg-white/5 my-3 mx-2" />

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
                            <NavItem to="/finance/expenses" icon={Wallet} label="Expenses" />
                            <NavItem to="/finance/payroll" icon={Users} label="Payroll" />
                            <NavItem to="/finance/accounting" icon={Briefcase} label="Accounting" />
                        </div>
                    )}
                </div>

                <NavItem to="/finance/banking" icon={Globe} label="Banking" />
                <NavItem to="/finance/chart-of-accounts" icon={BookOpen} label="Chart of Accounts" />
                <NavItem to="/finance/journal-voucher" icon={FileText} label="Journal Voucher (JV)" />
                <NavItem to="/finance/bad-debts" icon={AlertTriangle} label="Bad Debts Write-Off" />
                <NavItem to="/finance/payment-edit" icon={Edit2} label="Edit Payments" />

                <div className="h-px bg-white/5 my-3 mx-2" />

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
                <NavItem to="/reports/demand-forecast" icon={TrendingUp} label="Demand Forecast" />
                <NavItem to="/sales/price-lists" icon={Tag} label="Customer Price Lists" />
                <NavItem to="/sales/recurring" icon={RefreshCw} label="Recurring Invoices" />

                <div className="h-px bg-white/5 my-3 mx-2" />

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
                            <NavItem to="/ai" icon={Brain} label="AI Hub" />
                            <NavItem to="/ai/auto-po" icon={ShoppingCart} label="Auto PO Generation" />
                            <NavItem to="/ai/anomaly" icon={AlertTriangle} label="Anomaly Detection" />
                            <NavItem to="/ai/customer-forecast" icon={Users} label="Customer Forecast" />
                            <NavItem to="/ai/revenue-forecast" icon={DollarSign} label="Revenue Forecast" />
                            <NavItem to="/reports/demand-forecast" icon={TrendingUp} label="Demand Forecast" />
                        </div>
                    )}
                </div>

                <div className="h-px bg-white/5 my-3 mx-2" />

                {/* SETTINGS (at bottom) */}
                <NavItem to="/settings" icon={Settings} label="Settings" />
                <NavItem to="/settings/users" icon={UserCheck} label="User Management" />

            </nav>

            {/* Footer Info */}
            <div className="p-4 border-t border-white/5 text-[10px] text-redwood-text-muted bg-redwood-midnight/50">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="uppercase tracking-widest font-bold">SYSTEM UPDATED</span>
                </div>
                <p className="opacity-60">v2.5.0 Professional</p>
            </div>
        </aside>
    );
}
