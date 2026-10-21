/**
 * Zava Nexus Phase 1 — pure adapters over existing ERP data.
 * No invented numbers. Health score is Beta and client-side only.
 */

import { formatLowStockShort } from '../../../utils/lowStock';

export type SignalPriority = 'urgent' | 'today' | 'fyi';

export type NexusSignalCard = {
  id: string;
  watcher_id?: string;
  module?: string;
  title: string;
  why: string;
  action: string;
  money: number;
  priority: string;
  href: string;
};

export type PlanetId =
  | 'sales'
  | 'collections'
  | 'purchase'
  | 'inventory'
  | 'delivery'
  | 'finance'
  | 'expenses'
  | 'payroll'
  | 'ai_team'
  | 'reports';

export type PlanetStatus = 'good' | 'info' | 'watch' | 'needs_you' | 'offline' | 'error';

export type NexusPlanet = {
  id: PlanetId;
  label: string;
  href: string;
  status: PlanetStatus;
  /** Longer label for tooltips / list rows. */
  metricLabel: string;
  /** Short value under the orbit icon (design: "$7,118", "6 low"). */
  orbitValue: string;
  connected: boolean;
};

export type TimelineLaneId = 'money' | 'goods' | 'team';

export type TimelineEvent = {
  id: string;
  lane: TimelineLaneId;
  label: string;
  /** Minutes from local midnight when a real clock time exists; null = date-only. */
  minuteOfDay: number | null;
  expected?: boolean;
  href?: string;
  /** Date-only today item — not placed on the time axis. */
  timeNotRecorded?: boolean;
};

/** Open PO = not draft / rejected / completed / cancelled / paid. */
const CLOSED_PO = new Set(['draft', 'rejected', 'completed', 'cancelled', 'canceled', 'paid']);

export function countOpenPurchaseOrders(
  orders: Array<{ status?: string | null }>,
): number {
  return orders.filter((po) => !CLOSED_PO.has(String(po.status || '').trim().toLowerCase())).length;
}

/**
 * Business health score (Beta).
 *
 * Start at 100. For each card (signals + data-health), subtract by priority:
 *   urgent −12, today −6, fyi −2.
 * Clamp to 0–100. Integer.
 * Cards are keyed by `id` so the same id is not double-counted.
 *
 * Returns null when signals/data-health failed to load — never show 100 on error.
 */
