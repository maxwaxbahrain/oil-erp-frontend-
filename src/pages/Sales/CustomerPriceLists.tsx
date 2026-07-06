import { useState, useEffect, useMemo, Fragment, type CSSProperties } from 'react';
import {
    Tag, Plus, Save, Trash2, Edit2, Search, AlertTriangle, Bot, Sparkles,
    Eye, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Layers, FileText,
    Clock, ShieldAlert,
} from 'lucide-react';
import {
    getCustomers, getProducts, type Customer, type Product,
    getCustomerPriceLists, saveCustomerPriceList, deleteCustomerPriceList,
    type CustomerPriceList,
} from '../../services/api';
import { formatCurrency } from '../../services/settingsService';
import { getCurrentUser } from '../../store/authStore';

/* ── UI tokens (dark redwood) ─────────────────────────────────────────────── */
const panelStyle: CSSProperties = {
    background: 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '14px',
    padding: '14px 16px',
};

const ghostBtn: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 11px',
    borderRadius: 6,
    fontSize: 10.5,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-redwood-border)',
    background: 'rgba(255,255,255,.04)',
    color: 'var(--color-redwood-text-muted)',
    fontFamily: 'inherit',
};

const primaryBtn: CSSProperties = {
    ...ghostBtn,
    border: 'none',
    background: '#4F8EF7',
    color: '#fff',
};

const thStyle: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: 'var(--color-redwood-text-muted)',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid var(--color-redwood-border)',
};

const tdStyle: CSSProperties = {
    padding: '11px 12px',
    fontSize: 11,
    color: 'var(--color-redwood-text-main)',
    verticalAlign: 'middle',
    borderBottom: '1px solid rgba(255,255,255,.04)',
};

type PageTab = 'lists' | 'tiers' | 'templates' | 'approval' | 'audit';
type FilterChip = 'all' | 'active' | 'pending' | 'expiring';
type TierKey = 'gold' | 'silver' | 'standard';

const META_KEY = 'customer_price_list_meta';

interface PriceListMeta {
    approvedBy?: string;
    approvedAt?: string;
    validTo?: string;
    tier?: TierKey;
}

const PRICE_TIERS = [
    {
        key: 'gold' as TierKey,
        name: 'Gold tier',
        discount: 15,
        badge: 'CFO approval required',
        badgeStyle: { background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)', border: '1px solid rgba(245,158,11,.28)' },
        stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
    },
    {
        key: 'silver' as TierKey,
        name: 'Silver tier',
        discount: 8,
        badge: 'Auto-applied',
        badgeStyle: { background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)', border: '1px solid rgba(79,142,247,.28)' },
        stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
    },
    {
        key: 'standard' as TierKey,
        name: 'Standard retail',
        discount: 0,
        badge: 'Default pricing',
        badgeStyle: { background: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)', border: '1px solid var(--color-redwood-border)' },
        stripe: 'linear-gradient(90deg,#64748B,#94A3B8)',
    },
];

const AI_PROMPTS = [
    'Which customers have the highest discounts?',
    'Recommend tier changes for Q2',
    'Flag expiring price lists this month',
    'Compare margin impact of Gold tier',
];

function formatDate(raw: string | undefined): string {
    if (!raw) return '—';
    try {
        const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
        if (Number.isNaN(d.getTime())) return raw;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return raw;
    }
}

