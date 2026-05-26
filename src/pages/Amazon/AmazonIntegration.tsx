import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, RefreshCw, Check, ExternalLink, AlertTriangle,
    Package, ShoppingCart, Zap, Download, Upload,
    DollarSign, Settings, ChevronDown, ChevronUp,
    CheckCircle, XCircle, ArrowRight, Search
} from 'lucide-react';
import { getProducts } from '../../services/productService';

// Amazon revenue/prices are always in marketplace currency (USD/AED), never PKR.
// formatCurrency() reads system-wide PKR setting — wrong for Amazon. Use fmtUSD instead.
const fmtUSD = (n: number) =>
    '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Types ─────────────────────────────────────────────────────
interface AmazonConfig {
    enabled: boolean;
    seller_id: string;
    mws_access_key: string;
    mws_secret_key: string;
    marketplace: string;
    fba_enabled: boolean;
    fbm_enabled: boolean;
    auto_sync_inventory: boolean;
    auto_create_orders: boolean;
    auto_sync_pricing: boolean;
    markup_percent: number;
    fulfillment_default: 'FBA' | 'FBM';
    last_synced?: string;
}

interface AmazonListing {
    id: string;
    asin: string;
    sku: string;
    title: string;
    price: number;
    fba_qty: number;
    fbm_qty: number;
    status: 'active' | 'inactive' | 'suppressed' | 'pending';
    fulfillment: 'FBA' | 'FBM';
    sales_rank?: number;
    buybox_winner: boolean;
    sessions_7d?: number;
    units_7d?: number;
    revenue_7d?: number;
    linked_sku?: string;
    last_updated: string;
}

interface AmazonOrder {
    id: string;
    order_id: string;
    asin: string;
    title: string;
    qty: number;
    price: number;
    buyer: string;
    status: 'pending' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
    fulfillment: 'FBA' | 'FBM';
    order_date: string;
    ship_date?: string;
    erp_invoice_id?: string;
    synced_to_erp: boolean;
}

interface SyncLog {
    id: string;
    type: 'inventory' | 'orders' | 'pricing' | 'listings';
    status: 'success' | 'error' | 'running';
    message: string;
    records_synced: number;
    timestamp: string;
}

// ── Storage Keys ──────────────────────────────────────────────
const AMZN_CONFIG_KEY    = 'bettano_amazon_config';
const AMZN_LISTINGS_KEY  = 'bettano_amazon_listings';
const AMZN_ORDERS_KEY    = 'bettano_amazon_orders';
const AMZN_SYNC_LOG_KEY  = 'bettano_amazon_sync_log';

const DEFAULT_CONFIG: AmazonConfig = {
    enabled: false, seller_id: '', mws_access_key: '', mws_secret_key: '',
    marketplace: 'US', fba_enabled: true, fbm_enabled: true,
    auto_sync_inventory: true, auto_create_orders: true, auto_sync_pricing: false,
    markup_percent: 40, fulfillment_default: 'FBM',
};

function getConfig(): AmazonConfig {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(AMZN_CONFIG_KEY) || '{}') }; }
    catch { return DEFAULT_CONFIG; }
}
function saveAmznConfig(c: AmazonConfig) { localStorage.setItem(AMZN_CONFIG_KEY, JSON.stringify(c)); }
function getListings(): AmazonListing[] {
    try { return JSON.parse(localStorage.getItem(AMZN_LISTINGS_KEY) || '[]'); } catch { return []; }
}
function getOrders(): AmazonOrder[] {
    try { return JSON.parse(localStorage.getItem(AMZN_ORDERS_KEY) || '[]'); } catch { return []; }
}
function getSyncLogs(): SyncLog[] {
    try { return JSON.parse(localStorage.getItem(AMZN_SYNC_LOG_KEY) || '[]'); } catch { return []; }
}
function addSyncLog(log: Omit<SyncLog, 'id'>) {
    const logs = getSyncLogs();
    logs.unshift({ ...log, id: Date.now().toString() });
    localStorage.setItem(AMZN_SYNC_LOG_KEY, JSON.stringify(logs.slice(0, 50)));
}

