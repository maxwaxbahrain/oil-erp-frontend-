// TranscriptViewer — renders a Deepgram-style turn-based transcript.
// Used in CallDetail; auto-scrolls to the latest turn when used live
// (controlled via the `autoScroll` prop). Speaker bubbles use the
// existing chat-bubble visual language from src/pages/AI/Chat.tsx —
// caller on the left, agent on the right.
//
// The shape of a turn mirrors the JSON we persist in calls.transcript:
//   { role: 'caller' | 'agent', text: string, ts?: number }
// `ts` is the seconds offset from call_start; rendered as `m:ss` when
// available. Empty / null transcripts render a friendly placeholder.

import { useEffect, useRef } from 'react';
import { User, Headphones } from 'lucide-react';
import clsx from 'clsx';

export interface TranscriptTurn {
    role: 'caller' | 'agent';
    text: string;
    ts?: number | null;
}

export interface TranscriptViewerProps {
    turns: TranscriptTurn[] | null | undefined;
    /** When true, auto-scrolls to the bottom whenever `turns` changes. */
    autoScroll?: boolean;
    /** Optional max-height (CSS string). Defaults to a scrollable 24rem. */
    maxHeight?: string;
    className?: string;
}

function formatTs(ts: number | null | undefined): string | null {
    if (ts == null || !Number.isFinite(ts)) return null;
    const s = Math.max(0, Math.floor(ts));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function TranscriptViewer({
    turns,
    autoScroll = false,
    maxHeight = '24rem',
    className,
}: TranscriptViewerProps) {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!autoScroll || !endRef.current) return;
        endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [autoScroll, turns]);

    if (!turns || turns.length === 0) {
        return (
            <div
                className={clsx(
                    'rounded-xl border border-redwood-border bg-redwood-bg-light p-6 text-center',
                    className,
                )}
            >
                <p className="text-sm text-redwood-text-muted">
                    No transcript yet — it appears once the call ends and Deepgram has processed the audio.
                </p>
            </div>
        );
    }

    return (
        <div
            className={clsx(
                'rounded-xl border border-redwood-border bg-white overflow-y-auto p-4 space-y-3',
                className,
            )}
            style={{ maxHeight }}
        >
            {turns.map((turn, i) => {
                const isAgent = turn.role === 'agent';
                const tsLabel = formatTs(turn.ts);
                return (
                    <div
                        key={i}
                        className={clsx(
                            'flex items-start gap-2',
                            isAgent ? 'flex-row-reverse' : 'flex-row',
                        )}
                    >
                        <div
                            className={clsx(
                                'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                                isAgent ? 'bg-redwood-primary/10' : 'bg-redwood-bg-light',
                            )}
                        >
                            {isAgent ? (
                                <Headphones size={13} className="text-redwood-primary" />
                            ) : (
                                <User size={13} className="text-redwood-text-muted" />
                            )}
                        </div>
                        <div className={clsx('max-w-[80%]', isAgent ? 'items-end' : 'items-start')}>
                            <div
                                className={clsx(
                                    'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-0.5',
                                    isAgent ? 'flex-row-reverse text-redwood-primary' : 'text-redwood-text-muted',
                                )}
                            >
                                <span>{isAgent ? 'Agent' : 'Caller'}</span>
                                {tsLabel && (
                                    <span className="font-mono text-redwood-text-muted/80 normal-case tracking-normal">
                                        {tsLabel}
                                    </span>
                                )}
                            </div>
                            <div
                                className={clsx(
                                    'rounded-xl px-3 py-2 text-sm leading-snug shadow-sm',
                                    isAgent
                                        ? 'bg-redwood-primary text-white rounded-tr-sm'
                                        : 'bg-redwood-bg-light text-redwood-text-main rounded-tl-sm',
                                )}
                            >
                                {turn.text || <em className="opacity-60">(empty turn)</em>}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={endRef} />
        </div>
    );
}
