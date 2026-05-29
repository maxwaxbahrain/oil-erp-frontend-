import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Brain,
    Zap,
    AlertTriangle,
    CheckCircle2,
    RefreshCw,
    ShieldAlert,
    ArrowRight,
    X,
    Check,
    BarChart3,
    ClipboardList,
    Trash2,
    SlidersHorizontal,
} from 'lucide-react';
import { aiStockService, type AIStockAdjustment, type AIInsight } from '../../services/aiStockService';
import { getProducts, type Product } from '../../services/productService';
import { getOilErpApiBase } from '../../config/apiBase';

type DecisionLogItem = {
    id: string;
    adjustmentId: string;
    action: 'approved' | 'rejected' | 'manual';
    productName: string;
    quantityChange: number;
    timestamp: string;
    note: string;
};

const DECISION_LOG_KEY = 'zavi_stock_adjustment_decision_log';
const AUTO_APPROVE_KEY = 'zavi_stock_auto_approve_threshold';

const C = {
    bg: '#060f1c',
    bg2: '#0a1726',
    bg3: '#0f1f33',
    blue: '#4F8EF7',
    green: '#22C55E',
    red: '#EF4444',
    amber: '#F59E0B',
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

const purpleBtn: CSSProperties = {
    ...ghostBtn,
    border: 'none',
    background: C.purple,
    color: '#fff',
    fontWeight: 600,
};

function fmtUsd(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getProductSku(products: Product[], productId: string, productName: string): string {
    const p = products.find(x => x.id === productId || x.name === productName);
    return p?.sku || productId;
}

function getUnitCost(products: Product[], productId: string, productName: string): number | null {
    const p = products.find(x => x.id === productId || x.name === productName);
    if (!p) return null;
    const cost = p.pricing?.landedCost ?? p.priceHistory?.[0]?.cost;
    if (cost && cost > 0) return cost;
    return null;
}

export default function StockAdjustmentManager() {
    const navigate = useNavigate();
    const [adjustments, setAdjustments] = useState<AIStockAdjustment[]>([]);
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'auto' | 'approval_required' | 'investigation_required'>('all');
    const [decisionLog, setDecisionLog] = useState<DecisionLogItem[]>([]);
    const [manualOpen, setManualOpen] = useState(false);
    const [manualProductId, setManualProductId] = useState('');
    const [manualDelta, setManualDelta] = useState<number>(0);
    const [manualNote, setManualNote] = useState('');
    const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [autoApproveThreshold, setAutoApproveThreshold] = useState(() => {
        try {
            const v = localStorage.getItem(AUTO_APPROVE_KEY);
            return v ? Number(v) : 90;
        } catch {
            return 90;
        }
    });

    useEffect(() => {
        loadData();
        try {
            const stored = localStorage.getItem(DECISION_LOG_KEY);
            if (stored) setDecisionLog(JSON.parse(stored));
        } catch {
            setDecisionLog([]);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => { void loadData(); }, 30000);
        return () => clearInterval(timer);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [adjs, ins, prods] = await Promise.all([
                aiStockService.scanForAnomalies(),
                aiStockService.getInsights(),
                getProducts(),
            ]);
            setAdjustments(adjs);
            setInsights(ins);
            setProducts(prods);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const saveDecision = (entry: DecisionLogItem) => {
        const next = [entry, ...decisionLog].slice(0, 40);
        setDecisionLog(next);
        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(next));
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        setProcessingId(id);
        try {
            if (action === 'approve') {
                await aiStockService.approveAdjustment(id);
                const adjustment = adjustments.find(a => a.id === id);
                if (adjustment) {
                    saveDecision({
                        id: `dec-${Date.now()}`,
                        adjustmentId: adjustment.id,
                        action: 'approved',
                        productName: adjustment.productName,
                        quantityChange: adjustment.suggestedAdjustment,
                        timestamp: new Date().toISOString(),
                        note: 'Approved from Pending Management Approval and applied to stock.',
                    });
                }
            } else {
                await aiStockService.rejectAdjustment(id);
                const adjustment = adjustments.find(a => a.id === id);
                if (adjustment) {
                    saveDecision({
                        id: `dec-${Date.now()}`,
                        adjustmentId: adjustment.id,
                        action: 'rejected',
                        productName: adjustment.productName,
                        quantityChange: adjustment.suggestedAdjustment,
                        timestamp: new Date().toISOString(),
                        note: 'Rejected from Pending Management Approval.',
                    });
                }
            }
            setAdjustments(prev => prev.filter(a => a.id !== id));
            await loadData();
        } catch {
            alert('Action failed');
        } finally {
            setProcessingId(null);
        }
    };

    const applyManualAdjustment = async () => {
        setManualFeedback(null);
        if (!manualProductId) {
            setManualFeedback({ type: 'error', message: 'Select a product for manual adjustment.' });
            return;
        }
        if (!Number.isFinite(manualDelta) || manualDelta === 0) {
            setManualFeedback({ type: 'error', message: 'Enter a valid non-zero quantity change.' });
            return;
        }
        const product = products.find(p => p.id === manualProductId);
        if (!product) {
            setManualFeedback({ type: 'error', message: 'Selected product not found.' });
            return;
        }

        let backendOk = false;
        let backendErr = '';
        let backendNewStock: number | null = null;
        try {
            const base = getOilErpApiBase().replace(/\/$/, '');
            const listResp = await fetch(`${base}/products/`, { cache: 'no-store' });
            if (!listResp.ok) {
                backendErr = `GET /products/ -> HTTP ${listResp.status}`;
            } else {
                const list = await listResp.json();
                const arr = Array.isArray(list) ? list : (list?.results || list?.data || []);
                const targetName = String(product.name || '').trim().toLowerCase();
                const backendProduct = arr.find((p: { name?: string; id?: string | number; stock?: number }) =>
                    String(p?.name || '').trim().toLowerCase() === targetName);
                if (!backendProduct) {
                    backendErr = `No backend product matches "${product.name}". Catalog may be stale.`;
                } else {
                    const currentBackendStock = Number(backendProduct.stock) || 0;
                    backendNewStock = currentBackendStock + manualDelta;
                    const putResp = await fetch(`${base}/products/${backendProduct.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ stock: backendNewStock }),
                    });
                    if (putResp.ok) {
                        backendOk = true;
                    } else {
                        backendErr = `PUT /products/${backendProduct.id} -> HTTP ${putResp.status}`;
                    }
                }
            }
        } catch (e) {
            backendErr = e instanceof Error ? e.message : String(e);
        }

        const safeLocations = product.locations?.length
            ? product.locations
            : [{ id: `LOC-MAIN-${product.id}`, name: 'Main Warehouse', type: 'Warehouse' as const, currentStock: 0 }];
        const newFirstLocStock = backendNewStock != null
            ? backendNewStock
            : (Number(safeLocations[0]?.currentStock) || 0) + manualDelta;

        const updatedProducts = products.map((p) => {
            if (p.id !== manualProductId) return p;
            const updatedLocations = safeLocations.map((loc, index) =>
                index === 0 ? { ...loc, currentStock: newFirstLocStock } : loc,
            );
            return { ...p, locations: updatedLocations };
        });

        localStorage.setItem('zavi_products', JSON.stringify(updatedProducts));
        setProducts(updatedProducts);
        saveDecision({
            id: `dec-${Date.now()}`,
            adjustmentId: `manual-${manualProductId}-${Date.now()}`,
            action: 'manual',
            productName: product.name,
            quantityChange: manualDelta,
            timestamp: new Date().toISOString(),
            note: manualNote.trim() || 'Manual adjustment from Stock Adjustment Manager.',
        });
        setManualDelta(0);
        setManualNote('');
        setManualFeedback({
            type: backendOk ? 'success' : 'error',
            message: backendOk
                ? `Stock for ${product.name} updated to ${backendNewStock} on server (delta ${manualDelta > 0 ? '+' : ''}${manualDelta}).`
                : `Local change saved, but server update failed: ${backendErr || 'unknown error'}. Refresh Product Catalog and try again.`,
        });
    };

    const handleThresholdChange = (value: number) => {
        setAutoApproveThreshold(value);
        localStorage.setItem(AUTO_APPROVE_KEY, String(value));
    };

    const filteredAdjustments = useMemo(() => adjustments.filter(adj => {
        const matchesSearch = adj.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            adj.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || adj.type === filterType;
        return matchesSearch && matchesFilter;
    }), [adjustments, searchTerm, filterType]);

    const autoAdjustedCount = adjustments.filter(a => a.type === 'auto').length;
    const pendingItems = filteredAdjustments.filter(a => a.type === 'approval_required');
    const criticalItems = filteredAdjustments.filter(a => a.type === 'investigation_required');
    const pendingCount = adjustments.filter(a => a.type === 'approval_required').length;
    const criticalCount = adjustments.filter(a => a.type === 'investigation_required').length;
    const zeroStockCount = adjustments.filter(a => a.currentStock <= 0).length;
    const avgConfidence = adjustments.length > 0
        ? Math.round(adjustments.reduce((sum, a) => sum + a.confidence, 0) / adjustments.length)
        : 0;

    const highConfPending = pendingItems.filter(a => a.confidence >= autoApproveThreshold);
    const lowConfPending = pendingItems.filter(a => a.confidence < autoApproveThreshold);

    const criticalPending = [
        ...criticalItems,
        ...pendingItems.filter(a => (a.aiAnalysis?.riskScore ?? 0) >= 80 || a.currentStock < 0),
    ];
    const highZeroPending = pendingItems.filter(
        a => a.currentStock === 0 && !criticalPending.some(c => c.id === a.id),
    );
    const otherPending = pendingItems.filter(
        a => !criticalPending.some(c => c.id === a.id) && !highZeroPending.some(h => h.id === a.id),
    );

    const confidenceBuckets = useMemo(() => {
        const buckets = [
            { label: '90–100%', min: 90, max: 100, color: C.green },
            { label: '80–89%', min: 80, max: 89, color: C.blue },
            { label: '70–79%', min: 70, max: 79, color: C.amber },
            { label: '<70%', min: 0, max: 69, color: C.red },
        ];
        const total = Math.max(adjustments.length, 1);
        return buckets.map(b => ({
            ...b,
            count: adjustments.filter(a => a.confidence >= b.min && a.confidence <= b.max).length,
            pct: Math.round((adjustments.filter(a => a.confidence >= b.min && a.confidence <= b.max).length / total) * 100),
        }));
    }, [adjustments]);

    const costImpact = useMemo(() => {
        const restockUnits = pendingItems.reduce((s, a) => s + Math.max(0, a.suggestedAdjustment), 0);
        const restockCost = pendingItems.reduce(
            (s, a) => {
                const unitCost = getUnitCost(products, a.productId, a.productName);
                return unitCost === null ? s : s + Math.max(0, a.suggestedAdjustment) * unitCost;
            },
            0,
        );
        const revenueUnlock = null;
        const roi = null;
        return { restockUnits, restockCost, revenueUnlock, roi };
    }, [pendingItems, products]);

    const autoLogItems = filteredAdjustments.filter(a => a.type === 'auto').slice(0, 12);

    const handleBulkApprove = async () => {
        const ids = highConfPending.map(a => a.id);
        if (ids.length === 0) return;
        setBulkProcessing(true);
        try {
            for (const id of ids) {
                await handleAction(id, 'approve');
            }
        } finally {
            setBulkProcessing(false);
        }
    };

    const renderPendingCard = (adj: AIStockAdjustment, isCritical: boolean) => {
        const sku = getProductSku(products, adj.productId, adj.productName);
        const suggestedStock = adj.currentStock + adj.suggestedAdjustment;
        return (
            <div
                key={adj.id}
                style={{
                    ...panel,
                    padding: '12px 14px',
                    marginBottom: 8,
                    borderLeft: `3px solid ${isCritical ? C.red : C.amber}`,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 2 }}>{adj.productName}</div>
                        <div style={{ fontSize: 9.5, color: C.dim, marginBottom: 8 }}>{sku}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {isCritical && (
                                <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(239,68,68,.15)', color: C.red }}>
                                    Critical
                                </span>
                            )}
                            <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(155,111,228,.15)', color: C.purple }}>
                                AI {adj.confidence}%
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 8 }}>
                            <span style={{ color: C.muted }}>{adj.currentStock}</span>
                            <ArrowRight size={12} color={C.dim} />
                            <span style={{ color: C.green, fontWeight: 600 }}>{suggestedStock}</span>
                            <span style={{ fontSize: 9, color: C.dim }}>units</span>
                        </div>
                        <p style={{ fontSize: 10, color: C.muted, lineHeight: 1.45, margin: 0 }}>{adj.description}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button
                        type="button"
                        onClick={() => handleAction(adj.id, 'reject')}
                        disabled={processingId === adj.id || bulkProcessing}
                        style={{ ...ghostBtn, flex: 1, justifyContent: 'center', fontSize: 10 }}
                    >
                        <X size={12} /> Skip
                    </button>
                    <button
                        type="button"
                        onClick={() => handleAction(adj.id, 'approve')}
                        disabled={processingId === adj.id || bulkProcessing}
                        style={{
                            ...ghostBtn,
                            flex: 1,
                            justifyContent: 'center',
                            fontSize: 10,
                            border: 'none',
                            background: C.green,
                            color: '#fff',
                            fontWeight: 600,
                        }}
                    >
                        {processingId === adj.id ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                        Approve restock
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
                <div style={{ textAlign: 'center' }}>
                    <RefreshCw size={28} color={C.purple} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: 12, fontSize: 11, color: C.muted }}>Loading stock adjustment manager…</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Stock adjustment manager</div>
                    <div style={{ fontSize: 10.5, color: C.muted, marginTop: 3 }}>
                        AI monitors stock 24h · suggests adjustments · human approves · full audit log
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={loadData} style={ghostBtn}>
                        <RefreshCw size={12} /> Refresh
                    </button>
                    <button type="button" onClick={() => setManualOpen(true)} style={ghostBtn}>
                        Manual adjustment
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setFilterType('all');
                            setSearchTerm('');
                            navigate('/inventory/ai-stock-control');
                        }}
                        style={purpleBtn}
                    >
                        <Brain size={12} /> Stock Control AI
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                    {
                        label: 'Auto-Adjusted (24h)',
                        value: autoAdjustedCount,
                        sub: 'Saved 1.5 hours',
                        subColor: C.green,
                        valueColor: C.green,
                        icon: <CheckCircle2 size={14} color={C.green} />,
                    },
                    {
                        label: 'Pending Approval',
                        value: pendingCount,
                        sub: `avg confidence ${avgConfidence}%`,
                        subColor: C.amber,
                        valueColor: C.amber,
                        icon: <Zap size={14} color={C.amber} />,
                    },
                    {
                        label: 'Critical Flags',
                        value: criticalCount,
                        sub: `${zeroStockCount} SKUs at 0 units`,
                        subColor: C.red,
                        valueColor: C.red,
                        icon: <ShieldAlert size={14} color={C.red} />,
                    },
                    {
                        label: 'System Confidence',
                        value: `${avgConfidence}%`,
                        sub: insights[0]?.metric || 'Live catalog',
                        subColor: C.purple,
                        valueColor: C.purple,
                        icon: <Brain size={14} color={C.purple} />,
                    },
                ].map(card => (
                    <div key={card.label} style={{ ...panel, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.dim }}>
                                {card.label}
                            </span>
                            {card.icon}
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: card.valueColor, lineHeight: 1 }}>{card.value}</div>
                        <div style={{ fontSize: 9.5, color: card.subColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                            {card.label.startsWith('Auto') && <Zap size={10} fill="currentColor" />}
                            {card.sub}
                        </div>
                    </div>
                ))}
            </div>

            {/* Automation */}
            <div style={{ ...panel, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SlidersHorizontal size={14} color={C.muted} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Auto-approve threshold</span>
                        <span style={{ fontSize: 10, color: C.muted }}>≥ {autoApproveThreshold}%</span>
                        <span style={{
                            fontSize: 8,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 20,
                            background: 'rgba(34,197,94,.15)',
                            color: C.green,
                            textTransform: 'uppercase',
                        }}>
                            Active
                        </span>
                    </div>
                    <input
                        type="range"
                        min={70}
                        max={99}
                        value={autoApproveThreshold}
                        onChange={e => handleThresholdChange(Number(e.target.value))}
                        style={{ width: 160, accentColor: C.green }}
                    />
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(34,197,94,.08)',
                    border: '1px solid rgba(34,197,94,.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 size={16} color={C.green} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
                            {highConfPending.length} suggestion{highConfPending.length !== 1 ? 's' : ''} ≥ {autoApproveThreshold}%
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            type="button"
                            onClick={handleBulkApprove}
                            disabled={highConfPending.length === 0 || bulkProcessing}
                            style={{
                                ...ghostBtn,
                                border: 'none',
                                background: C.green,
                                color: '#fff',
                                fontWeight: 600,
                                opacity: highConfPending.length === 0 ? 0.5 : 1,
                            }}
                        >
                            {bulkProcessing ? <RefreshCw size={12} /> : <Check size={12} />}
                            Approve all {highConfPending.length}
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType('approval_required')}
                            style={ghostBtn}
                        >
                            Review {lowConfPending.length} low confidence
                        </button>
                    </div>
                </div>
            </div>

            {/* Two-column main */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 10, alignItems: 'start' }}>
                {/* Left: Pending */}
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 8 }}>
                        Pending management approval
                    </div>

                    {criticalPending.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: C.red,
                                textTransform: 'uppercase',
                                letterSpacing: '.5px',
                                marginBottom: 6,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}>
                                <AlertTriangle size={11} /> Critical — stockout risk
                            </div>
                            {criticalPending.map(adj => renderPendingCard(adj, true))}
                        </div>
                    )}

                    {highZeroPending.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: C.amber,
                                textTransform: 'uppercase',
                                letterSpacing: '.5px',
                                marginBottom: 6,
                            }}>
                                High — 0 units
                            </div>
                            {highZeroPending.map(adj => renderPendingCard(adj, false))}
                        </div>
                    )}

                    {otherPending.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <div style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: C.blue,
                                textTransform: 'uppercase',
                                letterSpacing: '.5px',
                                marginBottom: 6,
                            }}>
                                Restock suggested
                            </div>
                            {otherPending.map(adj => renderPendingCard(adj, false))}
                        </div>
                    )}

                    {criticalPending.length + highZeroPending.length + otherPending.length === 0 && (
                        <div style={{ ...panel, padding: 24, textAlign: 'center' }}>
                            <CheckCircle2 size={32} color={C.dim} style={{ margin: '0 auto 8px' }} />
                            <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>No pending approvals</p>
                        </div>
                    )}
                </div>

                {/* Right */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Confidence breakdown */}
                    <div style={{ ...panel, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <BarChart3 size={12} /> AI confidence breakdown
                        </div>
                        <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 10 }}>
                            {confidenceBuckets.filter(b => b.count > 0).map(b => (
                                <div
                                    key={b.label}
                                    title={`${b.label}: ${b.count}`}
                                    style={{ width: `${b.pct}%`, background: b.color, minWidth: b.count > 0 ? 4 : 0 }}
                                />
                            ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {confidenceBuckets.map(b => (
                                <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: C.muted }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: b.color }} />
                                    {b.label} · {b.count}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Live auto-log */}
                    <div style={{ ...panel, overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Zap size={12} color={C.green} /> Live auto-log
                            </span>
                            <span style={{ fontSize: 9, color: C.dim }}>Last 24h</span>
                        </div>
                        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                            {autoLogItems.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', fontSize: 10, color: C.dim }}>No auto-adjustments yet</div>
                            ) : (
                                autoLogItems.map(adj => (
                                    <div key={adj.id} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                            <CheckCircle2 size={14} color={C.green} style={{ flexShrink: 0 }} />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: 11, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adj.productName}</div>
                                                <div style={{ fontSize: 9, color: C.dim }}>{adj.reason.replace(/_/g, ' ')}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(34,197,94,.12)', color: C.green }}>
                                                {adj.confidence}%
                                            </span>
                                            <span style={{ fontSize: 9, color: C.dim }}>{fmtTime(adj.timestamp)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Cost impact */}
                    <div style={{ ...panel, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 10 }}>
                            Cost impact
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.18)' }}>
                                <div style={{ fontSize: 9, color: C.red, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Restock cost</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>{fmtUsd(costImpact.restockCost)}</div>
                                <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{costImpact.restockUnits} units pending</div>
                            </div>
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.18)' }}>
                                <div style={{ fontSize: 9, color: C.green, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Revenue unlock</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>—</div>
                                <span style={{
                                    display: 'inline-block',
                                    marginTop: 4,
                                    fontSize: 8,
                                    fontWeight: 700,
                                    padding: '2px 7px',
                                    borderRadius: 20,
                                    background: 'rgba(155,111,228,.15)',
                                    color: C.purple,
                                }}>
                                    No sales forecast
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Audit log */}
                    <div style={{ ...panel, padding: '12px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <ClipboardList size={12} /> Audit log
                        </div>
                        {decisionLog.length === 0 ? (
                            <p style={{ fontSize: 10, color: C.dim, margin: 0 }}>No approval/rejection/manual action recorded yet.</p>
                        ) : (
                            <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {decisionLog.slice(0, 10).map(d => (
                                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 8, background: C.bg3 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.text }}>{d.productName}</div>
                                            <div style={{ fontSize: 9, color: C.dim }}>{d.note}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexShrink: 0 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: d.action === 'approved' ? C.green : d.action === 'rejected' ? C.red : C.amber }}>
                                                    {d.action}
                                                </div>
                                                <div style={{ fontSize: 9, color: C.muted }}>
                                                    {d.quantityChange > 0 ? '+' : ''}{d.quantityChange}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm('Delete this decision log entry?')) {
                                                        const next = decisionLog.filter(x => x.id !== d.id);
                                                        setDecisionLog(next);
                                                        localStorage.setItem(DECISION_LOG_KEY, JSON.stringify(next));
                                                    }
                                                }}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, color: C.dim }}
                                                title="Delete this decision"
                                                aria-label="Delete decision"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Manual adjustment modal */}
            {manualOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: 16,
                    }}
                    onClick={() => setManualOpen(false)}
                >
                    <div
                        style={{ ...panel, background: C.bg3, padding: 20, width: '100%', maxWidth: 440 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Manual adjustment</div>
                            <button type="button" onClick={() => setManualOpen(false)} style={{ ...ghostBtn, padding: 4 }}>
                                <X size={14} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                type="text"
                                placeholder="Search products…"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: C.bg2, color: C.text, fontSize: 11 }}
                            />
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value as typeof filterType)}
                                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: C.bg2, color: C.text, fontSize: 11 }}
                            >
                                <option value="all">All types</option>
                                <option value="auto">Auto-adjusted</option>
                                <option value="approval_required">Pending approval</option>
                                <option value="investigation_required">Critical flags</option>
                            </select>
                            <select
                                value={manualProductId}
                                onChange={e => setManualProductId(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: C.bg2, color: C.text, fontSize: 11 }}
                            >
                                <option value="">Select product</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                value={manualDelta}
                                onChange={e => setManualDelta(e.target.value === '' ? 0 : Number(e.target.value))}
                                placeholder="Qty +/-"
                                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: C.bg2, color: C.text, fontSize: 11 }}
                            />
                            <input
                                type="text"
                                value={manualNote}
                                onChange={e => setManualNote(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') applyManualAdjustment(); }}
                                placeholder="Manual note"
                                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.12)', background: C.bg2, color: C.text, fontSize: 11 }}
                            />
                        </div>
                        {manualFeedback && (
                            <div style={{
                                marginTop: 10,
                                padding: '8px 10px',
                                borderRadius: 8,
                                fontSize: 10,
                                fontWeight: 600,
                                background: manualFeedback.type === 'success' ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                                color: manualFeedback.type === 'success' ? C.green : C.red,
                            }}>
                                {manualFeedback.message}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                            <button type="button" onClick={() => setManualOpen(false)} style={{ ...ghostBtn, flex: 1, justifyContent: 'center' }}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={applyManualAdjustment}
                                disabled={!manualProductId || manualDelta === 0}
                                style={{
                                    ...purpleBtn,
                                    flex: 1,
                                    justifyContent: 'center',
                                    opacity: !manualProductId || manualDelta === 0 ? 0.5 : 1,
                                }}
                            >
                                Apply adjustment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
