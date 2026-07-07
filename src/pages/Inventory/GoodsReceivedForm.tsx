import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Inbox,
    CheckCircle,
    Check,
    Lightbulb,
    Warehouse,
    Shield,
    Calendar,
    AlertTriangle,
    Save,
    Trash2,
    Printer,
} from 'lucide-react';
import {
    getGRNById,
    createGRNFromPO,
    saveGRN,
    postGRN,
    deleteGRN,
    getPendingPurchaseOrders,
    type GRN,
    type GRNItem,
    type PostGRNResult,
} from '../../services/grnService';
import { type PurchaseOrder } from '../../services/purchasesService';
import { getCurrentUser } from '../../store/authStore';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
    orange: '#FF9900',
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
    background: C.green,
    color: '#fff',
    fontWeight: 600,
    justifyContent: 'center',
    width: '100%',
    padding: '10px 14px',
    fontSize: 11,
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

const inputStyle: CSSProperties = {
    width: '100%',
    background: C.bg3,
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8,
    outline: 'none',
    color: C.text,
    fontSize: 11,
    fontFamily: 'inherit',
    padding: '8px 10px',
    boxSizing: 'border-box',
};

type ConditionKey = 'good' | 'minor' | 'damaged' | 'partial';

const CONDITION_OPTIONS: { key: ConditionKey; label: string; color: string }[] = [
    { key: 'good', label: 'Good condition', color: C.green },
    { key: 'minor', label: 'Minor damage', color: C.amber },
    { key: 'damaged', label: 'Damaged reject', color: C.red },
    { key: 'partial', label: 'Partial shipment', color: C.blue },
];

function formatUsd(n: number): string {
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDisplayDate(raw: string): string {
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AQ';
}

function conditionLabel(key: ConditionKey): string {
    return CONDITION_OPTIONS.find((o) => o.key === key)?.label ?? 'Good condition';
}

function SectionHeader({ num, title }: { num: number; title: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span
                style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(79,142,247,.15)',
                    border: '1px solid rgba(79,142,247,.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.blue,
                    flexShrink: 0,
                }}
            >
                {num}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{title}</span>
        </div>
    );
}

