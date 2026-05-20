// CallHistory — paginated table of every call captured by the Voice module.
// Filters: date range + sentiment. Row click → /voice/calls/:id.
// Pagination: 25 per page (limit/offset on GET /api/voice/calls).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    PhoneCall, PhoneIncoming, PhoneOutgoing, ChevronLeft, ChevronRight,
    Filter, RefreshCw, AlertCircle, X,
} from 'lucide-react';
import clsx from 'clsx';
import SentimentBadge from '../../components/Voice/SentimentBadge';
import { getCalls, hasVoiceCredentials, type CallListResponse } from '../../services/voiceService';

const PAGE_SIZE = 25;

type SentimentFilter = '' | 'positive' | 'neutral' | 'negative';

export default function CallHistory() {
    const navigate = useNavigate();
    const credsReady = hasVoiceCredentials();

    const [page, setPage] = useState(0);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sentiment, setSentiment] = useState<SentimentFilter>('');
    const [data, setData] = useState<CallListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totalPages = useMemo(() => {
        if (!data || data.total === 0) return 1;
        return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    }, [data]);

    const load = async () => {
        if (!credsReady) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getCalls({
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                sentiment: sentiment || undefined,
            });
            setData(res);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load calls');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, dateFrom, dateTo, sentiment]);

    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSentiment('');
        setPage(0);
    };

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-redwood-text-main tracking-tight">Call History</h1>
                    <p className="text-[13px] text-redwood-text-muted font-medium mt-1">
                        Every voice call captured by the Soltol Voice AI module.
                    </p>
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-redwood-border hover:border-redwood-text-muted rounded-xl text-[11px] font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-redwood-border shadow-sm p-4 flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">
                    <Filter size={12} /> Filters
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">From</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setPage(0); setDateFrom(e.target.value); }}
                        className="px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">To</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setPage(0); setDateTo(e.target.value); }}
                        className="px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-redwood-text-muted mb-1">Sentiment</label>
                    <select
                        value={sentiment}
                        onChange={(e) => { setPage(0); setSentiment(e.target.value as SentimentFilter); }}
                        className="px-3 py-2 rounded-lg border border-redwood-border text-sm outline-none focus:border-redwood-primary bg-white"
                    >
                        <option value="">All</option>
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                    </select>
                </div>
                {(dateFrom || dateTo || sentiment) && (
                    <button
                        onClick={clearFilters}
                        className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted hover:bg-redwood-bg-light rounded-lg flex items-center gap-1"
                    >
                        <X size={12} /> Clear
                    </button>
                )}
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-redwood-border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-redwood-bg-light">
                        <tr>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">Direction</th>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">Caller</th>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">Summary</th>
                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">Sentiment</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">Duration</th>
                            <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">When</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (!data || data.items.length === 0) && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-redwood-text-muted">Loading…</td></tr>
                        )}
                        {!loading && data?.items.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-redwood-text-muted">No calls match these filters.</td></tr>
                        )}
                        {data?.items.map((c) => {
                            const DirIcon = c.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;
                            return (
                                <tr
                                    key={c.id}
                                    onClick={() => navigate(`/voice/calls/${encodeURIComponent(c.id)}`)}
                                    className="border-t border-redwood-border hover:bg-redwood-bg-light cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <span className={clsx(
                                            'inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
                                            c.direction === 'inbound'
                                                ? 'bg-redwood-primary/10 border-redwood-primary/30 text-redwood-primary'
                                                : 'bg-gray-50 border-gray-200 text-gray-600',
                                        )}>
                                            <DirIcon size={11} /> {c.direction}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-redwood-text-main">
                                        {c.caller_phone || <span className="text-redwood-text-muted italic">unknown</span>}
                                    </td>
                                    <td className="px-4 py-3 text-redwood-text-main max-w-md truncate">
                                        {c.summary || <span className="text-redwood-text-muted italic">— no summary —</span>}
                                    </td>
                                    <td className="px-4 py-3">
                                        <SentimentBadge sentiment={c.sentiment} />
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-redwood-text-muted">
                                        {c.duration_seconds != null ? `${Math.round(c.duration_seconds)}s` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-redwood-text-muted">
                                        {new Date(c.created_at).toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-redwood-border bg-redwood-bg-light/50">
                    <div className="text-[11px] text-redwood-text-muted">
                        {data ? (
                            <>Showing <span className="font-black">{data.items.length}</span> of <span className="font-black">{data.total}</span> calls</>
                        ) : '—'}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            disabled={page === 0 || loading}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            className="p-1.5 rounded-lg border border-redwood-border bg-white hover:bg-redwood-bg-light disabled:opacity-40"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[11px] font-black uppercase tracking-widest text-redwood-text-muted px-2">
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            disabled={page + 1 >= totalPages || loading}
                            onClick={() => setPage((p) => p + 1)}
                            className="p-1.5 rounded-lg border border-redwood-border bg-white hover:bg-redwood-bg-light disabled:opacity-40"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {!credsReady && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start gap-2">
                    <PhoneCall size={16} className="shrink-0 mt-0.5" />
                    <span>Voice credentials not configured. Open <span className="font-black">Voice → Dashboard</span> and click Config to set your tenant API key.</span>
                </div>
            )}
        </div>
    );
}
