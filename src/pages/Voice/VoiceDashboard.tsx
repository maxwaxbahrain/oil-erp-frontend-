// VoiceDashboard — the rep's live "command centre" for the Voice AI module.
// Subscribes to the per-rep WebSocket and renders:
//   • Connection status pill (top right)
//   • Stack of LiveCallCard popups for active incoming calls
//   • Stack of CoachingTipBanner toasts that auto-dismiss
//   • Today's KPIs (calls / drafts / unpaid alerts) pulled from /analytics
//   • Recent calls list (5 most recent)
//   • A "Configure Voice Access" modal if no api_key / rep_id is stored.
//
// Routing: lives at /voice/dashboard. Clicking a LiveCallCard or a row in
// the recent list navigates to /voice/calls/:callId.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PhoneCall, Activity, ShoppingCart, AlertCircle, Wifi, WifiOff, Loader2,
    Settings, RefreshCw, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import PasswordInput from '../../components/ui/PasswordInput';
import LiveCallCard from '../../components/Voice/LiveCallCard';
import CoachingTipBanner from '../../components/Voice/CoachingTipBanner';
import SentimentBadge from '../../components/Voice/SentimentBadge';
import {
    getAnalytics,
    getCalls,
    connectVoiceWS,
    hasVoiceCredentials,
    getStoredApiKey,
    setStoredApiKey,
    getStoredRepId,
    setStoredRepId,
    type AnalyticsResponse,
    type CallListItem,
    type VoiceWSMessage,
} from '../../services/voiceService';

interface LiveCallEntry {
    callId: string;
    callerPhone: string | null;
    customer: {
        id?: number | string;
        name?: string;
        category?: string;
        balance?: number;
        credit_limit?: number;
    } | null;
    openOrdersCount: number;
    unpaidInvoices: number;
    isNewLead: boolean;
}

interface TipEntry {
    id: string;
    callId: string;
    message: string;
}

