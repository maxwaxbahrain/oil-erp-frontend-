/**
 * Zava Ops Map Phase 2 — pure adapters over existing van / route / AR data.
 * No invented coordinates, late/ETA, or driver messages.
 */

import { deriveVanLiveStatus, type VanLiveStatus } from '../../../lib/vanLiveStatus';

export type LatLng = { lat: number; lng: number };

export type OpsVanRow = {
  vanId: string;
  vanNumber: string;
  driverName: string;
  status: VanLiveStatus;
  /** Present only when a usable ping with coordinates exists. */
  position: LatLng | null;
  recordedAt: string | null;
  /** "Last update X min ago" | "No location today" | "No data" */
  pingLabel: string;
  hasPingToday: boolean;
};

export type OpsStop = {
  customerId: number;
  name: string;
  visited: boolean;
  position: LatLng | null;
  /** Ledger closing from ar-summary when available; else null. */
  owed: number | null;
  lineName: string | null;
};

export type OpsInsight = {
  vanLabel: string;
  customerId: number;
  customerName: string;
  amount: number;
  href: string;
};

/** Parse customer gps_location — never invent. Accepts "lat,lng" / "lat, lng". */
export function parseGpsLocation(raw: string | null | undefined): LatLng | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const m = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Route week visit_day is 1=Mon … 5=Fri. Weekend → null. */
export function todayVisitDay(now: Date = new Date()): number | null {
  const js = now.getDay(); // 0=Sun … 6=Sat
  if (js >= 1 && js <= 5) return js;
  return null;
}

function sameLocalDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Honest ping caption — no ETA / late. */
export function vanPingLabel(
  recordedAt: string | null | undefined,
  now: Date = new Date(),
): { label: string; hasPingToday: boolean } {
  if (!recordedAt) return { label: 'No data', hasPingToday: false };
  if (!sameLocalDay(recordedAt, now)) {
    return { label: 'No location today', hasPingToday: false };
  }
  const diffMins = Math.floor((now.getTime() - new Date(recordedAt).getTime()) / 60000);
  if (diffMins < 1) return { label: 'Last update just now', hasPingToday: true };
  if (diffMins === 1) return { label: 'Last update 1 min ago', hasPingToday: true };
  if (diffMins < 60) return { label: `Last update ${diffMins} min ago`, hasPingToday: true };
  const hrs = Math.floor(diffMins / 60);
  return {
    label: `Last update ${hrs} hr${hrs === 1 ? '' : 's'} ago`,
    hasPingToday: true,
  };
}

export function buildOpsVans(
  locations: Array<{
    van_id: string | number;
    van_number?: string | null;
    driver_name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    speed?: number | null;
    recorded_at?: string | null;
  }>,
  fleet: Array<{
    id: string | number;
    van_number?: string | null;
    driver_name?: string | null;
    status?: string | null;
  }>,
  now: Date = new Date(),
): OpsVanRow[] {
  const byId = new Map(locations.map((l) => [String(l.van_id), l]));
  const rows: OpsVanRow[] = [];

  for (const van of fleet) {
    const id = String(van.id);
    const loc = byId.get(id);
    const lat = loc?.latitude;
    const lng = loc?.longitude;
    const hasCoords =
      lat != null &&
      lng != null &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng));
    const recordedAt = loc?.recorded_at ?? null;
    const ping = vanPingLabel(recordedAt, now);
    const status = deriveVanLiveStatus(recordedAt, loc?.speed, now.getTime());
    rows.push({
      vanId: id,
      vanNumber: String(van.van_number || loc?.van_number || id),
      driverName: String(van.driver_name || loc?.driver_name || 'No driver'),
      status,
      // Stale pings (not today) are not drawn — avoid a false "here now" pin.
      position: hasCoords && ping.hasPingToday ? { lat: Number(lat), lng: Number(lng) } : null,
      recordedAt,
      pingLabel: ping.label,
      hasPingToday: ping.hasPingToday,
    });
    byId.delete(id);
  }

  // Locations for vans not in fleet list
  for (const loc of byId.values()) {
    const id = String(loc.van_id);
    const hasCoords =
      loc.latitude != null &&
      loc.longitude != null &&
      Number.isFinite(Number(loc.latitude)) &&
      Number.isFinite(Number(loc.longitude));
    const recordedAt = loc.recorded_at ?? null;
    const ping = vanPingLabel(recordedAt, now);
    rows.push({
      vanId: id,
      vanNumber: String(loc.van_number || id),
      driverName: String(loc.driver_name || 'No driver'),
      status: deriveVanLiveStatus(recordedAt, loc.speed, now.getTime()),
      position: hasCoords && ping.hasPingToday ? { lat: Number(loc.latitude), lng: Number(loc.longitude) } : null,
      recordedAt,
      pingLabel: ping.label,
      hasPingToday: ping.hasPingToday,
    });
  }

  const rank: Record<VanLiveStatus, number> = { moving: 0, stopped: 1, offline: 2 };
  return rows.sort((a, b) => rank[a.status] - rank[b.status] || a.vanNumber.localeCompare(b.vanNumber));
}

