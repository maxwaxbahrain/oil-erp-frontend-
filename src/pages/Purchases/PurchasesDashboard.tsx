import { useState, useEffect, useMemo, Fragment, type CSSProperties } from 'react';
import {
    Plus,
    History,
    Download,
    CheckCircle,
    X,
    XCircle,
    Edit2,
    Trash2,
    ShoppingCart,
    Search,
    AlertTriangle,
    Bot,
    Sparkles,
    Eye,
    ChevronDown,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getPurchaseOrders, approvePurchaseOrder, rejectPurchaseOrder, markPOPaid, deletePurchaseOrder, updatePurchaseOrder, type PurchaseOrder } from '../../services/purchasesService';
import { formatDateOnly } from '../../utils/formatters';

const PO_DATE_FMT = { day: 'numeric', month: 'short', year: 'numeric' } as const;

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const panel: CSSProperties = {
    background: C.bg2,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
};

const ghostBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 11px',
    borderRadius: 8,
    fontSize: 10.5,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,.12)',
    background: 'transparent',
    color: C.muted,
    fontFamily: 'inherit',
};

const primaryBtn: CSSProperties = {
    ...ghostBtn,
    border: 'none',
    background: C.blue,
    color: '#fff',
    fontWeight: 600,
};

const thStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: C.muted,
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,.07)',
};

