import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    ShoppingCart,
    CheckCircle,
    Warehouse,
    Sparkles,
    Bot,
    Calendar,
    X,
    Check,
} from 'lucide-react';
import { getSuppliers, createSupplier, getSupplierBalance, createPurchaseOrder, type Supplier, type PurchaseOrderItem } from '../../services/purchasesService';
import { getProducts, type Product } from '../../services/api';
import { PAYMENT_METHODS } from '../../constants/data';
import SearchableSelect from '../../components/common/SearchableSelect';
import { getCurrentUser } from '../../store/authStore';

interface POLineItem {
    id: string;
    productId: string;
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

interface POFormData {
    supplierId: string;
    supplierName: string;
    poNumber: string;
    date: string;
    expectedDate: string;
    lineItems: POLineItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    grandTotal: number;
    notes: string;
    paymentStatus: 'Paid' | 'Unpaid' | 'Advance Paid';
    paymentMethod: string;
    amountPaid: number;
    remainingBalance: number;
    paymentReference: string;
    status: 'Pending' | 'Approved' | 'GRN' | 'Paid' | 'Received';
    autoApprove: boolean;
}

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
    orange: '#FF9900',
    purple: '#9B6FE4',
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

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.5px',
    color: C.dim,
    marginBottom: 5,
};

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

function hashNum(seed: string, min: number, max: number): number {
    const h = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return min + (h % (max - min + 1));
}

function derivePerformance(s: Supplier): number {
    if (s.rating === 'A') return 94;
    if (s.rating === 'B') return 88;
    if (s.rating === 'C') return 72;
    return hashNum(s.id || s.name, 68, 96);
}

function deriveLeadTime(s: Supplier): string {
    if (/cod|cash/i.test(s.paymentTerms || '')) return 'COD';
    const min = hashNum(s.id + 'lt', 3, 10);
    const max = min + hashNum(s.name, 5, 11);
    if (max - min >= 7) return `${min}-${max} days`;
    return `${min}-${min + 4} days`;
}

function deriveRegion(s: Supplier): string {
    const addr = (s.address || '').toLowerCase();
    if (/uae|dubai|abu/i.test(addr)) return 'Middle East';
    if (/uk|london|england/i.test(addr)) return 'United Kingdom';
    if (/usa|texas|california|ny/i.test(addr)) return 'North America';
    const regions = ['North America', 'Europe', 'Asia Pacific', 'Middle East'];
    return regions[hashNum(s.id || s.name, 0, regions.length)];
}

function parseNetDays(terms: string): number {
    const m = terms.match(/net\s*(\d+)/i);
    if (m) return Number(m[1]) || 30;
    if (/cod|cash/i.test(terms)) return 0;
    return 30;
}

function daysBetween(from: string, to: string): number {
    try {
        const a = new Date(from.includes('T') ? from : `${from}T12:00:00`);
        const b = new Date(to.includes('T') ? to : `${to}T12:00:00`);
        return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
    } catch {
        return 7;
    }
}

function userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AQ';
}

const WORKFLOW_STEPS = ['Draft', 'Pending', 'Approved', 'Received', 'Paid'] as const;