export function stopsForVisitDay(
  week: {
    days: Array<{
      visit_day: number;
      customers: Array<{
        customer_id: number;
        name: string;
        gps_location?: string | null;
        visited?: boolean;
        balance?: number;
        line_name?: string | null;
      }>;
    }>;
  } | null,
  visitDay: number | null,
): OpsStop[] {
  if (week == null || visitDay == null) return [];
  const day = week.days.find((d) => d.visit_day === visitDay);
  if (!day) return [];
  return day.customers.map((c) => ({
    customerId: c.customer_id,
    name: c.name,
    visited: Boolean(c.visited),
    position: parseGpsLocation(c.gps_location),
    owed: c.balance != null && Number.isFinite(Number(c.balance)) ? Number(c.balance) : null,
    lineName: c.line_name ?? null,
  }));
}

/** Prefer ar-summary per_customer balance (same source as dashboard / customer AR). */
export function applyArBalances(
  stops: OpsStop[],
  perCustomer: Array<{ id: number; balance: number }>,
): OpsStop[] {
  const map = new Map(perCustomer.map((r) => [Number(r.id), Number(r.balance)]));
  return stops.map((s) => {
    if (!map.has(s.customerId)) return s;
    return { ...s, owed: map.get(s.customerId) ?? s.owed };
  });
}

/**
 * Route polyline: only consecutive known coordinates, in list order.
 * Missing coords break the chain (no invented segments).
 */
export function routePolylines(stops: OpsStop[]): LatLng[][] {
  const lines: LatLng[][] = [];
  let current: LatLng[] = [];
  for (const stop of stops) {
    if (stop.position) {
      current.push(stop.position);
    } else if (current.length) {
      if (current.length >= 2) lines.push(current);
      current = [];
    }
  }
  if (current.length >= 2) lines.push(current);
  return lines;
}

/** Glowing route palette — cycles per line, no status meaning beyond identity. */
export const OPS_ROUTE_COLORS = ['#2DD4BF', '#F97316', '#38BDF8', '#A78BFA', '#F472B6'] as const;

export type OpsRouteSegment = {
  points: LatLng[];
  /** Remaining stops ahead → dashed; visited chain → solid. */
  dashed: boolean;
  color: string;
  lineKey: string;
};

function lineKeyForStop(stop: OpsStop): string {
  const raw = (stop.lineName || '').trim();
  return raw || 'route';
}

/**
 * Polylines grouped by route line. Only real coords; missing GPS breaks the chain.
 * Visited consecutive = solid; remaining consecutive = dashed.
 */
export function routeSegments(stops: OpsStop[]): OpsRouteSegment[] {
  const groups = new Map<string, OpsStop[]>();
  for (const stop of stops) {
    const key = lineKeyForStop(stop);
    const list = groups.get(key) || [];
    list.push(stop);
    groups.set(key, list);
  }

  const out: OpsRouteSegment[] = [];
  let colorIdx = 0;
  for (const [lineKey, group] of groups) {
    const color = OPS_ROUTE_COLORS[colorIdx % OPS_ROUTE_COLORS.length];
    colorIdx += 1;

    let bucket: OpsStop[] = [];
    const flush = () => {
      if (bucket.length < 2) {
        bucket = [];
        return;
      }
      const allVisited = bucket.every((s) => s.visited);
      out.push({
        points: bucket.map((s) => s.position!),
        dashed: !allVisited,
        color,
        lineKey,
      });
      bucket = [];
    };

    for (const stop of group) {
      if (!stop.position) {
        flush();
        continue;
      }
      if (bucket.length === 0) {
        bucket.push(stop);
        continue;
      }
      const prev = bucket[bucket.length - 1];
      if (prev.visited !== stop.visited) {
        const bridge = prev;
        flush();
        // Keep a real-coord bridge so the line continues; mark remaining as dashed.
        bucket = [bridge, stop];
      } else {
        bucket.push(stop);
      }
    }
    flush();
  }
  return out;
}

