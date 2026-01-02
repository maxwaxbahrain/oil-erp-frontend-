import { useState } from 'react';
import {
    BarChart3, PieChart, TrendingUp, DollarSign,
    ArrowUpRight, ArrowDownRight, Activity, Calendar,
    Download, Target, Layers, Briefcase, Filter,
    Brain, Users
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, Pie, Legend
} from 'recharts';
import clsx from 'clsx';

// Type Definitions
type TabType = 'executive' | 'pl' | 'cashflow' | 'balance' | 'ratios' | 'dimensional';

export default function ProfitabilityReports() {
    const [activeTab, setActiveTab] = useState<TabType>('executive');

    // --- MOCK DATA START ---
    const kpiData = [
        { title: 'Net Profit', value: '$103,500', change: '+15% vs Nov', trend: 'up', status: 'success' },
        { title: 'Cash Balance', value: '$240,000', change: '+60% vs Nov', trend: 'up', status: 'success' },
        { title: 'Revenue', value: '$610,000', change: '+5.2% vs Nov', trend: 'up', status: 'success' },
        { title: 'Expenses', value: '$506,500', change: '+2.1% vs Nov', trend: 'down', status: 'warning' },
    ];

    const revenueTrendData = [
        { month: 'Jun', value: 450000 }, { month: 'Jul', value: 480000 },
        { month: 'Aug', value: 520000 }, { month: 'Sep', value: 500000 },
        { month: 'Oct', value: 550000 }, { month: 'Nov', value: 580000 },
        { month: 'Dec', value: 610000 },
    ];

    const expensesData = [
        { name: 'COGS', value: 250000, fill: '#C74634' },
        { name: 'Salaries', value: 120000, fill: '#FFAB00' },
        { name: 'Operating', value: 100000, fill: '#00758F' },
        { name: 'Tax', value: 34500, fill: '#637381' },
    ];

    const cashFlowData = [
        { name: 'Start', value: 150000, fill: '#637381' },
        { name: 'Oper.', value: 70000, fill: '#36B37E' },
        { name: 'Inv.', value: -15000, fill: '#FF5630' },
        { name: 'Fin.', value: 35000, fill: '#36B37E' },
        { name: 'End', value: 240000, fill: '#0052CC' },
    ];

    const balanceSheetData = [
        { name: 'Assets', Current: 550000, Fixed: 400000, Other: 80000 },
        { name: 'Liabilities', Current: 270000, LongTerm: 350000, Other: 0 },
    ];

    const assetCompositionData = [
        { name: 'Current', value: 550000, fill: '#00758F' },
        { name: 'Fixed', value: 400000, fill: '#C74634' },
        { name: 'Other', value: 80000, fill: '#FFAB00' }
    ];

    const cashFlowDetailed = [
        {
            category: 'Operating Activities', items: [
                { label: 'Cash from Customers', value: 500000 },
                { label: 'Cash Paid to Suppliers', value: -300000 },
                { label: 'Payroll', value: -100000 },
                { label: 'OpEx', value: -30000 },
            ], total: 70000
        },
        {
            category: 'Investing Activities', items: [
                { label: 'Purchase Equipment', value: -20000 },
                { label: 'Sale of Vehicle', value: 5000 },
            ], total: -15000
        },
        {
            category: 'Financing Activities', items: [
                { label: 'Bank Loan', value: 50000 },
                { label: 'Repayment', value: -10000 },
                { label: 'Dividends', value: -5000 },
            ], total: 35000
        }
    ];

    const ratioData = {
        margins: [
            { label: 'Gross Profit Margin', value: '59.0%', target: '60%', status: 'warning', formula: '(GP / Rev) * 100' },
            { label: 'Operating Margin', value: '23.6%', target: '20%', status: 'success', formula: '(Op. Profit / Rev) * 100' },
            { label: 'Net Profit Margin', value: '17.0%', target: '15%', status: 'success', formula: '(Net Profit / Rev) * 100' }
        ],
        returns: [
            { label: 'ROA (Assets)', value: '10.1%', sub: 'Return on Assets', status: 'success' },
            { label: 'ROE (Equity)', value: '25.2%', sub: 'Return on Equity', status: 'success' },
            { label: 'ROCE (Capital)', value: '18.5%', sub: 'Return on Cap. Emp.', status: 'success' }
        ],
        efficiency: [
            { label: 'Op. Expense Ratio', value: '36.0%', sub: 'OER', status: 'warning' },
            { label: 'Payroll Cost Ratio', value: '24.5%', sub: 'Payroll / Rev', status: 'success' },
            { label: 'Revenue per Emp', value: '$15,250', sub: 'Productivity', status: 'neutral' }
        ],
        ai_metrics: [
            { label: 'Profit Leakage', value: '$14,500', rate: '2.4%', text: 'Detected in unbilled services & dead stock', severity: 'high' },
            { label: 'Discount Impact', value: '$31,000', rate: '5.1%', text: 'High discounts given in Electronics category', severity: 'medium' }
        ]
    };

    const dimensionalData = {
        customers: [
            { name: 'Chevron Corp', revenue: 150000, profit: 45000, margin: 30.0, costToServe: 5000 },
            { name: 'Shell Oil', revenue: 120000, profit: 30000, margin: 25.0, costToServe: 8000 },
            { name: 'ExxonMobil', revenue: 200000, profit: 50000, margin: 25.0, costToServe: 12000 },
            { name: 'Small Guys LLC', revenue: 15000, profit: -2000, margin: -13.3, costToServe: 4000 }
        ],
        salesmen: [
            { name: 'John Doe', revenue: 200000, profit: 60000, visits: 20, margin: 30.0 },
            { name: 'Jane Smith', revenue: 350000, profit: 90000, visits: 35, margin: 25.7 }
        ],
        products: [
            { name: 'Industrial Lubricant A', revenue: 50000, profit: 25000, margin: 50.0 },
            { name: 'Hydraulic Fluid X', revenue: 80000, profit: 10000, margin: 12.5 },
            { name: 'Old Stock Z', revenue: 0, profit: -5000, margin: 0.0, note: 'Dead Stock' }
        ],
        channels: [
            { name: 'Direct Sales', profit: 120000, margin: 35.0 },
            { name: 'Distributors', profit: 80000, margin: 20.0 },
            { name: 'Online', profit: 5000, margin: 45.0 }
        ]
    };
    // --- MOCK DATA END ---

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
            {/* HEADER */}
            <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main tracking-tighter uppercase flex items-center gap-3">
                        <TrendingUp className="text-redwood-brand" size={28} />
                        Profitability & Financial Intelligence
                    </h1>
                    <p className="text-redwood-text-muted text-xs font-bold uppercase tracking-widest mt-2">
                        Comprehensive Reporting Suite • Tier 1 Financials
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-xs font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all flex items-center gap-2 uppercase tracking-widest">
                        <Calendar size={14} /> Dec 2024
                    </button>
                    <button className="px-6 py-2.5 bg-redwood-brand text-white rounded-sm text-xs font-black hover:bg-redwood-brand/90 transition-all flex items-center gap-2 uppercase tracking-widest shadow-lg">
                        <Download size={14} /> Export Report
                    </button>
                </div>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 border-b border-redwood-border pb-1">
                {[
                    { id: 'executive', label: 'Executive Dashboard', icon: Layers },
                    { id: 'pl', label: 'Profit & Loss (P&L)', icon: BarChart3 },
                    { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
                    { id: 'balance', label: 'Balance Sheet', icon: Briefcase },
                    { id: 'ratios', label: 'Financial Ratios', icon: Activity },
                    { id: 'dimensional', label: 'Detailed Dimensions', icon: Filter },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={clsx(
                            "px-6 py-3 rounded-t-sm text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border-t-2 border-x border-transparent",
                            activeTab === tab.id
                                ? "bg-white border-redwood-border border-b-white text-redwood-brand translate-y-[1px]"
                                : "bg-transparent text-redwood-text-muted hover:text-redwood-text-main hover:bg-redwood-bg-light"
                        )}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* CONTENT */}
            <div className="bg-white border border-redwood-border rounded-b-sm p-8 min-h-[600px] shadow-sm relative">
                {activeTab === 'executive' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {kpiData.map((kpi, i) => (
                                <div key={i} className="p-6 border border-redwood-border rounded-sm bg-redwood-bg-light/50 hover:bg-white transition-all hover:shadow-md group">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">{kpi.title}</span>
                                        <div className={clsx("p-1.5 rounded-full", kpi.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')}>
                                            {kpi.status === 'success' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        </div>
                                    </div>
                                    <div className="text-3xl font-black text-redwood-text-main tracking-tight mb-2">{kpi.value}</div>
                                    <div className={clsx("text-[11px] font-bold uppercase tracking-wide", kpi.status === 'success' ? 'text-emerald-600' : 'text-rose-600')}>
                                        {kpi.change}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-redwood-brand" /> Revenue Performance Trend
                                </h3>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={revenueTrendData}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#C74634" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#C74634" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DFE3E8" />
                                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#637381' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#637381' }} tickFormatter={(val) => `$${val / 1000}k`} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="value" stroke="#C74634" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-redwood-midnight text-white p-6 rounded-sm shadow-xl relative overflow-hidden group">
                                <h3 className="text-xs font-black text-white/80 uppercase tracking-widest mb-6 flex items-center gap-2 relative z-10">
                                    <Brain size={16} className="text-emerald-400" /> AI Strategic Insights
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    {[
                                        'Great month! Profit up 15%, sales growth 5.2%.',
                                        'Large payment ($80K) due Monday - ensure cash is ready.',
                                        'Johnson Inc ($15K) is 120+ days overdue - recommend immediate collections.',
                                        'Holiday season boosted product sales by 12%.'
                                    ].map((insight, i) => (
                                        <div key={i} className="flex gap-4">
                                            <div className="mt-1"><Target size={14} className="text-emerald-400" /></div>
                                            <p className="text-xs font-bold text-white leading-relaxed opacity-90">{insight}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'pl' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="border border-redwood-border rounded-sm overflow-hidden">
                            <div className="bg-redwood-bg-light p-4 border-b border-redwood-border">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest">Profit & Loss Statement - Dec 2024</h3>
                            </div>
                            <div className="p-6 space-y-4 text-sm font-medium text-redwood-text-main">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left border-collapse border border-redwood-border">
                                        <thead className="bg-redwood-bg-light text-redwood-text-muted uppercase text-[10px] font-black tracking-widest">
                                            <tr>
                                                <th className="p-3 border-b border-redwood-border">Category</th>
                                                <th className="p-3 border-b border-redwood-border text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-redwood-border">
                                            {/* Revenue */}
                                            <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 font-black text-[10px] uppercase text-redwood-brand tracking-widest">Revenue</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Product Sales</td><td className="p-2 text-right">$450,000</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Service Revenue</td><td className="p-2 text-right">$150,000</td></tr>
                                            <tr className="bg-emerald-50/50 font-bold"><td className="p-2 pl-4 text-emerald-800">TOTAL REVENUE</td><td className="p-2 text-right text-emerald-800">$610,000</td></tr>

                                            {/* COGS */}
                                            <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 font-black text-[10px] uppercase text-redwood-brand tracking-widest">Cost of Good Sold</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Raw Materials</td><td className="p-2 text-right">$180,000</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Direct Labor</td><td className="p-2 text-right">$50,000</td></tr>
                                            <tr className="bg-rose-50/50 font-bold"><td className="p-2 pl-4 text-rose-800">TOTAL COGS</td><td className="p-2 text-right text-rose-800">$250,000</td></tr>

                                            {/* Gross Profit */}
                                            <tr className="bg-redwood-midnight text-white font-black text-xs uppercase"><td className="p-3">GROSS PROFIT</td><td className="p-3 text-right">$360,000 (59%)</td></tr>

                                            {/* Expenses */}
                                            <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 font-black text-[10px] uppercase text-redwood-brand tracking-widest">Operating Expenses</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Salaries & Wages</td><td className="p-2 text-right">$120,000</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Marketing</td><td className="p-2 text-right">$25,000</td></tr>
                                            <tr className="hover:bg-redwood-bg-light/50"><td className="p-2 pl-4">Rent & Utilities</td><td className="p-2 text-right">$17,000</td></tr>
                                            <tr className="bg-amber-50/50 font-bold"><td className="p-2 pl-4 text-amber-800">TOTAL OPEX</td><td className="p-2 text-right text-amber-800">$220,000</td></tr>

                                            {/* Net Profit */}
                                            <tr className="bg-emerald-100 text-emerald-900 font-black text-sm border-t-2 border-emerald-500"><td className="p-4">NET PROFIT</td><td className="p-4 text-right">$103,500 (17%)</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm h-[300px]">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Expense Breakdown</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={expensesData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                                            {expensesData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                        <Legend />
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'cashflow' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Cash Flow Table */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-redwood-bg-light text-redwood-text-muted uppercase text-[10px] font-black tracking-widest">
                                        <tr><th colSpan={2} className="p-3 border-b border-redwood-border">Cash Flow Statement</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-redwood-border">
                                        <tr className="bg-redwood-bg-light/30"><td className="p-2 font-black pl-4">Opening Balance</td><td className="p-2 text-right font-black">$150,000</td></tr>
                                        {cashFlowDetailed.map((cat) => (
                                            <>
                                                <tr key={cat.category} className="bg-redwood-bg-light/10"><td colSpan={2} className="p-2 pl-4 font-bold text-redwood-brand uppercase text-[10px] tracking-wide mt-2">{cat.category}</td></tr>
                                                {cat.items.map((item, j) => (
                                                    <tr key={j} className="hover:bg-redwood-bg-light/50"><td className="p-1 pl-8 text-redwood-text-muted">{item.label}</td><td className="p-1 text-right">{item.value > 0 ? '+' : ''}{item.value.toLocaleString()}</td></tr>
                                                ))}
                                                <tr className="bg-gray-50 font-bold"><td className="p-2 pl-4">Net {cat.category.split(' ')[0]}</td><td className={clsx("p-2 text-right", cat.total > 0 ? 'text-emerald-600' : 'text-rose-600')}>{cat.total > 0 ? '+' : ''}{cat.total.toLocaleString()}</td></tr>
                                            </>
                                        ))}
                                        <tr className="bg-redwood-midnight text-white font-black text-sm"><td className="p-4">CLOSING BALANCE</td><td className="p-4 text-right text-emerald-400">$240,000</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Diagram Area */}
                            <div className="space-y-6">
                                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-sm">
                                    <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-2">Net Cash Change</h3>
                                    <div className="text-4xl font-black text-emerald-600">+$90,000</div>
                                </div>
                                <div className="h-[300px] bg-white border border-redwood-border rounded-sm p-6">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-6">Cash Flow Waterfall Diagram</h3>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={cashFlowData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                            <Tooltip />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {cashFlowData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                        <div className="h-[400px] bg-white border border-redwood-border rounded-sm p-6">
                            <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-6">Cash Flow Waterfall</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={cashFlowData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value">
                                        {cashFlowData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
                {activeTab === 'balance' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Balance Sheet Table */}
                            <div className="border border-redwood-border rounded-sm overflow-hidden bg-white">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-redwood-bg-light text-redwood-text-muted uppercase text-[10px] font-black tracking-widest">
                                        <tr><th className="p-3 border-b border-redwood-border">Item</th><th className="p-3 border-b border-redwood-border text-right">Value</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-redwood-border">
                                        {/* Assets */}
                                        <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 pl-4 font-black uppercase text-redwood-brand tracking-widest">Assets</td></tr>
                                        <tr><td className="p-2 pl-8">Current Assets (Cash, AR)</td><td className="p-2 text-right">$550,000</td></tr>
                                        <tr><td className="p-2 pl-8">Fixed Assets (Property, Equipment)</td><td className="p-2 text-right">$400,000</td></tr>
                                        <tr><td className="p-2 pl-8">Other Assets</td><td className="p-2 text-right">$80,000</td></tr>
                                        <tr className="bg-emerald-50 font-black"><td className="p-2 pl-4 text-emerald-800">TOTAL ASSETS</td><td className="p-2 text-right text-emerald-800">$1,030,000</td></tr>

                                        {/* Liabilities */}
                                        <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 pl-4 font-black uppercase text-redwood-brand tracking-widest">Liabilities</td></tr>
                                        <tr><td className="p-2 pl-8">Current Liabilities (AP, Short-term)</td><td className="p-2 text-right">$270,000</td></tr>
                                        <tr><td className="p-2 pl-8">Long-Term Liabilities (Loans)</td><td className="p-2 text-right">$350,000</td></tr>
                                        <tr className="bg-rose-50 font-black"><td className="p-2 pl-4 text-rose-800">TOTAL LIABILITIES</td><td className="p-2 text-right text-rose-800">$620,000</td></tr>

                                        {/* Equity */}
                                        <tr className="bg-redwood-bg-light/30"><td colSpan={2} className="p-2 pl-4 font-black uppercase text-redwood-brand tracking-widest">Equity</td></tr>
                                        <tr><td className="p-2 pl-8">Owner's Capital</td><td className="p-2 text-right">$300,000</td></tr>
                                        <tr><td className="p-2 pl-8">Retained Earnings</td><td className="p-2 text-right">$110,000</td></tr>
                                        <tr className="bg-blue-50 font-black"><td className="p-2 pl-4 text-blue-800">TOTAL EQUITY</td><td className="p-2 text-right text-blue-800">$410,000</td></tr>

                                        <tr className="bg-redwood-midnight text-white font-black"><td className="p-3 uppercase">Total Liab. & Equity</td><td className="p-3 text-right">$1,030,000</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Charts */}
                            <div className="space-y-6">
                                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Financial Position</h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={balanceSheetData} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                                <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                                <Tooltip />
                                                <Legend />
                                                <Bar dataKey="Current" stackId="a" fill="#00758F" />
                                                <Bar dataKey="Fixed" stackId="a" fill="#C74634" />
                                                <Bar dataKey="Other" stackId="a" fill="#FFAB00" />
                                                <Bar dataKey="LongTerm" stackId="a" fill="#36B37E" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                    <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Asset Composition</h3>
                                    <div className="h-[250px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={assetCompositionData} innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value" label>
                                                    {assetCompositionData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                    ))}
                                                </Pie>
                                                <Legend />
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'ratios' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        {/* Core Margins */}
                        <div>
                            <h3 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-4 flex items-center gap-2"><Target size={14} /> Core Profitability Ratios</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {ratioData.margins.map((m, i) => (
                                    <div key={i} className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm border-l-4 border-l-redwood-brand">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-redwood-text-muted">{m.label}</span>
                                            <div className={clsx("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase", m.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>Target: {m.target}</div>
                                        </div>
                                        <div className="text-3xl font-black text-redwood-text-main mb-1">{m.value}</div>
                                        <div className="text-[10px] text-redwood-text-muted/70 font-mono bg-redwood-bg-light inline-block px-1 rounded">{m.formula}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Returns & Efficiency */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Return Ratios */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-redwood-border pb-2">
                                    <Briefcase size={14} className="text-emerald-600" /> Return Based Profitability
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {ratioData.returns.map((r, i) => (
                                        <div key={i} className="text-center p-4 bg-redwood-bg-light/30 rounded-sm">
                                            <div className="text-2xl font-black text-emerald-700 mb-1">{r.value}</div>
                                            <div className="text-[10px] font-bold uppercase text-redwood-text-muted tracking-wider">{r.label}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-6 p-4 bg-emerald-50 rounded-sm border border-emerald-100">
                                    <p className="text-xs text-emerald-800 font-medium leading-relaxed">
                                        <span className="font-black uppercase">Investor Note:</span> ROE of 25.2% indicates exceptional efficiency in using shareholder equity.
                                    </p>
                                </div>
                            </div>

                            {/* Efficiency Ratios */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-muted uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-redwood-border pb-2">
                                    <Activity size={14} className="text-blue-600" /> Operational Efficiency
                                </h3>
                                <div className="space-y-4">
                                    {ratioData.efficiency.map((e, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 hover:bg-redwood-bg-light rounded-sm transition-colors cursor-default">
                                            <div>
                                                <div className="text-[11px] font-black uppercase text-redwood-text-main tracking-wide">{e.label}</div>
                                                <div className="text-[10px] text-redwood-text-muted">{e.sub}</div>
                                            </div>
                                            <div className="text-xl font-bold text-redwood-brand">{e.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* AI Metrics */}
                        <div className="bg-redwood-midnight text-white rounded-sm p-8 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-10 opacity-5"><Brain size={200} /></div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 relative z-10 flex items-center gap-3">
                                <Brain className="text-emerald-400" /> AI-Enhanced Profit Intelligence
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                {ratioData.ai_metrics.map((metric, i) => (
                                    <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-sm hover:bg-white/10 transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-xs font-bold text-white/70 uppercase tracking-widest">{metric.label}</div>
                                            <div className={clsx("w-2 h-2 rounded-full animate-pulse", metric.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500')}></div>
                                        </div>
                                        <div className="flex items-end gap-3 mb-2">
                                            <div className="text-3xl font-black text-white">{metric.value}</div>
                                            <div className={clsx("text-sm font-bold mb-1", metric.severity === 'high' ? 'text-rose-400' : 'text-amber-400')}>{metric.rate}</div>
                                        </div>
                                        <p className="text-xs text-white/60 font-medium leading-relaxed">{metric.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'dimensional' && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-2 duration-500">
                        {/* Dimensions Header */}
                        <div className="flex justify-between items-center bg-redwood-bg-light p-4 rounded-sm border border-redwood-border">
                            <h2 className="text-sm font-black text-redwood-text-main uppercase tracking-widest flex items-center gap-2">
                                <Filter size={16} className="text-redwood-brand" /> Profitability by Dimension
                            </h2>
                            <div className="text-xs text-redwood-text-muted">Analysis: Who, What, Where, Why</div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Customer Profitability */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <div className="bg-redwood-bg-light/50 p-3 border-b border-redwood-border flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-redwood-text-muted">Customer Profitability (Top & Bottom)</h3>
                                    <Users size={14} className="text-redwood-text-muted" />
                                </div>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                                        <tr><th className="p-3">Customer</th><th className="p-3 text-right">Revenue</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Margin</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {dimensionalData.customers.map((c, i) => (
                                            <tr key={i} className="hover:bg-redwood-bg-light/30">
                                                <td className="p-3 font-bold text-redwood-text-main flex flex-col">
                                                    <span>{c.name}</span>
                                                    <span className="text-[9px] text-gray-400 font-normal">Cost-to-Serve: ${c.costToServe}</span>
                                                </td>
                                                <td className="p-3 text-right">${c.revenue.toLocaleString()}</td>
                                                <td className={clsx("p-3 text-right font-bold", c.profit > 0 ? 'text-emerald-600' : 'text-rose-600')}>${c.profit.toLocaleString()}</td>
                                                <td className={clsx("p-3 text-right font-bold", c.margin > 20 ? 'text-emerald-600' : c.margin < 0 ? 'text-rose-600' : 'text-amber-600')}>{c.margin.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Salesman Performance */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <div className="bg-redwood-bg-light/50 p-3 border-b border-redwood-border flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-redwood-text-muted">Salesman Performance</h3>
                                    <Users size={14} className="text-redwood-text-muted" />
                                </div>
                                <div className="p-4 space-y-4">
                                    {dimensionalData.salesmen.map((s, i) => (
                                        <div key={i} className="flex flex-col gap-2 p-3 border border-redwood-border rounded-sm">
                                            <div className="flex justify-between font-black text-sm text-redwood-text-main">
                                                <span>{s.name}</span>
                                                <span className="text-emerald-600">${s.profit.toLocaleString()} Profit</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-redwood-text-muted">
                                                <span>Revenue: ${s.revenue.toLocaleString()}</span>
                                                <span>Margin: {s.margin.toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1">
                                                <div className="bg-redwood-brand h-1.5 rounded-full" style={{ width: `${s.margin}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Product/SKU Profitability */}
                            <div className="bg-white border border-redwood-border rounded-sm overflow-hidden">
                                <div className="bg-redwood-bg-light/50 p-3 border-b border-redwood-border flex justify-between items-center">
                                    <h3 className="text-xs font-black uppercase text-redwood-text-muted">Product & SKU Insights</h3>
                                    <Briefcase size={14} className="text-redwood-text-muted" />
                                </div>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                                        <tr><th className="p-3">Product</th><th className="p-3 text-right">Profit</th><th className="p-3 text-right">Margin</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {dimensionalData.products.map((p, i) => (
                                            <tr key={i} className={clsx("hover:bg-redwood-bg-light/30", p.note ? 'bg-rose-50' : '')}>
                                                <td className="p-3 font-bold text-redwood-text-main">
                                                    {p.name}
                                                    {p.note && <span className="ml-2 text-[9px] bg-rose-200 text-rose-800 px-1 py-0.5 rounded uppercase tracking-wider">{p.note}</span>}
                                                </td>
                                                <td className={clsx("p-3 text-right", p.profit > 0 ? 'text-emerald-600' : 'text-rose-600')}>${p.profit.toLocaleString()}</td>
                                                <td className="p-3 text-right font-mono">{p.margin.toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Channel Profit */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm">
                                <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Channel Profit Mix</h3>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dimensionalData.channels} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} tick={{ fontSize: 10 }} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                            <Tooltip />
                                            <Bar dataKey="profit" name="Profit" fill="#00758F" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
