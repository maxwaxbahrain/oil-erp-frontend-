import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import {
    Truck, Package,
    CheckCircle,
    Plus, Save, Minus, ChevronDown
} from 'lucide-react';
import { getVans, API_BASE_URL, getInvoices, getProducts as getApiProducts, getSalesOrders, type Van as ApiVan, type SalesOrder } from '../../services/api';
import { createVanLoad } from '../../services/vanLoadService';
import { getSalesReturns } from '../../services/salesReturnService';
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

const REVENUE_TARGET = 13800;

const panel: CSSProperties = {
    background: C.bg2,
    border: '1px solid rgba(255,255,255,.07)',
    borderRadius: 12,
};

type VanOpProductRow = { id: string; name: string; category: string; whStock: number; price: number; unit: string };

type VanRow = { id: string; vanNumber: string; driver: string; route: string; status: string };

function mapApiVanToRow(v: ApiVan): VanRow {
    const statusRaw = v.status != null ? String(v.status) : 'active';
    const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
    return {
        id: v.id,
        vanNumber: v.van_number,
        driver: v.driver_name,
        route: v.vehicle_number || v.van_number || '—',
        status,
    };
}

type OverviewStats = {
    warehouseStock: number;
    inVansStock: number;
    revenueToday: number;
    activeVans: number;
    totalVans: number;
    ordersToday: number;
    invoicesToday: number;
    podCaptured: number;
    soldToday: number;
    returnedToday: number;
};

type TabId = 'overview' | 'loading' | 'unloading' | 'inventory' | 'pod';

type DeliveryUiStatus = 'pod_captured' | 'in_progress' | 'pending';

function isSameLocalDay(isoOrDate: string, day: Date): boolean {
    const d = new Date(isoOrDate.includes('T') ? isoOrDate : `${isoOrDate}T12:00:00`);
    return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
    );
}

function currency(n: number): string {
    const v = Number.isFinite(n) ? n : 0;
    return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AQ';
}

function getDeliveryUiStatus(order: SalesOrder): DeliveryUiStatus {
    if (order.podConfirmed) return 'pod_captured';
    const ws = String(order.workflowStatus || '').toLowerCase();
    if (ws === 'delivered' || ws === 'confirmed') return 'in_progress';
    return 'pending';
}

function deliveryStatusLabel(status: DeliveryUiStatus): string {
    if (status === 'pod_captured') return 'POD captured';
    if (status === 'in_progress') return 'In progress';
    return 'Pending';
}

function deliveryStatusColor(status: DeliveryUiStatus): string {
    if (status === 'pod_captured') return C.green;
    if (status === 'in_progress') return C.orange;
    return C.dim;
}

// --- UI Components ---

function KpiCard({
    label,
    value,
    subtext,
    subtextColor,
    valueColor,
}: {
    label: string;
    value: string;
    subtext?: string;
    subtextColor?: string;
    valueColor?: string;
}) {
    return (
        <div style={{ ...panel, padding: '16px 18px' }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: C.muted, marginBottom: 8 }}>
                {label}
            </p>
            <p style={{ fontSize: 26, fontWeight: 700, color: valueColor || C.text, marginBottom: subtext ? 6 : 0, lineHeight: 1.1 }}>
                {value}
            </p>
            {subtext && (
                <p style={{ fontSize: 11, fontWeight: 500, color: subtextColor || C.muted }}>
                    {subtext}
                </p>
            )}
        </div>
    );
}

function FlowBar({
    label,
    value,
    displayValue,
    color,
    maxValue,
}: {
    label: string;
    value: number;
    displayValue: string;
    color: string;
    maxValue: number;
}) {
    const pct = maxValue > 0 ? Math.max(4, (Math.abs(value) / maxValue) * 100) : 4;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{displayValue}</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .3s' }} />
            </div>
        </div>
    );
}