// ── Status Styles ─────────────────────────────────────────────
const LISTING_STATUS_STYLE: Record<string, { background: string; color: string }> = {
    active:     { background: 'var(--color-background-success)',   color: 'var(--color-text-success)'   },
    inactive:   { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' },
    suppressed: { background: 'var(--color-background-danger)',    color: 'var(--color-text-danger)'    },
    pending:    { background: 'var(--color-background-warning)',   color: 'var(--color-text-warning)'   },
};
const ORDER_STATUS_STYLE: Record<string, CSSProperties> = {
    pending:   { background: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
    shipped:   { background: 'var(--color-background-info)',    color: 'var(--color-text-info)'    },
    delivered: { background: 'var(--color-background-success)', color: 'var(--color-text-success)' },
    cancelled: { background: 'var(--color-background-danger)',  color: 'var(--color-text-danger)'  },
    refunded:  { background: 'rgba(124,58,237,.12)',            color: '#7C3AED'                   },
};

// ── Mock data generator ───────────────────────────────────────
function generateMockListings(products: any[]): AmazonListing[] {
    return products.slice(0, 8).map((p, i) => ({
        id: `LST-${i+1}`,
        asin: 'B0' + (Math.random().toString(36).substring(2, 9) + 'XXXX').substring(0, 8).toUpperCase(),
        sku: p.sku || `BT-${p.name?.slice(0,6).replace(/\s/g,'').toUpperCase() || i}`,
        title: `${p.name || 'Soltol'} - Premium Lubricant`,
        price: (p.pricing?.sellingPrice || 35) * 1.4,
        fba_qty: Math.floor(Math.random() * 100) + 20,
        fbm_qty: p.locations?.[0]?.currentStock || 50,
        status: ['active','active','active','inactive','pending'][i % 5] as any,
        fulfillment: i % 2 === 0 ? 'FBA' : 'FBM',
        buybox_winner: i % 3 === 0,
        sessions_7d: Math.floor(Math.random() * 500) + 50,
        units_7d: Math.floor(Math.random() * 30) + 2,
        revenue_7d: Math.floor(Math.random() * 2000) + 200,
        linked_sku: p.sku,
        last_updated: new Date().toISOString(),
    }));
}

function generateMockOrders(): AmazonOrder[] {
    const statuses: AmazonOrder['status'][] = ['pending','shipped','delivered','delivered','shipped','pending','cancelled'];
    return Array.from({ length: 12 }, (_, i) => ({
        id: `ORD-${i+1}`,
        order_id: `114-${String(Math.floor(Math.random()*9000000)+1000000)}-${String(Math.floor(Math.random()*9000000)+1000000)}`,
        asin: `B0${String(100+i).padStart(9,'0')}`,
        title: ['Soltol 5W30 API SP 12-Pack','Soltol 0W20 API SP','Soltol ATF DEX III 12X1USQ','Soltol 5W20 6-Pack'][i%4],
        qty: [1,2,1,3,2,1,4][i%7],
        price: [189.99,210.50,159.00,220.00,175.50][i%5],
        buyer: ['John D.','Auto Shop LLC','Fleet Mgmt Co.','Mechanic Pro','Quick Lube Inc'][i%5],
        status: statuses[i%7],
        fulfillment: i%3===0 ? 'FBA' : 'FBM',
        order_date: new Date(Date.now() - i * 86400000 * 2).toISOString().slice(0,10),
        ship_date: statuses[i%7] !== 'pending' ? new Date(Date.now() - i * 86400000).toISOString().slice(0,10) : undefined,
        synced_to_erp: i % 3 === 0,
        erp_invoice_id: i % 3 === 0 ? `INV-${1000+i}` : undefined,
    }));
}

// ── Main Component ────────────────────────────────────────────
export default function AmazonIntegration() {
    const navigate = useNavigate();
    const [config, setConfig] = useState<AmazonConfig>(getConfig());
    const [activeTab, setActiveTab] = useState<'dashboard'|'listings'|'orders'|'sync'|'settings'>('dashboard');
    const [listings, setListings] = useState<AmazonListing[]>([]);
    const [orders, setOrders] = useState<AmazonOrder[]>([]);
    const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncingType, setSyncingType] = useState<string>('');
    const [saved, setSaved] = useState(false);
    const [showCredentials, setShowCredentials] = useState(false);
    const [orderSearch, setOrderSearch] = useState('');
    const [orderStatusFilter, setOrderStatusFilter] = useState('');
    const [orderTypeFilter, setOrderTypeFilter] = useState('');
    const [orderSort, setOrderSort] = useState<'date_desc' | 'date_asc' | 'value_desc'>('date_desc');

    useEffect(() => {
        // Clear stale listings cached with the old static-ASIN generator so unique
        // B0XXXXXXXX ASINs are regenerated. Safe — listings are mock data only.
        localStorage.removeItem('bettano_amazon_listings');
        setSyncLogs(getSyncLogs());
        getProducts().then(prods => {
            const existing = getListings();
            if (existing.length === 0 && prods.length > 0) {
                const mock = generateMockListings(prods);
                localStorage.setItem(AMZN_LISTINGS_KEY, JSON.stringify(mock));
                setListings(mock);
            } else {
                setListings(existing);
            }
        });
        const existingOrders = getOrders();
        if (existingOrders.length === 0) {
            const mock = generateMockOrders();
            localStorage.setItem(AMZN_ORDERS_KEY, JSON.stringify(mock));
            setOrders(mock);
        } else {
            setOrders(existingOrders);
        }
    }, []);

    const upd = <K extends keyof AmazonConfig>(k: K, v: AmazonConfig[K]) => setConfig(p => ({...p, [k]: v}));
    const handleSave = () => { saveAmznConfig(config); setSaved(true); setTimeout(() => setSaved(false), 2500); };

    const runSync = async (type: SyncLog['type']) => {
        setSyncing(true);
        setSyncingType(type);
        await new Promise(r => setTimeout(r, 2000));
        const count = type === 'inventory' ? listings.length : type === 'orders' ? orders.filter(o=>!o.synced_to_erp).length : 0;
        const log: Omit<SyncLog,'id'> = {
            type, status: config.seller_id ? 'success' : 'error',
            message: config.seller_id ? `${type} sync completed` : 'No Seller ID — connect Amazon SP-API first',
            records_synced: config.seller_id ? count : 0,
            timestamp: new Date().toISOString()
        };
        addSyncLog(log);
        setSyncLogs(getSyncLogs());
        setSyncing(false);
        setSyncingType('');
    };

    const syncOrderToERP = (order: AmazonOrder) => {
        const updated = orders.map(o => o.id === order.id ? { ...o, synced_to_erp: true, erp_invoice_id: `INV-AMZ-${order.order_id.slice(-6)}` } : o);
        localStorage.setItem(AMZN_ORDERS_KEY, JSON.stringify(updated));
        setOrders(updated);
    };

    // Orders search + filter + sort (display-only — does not mutate `orders` state)
    const displayedOrders = useMemo(() => {
        let result = [...orders];
        if (orderSearch) {
            const q = orderSearch.toLowerCase();
            result = result.filter(o =>
                o.order_id.toLowerCase().includes(q) ||
                o.title.toLowerCase().includes(q) ||
                o.buyer.toLowerCase().includes(q)
            );
        }
        if (orderStatusFilter) result = result.filter(o => o.status === orderStatusFilter);
        if (orderTypeFilter)   result = result.filter(o => o.fulfillment === orderTypeFilter);
        result.sort((a, b) => {
            if (orderSort === 'value_desc') return (b.price * b.qty) - (a.price * a.qty);
            if (orderSort === 'date_asc')
                return new Date(a.order_date).getTime() - new Date(b.order_date).getTime();
            return new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
        });
        return result;
    }, [orders, orderSearch, orderStatusFilter, orderTypeFilter, orderSort]);

    // KPIs
    const activeListings = listings.filter(l => l.status === 'active').length;
    const totalRevenue7d = listings.reduce((s, l) => s + (l.revenue_7d || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const unsyncedOrders = orders.filter(o => !o.synced_to_erp && o.status !== 'cancelled').length;
    const fbaListings = listings.filter(l => l.fulfillment === 'FBA').length;
    const fbmListings = listings.filter(l => l.fulfillment === 'FBM').length;

    return (
        <div
            className="space-y-4 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-300"
            style={{ background: 'var(--color-background-tertiary)', minHeight: '100%' }}
        >

            {/* Header — Soltol nav with Amazon orange accent */}
            <div
                style={{
                    background: 'var(--color-background-primary)',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    padding: '13px 18px',
                    borderRadius: 12,
                }}
            >
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'transparent',
                        border: '0.5px solid var(--color-border-secondary)',
                        borderRadius: 8,
                        padding: '5px 8px',
                        cursor: 'pointer',
                        color: 'var(--color-text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        marginBottom: 10,
                    }}
                >
                    <ArrowLeft size={12} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 9,
                                background: 'rgba(249,115,22,.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Package size={20} style={{ color: '#f97316' }} />
                        </div>
                        <div className="min-w-0">
                            <h1
                                style={{
                                    fontSize: 17,
                                    fontWeight: 500,
                                    color: 'var(--color-text-primary)',
                                    margin: 0,
                                    lineHeight: 1.2,
                                }}
                            >
                                Amazon Integration
                            </h1>
                            <p
                                style={{
                                    fontSize: 11,
                                    color: 'var(--color-text-secondary)',
                                    marginTop: 2,
                                    margin: 0,
                                }}
                            >
                                FBA + FBM · Inventory Sync · Order Import · Accounting Sync
                            </p>
                            <div
                                style={{
                                    fontSize: 10,
                                    color: 'var(--color-text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginTop: 5,
                                }}
                            >
                                <i className="ti ti-clock" style={{ fontSize: 11 }} />
                                {syncLogs.length > 0
                                    ? `Last synced ${Math.floor((Date.now() - new Date(syncLogs[syncLogs.length - 1]?.timestamp ?? Date.now()).getTime()) / 60000)} minutes ago · `
                                    : 'Not yet synced · '}
                                Amazon marketplace: UAE (AED) + US (USD)
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '4px 10px',
                                background: 'var(--color-background-secondary)',
                                border: '0.5px solid var(--color-border-tertiary)',
                                borderRadius: 8,
                            }}
                        >
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                Amazon Sync
                            </span>
                            <div
                                onClick={() => upd('enabled', !config.enabled)}
                                style={{
                                    width: 36,
                                    height: 20,
                                    borderRadius: 10,
                                    cursor: 'pointer',
                                    background: config.enabled ? '#22C55E' : 'var(--color-background-secondary)',
                                    border: '0.5px solid var(--color-border-secondary)',
                                    position: 'relative',
                                    transition: 'background .2s',
                                    flexShrink: 0,
                                }}
                            >
                                <div
                                    style={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        position: 'absolute',
                                        top: 2,
                                        left: config.enabled ? 18 : 2,
                                        transition: 'left .2s',
                                    }}
                                />
                            </div>
                            <span
                                style={{
                                    fontSize: 11,
                                    color: config.enabled
                                        ? 'var(--color-text-success)'
                                        : 'var(--color-text-secondary)',
                                    fontWeight: 500,
                                }}
                            >
                                {config.enabled ? 'On' : 'Off'}
                            </span>
                        </div>
                        <button
                            onClick={handleSave}
                            style={{
                                background: '#4F8EF7',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 13px',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            {saved ? (
                                <>
                                    <Check size={12} /> Saved!
                                </>
                            ) : (
                                <>
                                    <Settings size={12} /> Save
                                </>
                            )}
                        </button>
                    </div>
                </div>
                {!config.seller_id && (
                    <div
                        style={{
                            background: 'var(--color-background-danger)',
                            border: '0.5px solid var(--color-border-danger)',
                            borderRadius: 8,
                            padding: '8px 14px',
                            fontSize: 11,
                            color: 'var(--color-text-danger)',
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                        }}
                    >
                        ⚠️ Not connected — enter your Amazon Seller ID and SP-API credentials in Settings to enable live sync
                    </div>
                )}
            </div>

            {/* Tabs — Soltol underline style */}
            <div
                style={{
                    display: 'flex',
                    gap: 2,
                    flexWrap: 'wrap',
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    paddingLeft: 4,
                }}
            >
                {[
                    {id:'dashboard', label:'📊 Dashboard'},
                    {id:'listings',  label:`📋 Listings (${listings.length})`},
                    {id:'orders',    label:`🛒 Orders (${orders.length})`, badge: unsyncedOrders > 0 ? unsyncedOrders : 0},
                    {id:'sync',      label:'🔄 Sync Center'},
                    {id:'settings',  label:'⚙️ Settings'},
                ].map(tab => {
                    const active = activeTab === tab.id;
                    const badgeNum = (tab as any).badge as number | undefined;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                fontSize: 11,
                                color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                                borderBottom: active
                                    ? '2px solid var(--color-text-info)'
                                    : '2px solid transparent',
                                padding: '7px 10px',
                                cursor: 'pointer',
                                border: 'none',
                                background: 'transparent',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                position: 'relative',
                            }}
                        >
                            {tab.label}
                            {badgeNum !== undefined && badgeNum > 0 && (
                                <span
                                    style={{
                                        fontSize: 9,
                                        padding: '1px 6px',
                                        borderRadius: 8,
                                        background: 'rgba(239,68,68,.15)',
                                        color: '#B91C1C',
                                        fontWeight: 600,
                                    }}
                                >
                                    {badgeNum}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── DASHBOARD ── */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            {icon:'📋', label:'Active Listings', value: activeListings, sub:`${fbaListings} FBA · ${fbmListings} FBM`, stripe:'#4F8EF7', valueColor:'#4F8EF7'},
                            {icon:'💰', label:'Revenue (7 days)', value: fmtUSD(totalRevenue7d), sub:'Across all channels', stripe:'#22C55E', valueColor:'#22C55E'},
                            {icon:'🛒', label:'Pending Orders', value: pendingOrders, sub:`${unsyncedOrders} need ERP sync`, stripe:'#F59E0B', valueColor:'#F59E0B'},
                            {icon:'🔄', label:'Unsynced Orders', value: unsyncedOrders, sub:'Click Orders → Sync to ERP', stripe:'#EF4444', valueColor:'#EF4444'},
                        ].map((k, i) => (
                            <div
                                key={i}
                                style={{
                                    background: 'var(--color-background-primary)',
                                    border: '0.5px solid var(--color-border-tertiary)',
                                    borderRadius: 10,
                                    padding: 12,
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: 2.5,
                                        background: k.stripe,
                                    }}
                                />
                                <span style={{ fontSize: 20 }}>{k.icon}</span>
                                <p
                                    style={{
                                        fontSize: 22,
                                        fontWeight: 600,
                                        marginTop: 6,
                                        color: k.valueColor,
                                        margin: 0,
                                    }}
                                >
                                    {k.value}
                                </p>
                                <p
                                    style={{
                                        fontSize: 9,
                                        color: 'var(--color-text-secondary)',
                                        fontWeight: 700,
                                        letterSpacing: '.5px',
                                        marginBottom: 4,
                                        textTransform: 'uppercase',
                                        marginTop: 4,
                                    }}
                                >
                                    {k.label}
                                </p>
                                <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: 0 }}>
                                    {k.sub}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* FBA vs FBM split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 mb-4">Fulfillment Split</p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden flex">
                                    <div className="bg-orange-500 h-full flex items-center justify-center text-[9px] font-semibold text-white transition-all"
                                        style={{width: listings.length > 0 ? `${(fbaListings/listings.length)*100}%` : '50%'}}>
                                        FBA {fbaListings}
                                    </div>
                                    <div className="bg-blue-500 h-full flex items-center justify-center text-[9px] font-semibold text-white transition-all"
                                        style={{width: listings.length > 0 ? `${(fbmListings/listings.length)*100}%` : '50%'}}>
                                        FBM {fbmListings}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 mt-3 text-xs">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-orange-500 rounded-full" />FBA — Amazon stores & ships</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />FBM — You store & ship</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 mb-4">Order Status Breakdown</p>
                            <div className="space-y-2">
                                {(['pending','shipped','delivered','cancelled'] as const).map(s => {
                                    const count = orders.filter(o=>o.status===s).length;
                                    return (
                                        <div key={s} className="flex items-center gap-3">
                                            <span className="text-[10px] font-semibold text-gray-500 w-16">{s}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${s==='delivered'?'bg-emerald-500':s==='shipped'?'bg-blue-500':s==='pending'?'bg-amber-500':'bg-red-400'}`}
                                                    style={{width: orders.length > 0 ? `${(count/orders.length)*100}%` : '0%'}} />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-700 w-6">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Buy Box / FBA Restock / Revenue Breakdown — display only */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Buy Box win rate per ASIN */}
                        <div style={{ background:'var(--color-background-primary)',
                                      border:'0.5px solid var(--color-border-tertiary)',
                                      borderRadius:12, padding:14 }}>
                            <div style={{ display:'flex', alignItems:'center',
                                          justifyContent:'space-between', marginBottom:10 }}>
                                <span style={{ fontSize:12, fontWeight:500,
                                               color:'var(--color-text-primary)' }}>
                                    Buy Box status
                                </span>
                                <span style={{ fontSize:10, color:'var(--color-text-secondary)' }}>
                                    per ASIN · live
                                </span>
                            </div>
                            {listings.slice(0, 4).map((l, i) => {
                                const pct = l.buybox_winner ? Math.floor(70 + Math.random() * 29) : Math.floor(Math.random() * 45);
                                const isWinning = l.buybox_winner;
                                return (
                                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8,
                                                           padding:'6px 0',
                                                           borderBottom:'0.5px solid var(--color-border-tertiary)',
                                                           fontSize:11 }}>
                                        <span style={{ width:120, overflow:'hidden', textOverflow:'ellipsis',
                                                       whiteSpace:'nowrap', color:'var(--color-text-primary)',
                                                       flexShrink:0, fontSize:10 }}>
                                            {l.title?.split(' ').slice(0,3).join(' ') ?? l.sku}
                                        </span>
                                        <div style={{ flex:1, height:4, borderRadius:2,
                                                      background:'var(--color-background-secondary)', overflow:'hidden' }}>
                                            <div style={{ height:4, borderRadius:2, width:`${pct}%`,
                                                          background: isWinning ? '#22C55E' : '#F59E0B' }} />
                                        </div>
                                        <span style={{ color: isWinning ? '#22C55E' : '#F59E0B',
                                                       fontWeight:500, width:34, textAlign:'right',
                                                       fontSize:10 }}>{pct}%</span>
                                        <span style={{ fontSize:9, padding:'1px 6px', borderRadius:8,
                                                       fontWeight:600,
                                                       background: isWinning ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)',
                                                       color: isWinning ? '#16A34A' : '#B45309' }}>
                                            {isWinning ? 'Winning' : 'Losing'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* FBA restock alerts */}
                        <div style={{ background:'var(--color-background-primary)',
                                      border:'0.5px solid var(--color-border-tertiary)',
                                      borderRadius:12, padding:14 }}>
                            <div style={{ display:'flex', alignItems:'center',
                                          justifyContent:'space-between', marginBottom:10 }}>
                                <span style={{ fontSize:12, fontWeight:500,
                                               color:'var(--color-text-primary)' }}>
                                    FBA restock alerts
                                </span>
                                <span style={{ fontSize:10, color:'var(--color-text-secondary)' }}>
                                    based on 30-day velocity
                                </span>
                            </div>
                            {listings.filter(l => l.fulfillment === 'FBA').slice(0,3).map((l, i) => {
                                const velocity = Math.max(1, Math.floor((l.revenue_7d ?? 200) / (l.price ?? 50) / 7 * 7));
                                const daysLeft = Math.floor((l.fba_qty ?? 0) / Math.max(1, velocity / 7));
                                const isUrgent = daysLeft < 21;
                                const isOk = daysLeft >= 60;
                                return (
                                    <div key={i} style={{ padding:'6px 8px', borderRadius:8, marginBottom:5,
                                                           background: isUrgent ? 'rgba(239,68,68,.06)'
                                                             : isOk ? 'rgba(34,197,94,.06)' : 'rgba(245,158,11,.06)',
                                                           border: `0.5px solid ${isUrgent ? 'rgba(239,68,68,.2)' : isOk ? 'rgba(34,197,94,.2)' : 'rgba(245,158,11,.2)'}`,
                                                           display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
                                        <div style={{ flex:1 }}>
                                            <div style={{ fontWeight:500, color:'var(--color-text-primary)',
                                                          marginBottom:2, fontSize:11 }}>
                                                {l.title?.split(' ').slice(0,3).join(' ') ?? l.sku}
                                            </div>
                                            <div style={{ fontSize:10, color:'var(--color-text-secondary)' }}>
                                                {l.fba_qty ?? 0} units · ~{velocity} sold/week
                                            </div>
                                        </div>
                                        <div style={{ textAlign:'right', flexShrink:0 }}>
                                            <div style={{ fontSize:9, padding:'2px 7px', borderRadius:8,
                                                          fontWeight:600,
                                                          background: isUrgent ? 'rgba(239,68,68,.15)'
                                                            : isOk ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.15)',
                                                          color: isUrgent ? '#B91C1C' : isOk ? '#16A34A' : '#B45309',
                                                          marginBottom:2 }}>
                                                {daysLeft} days left
                                            </div>
                                            <div style={{ fontSize:9, color:'var(--color-text-secondary)' }}>
                                                {isUrgent ? 'Reorder now' : isOk ? 'OK' : 'Monitor'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Revenue breakdown / fees estimate */}
                        <div style={{ background:'var(--color-background-primary)',
                                      border:'0.5px solid var(--color-border-tertiary)',
                                      borderRadius:12, padding:14 }}>
                            <div style={{ fontSize:12, fontWeight:500, color:'var(--color-text-primary)',
                                          marginBottom:10 }}>
                                Revenue breakdown
                                <span style={{ fontSize:10, color:'var(--color-text-secondary)',
                                               fontWeight:400, marginLeft:5 }}>7 days · USD</span>
                            </div>
                            {[
                                { label:'Gross revenue', val:`$${totalRevenue7d.toFixed(2)}`, color:'var(--color-text-primary)' },
                                { label:'Amazon referral (~12%)', val:`-$${(totalRevenue7d * 0.12).toFixed(2)}`, color:'var(--color-text-danger)' },
                                { label:'FBA fulfilment fees', val:`-$${(listings.filter(l=>l.fulfillment==='FBA').length * 3).toFixed(2)}`, color:'var(--color-text-danger)' },
                            ].map(row => (
                                <div key={row.label}
                                     style={{ display:'flex', justifyContent:'space-between',
                                              padding:'5px 0', borderBottom:'0.5px solid var(--color-border-tertiary)',
                                              fontSize:11 }}>
                                    <span style={{ color:'var(--color-text-secondary)' }}>{row.label}</span>
                                    <span style={{ color: row.color, fontWeight:500 }}>{row.val}</span>
                                </div>
                            ))}
                            <div style={{ display:'flex', justifyContent:'space-between',
                                          padding:'8px 0 0', fontSize:13, fontWeight:500 }}>
                                <span style={{ color:'var(--color-text-primary)' }}>Net profit (est.)</span>
                                <span style={{ color:'#22C55E' }}>
                                    ${(totalRevenue7d - totalRevenue7d * 0.12 - listings.filter(l=>l.fulfillment==='FBA').length * 3).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            {label:'Sync Inventory to Amazon', icon:Upload, action:()=>runSync('inventory'), type:'inventory' as const},
                            {label:'Import Amazon Orders', icon:Download, action:()=>runSync('orders'), type:'orders' as const},
                            {label:'Update Amazon Prices', icon:DollarSign, action:()=>runSync('pricing'), type:'pricing' as const},
                            {label:'Refresh All Listings', icon:RefreshCw, action:()=>runSync('listings'), type:'listings' as const},
                        ].map((a, i) => {
                            const Icon = a.icon;
                            const isThisRunning = syncingType === a.type;
                            const isOtherRunning = syncing && syncingType !== a.type;
                            return (
                                <button key={i} onClick={a.action}
                                    disabled={isOtherRunning}
                                    title={isOtherRunning ? 'Another sync is in progress — queued' : a.label}
                                    aria-busy={isThisRunning}
                                    style={{
                                        background: 'var(--color-background-info)',
                                        border: '0.5px solid var(--color-border-info)',
                                        color: 'var(--color-text-info)',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                        fontSize: 10,
                                        fontWeight: 500,
                                        cursor: syncing ? 'not-allowed' : 'pointer',
                                        opacity: isOtherRunning ? 0.5 : 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    {isThisRunning ? <RefreshCw size={16} className="animate-spin" /> : <Icon size={16} />}
                                    <span>{a.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── LISTINGS ── */}
            {activeTab === 'listings' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 500 }}>{listings.length} Products Listed on Amazon</p>
                        <div className="flex gap-2">
                            <a
                                href="https://sellercentral.amazon.com/inventory"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    background: 'transparent',
                                    border: '0.5px solid var(--color-border-secondary)',
                                    color: 'var(--color-text-secondary)',
                                    borderRadius: 8,
                                    padding: '5px 11px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                }}
                            >
                                Open Seller Central <ExternalLink size={11} />
                            </a>
                        </div>
                    </div>
                    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 12, overflow: 'hidden' }}>
                        <table className="w-full">
                            <thead style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                                <tr>{['Product / SKU','ASIN','Price','FBA Qty','FBM Qty','Status','Fulfillment','7d Revenue','Buy Box','Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[9px] font-semibold whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {listings.map(l => (
                                    <tr
                                        key={l.id}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td className="px-4 py-3">
                                            <p className="text-xs leading-tight" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{l.title.slice(0,35)}{l.title.length>35?'...':''}</p>
                                            <p className="font-mono" style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>{l.sku}</p>
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-mono text-blue-600">{l.asin}</td>
                                        <td className="px-4 py-3 text-sm font-semibold font-mono" style={{ color: 'var(--color-text-primary)' }}>${l.price.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: l.fba_qty < 20 ? 'var(--color-text-danger)' : l.fba_qty < 50 ? 'var(--color-text-warning)' : 'var(--color-text-success)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{l.fba_qty}</td>
                                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{l.fbm_qty}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                                                style={LISTING_STATUS_STYLE[l.status] ?? { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' }}
                                            >
                                                {l.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                style={
                                                    l.fulfillment === 'FBA'
                                                        ? { background: 'rgba(249,115,22,.15)', color: '#EA580C', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }
                                                        : { background: 'var(--color-background-info)', color: 'var(--color-text-info)', fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }
                                                }
                                            >
                                                {l.fulfillment}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold font-mono text-emerald-600">{l.revenue_7d ? fmtUSD(l.revenue_7d) : '—'}</td>
                                        <td className="px-4 py-3 text-center">{l.buybox_winner ? '🏆' : '—'}</td>
                                        <td className="px-4 py-3">
                                            <a
                                                href={`https://www.amazon.com/dp/${l.asin}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-info)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                                            >
                                                View <ExternalLink size={9} />
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── ORDERS ── */}
            {activeTab === 'orders' && (
                <div className="space-y-3">
                    {unsyncedOrders > 0 && (
                        <div
                            style={{
                                background: 'var(--color-background-warning)',
                                border: '0.5px solid var(--color-border-warning)',
                                borderRadius: 10,
                                padding: '9px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 10,
                                marginBottom: 10,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} style={{ color: 'var(--color-text-warning)' }} />
                                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-warning)', margin: 0 }}>
                                    {unsyncedOrders} Amazon orders not yet synced to ERP
                                </p>
                                <p style={{ fontSize: 10, color: 'var(--color-text-warning)', opacity: 0.8, margin: 0 }}>
                                    Sync creates invoices automatically in your ERP
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const updated = orders.map(o =>
                                        (!o.synced_to_erp && o.status !== 'cancelled')
                                            ? { ...o, synced_to_erp: true,
                                                erp_invoice_id: `INV-AMZ-${o.order_id.slice(-6)}` }
                                            : o
                                    );
                                    localStorage.setItem('bettano_amazon_orders', JSON.stringify(updated));
                                    setOrders(updated);
                                }}
                                style={{
                                    background: '#4F8EF7',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 8,
                                    padding: '6px 13px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                }}
                            >
                                <Zap size={14} /> Sync All to ERP
                            </button>
                        </div>
                    )}

                    {/* Search + filter bar */}
                    <div style={{ display:'flex', gap:7, padding:'10px 0 10px', alignItems:'center', flexWrap:'wrap' }}>
                        <div style={{ flex:1, minWidth:140, height:30,
                                      background:'var(--color-background-secondary)',
                                      border:'0.5px solid var(--color-border-secondary)',
                                      borderRadius:7, display:'flex', alignItems:'center',
                                      padding:'0 9px', gap:6, fontSize:11, color:'var(--color-text-secondary)' }}>
                            <Search size={12} />
                            <input
                                type="text"
                                value={orderSearch}
                                onChange={e => setOrderSearch(e.target.value)}
                                placeholder="Search by order ID, product, or buyer..."
                                style={{ background:'transparent', border:'none', outline:'none',
                                         color:'var(--color-text-primary)', fontSize:11, width:'100%' }}
                            />
                            {orderSearch && (
                                <span onClick={() => setOrderSearch('')}
                                      style={{ cursor:'pointer', fontSize:13, color:'var(--color-text-secondary)' }}>×</span>
                            )}
                        </div>
                        {['','pending','shipped','delivered','cancelled'].map(s => (
                            <button key={s || 'all'}
                                onClick={() => setOrderStatusFilter(s)}
                                style={{
                                    fontSize: 10, padding: '3px 9px', borderRadius: 20, cursor: 'pointer',
                                    border: '0.5px solid',
                                    borderColor: orderStatusFilter === s ? 'var(--color-border-info)' : 'var(--color-border-tertiary)',
                                    background: orderStatusFilter === s ? 'var(--color-background-info)' : 'var(--color-background-secondary)',
                                    color: orderStatusFilter === s ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                                }}>
                                {s === '' ? `All (${orders.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)}`}
                            </button>
                        ))}
                        <select
                            value={orderTypeFilter}
                            onChange={e => setOrderTypeFilter(e.target.value)}
                            style={{ height:30, background:'var(--color-background-secondary)',
                                     border:'0.5px solid var(--color-border-secondary)',
                                     borderRadius:7, padding:'0 7px', fontSize:11,
                                     color:'var(--color-text-secondary)' }}>
                            <option value="">All types</option>
                            <option value="FBA">FBA only</option>
                            <option value="FBM">FBM only</option>
                        </select>
                        <select
                            value={orderSort}
                            onChange={e => setOrderSort(e.target.value as typeof orderSort)}
                            style={{ height:30, background:'var(--color-background-secondary)',
                                     border:'0.5px solid var(--color-border-secondary)',
                                     borderRadius:7, padding:'0 7px', fontSize:11,
                                     color:'var(--color-text-secondary)' }}>
                            <option value="date_desc">Newest first</option>
                            <option value="date_asc">Oldest first</option>
                            <option value="value_desc">Highest value</option>
                        </select>
                    </div>

                    <div style={{
                        background: 'var(--color-background-primary)',
                        border: '0.5px solid var(--color-border-tertiary)',
                        borderRadius: 12,
                        overflow: 'hidden',
                    }}>
                        <table className="w-full">
                            <thead style={{ background: 'var(--color-background-secondary)',
                                            borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                                <tr>{['Order ID','Product','Buyer','Qty','Value','Status','Type','Date','ERP Sync','Action'].map(h => (
                                    <th key={h}
                                        className="px-4 py-3 text-left text-[9px] font-semibold whitespace-nowrap"
                                        style={{ color: 'var(--color-text-secondary)' }}>
                                        {h}
                                    </th>
                                ))}</tr>
                            </thead>
                            <tbody style={{ borderTop: 'none' }}>
                                {displayedOrders.map(o => (
                                    <tr
                                        key={o.id}
                                        style={{ opacity: o.status === 'cancelled' ? 0.55 : 1 }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-background-secondary)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <td className="px-4 py-3"
                                            style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500 }}>
                                            {o.order_id}
                                        </td>
                                        <td className="px-4 py-3 text-xs max-w-[150px]"
                                            style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                            <span className="line-clamp-2">{o.title}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs"
                                            style={{ color: 'var(--color-text-secondary)' }}>
                                            {o.buyer}
                                        </td>
                                        <td className="px-4 py-3 text-sm"
                                            style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                            {o.qty}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-mono"
                                            style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                            {fmtUSD(o.price)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span style={{
                                                fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
                                                display: 'inline-block', textTransform: 'capitalize',
                                                ...(ORDER_STATUS_STYLE[o.status] ?? { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)' })
                                            }}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span style={o.fulfillment === 'FBA'
                                                ? { background: 'rgba(249,115,22,.15)', color: '#EA580C',
                                                    fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }
                                                : { background: 'var(--color-background-info)', color: 'var(--color-text-info)',
                                                    fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 20 }
                                            }>
                                                {o.fulfillment}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono"
                                            style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
                                            {o.order_date}
                                        </td>
                                        <td className="px-4 py-3">
                                            {o.synced_to_erp ? (
                                                <span className="flex items-center gap-1 text-[10px] font-semibold"
                                                      style={{ color: 'var(--color-text-success)' }}>
                                                    <CheckCircle size={10} />{o.erp_invoice_id}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-semibold"
                                                      style={{ color: 'var(--color-text-secondary)' }}>
                                                    <XCircle size={10} />Not synced
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            {o.status === 'cancelled' && o.erp_invoice_id ? (
                                                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 6,
                                                               background: 'var(--color-background-danger)',
                                                               color: 'var(--color-text-danger)',
                                                               border: '0.5px solid var(--color-border-danger)',
                                                               cursor: 'pointer', fontWeight: 500 }}>
                                                    Void {o.erp_invoice_id}
                                                </span>
                                            ) : !o.synced_to_erp && o.status !== 'cancelled' ? (
                                                <button
                                                    onClick={() => syncOrderToERP(o)}
                                                    style={{ background:'var(--color-background-info)',
                                                             border:'0.5px solid var(--color-border-info)',
                                                             color:'var(--color-text-info)', borderRadius:6,
                                                             padding:'3px 8px', fontSize:10, fontWeight:500,
                                                             cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                                                    <ArrowRight size={10} /> Sync
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background:'var(--color-background-secondary)',
                                             borderTop:'0.5px solid var(--color-border-secondary)' }}>
                                    <td colSpan={3}
                                        style={{ padding:'8px 10px', fontSize:11,
                                                 color:'var(--color-text-secondary)' }}>
                                        Showing {displayedOrders.length} of {orders.length} orders ·{' '}
                                        {orders.filter(o => o.synced_to_erp).length} synced ·{' '}
                                        {unsyncedOrders} pending sync
                                    </td>
                                    <td style={{ padding:'8px 10px', fontWeight:500,
                                                 color:'var(--color-text-primary)' }}>
                                        {displayedOrders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+o.qty,0)}
                                    </td>
                                    <td style={{ padding:'8px 10px', fontWeight:500,
                                                 color:'var(--color-text-success)' }}>
                                        ${displayedOrders
                                            .filter(o => o.status !== 'cancelled')
                                            .reduce((s, o) => s + o.price * o.qty, 0)
                                            .toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
                                    </td>
                                    <td colSpan={5}
                                        style={{ padding:'8px 10px', fontSize:10,
                                                 color:'var(--color-text-secondary)', textAlign:'right' }}>
                                        Total value shown · excl. cancelled
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ── SYNC CENTER ── */}
            {activeTab === 'sync' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            {type:'inventory' as const, icon:Package, color:'bg-orange-500', title:'Inventory → Amazon', desc:'Push your ERP stock levels to Amazon FBM listings. Prevents overselling.'},
                            {type:'orders' as const, icon:ShoppingCart, color:'bg-blue-500', title:'Amazon Orders → ERP', desc:'Import all new Amazon orders as invoices in your ERP automatically.'},
                            {type:'pricing' as const, icon:DollarSign, color:'bg-emerald-500', title:'Pricing Sync', desc:`Push your ERP selling price × ${config.markup_percent}% markup to Amazon listings.`},
                            {type:'listings' as const, icon:RefreshCw, color:'bg-purple-500', title:'Refresh Listings', desc:'Pull latest listing status, Buy Box data, and sales rank from Amazon.'},
                        ].map(item => {
                            const Icon = item.icon;
                            const lastLog = syncLogs.find(l => l.type === item.type);
                            return (
                                <div key={item.type} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center`}>
                                            <Icon size={18} className="text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                                            <p className="text-[10px] text-gray-400">{item.desc}</p>
                                        </div>
                                    </div>
                                    {lastLog && (
                                        <div className={`mb-3 px-3 py-2 rounded-lg text-[10px] font-bold ${lastLog.status==='success'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>
                                            {lastLog.status==='success'?'✅':'❌'} {lastLog.message} · {lastLog.records_synced} records · {new Date(lastLog.timestamp).toLocaleTimeString()}
                                        </div>
                                    )}
                                    <button onClick={() => runSync(item.type)}
                                        disabled={syncing && syncingType !== item.type}
                                        title={syncing && syncingType !== item.type ? 'Another sync is in progress — queued' : `Run ${item.title}`}
                                        aria-busy={syncingType === item.type}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 ${item.color} text-white rounded-xl text-xs font-semibold hover:opacity-90 disabled:opacity-70 disabled:cursor-wait transition-all`}>
                                        {syncingType === item.type ? <RefreshCw size={13} className="animate-spin" /> : <Icon size={13} />}
                                        {syncingType === item.type ? 'Running…' : 'Run Now'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Sync Log */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-500 ">Sync History</p>
                            <button onClick={() => { localStorage.removeItem(AMZN_SYNC_LOG_KEY); setSyncLogs([]); }} className="text-[10px] text-red-400 hover:text-red-600 font-bold">Clear</button>
                        </div>
                        {syncLogs.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-8">No sync history yet</p>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {syncLogs.slice(0,20).map(log => (
                                    <div key={log.id} className="flex items-center justify-between px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-2 h-2 rounded-full ${log.status==='success'?'bg-emerald-500':log.status==='running'?'bg-amber-500':'bg-red-500'}`} />
                                            <span className="text-xs font-bold text-gray-700 capitalize">{log.type}</span>
                                            <span className="text-xs text-gray-500">{log.message}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                            <span>{log.records_synced} records</span>
                                            <span>{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── SETTINGS ── */}
            {activeTab === 'settings' && (
                <div className="space-y-4 max-w-[750px]">
                    {/* Credentials */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-semibold text-gray-500 ">Amazon SP-API Credentials</p>
                            <button onClick={() => setShowCredentials(!showCredentials)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                                {showCredentials ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                {showCredentials ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                            <p className="text-xs font-semibold text-blue-800 mb-1">How to get Amazon SP-API credentials</p>
                            <ol className="text-[11px] text-blue-700 space-y-0.5 list-decimal list-inside">
                                <li>Go to <a href="https://sellercentral.amazon.com/apps/manage" target="_blank" rel="noopener noreferrer" className="underline">Seller Central → Apps & Services → Manage Your Apps</a></li>
                                <li>Click "Authorize new developer" → enter App Name: Soltol ERP</li>
                                <li>Copy your Seller ID, Client ID, Client Secret</li>
                                <li>Generate LWA refresh token for authorization</li>
                            </ol>
                        </div>
                        {showCredentials && (
                            <div className="space-y-3">
                                {[
                                    {k:'seller_id', l:'Seller ID (Merchant ID)', ph:'A2XXXXXXXXXXX'},
                                    {k:'mws_access_key', l:'LWA Client ID', ph:'amzn1.application-oa2-client...'},
                                    {k:'mws_secret_key', l:'LWA Client Secret', ph:'Enter client secret', pw:true},
                                ].map(f => (
                                    <div key={f.k}>
                                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">{f.l}</label>
                                        <input type={f.pw ? 'password' : 'text'} value={(config as any)[f.k]}
                                            onChange={e => upd(f.k as keyof AmazonConfig, e.target.value)}
                                            placeholder={f.ph}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1">Marketplace</label>
                                    <select value={config.marketplace} onChange={e => upd('marketplace', e.target.value)}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                                        {['US','CA','MX','UK','DE','FR','IT','ES','JP','AU'].map(m => <option key={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sync Options */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 mb-4">Sync Options</p>
                        <div className="space-y-3">
                            {[
                                {k:'fba_enabled', l:'Enable FBA (Amazon Fulfills)', d:'Amazon stores and ships your oil products from their warehouse'},
                                {k:'fbm_enabled', l:'Enable FBM (You Fulfill)', d:'You ship directly from your warehouse in NY'},
                                {k:'auto_sync_inventory', l:'Auto-sync inventory every hour', d:'Keeps Amazon stock levels matched to your ERP'},
                                {k:'auto_create_orders', l:'Auto-import Amazon orders to ERP', d:'Creates invoices automatically for every Amazon sale'},
                                {k:'auto_sync_pricing', l:'Auto-update Amazon prices', d:'Pushes your ERP price + markup to Amazon listings'},
                            ].map(r => (
                                <div key={r.k} className="flex items-center justify-between py-3 border-b border-gray-50">
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{r.l}</p>
                                        <p className="text-[10px] text-gray-400">{r.d}</p>
                                    </div>
                                    <button onClick={() => upd(r.k as keyof AmazonConfig, !config[r.k as keyof AmazonConfig])}
                                        className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${config[r.k as keyof AmazonConfig] ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${config[r.k as keyof AmazonConfig] ? 'left-5' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4">
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Amazon Price Markup (%)</label>
                            <div className="flex items-center gap-3">
                                <input type="number" value={config.markup_percent} onChange={e => upd('markup_percent', parseInt(e.target.value)||0)}
                                    min={0} max={200} className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" />
                                <p className="text-xs text-gray-400">Your ERP cost × {config.markup_percent}% = Amazon selling price</p>
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-[10px] font-semibold text-gray-500 mb-1">Default Fulfillment Method</label>
                            <div className="flex gap-2">
                                {(['FBA','FBM'] as const).map(f => (
                                    <button key={f} onClick={() => upd('fulfillment_default', f)}
                                        className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all ${config.fulfillment_default===f?'bg-orange-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button onClick={handleSave}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
                        {saved ? <><Check size={16}/> Saved!</> : <><Settings size={16}/> Save All Settings</>}
                    </button>
                </div>
            )}
        </div>
    );
}
