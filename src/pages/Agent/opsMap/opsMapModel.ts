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

export const OPS_MODULE_CHIPS: Array<{ label: string; href: string }> = [
  { label: 'Sales', href: '/sales/dashboard' },
  { label: 'Collections', href: '/finance/collections' },
  { label: 'Purchase', href: '/purchases' },
  { label: 'Inventory', href: '/products' },
  { label: 'Delivery', href: '/agent/ops-map' },
  { label: 'Finance', href: '/finance/dashboard' },
  { label: 'Expenses', href: '/finance/expenses' },
  { label: 'Payroll', href: '/finance/payroll' },
  { label: 'AI & Team', href: '/ai/hub' },
  { label: 'Reports', href: '/finance/financial-statement' },
  { label: 'Nexus', href: '/agent/nexus' },
];
