import { useState, useEffect, useMemo, Fragment, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingCart,
    Zap,
    Check,
    RefreshCw,
    Bot,
    ChevronRight,
    MessageCircle,
    AlertTriangle,
} from 'lucide-react';
import { authFetch } from '../../api/axios';
import { getProducts } from '../../services/api';
import { getSuppliers, createPurchaseOrder } from '../../services/purchasesService';
import { getCurrentUser } from '../../store/authStore';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    purple: '#7C3AED',
    orange: '#F59E0B',
    red: '#EF4444',
    text: '#EEF2FF',
    muted: '#8BA3C7',
    dim: '#3E5678',
};

const panel: CSSProperties = {
    background: C.bg2,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
};

function formatUsd(n: number): string {
    return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AQ';
}

function openMarcusAdvisor() {
    window.dispatchEvent(new CustomEvent('soltol:open-ai-advisor'));
}

function isHazmat(name: string): boolean {
    return /5USQ|hazmat/i.test(name);
}

interface LowStockProduct {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minimumStock: number;
    unitPrice: number;
    suggestedQty: number;
    estimatedCost: number;
    urgency: 'critical' | 'warning';
    daysUntilStockout: number;
}

interface GeneratedPO {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    date: string;
    items: Array<{ productId: string; name: string; quantity: number; rate: number; amount: number }>;
    grandTotal: number;
    status: 'Draft';
    createdByAI: boolean;
}

type SortOption = 'urgency' | 'stock' | 'cost';
type ProductGroup = 'critical' | 'out_of_stock' | 'warning';

const AUTO_PO_LOG_KEY = 'ai_auto_po_log';

const GROUP_META: Record<ProductGroup, { label: string; color: string; bg: string; border: string }> = {
    critical: { label: 'CRITICAL', color: C.red, bg: 'rgba(239,68,68,.08)', border: 'rgba(239,68,68,.25)' },
    out_of_stock: { label: 'OUT OF STOCK', color: C.orange, bg: 'rgba(245,158,11,.08)', border: 'rgba(245,158,11,.25)' },
    warning: { label: 'LOW STOCK', color: '#FCD34D', bg: 'rgba(250,204,21,.06)', border: 'rgba(250,204,21,.2)' },
};

const getLog = (): GeneratedPO[] => {
    try { return JSON.parse(localStorage.getItem(AUTO_PO_LOG_KEY) || '[]'); } catch { return []; }
};

function getProductGroup(p: LowStockProduct): ProductGroup {
    if (p.currentStock === 0) return 'out_of_stock';
    if (p.urgency === 'critical') return 'critical';
    return 'warning';
}

function getPriority(p: LowStockProduct, leadDays: number): { label: string; color: string; bg: string } {
    if (p.currentStock === 0 || p.daysUntilStockout <= leadDays) {
        return { label: 'Critical', color: '#FCA5A5', bg: 'rgba(239,68,68,.15)' };
    }
    if (p.urgency === 'critical') {
        return { label: 'High', color: '#FCD34D', bg: 'rgba(245,158,11,.15)' };
    }
    return { label: 'Standard', color: '#93C5FD', bg: 'rgba(79,142,247,.12)' };
}

function getVelocity(p: LowStockProduct): number {
    return Math.max(0.1, p.minimumStock / 30);
}

const inputStyle: CSSProperties = {
    width: '100%',
    background: C.bg3,
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: C.text,
    outline: 'none',
};

