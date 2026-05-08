import { useState, useEffect } from 'react';
import {
    Truck, Package, ArrowRightLeft, ClipboardList,
    CheckCircle, TrendingUp,
    Plus, Save, Minus
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import clsx from 'clsx';
import { getVans, API_BASE_URL, type Van as ApiVan } from '../../services/api';
import { getInvoices, getProducts as getApiProducts, getSalesOrders } from '../../services/api';
import { createVanLoad } from '../../services/vanLoadService';
import { getSalesReturns } from '../../services/salesReturnService';

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

// --- Components ---

const StatCard = ({ label, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-sm flex items-start justify-between">
        <div>
            <p className="text-[10px] font-black uppercase text-redwood-text-muted tracking-widest mb-1">{label}</p>
            <h3 className="text-2xl font-black text-redwood-text-main mb-1">{value}</h3>
            {subtext && <p className={clsx("text-xs font-bold", colorClass)}>{subtext}</p>}
        </div>
        <div className={clsx("p-3 rounded-full bg-opacity-10", colorClass.replace('text-', 'bg-').replace('600', '100'))}>
            <Icon size={20} className={colorClass} />
        </div>
    </div>
);

export default function VanOperations() {
    const UNITS_PER_CASE = 12;
    const [activeTab, setActiveTab] = useState<'overview' | 'loading' | 'unloading' | 'inventory'>('overview');
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
            // compute KPIs from backend data
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

                // Fleet inventory: 0 for now (no van loads / van stock valuation tracked yet)
                const inVansStockValue = 0;

                const totalVans = vans.length;
                const activeVans = vans.filter((v) => String(v.status).toLowerCase() === 'active').length;

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

    // Loading tab helpers
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
                // Refresh vans list
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

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Truck className="text-redwood-brand" /> Van Operations Center
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Logistics • Inventory • Reconciliation
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <select
                        value={selectedVan}
                        onChange={(e) => setSelectedVan(e.target.value)}
                        className="px-3 py-2 rounded-sm text-xs font-black uppercase tracking-wide bg-white border border-redwood-border text-redwood-text-main"
                        disabled={vansLoading || vans.length === 0}
                    >
                        {vansLoading ? (
                            <option value="">Loading vans…</option>
                        ) : vans.length === 0 ? (
                            <option value="">No vans available</option>
                        ) : (
                            vans.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.vanNumber} — {v.driver}
                                </option>
                            ))
                        )}
                    </select>
                    <button
                        type="button"
                        onClick={() => setShowAddVanModal(true)}
                        className="px-3 py-2 rounded-sm text-xs font-black uppercase tracking-wide bg-redwood-brand text-white"
                    >
                        Add New Van
                    </button>
                    <button
                        type="button"
                        onClick={openEditVanModal}
                        className="px-3 py-2 rounded-sm text-xs font-black uppercase tracking-wide bg-white border border-redwood-border text-redwood-text-main"
                        disabled={vansLoading || !selectedVan}
                    >
                        Edit Van
                    </button>
                    {['overview', 'loading', 'unloading', 'inventory'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={clsx(
                                "px-6 py-2 rounded-sm text-xs font-black uppercase tracking-wide transition-all",
                                activeTab === tab
                                    ? "bg-redwood-brand text-white shadow-md"
                                    : "bg-white border border-redwood-border text-redwood-text-muted hover:bg-gray-50"
                            )}
                        >
                            {tab === 'inventory' ? 'Live Stock' : tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">

                {/* 1. OVERVIEW DASHBOARD */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatCard
                                label="Warehouse Stock"
                                value={loadingOverview ? '—' : currency(overview.warehouseStock)}
                                width="w-full"
                                icon={Package}
                                colorClass="text-redwood-brand"
                            />
                            <StatCard
                                label="Stock in Vans"
                                value={loadingOverview ? '—' : currency(overview.inVansStock)}
                                icon={Truck}
                                colorClass="text-blue-600"
                            />
                            <StatCard
                                label="Revenue Today"
                                value={loadingOverview ? '—' : currency(overview.revenueToday)}
                                subtext="Target: $50,000"
                                icon={TrendingUp}
                                colorClass="text-emerald-600"
                            />
                            <StatCard
                                label="POD Captured"
                                value={loadingOverview ? '—' : `${overview.podCaptured}/${overview.ordersToday}`}
                                subtext={
                                    loadingOverview || overview.ordersToday <= 0
                                        ? undefined
                                        : `${Math.round((overview.podCaptured / Math.max(overview.ordersToday, 1)) * 100)}% Completion`
                                }
                                icon={ClipboardList}
                                colorClass="text-amber-600"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Inventory Flow */}
                            <div className="lg:col-span-2 bg-white border border-redwood-border rounded-sm p-6">
                                <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <ArrowRightLeft size={16} /> Inventory Movement (Today)
                                </h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            { name: 'Opening', value: overview.warehouseStock, fill: '#1f2937' },
                                            { name: 'Loaded to Vans', value: 0, fill: '#3B82F6' },
                                            { name: 'Sold', value: overview.soldToday, fill: '#10B981' },
                                            { name: 'Returned', value: overview.returnedToday, fill: '#F59E0B' },
                                            { name: 'Current WH', value: overview.warehouseStock, fill: '#C74634' },
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis tick={{ fontSize: 10 }} />
                                            <Tooltip cursor={{ fill: 'transparent' }} />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* System Status List */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6">
                                <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest mb-6">System Health</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-emerald-50 text-emerald-800 rounded-sm">
                                        <div className="flex items-center gap-3">
                                            <Truck size={18} /> <span className="text-xs font-bold uppercase">Active Vans</span>
                                        </div>
                                        <span className="font-black text-lg">{overview.activeVans}/{overview.totalVans}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-blue-50 text-blue-800 rounded-sm">
                                        <div className="flex items-center gap-3">
                                            <ClipboardList size={18} /> <span className="text-xs font-bold uppercase">Invoices Today</span>
                                        </div>
                                        <span className="font-black text-lg">{overview.invoicesToday}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-redwood-bg-light text-redwood-brand rounded-sm">
                                        <div className="flex items-center gap-3">
                                            <Package size={18} /> <span className="text-xs font-bold uppercase">Orders Today</span>
                                        </div>
                                        <span className="font-black text-lg">{overview.ordersToday}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. LOADING SCREEN */}
                {activeTab === 'loading' && (
                    <div className="space-y-6 animate-in slide-in-from-right duration-500">
                        <div className="bg-white border border-redwood-border rounded-sm p-5">
                            <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest mb-4">FLEET STATUS BOARD</h3>
                            <div className="flex flex-wrap gap-4">
                                {vans.map((van) => {
                                    const t = getVanLoadTotals(van.id);
                                    return (
                                        <div key={van.id} className="w-full sm:w-[280px] bg-white border border-redwood-border rounded-sm p-4">
                                            <div className="text-base font-black text-[#800020] uppercase">{van.vanNumber}</div>
                                            <div className="text-xs text-gray-600 mt-1">Driver: {van.driver || '—'}</div>
                                            <div className="text-xs text-gray-600">Route: {van.route || '—'}</div>
                                            <div className="my-3 border-t border-redwood-border" />
                                            <div className="text-[10px] font-black uppercase text-redwood-text-muted">Current Load</div>
                                            <div className="text-xs text-gray-700 mt-2">Cases: {t.cases}</div>
                                            <div className="text-xs text-gray-700">Units: {t.units}</div>
                                            <div className="text-xs text-gray-700">Value: ${t.value.toFixed(2)}</div>
                                            <div className="my-3 border-t border-redwood-border" />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase text-redwood-text-muted">Status:</span>
                                                <span
                                                    className={clsx(
                                                        'text-[10px] font-black uppercase px-2 py-1 rounded',
                                                        t.loaded ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                    )}
                                                >
                                                    {t.loaded ? 'LOADED' : 'EMPTY'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-white border border-redwood-border rounded-sm p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-black text-redwood-text-main uppercase tracking-tight">
                                        VAN LOADING — {selectedVanRow?.vanNumber || 'No Van'}
                                    </h2>
                                    <p className="text-sm text-redwood-text-muted mt-1">Load products from warehouse to van</p>
                                </div>
                                <div className="text-xs font-bold text-gray-600 space-y-1">
                                    <div>Date: {todayLabel}</div>
                                    <div>Driver: {selectedVanRow?.driver || '—'}</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-redwood-border rounded-sm p-5">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                <div>
                                    <div className="text-[10px] font-black uppercase text-redwood-text-muted">Van Number</div>
                                    <div className="font-bold">{selectedVanRow?.vanNumber || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-redwood-text-muted">Driver</div>
                                    <div className="font-bold">{selectedVanRow?.driver || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-redwood-text-muted">Route</div>
                                    <div className="font-bold">{selectedVanRow?.route || '—'}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-redwood-text-muted">Capacity</div>
                                    <div className="font-bold">1000 liters</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-redwood-text-muted">Current Load</div>
                                    <div className="font-bold">{totalCasesLoaded} cases / ${totalValueLoaded.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Product Catalog */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white border border-redwood-border rounded-sm p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest">Select Products to Load</h3>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Search SKU..." className="px-3 py-2 border border-redwood-border rounded-sm text-xs w-64 focus:outline-none focus:border-redwood-brand" />
                                    </div>
                                </div>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-redwood-bg-light text-[10px] font-black uppercase text-redwood-text-muted">
                                        <tr>
                                            <th className="p-3">Product Name</th>
                                            <th className="p-3">SKU</th>
                                            <th className="p-3">Unit</th>
                                            <th className="p-3 text-right">WH Stock</th>
                                            <th className="p-3 text-center">Qty (Cases)</th>
                                            <th className="p-3 text-right">Value</th>
                                            <th className="p-3 text-center">Remove</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-redwood-border">
                                        {productsLoading ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-xs text-gray-500 italic">
                                                    Loading products…
                                                </td>
                                            </tr>
                                        ) : vanOpProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-xs text-gray-500 italic">
                                                    No products available
                                                </td>
                                            </tr>
                                        ) : (
                                            vanOpProducts.map((product) => (
                                                <tr key={product.id} className="hover:bg-gray-50">
                                                    <td className="p-3 font-bold text-redwood-text-main">{product.name}</td>
                                                    <td className="p-3 text-xs text-gray-500">{product.id}</td>
                                                    <td className="p-3 text-xs text-gray-600">{product.unit || '12x1 QT'} (cases)</td>
                                                    <td className="p-3 text-right font-mono">{product.whStock}</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const existingQty = cart.find((p) => p.id === product.id)?.qty || 0;
                                                                    if (existingQty <= 1) {
                                                                        removeFromLoad(product.id);
                                                                    } else {
                                                                        updateCartQty(product.id, existingQty - 1);
                                                                    }
                                                                }}
                                                                className="p-1 border border-redwood-border rounded-sm text-redwood-text-main"
                                                            >
                                                                <Minus size={13} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={cart.find((p) => p.id === product.id)?.qty ?? ''}
                                                                onChange={(e) => {
                                                                    if (e.target.value === '') {
                                                                        removeFromLoad(product.id);
                                                                        return;
                                                                    }
                                                                    const v = Number(e.target.value) || 0;
                                                                    if (v <= 0) removeFromLoad(product.id);
                                                                    else if (!cart.find((p) => p.id === product.id)) {
                                                                        setCart((prev) => [...prev, { ...product, qty: v }]);
                                                                    } else {
                                                                        updateCartQty(product.id, v);
                                                                    }
                                                                }}
                                                                className="w-14 p-1 text-center border border-redwood-border rounded-sm text-xs font-bold"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => addToLoad(product)}
                                                                className="p-1 border border-redwood-border rounded-sm text-redwood-brand"
                                                            >
                                                                <Plus size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-bold text-redwood-text-main">
                                                        ${(((cart.find((p) => p.id === product.id)?.qty || 0) * (Number(product.price) || 0))).toFixed(2)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFromLoad(product.id)}
                                                            className="p-2 hover:bg-redwood-bg-light rounded text-redwood-brand font-black"
                                                        >
                                                            ×
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right: Loading Manifest */}
                        <div className="space-y-6">
                            <div className="bg-white border border-redwood-border rounded-sm p-6 shadow-lg border-t-4 border-t-redwood-brand">
                                <div className="mb-6 pb-6 border-b border-redwood-border">
                                    <label className="block text-[10px] font-bold text-redwood-text-muted uppercase mb-1">Select Van</label>
                                    <select
                                        value={selectedVan} onChange={(e) => setSelectedVan(e.target.value)}
                                        className="w-full p-2 border border-redwood-border rounded-sm font-bold text-redwood-text-main bg-gray-50"
                                        disabled={vansLoading || vans.length === 0}
                                    >
                                        {vansLoading ? (
                                            <option value="">Loading vans…</option>
                                        ) : vans.length === 0 ? (
                                            <option value="">No vans available</option>
                                        ) : (
                                            vans.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.vanNumber} — {v.driver}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                    <div className="mt-4 flex justify-between text-xs">
                                        <span className="text-gray-500">Route:</span>
                                        <span className="font-bold">{vans.find((v) => v.id === selectedVan)?.route ?? '—'}</span>
                                    </div>
                                </div>

                                <h4 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Loading Manifest</h4>
                                {cart.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 text-xs italic">No items added to load</div>
                                ) : (
                                    <div className="space-y-3 mb-6">
                                        <div className="grid grid-cols-12 text-[10px] font-black uppercase text-gray-500 pb-2 border-b border-redwood-border">
                                            <div className="col-span-5">Product</div>
                                            <div className="col-span-2 text-right">Cases</div>
                                            <div className="col-span-2 text-right">Units</div>
                                            <div className="col-span-3 text-right">Value</div>
                                        </div>
                                        {cart.map((item, idx) => (
                                            <div key={idx} className="grid grid-cols-12 gap-2 items-center text-sm border-b border-dashed border-gray-200 pb-2">
                                                <div className="col-span-5">
                                                    <div className="font-bold text-xs">{item.name}</div>
                                                    <div className="text-[10px] text-gray-400">{item.id}</div>
                                                </div>
                                                <div className="col-span-2 text-right font-mono font-bold">{item.qty}</div>
                                                <div className="col-span-2 text-right font-mono font-bold">{(Number(item.qty) || 0) * UNITS_PER_CASE}</div>
                                                <div className="col-span-3 text-right font-bold text-redwood-text-main">
                                                    ${((Number(item.qty) || 0) * (Number(item.price) || 0)).toFixed(2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3 pt-4 border-t border-redwood-border">
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Total Cases loaded:</span>
                                        <span>{totalCasesLoaded}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold">
                                        <span>Total Units loaded:</span>
                                        <span>{totalUnitsLoaded}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black text-redwood-brand">
                                        <span>Total Value:</span>
                                        <span>${totalValueLoaded.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold text-gray-600">
                                        <span>Weight estimate (optional):</span>
                                        <span>{weightEstimateKg.toLocaleString()} kg</span>
                                    </div>
                                </div>

                                {loadMessage && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2 mb-3">{loadMessage}</div>}
                                {loadError && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2 mb-3">{loadError}</div>}
                                <button
                                    type="button"
                                    onClick={handleConfirmLoad}
                                    disabled={loadSaving || !selectedVan || cart.length === 0}
                                    className="w-full mt-6 py-3 bg-[#800020] text-white font-black uppercase text-xs rounded-sm hover:bg-[#6d001a] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Save size={16} /> {loadSaving ? 'Saving…' : 'Confirm Load'}
                                </button>
                            </div>
                        </div>
                    </div>
                    </div>
                )}

                {/* 3. UNLOADING SCREEN */}
                {activeTab === 'unloading' && (
                    <div className="max-w-4xl mx-auto bg-white border border-redwood-border rounded-sm p-8 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start mb-8 border-b border-redwood-border pb-6">
                            <div>
                                <h2 className="text-xl font-black text-redwood-text-main uppercase tracking-tight">End of Day Reconciliation</h2>
                                <p className="text-xs text-redwood-text-muted mt-1">Process returns and close daily route</p>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-black text-redwood-text-main">6:30 PM</div>
                                <div className="text-xs font-bold text-emerald-600 uppercase">On Time</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mb-8">
                            <div className="bg-gray-50 p-4 rounded-sm border border-gray-200">
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Opening Value</div>
                                <div className="text-xl font-black text-gray-800">$8,500.00</div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-sm border border-emerald-200">
                                <div className="text-[10px] text-emerald-600 uppercase font-bold">Sold Today</div>
                                <div className="text-xl font-black text-emerald-800">$4,580.00</div>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-sm border border-amber-200">
                                <div className="text-[10px] text-amber-600 uppercase font-bold">Expected Return</div>
                                <div className="text-xl font-black text-amber-800">$3,920.00</div>
                            </div>
                        </div>

                        <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Return Inventory Verification</h3>
                        <table className="w-full text-left text-sm mb-8 border border-redwood-border">
                            <thead className="bg-gray-100 text-[10px] font-black uppercase text-gray-500">
                                <tr>
                                    <th className="p-3">Product</th>
                                    <th className="p-3 text-right">Loaded</th>
                                    <th className="p-3 text-right">Sold</th>
                                    <th className="p-3 text-right bg-amber-50 text-amber-900 border-l border-amber-200">Return Qty</th>
                                    <th className="p-3 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                <tr>
                                    <td className="p-3 font-bold">Coca Cola 500ml</td>
                                    <td className="p-3 text-right text-gray-500">50</td>
                                    <td className="p-3 text-right text-gray-500">25</td>
                                    <td className="p-3 text-right font-bold bg-amber-50/50 border-l border-amber-100">25</td>
                                    <td className="p-3 text-right"><CheckCircle size={16} className="ml-auto text-emerald-500" /></td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-bold">Lays Chips Regular</td>
                                    <td className="p-3 text-right text-gray-500">30</td>
                                    <td className="p-3 text-right text-gray-500">12</td>
                                    <td className="p-3 text-right font-bold bg-amber-50/50 border-l border-amber-100">18</td>
                                    <td className="p-3 text-right"><CheckCircle size={16} className="ml-auto text-emerald-500" /></td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="flex justify-end gap-3">
                            <button className="px-6 py-3 bg-white border border-redwood-border text-redwood-text-main font-bold uppercase text-xs rounded-sm hover:bg-gray-50">
                                Report Discrepancy
                            </button>
                            <button className="px-6 py-3 bg-redwood-brand text-white font-black uppercase text-xs rounded-sm hover:bg-redwood-brand/90 shadow-md">
                                Complete Unloading & Close Day
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. LIVE INVENTORY */}
                {activeTab === 'inventory' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Live Updates Active (30s refresh)</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Warehouse Status */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-redwood-brand"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-black text-redwood-text-main uppercase">Warehouse Stock</h3>
                                        <p className="text-xs text-gray-500">Main Facility</p>
                                    </div>
                                    <Package className="text-redwood-brand opacity-20" size={48} />
                                </div>
                                <div className="mt-6">
                                    <div className="text-4xl font-black text-redwood-text-main">
                                        {loadingOverview ? 'No data' : currency(overview.warehouseStock)}
                                    </div>
                                    <div className="text-xs font-bold text-emerald-600 mt-1">85% of Total Asset Value</div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded">Stock Healthy</span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase rounded">Updated: Just now</span>
                                </div>
                            </div>

                            {/* Van Fleet Status */}
                            <div className="bg-white border border-redwood-border rounded-sm p-6 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-black text-redwood-text-main uppercase">Fleet Inventory</h3>
                                        <p className="text-xs text-gray-500">Across {overview.activeVans} Active Vans</p>
                                    </div>
                                    <Truck className="text-blue-500 opacity-20" size={48} />
                                </div>
                                <div className="mt-6">
                                    <div className="text-4xl font-black text-redwood-text-main">{currency(0)}</div>
                                    <div className="text-xs font-bold text-blue-600 mt-1">15% of Total Asset Value</div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded">Active Selling</span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[10px] font-bold uppercase rounded">Sync: Live</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Movements */}
                        <div className="bg-white border border-redwood-border rounded-sm p-6">
                            <h3 className="text-xs font-black text-redwood-text-main uppercase tracking-widest mb-4">Recent Stock Movements</h3>
                            <div className="space-y-0">
                                {vanLoadsLoading ? (
                                    <div className="py-6 text-sm text-gray-500">Loading movements…</div>
                                ) : (Array.isArray(vanLoadsToday) ? vanLoadsToday : []).length === 0 ? (
                                    <div className="py-6 text-sm text-gray-500">No movements today</div>
                                ) : (
                                    (Array.isArray(vanLoadsToday) ? vanLoadsToday : [])
                                        .filter((l: any) => !selectedVan || String(l.van_id) === String(selectedVan))
                                        .map((l: any, i: number) => {
                                            const items = Array.isArray(l.items) ? l.items : [];
                                            const totalQty = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                                            const vanName =
                                                vans.find((v) => String(v.id) === String(l.van_id))?.vanNumber ||
                                                (l.van_number ? String(l.van_number) : 'Van');
                                            return (
                                                <div key={l.id ?? i} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0 text-sm">
                                                    <div className="text-xs font-mono text-gray-400 w-20">{String(l.load_date ?? '').slice(0, 10) || 'Today'}</div>
                                                    <div className={clsx("w-2 h-2 rounded-full", 'bg-blue-500')}></div>
                                                    <div className="font-medium text-gray-700">{vanName} loaded {totalQty} item(s)</div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {showAddVanModal && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white border border-redwood-border rounded-sm p-6 w-full max-w-md space-y-4">
                        <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest">Add New Van</h3>
                        <input
                            type="text"
                            placeholder="Van Number"
                            value={newVanForm.van_number}
                            onChange={(e) => setNewVanForm((p) => ({ ...p, van_number: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Driver Name"
                            value={newVanForm.driver_name}
                            onChange={(e) => setNewVanForm((p) => ({ ...p, driver_name: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Driver Phone"
                            value={newVanForm.driver_phone}
                            onChange={(e) => setNewVanForm((p) => ({ ...p, driver_phone: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Vehicle Number"
                            value={newVanForm.vehicle_number}
                            onChange={(e) => setNewVanForm((p) => ({ ...p, vehicle_number: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Capacity (e.g. 1000 liters)"
                            value={newVanForm.capacity_liters}
                            onChange={e => setNewVanForm(
                                prev => ({...prev,
                                    capacity_liters: e.target.value})
                            )}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAddVanModal(false)}
                                className="px-4 py-2 border border-redwood-border rounded-sm text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddVan}
                                className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-black uppercase"
                            >
                                Save Van
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showEditVanModal && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white border border-redwood-border rounded-sm p-6 w-full max-w-md space-y-4">
                        <h3 className="text-sm font-black text-redwood-text-main uppercase tracking-widest">EDIT VAN</h3>
                        <input
                            type="text"
                            placeholder="Van Number"
                            value={editVanForm.van_number}
                            onChange={(e) => setEditVanForm((p) => ({ ...p, van_number: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Driver Name"
                            value={editVanForm.driver_name}
                            onChange={(e) => setEditVanForm((p) => ({ ...p, driver_name: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Driver Phone"
                            value={editVanForm.driver_phone}
                            onChange={(e) => setEditVanForm((p) => ({ ...p, driver_phone: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Vehicle Number"
                            value={editVanForm.vehicle_number}
                            onChange={(e) => setEditVanForm((p) => ({ ...p, vehicle_number: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <input
                            type="text"
                            placeholder="Capacity (e.g. 1000 liters)"
                            value={editVanForm.capacity_liters}
                            onChange={(e) => setEditVanForm((p) => ({ ...p, capacity_liters: e.target.value }))}
                            className="w-full p-2 border border-redwood-border rounded-sm text-sm"
                        />
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowEditVanModal(false)}
                                className="px-4 py-2 border border-redwood-border rounded-sm text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleEditVan}
                                className="px-4 py-2 bg-redwood-brand text-white rounded-sm text-xs font-black uppercase"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
