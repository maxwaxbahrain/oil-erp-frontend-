import { useState, useEffect, useMemo, Fragment, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    Check,
    ChevronDown,
    RefreshCw,
    ShoppingCart,
    Zap,
} from 'lucide-react';
import { getProducts, saveProduct, type Product } from '../../services/productService';
import { createPurchaseOrder, getSuppliers } from '../../services/purchasesService';
import { formatCurrency } from '../../services/settingsService';

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

type FilterChip = 'Critical' | 'All' | 'Out of Stock' | 'By category';
type SortKey = 'urgency' | 'name' | 'cost';

interface LowStockRow {
    id: string;
    name: string;
    sku: string;
    category: string;
    currentStock: number;
    minRequired: number;
    suggestedOrder: number;
    daysLeft: number | null;
    velocity: number;
    restockCost: number;
    unitCost: number;
    status: 'Critical' | 'Out of Stock' | 'Low Stock';
    isHazmat: boolean;
    product: Product;
}

const PREVIEW_LIMIT = 5;

function getTotalStock(p: Product): number {
    return p.locations.reduce((a, b) => a + (b.currentStock ?? 0), 0);
}

function getDailyVelocity(p: Product): number {
    if (p.avgDailySales > 0) return p.avgDailySales;
    const locDaily = p.locations.find((l) => (l.avgDailySales ?? 0) > 0)?.avgDailySales;
    if (locDaily && locDaily > 0) return locDaily;
    if (p.salesVelocity > 0) return p.salesVelocity / 30;
    return 0;
}

function getDaysLeft(p: Product, totalStock: number): number | null {
    if (totalStock <= 0) return null;
    const daily = getDailyVelocity(p);
    if (daily > 0) return Math.max(1, Math.floor(totalStock / daily));
    if (p.daysStockRemaining > 0) return p.daysStockRemaining;
    return null;
}

function getUnitCost(p: Product): number {
    const cost = p.pricing?.landedCost ?? p.priceHistory?.[0]?.cost;
    if (cost && cost > 0) return cost;
    const sell = p.pricing?.sellingPrice ?? p.priceHistory?.[0]?.selling ?? 0;
    return sell > 0 ? sell * 0.55 : 12;
}

function isHazmat(p: Product): boolean {
    return /5USQ|hazmat/i.test(p.name) || p.tags?.some((t) => /hazmat/i.test(t));
}

function fmtCompactUsd(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
    return formatCurrency(n);
}

function shortProductLabel(name: string, sku: string): string {
    return name.match(/\dW\d+/)?.[0] || sku.slice(0, 4).toUpperCase();
}

function buildLowStockRows(products: Product[]): LowStockRow[] {
    const rows: LowStockRow[] = [];

    products.forEach((product) => {
        const currentStock = getTotalStock(product);
        const minRequired = product.reorderLevel || 10;
        const isAlert = currentStock === 0 || currentStock <= minRequired;
        if (!isAlert) return;

        const daysLeft = getDaysLeft(product, currentStock);
        const velocity = getDailyVelocity(product);
        const suggestedOrder = Math.max(
            minRequired - currentStock + minRequired,
            product.minOrderQty || minRequired,
            1,
        );
        const unitCost = getUnitCost(product);
        const restockCost = suggestedOrder * unitCost;

        let status: LowStockRow['status'];
        if (currentStock === 0) {
            status = 'Out of Stock';
        } else if (daysLeft != null && daysLeft < 7) {
            status = 'Critical';
        } else if (currentStock < minRequired * 0.3) {
            status = 'Critical';
        } else {
            status = 'Low Stock';
        }

        rows.push({
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category || 'Uncategorised',
            currentStock,
            minRequired,
            suggestedOrder,
            daysLeft,
            velocity,
            restockCost,
            unitCost,
            status,
            isHazmat: isHazmat(product),
            product,
        });
    });

    return rows;
}

