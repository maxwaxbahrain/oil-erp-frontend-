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
  /** Empty when no real clock time — never a fake local time. */
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

function formatMinute(m: number): string {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = ((hh + 11) % 12) + 1;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function moneyAbs(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

/** Payment line: "$420 · Lone Star Auto" when amount + customer exist. */
export function formatLivePaymentText(ev: TimelineEvent): string {
  const amt =
    ev.amount != null && Number.isFinite(Number(ev.amount)) ? moneyAbs(Number(ev.amount)) : null;
  const who = (ev.customerName || '').trim() || null;
  if (amt && who) return `${amt} · ${who}`;
  if (amt) return `${amt} · Payment`;
  if (who) return `Payment · ${who}`;
  return ev.label || 'Payment';
}

function dedupeKey(ev: TimelineEvent): string {
  if (ev.id) return `id:${ev.id}`;
  const amt = ev.amount != null ? String(Math.round(Number(ev.amount) * 100)) : '';
  const who = (ev.customerName || ev.label || '').trim().toLowerCase();
  const t = ev.minuteOfDay != null ? String(ev.minuteOfDay) : 'notime';
  return `f:${ev.lane}|${amt}|${who}|${t}`;
}

/** Payments + delivery only; newest first; no fake times; no duplicates. */
export function liveEventsFromTimeline(events: TimelineEvent[]): LiveStripEvent[] {
  const seen = new Set<string>();
  const out: LiveStripEvent[] = [];

  const filtered = events.filter((e) => e.lane === 'money' || e.lane === 'goods');
  // Newest first
  const sorted = [...filtered].sort((a, b) => {
    const am = a.minuteOfDay;
    const bm = b.minuteOfDay;
    if (am == null && bm == null) return String(b.id).localeCompare(String(a.id));
    if (am == null) return 1;
    if (bm == null) return -1;
    return bm - am || String(b.id).localeCompare(String(a.id));
  });

  for (const e of sorted) {
    const key = dedupeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);

    const hasTime = !e.timeNotRecorded && e.minuteOfDay != null && Number.isFinite(e.minuteOfDay);
    out.push({
      id: e.id,
      minuteOfDay: hasTime ? e.minuteOfDay : null,
      sortKey: hasTime ? (e.minuteOfDay as number) : -1,
      timeLabel: hasTime ? formatMinute(e.minuteOfDay as number) : '',
      text: e.lane === 'money' ? formatLivePaymentText(e) : e.label,
      href: e.href,
    });
  }
  return out;
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