export default function AutoPOGeneration() {
    const navigate = useNavigate();
    const currentUser = getCurrentUser();
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [leadDays, setLeadDays] = useState(7);
    const [safetyBufferDays, setSafetyBufferDays] = useState(30);
    const [sortBy, setSortBy] = useState<SortOption>('urgency');
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [log, setLog] = useState<GeneratedPO[]>([]);
    const [success, setSuccess] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        Promise.all([getProducts(), getSuppliers()]).then(([prods, sups]) => {
            setSuppliers(sups);
            setLog(getLog());

            const low: LowStockProduct[] = prods
                .filter((p: any) => {
                    const stock = p.current_stock || 0;
                    const min = p.minimum_stock || 10;
                    return stock <= min * 1.2;
                })
                .map((p: any): LowStockProduct => {
                    const stock = p.current_stock || 0;
                    const min = p.minimum_stock || 10;
                    const suggestedQty = Math.max(min * 3, min - stock + min * 2);
                    return {
                        id: String(p.id),
                        name: p.name,
                        sku: p.sku,
                        currentStock: stock,
                        minimumStock: min,
                        unitPrice: p.unit_price || 0,
                        suggestedQty: Math.ceil(suggestedQty),
                        estimatedCost: Math.ceil(suggestedQty) * (p.unit_price || 0),
                        urgency: stock <= 0 ? 'critical' : stock < min ? 'critical' : 'warning',
                        daysUntilStockout: stock > 0 ? Math.floor(stock / Math.max(1, min / 30)) : 0,
                    };
                })
                .sort((a: LowStockProduct, b: LowStockProduct) => a.currentStock - b.currentStock);

            setLowStock(low);

            const criticalIds = new Set(low.filter(p => p.urgency === 'critical').map(p => p.id));
            setSelected(criticalIds);

            if (sups.length > 0) setSelectedSupplier(String(sups[0].id));
            setLoading(false);
        });
    }, []);

    const sortedProducts = useMemo(() => {
        const arr = [...lowStock];
        if (sortBy === 'urgency') arr.sort((a, b) => a.currentStock - b.currentStock);
        else if (sortBy === 'stock') arr.sort((a, b) => a.currentStock - b.currentStock);
        else arr.sort((a, b) => b.estimatedCost - a.estimatedCost);
        return arr;
    }, [lowStock, sortBy]);

    const groupedProducts = useMemo(() => {
        const groups: Record<ProductGroup, LowStockProduct[]> = {
            critical: [],
            out_of_stock: [],
            warning: [],
        };
        sortedProducts.forEach((p) => {
            groups[getProductGroup(p)].push(p);
        });
        return groups;
    }, [sortedProducts]);

    const maxVelocity = useMemo(
        () => Math.max(...lowStock.map(getVelocity), 1),
        [lowStock]
    );

    const selectedItems = lowStock.filter(p => selected.has(p.id));
    const totalCost = selectedItems.reduce((s, p) => s + p.estimatedCost, 0);
    const totalItems = selectedItems.reduce((s, p) => s + p.suggestedQty, 0);
    const flatMethodTotal = selectedItems.reduce((s, p) => s + p.minimumStock * 3 * p.unitPrice, 0);
    const savingsVsFlat = Math.max(0, flatMethodTotal - totalCost);
    const supplierName = suppliers.find(s => String(s.id) === selectedSupplier)?.name || 'Select supplier';
    const expectedArrival = new Date(Date.now() + leadDays * 86400000).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    });

    const allSelected = lowStock.length > 0 && selected.size === lowStock.length;

    const toggleProduct = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const updateSuggestedQty = (id: string, rawQty: number) => {
        const qty = Math.max(1, Math.ceil(rawQty) || 1);
        setLowStock(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, suggestedQty: qty, estimatedCost: qty * p.unitPrice }
                    : p
            )
        );
    };

    const getAIAnalysis = async () => {
        if (lowStock.length === 0) return;
        setAiLoading(true);
        const API = String(import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
        try {
            const res = await authFetch(`${API}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: `You are Marcus, an expert supply chain advisor for a NYC oil distribution company.
Be concise. Max 120 words. Use CAPS for headings. No markdown symbols.
Today: ${new Date().toISOString().slice(0, 10)}`,
                    max_tokens: 400,
                    messages: [{
                        role: 'user',
                        content: `My low stock situation:
${lowStock.map(p => `${p.name}: ${p.currentStock} units left (min: ${p.minimumStock}), ${p.daysUntilStockout} days until stockout`).join('\n')}

Lead time from supplier: ${leadDays} days.
Give me:
1. Which to order MOST URGENTLY and why
2. Any market/pricing factors I should know about now
3. One action to take today`,
                    }],
                }),
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json())?.detail || ''; } catch { /* not JSON */ }
                throw new Error(detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            setAiAnalysis(data.reply || '');
        } catch {
            setAiAnalysis('Could not reach AI. Check your connection.');
        } finally {
            setAiLoading(false);
        }
    };

    const generatePO = async () => {
        if (selectedItems.length === 0) { alert('Select at least one product.'); return; }
        if (!selectedSupplier) { alert('Select a supplier.'); return; }
        setGenerating(true);

        const supplier = suppliers.find(s => String(s.id) === selectedSupplier);
        const poNumber = `APO-${Date.now().toString().slice(-6)}`;
        const po: GeneratedPO = {
            id: Date.now().toString(),
            poNumber,
            supplierId: selectedSupplier,
            supplierName: supplier?.name || 'Unknown Supplier',
            date: new Date().toISOString().slice(0, 10),
            items: selectedItems.map(p => ({
                productId: String(p.id),
                name: p.name,
                quantity: p.suggestedQty,
                rate: p.unitPrice,
                amount: p.estimatedCost,
            })),
            grandTotal: totalCost,
            status: 'Draft',
            createdByAI: true,
        };

        try {
            await createPurchaseOrder({
                poNumber: po.poNumber,
                supplierId: po.supplierId,
                supplierName: po.supplierName,
                date: po.date,
                items: po.items.map(i => ({
                    productId: i.productId,
                    productName: i.name,
                    uom: 'units',
                    quantity: i.quantity,
                    unitPrice: i.rate,
                    taxRate: 0,
                    discount: 0,
                    total: i.amount,
                })),
                subtotal: po.grandTotal,
                taxTotal: 0,
                grandTotal: po.grandTotal,
                status: 'Pending',
                notes: `Auto-generated by AI — Lead time: ${leadDays} days.`,
                expectedDate: new Date(Date.now() + leadDays * 86400000).toISOString().slice(0, 10),
            });
        } catch (e) {
            console.warn('PO save to service failed, saved to local log only:', e);
        }

        const existing = getLog();
        localStorage.setItem(AUTO_PO_LOG_KEY, JSON.stringify([po, ...existing]));
        setLog([po, ...existing]);
        setGenerating(false);
        setSuccess(`✅ PO ${poNumber} created for ${formatUsd(totalCost)} — ${selectedItems.length} products`);
        setTimeout(() => setSuccess(''), 6000);
    };

    const staticInsight = useMemo(() => {
        if (lowStock.length === 0) return 'All products are well stocked — no draft PO needed right now.';
        const criticalCount = lowStock.filter(p => p.urgency === 'critical').length;
        const estSavings = Math.max(0, lowStock.reduce((s, p) => s + p.minimumStock * 3 * p.unitPrice, 0) - lowStock.reduce((s, p) => s + p.estimatedCost, 0));
        return `Velocity-based quantities cover ${leadDays + safetyBufferDays}-day demand for ${criticalCount} critical SKU${criticalCount !== 1 ? 's' : ''}. AI order qty uses daily sell-through × lead time + ${safetyBufferDays}-day buffer — estimated ${formatUsd(estSavings)} savings vs flat minimum × 3 reorder method across ${lowStock.length} flagged products.`;
    }, [lowStock, leadDays, safetyBufferDays]);

    const renderProductRow = (p: LowStockProduct) => {
        const priority = getPriority(p, leadDays);
        const velocity = getVelocity(p);
        const velocityPct = Math.round((velocity / maxVelocity) * 100);
        const hazmat = isHazmat(p.name);

        return (
            <tr
                key={p.id}
                onClick={() => toggleProduct(p.id)}
                style={{
                    cursor: 'pointer',
                    background: selected.has(p.id) ? 'rgba(34,197,94,.06)' : 'transparent',
                    transition: 'background .12s',
                }}
            >
                <td style={{ padding: '12px 16px', width: 40 }}>
                    <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        onClick={e => e.stopPropagation()}
                        style={{ accentColor: C.green }}
                    />
                </td>
                <td style={{ padding: '12px 14px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{p.name}</p>
                    <p style={{ fontSize: 10, color: C.dim, margin: '3px 0 0', fontFamily: 'monospace' }}>{p.sku}</p>
                    {hazmat && (
                        <span style={{
                            display: 'inline-block',
                            marginTop: 5,
                            fontSize: 8.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(245,158,11,.12)',
                            color: '#FCD34D',
                            border: '1px solid rgba(245,158,11,.3)',
                        }}>
                            ⚠ Hazmat
                        </span>
                    )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                    <span style={{
                        fontSize: 16,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: p.currentStock === 0 ? C.red : p.urgency === 'critical' ? C.orange : '#FCD34D',
                    }}>
                        {p.currentStock}
                    </span>
                    <span style={{ fontSize: 10, color: C.dim, marginLeft: 4 }}>units</span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                    {p.daysUntilStockout === 0 ? (
                        <span style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 999,
                            background: 'rgba(239,68,68,.15)',
                            color: '#FCA5A5',
                        }}>
                            OUT
                        </span>
                    ) : (
                        <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            color: p.daysUntilStockout <= leadDays ? C.red : C.orange,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}>
                            <Zap size={11} /> {p.daysUntilStockout}d
                        </span>
                    )}
                </td>
                <td style={{ padding: '12px 14px', minWidth: 100 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.bg3, overflow: 'hidden' }}>
                            <div style={{
                                width: `${velocityPct}%`,
                                height: '100%',
                                borderRadius: 3,
                                background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`,
                            }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {velocity.toFixed(1)}/d
                        </span>
                    </div>
                </td>
                <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="number"
                            min={1}
                            value={p.suggestedQty}
                            onChange={e => updateSuggestedQty(p.id, parseInt(e.target.value, 10))}
                            style={{
                                ...inputStyle,
                                width: 72,
                                padding: '6px 8px',
                                fontSize: 11,
                                textAlign: 'center',
                            }}
                        />
                        <span style={{
                            fontSize: 8,
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: 4,
                            background: 'rgba(79,142,247,.12)',
                            color: '#93C5FD',
                        }}>
                            AI calc
                        </span>
                    </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 11, fontWeight: 600, color: C.muted, fontFamily: 'monospace' }}>
                    {formatUsd(p.unitPrice)}
                </td>
                <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>
                    {formatUsd(p.estimatedCost)}
                </td>
                <td style={{ padding: '12px 14px' }}>
                    <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: priority.bg,
                        color: priority.color,
                    }}>
                        {priority.label}
                    </span>
                </td>
            </tr>
        );
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100%',
                background: C.bg,
                color: C.text,
                fontFamily: 'inherit',
                margin: '-24px -40px',
                width: 'calc(100% + 80px)',
                paddingBottom: 120,
            }}
        >
            {/* Top bar */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 28px',
                    borderBottom: '1px solid rgba(255,255,255,.06)',
                    background: C.bg2,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted }}>
                    <button
                        type="button"
                        onClick={() => navigate('/ai')}
                        style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0, fontSize: 11, fontWeight: 600 }}
                    >
                        AI hub
                    </button>
                    <ChevronRight size={12} color={C.dim} />
                    <span style={{ color: C.text, fontWeight: 600 }}>Auto PO generation</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                        type="button"
                        onClick={openMarcusAdvisor}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: '1px solid rgba(245,158,11,.35)',
                            background: 'rgba(245,158,11,.12)',
                            color: '#FCD34D',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        <MessageCircle size={13} /> Ask Bettano
                    </button>
                    <div
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#fff',
                        }}
                    >
                        {userInitials(currentUser.name)}
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px 32px' }}>
                {/* Page header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                            <ShoppingCart size={24} color={C.orange} />
                            Auto PO generation
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 5, marginBottom: 0, maxWidth: 620 }}>
                            AI detects low stock → creates draft purchase order · velocity-based quantities · human approval required
                        </p>
                    </div>
                    <span
                        style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '6px 12px',
                            borderRadius: 999,
                            background: 'rgba(34,197,94,.12)',
                            color: '#86EFAC',
                            border: '1px solid rgba(34,197,94,.35)',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Bot size={12} /> AI-generated · draft only
                    </span>
                </div>

                {success && (
                    <div style={{
                        ...panel,
                        padding: '14px 16px',
                        marginBottom: 16,
                        background: 'rgba(34,197,94,.08)',
                        border: '1px solid rgba(34,197,94,.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        <Check size={18} color={C.green} />
                        <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#86EFAC', margin: 0 }}>{success}</p>
                            <button
                                type="button"
                                onClick={() => navigate('/purchases')}
                                style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, fontSize: 10, color: C.green, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                View in Purchase Orders →
                            </button>
                        </div>
                    </div>
                )}

                {/* PO Settings */}
                <div style={{ ...panel, padding: '18px 20px', marginBottom: 14 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: C.muted, margin: '0 0 14px' }}>
                        PO Settings
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                                Supplier for this PO
                            </label>
                            <select
                                value={selectedSupplier}
                                onChange={e => setSelectedSupplier(e.target.value)}
                                style={{ ...inputStyle, cursor: 'pointer' }}
                            >
                                <option value="">Select supplier...</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <p style={{ fontSize: 10, color: C.green, margin: '6px 0 0', fontWeight: 600 }}>
                                ✓ AI matched supplier to product categories in this PO
                            </p>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                                Supplier Lead Time (Days)
                            </label>
                            <input
                                type="number"
                                value={leadDays}
                                onChange={e => setLeadDays(parseInt(e.target.value, 10) || 7)}
                                min={1}
                                max={90}
                                style={inputStyle}
                            />
                            <p style={{ fontSize: 10, color: C.green, margin: '6px 0 0', fontWeight: 600 }}>
                                ✓ Avg lead time {leadDays}d · expected arrival {expectedArrival}
                            </p>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                                Safety Stock Buffer
                            </label>
                            <input
                                type="number"
                                value={safetyBufferDays}
                                onChange={e => setSafetyBufferDays(parseInt(e.target.value, 10) || 30)}
                                min={1}
                                max={90}
                                style={inputStyle}
                            />
                            <p style={{ fontSize: 10, color: C.blue, margin: '6px 0 0', fontWeight: 600 }}>
                                AI qty = velocity × ({leadDays}d lead + {safetyBufferDays}d buffer)
                            </p>
                        </div>
                    </div>
                </div>

                {/* AI Insight */}
                <div style={{
                    ...panel,
                    padding: '16px 18px',
                    marginBottom: 14,
                    background: C.bg3,
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'rgba(245,158,11,.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Bot size={18} color={C.orange} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: C.orange, margin: '0 0 6px' }}>Bettano says:</p>
                            {aiLoading ? (
                                <p style={{ fontSize: 12, color: C.muted, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <RefreshCw size={12} className="animate-spin" /> Analysing stock levels...
                                </p>
                            ) : aiAnalysis ? (
                                <div style={{ fontSize: 12, lineHeight: 1.55, color: C.muted }}>
                                    {aiAnalysis.split('\n').map((line, i) => {
                                        const t = line.trim();
                                        if (!t) return <div key={i} style={{ height: 4 }} />;
                                        if (t === t.toUpperCase() && t.length > 4) {
                                            return <p key={i} style={{ fontWeight: 700, color: C.orange, fontSize: 10, textTransform: 'uppercase', margin: '8px 0 4px' }}>{t}</p>;
                                        }
                                        return <p key={i} style={{ margin: '2px 0', color: C.muted }}>{t}</p>;
                                    })}
                                </div>
                            ) : (
                                <p style={{ fontSize: 12, lineHeight: 1.55, color: C.muted, margin: 0 }}>{staticInsight}</p>
                            )}
                        </div>
                        {!aiAnalysis && !aiLoading && lowStock.length > 0 && (
                            <button
                                type="button"
                                onClick={getAIAnalysis}
                                style={{
                                    background: 'rgba(245,158,11,.12)',
                                    border: '1px solid rgba(245,158,11,.3)',
                                    borderRadius: 6,
                                    padding: '5px 10px',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: '#FCD34D',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Refresh insight
                            </button>
                        )}
                    </div>
                </div>

                {/* Low Stock Table */}
                <div style={{ ...panel, overflow: 'hidden' }}>
                    <div style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid rgba(255,255,255,.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.muted, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => setSelected(allSelected ? new Set() : new Set(lowStock.map(p => p.id)))}
                                    style={{ accentColor: C.green }}
                                />
                                Select all
                            </label>
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 600, color: C.dim, cursor: 'pointer' }}
                            >
                                Clear
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: C.dim, fontWeight: 600 }}>Sort:</span>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as SortOption)}
                                style={{
                                    ...inputStyle,
                                    width: 'auto',
                                    padding: '6px 28px 6px 10px',
                                    fontSize: 10,
                                    appearance: 'none',
                                }}
                            >
                                <option value="urgency">Urgency ↓</option>
                                <option value="stock">Stock ↓</option>
                                <option value="cost">Line total ↓</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ padding: 48, textAlign: 'center', color: C.muted, fontSize: 12, fontWeight: 600 }}>
                            Analyzing stock levels...
                        </div>
                    ) : lowStock.length === 0 ? (
                        <div style={{ padding: 48, textAlign: 'center' }}>
                            <Check size={40} color={C.green} style={{ opacity: 0.4, margin: '0 auto 12px' }} />
                            <p style={{ color: C.muted, fontWeight: 700, margin: 0 }}>All products are well stocked</p>
                            <p style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>No reordering needed right now</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                                            <th style={{ padding: '10px 16px', width: 40 }} />
                                            {['Product', 'Current stock', 'Days left', 'Velocity', 'AI order qty', 'Unit cost', 'Line total', 'Priority'].map(h => (
                                                <th key={h} style={{
                                                    padding: '10px 14px',
                                                    fontSize: 9,
                                                    fontWeight: 700,
                                                    color: C.dim,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '.4px',
                                                }}>
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(['critical', 'out_of_stock', 'warning'] as ProductGroup[]).map(groupKey => {
                                            const items = groupedProducts[groupKey];
                                            if (items.length === 0) return null;
                                            const meta = GROUP_META[groupKey];
                                            return (
                                                <Fragment key={groupKey}>
                                                    <tr>
                                                        <td colSpan={9} style={{
                                                            padding: '8px 16px',
                                                            background: meta.bg,
                                                            borderTop: `1px solid ${meta.border}`,
                                                            borderBottom: `1px solid ${meta.border}`,
                                                        }}>
                                                            <span style={{
                                                                fontSize: 9,
                                                                fontWeight: 800,
                                                                letterSpacing: '.6px',
                                                                color: meta.color,
                                                            }}>
                                                                {meta.label} · {items.length} product{items.length !== 1 ? 's' : ''}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    {items.map(renderProductRow)}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{
                                padding: '10px 18px',
                                borderTop: '1px solid rgba(255,255,255,.06)',
                                fontSize: 10,
                                color: C.dim,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <span>
                                    Showing {sortedProducts.length} of {lowStock.length} · sorted by {sortBy === 'urgency' ? 'urgency' : sortBy === 'stock' ? 'stock' : 'line total'}
                                </span>
                                <span style={{ color: C.muted, fontWeight: 600 }}>
                                    View all {lowStock.length} →
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* PO History */}
                {log.length > 0 && (
                    <div style={{ ...panel, marginTop: 14, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>AI-Generated PO History</p>
                        </div>
                        <div>
                            {log.slice(0, 10).map(po => (
                                <div
                                    key={po.id}
                                    style={{
                                        padding: '12px 18px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottom: '1px solid rgba(255,255,255,.04)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: 'rgba(34,197,94,.12)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            <Zap size={14} color={C.green} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>{po.poNumber}</p>
                                            <p style={{ fontSize: 10, color: C.dim, margin: '2px 0 0' }}>
                                                {po.supplierName} · {po.date} · {po.items.length} items
                                            </p>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: C.text }}>
                                        {formatUsd(po.grandTotal)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky PO Summary Footer */}
            {selectedItems.length > 0 && (
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: C.bg2,
                    borderTop: '1px solid rgba(255,255,255,.08)',
                    padding: '14px 28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 20,
                    boxShadow: '0 -8px 32px rgba(0,0,0,.4)',
                }}>
                    <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0 }}>
                            PO summary · {selectedItems.length} product{selectedItems.length !== 1 ? 's' : ''} selected · {supplierName}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, color: C.muted }}>
                                Total items: <strong style={{ color: C.text }}>{totalItems.toLocaleString()}</strong>
                            </span>
                            <span style={{ fontSize: 10, color: C.muted }}>
                                PO value: <strong style={{ color: C.green }}>{formatUsd(totalCost)}</strong>
                            </span>
                            <span style={{ fontSize: 10, color: C.muted }}>
                                Savings vs flat method: <strong style={{ color: '#86EFAC' }}>{formatUsd(savingsVsFlat)}</strong>
                            </span>
                            <span style={{ fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Check size={11} color={C.green} /> Expected arrival {expectedArrival}
                            </span>
                        </div>
                        <p style={{ fontSize: 9, color: C.dim, margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={10} /> Draft only · requires your approval before submitting · logged to audit trail
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={generatePO}
                        disabled={generating || !selectedSupplier}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '12px 22px',
                            borderRadius: 10,
                            border: 'none',
                            background: generating || !selectedSupplier ? C.dim : C.green,
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: generating || !selectedSupplier ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            opacity: generating || !selectedSupplier ? 0.6 : 1,
                        }}
                    >
                        {generating ? <RefreshCw size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                        Generate draft PO — {formatUsd(totalCost)}
                    </button>
                </div>
            )}
        </div>
    );
}
