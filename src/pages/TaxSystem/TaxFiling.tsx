import {
    FileText, Download, Calendar, UploadCloud,
    Shield
} from 'lucide-react';
import clsx from 'clsx';

const FILINGS = [
    { id: 'F941-Q4', form: 'Form 941', name: 'Quarterly Federal Tax Return', date: 'Jan 31, 2025', period: 'Q4 2024', status: 'Ready to File', amount: 227250, type: 'Federal' },
    { id: 'W2-2024', form: 'Form W-2', name: 'Wage and Tax Statement', date: 'Jan 31, 2025', period: '2024', status: 'Generated', amount: 0, type: 'Federal' },
    { id: 'NY-ST-Q4', form: 'NY ST-100', name: 'NY State Sales Tax', date: 'Jan 20, 2025', period: 'Q4 2024', status: 'Processing', amount: 18450, type: 'State' },
    { id: 'F1120-24', form: 'Form 1120', name: 'U.S. Corporation Income Tax', date: 'Mar 15, 2025', period: '2024', status: 'Drafting', amount: 256702, type: 'Federal' },
];

export default function TaxFiling() {
    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <UploadCloud className="text-redwood-brand" /> Tax Filing Center
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Automated Returns • Federal & State • E-File
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white border border-redwood-border rounded-sm text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-gray-50">
                        <Calendar size={14} /> Filing Calendar
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

                {/* Stats */}
                <div className="grid grid-cols-4 gap-6 mb-8">
                    {[
                        { label: 'Pending Filings', value: '4', color: 'text-blue-600' },
                        { label: 'Forms Filed (YTD)', value: '28', color: 'text-emerald-600' },
                        { label: 'Next Deadline', value: '3 Days', color: 'text-amber-600' },
                        { label: 'E-File Status', value: 'Connected', color: 'text-emerald-600' }
                    ].map(stat => (
                        <div key={stat.label} className="bg-white border border-redwood-border p-4 rounded-sm shadow-sm">
                            <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{stat.label}</div>
                            <div className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Automation Promo */}
                <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-sm p-6 mb-8 text-white flex justify-between items-center shadow-lg">
                    <div>
                        <h2 className="text-lg font-black uppercase mb-2 flex items-center gap-2">
                            <Shield size={20} className="text-blue-300" /> Automated Compliance Active
                        </h2>
                        <p className="text-sm opacity-80 max-w-xl">
                            Your system is configured to automatically prepare and e-file federal and state forms. All returns typically undergo a 3-step AI verification process before submission.
                        </p>
                    </div>
                    <button className="bg-white text-blue-900 px-6 py-3 rounded-sm font-black uppercase text-xs tracking-wider shadow hover:bg-blue-50">
                        View Audit Log
                    </button>
                </div>

                {/* Filings List */}
                <div className="bg-white border border-redwood-border rounded-sm shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-redwood-border bg-gray-50 flex justify-between items-center">
                        <h3 className="font-black text-sm uppercase text-gray-500 tracking-widest">Upcoming Filings queue</h3>
                        <div className="flex gap-2">
                            <select className="px-3 py-1 bg-white border border-gray-200 rounded-sm text-xs font-bold uppercase text-gray-600">
                                <option>All Types</option>
                                <option>Federal</option>
                                <option>State</option>
                            </select>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {FILINGS.map(filing => (
                            <div key={filing.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                <div className="flex items-start gap-4">
                                    <div className="bg-gray-100 p-3 rounded flex flex-col items-center justify-center min-w-[60px]">
                                        <FileText size={20} className="text-gray-400 mb-1" />
                                        <span className="text-[10px] font-black font-mono text-gray-500 uppercase">{filing.form}</span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-black text-redwood-text-main text-lg">{filing.name}</h4>
                                            <span className={clsx("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                                filing.type === 'Federal' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                            )}>{filing.type}</span>
                                        </div>
                                        <div className="flex gap-4 mt-1 text-xs text-gray-500 font-medium">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> Due: {filing.date}</span>
                                            <span>Period: {filing.period}</span>
                                            <span>Est. Amount: ${filing.amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className={clsx("text-xs font-black uppercase mb-1",
                                            filing.status === 'Ready to File' ? "text-emerald-600" :
                                                filing.status === 'Processing' ? "text-amber-600" : "text-blue-600"
                                        )}>
                                            {filing.status}
                                        </div>
                                        <div className="text-[10px] text-gray-400">Auto-filing on {filing.date}</div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-2 border border-gray-200 rounded hover:bg-white text-gray-500 hover:text-redwood-brand" title="Review PDF">
                                            <Download size={16} />
                                        </button>
                                        <button className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-bold uppercase hover:bg-redwood-brand/90 shadow-sm">
                                            File Now
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
