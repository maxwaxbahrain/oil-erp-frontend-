import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    Minus,
    Save,
    Package,
    RefreshCw,
    Settings,
    Download,
    Layers,
    ChevronDown,
    Search,
    Calendar,
    TrendingUp,
    AlertCircle,
} from 'lucide-react';
import { getProducts as getMergedProducts } from '../../services/productService';
import { getCurrentUser } from '../../store/authStore';

interface Adjustment {
    id: string;
    productId: string;
    productName: string;
    type: 'add' | 'reduce';
    quantity: number;
    reason: string;
    date: string;
    before: number;
    after: number;
    note?: string;
    user?: string;
}

const REASON_CHIPS = [
    'Purchase received',
    'Stock count correction',
    'Return from customer',
    'Sample/promo',
    'Damage/write-off',
    'Other',
] as const;

const LEGACY_REASON_MAP: Record<string, string> = {
    'Stock correction': 'Stock count correction',
    'Transfer in': 'Purchase received',
    'Found in warehouse': 'Purchase received',
    'Damaged / expired': 'Damage/write-off',
    'Theft / loss': 'Damage/write-off',
    'Transfer out': 'Other',
    'Sample given': 'Sample/promo',
};

const ADJ_KEY = 'inventory_adjustments';
const getAdjs = (): Adjustment[] => {
    try {
        return JSON.parse(localStorage.getItem(ADJ_KEY) || '[]');
    } catch {
        return [];
    }
};
const saveAdj = (a: Adjustment) => localStorage.setItem(ADJ_KEY, JSON.stringify([a, ...getAdjs()]));

