import {
    Wallet,
    TrendingUp,
    ArrowUpCircle,
    FileText,
    ChevronRight,
    Download,
    Link2,
    Activity
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GeneralLedger from '../../modules/accounts/GeneralLedger';
import { getInvoices, getPayments } from '../../services/api';
import { formatCurrency } from '../../services/settingsService';

const AccountsDashboard = () => {
    const navigate = useNavigate();
    const [totalReceivable, setTotalReceivable] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [cashReceived, setCashReceived] = useState(0);
    const [overdueCount, setOverdueCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([getInvoices(), getPayments()]).then(([invoices, payments]) => {
            const unpaid = invoices.filter(i => ['Unpaid', 'Partial', 'Overdue'].includes(i.status || ''));
            setTotalReceivable(unpaid.reduce((s, i) => s + (i.total || i.subtotal || 0), 0));
            setTotalRevenue(invoices.filter(i => i.status !== 'Cancelled').reduce((s, i) => s + (i.total || i.subtotal || 0), 0));
            setCashReceived(payments.reduce((s, p) => s + (p.amount || 0), 0));
            setOverdueCount(invoices.filter(i => i.status === 'Overdue').length);
            setLoading(false);
        });
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
            {/* Financial Orchestration Header */}
            <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm flex flex-wrap gap-6 justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-redwood-midnight rounded-sm flex items-center justify-center text-redwood-brand shadow-2xl">
                        <Activity size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tighter uppercase">Fiscal Control Matrix</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-redwood-brand uppercase tracking-[0.2em]">General Ledger v8.2</span>
                            <span className="w-1 h-1 bg-redwood-border rounded-full"></span>
                            <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Reporting Period: Q4-2024</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-5 py-2.5 bg-white border border-redwood-border rounded-sm text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light transition-all shadow-sm flex items-center gap-2 uppercase tracking-[0.15em]">
                        <Download size={14} /> Global Export
                    </button>
                    <div className="flex rounded-sm overflow-hidden shadow-lg">
                        <button className="px-6 py-2.5 bg-redwood-brand text-white text-[11px] font-black hover:brightness-95 transition-all flex items-center gap-2 border-r border-white/10 uppercase tracking-[0.2em]">
                            <ArrowUpCircle size={14} /> Post Entry
                        </button>
                        <button className="px-6 py-2.5 bg-redwood-midnight text-white text-[11px] font-black hover:bg-black transition-all flex items-center gap-2 uppercase tracking-[0.2em]">
                            <Link2 size={14} /> Reconcile
                        </button>
                    </div>
                </div>
            </div>

            {/* Dimensional Capital Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-redwood-midnight p-8 rounded-sm text-white shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <div className="text-redwood-secondary text-[10px] font-black uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                            <Wallet size={14} className="text-redwood-brand" /> Cash Equities
                        </div>
                        <div className="text-3xl font-black tracking-tighter font-mono">{loading ? "..." : formatCurrency(cashReceived)}</div>
                        <div className="mt-4 text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 bg-white/5 w-fit px-3 py-1.5 rounded-sm">
                            <TrendingUp size={12} /> +12.4% Variance
                        </div>
                    </div>
                    <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Wallet size={140} strokeWidth={0.5} />
                    </div>
                </div>

                {[
                    { label: 'Accounts Receivable', value: loading ? '...' : formatCurrency(totalReceivable), alert: `${overdueCount} Entities Overdue`, color: 'text-rose-500' },
                    { label: 'Total Revenue', value: loading ? '...' : formatCurrency(totalRevenue), alert: 'From all invoices', color: 'text-redwood-text-muted' },
                    { label: 'Tax Liability Est.', value: '0.31M', alert: 'Fiscal Provision Set', color: 'text-redwood-primary' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-sm border border-redwood-border shadow-sm flex flex-col justify-between">
                        <div>
                            <div className="text-redwood-text-muted text-[10px] font-black uppercase tracking-[0.3em] mb-2">{stat.label}</div>
                            <div className="text-2xl font-black text-redwood-text-main tracking-tighter font-mono">{stat.value}</div>
                        </div>
                        <p className={`text-[9px] font-black mt-6 border-t border-redwood-bg-light pt-4 uppercase tracking-[0.1em] italic ${stat.color}`}>
                            {stat.alert}
                        </p>
                    </div>
                ))}
            </div>

            {/* Strategic Ledger Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8">
                    <GeneralLedger />
                </div>

                <div className="lg:col-span-4 space-y-10">
                    <div className="bg-white p-8 border border-redwood-border rounded-sm shadow-sm">
                        <h3 className="text-[11px] font-black text-redwood-text-muted uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                            <FileText size={18} className="text-redwood-brand" /> Governance Documents
                        </h3>
                        <div className="space-y-2">
                            {['Consolidated Balance Sheet', 'Core Profit & Loss Index', 'Tax Liability Matrix', 'Cash Flow Projection', 'Audit Log (DXB-CENTRAL)'].map((report, i) => (
                                <button key={i} className="w-full flex items-center justify-between p-4 rounded-sm hover:bg-redwood-bg-light border border-transparent hover:border-redwood-border transition-all text-left group">
                                    <span className="text-[12px] font-bold text-redwood-text-main group-hover:text-redwood-brand uppercase tracking-tight">{report}</span>
                                    <ChevronRight size={14} className="text-redwood-border group-hover:translate-x-1 group-hover:text-redwood-brand transition-all" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-redwood-bg-light border border-dashed border-redwood-border p-10 rounded-sm text-center flex flex-col items-center shadow-inner">
                        <div className="w-16 h-16 bg-white rounded-sm flex items-center justify-center mb-6 border border-redwood-border shadow-md">
                            <Activity size={24} className="text-redwood-brand" />
                        </div>
                        <h4 className="text-[14px] font-black text-redwood-text-main uppercase tracking-widest mb-3">Compliance Sentinel</h4>
                        <p className="text-[10px] text-redwood-text-muted font-bold leading-relaxed mb-8 px-4 uppercase italic">Execute precision reconciliation protocols before terminal period closure.</p>
                        <button className="w-full py-4 bg-redwood-slate text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm hover:bg-black transition-all shadow-xl">
                            INITIATE AUDIT CHECK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountsDashboard;