export function businessHealthScore(
  cards: NexusSignalCard[],
  cardsLoadOk: boolean,
): number | null {
  if (!cardsLoadOk) return null;
  const seen = new Set<string>();
  let score = 100;
  for (const card of cards) {
    const key = String(card.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const p = String(card.priority || '').toLowerCase();
    if (p === 'urgent') score -= 12;
    else if (p === 'today') score -= 6;
    else score -= 2;
  }
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

export function needsYouCount(cards: NexusSignalCard[]): number {
  return cards.filter((c) => String(c.priority || '').toLowerCase() === 'urgent').length;
}

export function normalizePriority(priority: string): SignalPriority {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent' || p === 'today' || p === 'fyi') return p;
  return 'fyi';
}

function worstStatus(a: PlanetStatus, b: PlanetStatus): PlanetStatus {
  const rank: Record<PlanetStatus, number> = {
    offline: 0,
    good: 1,
    info: 2,
    watch: 3,
    needs_you: 4,
    error: 5,
  };
  return rank[a] >= rank[b] ? a : b;
}

function statusFromPriority(priority: string): PlanetStatus {
  const p = normalizePriority(priority);
  if (p === 'urgent') return 'needs_you';
  if (p === 'today') return 'watch';
  return 'info';
}

export function moduleToPlanet(module: string | undefined): PlanetId | null {
  const m = String(module || '').toLowerCase();
  if (m === 'sales') return 'sales';
  if (m === 'collections' || m === 'customers') return 'collections';
  if (m === 'purchases' || m === 'purchase') return 'purchase';
  if (m === 'inventory') return 'inventory';
  if (m === 'delivery' || m === 'logistics') return 'delivery';
  if (m === 'finance' || m === 'cash') return 'finance';
  if (m === 'expenses') return 'expenses';
  if (m === 'payroll') return 'payroll';
  if (m === 'reports') return 'reports';
  return null;
}

/** Discriminated load result for planet sources. */
export type SourceResult<T> =
  | { state: 'ok'; value: T }
  | { state: 'error' }
  | { state: 'unavailable' };

export type PlanetInputs = {
  cards: NexusSignalCard[];
  /** False if /api/agent/signals or /api/agent/data-health failed. */
  cardsLoadOk: boolean;
  owedToUs: SourceResult<number>;
  openPoCount: SourceResult<number>;
  /** Shared low-stock rule counts (same helper as Dashboard / header). */
  lowStockCount: SourceResult<{ alertCount: number; outOfStock: number; belowMin: number }>;
  vansOnline: SourceResult<number>;
  vansTotal: SourceResult<number>;
  pendingExpenses: SourceResult<number>;
  /**
   * Sales invoice-today count. `unavailable` when we intentionally skip the
   * unfiltered GET /invoices/ download (no date filter on that API).
   */
  invoiceCountToday: SourceResult<number>;
};

function metricForSource<T>(
  src: SourceResult<T>,
  whenOk: (value: T) => { label: string; orbit: string },
  unavailableLabel = 'Not connected yet',
): { connected: boolean; statusBase: PlanetStatus; metricLabel: string; orbitValue: string } {
  if (src.state === 'error') {
    return { connected: false, statusBase: 'error', metricLabel: "Couldn't load", orbitValue: '—' };
  }
  if (src.state === 'unavailable') {
    return {
      connected: false,
      statusBase: 'offline',
      metricLabel: unavailableLabel,
      orbitValue: '—',
    };
  }
  const both = whenOk(src.value);
  return { connected: true, statusBase: 'good', metricLabel: both.label, orbitValue: both.orbit };
}

export function buildPlanets(input: PlanetInputs): NexusPlanet[] {
  const byPlanet = new Map<PlanetId, PlanetStatus>();
  if (input.cardsLoadOk) {
    for (const card of input.cards) {
      const planet = moduleToPlanet(card.module);
      if (!planet) continue;
      const next = statusFromPriority(card.priority);
      byPlanet.set(planet, worstStatus(byPlanet.get(planet) || 'good', next));
    }
  }

  const collections = metricForSource(input.owedToUs, (v) => ({
    label: `Owed $${Math.round(v).toLocaleString('en-US')}`,
    orbit: `$${Math.round(v).toLocaleString('en-US')}`,
  }));
  const purchase = metricForSource(input.openPoCount, (v) => ({
    label: `${v} open PO${v === 1 ? '' : 's'}`,
    orbit: String(v),
  }));
  const inventory = metricForSource(input.lowStockCount, (v) => {
    const short = formatLowStockShort(v);
    return {
      label: short,
      orbit: v.alertCount === 0 ? '0' : short,
    };
  });
  let vansOk: SourceResult<{ online: number; total: number }>;
  if (input.vansTotal.state === 'ok' && input.vansOnline.state === 'ok') {
    vansOk = {
      state: 'ok',
      value: { online: input.vansOnline.value, total: input.vansTotal.value },
    };
  } else if (input.vansTotal.state === 'error' || input.vansOnline.state === 'error') {
    vansOk = { state: 'error' };
  } else {
    vansOk = { state: 'unavailable' };
  }
  const delivery = metricForSource(vansOk, (v) => ({
    label: `${v.online}/${v.total} vans live`,
    orbit: `${v.online}/${v.total}`,
  }));
  const expenses = metricForSource(input.pendingExpenses, (v) => ({
    label: `${v} pending`,
    orbit: String(v),
  }));

  // Sales: no date-filtered invoice list — open the module; status from cards only.
  const salesMetric =
    input.invoiceCountToday.state === 'ok'
      ? metricForSource(input.invoiceCountToday, (v) => ({
          label: `${v} invoice${v === 1 ? '' : 's'} today`,
          orbit: String(v),
        }))
      : input.invoiceCountToday.state === 'error'
        ? metricForSource(input.invoiceCountToday, () => ({ label: '', orbit: '—' }))
        : {
            connected: true,
            statusBase: 'good' as PlanetStatus,
            metricLabel: 'Open sales',
            orbitValue: '·',
          };

  const collectionsStatus =
    input.owedToUs.state === 'ok' && input.owedToUs.value > 0.005
      ? byPlanet.get('collections') || 'info'
      : byPlanet.get('collections') || 'good';

  const financeLabel = !input.cardsLoadOk
    ? "Couldn't load"
    : byPlanet.has('finance')
      ? 'Books check'
      : 'Books quiet';
  const reportsLabel = !input.cardsLoadOk ? "Couldn't load" : 'Open reports';

  const planets: NexusPlanet[] = [
    {
      id: 'sales',
      label: 'Sales',
      href: '/sales/dashboard',
      connected: salesMetric.connected,
      status: salesMetric.statusBase === 'error'
        ? 'error'
        : salesMetric.connected
          ? byPlanet.get('sales') || 'good'
          : 'offline',
      metricLabel: salesMetric.metricLabel,
      orbitValue: salesMetric.orbitValue,
    },
    {
      id: 'collections',
      label: 'Collections',
      href: '/finance/collections',
      connected: collections.connected,
      status: collections.statusBase === 'error' ? 'error' : collections.connected ? collectionsStatus : 'offline',
      metricLabel: collections.metricLabel,
      orbitValue: collections.orbitValue,
    },
    {
      id: 'purchase',
      label: 'Purchase',
      href: '/purchases',
      connected: purchase.connected,
      status:
        purchase.statusBase === 'error'
          ? 'error'
          : purchase.connected
            ? byPlanet.get('purchase') || 'good'
            : 'offline',
      metricLabel: purchase.metricLabel,
      orbitValue: purchase.orbitValue,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      href: '/products',
      connected: inventory.connected,
      status:
        inventory.statusBase === 'error'
          ? 'error'
          : inventory.connected
            ? (input.lowStockCount.state === 'ok' && input.lowStockCount.value.alertCount > 0
                ? worstStatus(byPlanet.get('inventory') || 'good', 'watch')
                : byPlanet.get('inventory') || 'good')
            : 'offline',
      metricLabel: inventory.metricLabel,
      orbitValue: inventory.orbitValue,
    },
    {
      id: 'delivery',
      label: 'Delivery',
      href: '/agent/ops-map',
      connected: delivery.connected,
      status:
        delivery.statusBase === 'error'
          ? 'error'
          : delivery.connected
            ? byPlanet.get('delivery') || 'good'
            : 'offline',
      metricLabel: delivery.metricLabel,
      orbitValue: delivery.orbitValue,
    },
    {
      id: 'finance',
      label: 'Finance',
      href: '/finance/dashboard',
      connected: input.cardsLoadOk,
      status: input.cardsLoadOk ? byPlanet.get('finance') || 'good' : 'error',
      metricLabel: financeLabel,
      orbitValue: input.cardsLoadOk ? (byPlanet.has('finance') ? '!' : 'OK') : '—',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      href: '/finance/expenses',
      connected: expenses.connected,
      status:
        expenses.statusBase === 'error'
          ? 'error'
          : expenses.connected
            ? (input.pendingExpenses.state === 'ok' && input.pendingExpenses.value > 0
                ? worstStatus(byPlanet.get('expenses') || 'good', 'watch')
                : byPlanet.get('expenses') || 'good')
            : 'offline',
      metricLabel: expenses.metricLabel,
      orbitValue: expenses.orbitValue,
    },
    {
      id: 'payroll',
      label: 'Payroll',
      href: '/finance/payroll',
      connected: false,
      status: 'offline',
      metricLabel: 'Not connected yet',
      orbitValue: '—',
    },
    {
      id: 'ai_team',
      label: 'AI & Team',
      href: '/ai/hub',
      connected: false,
      status: 'offline',
      metricLabel: 'Not connected yet',
      orbitValue: '—',
    },
    {
      id: 'reports',
      label: 'Reports',
      href: '/finance/financial-statement',
      connected: input.cardsLoadOk,
      status: input.cardsLoadOk ? byPlanet.get('reports') || 'good' : 'error',
      metricLabel: reportsLabel,
      orbitValue: input.cardsLoadOk ? '···' : '—',
    },
  ];

  return planets;
}

/** Same source the dashboard uses: ar-summary.owed_to_us. */
export function owedToUsFromArSummary(summary: {
  owed_to_us?: number;
  total_outstanding?: number;
} | null): number | null {
  if (!summary) return null;
  if (summary.owed_to_us != null && Number.isFinite(Number(summary.owed_to_us))) {
    return Number(summary.owed_to_us);
  }
  if (summary.total_outstanding != null && Number.isFinite(Number(summary.total_outstanding))) {
    return Number(summary.total_outstanding);
  }
  return null;
}

/**
 * True when the string carries a real clock time (not date-only, not midnight).
 * Date-only and `…T00:00:00` are treated as "time not recorded".
 */
export function hasRealTimestamp(iso: string | undefined | null): boolean {
  if (!iso) return false;
  const raw = String(iso).trim();
  if (!raw.includes('T') && !raw.includes(' ')) return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0);
}

function parseInstant(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const d = new Date(String(iso));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateOnlyLocal(iso: string | undefined | null): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const raw = String(iso).trim();
  const dayPart = raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dayPart);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function sameLocalDayParts(parts: { y: number; m: number; d: number }, now: Date): boolean {
  return parts.y === now.getFullYear() && parts.m === now.getMonth() && parts.d === now.getDate();
}

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export type TimelineInputs = {
  now?: Date;
  payments: Array<{
    id?: string | number;
    payment_date?: string | null;
    date?: string | null;
    created_at?: string | null;
    createdAt?: string | null;
    amount?: number;
    customer_name?: string | null;
  }>;
  /** Prefer created_at when it has a real time; delivery_date is date-only. */
  deliveryNotes: Array<{
    id?: string | number;
    delivery_date?: string | null;
    created_at?: string | null;
    createdAt?: string | null;
    dn_number?: string | null;
    status?: string | null;
  }>;
  leaveRequests: Array<{
    id?: string | number;
    start_date?: string | null;
    startDate?: string | null;
    created_at?: string | null;
    createdAt?: string | null;
    status?: string | null;
    employee_name?: string | null;
    employeeName?: string | null;
  }>;
};

/**
 * Timeline lanes from existing today-lists only.
 * Axis dots only when a real timestamp exists. Date-only → timeNotRecorded.
 *
 * Field notes (Phase 1):
 * - Payments: `payment_date` is date-only from API; `created_at` is Transaction.date ISO (may include time).
 * - Delivery notes: `delivery_date` date-only; `created_at` has real time when present.
 * - Leave: `startDate` date-only; `createdAt` is request time (not used for axis — leave day has no clock).
 * - Invoices: GET /invoices/ has no date filter — not loaded for timeline in Phase 1.
 */
export function buildTimelineEvents(input: TimelineInputs): TimelineEvent[] {
  const now = input.now ?? new Date();
  const events: TimelineEvent[] = [];

  for (const p of input.payments) {
    const daySrc = p.payment_date || p.date || p.created_at || p.createdAt;
    const day = parseDateOnlyLocal(daySrc);
    if (!day || !sameLocalDayParts(day, now)) continue;
    const timeSrc = hasRealTimestamp(p.created_at || p.createdAt)
      ? p.created_at || p.createdAt
      : hasRealTimestamp(p.payment_date || p.date)
        ? p.payment_date || p.date
        : null;
    const instant = timeSrc ? parseInstant(timeSrc) : null;
    events.push({
      id: `pay-${p.id}`,
      lane: 'money',
      label: p.customer_name ? `Payment · ${p.customer_name}` : 'Payment',
      minuteOfDay: instant ? minuteOfDay(instant) : null,
      timeNotRecorded: !instant,
      href: '/finance/collections',
    });
  }

  for (const dn of input.deliveryNotes) {
    const day = parseDateOnlyLocal(dn.delivery_date || dn.created_at || dn.createdAt);
    if (!day || !sameLocalDayParts(day, now)) continue;
    const timeSrc = hasRealTimestamp(dn.created_at || dn.createdAt) ? dn.created_at || dn.createdAt : null;
    const instant = timeSrc ? parseInstant(timeSrc) : null;
    events.push({
      id: `dn-${dn.id}`,
      lane: 'goods',
      label: dn.dn_number ? `Delivery ${dn.dn_number}` : 'Delivery',
      minuteOfDay: instant ? minuteOfDay(instant) : null,
      timeNotRecorded: !instant,
      href: '/logistics/tracking',
    });
  }

  for (const leave of input.leaveRequests) {
    const day = parseDateOnlyLocal(leave.start_date || leave.startDate);
    if (!day || !sameLocalDayParts(day, now)) continue;
    const st = String(leave.status || '').toLowerCase();
    if (st === 'rejected' || st === 'cancelled' || st === 'canceled') continue;
    const who = leave.employee_name || leave.employeeName;
    // Leave start is date-only — never invent a clock position.
    events.push({
      id: `leave-${leave.id}`,
      lane: 'team',
      label: who ? `Leave · ${who}` : 'Leave',
      minuteOfDay: null,
      timeNotRecorded: true,
      href: '/finance/payroll',
      expected: st === 'pending',
    });
  }

  return events.sort((a, b) => {
    if (a.minuteOfDay == null && b.minuteOfDay == null) return 0;
    if (a.minuteOfDay == null) return 1;
    if (b.minuteOfDay == null) return -1;
    return a.minuteOfDay - b.minuteOfDay;
  });
}

export function needsYouCards(cards: NexusSignalCard[]): NexusSignalCard[] {
  return cards
    .filter((c) => normalizePriority(c.priority) === 'urgent')
    .slice(0, 8);
}

export function comingUpCards(cards: NexusSignalCard[], currentId?: string | null): NexusSignalCard[] {
  return cards
    .filter((c) => c.id !== currentId)
    .filter((c) => {
      const p = normalizePriority(c.priority);
      return p === 'urgent' || p === 'today';
    })
    .slice(0, 6);
}

export const PLANET_STATUS_COLOR: Record<PlanetStatus, string> = {
  good: '#34D399',
  info: '#60A5FA',
  watch: '#FBBF24',
  needs_you: '#F87171',
  offline: '#64748B',
  error: '#F87171',
};

/** Clockwise from 12 o'clock — matches docs/design/zava/11_nexus.jpg */
export const PLANET_RING_ORDER: PlanetId[] = [
  'reports',
  'sales',
  'collections',
  'purchase',
  'inventory',
  'delivery',
  'finance',
  'expenses',
  'payroll',
  'ai_team',
];
