/**
 * Zava Ops Map Phase 2 — pure adapters over existing van / route / AR data.
 * No invented coordinates, late/ETA, driver messages, or van↔line name guessing.
 *
 * Van ↔ route link: none in current APIs. Route week / customers expose
 * `line_name` (string) only; `vans` has no assigned route; no `van_id` on
 * route templates. Optional `van_id` on a stop is used only with exact id match
 * when/if the API adds it.
 */

import { deriveVanLiveStatus, type VanLiveStatus } from '../../../lib/vanLiveStatus';
import {
  PLANET_STATUS_COLOR,
  type NexusPlanet,
  type PlanetId,
  type PlanetStatus,
} from '../nexus/nexusModel';

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
  /** Exact van id from API when present — never inferred from line_name. */
  vanId: string | null;
};

export type OpsInsight = {
  /** Only set when stop.vanId exactly matches a fleet van id. */
  vanLabel: string | null;
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
        /** Present only if API adds a real assignment — never guessed client-side. */
        van_id?: string | number | null;
      }>;
    }>;
  } | null,
  visitDay: number | null,
): OpsStop[] {
  if (week == null || visitDay == null) return [];
  const day = week.days.find((d) => d.visit_day === visitDay);
  if (!day) return [];
  return day.customers.map((c) => {
    const rawVan = c.van_id;
    const vanId =
      rawVan != null && String(rawVan).trim() !== '' ? String(rawVan).trim() : null;
    return {
      customerId: c.customer_id,
      name: c.name,
      visited: Boolean(c.visited),
      position: parseGpsLocation(c.gps_location),
      owed: c.balance != null && Number.isFinite(Number(c.balance)) ? Number(c.balance) : null,
      lineName: c.line_name ?? null,
      vanId,
    };
  });
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
  return raw || '__unnamed__';
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

export type RouteLineProgress = {
  lineKey: string;
  lineLabel: string;
  done: number;
  total: number;
  color: string;
};

/**
 * Progress per route line_name (real field on customers / route week).
 * Does not attach progress to vans — no van↔line link in existing data.
 */
export function routeLineProgress(stops: OpsStop[]): RouteLineProgress[] {
  const groups = new Map<string, OpsStop[]>();
  for (const stop of stops) {
    const key = lineKeyForStop(stop);
    const list = groups.get(key) || [];
    list.push(stop);
    groups.set(key, list);
  }

  let i = 0;
  const rows: RouteLineProgress[] = [];
  for (const [lineKey, list] of groups) {
    rows.push({
      lineKey,
      lineLabel: lineKey === '__unnamed__' ? 'No line name' : lineKey,
      done: list.filter((s) => s.visited).length,
      total: list.length,
      color: OPS_ROUTE_COLORS[i % OPS_ROUTE_COLORS.length],
    });
    i += 1;
  }
  return rows.sort((a, b) => a.lineLabel.localeCompare(b.lineLabel));
}

/**
 * Exact van_id match only — never van_number / line_name includes() guessing.
 */
export function vanLabelForStop(stop: OpsStop, vans: OpsVanRow[]): string | null {
  if (!stop.vanId) return null;
  const match = vans.find((v) => v.vanId === stop.vanId);
  return match ? match.vanNumber : null;
}

/**
 * Insight only when a today stop has owed > 0 (from AR).
 * Names a van only with exact stop.vanId → fleet id. No vans[0] fallback.
 * Does not message the driver — Open customer / Dismiss only.
 */
export function pickOpsInsight(
  stops: OpsStop[],
  vans: OpsVanRow[],
): OpsInsight | null {
  const owing = stops
    .filter((s) => s.owed != null && s.owed > 0.005)
    .sort((a, b) => (b.owed || 0) - (a.owed || 0));
  const pick = owing[0];
  if (!pick || pick.owed == null) return null;

  return {
    vanLabel: vanLabelForStop(pick, vans),
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

/** Bottom module strip — labels/hrefs only; status comes from Nexus buildPlanets. */
export const OPS_MODULE_CHIPS: Array<{
  planetId: PlanetId;
  label: string;
  href: string;
}> = [
  { planetId: 'sales', label: 'Sales', href: '/sales/dashboard' },
  { planetId: 'collections', label: 'Collections', href: '/finance/collections' },
  { planetId: 'inventory', label: 'Inventory', href: '/products' },
  { planetId: 'finance', label: 'Finance', href: '/finance/dashboard' },
  { planetId: 'expenses', label: 'Expenses', href: '/finance/expenses' },
  { planetId: 'reports', label: 'Reports', href: '/finance/financial-statement' },
];

export type OpsChipLoadState = 'loading' | 'ok' | 'error';

export type OpsChipPresentation = {
  blurb: string;
  /** Null = no status color (source failed). Grey when still loading. */
  dotColor: string | null;
};

/**
 * Chip status from Nexus planets. Fail → "Couldn't load" + no color.
 * Not loaded yet → neutral grey. Never uses hardcoded alert/warn tones.
 */
export function opsChipPresentation(
  planet: NexusPlanet | undefined,
  loadState: OpsChipLoadState,
): OpsChipPresentation {
  if (loadState === 'error') {
    return { blurb: "Couldn't load", dotColor: null };
  }
  if (loadState === 'loading') {
    return { blurb: '…', dotColor: '#64748B' };
  }
  if (!planet || planet.status === 'error') {
    return { blurb: "Couldn't load", dotColor: null };
  }
  return {
    blurb: planet.metricLabel,
    dotColor: PLANET_STATUS_COLOR[planet.status as PlanetStatus],
  };
}
