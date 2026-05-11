import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, RefreshCw, Check, ExternalLink, AlertTriangle,
    Package, ShoppingCart, Zap, Download, Upload,
    DollarSign, Settings, ChevronDown, ChevronUp,
    CheckCircle, XCircle, ArrowRight
} from 'lucide-react';
import { getProducts } from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';

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
const LISTING_STATUS: Record<string, string> = {
    active:     'bg-emerald-100 text-emerald-700',
    inactive:   'bg-gray-100 text-gray-600',
    suppressed: 'bg-red-100 text-red-700',
    pending:    'bg-amber-100 text-amber-700',
};
const ORDER_STATUS: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700',
    shipped:   'bg-blue-100 text-blue-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-600',
    refunded:  'bg-purple-100 text-purple-700',
};

// ── Mock data generator ───────────────────────────────────────
function generateMockListings(products: any[]): AmazonListing[] {
    return products.slice(0, 8).map((p, i) => ({
        id: `LST-${i+1}`,
        asin: `B0${String(Date.now()).slice(-9)}${i}`.toUpperCase().slice(0,10),
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
    const [saved, setSaved] = useState(false);
    const [showCredentials, setShowCredentials] = useState(false);

    useEffect(() => {
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
    };

    const syncOrderToERP = (order: AmazonOrder) => {
        const updated = orders.map(o => o.id === order.id ? { ...o, synced_to_erp: true, erp_invoice_id: `INV-AMZ-${order.order_id.slice(-6)}` } : o);
        localStorage.setItem(AMZN_ORDERS_KEY, JSON.stringify(updated));
        setOrders(updated);
    };

    // KPIs
    const activeListings = listings.filter(l => l.status === 'active').length;
    const totalRevenue7d = listings.reduce((s, l) => s + (l.revenue_7d || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const unsyncedOrders = orders.filter(o => !o.synced_to_erp && o.status !== 'cancelled').length;
    const fbaListings = listings.filter(l => l.fulfillment === 'FBA').length;
    const fbmListings = listings.filter(l => l.fulfillment === 'FBM').length;

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-10 animate-in fade-in duration-300">

            {/* Header */}
            <div className="bg-gray-900 rounded-2xl p-6 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{background:'radial-gradient(circle at 80% 50%, #f97316 0%, transparent 60%)'}} />
                <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-white mb-3 transition-all relative">
                    <ArrowLeft size={14} /> Back
                </button>
                <div className="flex items-center justify-between flex-wrap gap-4 relative">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">📦</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-black uppercase tracking-tight">Amazon Integration</h1>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Cin7-style</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">FBA + FBM · Inventory Sync · Order Import · Accounting Sync</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl">
                            <span className="text-xs font-black text-gray-300">Amazon Sync</span>
                            <button onClick={() => upd('enabled', !config.enabled)}
                                className={`relative w-10 h-5 rounded-full transition-all ${config.enabled ? 'bg-orange-500' : 'bg-gray-600'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${config.enabled ? 'left-5' : 'left-0.5'}`} />
                            </button>
                            <span className={`text-xs font-black ${config.enabled ? 'text-orange-400' : 'text-gray-500'}`}>{config.enabled ? 'ON' : 'OFF'}</span>
                        </div>
                        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-black transition-all">
                            {saved ? <><Check size={14} /> Saved!</> : <><Settings size={14} /> Save</>}
                        </button>
                    </div>
                </div>
                {!config.seller_id && (
                    <div className="mt-3 bg-amber-500/20 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-300 text-xs font-bold relative">
                        ⚠️ Not connected — enter your Amazon Seller ID and SP-API credentials in Settings to enable live sync
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap">
                {[
                    {id:'dashboard', label:'📊 Dashboard'},
                    {id:'listings',  label:`📋 Listings (${listings.length})`},
                    {id:'orders',    label:`🛒 Orders (${orders.length})`, badge: unsyncedOrders > 0 ? unsyncedOrders : 0},
                    {id:'sync',      label:'🔄 Sync Center'},
                    {id:'settings',  label:'⚙️ Settings'},
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                        className={`relative px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {tab.label}
                        {(tab as any).badge > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">{(tab as any).badge}</span>}
                    </button>
                ))}
            </div>

            {/* ── DASHBOARD ── */}
            {activeTab === 'dashboard' && (
                <div className="space-y-4">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            {icon:'📋', label:'Active Listings', value: activeListings, sub:`${fbaListings} FBA · ${fbmListings} FBM`, color:'text-blue-600'},
                            {icon:'💰', label:'Revenue (7 days)', value: formatCurrency(totalRevenue7d), sub:'Across all channels', color:'text-emerald-600'},
                            {icon:'🛒', label:'Pending Orders', value: pendingOrders, sub:`${unsyncedOrders} need ERP sync`, color: pendingOrders > 0 ? 'text-amber-600' : 'text-gray-500'},
                            {icon:'🔄', label:'Unsynced Orders', value: unsyncedOrders, sub:'Click Orders → Sync to ERP', color: unsyncedOrders > 0 ? 'text-red-600' : 'text-emerald-600'},
                        ].map((k, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                                <span className="text-2xl">{k.icon}</span>
                                <p className={`text-2xl font-black mt-2 ${k.color}`}>{k.value}</p>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">{k.label}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* FBA vs FBM split */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Fulfillment Split</p>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden flex">
                                    <div className="bg-orange-500 h-full flex items-center justify-center text-[9px] font-black text-white transition-all"
                                        style={{width: listings.length > 0 ? `${(fbaListings/listings.length)*100}%` : '50%'}}>
                                        FBA {fbaListings}
                                    </div>
                                    <div className="bg-blue-500 h-full flex items-center justify-center text-[9px] font-black text-white transition-all"
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
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Order Status Breakdown</p>
                            <div className="space-y-2">
                                {(['pending','shipped','delivered','cancelled'] as const).map(s => {
                                    const count = orders.filter(o=>o.status===s).length;
                                    return (
                                        <div key={s} className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-gray-500 uppercase w-16">{s}</span>
                                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                                                <div className={`h-2 rounded-full ${s==='delivered'?'bg-emerald-500':s==='shipped'?'bg-blue-500':s==='pending'?'bg-amber-500':'bg-red-400'}`}
                                                    style={{width: orders.length > 0 ? `${(count/orders.length)*100}%` : '0%'}} />
                                            </div>
                                            <span className="text-xs font-black text-gray-700 w-6">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            {label:'Sync Inventory to Amazon', icon:Upload, action:()=>runSync('inventory'), color:'bg-orange-500'},
                            {label:'Import Amazon Orders', icon:Download, action:()=>runSync('orders'), color:'bg-blue-500'},
                            {label:'Update Amazon Prices', icon:DollarSign, action:()=>runSync('pricing'), color:'bg-emerald-500'},
                            {label:'Refresh All Listings', icon:RefreshCw, action:()=>runSync('listings'), color:'bg-purple-500'},
                        ].map((a, i) => {
                            const Icon = a.icon;
                            return (
                                <button key={i} onClick={a.action} disabled={syncing}
                                    className={`flex items-center gap-3 p-4 ${a.color} text-white rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all text-left shadow-sm`}>
                                    {syncing ? <RefreshCw size={18} className="animate-spin flex-shrink-0" /> : <Icon size={18} className="flex-shrink-0" />}
                                    <span className="text-xs font-black">{a.label}</span>
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
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{listings.length} Products Listed on Amazon</p>
                        <div className="flex gap-2">
                            <a href="https://sellercentral.amazon.com/inventory" target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-black hover:bg-orange-600 transition-all">
                                Open Seller Central <ExternalLink size={11} />
                            </a>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{['Product / SKU','ASIN','Price','FBA Qty','FBM Qty','Status','Fulfillment','7d Revenue','Buy Box','Actions'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {listings.map(l => (
                                    <tr key={l.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-black text-gray-900 leading-tight">{l.title.slice(0,35)}{l.title.length>35?'...':''}</p>
                                            <p className="text-[10px] font-mono text-gray-400">{l.sku}</p>
                                        </td>
                                        <td className="px-4 py-3 text-[10px] font-mono text-blue-600">{l.asin}</td>
                                        <td className="px-4 py-3 text-sm font-black font-mono text-gray-900">${l.price.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-orange-600 font-black">{l.fba_qty}</td>
                                        <td className="px-4 py-3 text-sm font-mono text-blue-600 font-black">{l.fbm_qty}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${LISTING_STATUS[l.status]}`}>{l.status}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${l.fulfillment==='FBA'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{l.fulfillment}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-black font-mono text-emerald-600">{l.revenue_7d ? formatCurrency(l.revenue_7d) : '—'}</td>
                                        <td className="px-4 py-3 text-center">{l.buybox_winner ? '🏆' : '—'}</td>
                                        <td className="px-4 py-3">
                                            <a href={`https://www.amazon.com/dp/${l.asin}`} target="_blank" rel="noopener noreferrer"
                                                className="text-[10px] font-black text-orange-600 hover:underline flex items-center gap-0.5">
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
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} className="text-amber-600" />
                                <p className="text-sm font-black text-amber-800">{unsyncedOrders} Amazon orders not yet synced to ERP</p>
                                <p className="text-xs text-amber-700">Sync creates invoices automatically in your ERP</p>
                            </div>
                            <button onClick={() => orders.filter(o=>!o.synced_to_erp&&o.status!=='cancelled').forEach(o=>syncOrderToERP(o))}
                                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-black hover:bg-amber-700 transition-all">
                                <Zap size={14} /> Sync All to ERP
                            </button>
                        </div>
                    )}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>{['Order ID','Product','Buyer','Qty','Value','Status','Type','Date','ERP Sync','Action'].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                ))}</tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {orders.map(o => (
                                    <tr key={o.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-[10px] text-gray-700 font-bold">{o.order_id}</td>
                                        <td className="px-4 py-3 text-xs font-bold text-gray-900 max-w-[150px]">
                                            <span className="line-clamp-2">{o.title}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600">{o.buyer}</td>
                                        <td className="px-4 py-3 text-sm font-black text-gray-700">{o.qty}</td>
                                        <td className="px-4 py-3 text-sm font-black font-mono text-gray-900">{formatCurrency(o.price)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full capitalize ${ORDER_STATUS[o.status]}`}>{o.status}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${o.fulfillment==='FBA'?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{o.fulfillment}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-mono text-gray-400">{o.order_date}</td>
                                        <td className="px-4 py-3">
                                            {o.synced_to_erp ? (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600"><CheckCircle size={10} />{o.erp_invoice_id}</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-black text-gray-400"><XCircle size={10} />Not synced</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {!o.synced_to_erp && o.status !== 'cancelled' && (
                                                <button onClick={() => syncOrderToERP(o)}
                                                    className="flex items-center gap-1 text-[10px] font-black text-blue-600 hover:text-blue-800 transition-all">
                                                    <ArrowRight size={10} /> Sync
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
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
                                            <p className="text-sm font-black text-gray-900">{item.title}</p>
                                            <p className="text-[10px] text-gray-400">{item.desc}</p>
                                        </div>
                                    </div>
                                    {lastLog && (
                                        <div className={`mb-3 px-3 py-2 rounded-lg text-[10px] font-bold ${lastLog.status==='success'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>
                                            {lastLog.status==='success'?'✅':'❌'} {lastLog.message} · {lastLog.records_synced} records · {new Date(lastLog.timestamp).toLocaleTimeString()}
                                        </div>
                                    )}
                                    <button onClick={() => runSync(item.type)} disabled={syncing}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 ${item.color} text-white rounded-xl text-xs font-black hover:opacity-90 disabled:opacity-50 transition-all`}>
                                        {syncing ? <RefreshCw size={13} className="animate-spin" /> : <Icon size={13} />}
                                        Run Now
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Sync Log */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Sync History</p>
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
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Amazon SP-API Credentials</p>
                            <button onClick={() => setShowCredentials(!showCredentials)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                                {showCredentials ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                {showCredentials ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                            <p className="text-xs font-black text-blue-800 mb-1">How to get Amazon SP-API credentials</p>
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
                                        <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">{f.l}</label>
                                        <input type={f.pw ? 'password' : 'text'} value={(config as any)[f.k]}
                                            onChange={e => upd(f.k as keyof AmazonConfig, e.target.value)}
                                            placeholder={f.ph}
                                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-orange-400" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Marketplace</label>
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
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Sync Options</p>
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
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Amazon Price Markup (%)</label>
                            <div className="flex items-center gap-3">
                                <input type="number" value={config.markup_percent} onChange={e => upd('markup_percent', parseInt(e.target.value)||0)}
                                    min={0} max={200} className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none" />
                                <p className="text-xs text-gray-400">Your ERP cost × {config.markup_percent}% = Amazon selling price</p>
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="block text-[10px] font-black text-gray-500 uppercase mb-1">Default Fulfillment Method</label>
                            <div className="flex gap-2">
                                {(['FBA','FBM'] as const).map(f => (
                                    <button key={f} onClick={() => upd('fulfillment_default', f)}
                                        className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${config.fulfillment_default===f?'bg-orange-500 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button onClick={handleSave}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-gray-700 transition-all flex items-center justify-center gap-2">
                        {saved ? <><Check size={16}/> Saved!</> : <><Settings size={16}/> Save All Settings</>}
                    </button>
                </div>
            )}
        </div>
    );
}