export type VanRouteProgress = {
  vanId: string;
  lineLabel: string;
  done: number;
  total: number;
  color: string;
};

/** Per-van stop progress from today's route lines (no invented late/ETA). */
export function vanRouteProgress(stops: OpsStop[], vans: OpsVanRow[]): VanRouteProgress[] {
  const byLine = new Map<string, OpsStop[]>();
  for (const stop of stops) {
    const key = lineKeyForStop(stop).toLowerCase();
    const list = byLine.get(key) || [];
    list.push(stop);
    byLine.set(key, list);
  }

  return vans.map((van, i) => {
    const vn = van.vanNumber.toLowerCase();
    let matched: OpsStop[] = [];
    for (const [key, list] of byLine) {
      if (key === 'route') continue;
      if (key === vn || key.includes(vn) || vn.includes(key)) {
        matched = list;
        break;
      }
    }
    return {
      vanId: van.vanId,
      lineLabel: matched[0]?.lineName || van.vanNumber,
      done: matched.filter((s) => s.visited).length,
      total: matched.length,
      color: OPS_ROUTE_COLORS[i % OPS_ROUTE_COLORS.length],
    };
  });
}

/**
 * Insight only when a today stop has owed > 0 (from AR).
 * Does not message the driver — Open customer / Dismiss only.
 */
export function pickOpsInsight(
  stops: OpsStop[],
  vans: OpsVanRow[],
): OpsInsight | null {
  const overdue = stops
    .filter((s) => s.owed != null && s.owed > 0.005)
    .sort((a, b) => (b.owed || 0) - (a.owed || 0));
  const pick = overdue[0];
  if (!pick || pick.owed == null) return null;

  let vanLabel = 'Today’s route';
  if (pick.lineName) {
    const match = vans.find(
      (v) =>
        v.vanNumber.toLowerCase() === pick.lineName!.toLowerCase() ||
        v.vanNumber.toLowerCase().includes(pick.lineName!.toLowerCase()) ||
        pick.lineName!.toLowerCase().includes(v.vanNumber.toLowerCase()),
    );
    if (match) vanLabel = match.vanNumber;
    else vanLabel = pick.lineName;
  } else if (vans[0]) {
    vanLabel = vans[0].vanNumber;
  }

  return {
    vanLabel,
    customerId: pick.customerId,
    customerName: pick.name,
    amount: pick.owed,
    href: `/customers/${pick.customerId}`,
  };
}

/** True when the van-locations request failed — UI must not show an empty "all fine" map. */
export function shouldShowVansError(locationsRequestOk: boolean): boolean {
  return !locationsRequestOk;
}

/** Bottom module strip — look matches design; blurbs stay generic (no invented counts). */
export const OPS_MODULE_CHIPS: Array<{
  label: string;
  href: string;
  blurb: string;
  tone: 'ok' | 'warn' | 'alert' | 'info';
}> = [
  { label: 'Sales', href: '/sales/dashboard', blurb: 'Orders & invoices', tone: 'ok' },
  { label: 'Collections', href: '/finance/collections', blurb: 'Outstanding balances', tone: 'alert' },
  { label: 'Inventory', href: '/products', blurb: 'Stock on hand', tone: 'warn' },
  { label: 'Finance', href: '/finance/dashboard', blurb: 'Ledger & cash', tone: 'alert' },
  { label: 'Expenses', href: '/finance/expenses', blurb: 'Approvals & spend', tone: 'info' },
  { label: 'Reports', href: '/finance/financial-statement', blurb: 'Statements & P&L', tone: 'ok' },
];

export const CHIP_TONE_COLOR: Record<'ok' | 'warn' | 'alert' | 'info', string> = {
  ok: '#22C55E',
  warn: '#F97316',
  alert: '#EF4444',
  info: '#38BDF8',
};
