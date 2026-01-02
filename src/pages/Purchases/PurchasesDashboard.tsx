import { useState, useEffect } from 'react';
import {
    ClipboardList,
    Plus,
    History,
    PackageCheck,
    AlertCircle,
    MoreVertical,
    Truck,
    Download,
    ShieldCheck,
    Search,
    Filter,
    CheckCircle
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getPurchaseOrders, type PurchaseOrder } from '../../services/purchasesService';
const PurchasesDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        // Fetch purchase orders
        getPurchaseOrders().then(setPurchaseOrders);

        // Check if we just created a PO (success state from navigation)
        if (location.state?.success) {
            setShowSuccess(true);
            setSuccessMessage(location.state.message || 'Purchase Order created successfully!');

            // Clear the message after 5 seconds
            setTimeout(() => setShowSuccess(false), 5000);

            // Clear navigation state
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-500';
            case 'Draft': return 'bg-amber-500';
            case 'Sent': return 'bg-redwood-brand';
            case 'Closed': return 'bg-gray-400';
            default: return 'bg-redwood-primary';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Approved': return 'Intake Verified';
            case 'Draft': return 'Awaiting Auth';
            case 'Sent': return 'Global Transit';
            case 'Closed': return 'Fulfilled';
            default: return status;
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto pb-10">
            {/* Success Notification */}
            {showSuccess && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-sm shadow-md animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="text-emerald-500" size={24} />
                        <div>
                            <p className="text-sm font-bold text-emerald-900">{successMessage}</p>
                            <p className="text-xs text-emerald-700 mt-1">Your purchase order has been recorded in the system.</p>
                        </div>
                        <button
                            onClick={() => setShowSuccess(false)}
                            className="ml-auto text-emerald-600 hover:text-emerald-900 text-xl font-bold"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Contextual Procurement Header */}
            <div className="bg-white p-6 border border-redwood-border rounded-sm shadow-sm flex flex-wrap gap-6 justify-between items-center">
                <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-redwood-brand/5 border border-redwood-brand/20 rounded-sm flex items-center justify-center text-redwood-brand shadow-inner">
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-redwood-text-main tracking-tighter uppercase">Governance & Procurement Hub</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-redwood-secondary uppercase tracking-[0.2em]">Material Sourcing Matrix</span>
                            <span className="w-1 h-1 bg-redwood-border rounded-full"></span>
                            <span className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.2em]">Compliance Score: 99.4%</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-5 py-2.5 bg-white border border-redwood-border text-[11px] font-black text-redwood-text-muted hover:bg-redwood-bg-light rounded-sm transition-all shadow-sm flex items-center gap-2 uppercase tracking-[0.2em]">
                        <Download size={14} /> PO Pipeline Export
                    </button>
                    <button
                        onClick={() => navigate('/purchases/new')}
                        className="px-8 py-2.5 bg-redwood-brand border border-transparent text-[11px] font-black text-white rounded-sm hover:brightness-95 transition-all shadow-lg flex items-center gap-2 uppercase tracking-[0.2em]"
                    >
                        <Plus size={16} /> Create Requisition
                    </button>
                </div>
            </div>

            {/* Strategic KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Orders', value: `${purchaseOrders.length} RECORDS`, icon: ClipboardList, color: 'text-redwood-primary', status: 'In Analytics' },
                    { label: 'Approved Orders', value: `${purchaseOrders.filter(po => po.status === 'Approved').length} VERIFIED`, icon: PackageCheck, color: 'text-emerald-500', status: 'Global Benchmark' },
                    { label: 'Draft Orders', value: `${purchaseOrders.filter(po => po.status === 'Draft').length} PENDING`, icon: AlertCircle, color: 'text-amber-500', status: 'Awaiting Review' },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white p-8 rounded-sm border border-redwood-border shadow-sm flex items-center gap-8 group cursor-pointer hover:border-redwood-brand/30 transition-all border-l-4 border-l-transparent hover:border-l-redwood-brand">
                        <div className={`w-14 h-14 rounded-sm bg-redwood-bg-light flex items-center justify-center transition-all group-hover:bg-redwood-midnight group-hover:text-white border border-redwood-border shadow-inner ${kpi.color}`}>
                            <kpi.icon size={28} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.3em] mb-1">{kpi.label}</div>
                            <div className="text-2xl font-black text-redwood-text-main tracking-tighter font-mono">{kpi.value}</div>
                            <p className="text-[9px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1 opacity-60">{kpi.status}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Procurement Ledger Surface */}
            <div className="bg-white border border-redwood-border rounded-sm shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="px-8 py-6 border-b border-redwood-bg-light bg-white flex flex-wrap gap-8 justify-between items-center">
                    <div className="relative flex-1 max-w-[500px] group">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-redwood-text-muted group-focus-within:text-redwood-brand transition-colors" />
                        <input
                            type="text"
                            placeholder="Query Supplier Master, PO Reference, or Fiscal Date..."
                            className="w-full pl-12 pr-4 py-3 bg-redwood-bg-light border border-redwood-border rounded-sm text-[13px] font-bold focus:bg-white focus:border-redwood-brand focus:ring-4 focus:ring-redwood-brand/5 transition-all outline-none placeholder:text-redwood-text-muted/40 uppercase tracking-tight"
                        />
                    </div>
                    <div className="flex gap-4">
                        <button className="px-6 py-2.5 bg-redwood-bg-light border border-redwood-border rounded-sm text-redwood-text-muted text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-white transition-all shadow-sm">
                            <History size={16} /> Audit Trail
                        </button>
                        <button className="px-6 py-2.5 bg-redwood-bg-light border border-redwood-border rounded-sm text-redwood-text-muted text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-white transition-all shadow-sm">
                            <Filter size={16} /> Dimension Filter
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse font-inter">
                        <thead>
                            <tr className="bg-redwood-bg-light/50 border-b border-redwood-border">
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em]">Authorized Supplier</th>
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em]">Document ID</th>
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em]">Workflow State</th>
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em] text-right">Fiscal Value</th>
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em] text-right">Command</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-redwood-bg-light/30">
                            {purchaseOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <ClipboardList size={48} className="text-redwood-border" />
                                            <p className="text-sm font-bold text-redwood-text-muted uppercase tracking-wide">No Purchase Orders Yet</p>
                                            <p className="text-xs text-redwood-text-muted">Click "Create Requisition" to add your first purchase order</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                purchaseOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-redwood-bg-light/20 transition-all group border-l-4 border-transparent hover:border-l-redwood-brand cursor-pointer">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-redwood-text-main tracking-tight uppercase transition-colors group-hover:text-redwood-brand">{order.supplierName}</div>
                                            <div className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1 italic">Supplier ID: {order.supplierId}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="text-[12px] font-black text-redwood-text-main font-mono tracking-tighter">{order.poNumber}</div>
                                            <div className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1 opacity-60">Date: {new Date(order.date).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${getStatusColor(order.status)} ${order.status === 'Draft' ? 'animate-pulse' : ''}`}></div>
                                                <span className="text-[10px] font-black text-redwood-text-main uppercase tracking-widest border border-redwood-border px-3 py-1 bg-white shadow-sm">
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="text-[14px] font-black text-redwood-text-main tracking-tighter font-mono">${order.grandTotal.toFixed(2)}</div>
                                            <div className="text-[9px] text-rose-600 font-bold uppercase tracking-[0.2em] mt-1">{order.status === 'Completed' ? 'Settled' : 'Pending Settlement'}</div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button className="p-2 text-redwood-border hover:text-redwood-brand transition-all">
                                                <MoreVertical size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-16 text-center bg-redwood-bg-light/30 border-t border-redwood-border shadow-inner">
                    <div className="w-16 h-16 bg-white rounded-sm flex items-center justify-center mx-auto mb-6 border border-redwood-border shadow-md">
                        <Truck size={28} className="text-redwood-brand" />
                    </div>
                    <h4 className="font-black text-redwood-text-main uppercase tracking-[0.3em] text-[12px] mb-2">Centralized Material Governance</h4>
                    <p className="text-[10px] text-redwood-text-muted max-w-[400px] mx-auto leading-relaxed font-bold uppercase tracking-widest italic px-6 opacity-80">Synchronize and audit strategic vendor interactions and purchase requisition lifecycles within this unified enterprise portal.</p>
                </div>
            </div>
        </div>
    );
};

export default PurchasesDashboard;