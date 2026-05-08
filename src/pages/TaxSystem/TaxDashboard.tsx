import {
    Activity, Calendar, CheckCircle, AlertCircle, Map
} from 'lucide-react';
import clsx from 'clsx';

export default function TaxDashboard() {
    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Activity className="text-redwood-brand" /> Tax Dashboard
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        USA • Federal & State • Dec 30, 2024
                    </p>
                </div>
                <div className="flex gap-2">
                    <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-sm text-xs font-black uppercase flex items-center gap-2">
                        <CheckCircle size={14} /> AI Tax Status: All Systems Operational
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Sales Tax Collected</div>
                        <div className="text-3xl font-black text-redwood-text-main mt-1">$3,450</div>
                        <div className="text-xs font-bold text-gray-400 mt-2">Today</div>
                    </div>
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Payroll Tax</div>
                        <div className="text-3xl font-black text-blue-600 mt-1">$12,500</div>
                        <div className="text-xs font-bold text-gray-400 mt-2">Today</div>
                    </div>
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Income Tax</div>
                        <div className="text-3xl font-black text-purple-600 mt-1">$8,900</div>
                        <div className="text-xs font-bold text-gray-400 mt-2">Accrued Today</div>
                    </div>
                    <div className="bg-white p-6 rounded-sm border border-redwood-border shadow-sm">
                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Liability (Est)</div>
                        <div className="text-3xl font-black text-redwood-brand mt-1">$24,850</div>
                        <div className="text-xs font-bold text-gray-400 mt-2">Current Period</div>
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-3 gap-6">

                    {/* Upcoming Deadlines */}
                    <div className="col-span-2 bg-white border border-redwood-border rounded-sm p-6">
                        <h3 className="text-sm font-black uppercase text-redwood-text-main mb-6 flex items-center gap-2">
                            <Calendar size={16} className="text-redwood-brand" /> Upcoming Tax Deadlines (Next 30 Days)
                        </h3>
                        <div className="space-y-4">
                            {[
                                { date: 'Jan 15, 2025', title: 'Q4 Estimated Tax', type: 'Federal & State Income Tax', amount: '$35,600', status: 'Ready to Auto-Pay', color: 'emerald' },
                                { date: 'Jan 20, 2025', title: 'December Sales Tax', type: 'All States (10 states)', amount: '$18,450', status: 'Calculating...', color: 'amber' },
                                { date: 'Jan 31, 2025', title: 'Payroll Tax (Q4)', type: 'Form 941 - Federal Quarterly', amount: '$48,200', status: 'Ready to Auto-File', color: 'emerald' },
                                { date: 'Jan 31, 2025', title: 'W-2 Forms', type: 'Employee Annual Wage Statements', amount: '50 Employees', status: 'Generated', color: 'blue' },
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-4 p-4 border border-gray-100 rounded-sm hover:bg-gray-50 transition-colors">
                                    <div className="bg-gray-100 px-3 py-2 rounded text-center min-w-[80px]">
                                        <div className="text-[10px] font-black uppercase text-gray-500">{item.date.split(' ')[0]}</div>
                                        <div className="text-lg font-black text-gray-800">{item.date.split(' ')[1].replace(',', '')}</div>
                                        <div className="text-[10px] font-bold text-gray-400">{item.date.split(' ')[2]}</div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-black text-redwood-text-main">{item.title}</div>
                                                <div className="text-xs text-gray-600">{item.type}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-gray-800">{item.amount}</div>
                                                <div className={clsx("text-[10px] font-bold uppercase mt-1",
                                                    item.color === 'emerald' ? 'text-emerald-600' :
                                                        item.color === 'amber' ? 'text-amber-600' : 'text-blue-600'
                                                )}>
                                                    {item.status}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <button className="px-3 py-1 border border-gray-200 rounded-sm text-[10px] font-bold uppercase hover:bg-white bg-gray-50">Review</button>
                                            <button className="px-3 py-1 bg-redwood-brand text-white border border-redwood-brand rounded-sm text-[10px] font-bold uppercase hover:bg-redwood-brand/90">
                                                {item.status.includes('Pay') ? 'Auto-Pay' : item.status.includes('File') ? 'Auto-File' : 'View Details'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Side Panel: Nexus & Actions */}
                    <div className="space-y-6">
                        {/* Company Info */}
                        <div className="bg-white border border-redwood-border rounded-sm p-6">
                            <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Company Profile</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Business Name</span>
                                    <span className="font-bold">ABC Corporation</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Entity Type</span>
                                    <span className="font-bold">C-Corporation</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">EIN</span>
                                    <span className="font-mono font-bold">12-3456789</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Primary State</span>
                                    <span className="font-bold">New York</span>
                                </div>
                            </div>
                        </div>

                        {/* Nexus Monitor */}
                        <div className="bg-white border border-redwood-border rounded-sm p-6">
                            <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4 flex items-center gap-2">
                                <Map size={14} /> Nexus Monitor
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span>States with Nexus</span>
                                        <span className="text-emerald-600">15 / 50</span>
                                    </div>
                                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full w-[30%]"></div>
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded text-xs">
                                    <div className="font-bold text-amber-800 uppercase mb-1 flex items-center gap-1">
                                        <AlertCircle size={10} /> Near Threshold
                                    </div>
                                    <div className="text-amber-700">Approaching economic nexus in <span className="font-bold">CA, TX, FL</span>.</div>
                                </div>
                                <button className="w-full py-2 border border-gray-200 text-xs font-bold uppercase rounded hover:bg-gray-50">View Nexus Map</button>
                            </div>
                        </div>

                        {/* Recent Auto Actions */}
                        <div className="bg-white border border-redwood-border rounded-sm p-6">
                            <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-4">Automated Actions Today</h3>
                            <ul className="space-y-2">
                                {[
                                    'Calculated tax on 245 sales transactions',
                                    'Processed payroll taxes for 50 employees',
                                    'Updated rates for 3 states (CA, TX, FL)',
                                    'Generated 15 tax-compliant invoices'
                                ].map((action, i) => (
                                    <li key={i} className="text-xs flex items-start gap-2 text-gray-600">
                                        <CheckCircle size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                        {action}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