const C = {
    bg: '#0D1117',
    bg2: '#060f1c',
    bg3: '#0a1726',
    bg4: '#0f1f33',
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
    background: C.bg3,
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

type HistoryPeriod = '7' | '30' | '90' | 'all';

function fmtUsd(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtUsdPrecise(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function flatten(p: any) {
    const stock = Array.isArray(p?.locations)
        ? p.locations.reduce((s: number, l: any) => s + (Number(l?.currentStock) || 0), 0)
        : Number(p?.current_stock || p?.stock || 0);
    const daily =
        Number(p?.avgDailySales) ||
        (Array.isArray(p?.locations) ? p.locations.find((l: any) => (l?.avgDailySales ?? 0) > 0)?.avgDailySales : 0) ||
        (Number(p?.salesVelocity) > 0 ? Number(p.salesVelocity) / 30 : 0);
    return {
        id: String(p?.id ?? ''),
        name: String(p?.name ?? ''),
        sku: String(p?.sku ?? ''),
        current_stock: stock,
        minimum_stock: Number(p?.reorderLevel || p?.minimum_stock || p?.min_stock || 0),
        unit_price: Number(p?.pricing?.sellingPrice || p?.price || p?.unit_price || 0),
        cost: Number(p?.pricing?.landedCost || p?.cost || 0),
        unit: String(p?.uom || p?.unit || 'unit'),
        category: String(p?.category || 'Imported'),
        dailyVelocity: daily,
    };
}

function getDaysCover(stock: number, daily: number): number | null {
    if (stock <= 0 || daily <= 0) return null;
    return Math.max(1, Math.floor(stock / daily));
}

function displayReason(reason: string): string {
    return LEGACY_REASON_MAP[reason] || reason;
}

function formatDisplayDate(iso: string): string {
    try {
        return new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return iso;
    }
}

function filterByPeriod(items: Adjustment[], period: HistoryPeriod): Adjustment[] {
    if (period === 'all') return items;
    const days = Number(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return items.filter((a) => {
        const d = new Date(a.date + (a.date.length === 10 ? 'T12:00:00' : ''));
        return d >= cutoff;
    });
}

export default function InventoryAdjustment() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('30');
    const [periodOpen, setPeriodOpen] = useState(false);
    const comboRef = useRef<HTMLDivElement | null>(null);
    const periodRef = useRef<HTMLDivElement | null>(null);
    const [form, setForm] = useState({
        productId: '',
        type: 'add' as 'add' | 'reduce',
        quantity: 1,
        reason: 'Purchase received',
        note: '',
        date: new Date().toISOString().slice(0, 10),
    });

    useEffect(() => {
        getMergedProducts().then((list) => {
            setProducts(list.map(flatten));
            setLoading(false);
        });
        setAdjustments(getAdjs());
    }, []);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (comboRef.current && !comboRef.current.contains(e.target as Node)) setOpen(false);
            if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const sel = products.find((p) => String(p.id) === form.productId);
    const currentStock = sel?.current_stock || 0;
    const preview = sel
        ? form.type === 'add'
            ? currentStock + form.quantity
            : Math.max(0, currentStock - form.quantity)
        : 0;
    const dailyVelocity = sel?.dailyVelocity || 0;
    const currentDaysCover = sel ? getDaysCover(currentStock, dailyVelocity) : null;
    const newDaysCover = sel ? getDaysCover(preview, dailyVelocity) : null;
    const unitCost = sel ? (sel.cost > 0 ? sel.cost : sel.unit_price * 0.55) : 0;
    const costImpact = form.quantity * unitCost;

    const filteredProducts = search.trim()
        ? products.filter(
              (p) =>
                  (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
                  (p.sku || '').toLowerCase().includes(search.toLowerCase()),
          )
        : products;

    const filteredHistory = useMemo(
        () => filterByPeriod(adjustments, historyPeriod),
        [adjustments, historyPeriod],
    );

    const historyStats = useMemo(() => {
        const added = filteredHistory.filter((a) => a.type === 'add').reduce((s, a) => s + a.quantity, 0);
        const reduced = filteredHistory.filter((a) => a.type === 'reduce').reduce((s, a) => s + a.quantity, 0);
        return { added, reduced, count: filteredHistory.length };
    }, [filteredHistory]);

    const periodLabel =
        historyPeriod === '7'
            ? 'Last 7 days'
            : historyPeriod === '30'
              ? 'Last 30 days'
              : historyPeriod === '90'
                ? 'Last 90 days'
                : 'All time';

    const handleSave = async () => {
        if (!form.productId || !form.reason || form.quantity <= 0) {
            alert('Please fill all fields.');
            return;
        }
        if (!sel) {
            alert('Selected product not found.');
            return;
        }
        setSaving(true);
        try {
            const base = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api';

            let backendId: string | number | null = null;
            let backendCurrentStock = 0;
            try {
                const listResp = await fetch(`${base}/products/`, { cache: 'no-store' });
                if (listResp.ok) {
                    const list = await listResp.json();
                    const arr = Array.isArray(list) ? list : list?.results || list?.data || [];
                    const target = String(sel.name || '')
                        .trim()
                        .toLowerCase();
                    const match = arr.find((p: any) => String(p?.name || '').trim().toLowerCase() === target);
                    if (match) {
                        backendId = match.id;
                        backendCurrentStock = Number(match.stock) || 0;
                    }
                }
            } catch {
                /* fall through to create-on-backend */
            }

            if (backendId == null) {
                const createBody = {
                    name: sel.name,
                    sku: sel.sku || `INV-${Date.now()}`,
                    category: sel.category || 'Imported',
                    description: '',
                    price: sel.unit_price || 0,
                    cost: sel.cost || 0,
                    stock: 0,
                    min_stock: sel.minimum_stock || 0,
                    unit: sel.unit || 'unit',
                };
                const createResp = await fetch(`${base}/products/`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(createBody),
                });
                if (!createResp.ok) {
                    const detail = await createResp.text().catch(() => '');
                    throw new Error(`Could not create product on backend (HTTP ${createResp.status}): ${detail.slice(0, 200)}`);
                }
                const created = await createResp.json();
                backendId = created.id;
                backendCurrentStock = Number(created.stock) || 0;
            }

            const newStock =
                form.type === 'add'
                    ? backendCurrentStock + form.quantity
                    : Math.max(0, backendCurrentStock - form.quantity);
            const putResp = await fetch(`${base}/products/${backendId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stock: newStock }),
            });
            if (!putResp.ok) {
                const detail = await putResp.text().catch(() => '');
                throw new Error(`Backend ${putResp.status}: ${detail.slice(0, 200) || putResp.statusText}`);
            }

            const currentUser = getCurrentUser();
            const adj: Adjustment = {
                id: `ADJ-${Date.now()}`,
                productId: String(backendId),
                productName: sel.name,
                type: form.type,
                quantity: form.quantity,
                reason: form.reason,
                date: form.date,
                before: backendCurrentStock,
                after: newStock,
                note: form.note.trim() || undefined,
                user: currentUser?.name || 'System Admin',
            };
            saveAdj(adj);
            const upd = await getMergedProducts();
            setProducts(upd.map(flatten));
            setAdjustments(getAdjs());
            setSuccess(`Stock ${form.type === 'add' ? 'increased' : 'reduced'} by ${form.quantity} units (now ${newStock})`);
            setTimeout(() => setSuccess(''), 4000);
            setForm((p) => ({
                ...p,
                productId: '',
                quantity: 1,
                reason: p.type === 'add' ? 'Purchase received' : '',
                note: '',
            }));
            setSearch('');
        } catch (e) {
            alert(`Failed to save: ${e instanceof Error ? e.message : 'unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const handleExportHistory = () => {
        const rows = filteredHistory;
        if (rows.length === 0) {
            alert('No adjustments to export for the selected period.');
            return;
        }
        const header = 'Date,Product,SKU,Type,Quantity,Reason,Before,After,User,Note';
        const lines = rows.map((a) => {
            const prod = products.find((p) => p.id === a.productId);
            const sku = prod?.sku || '';
            return [
                a.date,
                `"${a.productName.replace(/"/g, '""')}"`,
                `"${sku.replace(/"/g, '""')}"`,
                a.type,
                a.quantity,
                `"${displayReason(a.reason).replace(/"/g, '""')}"`,
                a.before,
                a.after,
                `"${(a.user || 'System Admin').replace(/"/g, '""')}"`,
                `"${(a.note || '').replace(/"/g, '""')}"`,
            ].join(',');
        });
        const csv = [header, ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventory-adjustments-${historyPeriod}-days.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleBulkAdjustment = () => {
        try {
            sessionStorage.setItem('pm_active_tab', 'Stock Adjustment');
        } catch {
            /* ignore */
        }
        navigate('/products');
    };

    const bumpQuantity = (delta: number) => {
        setForm((p) => ({ ...p, quantity: Math.max(1, p.quantity + delta) }));
    };

    const clearProduct = () => {
        setSearch('');
        setForm((p) => ({ ...p, productId: '' }));
        setOpen(false);
    };

    const todayLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

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
            {/* Page header */}
            <div style={{ background: C.bg2, borderBottom: '1px solid rgba(255,255,255,.07)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            style={{ ...ghostBtn, padding: '5px 8px', marginTop: 2 }}
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: 'rgba(255,153,0,.12)',
                                border: '1px solid rgba(255,153,0,.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Settings size={18} color={C.orange} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>
                                Inventory adjustment
                            </h1>
                            <p style={{ margin: '2px 0 0', fontSize: 10.5, color: C.muted }}>
                                Add or reduce stock with reason and full audit trail
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={handleExportHistory} style={ghostBtn}>
                            <Download size={13} /> Export history
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkAdjustment}
                            style={{ ...ghostBtn, borderColor: 'rgba(79,142,247,.35)', color: C.blue }}
                        >
                            <Layers size={13} /> Bulk adjustment
                        </button>
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
                    </div>
                </div>
            </div>

            {success && (
                <div
                    style={{
                        margin: '10px 16px 0',
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'rgba(34,197,94,.1)',
                        border: '1px solid rgba(34,197,94,.25)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.green,
                    }}
                >
                    ✓ {success}
                </div>
            )}

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                    gap: 10,
                    padding: 10,
                }}
            >
                {/* LEFT — New adjustment */}
                <div style={{ ...panel, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted }}>
                            New adjustment
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: C.dim }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Calendar size={11} /> {todayLabel}
                            </span>
                            <span style={{ fontWeight: 700, color: C.green }}>USD ($)</span>
                        </div>
                    </div>

                    {/* Add / Reduce toggle */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <button
                            type="button"
                            onClick={() =>
                                setForm((p) => ({
                                    ...p,
                                    type: 'add',
                                    reason: p.reason && p.type === 'reduce' ? 'Purchase received' : p.reason || 'Purchase received',
                                }))
                            }
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: form.type === 'add' ? '1px solid rgba(34,197,94,.45)' : '1px solid rgba(255,255,255,.08)',
                                background: form.type === 'add' ? 'rgba(34,197,94,.15)' : C.bg4,
                                color: form.type === 'add' ? C.green : C.dim,
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            <Plus size={14} /> Add stock
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setForm((p) => ({
                                    ...p,
                                    type: 'reduce',
                                    reason:
                                        p.reason === 'Purchase received' || p.reason === 'Return from customer'
                                            ? ''
                                            : p.reason,
                                }))
                            }
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: form.type === 'reduce' ? '1px solid rgba(239,68,68,.45)' : '1px solid rgba(255,255,255,.08)',
                                background: form.type === 'reduce' ? 'rgba(239,68,68,.12)' : C.bg4,
                                color: form.type === 'reduce' ? C.red : C.dim,
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                            }}
                        >
                            <Minus size={14} /> Reduce stock
                        </button>
                    </div>

                    {/* Product select / card */}
                    {sel ? (
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: C.bg4,
                                border: '1px solid rgba(255,255,255,.08)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>{sel.name}</div>
                                    <div style={{ fontSize: 10, color: C.dim }}>
                                        SKU: {sel.sku || '—'} · {sel.category}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearProduct}
                                    style={{ ...ghostBtn, padding: '4px 8px', fontSize: 10, flexShrink: 0 }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div ref={comboRef} style={{ position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.dim, marginBottom: 6 }}>
                                Product ({products.length} total)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color={C.dim} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    value={search}
                                    onFocus={() => setOpen(true)}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setOpen(true);
                                        if (form.productId) setForm((p) => ({ ...p, productId: '' }));
                                    }}
                                    placeholder="Search product name or SKU..."
                                    autoComplete="off"
                                    style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        padding: '10px 12px 10px 36px',
                                        borderRadius: 10,
                                        border: '1px solid rgba(255,255,255,.1)',
                                        background: C.bg4,
                                        color: C.text,
                                        fontSize: 11,
                                        outline: 'none',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>
                            {open && filteredProducts.length > 0 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        zIndex: 20,
                                        left: 0,
                                        right: 0,
                                        marginTop: 4,
                                        background: C.bg4,
                                        border: '1px solid rgba(255,255,255,.1)',
                                        borderRadius: 10,
                                        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                                        maxHeight: 220,
                                        overflowY: 'auto',
                                    }}
                                >
                                    {filteredProducts.slice(0, 50).map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setForm((prev) => ({ ...prev, productId: p.id }));
                                                setSearch(p.name);
                                                setOpen(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 12px',
                                                border: 'none',
                                                borderBottom: '1px solid rgba(255,255,255,.04)',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 8,
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            <span style={{ fontSize: 11, fontWeight: 500, color: C.text }}>{p.name}</span>
                                            <span style={{ fontSize: 9, color: C.dim, flexShrink: 0 }}>Stock: {p.current_stock || 0}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {open && search.trim() && filteredProducts.length === 0 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        zIndex: 20,
                                        left: 0,
                                        right: 0,
                                        marginTop: 4,
                                        padding: '12px 14px',
                                        background: C.bg4,
                                        border: '1px solid rgba(255,255,255,.1)',
                                        borderRadius: 10,
                                        fontSize: 11,
                                        color: C.dim,
                                    }}
                                >
                                    No products match &ldquo;{search}&rdquo;.
                                </div>
                            )}
                        </div>
                    )}

                    {/* 4 stat boxes */}
                    {sel && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {[
                                { label: 'Current stock', value: currentStock, color: C.orange },
                                {
                                    label: 'Adjustment',
                                    value: `${form.type === 'add' ? '+' : '-'}${form.quantity}`,
                                    color: form.type === 'add' ? C.green : C.red,
                                },
                                { label: 'New total', value: preview, color: C.green },
                                {
                                    label: 'Days cover',
                                    value: newDaysCover != null ? `${newDaysCover}d` : '—',
                                    color: C.green,
                                },
                            ].map((stat) => (
                                <div
                                    key={stat.label}
                                    style={{
                                        padding: '10px 8px',
                                        borderRadius: 8,
                                        background: C.bg4,
                                        border: '1px solid rgba(255,255,255,.06)',
                                        textAlign: 'center',
                                    }}
                                >
                                    <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', color: C.dim, marginBottom: 4 }}>
                                        {stat.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 700,
                                            fontFamily: 'ui-monospace, monospace',
                                            color: stat.color,
                                        }}
                                    >
                                        {stat.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quantity */}
                    <div>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.dim, marginBottom: 6 }}>
                            Quantity
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                                type="button"
                                onClick={() => bumpQuantity(-1)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,.1)',
                                    background: C.bg4,
                                    color: C.text,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Minus size={14} />
                            </button>
                            <input
                                type="number"
                                min={1}
                                value={form.quantity}
                                onChange={(e) => setForm((p) => ({ ...p, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                                style={{
                                    flex: 1,
                                    textAlign: 'center',
                                    padding: '10px 12px',
                                    borderRadius: 10,
                                    border: '1px solid rgba(255,255,255,.1)',
                                    background: C.bg4,
                                    color: C.text,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    fontFamily: 'ui-monospace, monospace',
                                    outline: 'none',
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => bumpQuantity(1)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,.1)',
                                    background: C.bg4,
                                    color: C.text,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Plus size={14} />
                            </button>
                            <span style={{ fontSize: 10, color: C.dim, fontWeight: 600, minWidth: 32 }}>units</span>
                        </div>
                    </div>

                    {/* Reason chips */}
                    <div>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.dim, marginBottom: 6 }}>
                            Reason
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                            {REASON_CHIPS.map((reason) => {
                                const addOnly = reason === 'Purchase received' || reason === 'Return from customer';
                                const reduceOnly = reason === 'Damage/write-off';
                                const disabled =
                                    (form.type === 'reduce' && addOnly) || (form.type === 'add' && reduceOnly);
                                const selected = form.reason === reason;
                                return (
                                    <button
                                        key={reason}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => setForm((p) => ({ ...p, reason }))}
                                        style={{
                                            padding: '8px 10px',
                                            borderRadius: 8,
                                            border: selected
                                                ? `1px solid ${C.blue}`
                                                : '1px solid rgba(255,255,255,.08)',
                                            background: selected ? 'rgba(79,142,247,.15)' : C.bg4,
                                            color: disabled ? C.dim : selected ? C.blue : C.muted,
                                            fontSize: 10,
                                            fontWeight: selected ? 600 : 500,
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            opacity: disabled ? 0.45 : 1,
                                            textAlign: 'left',
                                            fontFamily: 'inherit',
                                        }}
                                    >
                                        {reason}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Note */}
                    <div>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.dim, marginBottom: 6 }}>
                            Note <span style={{ fontWeight: 500, textTransform: 'none' }}>(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={form.note}
                            onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                            placeholder="Add context for audit trail..."
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,.1)',
                                background: C.bg4,
                                color: C.text,
                                fontSize: 11,
                                outline: 'none',
                                fontFamily: 'inherit',
                            }}
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.dim, marginBottom: 6 }}>
                            Adjustment date
                        </label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: '1px solid rgba(255,255,255,.1)',
                                background: C.bg4,
                                color: C.text,
                                fontSize: 11,
                                outline: 'none',
                                fontFamily: 'inherit',
                                colorScheme: 'dark',
                            }}
                        />
                    </div>

                    {/* Cost impact */}
                    {sel && (
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: form.type === 'add' ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
                                border: `1px solid ${form.type === 'add' ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                            }}
                        >
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 8 }}>
                                Cost impact
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: 18, fontWeight: 700, color: form.type === 'add' ? C.green : C.red }}>
                                    {form.type === 'add' ? '+' : '-'}
                                    {form.quantity} units
                                </span>
                                <span style={{ fontSize: 11, color: C.muted }}>
                                    · inventory cost {form.type === 'add' ? '+' : '-'}
                                    {fmtUsdPrecise(costImpact)}
                                </span>
                            </div>
                            <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.5 }}>
                                Stock cover{' '}
                                {currentDaysCover != null ? `${currentDaysCover}d` : '—'} →{' '}
                                {newDaysCover != null ? `${newDaysCover}d` : '—'}
                                {dailyVelocity > 0 && (
                                    <> · {dailyVelocity.toFixed(1)} units/day · unit cost {fmtUsdPrecise(unitCost)}</>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !form.productId || !form.reason}
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            borderRadius: 10,
                            border: 'none',
                            background: saving || !form.productId || !form.reason ? 'rgba(79,142,247,.35)' : C.blue,
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: saving || !form.productId || !form.reason ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            fontFamily: 'inherit',
                        }}
                    >
                        {saving ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" /> Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} /> Save adjustment
                            </>
                        )}
                    </button>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'rgba(255,255,255,.03)',
                            border: '1px solid rgba(255,255,255,.05)',
                        }}
                    >
                        <AlertCircle size={14} color={C.dim} style={{ flexShrink: 0, marginTop: 1 }} />
                        <p style={{ margin: 0, fontSize: 9.5, color: C.dim, lineHeight: 1.45 }}>
                            Every adjustment is logged with user, timestamp, reason, and before/after stock levels for full audit compliance.
                        </p>
                    </div>
                </div>

                {/* RIGHT — Adjustment history */}
                <div style={{ ...panel, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div
                        style={{
                            padding: '12px 14px',
                            borderBottom: '1px solid rgba(255,255,255,.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                        }}
                    >
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.muted }}>
                            Adjustment history
                        </div>
                        <div ref={periodRef} style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setPeriodOpen((v) => !v)}
                                style={{ ...ghostBtn, padding: '5px 10px', fontSize: 10 }}
                            >
                                {periodLabel} <ChevronDown size={12} />
                            </button>
                            {periodOpen && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: '100%',
                                        marginTop: 4,
                                        minWidth: 140,
                                        background: C.bg4,
                                        border: '1px solid rgba(255,255,255,.1)',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        zIndex: 10,
                                        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                                    }}
                                >
                                    {(
                                        [
                                            ['7', 'Last 7 days'],
                                            ['30', 'Last 30 days'],
                                            ['90', 'Last 90 days'],
                                            ['all', 'All time'],
                                        ] as [HistoryPeriod, string][]
                                    ).map(([key, label]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => {
                                                setHistoryPeriod(key);
                                                setPeriodOpen(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '8px 12px',
                                                border: 'none',
                                                background: historyPeriod === key ? 'rgba(79,142,247,.12)' : 'transparent',
                                                color: historyPeriod === key ? C.blue : C.muted,
                                                fontSize: 10,
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: 48, textAlign: 'center', color: C.dim, fontSize: 11 }}>Loading...</div>
                    ) : filteredHistory.length === 0 ? (
                        <div style={{ padding: 48, textAlign: 'center' }}>
                            <Package size={36} color={C.dim} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                            <p style={{ margin: 0, fontSize: 11, color: C.dim }}>No adjustments in this period</p>
                        </div>
                    ) : (
                        <div style={{ flex: 1, maxHeight: 520, overflowY: 'auto' }}>
                            {filteredHistory.map((adj) => {
                                const isAdd = adj.type === 'add';
                                const reasonLabel = displayReason(adj.reason);
                                const unitCostAdj =
                                    products.find((p) => p.id === adj.productId)?.cost ||
                                    products.find((p) => p.name === adj.productName)?.cost ||
                                    0;
                                const impact = adj.quantity * (unitCostAdj > 0 ? unitCostAdj : 12);
                                return (
                                    <div
                                        key={adj.id}
                                        style={{
                                            padding: '12px 14px',
                                            borderBottom: '1px solid rgba(255,255,255,.04)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <div
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background: isAdd ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {isAdd ? <Plus size={14} color={C.green} /> : <Minus size={14} color={C.red} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.text }}>{adj.productName}</div>
                                                        <div style={{ fontSize: 9.5, color: C.dim, marginTop: 2 }}>
                                                            {adj.user || 'System Admin'} · {formatDisplayDate(adj.date)}
                                                        </div>
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: 700,
                                                            fontFamily: 'ui-monospace, monospace',
                                                            color: isAdd ? C.green : C.red,
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {isAdd ? '+' : '-'}
                                                        {adj.quantity}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                                    <span
                                                        style={{
                                                            fontSize: 8,
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '.3px',
                                                            padding: '3px 8px',
                                                            borderRadius: 20,
                                                            background: 'rgba(79,142,247,.12)',
                                                            color: C.blue,
                                                        }}
                                                    >
                                                        {reasonLabel}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 9.5, color: C.dim, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <TrendingUp size={10} />
                                                    {adj.before} → {adj.after} units · {isAdd ? '+' : '-'}
                                                    {fmtUsd(impact)} inventory
                                                    {adj.note && <> · {adj.note}</>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Footer stats */}
                    <div
                        style={{
                            padding: '12px 14px',
                            borderTop: '1px solid rgba(255,255,255,.06)',
                            background: C.bg4,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                        }}
                    >
                        {[
                            { label: 'Units added', value: `+${historyStats.added}`, color: C.green },
                            { label: 'Units reduced', value: `-${historyStats.reduced}`, color: C.red },
                            { label: 'Adjustments', value: historyStats.count, color: C.text },
                        ].map((stat) => (
                            <div key={stat.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px', color: C.dim, marginBottom: 3 }}>
                                    {stat.label}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'ui-monospace, monospace', color: stat.color }}>
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