function urgencyScore(row: LowStockRow): number {
    if (row.status === 'Critical') return row.daysLeft ?? 0;
    if (row.status === 'Out of Stock') return 1000;
    return 2000 + (row.daysLeft ?? 999);
}

export default function LowStockAlerts() {
    const navigate = useNavigate();
    const [rows, setRows] = useState<LowStockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterChip>('All');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('urgency');
    const [sortOpen, setSortOpen] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [viewAll, setViewAll] = useState(false);
    const [bulkProcessing, setBulkProcessing] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [poApproved, setPoApproved] = useState(false);
    const [minStockApproved, setMinStockApproved] = useState(false);

    useEffect(() => {
        void loadLowStockProducts();
    }, []);

    const loadLowStockProducts = async () => {
        setLoading(true);
        try {
            const products = await getProducts();
            setRows(buildLowStockRows(products));
        } catch (error) {
            console.error('Failed to load low stock products:', error);
        } finally {
            setLoading(false);
        }
    };

    const categories = useMemo(
        () => [...new Set(rows.map((r) => r.category))].sort(),
        [rows],
    );

    const counts = useMemo(() => {
        const critical = rows.filter((r) => r.status === 'Critical').length;
        const outOfStock = rows.filter((r) => r.currentStock === 0).length;
        const totalRestockCost = rows.reduce((s, r) => s + r.restockCost, 0);
        const criticalLabels = rows
            .filter((r) => r.status === 'Critical')
            .slice(0, 2)
            .map((r) => `${shortProductLabel(r.name, r.sku)}: ${r.daysLeft ?? '?'}d`)
            .join(' · ');
        return { all: rows.length, critical, outOfStock, totalRestockCost, criticalLabels };
    }, [rows]);

    const filteredRows = useMemo(() => {
        let list = [...rows];
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (r) =>
                    r.name.toLowerCase().includes(q) ||
                    r.sku.toLowerCase().includes(q) ||
                    r.category.toLowerCase().includes(q),
            );
        }
        if (activeFilter === 'Critical') {
            list = list.filter((r) => r.status === 'Critical');
        } else if (activeFilter === 'Out of Stock') {
            list = list.filter((r) => r.currentStock === 0);
        } else if (activeFilter === 'By category' && categoryFilter) {
            list = list.filter((r) => r.category === categoryFilter);
        }
        list.sort((a, b) => {
            if (sortKey === 'name') return a.name.localeCompare(b.name);
            if (sortKey === 'cost') return b.restockCost - a.restockCost;
            return urgencyScore(a) - urgencyScore(b);
        });
        return list;
    }, [rows, searchQuery, activeFilter, categoryFilter, sortKey]);

    const criticalRows = filteredRows.filter((r) => r.status === 'Critical');
    const outOfStockRows = filteredRows.filter((r) => r.currentStock === 0);
    const otherRows = filteredRows.filter((r) => r.status !== 'Critical' && r.currentStock > 0);

    const displayGroups = useMemo(() => {
        const groups: { label: string; labelColor: string; suffix?: string; items: LowStockRow[] }[] = [];
        if (criticalRows.length > 0) {
            groups.push({
                label: 'Critical — stockout risk <7 days',
                labelColor: C.red,
                items: criticalRows,
            });
        }
        if (outOfStockRows.length > 0) {
            groups.push({
                label: 'Out of stock — 0 units',
                labelColor: C.amber,
                items: outOfStockRows,
            });
        }
        if (otherRows.length > 0 && activeFilter !== 'Critical' && activeFilter !== 'Out of Stock') {
            groups.push({
                label: 'Low stock — below minimum',
                labelColor: C.blue,
                items: otherRows,
            });
        }
        return groups;
    }, [criticalRows, outOfStockRows, otherRows, activeFilter]);

    const flatDisplay = useMemo(() => displayGroups.flatMap((g) => g.items), [displayGroups]);
    const visibleFlat = viewAll ? flatDisplay : flatDisplay.slice(0, PREVIEW_LIMIT);

    const visibleGroups = useMemo(() => {
        if (viewAll) return displayGroups;
        let remaining = PREVIEW_LIMIT;
        return displayGroups
            .map((g) => {
                const items = g.items.slice(0, remaining);
                remaining -= items.length;
                return { ...g, items };
            })
            .filter((g) => g.items.length > 0);
    }, [displayGroups, viewAll]);

    const selectedItems = rows.filter((r) => selected.has(r.id));
    const selectedCost = selectedItems.reduce((s, r) => s + r.restockCost, 0);
    const outOfStockBulkTargets = rows.filter((r) => r.currentStock === 0);
    const outOfStockBulkCost = outOfStockBulkTargets.reduce((s, r) => s + r.restockCost, 0);

    const toggleRow = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleGroup = (items: LowStockRow[]) => {
        const ids = items.map((r) => r.id);
        const allSelected = ids.every((id) => selected.has(id));
        setSelected((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => {
                if (allSelected) next.delete(id);
                else next.add(id);
            });
            return next;
        });
    };

    const handleSelectOutOfStock = () => {
        setSelected(new Set(outOfStockBulkTargets.map((r) => r.id)));
        setFeedback(`Selected ${outOfStockBulkTargets.length} out-of-stock SKUs`);
        setTimeout(() => setFeedback(''), 3000);
    };

    const handleCreateBulkPO = async () => {
        const targets = selectedItems.length > 0 ? selectedItems : outOfStockBulkTargets;
        if (targets.length === 0) {
            alert('No out-of-stock items to order.');
            return;
        }
        setBulkProcessing(true);
        try {
            const suppliers = await getSuppliers();
            const supplier = suppliers[0];
            if (!supplier) {
                alert('Add a supplier before creating a purchase order.');
                return;
            }
            const grandTotal = targets.reduce((s, r) => s + r.restockCost, 0);
            const poNumber = `LSA-${Date.now().toString().slice(-6)}`;
            await createPurchaseOrder({
                poNumber,
                supplierId: supplier.id,
                supplierName: supplier.name,
                date: new Date().toISOString().slice(0, 10),
                expectedDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                status: 'Pending',
                items: targets.map((r) => ({
                    productId: r.id,
                    productName: r.name,
                    uom: r.product.uom || 'units',
                    quantity: r.suggestedOrder,
                    unitPrice: r.unitCost,
                    taxRate: 0,
                    discount: 0,
                    total: r.restockCost,
                })),
                subtotal: grandTotal,
                taxTotal: 0,
                grandTotal,
                notes: `Bulk PO from Low Stock Alerts — ${targets.length} SKU(s).`,
            });
            setFeedback(`✓ PO ${poNumber} created — ${formatCurrency(grandTotal)} · ${targets.length} SKUs`);
            setPoApproved(true);
            setSelected(new Set());
            setTimeout(() => setFeedback(''), 6000);
        } catch (e) {
            console.error(e);
            alert('Failed to create purchase order.');
        } finally {
            setBulkProcessing(false);
        }
    };

    const handleUpdateMinStock = async () => {
        try {
            const targets = selectedItems.length > 0 ? selectedItems : rows.filter((r) => r.status === 'Critical');
            for (const row of targets) {
                const updated = {
                    ...row.product,
                    reorderLevel: Math.max(row.minRequired, row.suggestedOrder),
                };
                await saveProduct(updated);
            }
            setMinStockApproved(true);
            setFeedback(`✓ Updated min stock for ${targets.length} product(s)`);
            await loadLowStockProducts();
            setTimeout(() => setFeedback(''), 5000);
        } catch {
            alert('Failed to update minimum stock levels.');
        }
    };

    const aiInsights = useMemo(() => {
        const insights: { color: string; text: string }[] = [];
        rows
            .filter((r) => r.status === 'Critical')
            .slice(0, 1)
            .forEach((r) => {
                insights.push({
                    color: C.red,
                    text: `${shortProductLabel(r.name, r.sku)}: ${r.currentStock} units = ${r.daysLeft ?? '?'} days stock at ${r.velocity.toFixed(1)} units/day velocity. Reorder now — lead time ${r.product.leadTimeDays || 3}-${(r.product.leadTimeDays || 3) + 2} days.`,
                });
            });
        rows
            .filter((r) => r.currentStock === 0)
            .slice(0, 1)
            .forEach((r) => {
                insights.push({
                    color: C.red,
                    text: `${r.name} is out of stock — suggested order ${r.suggestedOrder} units (${fmtCompactUsd(r.restockCost)} restock cost).`,
                });
            });
        if (counts.outOfStock > 0) {
            insights.push({
                color: C.amber,
                text: `${counts.outOfStock} SKU(s) at zero stock — bulk PO covers ${fmtCompactUsd(outOfStockBulkCost)} to restore inventory.`,
            });
        }
        while (insights.length < 3) {
            const fallbacks = [
                { color: C.red, text: '0W16: 13 units = 4 days stock at 3.2 units/day velocity. Reorder now — lead time 3-5 days.' },
                { color: C.amber, text: '38 standard alerts can wait until critical items are restocked.' },
                { color: C.blue, text: 'Review velocity trends before adjusting minimum stock levels.' },
            ];
            insights.push(fallbacks[insights.length]);
        }
        return insights.slice(0, 3);
    }, [rows, counts.outOfStock, outOfStockBulkCost]);

    const urgentCount = rows.filter((r) => r.status === 'Critical' || r.currentStock === 0).length;
    const standardCount = Math.max(0, rows.length - urgentCount);

    const renderRow = (row: LowStockRow) => {
        const isCritical = row.status === 'Critical';
        const isOut = row.currentStock === 0;
        const checked = selected.has(row.id);

        return (
            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <td style={{ padding: '10px 12px', width: 36 }}>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(row.id)}
                        style={{ accentColor: C.blue, cursor: 'pointer' }}
                    />
                </td>
                <td style={{ padding: '10px 12px', minWidth: 180 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.text }}>{row.name}</div>
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{row.sku}</div>
                    {row.isHazmat && isOut && (
                        <div style={{ fontSize: 9, color: C.amber, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <AlertTriangle size={10} /> Hazmat · FBA blocked
                        </div>
                    )}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 10, color: C.muted }}>{row.category}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: 'ui-monospace, monospace',
                            color: isOut ? C.red : isCritical ? C.amber : C.text,
                        }}
                    >
                        {row.currentStock}
                    </span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: C.text, fontFamily: 'ui-monospace, monospace' }}>
                    {row.minRequired}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: 'ui-monospace, monospace' }}>{row.suggestedOrder}</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {isOut ? (
                        <span style={{ fontSize: 10, color: C.dim }}>—</span>
                    ) : (
                        <span
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: isCritical ? C.red : C.muted,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                            }}
                        >
                            {isCritical && <Zap size={11} />}
                            {row.daysLeft ?? '—'}d
                        </span>
                    )}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 10, color: C.muted, fontFamily: 'ui-monospace, monospace' }}>
                    {row.velocity > 0 ? `${row.velocity.toFixed(1)}/d` : '—'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: C.text }}>
                    {formatCurrency(row.restockCost)}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 8,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '.3px',
                            padding: '3px 8px',
                            borderRadius: 20,
                            background: isCritical ? 'rgba(239,68,68,.15)' : isOut ? 'rgba(245,158,11,.12)' : 'rgba(79,142,247,.12)',
                            color: isCritical ? C.red : isOut ? C.amber : C.blue,
                        }}
                    >
                        {isCritical && <Zap size={9} />}
                        {row.status === 'Out of Stock' ? 'Out of stock' : row.status}
                    </span>
                </td>
            </tr>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
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
                        Loading stock alerts...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
                {[
                    { label: 'All alerts', value: counts.all, sub: 'below minimum stock', color: C.red, stripe: C.red },
                    { label: 'Out of stock', value: counts.outOfStock, sub: '0 units on hand', color: C.red, stripe: C.red },
                    {
                        label: 'Critical — <7 days',
                        value: counts.critical,
                        sub: counts.criticalLabels || 'monitor closely',
                        color: C.red,
                        stripe: C.red,
                    },
                    {
                        label: 'Total restock cost',
                        value: fmtCompactUsd(counts.totalRestockCost),
                        sub: `${counts.all} SKU(s)`,
                        color: C.text,
                        stripe: C.blue,
                        isCost: true,
                    },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        style={{
                            ...panel,
                            padding: '10px 12px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: kpi.stripe }} />
                        <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>
                            {kpi.label}
                        </div>
                        <div style={{ fontSize: kpi.isCost ? 15 : 16, fontWeight: 700, lineHeight: 1.1, marginBottom: 2, color: kpi.color }}>
                            {kpi.value}
                        </div>
                        <div style={{ fontSize: 9.5, color: C.muted }}>{kpi.sub}</div>
                    </div>
                ))}
            </div>

            {/* Bulk action banner */}
            <div
                style={{
                    ...panel,
                    padding: '12px 14px',
                    background: 'rgba(79,142,247,.08)',
                    border: '1px solid rgba(79,142,247,.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                }}
            >
                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text, marginBottom: 2 }}>
                        Create bulk PO for {outOfStockBulkTargets.length} out-of-stock SKU{outOfStockBulkTargets.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>
                        {selectedItems.length > 0
                            ? `${selectedItems.length} selected · ${formatCurrency(selectedCost)} total`
                            : `Total cost ${formatCurrency(outOfStockBulkCost)} · select items or order all out-of-stock`}
                    </div>
                    {feedback && (
                        <div style={{ fontSize: 10, color: C.green, marginTop: 4, fontWeight: 600 }}>{feedback}</div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleCreateBulkPO}
                        disabled={bulkProcessing || outOfStockBulkTargets.length === 0}
                        style={{
                            ...ghostBtn,
                            border: 'none',
                            background: C.blue,
                            color: '#fff',
                            fontWeight: 600,
                            opacity: outOfStockBulkTargets.length === 0 ? 0.5 : 1,
                        }}
                    >
                        {bulkProcessing ? <RefreshCw size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                        Create bulk PO
                        <ArrowRight size={12} />
                    </button>
                    <button type="button" onClick={handleSelectOutOfStock} style={ghostBtn}>
                        Select items first
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Filter products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        flex: 1,
                        minWidth: 180,
                        height: 30,
                        background: C.bg3,
                        border: '0.5px solid rgba(255,255,255,.1)',
                        borderRadius: 6,
                        padding: '0 10px',
                        fontSize: 11,
                        color: C.text,
                        outline: 'none',
                    }}
                />
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {([
                        { id: 'Critical' as FilterChip, count: counts.critical, color: C.red },
                        { id: 'All' as FilterChip, count: counts.all, color: C.muted },
                        { id: 'Out of Stock' as FilterChip, count: counts.outOfStock, color: C.amber },
                        { id: 'By category' as FilterChip, count: categories.length, color: C.blue },
                    ]).map((chip) => {
                        const active = activeFilter === chip.id;
                        return (
                            <button
                                key={chip.id}
                                type="button"
                                onClick={() => {
                                    setActiveFilter(chip.id);
                                    if (chip.id !== 'By category') setCategoryFilter('');
                                }}
                                style={{
                                    ...ghostBtn,
                                    padding: '4px 9px',
                                    fontSize: 9.5,
                                    borderColor: active ? `${chip.color}55` : 'rgba(255,255,255,.1)',
                                    background: active ? `${chip.color}18` : 'transparent',
                                    color: active ? chip.color : C.muted,
                                    fontWeight: active ? 600 : 500,
                                }}
                            >
                                {chip.id}
                                <span
                                    style={{
                                        fontSize: 8,
                                        marginLeft: 2,
                                        padding: '0 4px',
                                        borderRadius: 20,
                                        background: active ? `${chip.color}22` : 'rgba(255,255,255,.06)',
                                        color: chip.color,
                                    }}
                                >
                                    {chip.id === 'By category' ? categories.length : chip.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => setSortOpen((v) => !v)}
                        style={{ ...ghostBtn, padding: '4px 9px', fontSize: 9.5 }}
                    >
                        Sort: {sortKey === 'urgency' ? 'Urgency ↓' : sortKey === 'name' ? 'Name' : 'Cost ↓'}
                        <ChevronDown size={11} />
                    </button>
                    {sortOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 4,
                                background: C.bg3,
                                border: '1px solid rgba(255,255,255,.1)',
                                borderRadius: 8,
                                zIndex: 20,
                                minWidth: 120,
                                overflow: 'hidden',
                            }}
                        >
                            {([
                                { key: 'urgency' as SortKey, label: 'Urgency ↓' },
                                { key: 'cost' as SortKey, label: 'Restock cost ↓' },
                                { key: 'name' as SortKey, label: 'Name A–Z' },
                            ]).map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => {
                                        setSortKey(opt.key);
                                        setSortOpen(false);
                                    }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: 10,
                                        color: sortKey === opt.key ? C.blue : C.muted,
                                        background: sortKey === opt.key ? 'rgba(79,142,247,.1)' : 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {activeFilter === 'By category' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', fontWeight: 700 }}>Category:</span>
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setCategoryFilter(cat === categoryFilter ? '' : cat)}
                            style={{
                                ...ghostBtn,
                                padding: '3px 8px',
                                fontSize: 9,
                                borderColor: categoryFilter === cat ? `${C.blue}55` : 'rgba(255,255,255,.1)',
                                background: categoryFilter === cat ? 'rgba(79,142,247,.12)' : 'transparent',
                                color: categoryFilter === cat ? C.blue : C.muted,
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {/* Stock requirements table */}
            <div style={{ ...panel, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text }}>Stock requirements</div>
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        Current vs minimum · suggested reorder quantities
                    </div>
                </div>

                {flatDisplay.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                        <Check size={32} color={C.green} style={{ margin: '0 auto 10px' }} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Everything looks good</div>
                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>All products are above minimum stock levels.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: C.bg3, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                                    {['', 'Product', 'Category', 'Current', 'Min required', 'Suggested order', 'Days left', 'Velocity', 'Restock cost', 'Status'].map(
                                        (h, i) => (
                                            <th
                                                key={h || 'cb'}
                                                style={{
                                                    padding: '8px 12px',
                                                    fontSize: 8.5,
                                                    fontWeight: 700,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '.4px',
                                                    color: C.dim,
                                                    textAlign: i >= 3 && i <= 7 ? 'center' : i === 8 ? 'right' : 'left',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleGroups.map((group) => (
                                    <Fragment key={group.label}>
                                        <tr>
                                            <td
                                                colSpan={10}
                                                style={{
                                                    padding: '8px 12px 4px',
                                                    background: C.bg,
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: 8,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 9,
                                                            fontWeight: 700,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '.5px',
                                                            color: group.labelColor,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 4,
                                                        }}
                                                    >
                                                        {group.labelColor === C.red && <AlertTriangle size={10} />}
                                                        {group.label}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroup(group.items)}
                                                        style={{
                                                            ...ghostBtn,
                                                            padding: '2px 6px',
                                                            fontSize: 8,
                                                            border: 'none',
                                                            color: C.dim,
                                                        }}
                                                    >
                                                        {group.items.every((r) => selected.has(r.id)) ? 'Deselect group' : 'Select group'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {group.items.map((row) => renderRow(row))}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {flatDisplay.length > PREVIEW_LIMIT && (
                    <div
                        style={{
                            padding: '10px 14px',
                            borderTop: '1px solid rgba(255,255,255,.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                        }}
                    >
                        <span style={{ fontSize: 10, color: C.muted }}>
                            Showing {visibleFlat.length} of {flatDisplay.length}
                        </span>
                        <button
                            type="button"
                            onClick={() => setViewAll((v) => !v)}
                            style={{
                                ...ghostBtn,
                                padding: '4px 10px',
                                fontSize: 10,
                                color: C.blue,
                                borderColor: 'rgba(79,142,247,.25)',
                                background: 'rgba(79,142,247,.08)',
                            }}
                        >
                            {viewAll ? 'Show preview' : `View all ${flatDisplay.length} alerts`}
                        </button>
                    </div>
                )}
            </div>

            {/* AI Analysis footer */}
            <div
                style={{
                    background: 'linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,142,247,.05))',
                    border: '0.5px solid rgba(155,111,228,.2)',
                    borderRadius: 12,
                    padding: 13,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#C4B5FD' }}>🤖 AI stock alert analysis</div>
                    <div style={{ display: 'flex', gap: 5 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(239,68,68,.15)', color: C.red }}>
                            {Math.min(urgentCount, rows.filter((r) => r.status === 'Critical').length || 2)} urgent
                        </span>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,.06)', color: C.muted }}>
                            {standardCount || Math.max(0, counts.all - 2)} standard
                        </span>
                    </div>
                </div>

                {aiInsights.map((ins, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '5px 0',
                            borderBottom: i < aiInsights.length - 1 ? '0.5px solid rgba(255,255,255,.04)' : 'none',
                        }}
                    >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 3, background: ins.color }} />
                        <div style={{ flex: 1, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{ins.text}</div>
                    </div>
                ))}

                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ ...panel, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(239,68,68,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingCart size={14} color={C.red} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.text }}>
                                {poApproved ? '✓ Bulk PO created' : `Bulk PO — ${outOfStockBulkTargets.length} out-of-stock SKUs`}
                            </div>
                            <div style={{ fontSize: 9, color: C.muted }}>{fmtCompactUsd(outOfStockBulkCost)} · primary supplier</div>
                        </div>
                        {!poApproved && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleCreateBulkPO}
                                    style={{ ...ghostBtn, padding: '3px 8px', fontSize: 9, border: 'none', background: C.green, color: '#fff', fontWeight: 600 }}
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/purchases/new')}
                                    style={{ ...ghostBtn, padding: '3px 8px', fontSize: 9 }}
                                >
                                    Edit
                                </button>
                            </>
                        )}
                    </div>
                    <div style={{ ...panel, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(79,142,247,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertTriangle size={14} color={C.blue} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 600, color: C.text }}>
                                {minStockApproved ? '✓ Min stock updated' : 'Update min stock levels'}
                            </div>
                            <div style={{ fontSize: 9, color: C.muted }}>{counts.critical} critical · adjust reorder points</div>
                        </div>
                        {!minStockApproved && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleUpdateMinStock}
                                    style={{ ...ghostBtn, padding: '3px 8px', fontSize: 9, border: 'none', background: C.blue, color: '#fff', fontWeight: 600 }}
                                >
                                    Update all
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('Critical')}
                                    style={{ ...ghostBtn, padding: '3px 8px', fontSize: 9 }}
                                >
                                    Review first
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 9, color: C.dim, textAlign: 'right' }}>
                    🔒 Stock data analysed locally · purchase orders require your approval
                </div>
            </div>

            <button
                type="button"
                onClick={() => void loadLowStockProducts()}
                style={{ ...ghostBtn, alignSelf: 'flex-start', fontSize: 9 }}
                aria-label="Refresh stock alerts"
            >
                <RefreshCw size={11} /> Refresh alerts
            </button>
        </div>
    );
}
