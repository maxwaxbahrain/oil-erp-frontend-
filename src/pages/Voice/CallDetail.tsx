// CallDetail — one-call deep-dive view at /voice/calls/:callId.
// Renders:
//   • Header: caller + sentiment + duration + recording link
//   • Summary text (AI-generated)
//   • TranscriptViewer
//   • DraftOrderCard(s) for any pending extracted orders

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, PhoneIncoming, PhoneOutgoing, Clock, Download, AlertCircle, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import SentimentBadge from '../../components/Voice/SentimentBadge';
import TranscriptViewer, { type TranscriptTurn } from '../../components/Voice/TranscriptViewer';
import DraftOrderCard from '../../components/Voice/DraftOrderCard';
import {
    getCall, getCallRecordingUrl, getStoredRepId,
    type CallDetail as CallDetailType,
} from '../../services/voiceService';

function parseTranscript(raw: string | null | undefined): TranscriptTurn[] {
    if (!raw) return [];
    // Try JSON first (Deepgram structured)
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .filter((t) => t && typeof t === 'object')
                .map((t) => ({
                    role: t.role === 'agent' ? 'agent' : 'caller',
                    text: String(t.text ?? ''),
                    ts: typeof t.ts === 'number' ? t.ts : null,
                }));
        }
    } catch { /* fall through */ }
    // Fall back to plain text: split on lines, alternate roles
    return raw.split('\n').filter(Boolean).map((line, i) => ({
        role: (i % 2 === 0 ? 'caller' : 'agent') as 'caller' | 'agent',
        text: line,
        ts: null,
    }));
}

export default function CallDetail() {
    const { callId = '' } = useParams<{ callId: string }>();
    const navigate = useNavigate();
    const [call, setCall] = useState<CallDetailType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        if (!callId) return;
        setLoading(true);
        setError(null);
        try {
            const c = await getCall(callId);
            setCall(c);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load call');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [callId]);

    const turns = useMemo(() => parseTranscript(call?.full_transcript), [call?.full_transcript]);
    const recordingHref = useMemo(() => call ? getCallRecordingUrl(call.id) : null, [call]);
    const repId = getStoredRepId() ?? undefined;

    const DirIcon = call?.direction === 'outbound' ? PhoneOutgoing : PhoneIncoming;

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Back + header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/voice/calls')}
                    className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted hover:text-redwood-text-main"
                >
                    <ArrowLeft size={14} /> Back to call history
                </button>
                <button
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-redwood-border hover:border-redwood-text-muted rounded-xl text-[11px] font-black uppercase tracking-widest text-redwood-text-main shadow-sm transition-all"
                >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {loading && !call && (
                <div className="rounded-xl bg-white border border-redwood-border p-10 text-center text-sm text-redwood-text-muted">
                    Loading call…
                </div>
            )}

            {call && (
                <>
                    {/* Top card: caller + meta */}
                    <div className="bg-white rounded-xl border border-redwood-border shadow-sm p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={clsx(
                                        'inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
                                        call.direction === 'inbound'
                                            ? 'bg-redwood-primary/10 border-redwood-primary/30 text-redwood-primary'
                                            : 'bg-gray-50 border-gray-200 text-gray-600',
                                    )}>
                                        <DirIcon size={11} /> {call.direction}
                                    </span>
                                    <SentimentBadge sentiment={call.sentiment} />
                                    {call.status && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-redwood-text-muted">
                                            {call.status}
                                        </span>
                                    )}
                                </div>
                                <h1 className="text-2xl font-black text-redwood-text-main tracking-tight font-mono">
                                    {call.caller_phone || 'Unknown caller'}
                                </h1>
                                <p className="text-[12px] text-redwood-text-muted font-mono mt-1" title={call.id}>
                                    {call.id}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-redwood-text-muted">
                                    <Clock size={12} />
                                    {call.duration_seconds != null ? `${Math.round(call.duration_seconds)}s` : '—'}
                                </span>
                                <span className="text-[11px] text-redwood-text-muted">
                                    {new Date(call.created_at).toLocaleString()}
                                </span>
                                {recordingHref && (
                                    <a
                                        href={recordingHref}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-redwood-primary hover:underline"
                                    >
                                        <Download size={12} /> Recording
                                    </a>
                                )}
                            </div>
                        </div>

                        {call.summary && (
                            <div className="mt-4 rounded-lg bg-redwood-bg-light p-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-redwood-text-muted block mb-1">
                                    AI Summary
                                </span>
                                <p className="text-sm text-redwood-text-main leading-relaxed">{call.summary}</p>
                            </div>
                        )}
                    </div>

                    {/* Draft orders */}
                    {call.call_orders && call.call_orders.length > 0 && (
                        <div className="space-y-3">
                            {call.call_orders.map((co) => (
                                <DraftOrderCard
                                    key={co.id}
                                    order={co}
                                    repId={repId}
                                    onApproved={() => load()}
                                />
                            ))}
                        </div>
                    )}

                    {/* Transcript */}
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest text-redwood-text-muted mb-3">
                            Transcript
                        </h2>
                        <TranscriptViewer turns={turns} maxHeight="32rem" />
                    </div>
                </>
            )}
        </div>
    );
}
