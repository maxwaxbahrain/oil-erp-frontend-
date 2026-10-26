/**
 * Bottom LIVE strip — payments + delivery notes only (no invented invoice/driver events).
 */

import type { TimelineEvent } from './nexusModel';

export type LiveStripEvent = {
  id: string;
  /** Minutes from midnight when known; null = time not recorded. */
  minuteOfDay: number | null;
  /** Sort key: higher = newer. */
  sortKey: number;
  timeLabel: string;
  text: string;
  href?: string;
};

export type LoadSlotState = 'ok' | 'error' | 'unavailable' | 'loading';

export type LoadSlot = { id: string; state: LoadSlotState };

export type LoadSummary = {
  loaded: number;
  total: number;
  failed: number;
};

function formatMinute(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return '—';
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

/** Payments + delivery only; newest first. */
export function liveEventsFromTimeline(events: TimelineEvent[]): LiveStripEvent[] {
  return events
    .filter((e) => e.lane === 'money' || e.lane === 'goods')
    .map((e) => {
      const minute = e.minuteOfDay;
      const sortKey = minute != null ? minute : -1;
      const text =
        e.lane === 'money'
          ? e.label.replace(/^Payment · /, (m) => (m ? 'Payment · ' : '')) || 'Payment received'
          : e.label;
      return {
        id: e.id,
        minuteOfDay: minute,
        sortKey,
        timeLabel: formatMinute(minute),
        text: e.lane === 'money' && !e.label.toLowerCase().includes('payment')
          ? `Payment · ${e.label}`
          : text,
        href: e.href,
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey || a.id.localeCompare(b.id));
}

/** Count settled sources: loaded = ok, failed = error; total excludes unavailable. */
export function summarizeLoadSlots(slots: LoadSlot[]): LoadSummary {
  const counted = slots.filter((s) => s.state !== 'unavailable');
  const loaded = counted.filter((s) => s.state === 'ok').length;
  const failed = counted.filter((s) => s.state === 'error').length;
  return { loaded, total: counted.length, failed };
}

export function formatLoadLine(summary: LoadSummary): string {
  const base = `${summary.loaded} of ${summary.total} loaded`;
  if (summary.failed > 0) return `${base} · ${summary.failed} failed`;
  return base;
}
