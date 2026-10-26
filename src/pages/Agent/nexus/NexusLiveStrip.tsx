import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { TimelineEvent } from './nexusModel';
import {
  formatLoadLine,
  liveEventsFromTimeline,
  summarizeLoadSlots,
  type LoadSlot,
} from './liveStripModel';

const GREEN = '#22c55e';

type Props = {
  timeline: TimelineEvent[];
  loadSlots: LoadSlot[];
  onNavigate: (href: string) => void;
  /** Quiet refresh while tab visible (payments/DN). */
  onRefresh: () => void;
  refreshMs?: number;
};

export default function NexusLiveStrip({
  timeline,
  loadSlots,
  onNavigate,
  onRefresh,
  refreshMs = 60_000,
}: Props) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const events = useMemo(() => liveEventsFromTimeline(timeline), [timeline]);
  const loadLine = useMemo(() => formatLoadLine(summarizeLoadSlots(loadSlots)), [loadSlots]);

  useEffect(() => {
    let timer: number | undefined;

    const clear = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const arm = () => {
      clear();
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      timer = window.setInterval(() => {
        onRefreshRef.current();
      }, refreshMs);
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') clear();
      else arm();
    };

    arm();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clear();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshMs]);

  return (
    <section style={bar} data-testid="nexus-live-strip">
      <div style={left}>
        <span style={livePill}>
          <span style={liveDot} aria-hidden />
          LIVE
        </span>
        <div style={eventsRow} data-testid="live-events">
          {events.length === 0 && <span style={muted}>No payments or deliveries recorded today</span>}
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              style={evBtn}
              title={ev.text}
              onClick={() => ev.href && onNavigate(ev.href)}
              disabled={!ev.href}
            >
              {ev.timeLabel ? <span style={time}>{ev.timeLabel}</span> : null}
              <span style={text}>{ev.text}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={right} data-testid="live-load-line">
        {loadLine}
      </div>
    </section>
  );
}

/** Test helper — expose refresh effect contract via source scan in tests. */
export const LIVE_STRIP_REFRESH_MS_DEFAULT = 60_000;

const bar: CSSProperties = {
  marginTop: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'nowrap',
  background: 'rgba(8, 14, 28, 0.7)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: 12,
  padding: '6px 12px',
  minWidth: 0,
  flexShrink: 0,
  maxHeight: 40,
  overflow: 'hidden',
};

const left: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  flex: 1,
};

const livePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.14em',
  color: GREEN,
  flexShrink: 0,
};

const liveDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: GREEN,
  boxShadow: `0 0 10px ${GREEN}`,
};

const eventsRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 8,
  minWidth: 0,
  overflow: 'hidden',
};

const evBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 6,
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: 999,
  background: 'rgba(15,23,42,0.75)',
  color: '#E2E8F0',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 11,
  maxWidth: '100%',
};

const time: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#64748B',
  fontWeight: 700,
  flexShrink: 0,
};

const text: CSSProperties = {
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const muted: CSSProperties = { fontSize: 12, color: '#64748B' };

const right: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#94A3B8',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};