export default function VanOperations() {
    const UNITS_PER_CASE = 12;
    const currentUser = getCurrentUser();
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [vans, setVans] = useState<VanRow[]>([]);
    const [vansLoading, setVansLoading] = useState(true);
    const [vanOpProducts, setVanOpProducts] = useState<VanOpProductRow[]>([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [selectedVan, setSelectedVan] = useState<string>('');
    const [cart, setCart] = useState<any[]>([]);
    const [overview, setOverview] = useState<OverviewStats>({
        warehouseStock: 0,
        inVansStock: 0,
        revenueToday: 0,
        activeVans: 0,
        totalVans: 0,
        ordersToday: 0,
        invoicesToday: 0,
        podCaptured: 0,
        soldToday: 0,
        returnedToday: 0,
    });
    const [todaysOrdersList, setTodaysOrdersList] = useState<SalesOrder[]>([]);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [vanLoadsToday, setVanLoadsToday] = useState<any[]>([]);
    const [vanLoadsLoading, setVanLoadsLoading] = useState(false);
    const [loadSaving, setLoadSaving] = useState(false);
    const [loadMessage, setLoadMessage] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showAddVanModal, setShowAddVanModal] = useState(false);
    const [newVanForm, setNewVanForm] = useState({
        van_number: '',
        driver_name: '',
        driver_phone: '',
        vehicle_number: '',
        capacity_liters: ''
    });
    const [showEditVanModal, setShowEditVanModal] = useState(false);
    const [editVanForm, setEditVanForm] = useState({
        id: '',
        van_number: '',
        driver_name: '',
        driver_phone: '',
        vehicle_number: '',
        capacity_liters: ''
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getVans();
                if (cancelled) return;
                const mapped = list.map(mapApiVanToRow);
                setVans(mapped);
                setSelectedVan((prev) => {
                    if (prev && mapped.some((x) => x.id === prev)) return prev;
                    return mapped[0]?.id ?? '';
                });
            } catch (e) {
                console.error('Failed to load vans:', e);
                if (!cancelled) {
                    setVans([]);
                    setSelectedVan('');
                }
            } finally {
                if (!cancelled) setVansLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = await getApiProducts();
                if (cancelled) return;
                setVanOpProducts(
                    list.map((p) => ({
                        id: p.id,
                        name: p.name,
                        category: p.category || '',
                        whStock: Number((p as any).current_stock ?? (p as any).stock ?? 0) || 0,
                        price: Number((p as any).unit_price ?? (p as any).price ?? 0) || 0,
                        unit: String((p as any).unit ?? '') || '',
                    }))
                );
            } catch (e) {
                console.error('Failed to load products for van operations:', e);
                if (!cancelled) setVanOpProducts([]);
            } finally {
                if (!cancelled) setProductsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setVanLoadsLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/van-loads/today`, { cache: 'no-store' });
                const data = res.ok ? await res.json() : [];
                if (cancelled) return;
                setVanLoadsToday(Array.isArray(data) ? data : []);
            } catch (e) {
                console.warn('Could not load van-loads/today:', e);
                if (!cancelled) setVanLoadsToday([]);
            } finally {
                if (!cancelled) setVanLoadsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedVan]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingOverview(true);
            try {
                const today = new Date();
                const [invoices, salesOrders, returns] = await Promise.all([
                    getInvoices(),
                    getSalesOrders(),
                    getSalesReturns().catch(() => []),
                ]);
                if (cancelled) return;

                const selectedVanRow = vans.find((v) => v.id === selectedVan) || null;
                const vanToken = selectedVanRow?.vanNumber ? String(selectedVanRow.vanNumber) : '';
                const vanIdToken = selectedVanRow?.id ? String(selectedVanRow.id) : '';

                const todaysInvoices = invoices.filter((inv) => isSameLocalDay(inv.invoiceDate || inv.createdAt, today));
                const todaysRevenueAll = todaysInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
                const todaysRevenueForVan = vanToken
                    ? todaysInvoices
                        .filter((inv) => String(inv.van || '').includes(vanToken) || String(inv.van || '') === vanIdToken)
                        .reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0)
                    : todaysRevenueAll;
                const invoicesTodayAll = todaysInvoices.length;
                const invoicesTodayForVan = vanToken
                    ? todaysInvoices.filter((inv) => String(inv.van || '').includes(vanToken) || String(inv.van || '') === vanIdToken).length
                    : invoicesTodayAll;

                const todaysOrders = salesOrders.filter((o) => isSameLocalDay(o.orderDate || o.createdAt, today));
                const todaysOrdersForVan = vanToken
                    ? todaysOrders.filter((o) => String(o.van || '').includes(vanToken) || String(o.van || '') === vanIdToken)
                    : todaysOrders;
                const podCapturedAll = todaysOrders.filter((o) => Boolean(o.podConfirmed)).length;
                const podCapturedForVan = todaysOrdersForVan.filter((o) => Boolean(o.podConfirmed)).length;

                const todaysReturns = (returns || []).filter((r: any) => isSameLocalDay(String(r.returnDate || r.createdAt || ''), today));
                const todaysReturnTotal = (todaysReturns || []).reduce((sum: number, r: any) => sum + (Number(r.refundAmount) || 0), 0);

                const warehouseStockValue = vanOpProducts.reduce(
                    (sum, p) => sum + (Number(p.whStock) || 0) * (Number(p.price) || 0),
                    0
                );

                const inVansStockValue = 0;

                const totalVans = vans.length;
                const activeVans = vans.filter((v) => String(v.status).toLowerCase() === 'active').length;

                const ordersForDisplay = selectedVan ? todaysOrdersForVan : todaysOrders;

                setTodaysOrdersList(ordersForDisplay);
                setOverview({
                    warehouseStock: warehouseStockValue,
                    inVansStock: inVansStockValue,
                    revenueToday: selectedVan ? todaysRevenueForVan : todaysRevenueAll,
                    activeVans,
                    totalVans,
                    ordersToday: selectedVan ? todaysOrdersForVan.length : todaysOrders.length,
                    invoicesToday: selectedVan ? invoicesTodayForVan : invoicesTodayAll,
                    podCaptured: selectedVan ? podCapturedForVan : podCapturedAll,
                    soldToday: selectedVan ? todaysRevenueForVan : todaysRevenueAll,
                    returnedToday: todaysReturnTotal,
                });
            } catch (e) {
                console.error('Failed to compute van operations overview:', e);
            } finally {
                if (!cancelled) setLoadingOverview(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVan, vansLoading, productsLoading, vans, vanOpProducts]);

    const addToLoad = (product: any) => {
        const existing = cart.find(p => p.id === product.id);
        if (existing) {
            setCart(cart.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p));
        } else {
            setCart([...cart, { ...product, qty: 1 }]);
        }
    };

    const updateCartQty = (id: string, qty: number) => {
        setCart((prev) =>
            prev.map((p) => (p.id === id ? { ...p, qty: Math.max(0, Number(qty) || 0) } : p)).filter((p) => (Number(p.qty) || 0) > 0)
        );
    };

    const removeFromLoad = (id: string) => {
        setCart((prev) => prev.filter((p) => p.id !== id));
    };

    const handleConfirmLoad = async () => {
        if (!selectedVan || cart.length === 0) return;
        const totalCases = cart.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
        const totalValue = cart.reduce((acc, item) => acc + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
        const vanLabel = vans.find((v) => v.id === selectedVan)?.vanNumber || 'Selected Van';
        const ok = window.confirm(
            `Confirm loading ${totalCases} cases worth $${totalValue.toFixed(2)} into ${vanLabel}?`
        );
        if (!ok) return;
        setLoadSaving(true);
        setLoadMessage(null);
        setLoadError(null);
        try {
            const payload = {
                van_id: String(selectedVan),
                load_date: new Date().toISOString().slice(0, 10),
                status: 'loaded',
                total_value: totalValue,
                items: cart.map((it) => ({
                    product_id: String(it.id),
                    quantity: Number(it.qty) || 0,
                })),
            };
            await createVanLoad(payload);
            const driver = vans.find((v) => v.id === selectedVan)?.driver || '—';
            setLoadMessage(
                `${vanLabel} loaded successfully! ${totalCases} cases | $${totalValue.toFixed(2)} value Driver: ${driver}`
            );
            setCart([]);
        } catch (e) {
            console.error(e);
            setLoadError(e instanceof Error ? e.message : 'Failed to save van load.');
        } finally {
            setLoadSaving(false);
        }
    };

    const selectedVanRow = vans.find((v) => v.id === selectedVan);
    const totalCasesLoaded = cart.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
    const totalUnitsLoaded = totalCasesLoaded * UNITS_PER_CASE;
    const totalValueLoaded = cart.reduce((acc, item) => acc + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
    const weightEstimateKg = totalUnitsLoaded * 1;
    const todayLabel = new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const getVanLoadTotals = (vanId: string) => {
        const priceByProduct = new Map(vanOpProducts.map((p) => [String(p.id), Number(p.price) || 0]));
        const relevantLoads = (Array.isArray(vanLoadsToday) ? vanLoadsToday : []).filter(
            (l: any) => String(l.van_id) === String(vanId)
        );
        const cases = relevantLoads.reduce((acc: number, load: any) => {
            const items = Array.isArray(load.items) ? load.items : [];
            return (
                acc +
                items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
            );
        }, 0);
        const value = relevantLoads.reduce((acc: number, load: any) => {
            const items = Array.isArray(load.items) ? load.items : [];
            return (
                acc +
                items.reduce((s: number, it: any) => {
                    const qty = Number(it.quantity) || 0;
                    const pid = String(it.product_id ?? '');
                    return s + qty * (priceByProduct.get(pid) || 0);
                }, 0)
            );
        }, 0);
        return {
            cases,
            units: cases * UNITS_PER_CASE,
            value,
            loaded: cases > 0,
        };
    };

    const handleAddVan = async () => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/vans`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newVanForm)
                }
            );
            if (response.ok) {
                setShowAddVanModal(false);
                setNewVanForm({
                    van_number: '',
                    driver_name: '',
                    driver_phone: '',
                    vehicle_number: '',
                    capacity_liters: ''
                });
                const vansData = await getVans();
                const mapped = vansData.map(mapApiVanToRow);
                setVans(mapped);
                setSelectedVan((prev) => prev || mapped[0]?.id || '');
            }
        } catch (error) {
            console.error('Failed to add van:', error);
        }
    };

    const handleEditVan = async () => {
        try {
            const response = await fetch(
                `${API_BASE_URL}/vans/${editVanForm.id}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        van_number: editVanForm.van_number,
                        driver_name: editVanForm.driver_name,
                        driver_phone: editVanForm.driver_phone,
                        vehicle_number: editVanForm.vehicle_number,
                        capacity_liters: Number(editVanForm.capacity_liters) || 0
                    })
                }
            );
            if (response.ok) {
                setShowEditVanModal(false);
                const vansData = await getVans();
                const mapped = vansData.map(mapApiVanToRow);
                setVans(mapped);
            }
        } catch (error) {
            console.error('Failed to edit van:', error);
        }
    };

    const openEditVanModal = async () => {
        try {
            const vansData = await getVans();
            const current = vansData.find((v) => String(v.id) === String(selectedVan));
            if (!current) return;
            setEditVanForm({
                id: String(current.id ?? ''),
                van_number: current.van_number ?? '',
                driver_name: current.driver_name ?? '',
                driver_phone: current.driver_phone ?? '',
                vehicle_number: current.vehicle_number ?? '',
                capacity_liters: String(current.capacity_liters ?? '')
            });
            setShowEditVanModal(true);
        } catch (error) {
            console.error('Failed to edit van:', error);
        }
    };

    const loadedValue = useMemo(() => {
        const priceByProduct = new Map(vanOpProducts.map((p) => [String(p.id), Number(p.price) || 0]));
        const loads = Array.isArray(vanLoadsToday) ? vanLoadsToday : [];
        const filtered = selectedVan
            ? loads.filter((l: any) => String(l.van_id) === String(selectedVan))
            : loads;
        return filtered.reduce((acc: number, load: any) => {
            const items = Array.isArray(load.items) ? load.items : [];
            return acc + items.reduce((s: number, it: any) => {
                const qty = Number(it.quantity) || 0;
                const pid = String(it.product_id ?? '');
                return s + qty * (priceByProduct.get(pid) || 0);
            }, 0);
        }, 0);
    }, [vanLoadsToday, vanOpProducts, selectedVan]);

    const currentWarehouse = overview.warehouseStock;
    const soldToday = overview.soldToday;
    const returnedToday = overview.returnedToday;
    const openingWarehouse = currentWarehouse + loadedValue - soldToday - returnedToday;
    const flowMax = Math.max(openingWarehouse, currentWarehouse, loadedValue, soldToday, returnedToday, 1);
    const podPending = Math.max(0, overview.ordersToday - overview.podCaptured);
    const revenuePct = REVENUE_TARGET > 0 ? Math.round((overview.revenueToday / REVENUE_TARGET) * 100) : 0;

    const tabs: { id: TabId; label: string; badge?: number }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'loading', label: 'Loading' },
        { id: 'unloading', label: 'Unloading' },
        { id: 'inventory', label: 'Live stock' },
        { id: 'pod', label: 'POD status', badge: podPending > 0 ? podPending : undefined },
    ];

    const darkInput: CSSProperties = {
        background: C.bg3,
        border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 8,
        color: C.text,
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 12px',
        fontFamily: 'inherit',
    };

    const darkTableTh: CSSProperties = {
        padding: '10px 12px',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.4px',
        color: C.muted,
        textAlign: 'left',
        borderBottom: '1px solid rgba(255,255,255,.07)',
    };

    const darkTableTd: CSSProperties = {
        padding: '11px 12px',
        fontSize: 11,
        color: C.text,
        borderBottom: '1px solid rgba(255,255,255,.04)',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, color: C.text, overflow: 'hidden', fontFamily: 'inherit' }}>
            {/* Header */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,.07)', padding: '20px 28px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                            <Truck size={22} color={C.blue} />
                            Van operations
                        </h1>
                        <p style={{ fontSize: 12, color: C.muted, marginTop: 4, marginBottom: 0 }}>
                            Field sales · Inventory · POD tracking
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{todayLabel}</span>
                        <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: '#fff',
                        }}>
                            {userInitials(currentUser.name)}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                        <select
                            value={selectedVan}
                            onChange={(e) => setSelectedVan(e.target.value)}
                            disabled={vansLoading || vans.length === 0}
                            style={{ ...darkInput, paddingRight: 32, minWidth: 220, appearance: 'none', cursor: 'pointer' }}
                        >
                            {vansLoading ? (
                                <option value="">Loading vans…</option>
                            ) : vans.length === 0 ? (
                                <option value="">No vans available</option>
                            ) : (
                                vans.map((v) => (
                                    <option key={v.id} value={v.id} style={{ background: C.bg3 }}>
                                        {v.vanNumber} — {v.driver}
                                    </option>
                                ))
                            )}
                        </select>
                        <ChevronDown size={14} color={C.muted} style={{ position: 'absolute', right: 10, pointerEvents: 'none' }} />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAddVanModal(true)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: C.blue, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        <Plus size={14} /> Add van
                    </button>
                    <button type="button" onClick={openEditVanModal} aria-hidden tabIndex={-1} style={{ display: 'none' }} />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    position: 'relative',
                                    padding: '10px 18px 12px',
                                    fontSize: 12,
                                    fontWeight: isActive ? 600 : 500,
                                    color: isActive ? C.blue : C.muted,
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontFamily: 'inherit',
                                }}
                            >
                                {tab.label}
                                {tab.badge != null && tab.badge > 0 && (
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10,
                                        background: 'rgba(245,158,11,.2)', color: C.orange,
                                    }}>
                                        {tab.badge} pending
                                    </span>
                                )}
                                {isActive && (
                                    <span style={{
                                        position: 'absolute', bottom: 0, left: 18, right: 18,
                                        height: 2, background: C.blue, borderRadius: 1,
                                    }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                {/* OVERVIEW */}
                {activeTab === 'overview' && (
                    <div>
                        {/* KPI Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                            <KpiCard
                                label="Warehouse stock"
                                value={loadingOverview ? '—' : currency(currentWarehouse)}
                                subtext={loadingOverview ? undefined : `opening ${currency(openingWarehouse)}`}
                                subtextColor={C.muted}
                            />
                            <KpiCard
                                label="Stock in vans"
                                value={loadingOverview ? '—' : currency(overview.inVansStock)}
                                subtext={overview.inVansStock === 0 ? 'not yet loaded' : undefined}
                                subtextColor={C.purple}
                                valueColor={C.purple}
                            />
                            <KpiCard
                                label="Revenue today"
                                value={loadingOverview ? '—' : currency(overview.revenueToday)}
                                subtext={`Target ${currency(REVENUE_TARGET)}/day`}
                                subtextColor={C.orange}
                                valueColor={C.green}
                            />
                            <KpiCard
                                label="POD captured"
                                value={loadingOverview ? '—' : `${overview.podCaptured}/${overview.ordersToday}`}
                                subtextColor={C.orange}
                                valueColor={C.orange}
                            />
                        </div>

                        {/* Two-column main */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
                            {/* LEFT — Inventory movement */}
                            <div style={{ ...panel, padding: '20px 22px' }}>
                                <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
                                    Inventory movement
                                </h3>
                                <p style={{ fontSize: 11, color: C.muted, margin: '0 0 20px' }}>
                                    Opening → Current warehouse
                                </p>

                                <FlowBar
                                    label="Opening"
                                    value={openingWarehouse}
                                    displayValue={currency(openingWarehouse)}
                                    color={C.blue}
                                    maxValue={flowMax}
                                />
                                <FlowBar
                                    label="Loaded to vans"
                                    value={loadedValue}
                                    displayValue={`-${currency(loadedValue)}`}
                                    color={C.purple}
                                    maxValue={flowMax}
                                />
                                <FlowBar
                                    label="Sold"
                                    value={soldToday}
                                    displayValue={`+${currency(soldToday)}`}
                                    color={C.green}
                                    maxValue={flowMax}
                                />
                                <FlowBar
                                    label="Returned"
                                    value={returnedToday}
                                    displayValue={`+${currency(returnedToday)}`}
                                    color={C.orange}
                                    maxValue={flowMax}
                                />
                                <FlowBar
                                    label="Current warehouse"
                                    value={currentWarehouse}
                                    displayValue={currency(currentWarehouse)}
                                    color={C.red}
                                    maxValue={flowMax}
                                />

                                <p style={{
                                    fontSize: 10, color: C.dim, marginTop: 16, paddingTop: 14,
                                    borderTop: '1px solid rgba(255,255,255,.06)', lineHeight: 1.5,
                                }}>
                                    Reconciliation: Opening ({currency(openingWarehouse)}) − Loaded ({currency(loadedValue)}) + Sold ({currency(soldToday)}) + Returned ({currency(returnedToday)}) = Current ({currency(currentWarehouse)})
                                </p>
                            </div>

                            {/* RIGHT — Stacked cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Delivery progress */}
                                <div style={{ ...panel, padding: '20px 22px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                                        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>
                                            Delivery progress
                                        </h3>
                                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
                                            {selectedVanRow?.driver || 'All drivers'} {overview.podCaptured}/{overview.ordersToday} done
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                                        {loadingOverview ? (
                                            <p style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>Loading deliveries…</p>
                                        ) : todaysOrdersList.length === 0 ? (
                                            <p style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>No deliveries today</p>
                                        ) : (
                                            todaysOrdersList.map((order) => {
                                                const uiStatus = getDeliveryUiStatus(order);
                                                const statusColor = deliveryStatusColor(uiStatus);
                                                return (
                                                    <div
                                                        key={order.id}
                                                        style={{
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                                                            {order.customerName || order.orderNumber}
                                                        </span>
                                                        <span style={{ fontSize: 10, fontWeight: 600, color: statusColor }}>
                                                            {deliveryStatusLabel(uiStatus)}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* Fleet status */}
                                <div style={{ ...panel, padding: '20px 22px' }}>
                                    <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>
                                        Fleet status
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[
                                            { label: 'Active vans', value: `${overview.activeVans}/${overview.totalVans}` },
                                            { label: 'POD captured', value: `${overview.podCaptured}/${overview.ordersToday}` },
                                            { label: 'Invoices today', value: String(overview.invoicesToday) },
                                            { label: 'Revenue vs target', value: `${revenuePct}%` },
                                        ].map((row) => (
                                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 11, color: C.muted }}>{row.label}</span>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{row.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* LOADING */}
                {activeTab === 'loading' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ ...panel, padding: '18px 20px' }}>
                            <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: C.muted, marginBottom: 14 }}>Fleet status board</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                {vans.map((van) => {
                                    const t = getVanLoadTotals(van.id);
                                    return (
                                        <div key={van.id} style={{ ...panel, padding: '14px 16px', width: 280, background: C.bg3 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: C.blue }}>{van.vanNumber}</div>
                                            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Driver: {van.driver || '—'}</div>
                                            <div style={{ fontSize: 11, color: C.muted }}>Route: {van.route || '—'}</div>
                                            <div style={{ margin: '12px 0', borderTop: '1px solid rgba(255,255,255,.06)' }} />
                                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Current load</div>
                                            <div style={{ fontSize: 11, color: C.text, marginTop: 6 }}>Cases: {t.cases}</div>
                                            <div style={{ fontSize: 11, color: C.text }}>Units: {t.units}</div>
                                            <div style={{ fontSize: 11, color: C.text }}>Value: ${t.value.toFixed(2)}</div>
                                            <div style={{ margin: '12px 0', borderTop: '1px solid rgba(255,255,255,.06)' }} />
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
                                                background: t.loaded ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)',
                                                color: t.loaded ? C.green : C.muted,
                                            }}>
                                                {t.loaded ? 'Loaded' : 'Empty'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ ...panel, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                                <div>
                                    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
                                        Van loading — {selectedVanRow?.vanNumber || 'No Van'}
                                    </h2>
                                    <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Load products from warehouse to van</p>
                                </div>
                                <div style={{ fontSize: 11, color: C.muted }}>
                                    <div>Date: {todayLabel}</div>
                                    <div>Driver: {selectedVanRow?.driver || '—'}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ ...panel, padding: '18px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, fontSize: 12 }}>
                                <div><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Van number</div><div style={{ fontWeight: 600 }}>{selectedVanRow?.vanNumber || '—'}</div></div>
                                <div><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Driver</div><div style={{ fontWeight: 600 }}>{selectedVanRow?.driver || '—'}</div></div>
                                <div><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Route</div><div style={{ fontWeight: 600 }}>{selectedVanRow?.route || '—'}</div></div>
                                <div><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Capacity</div><div style={{ fontWeight: 600 }}>1000 liters</div></div>
                                <div><div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted }}>Current load</div><div style={{ fontWeight: 600 }}>{totalCasesLoaded} cases / ${totalValueLoaded.toFixed(2)}</div></div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                            <div style={{ ...panel, padding: '18px 20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, margin: 0 }}>Select products to load</h3>
                                    <input type="text" placeholder="Search SKU…" style={{ ...darkInput, width: 220 }} />
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={darkTableTh}>Product name</th>
                                            <th style={darkTableTh}>SKU</th>
                                            <th style={darkTableTh}>Unit</th>
                                            <th style={{ ...darkTableTh, textAlign: 'right' }}>WH stock</th>
                                            <th style={{ ...darkTableTh, textAlign: 'center' }}>Qty (cases)</th>
                                            <th style={{ ...darkTableTh, textAlign: 'right' }}>Value</th>
                                            <th style={{ ...darkTableTh, textAlign: 'center' }}>Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productsLoading ? (
                                            <tr><td colSpan={7} style={{ ...darkTableTd, textAlign: 'center', fontStyle: 'italic', color: C.muted }}>Loading products…</td></tr>
                                        ) : vanOpProducts.length === 0 ? (
                                            <tr><td colSpan={7} style={{ ...darkTableTd, textAlign: 'center', fontStyle: 'italic', color: C.muted }}>No products available</td></tr>
                                        ) : (
                                            vanOpProducts.map((product) => (
                                                <tr key={product.id}>
                                                    <td style={{ ...darkTableTd, fontWeight: 600 }}>{product.name}</td>
                                                    <td style={{ ...darkTableTd, color: C.muted, fontSize: 10 }}>{product.id}</td>
                                                    <td style={{ ...darkTableTd, color: C.muted }}>{product.unit || '12x1 QT'} (cases)</td>
                                                    <td style={{ ...darkTableTd, textAlign: 'right', fontFamily: 'monospace' }}>{product.whStock}</td>
                                                    <td style={darkTableTd}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                                            <button type="button" onClick={() => {
                                                                const existingQty = cart.find((p) => p.id === product.id)?.qty || 0;
                                                                if (existingQty <= 1) removeFromLoad(product.id);
                                                                else updateCartQty(product.id, existingQty - 1);
                                                            }} style={{ padding: 4, border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, background: 'transparent', color: C.text, cursor: 'pointer' }}>
                                                                <Minus size={13} />
                                                            </button>
                                                            <input type="number" min={0} value={cart.find((p) => p.id === product.id)?.qty ?? ''} onChange={(e) => {
                                                                if (e.target.value === '') { removeFromLoad(product.id); return; }
                                                                const v = Number(e.target.value) || 0;
                                                                if (v <= 0) removeFromLoad(product.id);
                                                                else if (!cart.find((p) => p.id === product.id)) setCart((prev) => [...prev, { ...product, qty: v }]);
                                                                else updateCartQty(product.id, v);
                                                            }} style={{ ...darkInput, width: 52, padding: '4px 6px', textAlign: 'center' }} />
                                                            <button type="button" onClick={() => addToLoad(product)} style={{ padding: 4, border: '1px solid rgba(255,255,255,.1)', borderRadius: 4, background: 'transparent', color: C.blue, cursor: 'pointer' }}>
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td style={{ ...darkTableTd, textAlign: 'right', fontWeight: 600 }}>
                                                        ${(((cart.find((p) => p.id === product.id)?.qty || 0) * (Number(product.price) || 0))).toFixed(2)}
                                                    </td>
                                                    <td style={{ ...darkTableTd, textAlign: 'center' }}>
                                                        <button type="button" onClick={() => removeFromLoad(product.id)} style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}>×</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div style={{ ...panel, padding: '18px 20px', borderTop: `3px solid ${C.blue}` }}>
                                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: C.muted, marginBottom: 6 }}>Select van</label>
                                    <select value={selectedVan} onChange={(e) => setSelectedVan(e.target.value)} disabled={vansLoading || vans.length === 0} style={{ ...darkInput, width: '100%' }}>
                                        {vansLoading ? <option value="">Loading vans…</option> : vans.length === 0 ? <option value="">No vans available</option> : vans.map((v) => (
                                            <option key={v.id} value={v.id} style={{ background: C.bg3 }}>{v.vanNumber} — {v.driver}</option>
                                        ))}
                                    </select>
                                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                        <span style={{ color: C.muted }}>Route:</span>
                                        <span style={{ fontWeight: 600 }}>{vans.find((v) => v.id === selectedVan)?.route ?? '—'}</span>
                                    </div>
                                </div>

                                <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 12 }}>Loading manifest</h4>
                                {cart.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '32px 0', color: C.dim, fontSize: 11, fontStyle: 'italic' }}>No items added to load</div>
                                ) : (
                                    <div style={{ marginBottom: 16 }}>
                                        {cart.map((item, idx) => (
                                            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '5fr 2fr 2fr 3fr', gap: 8, fontSize: 11, paddingBottom: 8, borderBottom: '1px dashed rgba(255,255,255,.06)', marginBottom: 8 }}>
                                                <div><div style={{ fontWeight: 600 }}>{item.name}</div><div style={{ fontSize: 9, color: C.dim }}>{item.id}</div></div>
                                                <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{item.qty}</div>
                                                <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>{(Number(item.qty) || 0) * UNITS_PER_CASE}</div>
                                                <div style={{ textAlign: 'right', fontWeight: 600 }}>${((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Total cases loaded:</span><span>{totalCasesLoaded}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Total units loaded:</span><span>{totalUnitsLoaded}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: C.blue, fontSize: 13 }}><span>Total value:</span><span>${totalValueLoaded.toFixed(2)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted }}><span>Weight estimate:</span><span>{weightEstimateKg.toLocaleString()} kg</span></div>
                                </div>

                                {loadMessage && <div style={{ fontSize: 11, color: C.green, background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 6, padding: '8px 12px', marginTop: 12 }}>{loadMessage}</div>}
                                {loadError && <div style={{ fontSize: 11, color: C.red, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '8px 12px', marginTop: 12 }}>{loadError}</div>}
                                <button type="button" onClick={handleConfirmLoad} disabled={loadSaving || !selectedVan || cart.length === 0} style={{
                                    width: '100%', marginTop: 16, padding: '12px 0', background: C.blue, color: '#fff',
                                    fontWeight: 700, fontSize: 11, textTransform: 'uppercase', border: 'none', borderRadius: 8,
                                    cursor: loadSaving || !selectedVan || cart.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: loadSaving || !selectedVan || cart.length === 0 ? 0.5 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit',
                                }}>
                                    <Save size={16} /> {loadSaving ? 'Saving…' : 'Confirm load'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* UNLOADING */}
                {activeTab === 'unloading' && (
                    <div style={{ ...panel, padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>End of day reconciliation</h2>
                                <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Process returns and close daily route</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>6:30 PM</div>
                                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.green }}>On time</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                            <div style={{ ...panel, padding: '14px 16px', background: C.bg3 }}><div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', fontWeight: 700 }}>Opening value</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>$8,500.00</div></div>
                            <div style={{ ...panel, padding: '14px 16px', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.15)' }}><div style={{ fontSize: 9, color: C.green, textTransform: 'uppercase', fontWeight: 700 }}>Sold today</div><div style={{ fontSize: 20, fontWeight: 700, color: C.green, marginTop: 4 }}>$4,580.00</div></div>
                            <div style={{ ...panel, padding: '14px 16px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.15)' }}><div style={{ fontSize: 9, color: C.orange, textTransform: 'uppercase', fontWeight: 700 }}>Expected return</div><div style={{ fontSize: 20, fontWeight: 700, color: C.orange, marginTop: 4 }}>$3,920.00</div></div>
                        </div>

                        <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 12 }}>Return inventory verification</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, border: '1px solid rgba(255,255,255,.06)' }}>
                            <thead>
                                <tr>
                                    <th style={darkTableTh}>Product</th>
                                    <th style={{ ...darkTableTh, textAlign: 'right' }}>Loaded</th>
                                    <th style={{ ...darkTableTh, textAlign: 'right' }}>Sold</th>
                                    <th style={{ ...darkTableTh, textAlign: 'right', background: 'rgba(245,158,11,.08)' }}>Return qty</th>
                                    <th style={{ ...darkTableTh, textAlign: 'right' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ ...darkTableTd, fontWeight: 600 }}>Coca Cola 500ml</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right', color: C.muted }}>50</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right', color: C.muted }}>25</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right', fontWeight: 600, background: 'rgba(245,158,11,.05)' }}>25</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right' }}><CheckCircle size={16} color={C.green} style={{ marginLeft: 'auto' }} /></td>
                                </tr>
                                <tr>
                                    <td style={{ ...darkTableTd, fontWeight: 600 }}>Lays Chips Regular</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right', color: C.muted }}>30</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right', color: C.muted }}>12</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right', fontWeight: 600, background: 'rgba(245,158,11,.05)' }}>18</td>
                                    <td style={{ ...darkTableTd, textAlign: 'right' }}><CheckCircle size={16} color={C.green} style={{ marginLeft: 'auto' }} /></td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button type="button" style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Report discrepancy
                            </button>
                            <button type="button" style={{ padding: '10px 20px', background: C.blue, border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                Complete unloading & close day
                            </button>
                        </div>
                    </div>
                )}

                {/* LIVE STOCK */}
                {activeTab === 'inventory' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.green }}>Live updates active (30s refresh)</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ ...panel, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: C.blue }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Warehouse stock</h3>
                                        <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Main facility</p>
                                    </div>
                                    <Package size={40} color={C.blue} style={{ opacity: 0.2 }} />
                                </div>
                                <div style={{ marginTop: 20, fontSize: 32, fontWeight: 700 }}>{loadingOverview ? 'No data' : currency(overview.warehouseStock)}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.green, marginTop: 4 }}>85% of total asset value</div>
                            </div>

                            <div style={{ ...panel, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: C.purple }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Fleet inventory</h3>
                                        <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Across {overview.activeVans} active vans</p>
                                    </div>
                                    <Truck size={40} color={C.purple} style={{ opacity: 0.2 }} />
                                </div>
                                <div style={{ marginTop: 20, fontSize: 32, fontWeight: 700 }}>{currency(0)}</div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginTop: 4 }}>15% of total asset value</div>
                            </div>
                        </div>

                        <div style={{ ...panel, padding: '20px 22px' }}>
                            <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, marginBottom: 14 }}>Recent stock movements</h3>
                            {vanLoadsLoading ? (
                                <div style={{ fontSize: 12, color: C.muted }}>Loading movements…</div>
                            ) : (Array.isArray(vanLoadsToday) ? vanLoadsToday : []).length === 0 ? (
                                <div style={{ fontSize: 12, color: C.muted }}>No movements today</div>
                            ) : (
                                (Array.isArray(vanLoadsToday) ? vanLoadsToday : [])
                                    .filter((l: any) => !selectedVan || String(l.van_id) === String(selectedVan))
                                    .map((l: any, i: number) => {
                                        const items = Array.isArray(l.items) ? l.items : [];
                                        const totalQty = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                                        const vanName = vans.find((v) => String(v.id) === String(l.van_id))?.vanNumber || (l.van_number ? String(l.van_number) : 'Van');
                                        return (
                                            <div key={l.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 12 }}>
                                                <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.dim, width: 80 }}>{String(l.load_date ?? '').slice(0, 10) || 'Today'}</span>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue }} />
                                                <span style={{ color: C.text }}>{vanName} loaded {totalQty} item(s)</span>
                                            </div>
                                        );
                                    })
                            )}
                        </div>
                    </div>
                )}

                {/* POD STATUS */}
                {activeTab === 'pod' && (
                    <div style={{ ...panel, padding: '20px 22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>POD status</h3>
                                <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
                                    {overview.podCaptured} captured · {podPending} pending of {overview.ordersToday} deliveries today
                                </p>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,.15)', color: C.orange }}>
                                {podPending} pending
                            </span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={darkTableTh}>Customer</th>
                                    <th style={darkTableTh}>Order</th>
                                    <th style={darkTableTh}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingOverview ? (
                                    <tr><td colSpan={3} style={{ ...darkTableTd, textAlign: 'center', color: C.muted, fontStyle: 'italic' }}>Loading…</td></tr>
                                ) : todaysOrdersList.length === 0 ? (
                                    <tr><td colSpan={3} style={{ ...darkTableTd, textAlign: 'center', color: C.muted, fontStyle: 'italic' }}>No deliveries today</td></tr>
                                ) : (
                                    todaysOrdersList.map((order) => {
                                        const uiStatus = getDeliveryUiStatus(order);
                                        const statusColor = deliveryStatusColor(uiStatus);
                                        return (
                                            <tr key={order.id}>
                                                <td style={{ ...darkTableTd, fontWeight: 600 }}>{order.customerName || '—'}</td>
                                                <td style={{ ...darkTableTd, color: C.muted }}>{order.orderNumber}</td>
                                                <td style={{ ...darkTableTd }}>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: statusColor }}>{deliveryStatusLabel(uiStatus)}</span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAddVanModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ ...panel, padding: '24px 28px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, margin: 0 }}>Add new van</h3>
                        <input type="text" placeholder="Van number" value={newVanForm.van_number} onChange={(e) => setNewVanForm((p) => ({ ...p, van_number: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Driver name" value={newVanForm.driver_name} onChange={(e) => setNewVanForm((p) => ({ ...p, driver_name: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Driver phone" value={newVanForm.driver_phone} onChange={(e) => setNewVanForm((p) => ({ ...p, driver_phone: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Vehicle number" value={newVanForm.vehicle_number} onChange={(e) => setNewVanForm((p) => ({ ...p, vehicle_number: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Capacity (e.g. 1000 liters)" value={newVanForm.capacity_liters} onChange={(e) => setNewVanForm((prev) => ({ ...prev, capacity_liters: e.target.value }))} style={darkInput} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
                            <button type="button" onClick={() => setShowAddVanModal(false)} style={{ padding: '8px 16px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, background: 'transparent', color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                            <button type="button" onClick={handleAddVan} style={{ padding: '8px 16px', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save van</button>
                        </div>
                    </div>
                </div>
            )}
            {showEditVanModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                    <div style={{ ...panel, padding: '24px 28px', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: C.muted, margin: 0 }}>Edit van</h3>
                        <input type="text" placeholder="Van number" value={editVanForm.van_number} onChange={(e) => setEditVanForm((p) => ({ ...p, van_number: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Driver name" value={editVanForm.driver_name} onChange={(e) => setEditVanForm((p) => ({ ...p, driver_name: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Driver phone" value={editVanForm.driver_phone} onChange={(e) => setEditVanForm((p) => ({ ...p, driver_phone: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Vehicle number" value={editVanForm.vehicle_number} onChange={(e) => setEditVanForm((p) => ({ ...p, vehicle_number: e.target.value }))} style={darkInput} />
                        <input type="text" placeholder="Capacity (e.g. 1000 liters)" value={editVanForm.capacity_liters} onChange={(e) => setEditVanForm((p) => ({ ...p, capacity_liters: e.target.value }))} style={darkInput} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
                            <button type="button" onClick={() => setShowEditVanModal(false)} style={{ padding: '8px 16px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, background: 'transparent', color: C.text, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                            <button type="button" onClick={handleEditVan} style={{ padding: '8px 16px', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