export default function VoiceDashboard() {
    const navigate = useNavigate();
    const [credsReady, setCredsReady] = useState<boolean>(hasVoiceCredentials());
    const [showCredsModal, setShowCredsModal] = useState<boolean>(!hasVoiceCredentials());
    const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
    const [recent, setRecent] = useState<CallListItem[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const [wsStatus, setWsStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
    const [liveCalls, setLiveCalls] = useState<LiveCallEntry[]>([]);
    const [tips, setTips] = useState<TipEntry[]>([]);

    const wsHandleRef = useRef<{ close: () => void } | null>(null);

    // ── load REST data ────────────────────────────────────────────
    const loadDashboardData = async () => {
        setRefreshing(true);
        setLoadError(null);
        try {
            const [a, c] = await Promise.all([
                getAnalytics(),
                getCalls({ limit: 5, offset: 0 }),
            ]);
            setAnalytics(a);
            setRecent(c.items);
        } catch (e) {
            setLoadError(e instanceof Error ? e.message : 'Failed to load dashboard');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (!credsReady) return;
        loadDashboardData();
    }, [credsReady]);

    // ── WebSocket subscription ────────────────────────────────────
    useEffect(() => {
        if (!credsReady) return;
        const repId = getStoredRepId();
        if (!repId) return;

        const handle = connectVoiceWS({
            repId,
            onStatusChange: (s) => setWsStatus(s),
            onMessage: (msg: VoiceWSMessage) => handleWsMessage(msg),
        });
        wsHandleRef.current = handle;
        return () => {
            handle.close();
            wsHandleRef.current = null;
        };
    }, [credsReady]);

    const handleWsMessage = (msg: VoiceWSMessage) => {
        switch (msg.type) {
            case 'incoming_call': {
                const cust = msg.customer as LiveCallEntry['customer'] | null;
                const entry: LiveCallEntry = {
                    callId: msg.call_id,
                    callerPhone: msg.caller_phone,
                    customer: cust,
                    openOrdersCount: Array.isArray(msg.open_orders) ? msg.open_orders.length : 0,
                    unpaidInvoices: typeof msg.unpaid_invoices === 'number' ? msg.unpaid_invoices : 0,
                    isNewLead: !!msg.is_new_lead,
                };
                setLiveCalls((prev) => [entry, ...prev.filter((c) => c.callId !== entry.callId)].slice(0, 4));
                break;
            }
            case 'coaching_tip': {
                const tip: TipEntry = {
                    id: `${msg.call_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    callId: msg.call_id,
                    message: msg.message,
                };
                setTips((prev) => [...prev, tip].slice(-4));
                break;
            }
            case 'call_ended': {
                setLiveCalls((prev) => prev.filter((c) => c.callId !== msg.call_id));
                // refresh recent calls so the ended call appears in history
                loadDashboardData();
                break;
            }
            default:
                break;
        }
    };

    const dismissTip = (id: string) =>
        setTips((prev) => prev.filter((t) => t.id !== id));

    const dismissLiveCall = (callId: string) =>
        setLiveCalls((prev) => prev.filter((c) => c.callId !== callId));

    // ── credentials modal ─────────────────────────────────────────
    const [tmpKey, setTmpKey] = useState(getStoredApiKey());
    const [tmpRep, setTmpRep] = useState<string>(() => {
        const r = getStoredRepId();
        return r ? String(r) : '';
    });

    const handleSaveCreds = () => {
        const repInt = parseInt(tmpRep, 10);
        if (!tmpKey || !Number.isFinite(repInt) || repInt <= 0) return;
        setStoredApiKey(tmpKey.trim());
        setStoredRepId(repInt);
        setCredsReady(true);
        setShowCredsModal(false);
    };

    // ── status pill ───────────────────────────────────────────────
    const statusPill = useMemo(() => {
        switch (wsStatus) {
            case 'connected':
                return { text: 'Live', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: <Wifi size={11} /> };
            case 'connecting':
                return { text: 'Connecting', cls: 'bg-amber-50 border-amber-200 text-amber-700', icon: <Loader2 size={11} className="animate-spin" /> };
            case 'disconnected':
                return { text: 'Reconnecting', cls: 'bg-rose-50 border-rose-200 text-rose-700', icon: <WifiOff size={11} /> };
            default:
                return { text: 'Idle', cls: 'bg-gray-50 border-gray-200 text-gray-600', icon: <WifiOff size={11} /> };
        }
    }, [wsStatus]);

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Voice Dashboard</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">
                        Live call monitoring, AI coaching tips, and today's voice KPIs.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={clsx(
                        'inline-flex items-center gap-1.5 border rounded-full text-[10px] font-black uppercase tracking-widest px-3 py-1.5',
                        statusPill.cls,
                    )}>
                        {statusPill.icon}
                        {statusPill.text}
                    </span>
                    <button
                        onClick={loadDashboardData}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-redwood-border hover:border-redwood-text-muted rounded-xl text-[11px] font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                    >
                        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button
                        onClick={() => setShowCredsModal(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-redwood-border hover:border-redwood-text-muted rounded-xl text-[11px] font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                    >
                        <Settings size={12} /> Config
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {loadError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{loadError}</span>
                </div>
            )}

            {/* Live calls stack */}
            {liveCalls.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {liveCalls.map((c) => (
                        <LiveCallCard
                            key={c.callId}
                            callId={c.callId}
                            callerPhone={c.callerPhone}
                            customer={c.customer}
                            openOrdersCount={c.openOrdersCount}
                            unpaidInvoices={c.unpaidInvoices}
                            isNewLead={c.isNewLead}
                            onClick={() => {
                                dismissLiveCall(c.callId);
                                navigate(`/voice/calls/${encodeURIComponent(c.callId)}`);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Coaching tips stack */}
            {tips.length > 0 && (
                <div className="space-y-2">
                    {tips.map((t) => (
                        <CoachingTipBanner
                            key={t.id}
                            callId={t.callId}
                            message={t.message}
                            onDismiss={() => dismissTip(t.id)}
                        />
                    ))}
                </div>
            )}

            {/* KPI tiles */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <KpiTile
                    icon={<PhoneCall size={16} className="text-redwood-primary" />}
                    label="Calls today"
                    value={analytics?.calls_today ?? '—'}
                    subline={`${analytics?.calls_last_30d ?? 0} in last 30 days`}
                />
                <KpiTile
                    icon={<Activity size={16} className="text-emerald-600" />}
                    label="Avg duration"
                    value={analytics ? `${Math.round((analytics.avg_duration_seconds || 0) / 6) / 10}m` : '—'}
                    subline="across last 30 days"
                />
                <KpiTile
                    icon={<ShoppingCart size={16} className="text-amber-600" />}
                    label="Orders drafted"
                    value={analytics?.orders_drafted_30d ?? '—'}
                    subline={`${analytics?.orders_confirmed_30d ?? 0} approved`}
                />
                <KpiTile
                    icon={<AlertCircle size={16} className="text-rose-600" />}
                    label="Negative calls"
                    value={analytics?.sentiment_breakdown?.negative ?? '—'}
                    subline="last 30 days"
                />
            </div>

            {/* Recent calls list */}
            <div className="bg-white rounded-xl border border-redwood-border shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-redwood-border flex items-center justify-between">
                    <div>
                        <h3 className="text-[15px] font-black text-redwood-text-main">Recent Calls</h3>
                        <p className="text-[12px] text-redwood-text-muted font-medium">5 most recent inbound + outbound</p>
                    </div>
                    <button
                        onClick={() => navigate('/voice/calls')}
                        className="text-[11px] font-black uppercase tracking-widest text-redwood-brand hover:underline flex items-center gap-1"
                    >
                        View all <ArrowRight size={12} />
                    </button>
                </div>
                {recent.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-redwood-text-muted">
                        No calls yet — they'll appear here once the Telnyx number receives traffic.
                    </div>
                ) : (
                    <ul className="divide-y divide-redwood-border">
                        {recent.map((c) => (
                            <li
                                key={c.id}
                                onClick={() => navigate(`/voice/calls/${encodeURIComponent(c.id)}`)}
                                className="px-5 py-3 flex items-center gap-3 hover:bg-redwood-bg-light cursor-pointer transition-colors"
                            >
                                <PhoneCall size={14} className={c.direction === 'inbound' ? 'text-redwood-primary' : 'text-redwood-text-muted'} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-redwood-text-main truncate">
                                        {c.caller_phone || 'Unknown caller'}
                                    </p>
                                    <p className="text-[11px] text-redwood-text-muted truncate">
                                        {c.summary || `${c.direction} · ${c.status || 'unknown'}`}
                                    </p>
                                </div>
                                <SentimentBadge sentiment={c.sentiment} />
                                <span className="text-[11px] font-mono text-redwood-text-muted shrink-0">
                                    {c.duration_seconds != null ? `${Math.round(c.duration_seconds)}s` : '—'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Credentials modal */}
            {showCredsModal && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div>
                            <h2 className="text-xl font-black text-redwood-text-main">Configure Voice Access</h2>
                            <p className="text-xs text-redwood-text-muted mt-1">
                                Paste your tenant API key (format <span className="font-mono">tenant_id.secret</span>) and the integer rep id assigned to your seat.
                            </p>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-redwood-text-muted uppercase tracking-widest mb-1">Tenant API Key</label>
                            <PasswordInput
                                value={tmpKey}
                                onChange={(e) => setTmpKey(e.target.value)}
                                placeholder="01234567-89ab-cdef-….secretvalue"
                                className="w-full px-3 py-2 rounded-lg border border-redwood-border focus:border-redwood-primary outline-none font-mono text-xs"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-redwood-text-muted uppercase tracking-widest mb-1">Rep ID (integer)</label>
                            <input
                                type="number"
                                value={tmpRep}
                                onChange={(e) => setTmpRep(e.target.value)}
                                placeholder="42"
                                className="w-full px-3 py-2 rounded-lg border border-redwood-border focus:border-redwood-primary outline-none text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            {credsReady && (
                                <button
                                    onClick={() => setShowCredsModal(false)}
                                    className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted hover:bg-redwood-bg-light rounded-lg"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSaveCreds}
                                disabled={!tmpKey || !tmpRep}
                                className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-redwood-primary rounded-lg hover:brightness-95 disabled:opacity-50"
                            >
                                Save & Connect
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiTile({
    icon, label, value, subline,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; subline?: string }) {
    return (
        <div className="bg-white p-5 rounded-xl border border-redwood-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <span className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">{label}</span>
            </div>
            <div className="text-2xl font-black text-redwood-text-main leading-tight">{value}</div>
            {subline && <div className="text-[11px] text-redwood-text-muted mt-1">{subline}</div>}
        </div>
    );
}