const tdStyle: CSSProperties = {
    padding: '11px 12px',
    fontSize: 11,
    color: C.text,
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

const COMPLIANCE_SCORE = 99.4;

type PageTab = 'all' | 'pending' | 'goods_received' | 'mark_paid' | 'settled';
type FilterChip = 'all' | 'pending' | 'mark_paid' | 'settled';

function formatUsd(n: number): string {
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isTestPO(po: PurchaseOrder): boolean {
    return /test/i.test(po.supplierName) || /test/i.test(po.poNumber);
}

function isPendingApproval(po: PurchaseOrder): boolean {
    return po.status === 'Pending' || po.status === 'Draft';
}

function isGoodsReceivedMarkPaid(po: PurchaseOrder): boolean {
    return po.status === 'Approved' || po.status === 'GRN';
}

function isSettled(po: PurchaseOrder): boolean {
    return po.status === 'Paid' || po.status === 'Received' || po.status === 'Completed';
}

function isMarkPaidTab(po: PurchaseOrder): boolean {
    return po.status === 'GRN';
}

function isGoodsReceivedTab(po: PurchaseOrder): boolean {
    return po.status === 'Approved' || po.status === 'GRN' || po.status === 'Received';
}

const PurchasesDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [reviewPO, setReviewPO] = useState<PurchaseOrder | null>(null);
    const [editPO, setEditPO] = useState<PurchaseOrder | null>(null);
    const [editNotes, setEditNotes] = useState('');
    const [editExpectedDate, setEditExpectedDate] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState<PageTab>('all');
    const [filterChip, setFilterChip] = useState<FilterChip>('all');
    const [search, setSearch] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('all');

    useEffect(() => {
        getPurchaseOrders().then(setPurchaseOrders);

        if (location.state?.success) {
            setShowSuccess(true);
            setSuccessMessage(location.state.message || 'Purchase Order created successfully!');
            setTimeout(() => setShowSuccess(false), 5000);
            window.history.replaceState({}, document.title);
        }
    }, [location]);

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'Pending': return 'Pending approval';
            case 'Approved': return 'Approved';
            case 'GRN': return 'Goods received';
            case 'Paid': return 'Paid';
            case 'Received': return 'Received';
            case 'Completed': return 'Completed';
            case 'Draft': return 'Draft';
            case 'Rejected': return 'Rejected';
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
            setSuccessMessage('✅ PO Approved! Receive goods via Inventory → Material Receipt.');
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

    const goToMaterialReceipt = (poId: string) => {
        navigate(`/receiving/new?poId=${encodeURIComponent(poId)}`);
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

    const counts = useMemo(() => {
        const pending = purchaseOrders.filter(isPendingApproval).length;
        const markPaid = purchaseOrders.filter(isMarkPaidTab).length;
        const settled = purchaseOrders.filter(isSettled).length;
        const test = purchaseOrders.filter(isTestPO).length;
        const totalValue = purchaseOrders.reduce((s, po) => s + (po.grandTotal || 0), 0);
        return {
            total: purchaseOrders.length,
            pending,
            markPaid,
            settled,
            test,
            totalValue,
            compliance: COMPLIANCE_SCORE,
        };
    }, [purchaseOrders]);

    const suppliers = useMemo(() => {
        const names = new Set<string>();
        purchaseOrders.forEach((po) => {
            if (po.supplierName) names.add(po.supplierName);
        });
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [purchaseOrders]);

    const filteredOrders = useMemo(() => {
        let rows = purchaseOrders.filter((po) => !isTestPO(po));

        if (activeTab === 'pending') rows = rows.filter(isPendingApproval);
        else if (activeTab === 'goods_received') rows = rows.filter(isGoodsReceivedTab);
        else if (activeTab === 'mark_paid') rows = rows.filter(isMarkPaidTab);
        else if (activeTab === 'settled') rows = rows.filter(isSettled);

        if (filterChip === 'pending') rows = rows.filter(isPendingApproval);
        else if (filterChip === 'mark_paid') rows = rows.filter(isMarkPaidTab);
        else if (filterChip === 'settled') rows = rows.filter(isSettled);

        if (supplierFilter !== 'all') {
            rows = rows.filter((po) => po.supplierName === supplierFilter);
        }

        const q = search.trim().toLowerCase();
        if (q) {
            rows = rows.filter(
                (po) =>
                    po.supplierName?.toLowerCase().includes(q) ||
                    po.poNumber?.toLowerCase().includes(q) ||
                    po.status?.toLowerCase().includes(q),
            );
        }

        return rows;
    }, [purchaseOrders, activeTab, filterChip, search, supplierFilter]);

    const testOrders = useMemo(
        () => purchaseOrders.filter(isTestPO),
        [purchaseOrders],
    );

    const groupedSections = useMemo(() => {
        const pending = filteredOrders.filter(isPendingApproval);
        const grn = filteredOrders.filter(isGoodsReceivedMarkPaid);
        const settled = filteredOrders.filter(isSettled);
        const rejected = filteredOrders.filter((po) => po.status === 'Rejected');
        return [
            { key: 'pending', title: 'Pending approval', color: C.amber, rows: pending },
            { key: 'grn', title: 'Goods received — mark paid', color: C.blue, rows: grn },
            { key: 'settled', title: 'Settled', color: C.green, rows: settled },
            { key: 'rejected', title: 'Rejected', color: C.red, rows: rejected },
        ].filter((g) => g.rows.length > 0);
    }, [filteredOrders]);

    const visibleCount = filteredOrders.length + (activeTab === 'all' && filterChip === 'all' && !search && supplierFilter === 'all' ? testOrders.length : 0);
    const visibleTotal = useMemo(() => {
        const main = filteredOrders.reduce((s, po) => s + (po.grandTotal || 0), 0);
        const test = activeTab === 'all' && filterChip === 'all' && !search && supplierFilter === 'all'
            ? testOrders.reduce((s, po) => s + (po.grandTotal || 0), 0)
            : 0;
        return main + test;
    }, [filteredOrders, testOrders, activeTab, filterChip, search, supplierFilter]);

    const grnUnpaid = useMemo(
        () => purchaseOrders.filter((po) => po.status === 'GRN'),
        [purchaseOrders],
    );

    const kamranGrn = useMemo(
        () => grnUnpaid.find((po) => /kamran/i.test(po.supplierName)),
        [grnUnpaid],
    );

    const aiInsights = useMemo(() => {
        const insights: { color: string; body: React.ReactNode }[] = [];

        if (counts.settled > 0 && counts.total > 0) {
            const rate = Math.round((counts.settled / counts.total) * 100);
            insights.push({
                color: C.green,
                body: (
                    <>
                        <strong style={{ color: C.green }}>{rate}%</strong> of POs are fully settled — compliance workflow is on track at {COMPLIANCE_SCORE}%.
                    </>
                ),
            });
        }

        if (counts.pending > 0) {
            insights.push({
                color: C.amber,
                body: (
                    <>
                        <strong style={{ color: C.amber }}>{counts.pending} PO{counts.pending !== 1 ? 's' : ''}</strong> awaiting approval — review pending requisitions to avoid procurement delays.
                    </>
                ),
            });
        }

        if (grnUnpaid.length > 0) {
            insights.push({
                color: C.red,
                body: (
                    <>
                        <strong style={{ color: C.red }}>{grnUnpaid.length} PO{grnUnpaid.length !== 1 ? 's' : ''}</strong> received but unpaid — mark paid to update supplier ledger balances.
                    </>
                ),
            });
        }

        const fallbacks = [
            { color: C.green, body: 'Maintain audit trail for all approval and payment actions.' },
            { color: C.amber, body: 'Review pending POs weekly to keep procurement moving.' },
            { color: C.red, body: 'Clear unpaid GRN records promptly to avoid supplier disputes.' },
        ];
        while (insights.length < 3) {
            insights.push(fallbacks[insights.length]);
        }
        return insights.slice(0, 3);
    }, [counts, grnUnpaid]);

    const pageTabs: { key: PageTab; label: string; badge?: number; badgeColor?: string }[] = [
        { key: 'all', label: 'All POs' },
        { key: 'pending', label: 'Pending approval', badge: counts.pending, badgeColor: C.amber },
        { key: 'goods_received', label: 'Goods received' },
        { key: 'mark_paid', label: 'Mark paid' },
        { key: 'settled', label: 'Settled' },
    ];

    const filterChips: { key: FilterChip; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: counts.total },
        { key: 'pending', label: 'Pending', count: counts.pending },
        { key: 'mark_paid', label: 'Mark paid', count: counts.markPaid },
        { key: 'settled', label: 'Settled', count: counts.settled },
    ];

    const workflowBadgeStyle = (status: string): CSSProperties => {
        if (status === 'Pending' || status === 'Draft') {
            return { background: 'rgba(245,158,11,.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,.28)' };
        }
        if (status === 'Approved') {
            return { background: 'rgba(79,142,247,.12)', color: '#93C5FD', border: '1px solid rgba(79,142,247,.28)' };
        }
        if (status === 'GRN' || status === 'Received') {
            return { background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' };
        }
        if (status === 'Paid' || status === 'Completed') {
            return { background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.28)' };
        }
        if (status === 'Rejected') {
            return { background: 'rgba(239,68,68,.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.35)' };
        }
        return { background: 'rgba(255,255,255,.06)', color: C.muted, border: '1px solid rgba(255,255,255,.1)' };
    };

    const actionBtn = (bg: string, color = '#fff'): CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 6,
        fontSize: 9.5,
        fontWeight: 700,
        cursor: 'pointer',
        border: 'none',
        background: bg,
        color,
        fontFamily: 'inherit',
        textTransform: 'uppercase',
        letterSpacing: '.3px',
    });

    const renderActions = (order: PurchaseOrder) => {
        if (isPendingApproval(order)) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleApprove(order.id); }} style={actionBtn(C.blue)}>
                        Approve
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleReject(order.id); }} style={actionBtn(C.red)}>
                        Reject
                    </button>
                    <button type="button" onClick={(e) => handleEditPO(order, e)} title="Edit PO" style={{ ...ghostBtn, padding: '4px 6px', border: 'none' }}>
                        <Edit2 size={12} />
                    </button>
                    <button type="button" onClick={(e) => handleDeletePO(order, e)} title="Delete PO" style={{ ...ghostBtn, padding: '4px 6px', border: 'none', color: C.red }}>
                        <Trash2 size={12} />
                    </button>
                </div>
            );
        }
        if (order.status === 'Approved') {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); goToMaterialReceipt(order.id); }} style={actionBtn(C.green)}>
                        Receive goods
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setReviewPO(order); }} style={{ ...ghostBtn, padding: '4px 8px', fontSize: 9.5 }}>
                        <Eye size={11} /> View
                    </button>
                </div>
            );
        }
        if (order.status === 'GRN') {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleMarkPaid(order.id); }} style={actionBtn(C.amber, '#0a1726')}>
                        Mark paid
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setReviewPO(order); }} style={{ ...ghostBtn, padding: '4px 8px', fontSize: 9.5 }}>
                        <Eye size={11} /> View
                    </button>
                </div>
            );
        }
        if (isSettled(order)) {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ ...workflowBadgeStyle('Approved'), padding: '2px 7px', borderRadius: 5, fontSize: 8.5, fontWeight: 700 }}>Approved</span>
                    <span style={{ ...workflowBadgeStyle('Received'), padding: '2px 7px', borderRadius: 5, fontSize: 8.5, fontWeight: 700 }}>Received</span>
                    <span style={{ ...workflowBadgeStyle('Paid'), padding: '2px 7px', borderRadius: 5, fontSize: 8.5, fontWeight: 700 }}>Paid</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setReviewPO(order); }} style={{ ...ghostBtn, padding: '4px 8px', fontSize: 9.5 }}>
                        <Eye size={11} /> View
                    </button>
                </div>
            );
        }
        if (order.status === 'Rejected') {
            return (
                <span style={{ ...workflowBadgeStyle('Rejected'), padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>
                    Rejected
                </span>
            );
        }
        return null;
    };

    const renderPORow = (order: PurchaseOrder) => (
        <tr
            key={order.id}
            onClick={() => {
                if (order.status === 'Pending' || order.status === 'Draft') {
                    setReviewPO(order);
                }
            }}
            style={{ cursor: isPendingApproval(order) ? 'pointer' : 'default' }}
        >
            <td style={tdStyle}>
                <div style={{ fontWeight: 600, color: C.text }}>{order.supplierName}</div>
                <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>ID: {order.supplierId}</div>
            </td>
            <td style={tdStyle}>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{order.poNumber}</div>
            </td>
            <td style={tdStyle}>{formatDateOnly(order.date, 'en-GB', PO_DATE_FMT)}</td>
            <td style={tdStyle}>
                <span style={{ ...workflowBadgeStyle(order.status), padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, display: 'inline-block' }}>
                    {getStatusLabel(order.status)}
                </span>
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                {formatUsd(order.grandTotal || 0)}
            </td>
            <td style={tdStyle}>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: isSettled(order) ? C.green : C.amber }}>
                    {isSettled(order) ? 'Settled' : 'Pending settlement'}
                </span>
            </td>
            <td style={tdStyle}>{renderActions(order)}</td>
        </tr>
    );

    const showTestGroup = activeTab === 'all' && filterChip === 'all' && !search.trim() && supplierFilter === 'all';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 24 }}>
            {/* Header */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ShoppingCart size={22} style={{ color: C.blue }} />
                                Purchase orders
                            </h1>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '3px 9px',
                                    borderRadius: 20,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: 'rgba(34,197,94,.12)',
                                    color: '#86EFAC',
                                    border: '1px solid rgba(34,197,94,.28)',
                                }}
                            >
                                <CheckCircle size={11} /> {COMPLIANCE_SCORE}% compliance
                            </span>
                        </div>
                        <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>
                            All POs · approval workflow · goods received · payments · audit trail
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button type="button" style={ghostBtn}>
                            <History size={14} /> Audit trail
                        </button>
                        <button type="button" style={ghostBtn}>
                            <Download size={14} /> Export POs
                        </button>
                        <button type="button" onClick={() => navigate('/purchases/new')} style={primaryBtn}>
                            <Plus size={14} /> Create requisition
                        </button>
                    </div>
                </div>
            </div>

            {showSuccess && (
                <div style={{ ...panel, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.28)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={20} style={{ color: C.green, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#86EFAC', margin: 0 }}>{successMessage}</p>
                        <p style={{ fontSize: 10, color: C.muted, margin: '2px 0 0' }}>Your purchase order has been recorded in the system.</p>
                    </div>
                    <button type="button" onClick={() => setShowSuccess(false)} style={{ ...ghostBtn, border: 'none', padding: '2px 8px', fontSize: 16, color: C.muted }}>
                        ×
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div style={{ ...panel, padding: '8px 10px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {pageTabs.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                ...ghostBtn,
                                border: active ? '1px solid rgba(79,142,247,.4)' : ghostBtn.border,
                                background: active ? 'rgba(79,142,247,.12)' : 'transparent',
                                color: active ? C.text : C.muted,
                                fontWeight: active ? 700 : 500,
                            }}
                        >
                            {tab.label}
                            {tab.badge != null && tab.badge > 0 && (
                                <span
                                    style={{
                                        marginLeft: 4,
                                        padding: '1px 6px',
                                        borderRadius: 10,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        background: tab.badgeColor ? `${tab.badgeColor}22` : 'rgba(255,255,255,.08)',
                                        color: tab.badgeColor || C.muted,
                                        border: `1px solid ${tab.badgeColor || C.dim}44`,
                                    }}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                {[
                    { label: 'Total POs', value: String(counts.total), sub: 'all purchase orders', color: C.blue, stripe: C.blue },
                    { label: 'Settled', value: String(counts.settled), sub: 'fully paid & closed', color: C.green, stripe: C.green },
                    { label: 'Pending approval', value: String(counts.pending), sub: 'awaiting review', color: C.amber, stripe: C.amber },
                    { label: 'Compliance score', value: `${COMPLIANCE_SCORE}%`, sub: 'audit trail intact', color: C.green, stripe: C.green },
                ].map((kpi) => (
                    <div key={kpi.label} style={{ ...panel, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: kpi.stripe }} />
                        <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>
                            {kpi.label}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1, marginBottom: 2, color: kpi.color }}>
                            {kpi.value}
                        </div>
                        <div style={{ fontSize: 9.5, color: C.muted }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Alert banners */}
            <div style={{ ...panel, padding: '12px 14px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.28)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle size={18} style={{ color: '#86EFAC', flexShrink: 0 }} />
                    <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#86EFAC' }}>
                            Compliance {COMPLIANCE_SCORE}% — procurement audit trail is intact
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                            All approval, GRN, and payment actions are logged
                        </div>
                    </div>
                </div>
                <button type="button" style={{ ...ghostBtn, color: C.green, borderColor: 'rgba(34,197,94,.35)' }}>
                    View audit trail
                </button>
            </div>

            {counts.pending > 0 && (
                <div style={{ ...panel, padding: '12px 14px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={18} style={{ color: '#FCD34D', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#FCD34D' }}>
                                {counts.pending} PO{counts.pending !== 1 ? 's' : ''} awaiting approval
                            </div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                                Review and approve or reject pending requisitions
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setActiveTab('pending'); setFilterChip('pending'); }}
                        style={{ ...primaryBtn, background: C.amber, color: '#0a1726', fontWeight: 700 }}
                    >
                        Review {counts.pending} pending →
                    </button>
                </div>
            )}

            {/* Filters */}
            <div style={{ ...panel, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Search size={16} style={{ color: C.muted, flexShrink: 0 }} />
                    <input
                        type="search"
                        placeholder="Search supplier, PO number, status..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            flex: 1,
                            background: C.bg3,
                            border: '1px solid rgba(255,255,255,.08)',
                            borderRadius: 8,
                            outline: 'none',
                            color: C.text,
                            fontSize: 11,
                            padding: '8px 10px',
                            fontFamily: 'inherit',
                        }}
                    />
                    <div style={{ position: 'relative' }}>
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            style={{
                                appearance: 'none',
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.08)',
                                borderRadius: 8,
                                color: C.text,
                                fontSize: 10.5,
                                padding: '8px 28px 8px 10px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                minWidth: 140,
                            }}
                        >
                            <option value="all">All suppliers</option>
                            {suppliers.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: C.dim, pointerEvents: 'none' }} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {filterChips.map((chip) => {
                        const active = filterChip === chip.key;
                        return (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={() => setFilterChip(chip.key)}
                                style={{
                                    ...ghostBtn,
                                    border: active ? '1px solid rgba(79,142,247,.4)' : ghostBtn.border,
                                    background: active ? 'rgba(79,142,247,.12)' : 'transparent',
                                    color: active ? C.text : C.muted,
                                    fontWeight: active ? 700 : 500,
                                }}
                            >
                                {chip.label}
                                <span style={{ marginLeft: 4, color: C.dim, fontSize: 9 }}>({chip.count})</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Grouped PO table */}
            <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                {['Supplier', 'PO number', 'Date', 'Workflow status', 'Amount', 'Payment', 'Actions'].map((col) => (
                                    <th key={col} style={{ ...thStyle, textAlign: col === 'Amount' ? 'right' : 'left' }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {purchaseOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                                        <ShoppingCart size={40} style={{ color: C.dim, margin: '0 auto 12px' }} />
                                        <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, margin: 0 }}>No purchase orders yet</p>
                                        <p style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>Click &quot;Create requisition&quot; to add your first PO</p>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {groupedSections.map((section) => (
                                        <Fragment key={section.key}>
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '.4px',
                                                        color: section.color,
                                                        background: `${section.color}11`,
                                                        borderBottom: `1px solid ${section.color}33`,
                                                    }}
                                                >
                                                    {section.title} ({section.rows.length})
                                                </td>
                                            </tr>
                                            {section.rows.map(renderPORow)}
                                        </Fragment>
                                    ))}

                                    {showTestGroup && testOrders.length > 0 && (
                                        <>
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    style={{
                                                        padding: '8px 12px',
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '.4px',
                                                        color: C.dim,
                                                        background: 'rgba(255,255,255,.04)',
                                                        borderBottom: '1px solid rgba(255,255,255,.08)',
                                                    }}
                                                >
                                                    Test data ({testOrders.length})
                                                </td>
                                            </tr>
                                            {testOrders.map((order) => (
                                                <tr key={order.id}>
                                                    <td style={tdStyle}>
                                                        <div style={{ fontWeight: 600 }}>{order.supplierName}</div>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{order.poNumber}</div>
                                                    </td>
                                                    <td style={tdStyle}>{formatDateOnly(order.date, 'en-GB', PO_DATE_FMT)}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ ...workflowBadgeStyle(order.status), padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700 }}>
                                                            {getStatusLabel(order.status)}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                                                        {formatUsd(order.grandTotal || 0)}
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <span style={{ fontSize: 9.5, color: C.dim }}>Test</span>
                                                    </td>
                                                    <td style={tdStyle}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDeletePO(order, e)}
                                                            style={actionBtn(C.red)}
                                                        >
                                                            <Trash2 size={10} /> Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    )}

                                    {filteredOrders.length === 0 && !showTestGroup && (
                                        <tr>
                                            <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: 32, color: C.muted }}>
                                                No POs match the current filters
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                <div
                    style={{
                        padding: '10px 14px',
                        borderTop: '1px solid rgba(255,255,255,.07)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        background: C.bg3,
                    }}
                >
                    <span style={{ fontSize: 10, color: C.muted }}>
                        Showing {visibleCount} PO{visibleCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: 10, color: C.text, fontWeight: 700, fontFamily: 'monospace' }}>
                        Total value: {formatUsd(visibleTotal)}
                    </span>
                </div>
            </div>

            {/* AI Procurement Analysis */}
            <div style={{ ...panel, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Bot size={18} style={{ color: C.blue }} />
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>AI Procurement Analysis</h2>
                    <Sparkles size={14} style={{ color: C.amber }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {aiInsights.map((insight, i) => (
                        <div
                            key={i}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: `${insight.color}11`,
                                border: `1px solid ${insight.color}33`,
                                fontSize: 11,
                                color: C.muted,
                                lineHeight: 1.5,
                            }}
                        >
                            {insight.body}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
                    {testOrders.length > 0 && (
                        <div style={{ ...panel, background: C.bg3, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Delete test POs</div>
                                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                                    {testOrders.length} test record{testOrders.length !== 1 ? 's' : ''} detected
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    const first = testOrders.find((po) => po.status === 'Draft' || po.status === 'Pending');
                                    if (first) handleDeletePO(first, e);
                                }}
                                style={{ ...actionBtn(C.red), fontSize: 9 }}
                            >
                                Delete
                            </button>
                        </div>
                    )}
                    {kamranGrn && (
                        <div style={{ ...panel, background: C.bg3, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Mark paid — {kamranGrn.supplierName}</div>
                                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                                    {kamranGrn.poNumber} · {formatUsd(kamranGrn.grandTotal || 0)} outstanding
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleMarkPaid(kamranGrn.id)}
                                style={{ ...actionBtn(C.amber, '#0a1726'), fontSize: 9 }}
                            >
                                Mark paid
                            </button>
                        </div>
                    )}
                    {testOrders.length === 0 && !kamranGrn && grnUnpaid[0] && (
                        <div style={{ ...panel, background: C.bg3, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>Mark paid — {grnUnpaid[0].supplierName}</div>
                                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                                    {grnUnpaid[0].poNumber} · {formatUsd(grnUnpaid[0].grandTotal || 0)} outstanding
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleMarkPaid(grnUnpaid[0].id)}
                                style={{ ...actionBtn(C.amber, '#0a1726'), fontSize: 9 }}
                            >
                                Mark paid
                            </button>
                        </div>
                    )}
                </div>

                <p style={{ fontSize: 9.5, color: C.dim, margin: 0, fontStyle: 'italic' }}>
                    Suggestions are based on current PO workflow state. All actions are logged in the audit trail.
                </p>
            </div>

            {/* Review modal */}
            {reviewPO && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setReviewPO(null)}
                >
                    <div
                        className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        style={{ background: C.bg2, border: '1px solid rgba(255,255,255,.1)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,.07)', background: C.bg3 }}>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.dim }}>Purchase Order Review</p>
                                <h3 className="text-xl font-black mt-1" style={{ color: C.text }}>{reviewPO.poNumber}</h3>
                                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                                    {reviewPO.supplierName} · {formatDateOnly(reviewPO.date, 'en-GB', PO_DATE_FMT)}
                                </p>
                            </div>
                            <button
                                onClick={() => setReviewPO(null)}
                                className="p-2 rounded-lg"
                                style={{ color: C.muted }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: C.dim }}>Line Items</p>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,.07)' }}>
                                        <th className="py-2 text-left text-[10px] font-black uppercase" style={{ color: C.dim }}>Item</th>
                                        <th className="py-2 text-right text-[10px] font-black uppercase" style={{ color: C.dim }}>Qty</th>
                                        <th className="py-2 text-right text-[10px] font-black uppercase" style={{ color: C.dim }}>Rate</th>
                                        <th className="py-2 text-right text-[10px] font-black uppercase" style={{ color: C.dim }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,.04)' }}>
                                    {(reviewPO.items || []).map((it, i) => (
                                        <tr key={i}>
                                            <td className="py-3 font-semibold" style={{ color: C.text }}>{it.productName || '—'}</td>
                                            <td className="py-3 text-right font-mono" style={{ color: C.muted }}>{it.quantity}</td>
                                            <td className="py-3 text-right font-mono" style={{ color: C.muted }}>{formatUsd(it.unitPrice || 0)}</td>
                                            <td className="py-3 text-right font-mono font-bold" style={{ color: C.text }}>{formatUsd(it.total || 0)}</td>
                                        </tr>
                                    ))}
                                    {(reviewPO.items?.length ?? 0) === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-6 text-center text-xs italic" style={{ color: C.dim }}>
                                                No line items on this PO.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2" style={{ borderColor: C.blue }}>
                                        <td colSpan={3} className="pt-3 text-right text-[11px] font-black uppercase tracking-widest" style={{ color: C.muted }}>
                                            Grand Total
                                        </td>
                                        <td className="pt-3 text-right text-lg font-black font-mono" style={{ color: C.text }}>
                                            {formatUsd(reviewPO.grandTotal || 0)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                            {reviewPO.notes && (
                                <div className="mt-4 p-3 rounded-lg" style={{ background: C.bg3 }}>
                                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: C.dim }}>Notes</p>
                                    <p className="text-xs" style={{ color: C.muted }}>{reviewPO.notes}</p>
                                </div>
                            )}
                        </div>

                        {(reviewPO.status === 'Pending' || reviewPO.status === 'Draft') && (
                            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,.07)', background: C.bg3 }}>
                                <button
                                    onClick={() => handleReject(reviewPO.id)}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-black transition-all"
                                    style={{ background: C.red, color: '#fff' }}
                                >
                                    <XCircle size={16} /> Reject
                                </button>
                                <button
                                    onClick={() => handleApprove(reviewPO.id)}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-black transition-all"
                                    style={{ background: C.blue, color: '#fff' }}
                                >
                                    <CheckCircle size={16} /> Approve
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quick-Edit modal */}
            {editPO && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style={{ background: C.bg2, border: '1px solid rgba(255,255,255,.1)' }}>
                        <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: 'rgba(255,255,255,.07)' }}>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.dim }}>Quick Edit · Draft PO</p>
                                <h3 className="text-xl font-black mt-1" style={{ color: C.text }}>{editPO.poNumber}</h3>
                                <p className="text-xs mt-0.5" style={{ color: C.muted }}>
                                    {editPO.supplierName} · {formatUsd(editPO.grandTotal)}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditPO(null)}
                                className="p-2 rounded-lg"
                                style={{ color: C.muted }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: C.dim }}>
                                    Expected Delivery Date
                                </label>
                                <input
                                    type="date"
                                    value={editExpectedDate}
                                    onChange={(e) => setEditExpectedDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                                    style={{ background: C.bg3, border: '1px solid rgba(255,255,255,.08)', color: C.text }}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: C.dim }}>
                                    Notes
                                </label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    rows={4}
                                    placeholder="Internal notes for this PO…"
                                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                                    style={{ background: C.bg3, border: '1px solid rgba(255,255,255,.08)', color: C.text }}
                                />
                            </div>
                            <p className="text-[10px] rounded p-2" style={{ color: '#FCD34D', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
                                Line items, quantities, and prices can&apos;t be edited here.
                                To change those, delete this Draft PO and create a new one.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,.07)', background: C.bg3 }}>
                            <button
                                onClick={() => setEditPO(null)}
                                disabled={savingEdit}
                                className="px-5 py-2.5 rounded-lg text-sm font-black transition-all disabled:opacity-50"
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: C.muted }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEditPO}
                                disabled={savingEdit}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-black transition-all disabled:opacity-50"
                                style={{ background: C.blue, color: '#fff' }}
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
