import { useState, useEffect } from 'react';
import {
    ClipboardList,
    Plus,
    History,
    PackageCheck,
    AlertCircle,
    Truck,
    Download,
    ShieldCheck,
    Filter,
    CheckCircle,
    X,
    XCircle,
    Edit2,
    Trash2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getPurchaseOrders, approvePurchaseOrder, rejectPurchaseOrder, confirmGRN, markPOPaid, deletePurchaseOrder, updatePurchaseOrder, type PurchaseOrder } from '../../services/purchasesService';
const PurchasesDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    // PO under review — when set, the approve/reject modal is shown.
    const [reviewPO, setReviewPO] = useState<PurchaseOrder | null>(null);
    // FIX W2-4 — Quick-Edit modal state (Draft POs only, notes + expected date).
    const [editPO, setEditPO] = useState<PurchaseOrder | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [editExpectedDate, setEditExpectedDate] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

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
            case 'Pending': return 'bg-yellow-400';
            case 'Approved': return 'bg-blue-500';
            case 'GRN': return 'bg-emerald-500';
            case 'Paid': return 'bg-gray-400';
            case 'Rejected': return 'bg-rose-500';
            case 'Received': return 'bg-emerald-500';
            case 'Completed': return 'bg-gray-400';
            case 'Draft': return 'bg-amber-500';
            default: return 'bg-redwood-primary';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Pending': return '🟡 Pending Requisition';
            case 'Approved': return '🔵 Approved PO';
            case 'GRN': return '🟢 Goods Received';
            case 'Paid': return '✅ Invoice Paid';
            case 'Received': return '🟢 Goods Received';
            case 'Completed': return '✅ Completed';
            case 'Draft': return '⚪ Draft';
            case 'Rejected': return '🚫 Rejected';
            default: return status;
        }
    };

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this Purchase Order? This confirms the purchase with the supplier.')) return;
        try {
            await approvePurchaseOrder(id);
            const updated = await getPurchaseOrders();
            setPurchaseOrders(updated);
            setReviewPO(null);
            setSuccessMessage('✅ PO Approved! Warehouse can now confirm Goods Received.');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Reason for rejecting this PO? (optional, used for audit)') || '';
        if (!confirm('Reject this Purchase Order? It will be locked out of the procurement flow.')) return;
        try {
            await rejectPurchaseOrder(id, reason);
            const updated = await getPurchaseOrders();
            setPurchaseOrders(updated);
            setReviewPO(null);
            setSuccessMessage('🚫 PO Rejected. It stays in the list for audit but cannot proceed.');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const handleGRN = async (id: string) => {
        // FIX W3-3 — Pre-flight warning when PO lines have no productId.
        // Those lines will silently skip stock updates (and post-fact W3-2
        // also reports it), but the user deserves to know BEFORE confirming.
        const targetPO = purchaseOrders.find(o => String(o.id) === String(id));
        const allItems = targetPO?.items || [];
        const unlinked = allItems.filter(it => !it.productId);
        const linkedCount = allItems.length - unlinked.length;
        let prompt = 'Confirm Goods Received (GRN)?\n\nThis will INCREASE warehouse stock for all items in this PO.';
        if (unlinked.length > 0) {
            const names = unlinked.map(it => it.productName || '(unnamed line)');
            const list = names.length <= 5
                ? names.join('\n  • ')
                : `${names.slice(0, 5).join('\n  • ')}\n  • +${names.length - 5} more`;
            prompt = `⚠️ Warning — ${unlinked.length} of ${allItems.length} line item(s) have no product linked and will NOT update inventory:\n\n  • ${list}\n\nOnly ${linkedCount} item(s) will affect stock.\n\nContinue with GRN anyway?`;
        }
        if (!confirm(prompt)) return;
        try {
            // FIX W3-2 — confirmGRN now returns per-item attempt / success /
            // failure counts so we can show an honest banner instead of
            // unconditionally claiming success.
            const result = await confirmGRN(id);
            const updated = await getPurchaseOrders();
            setPurchaseOrders(updated);

            const failNames = result.failures
                .map(f => f.productName || f.productId);
            const skipNames = result.skipped.map(s => s.productName || '(unnamed line)');
            const truncate = (xs: string[]) =>
                xs.length <= 5 ? xs.join(', ') : `${xs.slice(0, 5).join(', ')} +${xs.length - 5} more`;

            let msg: string;
            if (result.failures.length === 0 && result.skipped.length === 0) {
                msg = '✅ GRN Confirmed! Warehouse stock has been updated.';
            } else if (result.failures.length === 0 && result.skipped.length > 0) {
                msg = `⚠️ GRN posted. ${result.succeeded}/${result.attempted} items updated. ${result.skipped.length} line(s) had no product link and were skipped: ${truncate(skipNames)}.`;
            } else if (result.succeeded === 0) {
                msg = `❌ GRN posted but NO stock was updated. ${result.failures.length} item(s) failed: ${truncate(failNames)}.`;
            } else {
                msg = `⚠️ Stock updated for ${result.succeeded}/${result.attempted} items. Failed: ${truncate(failNames)}.`;
            }
            setSuccessMessage(msg);
            setShowSuccess(true);
            // Longer hold so users can read multi-line failure lists.
            setTimeout(() => setShowSuccess(false), result.failures.length || result.skipped.length ? 9000 : 5000);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const handleMarkPaid = async (id: string) => {
        const method = prompt('Payment Method (e.g. Bank Transfer, Cash, Cheque):');
        if (!method) return;
        try {
            await markPOPaid(id, method);
            const updated = await getPurchaseOrders();
            setPurchaseOrders(updated);
            setSuccessMessage('✅ Invoice Paid! Supplier ledger has been updated.');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    // FIX W2-4 + W3-5 — Per-row Delete for pre-approval statuses
    // (Draft or Pending). Backend may further enforce; if it rejects,
    // the catch block translates the error to a friendly message.
    const handleDeletePO = async (po: PurchaseOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        if (po.status !== 'Draft' && po.status !== 'Pending') {
            alert('Only Draft or Pending purchase orders can be deleted. Reject approved POs instead.');
            return;
        }
        if (!window.confirm(`Delete purchase order ${po.poNumber}? This cannot be undone.`)) return;
        try {
            await deletePurchaseOrder(po.id);
            setPurchaseOrders(prev => prev.filter(x => String(x.id) !== String(po.id)));
        } catch (err) {
            const raw = err instanceof Error ? err.message : String(err);
            const friendly = /foreign key|reference|constraint|in use|linked|associated|409|400/i.test(raw)
                ? 'Cannot delete — this PO already has GRN or payment activity. Reject it instead.'
                : `Could not delete PO: ${raw}`;
            alert(friendly);
        }
    };

    // FIX W2-4 + W3-5 — Quick-Edit available for pre-approval statuses
    // (Draft or Pending). Lets users fix notes / expected date BEFORE
    // approvers act on the PO.
    const handleEditPO = (po: PurchaseOrder, e: React.MouseEvent) => {
        e.stopPropagation();
        if (po.status !== 'Draft' && po.status !== 'Pending') {
            alert('Only Draft or Pending purchase orders can be edited from this screen.');
            return;
        }
        setEditPO(po);
        setEditNotes(po.notes || '');
        setEditExpectedDate(po.expectedDate ? String(po.expectedDate).slice(0, 10) : '');
    };

    // FIX W2-4 — Save quick-edit. Backend may silently ignore expected_date
    // if the field isn't in its update schema; notes are reliably persisted.
    const handleSaveEditPO = async () => {
        if (!editPO) return;
        setSavingEdit(true);
        try {
            await updatePurchaseOrder(editPO.id, {
                notes: editNotes,
                expectedDate: editExpectedDate || undefined,
            } as any);
            const updated = await getPurchaseOrders();
            setPurchaseOrders(updated);
            setEditPO(null);
            setSuccessMessage('✅ Purchase order updated.');
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Could not save changes: ${msg}`);
        } finally {
            setSavingEdit(false);
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
                    { label: 'Pending Approval', value: `${purchaseOrders.filter(po => po.status === 'Pending').length} PENDING`, icon: AlertCircle, color: 'text-amber-500', status: 'Awaiting Review' },
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
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em]">Workflow State & Actions</th>
                                <th className="px-8 py-5 text-[10px] font-black text-redwood-text-muted uppercase tracking-[0.25em] text-right">Fiscal Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-redwood-bg-light/30">
                            {purchaseOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <ClipboardList size={48} className="text-redwood-border" />
                                            <p className="text-sm font-bold text-redwood-text-muted uppercase tracking-wide">No Purchase Orders Yet</p>
                                            <p className="text-xs text-redwood-text-muted">Click "Create Requisition" to add your first purchase order</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                purchaseOrders.map((order) => (
                                    <tr
                                        key={order.id}
                                        // Clicking a pending row opens the review modal with the full
                                        // line-item list + Approve / Reject buttons.
                                        onClick={() => {
                                            if (order.status === 'Pending' || order.status === 'Draft') {
                                                setReviewPO(order);
                                            }
                                        }}
                                        className="hover:bg-redwood-bg-light/20 transition-all group border-l-4 border-transparent hover:border-l-redwood-brand cursor-pointer"
                                    >
                                        <td className="px-8 py-6">
                                            <div className="font-black text-redwood-text-main tracking-tight uppercase transition-colors group-hover:text-redwood-brand">{order.supplierName}</div>
                                            <div className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1 italic">Supplier ID: {order.supplierId}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="text-[12px] font-black text-redwood-text-main font-mono tracking-tighter">{order.poNumber}</div>
                                            <div className="text-[10px] text-redwood-text-muted font-bold uppercase tracking-widest mt-1 opacity-60">Date: {new Date(order.date).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className={`w-2 h-2 rounded-full ${getStatusColor(order.status)} ${order.status === 'Draft' ? 'animate-pulse' : ''}`}></div>
                                                <span className="text-[10px] font-black text-redwood-text-main uppercase tracking-widest border border-redwood-border px-3 py-1 bg-white shadow-sm">
                                                    {getStatusLabel(order.status)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                {(order.status === 'Pending' || order.status === 'Draft') && (
                                                    <>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleApprove(order.id); }}
                                                            className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide rounded hover:bg-blue-700 transition-all"
                                                        >
                                                            ✓ Approve PO
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleReject(order.id); }}
                                                            className="px-3 py-1.5 bg-rose-600 text-white text-[10px] font-black uppercase tracking-wide rounded hover:bg-rose-700 transition-all"
                                                        >
                                                            ✗ Reject
                                                        </button>
                                                    </>
                                                )}
                                                {/* FIX W2-4 + W3-5 — Edit + Delete on pre-approval statuses (Draft or Pending) */}
                                                {(order.status === 'Draft' || order.status === 'Pending') && (
                                                    <>
                                                        <button
                                                            onClick={(e) => handleEditPO(order, e)}
                                                            title="Edit PO (notes + expected date)"
                                                            className="p-1.5 rounded text-gray-400 hover:text-redwood-brand hover:bg-redwood-bg-light transition-all"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeletePO(order, e)}
                                                            title="Delete PO"
                                                            className="p-1.5 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                                {order.status === 'Rejected' && (
                                                    <span className="px-3 py-1.5 bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wide rounded border border-rose-200">
                                                        🚫 Rejected
                                                    </span>
                                                )}
                                                {order.status === 'Approved' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleGRN(order.id); }}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wide rounded hover:bg-emerald-700 transition-all"
                                                    >
                                                        📦 Confirm GRN
                                                    </button>
                                                )}
                                                {order.status === 'GRN' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMarkPaid(order.id); }}
                                                        className="px-3 py-1.5 bg-orange-600 text-white text-[10px] font-black uppercase tracking-wide rounded hover:bg-orange-700 transition-all"
                                                    >
                                                        💰 Mark Paid
                                                    </button>
                                                )}
                                                {(order.status === 'Paid' || order.status === 'Received' || order.status === 'Completed') && (
                                                    <span className="px-3 py-1.5 bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-wide rounded">
                                                        ✅ Settled
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="text-[14px] font-black text-redwood-text-main tracking-tighter font-mono">${order.grandTotal.toFixed(2)}</div>
                                            <div className="text-[9px] text-rose-600 font-bold uppercase tracking-[0.2em] mt-1">{order.status === 'Completed' ? 'Settled' : 'Pending Settlement'}</div>
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

            {/* Review modal — opens when a pending row is clicked. */}
            {reviewPO && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setReviewPO(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Purchase Order Review</p>
                                <h3 className="text-xl font-black text-gray-900 mt-1">{reviewPO.poNumber}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {reviewPO.supplierName} · {new Date(reviewPO.date).toLocaleDateString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setReviewPO(null)}
                                className="p-2 rounded-lg hover:bg-gray-200 text-gray-500"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Line Items</p>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100">
                                        <th className="py-2 text-left text-[10px] font-black text-gray-400 uppercase">Item</th>
                                        <th className="py-2 text-right text-[10px] font-black text-gray-400 uppercase">Qty</th>
                                        <th className="py-2 text-right text-[10px] font-black text-gray-400 uppercase">Rate</th>
                                        <th className="py-2 text-right text-[10px] font-black text-gray-400 uppercase">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(reviewPO.items || []).map((it, i) => (
                                        <tr key={i}>
                                            <td className="py-3 text-gray-800 font-semibold">{it.productName || '—'}</td>
                                            <td className="py-3 text-right font-mono text-gray-600">{it.quantity}</td>
                                            <td className="py-3 text-right font-mono text-gray-600">${(it.unitPrice || 0).toFixed(2)}</td>
                                            <td className="py-3 text-right font-mono font-bold text-gray-900">${(it.total || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {(reviewPO.items?.length ?? 0) === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-xs text-gray-400 italic">
                                                No line items on this PO.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-900">
                                        <td colSpan={3} className="pt-3 text-right text-[11px] font-black uppercase tracking-widest text-gray-600">
                                            Grand Total
                                        </td>
                                        <td className="pt-3 text-right text-lg font-black font-mono text-gray-900">
                                            ${(reviewPO.grandTotal || 0).toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                            {reviewPO.notes && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                                    <p className="text-xs text-gray-700">{reviewPO.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => handleReject(reviewPO.id)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-black hover:bg-rose-700 transition-all"
                            >
                                <XCircle size={16} /> Reject
                            </button>
                            <button
                                onClick={() => handleApprove(reviewPO.id)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-black hover:bg-blue-700 transition-all"
                            >
                                <CheckCircle size={16} /> Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FIX W2-4 — Quick-Edit modal (Draft PO, notes + expected date only).
                Line-item editing is intentionally out of scope here — it requires
                a backend item-update endpoint that doesn't exist yet. */}
            {editPO && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col">
                        <div className="flex items-start justify-between p-6 border-b border-gray-100">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quick Edit · Draft PO</p>
                                <h3 className="text-xl font-black text-gray-900 mt-1">{editPO.poNumber}</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {editPO.supplierName} · ${editPO.grandTotal.toFixed(2)}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditPO(null)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                    Expected Delivery Date
                                </label>
                                <input
                                    type="date"
                                    value={editExpectedDate}
                                    onChange={(e) => setEditExpectedDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-redwood-brand/30"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">
                                    Notes
                                </label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={4}
                                    placeholder="Internal notes for this PO…"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-redwood-brand/30 resize-none"
                                />
                            </div>
                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                                ⚠️ Line items, quantities, and prices can't be edited here.
                                To change those, delete this Draft PO and create a new one.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setEditPO(null)}
                                disabled={savingEdit}
                                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-black hover:bg-gray-50 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEditPO}
                                disabled={savingEdit}
                                className="flex items-center gap-2 px-5 py-2.5 bg-redwood-brand text-white rounded-lg text-sm font-black hover:opacity-90 transition-all disabled:opacity-50"
                            >
                                {savingEdit ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PurchasesDashboard;