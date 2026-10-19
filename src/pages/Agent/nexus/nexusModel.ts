/**
 * Zava Nexus Phase 1 — pure adapters over existing ERP data.
 * No invented numbers. Health score is Beta and client-side only.
 */

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

export type PlanetStatus = 'good' | 'info' | 'watch' | 'needs_you' | 'offline';

export type NexusPlanet = {
  id: PlanetId;
  label: string;
  href: string;
  status: PlanetStatus;
  metricLabel: string;
  connected: boolean;
};

export type TimelineLaneId = 'money' | 'goods' | 'team';

export type TimelineEvent = {
  id: string;
  lane: TimelineLaneId;
  label: string;
  /** Minutes from local midnight (0–1440). */
  minuteOfDay: number;
  expected?: boolean;
  href?: string;
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
 */
export function businessHealthScore(cards: NexusSignalCard[]): number {
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
  };
  return rank[a] >= rank[b] ? a : b;
}

function statusFromPriority(priority: string): PlanetStatus {
  const p = normalizePriority(priority);
  if (p === 'urgent') return 'needs_you';
  if (p === 'today') return 'watch';
  return 'info';
}

function moduleToPlanet(module: string | undefined): PlanetId | null {
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

export type PlanetInputs = {
  cards: NexusSignalCard[];
  owedToUs: number | null;
  openPoCount: number | null;
  lowStockCount: number | null;
  vansOnline: number | null;
  vansTotal: number | null;
  pendingExpenses: number | null;
  invoiceCountToday: number | null;
};

export function buildPlanets(input: PlanetInputs): NexusPlanet[] {
  const byPlanet = new Map<PlanetId, PlanetStatus>();
  for (const card of input.cards) {
    const planet = moduleToPlanet(card.module);
    if (!planet) continue;
    const next = statusFromPriority(card.priority);
    byPlanet.set(planet, worstStatus(byPlanet.get(planet) || 'good', next));
  }

  const collectionsStatus =
    input.owedToUs != null && input.owedToUs > 0.005
      ? byPlanet.get('collections') || 'info'
      : byPlanet.get('collections') || 'good';

  const purchaseConnected = input.openPoCount != null;
  const inventoryConnected = input.lowStockCount != null;
  const deliveryConnected = input.vansTotal != null;
  const expensesConnected = input.pendingExpenses != null;
  const salesConnected = input.invoiceCountToday != null;

  const planets: NexusPlanet[] = [
    {
      id: 'sales',
      label: 'Sales',
      href: '/sales/dashboard',
      connected: salesConnected,
      status: salesConnected ? byPlanet.get('sales') || 'good' : 'offline',
      metricLabel: salesConnected
        ? `${input.invoiceCountToday} invoice${input.invoiceCountToday === 1 ? '' : 's'} today`
        : 'Not connected yet',
    },
    {
      id: 'collections',
      label: 'Collections',
      href: '/finance/collections',
      connected: input.owedToUs != null,
      status: input.owedToUs != null ? collectionsStatus : 'offline',
      metricLabel:
        input.owedToUs != null
          ? `Owed $${Math.round(input.owedToUs).toLocaleString('en-US')}`
          : 'Not connected yet',
    },
    {
      id: 'purchase',
      label: 'Purchase',
      href: '/purchases',
      connected: purchaseConnected,
      status: purchaseConnected ? byPlanet.get('purchase') || 'good' : 'offline',
      metricLabel: purchaseConnected
        ? `${input.openPoCount} open PO${input.openPoCount === 1 ? '' : 's'}`
        : 'Not connected yet',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      href: '/products',
      connected: inventoryConnected,
      status: inventoryConnected
        ? (input.lowStockCount || 0) > 0
          ? worstStatus(byPlanet.get('inventory') || 'good', 'watch')
          : byPlanet.get('inventory') || 'good'
        : 'offline',
      metricLabel: inventoryConnected
        ? `${input.lowStockCount} low stock`
        : 'Not connected yet',
    },
    {
      id: 'delivery',
      label: 'Delivery',
      href: '/logistics/tracking',
      connected: deliveryConnected,
      status: deliveryConnected ? byPlanet.get('delivery') || 'good' : 'offline',
      metricLabel: deliveryConnected
        ? `${input.vansOnline ?? 0}/${input.vansTotal} vans live`
        : 'Not connected yet',
    },
    {
      id: 'finance',
      label: 'Finance',
      href: '/finance/dashboard',
      connected: true,
      status: byPlanet.get('finance') || 'good',
      metricLabel: byPlanet.has('finance') ? 'Books check' : 'Books quiet',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      href: '/finance/expenses',
      connected: expensesConnected,
      status: expensesConnected
        ? (input.pendingExpenses || 0) > 0
          ? worstStatus(byPlanet.get('expenses') || 'good', 'watch')
          : byPlanet.get('expenses') || 'good'
        : 'offline',
      metricLabel: expensesConnected
        ? `${input.pendingExpenses} pending`
        : 'Not connected yet',
    },
    {
      id: 'payroll',
      label: 'Payroll',
      href: '/finance/payroll',
      connected: false,
      status: 'offline',
      metricLabel: 'Not connected yet',
    },
    {
      id: 'ai_team',
      label: 'AI & Team',
      href: '/ai/hub',
      connected: false,
      status: 'offline',
      metricLabel: 'Not connected yet',
    },
    {
      id: 'reports',
      label: 'Reports',
      href: '/finance/financial-statement',
      connected: true,
      status: byPlanet.get('reports') || 'good',
      metricLabel: 'Open reports',
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

function parseLocalDay(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const raw = String(iso);
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export type TimelineInputs = {
  now?: Date;
  payments: Array<{ id?: string | number; payment_date?: string; date?: string; amount?: number; customer_name?: string }>;
  invoices: Array<{ id?: string | number; invoiceDate?: string; date?: string; invoiceNumber?: string; grandTotal?: number }>;
  deliveryNotes: Array<{ id?: string | number; delivery_date?: string; dn_number?: string; status?: string }>;
  leaveRequests: Array<{
    id?: string | number;
    start_date?: string;
    startDate?: string;
    status?: string;
    employee_name?: string;
    employeeName?: string;
  }>;
};

/**
 * Timeline lanes from existing today-lists only. Empty lane → UI shows "—".
 * Window shown: 6:00–18:00 local; events outside still listed if today.
 */
export function buildTimelineEvents(input: TimelineInputs): TimelineEvent[] {
  const now = input.now ?? new Date();
  const events: TimelineEvent[] = [];

  for (const p of input.payments) {
    const d = parseLocalDay(p.payment_date || p.date);
    if (!d || !sameLocalDay(d, now)) continue;
    events.push({
      id: `pay-${p.id}`,
      lane: 'money',
      label: p.customer_name ? `Payment · ${p.customer_name}` : 'Payment',
      minuteOfDay: minuteOfDay(d),
      href: '/finance/collections',
    });
  }
  for (const inv of input.invoices) {
    const d = parseLocalDay(inv.invoiceDate || inv.date);
    if (!d || !sameLocalDay(d, now)) continue;
    events.push({
      id: `inv-${inv.id}`,
      lane: 'money',
      label: inv.invoiceNumber ? `Invoice ${inv.invoiceNumber}` : 'Invoice',
      minuteOfDay: minuteOfDay(d),
      href: '/sales/invoices',
    });
  }
  for (const dn of input.deliveryNotes) {
    const d = parseLocalDay(dn.delivery_date);
    if (!d || !sameLocalDay(d, now)) continue;
    events.push({
      id: `dn-${dn.id}`,
      lane: 'goods',
      label: dn.dn_number ? `Delivery ${dn.dn_number}` : 'Delivery',
      minuteOfDay: minuteOfDay(d),
      href: '/logistics/tracking',
    });
  }
  for (const leave of input.leaveRequests) {
    const d = parseLocalDay(leave.start_date || leave.startDate);
    if (!d || !sameLocalDay(d, now)) continue;
    const st = String(leave.status || '').toLowerCase();
    if (st === 'rejected' || st === 'cancelled' || st === 'canceled') continue;
    const who = leave.employee_name || leave.employeeName;
    events.push({
      id: `leave-${leave.id}`,
      lane: 'team',
      label: who ? `Leave · ${who}` : 'Leave',
      minuteOfDay: minuteOfDay(d),
      href: '/finance/dashboard',
      expected: st === 'pending',
    });
  }

  return events.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
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
};