export default function GoodsReceivedForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const poIdParam = searchParams.get('poId')?.trim() || '';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [posting, setPosting] = useState(false);

    const [grn, setGRN] = useState<GRN | null>(null);
    const [items, setItems] = useState<GRNItem[]>([]);
    const [warehouse, setWarehouse] = useState('Main Warehouse');
    const [freightCost, setFreightCost] = useState(0);
    const [notes, setNotes] = useState('');

    const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
    const [selectedPOId, setSelectedPOId] = useState('');
    const [showPOSelector, setShowPOSelector] = useState(false);
    const [poQueryUnavailable, setPoQueryUnavailable] = useState(false);

    const [condition, setCondition] = useState<ConditionKey>('good');
    const [deliveryNote, setDeliveryNote] = useState('');

    const currentUser = getCurrentUser();
    const todayLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    useEffect(() => {
        loadData();
    }, [id, poIdParam]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (id && id !== 'new') {
                const grnData = await getGRNById(id);
                if (grnData) {
                    setGRN(grnData);
                    setItems(grnData.items);
                    setWarehouse(grnData.warehouse);
                    setFreightCost(grnData.freightCost);
                    setNotes(grnData.notes || '');
                } else {
                    alert('GRN not found');
                    navigate('/receiving');
                }
            } else {
                const pos = await getPendingPurchaseOrders();
                setPendingPOs(pos);
                setShowPOSelector(true);
                setPoQueryUnavailable(false);
                if (pos.length > 0) {
                    const matched = poIdParam && pos.find((p) => String(p.id) === poIdParam);
                    if (matched) {
                        setSelectedPOId(String(matched.id));
                    } else {
                        if (poIdParam) setPoQueryUnavailable(true);
                        setSelectedPOId(pos[0].id);
                    }
                } else {
                    setSelectedPOId('');
                    if (poIdParam) setPoQueryUnavailable(true);
                }
            }
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFromPO = async () => {
        if (!selectedPOId) {
            alert('Please select a Purchase Order');
            return;
        }

        setPosting(true);
        try {
            const newGRN = await createGRNFromPO(selectedPOId, warehouse);
            setGRN(newGRN);
            setItems(newGRN.items);
            setShowPOSelector(false);
        } catch (error: any) {
            console.error('Error creating GRN:', error);
            alert(error.message || 'Error creating GRN');
        } finally {
            setPosting(false);
        }
    };

    const truncateNames = (xs: string[]) =>
        xs.length <= 5 ? xs.join(', ') : `${xs.slice(0, 5).join(', ')} +${xs.length - 5} more`;

    const showPostResultAlerts = (result: PostGRNResult) => {
        const failNames = result.failures.map((f) => f.productName || f.productId);
        const skippedNoProduct = result.skipped
            .filter((s) => s.reason === 'no-productId')
            .map((s) => s.productName || '(unnamed line)');

        if (result.failures.length === 0 && skippedNoProduct.length === 0) {
            alert('✅ GRN posted successfully! Inventory has been updated.');
        } else if (result.failures.length === 0) {
            alert(
                `⚠️ GRN posted. ${result.succeeded}/${result.attempted} items updated. ${skippedNoProduct.length} line(s) had no product link and were skipped:\n\n${truncateNames(skippedNoProduct)}`,
            );
        } else if (result.succeeded === 0) {
            alert(`❌ GRN posted but NO stock was updated. ${result.failures.length} item(s) failed:\n\n${truncateNames(failNames)}`);
        } else {
            alert(`⚠️ Stock updated for ${result.succeeded}/${result.attempted} items. Failed:\n\n${truncateNames(failNames)}`);
        }
    };

    const saveDraftForPost = async (draft: GRN, draftItems: GRNItem[]) => {
        const goodsValue = draftItems.reduce((sum, item) => sum + item.totalCost, 0);
        const landed = goodsValue + freightCost;
        await saveGRN({
            id: draft.id,
            items: draftItems,
            warehouse,
            freightCost,
            goodsValue,
            landedCost: landed,
            notes,
        });
    };

    const buildUnlinkedWarning = (lines: { productName?: string }[]) => {
        const names = lines.map((it) => it.productName || '(unnamed line)');
        const list =
            names.length <= 5
                ? names.join('\n  • ')
                : `${names.slice(0, 5).join('\n  • ')}\n  • +${names.length - 5} more`;
        return `⚠️ Warning — ${lines.length} line(s) have no product linked and will NOT update inventory:\n\n  • ${list}\n\nOnly linked items will affect stock.\n\nContinue anyway?`;
    };

    const handleCreateAndPostFull = async () => {
        if (!selectedPOId) {
            alert('Please select a Purchase Order');
            return;
        }

        const po = pendingPOs.find((p) => p.id === selectedPOId);
        const unlinked = (po?.items ?? []).filter((it) => !it.productId);
        if (unlinked.length > 0) {
            if (!window.confirm(buildUnlinkedWarning(unlinked))) return;
        }

        setPosting(true);
        let draft: GRN | null = null;
        try {
            draft = await createGRNFromPO(selectedPOId, warehouse);
            setGRN(draft);
            setItems(draft.items);
            setShowPOSelector(false);

            await saveDraftForPost(draft, draft.items);
            const result = await postGRN(draft.id);
            showPostResultAlerts(result);
            navigate('/receiving');
        } catch (error: any) {
            console.error('Error receiving goods:', error);
            alert(error.message || 'Error receiving goods');
            if (draft) {
                setGRN(draft);
                setItems(draft.items);
                setShowPOSelector(false);
            }
        } finally {
            setPosting(false);
        }
    };

    const handleReceiveAll = () => {
        const updated = items.map(item => ({
            ...item,
            receivedQty: item.orderedQty,
            acceptedQty: item.orderedQty,
            rejectedQty: 0,
            totalCost: item.orderedQty * item.unitCost
        }));
        setItems(updated);
    };

    const handleItemChange = (index: number, field: keyof GRNItem, value: any) => {
        const newItems = [...items];
        const item = newItems[index];

        (item as any)[field] = Number(value) || 0;

        if (field === 'receivedQty') {
            item.acceptedQty = item.receivedQty;
            item.rejectedQty = 0;
        }

        if (field === 'acceptedQty' || field === 'rejectedQty') {
            const total = item.acceptedQty + item.rejectedQty;
            if (total > item.receivedQty) {
                if (field === 'acceptedQty') {
                    item.rejectedQty = Math.max(0, item.receivedQty - item.acceptedQty);
                } else {
                    item.acceptedQty = Math.max(0, item.receivedQty - item.rejectedQty);
                }
            }
        }

        item.totalCost = item.acceptedQty * item.unitCost;

        setItems(newItems);
    };

    const handleSave = async () => {
        if (!grn) return;

        setSaving(true);
        try {
            const goodsValue = items.reduce((sum, item) => sum + item.totalCost, 0);
            const landedCost = goodsValue + freightCost;

            await saveGRN({
                id: grn.id,
                items,
                warehouse,
                freightCost,
                goodsValue,
                landedCost,
                notes
            });

            alert('GRN saved successfully');
        } catch (error: any) {
            console.error('Error saving GRN:', error);
            alert(error.message || 'Error saving GRN');
        } finally {
            setSaving(false);
        }
    };

    const handlePost = async () => {
        if (!grn) return;

        const totalReceived = items.reduce((sum, item) => sum + item.acceptedQty, 0);
        if (totalReceived === 0) {
            alert('Cannot post GRN with zero accepted quantity. Please receive at least one item.');
            return;
        }

        const acceptedItems = items.filter(it => it.acceptedQty > 0);
        const unlinked = acceptedItems.filter(it => !it.productId);
        let promptMsg = 'Are you sure you want to post this GRN? This will update inventory and cannot be undone.';
        if (unlinked.length > 0) {
            const names = unlinked.map(it => it.productName || '(unnamed line)');
            const list = names.length <= 5
                ? names.join('\n  • ')
                : `${names.slice(0, 5).join('\n  • ')}\n  • +${names.length - 5} more`;
            const linkedAccepted = acceptedItems.length - unlinked.length;
            promptMsg = `⚠️ Warning — ${unlinked.length} of ${acceptedItems.length} accepted line(s) have no product linked and will NOT update inventory:\n\n  • ${list}\n\nOnly ${linkedAccepted} item(s) will affect stock.\n\nContinue with post anyway?`;
        }
        const confirmed = window.confirm(promptMsg);

        if (!confirmed) return;

        setPosting(true);
        try {
            await saveDraftForPost(grn, items);
            const result = await postGRN(grn.id);
            showPostResultAlerts(result);
            navigate('/receiving');
        } catch (error: any) {
            console.error('Error posting GRN:', error);
            alert(error.message || 'Error posting GRN');
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = async () => {
        if (!grn) return;

        const confirmed = window.confirm('Are you sure you want to delete this GRN?');
        if (!confirmed) return;

        try {
            await deleteGRN(grn.id);
            alert('GRN deleted successfully');
            navigate('/receiving');
        } catch (error: any) {
            console.error('Error deleting GRN:', error);
            alert(error.message || 'Error deleting GRN');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const goodsValue = items.reduce((sum, item) => sum + item.totalCost, 0);
    const landedCost = goodsValue + freightCost;
    const totalReceived = items.reduce((sum, item) => sum + item.receivedQty, 0);
    const totalAccepted = items.reduce((sum, item) => sum + item.acceptedQty, 0);

    const selectedPO = useMemo(
        () => pendingPOs.find((po) => po.id === selectedPOId) ?? null,
        [pendingPOs, selectedPOId],
    );

    const activePO = useMemo(() => {
        if (grn) {
            return pendingPOs.find((po) => po.id === grn.poId) ?? {
                id: grn.poId,
                poNumber: grn.poReference,
                supplierName: 'Supplier',
                items: grn.items.map((i) => ({
                    productId: i.productId,
                    productName: i.productName,
                    uom: i.uom,
                    quantity: i.orderedQty,
                    unitPrice: i.unitCost,
                    taxRate: 0,
                    discount: 0,
                    total: i.orderedQty * i.unitCost,
                })),
                grandTotal: landedCost,
                date: grn.receivedDate,
                expectedDate: grn.receivedDate,
            } as PurchaseOrder;
        }
        return selectedPO;
    }, [grn, pendingPOs, selectedPO, landedCost]);

    const previewItems = useMemo(() => {
        if (items.length > 0) return items;
        if (!selectedPO) return [];
        return selectedPO.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.productId,
            uom: item.uom,
            orderedQty: item.quantity,
            receivedQty: item.quantity,
            acceptedQty: item.quantity,
            rejectedQty: 0,
            unitCost: item.unitPrice,
            totalCost: item.quantity * item.unitPrice,
        }));
    }, [items, selectedPO]);

    const allFullMatch = previewItems.length > 0 && previewItems.every((i) => i.receivedQty === i.orderedQty && i.receivedQty > 0);
    const hasMismatch = previewItems.some((i) => i.receivedQty !== i.orderedQty);
    const poSelected = Boolean(grn || selectedPOId);
    const isPosted = grn?.status === 'Posted';

    const handlePrimaryConfirm = async () => {
        if (showPOSelector && !grn) {
            await handleCreateAndPostFull();
        } else if (grn && !isPosted) {
            await handlePost();
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', background: C.bg, borderRadius: 12, minHeight: 320 }}>
                <div style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            border: `3px solid ${C.blue}`,
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                            margin: '0 auto 12px',
                        }}
                    />
                    <p style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        Loading receive goods...
                    </p>
                </div>
            </div>
        );
    }

    if (!showPOSelector && !grn) return null;

    return (
        <div
            style={{
                background: C.bg,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,.07)',
                fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                fontSize: 12,
                color: C.text,
            }}
        >
            {/* Header */}
            <div style={{ background: C.bg2, borderBottom: '1px solid rgba(255,255,255,.07)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/receiving')}
                        style={{ ...ghostBtn, padding: '5px 8px', fontSize: 10 }}
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted }}>
                            <Calendar size={11} /> {todayLabel}
                        </span>
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: 'rgba(79,142,247,.15)',
                                border: '1px solid rgba(79,142,247,.35)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 700,
                                color: C.blue,
                            }}
                            title={currentUser.name}
                        >
                            {userInitials(currentUser.name)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12 }}>
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: 'rgba(79,142,247,.12)',
                            border: '1px solid rgba(79,142,247,.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Inbox size={20} color={C.blue} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>
                            Receive goods
                        </h1>
                        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: C.muted }}>
                            Select a purchase order · confirm quantities · check condition · log to warehouse
                        </p>
                    </div>
                </div>
            </div>

            {/* Two-column body */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1.65fr) minmax(280px, 1fr)',
                    gap: 10,
                    padding: 10,
                    alignItems: 'start',
                }}
            >
                {/* LEFT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Section 1 — Select purchase order */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <SectionHeader num={1} title="Select purchase order" />

                        {showPOSelector && pendingPOs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <Inbox size={40} color={C.dim} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 4px' }}>No pending purchase orders</p>
                                <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>Create and approve a purchase order first</p>
                            </div>
                        ) : showPOSelector ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {poQueryUnavailable && (
                                    <p style={{ margin: 0, fontSize: 10, color: C.amber, lineHeight: 1.45 }}>
                                        That PO isn&apos;t available to receive — it may not be approved yet or was already received. Select another order below.
                                    </p>
                                )}
                                {pendingPOs.map((po, idx) => {
                                    const isSelected = selectedPOId === po.id;
                                    const isDisabledStyle = !isSelected && Boolean(selectedPOId);
                                    return (
                                        <label
                                            key={po.id}
                                            style={{
                                                display: 'block',
                                                padding: '12px 14px',
                                                borderRadius: 10,
                                                border: isSelected
                                                    ? `2px solid ${C.blue}`
                                                    : '1px solid rgba(255,255,255,.08)',
                                                background: isSelected ? 'rgba(79,142,247,.08)' : C.bg3,
                                                cursor: 'pointer',
                                                opacity: isDisabledStyle ? 0.45 : 1,
                                                transition: 'all .15s ease',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                <input
                                                    type="radio"
                                                    name="po-select"
                                                    checked={isSelected}
                                                    onChange={() => setSelectedPOId(po.id)}
                                                    style={{ marginTop: 3, accentColor: C.blue }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{po.poNumber}</span>
                                                        {isSelected && (
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 5,
                                                                    padding: '3px 8px',
                                                                    borderRadius: 20,
                                                                    background: 'rgba(255,153,0,.12)',
                                                                    border: '1px solid rgba(255,153,0,.35)',
                                                                    fontSize: 9,
                                                                    fontWeight: 600,
                                                                    color: '#FCD34D',
                                                                }}
                                                            >
                                                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.orange }} />
                                                                Pending receipt
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>
                                                        {po.supplierName} · {po.items.length} item{po.items.length !== 1 ? 's' : ''} · {formatUsd(po.grandTotal || 0)}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>
                                                        Ordered {formatDisplayDate(po.date)} · Expected {formatDisplayDate(po.expectedDate)}
                                                    </div>
                                                </div>
                                                {isSelected && <CheckCircle size={18} color={C.blue} style={{ flexShrink: 0 }} />}
                                            </div>
                                            {idx === 1 && !isSelected && (
                                                <div style={{ fontSize: 9, color: C.dim, marginTop: 6, marginLeft: 22 }}>
                                                    Awaiting prior receipt completion
                                                </div>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: 10,
                                    border: `2px solid ${C.blue}`,
                                    background: 'rgba(79,142,247,.08)',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{grn?.poReference}</div>
                                        <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>
                                            {activePO?.supplierName} · {items.length} item{items.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <CheckCircle size={18} color={C.blue} />
                                </div>
                            </div>
                        )}

                        <div
                            style={{
                                marginTop: 12,
                                padding: '10px 12px',
                                borderRadius: 8,
                                background: 'rgba(245,158,11,.08)',
                                border: '1px solid rgba(245,158,11,.2)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                            }}
                        >
                            <Lightbulb size={14} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                            <p style={{ margin: 0, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                                Only approved POs awaiting receipt appear here. Select the PO that matches the physical delivery note from your supplier.
                            </p>
                        </div>
                    </div>

                    {/* Section 2 — Confirm quantities received */}
                    <div style={{ ...panel, padding: '14px 16px', opacity: poSelected ? 1 : 0.55 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <SectionHeader num={2} title="Confirm quantities received" />
                            {poSelected && (
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '4px 8px',
                                        borderRadius: 20,
                                        background: 'rgba(34,197,94,.12)',
                                        border: '1px solid rgba(34,197,94,.3)',
                                        fontSize: 9,
                                        fontWeight: 600,
                                        color: C.green,
                                    }}
                                >
                                    <Check size={10} /> PO selected
                                </span>
                            )}
                        </div>

                        <p style={{ margin: '0 0 12px', fontSize: 10.5, color: C.muted }}>
                            Enter the quantity physically received for each line. Match PO qty for a full delivery.
                        </p>

                        {!poSelected ? (
                            <p style={{ fontSize: 10, color: C.dim, textAlign: 'center', padding: '20px 0' }}>
                                Select a purchase order above to confirm quantities
                            </p>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={thStyle}>Product / SKU</th>
                                                <th style={{ ...thStyle, textAlign: 'center' }}>PO qty</th>
                                                <th style={{ ...thStyle, textAlign: 'center' }}>Received</th>
                                                <th style={{ ...thStyle, textAlign: 'right' }}>Unit cost</th>
                                                <th style={{ ...thStyle, textAlign: 'center' }}>Match</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewItems.map((item, index) => {
                                                const isMatch = item.receivedQty === item.orderedQty && item.receivedQty > 0;
                                                const editable = grn && !isPosted;
                                                return (
                                                    <tr key={index}>
                                                        <td style={tdStyle}>
                                                            <div style={{ fontWeight: 600 }}>{item.productName}</div>
                                                            <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{item.sku}</div>
                                                        </td>
                                                        <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace' }}>{item.orderedQty}</td>
                                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                            {editable ? (
                                                                <input
                                                                    type="number"
                                                                    value={item.receivedQty}
                                                                    onChange={(e) => handleItemChange(index, 'receivedQty', e.target.value)}
                                                                    style={{ ...inputStyle, width: 72, textAlign: 'center', padding: '6px 8px' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontFamily: 'monospace' }}>{item.receivedQty}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{formatUsd(item.unitCost)}</td>
                                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                            {isMatch ? (
                                                                <CheckCircle size={16} color={C.green} style={{ margin: '0 auto' }} />
                                                            ) : item.receivedQty > 0 ? (
                                                                <AlertTriangle size={16} color={C.amber} style={{ margin: '0 auto' }} />
                                                            ) : (
                                                                <span style={{ color: C.dim }}>—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {grn && !isPosted && (
                                    <button
                                        type="button"
                                        onClick={handleReceiveAll}
                                        style={{ ...ghostBtn, marginTop: 10, fontSize: 10, color: C.green, borderColor: 'rgba(34,197,94,.3)' }}
                                    >
                                        Receive all quantities
                                    </button>
                                )}

                                {allFullMatch && !grn && poSelected && (
                                    <div
                                        style={{
                                            marginTop: 12,
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            background: 'rgba(79,142,247,.08)',
                                            border: '1px solid rgba(79,142,247,.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                    >
                                        <CheckCircle size={16} color={C.blue} />
                                        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.blue }}>
                                            Ready to receive full order — confirm below to post to inventory
                                        </span>
                                    </div>
                                )}

                                {allFullMatch && grn && !isPosted && (
                                    <div
                                        style={{
                                            marginTop: 12,
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            background: 'rgba(34,197,94,.1)',
                                            border: '1px solid rgba(34,197,94,.25)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                        }}
                                    >
                                        <CheckCircle size={16} color={C.green} />
                                        <span style={{ fontSize: 10.5, fontWeight: 600, color: C.green }}>
                                            Full delivery — all received quantities match the purchase order
                                        </span>
                                    </div>
                                )}

                                {hasMismatch && grn && !isPosted && (
                                    <div
                                        style={{
                                            marginTop: 12,
                                            padding: '10px 12px',
                                            borderRadius: 8,
                                            background: 'rgba(245,158,11,.08)',
                                            border: '1px solid rgba(245,158,11,.2)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 8,
                                        }}
                                    >
                                        <AlertTriangle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                                        <span style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                                            Received quantity does not match ordered quantity for one or more items. Verify before confirming.
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Section 3 — Condition check */}
                    <div style={{ ...panel, padding: '14px 16px', opacity: poSelected ? 1 : 0.55 }}>
                        <SectionHeader num={3} title="Condition check" />

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                            {CONDITION_OPTIONS.map((opt) => {
                                const active = condition === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => setCondition(opt.key)}
                                        disabled={!poSelected || isPosted}
                                        style={{
                                            ...ghostBtn,
                                            padding: '8px 12px',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            borderColor: active ? `${opt.color}66` : 'rgba(255,255,255,.12)',
                                            background: active ? `${opt.color}18` : 'transparent',
                                            color: active ? opt.color : C.muted,
                                            opacity: !poSelected || isPosted ? 0.5 : 1,
                                            cursor: !poSelected || isPosted ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.dim, marginBottom: 5 }}>
                                Delivery note
                            </label>
                            <input
                                type="text"
                                value={deliveryNote}
                                onChange={(e) => setDeliveryNote(e.target.value)}
                                disabled={!poSelected || isPosted}
                                placeholder="Supplier delivery note / reference number"
                                style={inputStyle}
                            />
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.dim, marginBottom: 5 }}>
                                Receiving warehouse
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Warehouse size={14} color={C.dim} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                                <select
                                    value={warehouse}
                                    onChange={(e) => setWarehouse(e.target.value)}
                                    disabled={isPosted}
                                    style={{ ...inputStyle, paddingLeft: 32, cursor: isPosted ? 'not-allowed' : 'pointer' }}
                                >
                                    <option>Main Warehouse</option>
                                    <option>North Warehouse</option>
                                    <option>South Distribution Center</option>
                                    <option>East Depot</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.dim, marginBottom: 5 }}>
                                Notes <span style={{ fontWeight: 500, textTransform: 'none', color: C.dim }}>(optional)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={isPosted}
                                rows={3}
                                placeholder="Any additional notes about this receipt..."
                                style={{ ...inputStyle, resize: 'none' }}
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN — Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Receipt summary */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 12 }}>Receipt summary</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                { label: 'PO number', value: activePO?.poNumber ?? grn?.poReference ?? '—' },
                                { label: 'Supplier', value: activePO?.supplierName ?? '—' },
                                { label: 'Items on PO', value: String(activePO?.items.length ?? items.length ?? 0) },
                                { label: 'Items received', value: String(totalReceived || totalAccepted || 0) },
                                { label: 'Condition', value: conditionLabel(condition) },
                                { label: 'Warehouse', value: warehouse },
                            ].map((row) => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10.5 }}>
                                    <span style={{ color: C.muted }}>{row.label}</span>
                                    <span style={{ color: C.text, fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.dim, marginBottom: 4 }}>
                                Receipt value
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: C.green, letterSpacing: '-.02em' }}>
                                {formatUsd(goodsValue || activePO?.grandTotal || 0)}
                            </div>
                        </div>
                    </div>

                    {/* What happens when you confirm */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10 }}>What happens when you confirm</div>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                'GRN record created and linked to the purchase order',
                                'Warehouse stock increased for each accepted line item',
                                'PO status updated to Goods Received (GRN)',
                                'Landed cost recorded for inventory valuation',
                                'Audit trail entry logged with your user ID and timestamp',
                            ].map((text) => (
                                <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 10, color: C.muted, lineHeight: 1.45 }}>
                                    <Check size={12} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Action buttons */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        {!isPosted && (
                            <button
                                type="button"
                                onClick={handlePrimaryConfirm}
                                disabled={posting || (!showPOSelector && !grn) || (showPOSelector && !selectedPOId)}
                                style={{
                                    ...primaryBtn,
                                    opacity: posting || (showPOSelector && !selectedPOId) ? 0.55 : 1,
                                    cursor: posting || (showPOSelector && !selectedPOId) ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {posting ? 'Confirming...' : 'Confirm goods received'}
                            </button>
                        )}
                        {showPOSelector && !grn && selectedPOId && !isPosted && (
                            <button
                                type="button"
                                onClick={handleCreateFromPO}
                                disabled={posting}
                                style={{
                                    ...ghostBtn,
                                    width: '100%',
                                    justifyContent: 'center',
                                    marginTop: 8,
                                    padding: '9px 14px',
                                    fontSize: 10,
                                    color: C.muted,
                                    opacity: posting ? 0.55 : 1,
                                    cursor: posting ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Adjust quantities before receiving
                            </button>
                        )}
                        {isPosted && (
                            <div
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    background: 'rgba(34,197,94,.1)',
                                    border: '1px solid rgba(34,197,94,.25)',
                                    textAlign: 'center',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: C.green,
                                    marginBottom: 8,
                                }}
                            >
                                <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                Posted — inventory updated
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => navigate('/receiving')}
                            style={{ ...ghostBtn, width: '100%', justifyContent: 'center', marginTop: 8, padding: '9px 14px', fontSize: 11 }}
                        >
                            Cancel — go back
                        </button>

                        {grn && !isPosted && (
                            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                                <button type="button" onClick={handleSave} disabled={saving} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', fontSize: 10 }}>
                                    <Save size={12} /> {saving ? 'Saving...' : 'Save draft'}
                                </button>
                                <button type="button" onClick={handlePrint} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', fontSize: 10 }}>
                                    <Printer size={12} /> Print
                                </button>
                                <button type="button" onClick={handleDelete} style={{ ...ghostBtn, flex: 1, justifyContent: 'center', fontSize: 10, color: C.red, borderColor: 'rgba(239,68,68,.3)' }}>
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Audit trail footer */}
                    <div
                        style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: 'rgba(79,142,247,.06)',
                            border: '1px solid rgba(79,142,247,.15)',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                        }}
                    >
                        <Shield size={14} color={C.blue} style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 9.5, color: C.muted, lineHeight: 1.5 }}>
                            All receipt confirmations are logged in the audit trail with user ID, timestamp, and PO reference for compliance.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