function getMetaMap(): Record<string, PriceListMeta> {
    try {
        return JSON.parse(localStorage.getItem(META_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveMetaMap(map: Record<string, PriceListMeta>): void {
    localStorage.setItem(META_KEY, JSON.stringify(map));
}

function getMaxDiscount(list: CustomerPriceList): number {
    return Math.max(0, ...list.prices.map(p => p.discountPct || 0));
}

function inferTier(list: CustomerPriceList, meta?: PriceListMeta): TierKey {
    if (meta?.tier) return meta.tier;
    const max = getMaxDiscount(list);
    if (max >= 15) return 'gold';
    if (max >= 8) return 'silver';
    return 'standard';
}

function getValidTo(list: CustomerPriceList, meta?: PriceListMeta): Date {
    if (meta?.validTo) return new Date(meta.validTo);
    const base = new Date(list.updatedAt || Date.now());
    const end = new Date(base);
    end.setFullYear(end.getFullYear() + 1);
    return end;
}

function daysUntil(date: Date): number {
    return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function getListStatus(list: CustomerPriceList, meta: PriceListMeta | undefined): 'active' | 'pending' | 'expiring' {
    const maxDiscount = getMaxDiscount(list);
    const validTo = getValidTo(list, meta);
    const days = daysUntil(validTo);
    if (maxDiscount > 10 && !meta?.approvedBy) return 'pending';
    if (days <= 30 && days >= 0) return 'expiring';
    return 'active';
}

function statusBadgeStyle(status: string): CSSProperties {
    if (status === 'Active') {
        return { background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)', border: '1px solid rgba(34,197,94,.28)' };
    }
    if (status === 'Pending') {
        return { background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)', border: '1px solid rgba(245,158,11,.28)' };
    }
    if (status === 'Expiring') {
        return { background: 'rgba(245,158,11,.08)', color: '#FCD34D', border: '1px solid rgba(245,158,11,.35)' };
    }
    return { background: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)', border: '1px solid var(--color-redwood-border)' };
}

function tierBadgeStyle(tier: TierKey): CSSProperties {
    if (tier === 'gold') return { background: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber-tint)', border: '1px solid rgba(245,158,11,.28)' };
    if (tier === 'silver') return { background: 'var(--color-badge-blue-bg)', color: 'var(--color-brand-blue-tint)', border: '1px solid rgba(79,142,247,.28)' };
    return { background: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)', border: '1px solid var(--color-redwood-border)' };
}

function tierLabel(tier: TierKey): string {
    if (tier === 'gold') return 'Gold';
    if (tier === 'silver') return 'Silver';
    return 'Standard';
}

function enrichPriceLists(
    lists: CustomerPriceList[],
    customerRows: Customer[],
    productRows: Product[],
): CustomerPriceList[] {
    return lists.map((list) => ({
        ...list,
        customerId: String(list.customerId),
        customerName:
            customerRows.find((c) => String(c.id) === String(list.customerId))?.name
            || list.customerName
            || 'Unknown customer',
        prices: list.prices.map((entry) => ({
            ...entry,
            productId: String(entry.productId),
            productName:
                productRows.find((p) => String(p.id) === String(entry.productId))?.name
                || entry.productName
                || 'Unknown product',
        })),
    }));
}

export default function CustomerPriceLists() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [priceLists, setPriceLists] = useState<CustomerPriceList[]>([]);
    const [metaMap, setMetaMap] = useState<Record<string, PriceListMeta>>({});
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<CustomerPriceList | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [activeTab, setActiveTab] = useState<PageTab>('lists');
    const [filterChip, setFilterChip] = useState<FilterChip>('all');
    const [tierFilter, setTierFilter] = useState<'all' | TierKey>('all');
    const [aiQuestion, setAiQuestion] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setErrorMsg('');
            try {
                const [c, p, lists] = await Promise.all([
                    getCustomers(),
                    getProducts(),
                    getCustomerPriceLists(),
                ]);
                if (cancelled) return;
                setCustomers(c);
                setProducts(p);
                setPriceLists(enrichPriceLists(lists, c, p));
                setMetaMap(getMetaMap());
            } catch (err) {
                if (!cancelled) {
                    setErrorMsg(err instanceof Error ? err.message : 'Failed to load price lists');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const reloadLists = async () => {
        setErrorMsg('');
        try {
            const lists = await getCustomerPriceLists();
            setPriceLists(enrichPriceLists(lists, customers, products));
            setMetaMap(getMetaMap());
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to refresh price lists');
        }
    };

    const enrichedLists = useMemo(() => {
        return priceLists.map(list => {
            const meta = metaMap[list.customerId];
            const tier = inferTier(list, meta);
            const maxDiscount = getMaxDiscount(list);
            const validFrom = new Date(list.updatedAt || Date.now());
            const validTo = getValidTo(list, meta);
            const status = getListStatus(list, meta);
            const customCount = list.prices.filter(p => p.customPrice > 0 || p.discountPct > 0).length;
            return {
                list,
                meta,
                tier,
                maxDiscount,
                validFrom,
                validTo,
                status,
                customCount,
                expiresDays: daysUntil(validTo),
            };
        });
    }, [priceLists, metaMap]);

    const pendingLists = useMemo(
        () => enrichedLists.filter(e => e.status === 'pending'),
        [enrichedLists],
    );

    const expiringLists = useMemo(
        () => enrichedLists.filter(e => e.status === 'expiring'),
        [enrichedLists],
    );

    const activeLists = useMemo(
        () => enrichedLists.filter(e => e.status === 'active'),
        [enrichedLists],
    );

    const customPriceCount = priceLists.length;
    const standardPriceCount = Math.max(0, customers.length - priceLists.length);

    const filtered = useMemo(() => {
        let rows = enrichedLists;
        if (activeTab === 'approval') rows = pendingLists;
        const q = search.trim().toLowerCase();
        if (q) rows = rows.filter(r => r.list.customerName.toLowerCase().includes(q));
        if (tierFilter !== 'all') rows = rows.filter(r => r.tier === tierFilter);
        if (filterChip === 'active') rows = rows.filter(r => r.status === 'active');
        else if (filterChip === 'pending') rows = rows.filter(r => r.status === 'pending');
        else if (filterChip === 'expiring') rows = rows.filter(r => r.status === 'expiring');
        return rows;
    }, [enrichedLists, pendingLists, search, tierFilter, filterChip, activeTab]);

    const tierCustomers = useMemo(() => {
        const map: Record<TierKey, string[]> = { gold: [], silver: [], standard: [] };
        for (const e of enrichedLists) {
            map[e.tier].push(e.list.customerName);
        }
        const standardNames = customers
            .filter(c => !priceLists.some(l => String(l.customerId) === String(c.id)))
            .map(c => c.name)
            .slice(0, 6);
        map.standard = [...map.standard, ...standardNames].slice(0, 8);
        return map;
    }, [enrichedLists, customers, priceLists]);

    const auditEntries = useMemo(() => {
        return [...enrichedLists]
            .sort((a, b) => new Date(b.list.updatedAt).getTime() - new Date(a.list.updatedAt).getTime())
            .map(e => ({
                customer: e.list.customerName,
                action: e.meta?.approvedBy ? 'Approved' : 'Updated',
                by: e.meta?.approvedBy || 'System',
                at: e.list.updatedAt,
            }));
    }, [enrichedLists]);

    const startEdit = (list: CustomerPriceList, allProducts: Product[]) => {
        const existingIds = new Set(list.prices.map(p => String(p.productId)));
        const newEntries = allProducts
            .filter(p => !existingIds.has(String(p.id)))
            .map(p => ({ productId: String(p.id), productName: p.name, customPrice: 0, discountPct: 0 }));
        const updatedList = {
            ...list,
            customerId: String(list.customerId),
            prices: [...list.prices, ...newEntries],
        };
        setEditingId(String(list.customerId));
        setEditForm(JSON.parse(JSON.stringify(updatedList)));
        setExpanded(String(list.customerId));
    };

    const saveEdit = async () => {
        if (!editForm) return;
        setSaving(true);
        setErrorMsg('');
        try {
            await saveCustomerPriceList(editForm);
            await reloadLists();
            setEditingId(null);
            setEditForm(null);
            setSuccessMsg('Price list saved!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to save price list');
        } finally {
            setSaving(false);
        }
    };

    const createNewList = async () => {
        if (!selectedCustomer) return;
        const customer = customers.find(c => String(c.id) === String(selectedCustomer));
        if (!customer) {
            setErrorMsg('Customer not found — please select again.');
            return;
        }
        setSaving(true);
        setErrorMsg('');
        try {
            const newList: CustomerPriceList = {
                customerId: String(customer.id),
                customerName: customer.name,
                prices: products.map(p => ({
                    productId: String(p.id),
                    productName: p.name,
                    customPrice: 0,
                    discountPct: 0,
                })),
                updatedAt: new Date().toISOString(),
            };
            const saved = await saveCustomerPriceList(newList);
            const enriched = enrichPriceLists([saved], customers, products)[0];
            await reloadLists();
            setShowAdd(false);
            setSelectedCustomer('');
            startEdit(enriched, products);
            setExpanded(String(enriched.customerId));
            setSuccessMsg('Price list created!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to create price list');
        } finally {
            setSaving(false);
        }
    };

    const updatePrice = (productId: string, field: 'customPrice' | 'discountPct', value: number) => {
        if (!editForm) return;
        setEditForm({
            ...editForm,
            prices: editForm.prices.map(p =>
                String(p.productId) === String(productId) ? { ...p, [field]: value } : p,
            ),
        });
    };

    const deleteList = async (customerId: string) => {
        if (!confirm('Remove this customer\'s price list?')) return;
        const list = priceLists.find(l => String(l.customerId) === String(customerId));
        if (!list?.id) {
            setErrorMsg('Price list not found or missing server id.');
            return;
        }
        setSaving(true);
        setErrorMsg('');
        try {
            await deleteCustomerPriceList(list.id);
            const meta = getMetaMap();
            delete meta[String(customerId)];
            saveMetaMap(meta);
            await reloadLists();
            setSuccessMsg('Price list removed.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to delete price list');
        } finally {
            setSaving(false);
        }
    };

    const approveList = (customerId: string) => {
        const meta = getMetaMap();
        const validTo = new Date();
        validTo.setFullYear(validTo.getFullYear() + 1);
        meta[customerId] = {
            ...meta[customerId],
            approvedBy: getCurrentUser().name || 'CFO',
            approvedAt: new Date().toISOString(),
            validTo: validTo.toISOString(),
        };
        saveMetaMap(meta);
        reloadLists();
        setSuccessMsg('Price list approved!');
        setTimeout(() => setSuccessMsg(''), 3000);
    };

    const renewList = async (customerId: string) => {
        const meta = getMetaMap();
        const validTo = new Date();
        validTo.setFullYear(validTo.getFullYear() + 1);
        meta[String(customerId)] = {
            ...meta[String(customerId)],
            validTo: validTo.toISOString(),
        };
        saveMetaMap(meta);
        const list = priceLists.find(l => String(l.customerId) === String(customerId));
        if (!list) {
            setErrorMsg('Price list not found.');
            return;
        }
        setErrorMsg('');
        try {
            await saveCustomerPriceList(list);
            await reloadLists();
            setSuccessMsg('Price list renewed for 12 months!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to renew price list');
        }
    };

    const availableCustomers = customers;

    const pageTabs: { key: PageTab; label: string; count?: number }[] = [
        { key: 'lists', label: 'Price lists' },
        { key: 'tiers', label: 'Price tiers' },
        { key: 'templates', label: 'Templates' },
        { key: 'approval', label: 'Approval queue', count: pendingLists.length },
        { key: 'audit', label: 'Audit trail' },
    ];

    const filterChips: { key: FilterChip; label: string; count?: number }[] = [
        { key: 'all', label: 'All', count: enrichedLists.length },
        { key: 'active', label: 'Active', count: activeLists.length },
        { key: 'pending', label: 'Pending', count: pendingLists.length },
        { key: 'expiring', label: 'Expiring', count: expiringLists.length },
    ];

    const pendingNames = pendingLists.map(p => p.list.customerName).slice(0, 3).join(', ');

    if (loading) {
        return (
            <div style={{ paddingBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 16px', color: 'var(--color-redwood-text-muted)' }}>
                <div className="w-12 h-12 border-2 rounded-full animate-spin mb-3" style={{ borderColor: '#4F8EF7', borderTopColor: 'transparent' }} />
                <p style={{ fontSize: 12, fontWeight: 500 }}>Loading price lists…</p>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            <div className="space-y-3 max-w-[1200px]">
                {/* Page header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--color-badge-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Tag size={20} style={{ color: '#4F8EF7' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: '-.5px', color: 'var(--color-brand-blue)', margin: 0 }}>
                                Customer price lists
                            </h1>
                            <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', margin: '2px 0 0' }}>
                                Custom prices · tier discounts · templates · CFO approval workflow
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button type="button" onClick={() => void reloadLists()} style={ghostBtn}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button type="button" onClick={() => setShowAdd(true)} style={primaryBtn}>
                            <Plus size={14} /> Add price list
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ ...panelStyle, padding: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {pageTabs.map(t => {
                        const active = activeTab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setActiveTab(t.key)}
                                style={{
                                    padding: '7px 14px',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    background: active ? 'var(--color-badge-blue-bg)' : 'transparent',
                                    color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                                    border: active ? '1px solid rgba(79,142,247,.28)' : '1px solid transparent',
                                    fontFamily: 'inherit',
                                }}
                            >
                                {t.label}
                                {t.count != null && t.count > 0 ? ` (${t.count})` : ''}
                            </button>
                        );
                    })}
                </div>

                {errorMsg && (
                    <div style={{ ...panelStyle, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.35)', color: 'var(--color-brand-red-tint)', fontSize: 12, fontWeight: 600 }}>
                        {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div style={{ ...panelStyle, background: 'var(--color-badge-green-bg)', border: '1px solid rgba(34,197,94,.28)', color: 'var(--color-brand-green-tint)', fontSize: 12, fontWeight: 600 }}>
                        ✓ {successMsg}
                    </div>
                )}

                {/* Add new */}
                {showAdd && (
                    <div style={{ ...panelStyle, border: '1px solid rgba(79,142,247,.35)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-redwood-text-main)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>Select customer</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <select
                                value={selectedCustomer}
                                onChange={e => setSelectedCustomer(e.target.value)}
                                style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 11, fontFamily: 'inherit' }}
                            >
                                <option value="">— Select a customer —</option>
                                {availableCustomers.map(c => (
                                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => void createNewList()} disabled={!selectedCustomer || saving} style={{ ...primaryBtn, opacity: selectedCustomer && !saving ? 1 : 0.5 }}>
                                Create
                            </button>
                            <button type="button" onClick={() => setShowAdd(false)} style={ghostBtn}>Cancel</button>
                        </div>
                        {customers.length === 0 && (
                            <p style={{ fontSize: 10, color: 'var(--color-brand-amber-tint)', marginTop: 8, fontWeight: 600 }}>No customers found. Add customers first.</p>
                        )}
                    </div>
                )}

                {(activeTab === 'lists' || activeTab === 'approval') && (
                    <>
                        {/* KPI cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
                            {[
                                {
                                    label: 'Custom Price Customers',
                                    value: String(customPriceCount),
                                    sub: `of ${customers.length} total customers`,
                                    stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                                    valueColor: 'var(--color-brand-amber)',
                                },
                                {
                                    label: 'Standard Price Customers',
                                    value: String(standardPriceCount),
                                    sub: 'using default catalog prices',
                                    stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
                                    valueColor: 'var(--color-brand-blue)',
                                },
                                {
                                    label: 'Active Price Lists',
                                    value: String(activeLists.length + expiringLists.length),
                                    sub: expiringLists.length > 0 ? `${expiringLists.length} expiring soon` : 'all current',
                                    stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
                                    valueColor: 'var(--color-brand-green)',
                                },
                                {
                                    label: 'Pending Approval',
                                    value: String(pendingLists.length),
                                    sub: pendingLists.length > 0 ? '>10% discount' : 'none awaiting review',
                                    stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
                                    valueColor: 'var(--color-brand-amber)',
                                },
                            ].map(k => (
                                <div key={k.label} style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: 14, padding: '13px 14px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: k.stripe, borderRadius: '14px 14px 0 0' }} />
                                    <div style={{ fontSize: 10.5, color: 'var(--color-redwood-text-muted)', fontWeight: 500, marginBottom: 6 }}>{k.label}</div>
                                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: '-.5px', color: k.valueColor, marginBottom: 3 }}>{k.value}</div>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>{k.sub}</div>
                                </div>
                            ))}
                        </div>

                        {/* Alert banner */}
                        {pendingLists.length > 0 && (
                            <div style={{ ...panelStyle, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                                    <ShieldAlert size={18} style={{ color: 'var(--color-brand-amber-tint)', flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand-amber-tint)', marginBottom: 2 }}>
                                            CFO approval required
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>
                                            {pendingNames || 'Customers'} — discount exceeds 10% threshold
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('approval'); setFilterChip('pending'); }}
                                    style={{ ...primaryBtn, background: '#F59E0B', fontSize: 10, fontWeight: 700 }}
                                >
                                    Review {pendingLists.length}
                                </button>
                            </div>
                        )}

                        {/* Price tiers */}
                        {activeTab === 'lists' && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Layers size={14} style={{ color: '#4F8EF7' }} /> Price tiers
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 10 }}>
                                    {PRICE_TIERS.map(tier => (
                                        <div key={tier.key} style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: 14, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: tier.stripe }} />
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{tier.name}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 700, color: tier.key === 'gold' ? 'var(--color-brand-amber-tint)' : tier.key === 'silver' ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)', marginTop: 2 }}>
                                                        {tier.discount > 0 ? `−${tier.discount}%` : '0%'}
                                                    </div>
                                                </div>
                                                {tier.key === 'gold' && (
                                                    <button type="button" onClick={() => setActiveTab('tiers')} style={{ ...ghostBtn, fontSize: 9, padding: '4px 8px' }}>Manage</button>
                                                )}
                                            </div>
                                            <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block', ...tier.badgeStyle }}>
                                                {tier.badge}
                                            </span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                                                {(tierCustomers[tier.key].length > 0 ? tierCustomers[tier.key] : ['No customers']).slice(0, 5).map(name => (
                                                    <span key={name} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-muted)' }}>
                                                        {name}
                                                    </span>
                                                ))}
                                                {tierCustomers[tier.key].length > 5 && (
                                                    <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>+{tierCustomers[tier.key].length - 5} more</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search + filters */}
                        <div style={panelStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <Search size={16} style={{ color: 'var(--color-redwood-text-muted)', flexShrink: 0 }} />
                                <input
                                    type="search"
                                    placeholder="Search customer, tier, product..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ flex: 1, background: 'var(--color-redwood-row-bg)', border: '1px solid var(--color-redwood-border)', borderRadius: 8, outline: 'none', color: 'var(--color-redwood-text-main)', fontSize: 12, padding: '8px 12px', fontFamily: 'inherit' }}
                                />
                                <select
                                    value={tierFilter}
                                    onChange={e => setTierFilter(e.target.value as typeof tierFilter)}
                                    style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 10, fontFamily: 'inherit' }}
                                >
                                    <option value="all">All tiers</option>
                                    <option value="gold">Gold</option>
                                    <option value="silver">Silver</option>
                                    <option value="standard">Standard</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {filterChips.map(c => {
                                    const active = filterChip === c.key;
                                    return (
                                        <button
                                            key={c.key}
                                            type="button"
                                            onClick={() => setFilterChip(c.key)}
                                            style={{
                                                padding: '6px 12px',
                                                fontSize: 10,
                                                fontWeight: 500,
                                                borderRadius: 8,
                                                cursor: 'pointer',
                                                background: active ? 'var(--color-badge-blue-bg)' : 'transparent',
                                                color: active ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)',
                                                border: active ? '1px solid rgba(79,142,247,.28)' : '1px solid var(--color-redwood-border)',
                                                fontFamily: 'inherit',
                                            }}
                                        >
                                            {c.label}{c.count != null ? ` (${c.count})` : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                            {filtered.length === 0 ? (
                                <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                                    <Tag size={40} style={{ color: 'var(--color-redwood-text-subtle)', margin: '0 auto 12px' }} />
                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-muted)' }}>No price lists found</p>
                                    <p style={{ fontSize: 11, color: 'var(--color-redwood-text-subtle)', marginTop: 4 }}>Add a customer price list or adjust filters</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                                {['Customer', 'Tier', 'Discount / type', 'Products', 'Valid period', 'Expires', 'Status', 'Approved by', 'Actions'].map(h => (
                                                    <th key={h} style={thStyle}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(({ list, tier, maxDiscount, customCount, validFrom, validTo, status, meta, expiresDays }) => {
                                                const isExpanded = expanded === String(list.customerId);
                                                const isEditing = editingId === String(list.customerId);
                                                const displayList = isEditing && editForm ? editForm : list;
                                                const statusLabel = status === 'pending' ? 'Pending' : status === 'expiring' ? 'Expiring' : 'Active';
                                                const discountLabel = maxDiscount > 0
                                                    ? `${maxDiscount}% off`
                                                    : customCount > 0 ? 'Custom prices' : 'Standard';

                                                return (
                                                    <Fragment key={list.customerId}>
                                                        <tr style={{ background: isExpanded ? 'rgba(79,142,247,.06)' : undefined }}>
                                                            <td style={tdStyle}>
                                                                <div style={{ fontWeight: 600 }}>{list.customerName}</div>
                                                            </td>
                                                            <td style={tdStyle}>
                                                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...tierBadgeStyle(tier) }}>
                                                                    {tierLabel(tier)}
                                                                </span>
                                                            </td>
                                                            <td style={tdStyle}>{discountLabel}</td>
                                                            <td style={tdStyle}>{customCount} / {list.prices.length}</td>
                                                            <td style={tdStyle}>{formatDate(validFrom.toISOString())} – {formatDate(validTo.toISOString())}</td>
                                                            <td style={{ ...tdStyle, color: expiresDays <= 30 ? 'var(--color-brand-amber-tint)' : 'var(--color-redwood-text-muted)' }}>
                                                                {expiresDays > 0 ? `${expiresDays}d` : 'Expired'}
                                                            </td>
                                                            <td style={tdStyle}>
                                                                <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...statusBadgeStyle(statusLabel) }}>
                                                                    {statusLabel}
                                                                </span>
                                                            </td>
                                                            <td style={tdStyle}>{meta?.approvedBy || '—'}</td>
                                                            <td style={tdStyle}>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                                    <button type="button" onClick={() => setExpanded(isExpanded ? null : list.customerId)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px' }}>
                                                                        <Eye size={11} /> View
                                                                    </button>
                                                                    {status === 'pending' && (
                                                                        <button type="button" onClick={() => approveList(list.customerId)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', background: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green-tint)', border: '1px solid rgba(34,197,94,.28)' }}>
                                                                            <CheckCircle2 size={11} /> Approve
                                                                        </button>
                                                                    )}
                                                                    <button type="button" onClick={() => startEdit(list, products)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px' }}>
                                                                        <Edit2 size={11} /> Edit
                                                                    </button>
                                                                    {(status === 'expiring' || expiresDays <= 60) && (
                                                                        <button type="button" onClick={() => void renewList(list.customerId)} style={{ ...ghostBtn, fontSize: 9, padding: '3px 7px', color: 'var(--color-brand-blue-tint)' }}>
                                                                            <RefreshCw size={11} /> Renew
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr>
                                                                <td colSpan={9} style={{ padding: 0, borderBottom: '1px solid var(--color-redwood-border)' }}>
                                                                    <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,.02)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                                                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Product pricing — {list.customerName}</span>
                                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                                {!isEditing && (
                                                                                    <button type="button" onClick={() => startEdit(list, products)} style={{ ...ghostBtn, fontSize: 9 }}>
                                                                                        <Edit2 size={12} /> Edit
                                                                                    </button>
                                                                                )}
                                                                                <button type="button" onClick={() => void deleteList(list.customerId)} style={{ ...ghostBtn, fontSize: 9, color: 'var(--color-brand-red-tint)', border: '1px solid rgba(239,68,68,.2)' }}>
                                                                                    <Trash2 size={12} /> Remove
                                                                                </button>
                                                                                <button type="button" onClick={() => setExpanded(null)} style={ghostBtn}>
                                                                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ overflowX: 'auto' }}>
                                                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                                                <thead>
                                                                                    <tr>
                                                                                        {['Product', 'Standard Price', 'Custom Price', 'Discount %', 'Effective Price'].map(h => (
                                                                                            <th key={h} style={{ ...thStyle, fontSize: 8 }}>{h}</th>
                                                                                        ))}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {displayList.prices.map(entry => {
                                                                                        const product = products.find(p => String(p.id) === String(entry.productId));
                                                                                        const stdPrice = product?.unit_price || 0;
                                                                                        const effective = entry.customPrice > 0
                                                                                            ? entry.customPrice
                                                                                            : entry.discountPct > 0
                                                                                                ? stdPrice * (1 - entry.discountPct / 100)
                                                                                                : stdPrice;
                                                                                        const hasCustom = entry.customPrice > 0 || entry.discountPct > 0;
                                                                                        return (
                                                                                            <tr key={entry.productId} style={{ background: hasCustom ? 'rgba(79,142,247,.04)' : undefined }}>
                                                                                                <td style={{ ...tdStyle, fontSize: 10 }}>
                                                                                                    <div style={{ fontWeight: 600 }}>{entry.productName}</div>
                                                                                                    <div style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>{product?.sku}</div>
                                                                                                </td>
                                                                                                <td style={{ ...tdStyle, fontFamily: 'ui-monospace,monospace', fontSize: 10 }}>{formatCurrency(stdPrice)}</td>
                                                                                                <td style={tdStyle}>
                                                                                                    {isEditing ? (
                                                                                                        <input type="number" value={entry.customPrice || ''} onChange={e => updatePrice(entry.productId, 'customPrice', parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 10, fontFamily: 'ui-monospace,monospace' }} />
                                                                                                    ) : (
                                                                                                        <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10 }}>{entry.customPrice > 0 ? formatCurrency(entry.customPrice) : '—'}</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td style={tdStyle}>
                                                                                                    {isEditing ? (
                                                                                                        <input type="number" value={entry.discountPct || ''} onChange={e => updatePrice(entry.productId, 'discountPct', parseFloat(e.target.value) || 0)} placeholder="0" min={0} max={100} style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 10, fontFamily: 'ui-monospace,monospace' }} />
                                                                                                    ) : (
                                                                                                        <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10 }}>{entry.discountPct > 0 ? `${entry.discountPct}%` : '—'}</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'ui-monospace,monospace', fontSize: 10, color: hasCustom ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-subtle)' }}>
                                                                                                    {formatCurrency(effective)}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                        {isEditing && (
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-redwood-border)' }}>
                                                                                <button type="button" onClick={() => void saveEdit()} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
                                                                                    <Save size={12} /> Save price list
                                                                                </button>
                                                                                <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }} style={ghostBtn}>Cancel</button>
                                                                                <span style={{ fontSize: 9, color: 'var(--color-redwood-text-subtle)' }}>Custom price overrides discount %. Leave both 0 for standard price.</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* AI Pricing Analysis */}
                        {activeTab === 'lists' && (
                            <div style={{ ...panelStyle, border: '0.5px solid rgba(155,111,228,.25)', background: 'linear-gradient(135deg,rgba(155,111,228,.06),rgba(79,142,247,.04))' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(155,111,228,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Bot size={16} style={{ color: '#C4B5FD' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>AI Pricing Analysis</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Insights from your price list data · human approval required</div>
                                    </div>
                                </div>

                                {[
                                    {
                                        dot: '#F59E0B',
                                        body: pendingLists.length > 0
                                            ? <><strong style={{ color: '#F59E0B' }}>{pendingLists.length} price list{pendingLists.length !== 1 ? 's' : ''}</strong> exceed the 10% discount threshold and require CFO approval before invoicing.</>
                                            : <>All active price lists are within the 10% discount approval threshold.</>,
                                    },
                                    {
                                        dot: '#22C55E',
                                        body: <><strong style={{ color: '#22C55E' }}>{customPriceCount} customers</strong> have custom pricing vs {standardPriceCount} on standard catalog — {customPriceCount > 0 ? `${Math.round((customPriceCount / Math.max(customers.length, 1)) * 100)}%` : '0%'} of your customer base.</>,
                                    },
                                    {
                                        dot: '#4F8EF7',
                                        body: expiringLists.length > 0
                                            ? <><strong style={{ color: '#4F8EF7' }}>{expiringLists.length} list{expiringLists.length !== 1 ? 's' : ''}</strong> expiring within 30 days — renew to avoid reverting to standard prices.</>
                                            : <>No price lists expiring in the next 30 days. All agreements are current.</>,
                                    },
                                    {
                                        dot: '#9B6FE4',
                                        body: tierCustomers.gold.length > 0
                                            ? <>Gold tier applied to <strong style={{ color: '#9B6FE4' }}>{tierCustomers.gold.length} customer{tierCustomers.gold.length !== 1 ? 's' : ''}</strong> — monitor margin impact on high-volume accounts.</>
                                            : <>No Gold tier customers yet. Consider tiered pricing for top-volume accounts.</>,
                                    },
                                ].map((ins, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,.04)' : 'none' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: ins.dot, flexShrink: 0, marginTop: 4 }} />
                                        <div style={{ flex: 1, fontSize: 10, color: 'var(--color-redwood-text-muted)', lineHeight: 1.5 }}>{ins.body}</div>
                                    </div>
                                ))}

                                <div style={{ fontSize: 10, fontWeight: 500, color: '#C4B5FD', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Sparkles size={12} /> AI suggested actions
                                    {pendingLists.length > 0 && (
                                        <span style={{ fontSize: 9, background: 'rgba(245,158,11,.12)', color: '#F59E0B', borderRadius: 20, padding: '1px 6px' }}>{pendingLists.length} pending approval</span>
                                    )}
                                </div>

                                {pendingLists.slice(0, 2).map(p => (
                                    <div key={p.list.customerId} style={{ background: '#0a1726', border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <AlertTriangle size={14} style={{ color: '#FCD34D' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-redwood-text-main)' }}>Approve {p.list.customerName} — {p.maxDiscount}% discount</div>
                                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Exceeds 10% threshold · CFO sign-off required</div>
                                        </div>
                                        <button type="button" onClick={() => approveList(p.list.customerId)} style={{ background: '#22C55E', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>✓ Approve</button>
                                    </div>
                                ))}

                                {expiringLists.slice(0, 1).map(p => (
                                    <div key={`renew-${p.list.customerId}`} style={{ background: '#0a1726', border: '0.5px solid rgba(255,255,255,.06)', borderRadius: 8, padding: '9px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 9 }}>
                                        <div style={{ width: 26, height: 26, borderRadius: 6, background: 'rgba(79,142,247,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Clock size={14} style={{ color: '#93C5FD' }} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-redwood-text-main)' }}>Renew {p.list.customerName} price list</div>
                                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>Expires in {p.expiresDays} days · extend 12 months</div>
                                        </div>
                                        <button type="button" onClick={() => void renewList(p.list.customerId)} style={{ background: '#4F8EF7', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 9, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Renew</button>
                                    </div>
                                ))}

                                <div style={{ background: '#0f1f33', border: '0.5px solid rgba(155,111,228,.3)', borderRadius: 9, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                                    <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
                                    <input
                                        type="text"
                                        value={aiQuestion}
                                        onChange={e => setAiQuestion(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const q = aiQuestion.trim() || AI_PROMPTS[0];
                                                alert(`AI Pricing (preview)\n\n"${q}"\n\nConnect the AI endpoint for live pricing analysis.`);
                                            }
                                        }}
                                        placeholder={`Ask AI: '${AI_PROMPTS[0]}' · '${AI_PROMPTS[1]}'`}
                                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: 'var(--color-redwood-text-main)', fontFamily: 'inherit' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const q = aiQuestion.trim() || AI_PROMPTS[0];
                                            alert(`AI Pricing (preview)\n\n"${q}"\n\nConnect the AI endpoint for live pricing analysis.`);
                                        }}
                                        style={{ background: '#9B6FE4', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 10, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                                    >
                                        Ask →
                                    </button>
                                </div>
                                <div style={{ marginTop: 7, fontSize: 9, color: 'var(--color-redwood-text-subtle)', textAlign: 'right' }}>
                                    🔒 Data processed on-device · never leaves your account · educational use only
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'tiers' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 10 }}>
                            {PRICE_TIERS.map(tier => (
                                <div key={tier.key} style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: 14, padding: '16px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tier.stripe }} />
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: 4 }}>{tier.name}</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: tier.key === 'gold' ? 'var(--color-brand-amber-tint)' : tier.key === 'silver' ? 'var(--color-brand-blue-tint)' : 'var(--color-redwood-text-muted)', marginBottom: 10 }}>
                                        {tier.discount > 0 ? `−${tier.discount}%` : '0%'}
                                    </div>
                                    <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 12, ...tier.badgeStyle }}>
                                        {tier.badge}
                                    </span>
                                    <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 8 }}>{tierCustomers[tier.key].length} customers</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {tierCustomers[tier.key].map(name => (
                                            <span key={name} style={{ fontSize: 9, padding: '3px 8px', borderRadius: 20, background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-redwood-border)', color: 'var(--color-redwood-text-muted)' }}>
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                    {tier.key === 'gold' && (
                                        <button type="button" style={{ ...primaryBtn, marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => setActiveTab('lists')}>
                                            Manage tier assignments
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'templates' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 10 }}>
                        {[
                            { name: 'Wholesale bulk', discount: 12, products: 'All lubricants', desc: 'Volume-based pricing for distributors' },
                            { name: 'Fleet account', discount: 10, products: 'Engine oils', desc: 'Standard fleet maintenance pricing' },
                            { name: 'Retail partner', discount: 5, products: 'Consumer SKUs', desc: 'Partner store margin template' },
                        ].map(tmpl => (
                            <div key={tmpl.name} style={{ ...panelStyle, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <FileText size={16} style={{ color: '#4F8EF7' }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>{tmpl.name}</span>
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-brand-blue-tint)', marginBottom: 6 }}>−{tmpl.discount}%</div>
                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginBottom: 4 }}>{tmpl.products}</div>
                                <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>{tmpl.desc}</div>
                                <button type="button" onClick={() => setShowAdd(true)} style={{ ...ghostBtn, marginTop: 12, fontSize: 9 }}>Apply template</button>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'audit' && (
                    <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
                        {auditEntries.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-redwood-text-muted)', fontSize: 12 }}>No audit entries yet</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,.03)' }}>
                                            {['Customer', 'Action', 'By', 'Date'].map(h => (
                                                <th key={h} style={thStyle}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditEntries.map((e, i) => (
                                            <tr key={i}>
                                                <td style={tdStyle}>{e.customer}</td>
                                                <td style={tdStyle}>{e.action}</td>
                                                <td style={tdStyle}>{e.by}</td>
                                                <td style={tdStyle}>{formatDate(e.at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