export default function PurchaseOrderForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const [suppliers, setSuppliers] = useState<(Supplier & { balance: number })[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showNewSupplier, setShowNewSupplier] = useState(false);
    const [newSupName, setNewSupName] = useState('');
    const [newSupPhone, setNewSupPhone] = useState('');
    const [newSupAddress, setNewSupAddress] = useState('');
    const [savingSup, setSavingSup] = useState(false);

    const prefilledSupplier = location.state as { supplierId?: string; supplierName?: string; isPending?: boolean } | null;

    const [formData, setFormData] = useState<POFormData>({
        supplierId: prefilledSupplier?.supplierId || '',
        supplierName: prefilledSupplier?.supplierName || '',
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString().split('T')[0],
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lineItems: [
            {
                id: '1',
                productId: '',
                product: '',
                description: '',
                quantity: 1,
                rate: 0,
                amount: 0
            }
        ],
        subtotal: 0,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        grandTotal: 0,
        notes: '',
        paymentStatus: 'Unpaid',
        paymentMethod: '',
        amountPaid: 0,
        remainingBalance: 0,
        paymentReference: '',
        status: 'Pending',
        autoApprove: false,
    });

    const currentUser = getCurrentUser();
    const todayLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    const selectedSupplier = useMemo(
        () => suppliers.find((s) => s.id === formData.supplierId),
        [suppliers, formData.supplierId],
    );

    const leadDays = daysBetween(formData.date, formData.expectedDate);
    const netDays = selectedSupplier ? parseNetDays(selectedSupplier.paymentTerms) : 30;

    const filledLineCount = formData.lineItems.filter((i) => i.productId && i.quantity > 0).length;
    const awaitingSubtitle = !formData.supplierId && filledLineCount === 0
        ? 'awaiting supplier and items'
        : !formData.supplierId
          ? 'awaiting supplier'
          : filledLineCount === 0
            ? 'awaiting items'
            : `${filledLineCount} item${filledLineCount === 1 ? '' : 's'} added`;

    const aiInsights = useMemo(() => {
        const insights: { color: string; text: string }[] = [];
        if (formData.grandTotal > 0 && selectedSupplier && formData.grandTotal > (selectedSupplier.creditLimit || 50000)) {
            insights.push({ color: C.amber, text: 'Order total exceeds typical credit limit — confirm affordability before authorising.' });
        }
        if (filledLineCount > 0) {
            insights.push({ color: C.green, text: `${filledLineCount} line item${filledLineCount === 1 ? '' : 's'} will extend stock coverage on selected SKUs.` });
        }
        if (products.length > 0 && filledLineCount === 0) {
            insights.push({ color: C.red, text: 'No products added yet — low-stock SKUs may stock out before delivery.' });
        }
        if (selectedSupplier) {
            insights.push({ color: C.blue, text: `${selectedSupplier.name} avg lead time ${deriveLeadTime(selectedSupplier)} — align expected arrival accordingly.` });
        }
        while (insights.length < 3) {
            const fallbacks = [
                { color: C.green, text: 'Review line quantities against current warehouse coverage before submitting.' },
                { color: C.amber, text: 'Confirm payment terms match supplier Net 30 agreement.' },
                { color: C.purple, text: 'Use AI suggestions to pre-fill high-priority reorder SKUs.' },
            ];
            insights.push(fallbacks[insights.length]);
        }
        return insights.slice(0, 3);
    }, [formData.grandTotal, selectedSupplier, filledLineCount, products.length]);

    useEffect(() => {
        const fetchSuppliersAndProducts = async () => {
            try {
                setLoading(true);
                const [suppliersData, productsData] = await Promise.all([
                    getSuppliers(),
                    getProducts()
                ]);

                const suppliersWithBalance = await Promise.all(
                    suppliersData.map(async (s) => ({
                        ...s,
                        balance: await getSupplierBalance(s.id)
                    }))
                );

                setSuppliers(suppliersWithBalance);
                setProducts(productsData);
            } catch (error) {
                console.error('Failed to fetch suppliers and products:', error);
                alert('Failed to load suppliers/products');
            } finally {
                setLoading(false);
            }
        };

        fetchSuppliersAndProducts();
    }, []);

    useEffect(() => {
        const subtotal = formData.lineItems.reduce((sum: number, item: POLineItem) => sum + item.amount, 0);
        const taxAmount = (subtotal * formData.taxRate) / 100;
        const grandTotal = subtotal + taxAmount - formData.discount;
        const rawBalance = formData.paymentStatus === 'Paid' ? 0 :
            formData.paymentStatus === 'Advance Paid' ? grandTotal - formData.amountPaid :
                grandTotal;
        const remainingBalance = Math.max(0, rawBalance);

        setFormData(prev => ({
            ...prev,
            subtotal,
            taxAmount,
            grandTotal,
            remainingBalance
        }));
    }, [formData.lineItems, formData.taxRate, formData.discount, formData.paymentStatus, formData.amountPaid]);

    const handleAddLineItem = () => {
        const newItem: POLineItem = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
            productId: '',
            product: '',
            description: '',
            quantity: 1,
            rate: 0,
            amount: 0
        };

        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, newItem]
        }));
    };

    const ensureTrailingBlankRow = (touchedId: string) => {
        setFormData(prev => {
            const isLast = prev.lineItems[prev.lineItems.length - 1]?.id === touchedId;
            if (!isLast) return prev;
            const blank: POLineItem = {
                id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
                productId: '', product: '', description: '',
                quantity: 1, rate: 0, amount: 0,
            };
            return { ...prev, lineItems: [...prev.lineItems, blank] };
        });
    };

    const handleRemoveLineItem = (id: string) => {
        if (formData.lineItems.length === 1) {
            alert('Order must have at least one line item');
            return;
        }

        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter(item => item.id !== id)
        }));
    };

    const handleProductSelect = (lineId: string, productId: string) => {
        const selectedProduct = products.find(p => p.id === productId);

        if (!selectedProduct) return;

        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item => {
                if (item.id !== lineId) return item;

                return {
                    ...item,
                    productId: selectedProduct.id,
                    product: selectedProduct.name,
                    description: selectedProduct.name,
                    rate: selectedProduct.unit_price,
                    amount: item.quantity * selectedProduct.unit_price
                };
            })
        }));
        ensureTrailingBlankRow(lineId);
    };

    const handleLineItemChange = (id: string, field: keyof POLineItem, value: string | number) => {
        ensureTrailingBlankRow(id);
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.map(item => {
                if (item.id !== id) return item;

                const updatedItem = { ...item, [field]: value };

                if (field === 'quantity' || field === 'rate') {
                    updatedItem.amount = updatedItem.quantity * updatedItem.rate;
                }

                return updatedItem;
            })
        }));
    };

    const createNewSupplier = async () => {
        if (!newSupName.trim()) return;
        setSavingSup(true);
        try {
            const s = await createSupplier({ name: newSupName, phone: newSupPhone, address: newSupAddress, email: '', taxId: '', paymentTerms: 'Net 30', currency: 'USD', rating: 'A', status: 'Active', code: `SUP-${Date.now().toString().slice(-6)}` });
            setSuppliers((prev: any[]) => [...prev, s]);
            setFormData((p: any) => ({ ...p, supplierId: s.id, supplierName: s.name }));
            setShowNewSupplier(false);
            setNewSupName(''); setNewSupPhone(''); setNewSupAddress('');
        } catch { alert('Failed to create supplier. Try again.'); }
        finally { setSavingSup(false); }
    };

    const handleSupplierChange = (supplierId: string) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        setFormData(prev => ({
            ...prev,
            supplierId,
            supplierName: supplier?.name || ''
        }));
    };

    const handleSave = async () => {
        if (!formData.supplierId) {
            alert('Please select a supplier');
            return;
        }

        if (formData.lineItems.some(item => !item.product || item.quantity <= 0 || item.rate <= 0)) {
            alert('Please fill in all line items with valid quantities and rates');
            return;
        }

        if (formData.grandTotal <= 0) {
            alert('Order total must be greater than 0');
            return;
        }

        try {
            setSaving(true);

            const poData = {
                poNumber: formData.poNumber,
                supplierId: formData.supplierId,
                supplierName: formData.supplierName,
                date: formData.date,
                expectedDate: formData.expectedDate,
                items: formData.lineItems.map(item => ({
                    productId: item.productId,
                    productName: item.product,
                    uom: 'Units',
                    quantity: item.quantity,
                    unitPrice: item.rate,
                    taxRate: formData.taxRate,
                    discount: 0,
                    total: item.amount
                }) as PurchaseOrderItem),
                subtotal: formData.subtotal,
                taxTotal: formData.taxAmount,
                grandTotal: formData.grandTotal,
                notes: formData.notes,
                payment_status: formData.paymentStatus,
                payment_method: formData.paymentMethod,
                amount_paid: formData.paymentStatus === 'Paid' ? formData.grandTotal : formData.amountPaid,
                remaining_balance: formData.remainingBalance,
                status: formData.autoApprove ? 'Approved' : formData.status,
            };

            await createPurchaseOrder(poData);

            if (formData.autoApprove) {
                alert(`✅ Purchase Order Approved!\n\nPO: ${formData.poNumber}\nSupplier: ${formData.supplierName}\nTotal: ${formData.grandTotal.toLocaleString()}\n\nStatus: APPROVED (auto-approved)\nNext: Warehouse can confirm Goods Received.`);
            } else {
                alert(`✅ Purchase Requisition Submitted!\n\nPO: ${formData.poNumber}\nSupplier: ${formData.supplierName}\nTotal: ${formData.grandTotal.toLocaleString()}\n\nStatus: PENDING REQUISITION\nNext: A manager must approve this PO from the orders list.`);
            }

            navigate(`/suppliers/${formData.supplierId}?tab=purchases`);
        } catch (error: any) {
            console.error('Failed to save order:', error);
            alert(`❌ Failed to save order\n\n${error.message || 'Please try again.'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleAddSuggested = () => {
        const usedIds = new Set(formData.lineItems.map((i) => i.productId).filter(Boolean));
        const suggestion = products.find((p) => !usedIds.has(p.id));
        if (!suggestion) {
            handleAddLineItem();
            return;
        }
        const emptyRow = formData.lineItems.find((i) => !i.productId);
        if (emptyRow) {
            handleProductSelect(emptyRow.id, suggestion.id);
        } else {
            handleAddLineItem();
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
                        Loading purchase order...
                    </p>
                </div>
            </div>
        );
    }

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
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            style={{ ...ghostBtn, padding: '5px 8px', marginTop: 2, fontSize: 10 }}
                        >
                            <ArrowLeft size={14} /> Back to purchase orders
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.muted }}>
                            <Calendar size={11} /> {todayLabel}
                        </span>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '5px 10px',
                                borderRadius: 20,
                                background: 'rgba(34,197,94,.1)',
                                border: '1px solid rgba(34,197,94,.25)',
                            }}
                        >
                            <span
                                style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: C.green,
                                    boxShadow: `0 0 6px ${C.green}`,
                                }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.green }}>Live</span>
                        </div>
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

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                        <div
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'rgba(255,153,0,.12)',
                                border: '1px solid rgba(255,153,0,.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <ShoppingCart size={20} color={C.orange} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                                New purchase order
                            </h1>
                            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: C.muted }}>
                                {formData.poNumber} · created {formatDisplayDate(formData.date)} · {awaitingSubtitle}
                            </p>
                        </div>
                    </div>
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            borderRadius: 20,
                            background: 'rgba(255,153,0,.12)',
                            border: '1px solid rgba(255,153,0,.35)',
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#FCD34D',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
                        Draft — not yet submitted
                    </span>
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
                    {/* Supplier section */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: C.text }}>
                                <Warehouse size={14} color={C.blue} />
                                Supplier <span style={{ color: C.red }}>*</span>
                            </div>
                            <button type="button" onClick={() => setShowNewSupplier(true)} style={{ ...ghostBtn, fontSize: 10, color: C.orange, borderColor: 'rgba(255,153,0,.3)' }}>
                                + New supplier
                            </button>
                        </div>

                        {!selectedSupplier ? (
                            <SearchableSelect
                                options={suppliers}
                                value={formData.supplierId}
                                onChange={handleSupplierChange}
                                placeholder="Search supplier..."
                                displayKey="name"
                                disabled={loading}
                            />
                        ) : (
                            <div
                                style={{
                                    background: C.bg3,
                                    border: '1px solid rgba(255,255,255,.08)',
                                    borderRadius: 10,
                                    padding: '12px 14px',
                                    marginBottom: 10,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{selectedSupplier.name}</div>
                                        <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
                                            <span>ID: {selectedSupplier.code || selectedSupplier.id}</span>
                                            <span style={{ margin: '0 8px', color: C.dim }}>·</span>
                                            <span>{deriveRegion(selectedSupplier)}</span>
                                            {selectedSupplier.email && (
                                                <>
                                                    <span style={{ margin: '0 8px', color: C.dim }}>·</span>
                                                    <span>{selectedSupplier.email}</span>
                                                </>
                                            )}
                                            <span style={{ margin: '0 8px', color: C.dim }}>·</span>
                                            <span>Lead time: {deriveLeadTime(selectedSupplier)}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData((p) => ({ ...p, supplierId: '', supplierName: '' }))}
                                        style={{ ...ghostBtn, fontSize: 9, padding: '4px 8px', flexShrink: 0 }}
                                    >
                                        Clear / change
                                    </button>
                                </div>
                            </div>
                        )}

                        {showNewSupplier && (
                            <div style={{ marginBottom: 10, padding: 12, background: 'rgba(255,153,0,.08)', border: '1px solid rgba(255,153,0,.25)', borderRadius: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: C.orange, textTransform: 'uppercase' }}>New supplier</p>
                                    <button type="button" onClick={() => setShowNewSupplier(false)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <input type="text" placeholder="Supplier Name *" value={newSupName} onChange={(e) => setNewSupName(e.target.value)} style={inputStyle} />
                                    <input type="text" placeholder="Phone" value={newSupPhone} onChange={(e) => setNewSupPhone(e.target.value)} style={inputStyle} />
                                    <input type="text" placeholder="Address" value={newSupAddress} onChange={(e) => setNewSupAddress(e.target.value)} style={inputStyle} />
                                    <button type="button" onClick={createNewSupplier} disabled={savingSup || !newSupName.trim()} style={{ ...primaryBtn, justifyContent: 'center', opacity: savingSup || !newSupName.trim() ? 0.5 : 1 }}>
                                        {savingSup ? 'Creating...' : 'Create & select supplier'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {selectedSupplier && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
                                <div style={{ background: C.bg3, border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.green }} />
                                    <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>On-time score</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.green }}>{derivePerformance(selectedSupplier)}%</div>
                                </div>
                                <div style={{ background: C.bg3, border: '1px solid rgba(255,153,0,.2)', borderRadius: 8, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.orange }} />
                                    <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>{selectedSupplier.paymentTerms || 'Net 30'} terms</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.orange }}>{netDays} days</div>
                                </div>
                                <div style={{ background: C.bg3, border: '1px solid rgba(79,142,247,.2)', borderRadius: 8, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.blue }} />
                                    <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>SKUs supplied</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.blue }}>{hashNum(selectedSupplier.id, 12, 48)}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Order details */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted, marginBottom: 12 }}>
                            Order details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            <div>
                                <label style={labelStyle}>PO reference</label>
                                <input
                                    type="text"
                                    value={formData.poNumber}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, poNumber: e.target.value }))}
                                    style={{ ...inputStyle, fontFamily: 'monospace', fontWeight: 600 }}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Order date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Expected arrival</label>
                                <input
                                    type="date"
                                    value={formData.expectedDate}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, expectedDate: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 10, color: C.green }}>
                            <Check size={12} />
                            <span>{leadDays} days · avg lead time</span>
                        </div>
                    </div>

                    {/* Products / line items */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted, marginBottom: 10 }}>
                            Products / line items
                        </div>

                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '10px 12px',
                                marginBottom: 10,
                                borderRadius: 10,
                                background: 'rgba(155,111,228,.1)',
                                border: '1px solid rgba(155,111,228,.3)',
                                flexWrap: 'wrap',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#C4B5FD' }}>
                                <Sparkles size={14} color={C.purple} />
                                AI suggests reordering high-priority SKUs based on stock coverage
                            </div>
                            <button type="button" onClick={handleAddSuggested} style={{ ...ghostBtn, borderColor: 'rgba(155,111,228,.4)', color: '#C4B5FD', fontSize: 10 }}>
                                Add suggested
                            </button>
                        </div>

                        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,.07)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: C.bg3 }}>
                                        <th style={{ ...thStyle, width: '22%' }}>Product / SKU</th>
                                        <th style={{ ...thStyle, width: '28%' }}>Description</th>
                                        <th style={{ ...thStyle, width: '12%', textAlign: 'center' }}>Qty</th>
                                        <th style={{ ...thStyle, width: '16%', textAlign: 'center' }}>Unit cost</th>
                                        <th style={{ ...thStyle, width: '16%', textAlign: 'right' }}>Line total</th>
                                        <th style={{ ...thStyle, width: '6%', textAlign: 'center' }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.lineItems.map((item) => (
                                        <tr key={item.id}>
                                            <td style={tdStyle}>
                                                <SearchableSelect
                                                    options={products}
                                                    value={item.productId}
                                                    onChange={(productId) => handleProductSelect(item.id, productId)}
                                                    placeholder="Select SKU"
                                                    displayKey="name"
                                                />
                                            </td>
                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                                                    placeholder="Item specifics..."
                                                    style={inputStyle}
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={item.quantity || ''}
                                                    onChange={(e) => handleLineItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace' }}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <input
                                                    type="number"
                                                    value={item.rate || ''}
                                                    onChange={(e) => handleLineItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                    style={{ ...inputStyle, textAlign: 'center', fontFamily: 'monospace' }}
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: C.green }}>
                                                {formatUsd(item.amount)}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLineItem(item.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, padding: 4, display: 'inline-flex' }}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddLineItem}
                            style={{ ...ghostBtn, marginTop: 10, fontSize: 10, fontWeight: 700 }}
                        >
                            <Plus size={14} /> Add product
                        </button>
                    </div>

                    {/* Payment & notes */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted, marginBottom: 12 }}>
                            Payment &amp; notes
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div>
                                <label style={labelStyle}>Payment status</label>
                                <select
                                    value={formData.paymentStatus}
                                    onChange={(e) => setFormData((p) => ({ ...p, paymentStatus: e.target.value as POFormData['paymentStatus'], paymentMethod: '', amountPaid: 0 }))}
                                    style={inputStyle}
                                >
                                    <option value="Unpaid">Unpaid</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Advance Paid">Advance / Partial</option>
                                </select>
                                {formData.paymentStatus === 'Unpaid' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 10, color: C.red }}>
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red }} />
                                        Unpaid
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={labelStyle}>Discount ($)</label>
                                <input
                                    type="number"
                                    value={formData.discount || ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {(formData.paymentStatus === 'Paid' || formData.paymentStatus === 'Advance Paid') && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                <div>
                                    <label style={labelStyle}>Payment method</label>
                                    <select
                                        value={formData.paymentMethod}
                                        onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value }))}
                                        style={inputStyle}
                                        required
                                    >
                                        <option value="">-- Select --</option>
                                        {PAYMENT_METHODS.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                {formData.paymentStatus === 'Advance Paid' && (
                                    <>
                                        <div>
                                            <label style={labelStyle}>Upfront amount</label>
                                            <input
                                                type="number"
                                                value={formData.amountPaid || ''}
                                                onChange={(e) => setFormData((p) => ({ ...p, amountPaid: parseFloat(e.target.value) || 0 }))}
                                                style={{ ...inputStyle, fontFamily: 'monospace' }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label style={labelStyle}>Payment reference</label>
                                            <input
                                                type="text"
                                                value={formData.paymentReference || formData.poNumber}
                                                onChange={(e) => setFormData((p) => ({ ...p, paymentReference: e.target.value }))}
                                                style={{ ...inputStyle, fontFamily: 'monospace' }}
                                                placeholder="PO-123 or INV-789"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div>
                            <label style={labelStyle}>Notes</label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                                rows={4}
                                placeholder="Include special handling instructions or contractual references..."
                                style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN — Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 10 }}>
                    {/* Order Total card */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted, marginBottom: 12 }}>
                            Order total
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase' }}>Subtotal</span>
                                <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600 }}>{formatUsd(formData.subtotal)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase' }}>VAT</span>
                                    <div style={{ display: 'flex', alignItems: 'center', background: C.bg3, border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '2px 6px' }}>
                                        <input
                                            type="number"
                                            value={formData.taxRate}
                                            onChange={(e) => setFormData((prev) => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))}
                                            style={{ width: 32, background: 'transparent', border: 'none', outline: 'none', color: C.text, fontSize: 11, fontFamily: 'monospace' }}
                                            min={0}
                                        />
                                        <span style={{ fontSize: 9, color: C.dim }}>%</span>
                                    </div>
                                </div>
                                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{formatUsd(formData.taxAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 10, color: C.dim, fontWeight: 600, textTransform: 'uppercase' }}>Discount</span>
                                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: C.amber }}>-{formatUsd(formData.discount)}</span>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: C.text }}>Total</span>
                                <span style={{ fontSize: 26, fontFamily: 'monospace', fontWeight: 800, color: C.blue, letterSpacing: '-.02em' }}>
                                    {formatUsd(formData.grandTotal)}
                                </span>
                            </div>
                            <div
                                style={{
                                    background: 'rgba(255,153,0,.1)',
                                    border: '1px solid rgba(255,153,0,.25)',
                                    borderRadius: 10,
                                    padding: '10px 12px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.orange, letterSpacing: '.4px' }}>Amount owed</div>
                                    <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>due in {netDays} days</div>
                                </div>
                                <span style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: 800, color: C.orange }}>
                                    {formatUsd(formData.remainingBalance)}
                                </span>
                            </div>

                            {formData.paymentStatus !== 'Unpaid' && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(34,197,94,.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,.2)' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase' }}>Amount disbursed</span>
                                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: C.green }}>
                                        {formatUsd(formData.paymentStatus === 'Paid' ? formData.grandTotal : formData.amountPaid)}
                                    </span>
                                </div>
                            )}

                            {formData.paymentStatus === 'Advance Paid' && formData.amountPaid > formData.grandTotal && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(79,142,247,.08)', borderRadius: 8, border: '1px solid rgba(79,142,247,.2)' }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase' }}>Overpayment / credit</span>
                                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: C.blue }}>
                                        +{formatUsd(formData.amountPaid - formData.grandTotal)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ ...panel, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 4 }}>
                            <input
                                type="checkbox"
                                checked={formData.autoApprove}
                                onChange={(e) => setFormData({ ...formData, autoApprove: e.target.checked })}
                                style={{ width: 14, height: 14, accentColor: C.blue }}
                            />
                            <span style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>Auto-approve on submit</span>
                        </label>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            style={{ ...primaryBtn, justifyContent: 'center', padding: '10px 14px', fontSize: 11, opacity: saving ? 0.6 : 1 }}
                        >
                            {saving ? 'Processing...' : formData.autoApprove ? 'Authorise & approve' : 'Authorise order'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            style={{ ...ghostBtn, justifyContent: 'center', padding: '10px 14px', fontSize: 11 }}
                        >
                            Cancel — discard
                        </button>
                    </div>

                    {/* Approval workflow tracker */}
                    <div style={{ ...panel, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted, marginBottom: 12 }}>
                            Approval workflow
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 12 }}>
                            {WORKFLOW_STEPS.map((step, idx) => {
                                const isActive = idx === 0;
                                const isPast = false;
                                const color = isActive ? C.orange : isPast ? C.green : C.dim;
                                return (
                                    <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                        <div
                                            style={{
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                background: isActive ? 'rgba(255,153,0,.15)' : 'rgba(255,255,255,.04)',
                                                border: `2px solid ${isActive ? C.orange : 'rgba(255,255,255,.12)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginBottom: 4,
                                            }}
                                        >
                                            {isPast ? <CheckCircle size={12} color={C.green} /> : isActive ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.orange }} /> : null}
                                        </div>
                                        <span style={{ fontSize: 8, fontWeight: 600, color, textAlign: 'center', lineHeight: 1.2 }}>{step}</span>
                                        {idx < WORKFLOW_STEPS.length - 1 && (
                                            <div style={{ position: 'absolute', display: 'none' }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ height: 2, background: 'rgba(255,255,255,.06)', borderRadius: 1, margin: '-4px 0 10px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '10%', background: C.orange, borderRadius: 1 }} />
                        </div>
                        <p style={{ margin: 0, fontSize: 9, color: C.dim, lineHeight: 1.5 }}>
                            Compliance: all purchase orders require manager approval before supplier dispatch unless auto-approve is enabled.
                        </p>
                    </div>

                    {/* AI notes box */}
                    <div
                        style={{
                            ...panel,
                            padding: '14px 16px',
                            background: 'rgba(155,111,228,.06)',
                            border: '1px solid rgba(155,111,228,.2)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <Bot size={16} color={C.purple} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#C4B5FD' }}>AI notes</span>
                        </div>
                        <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {aiInsights.map((insight, i) => (
                                <li key={i} style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>
                                    <span style={{ color: insight.color, fontWeight: 600 }}>• </span>
                                    {insight.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
