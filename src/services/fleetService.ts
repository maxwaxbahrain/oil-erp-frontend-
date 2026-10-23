import { authFetch } from '../api/axios';
import { getOilErpApiBase } from '../config/apiBase';

export type FleetMileageSource = 'gps' | 'odometer';
export type FleetDistanceUnit = 'miles' | 'km';

export interface FleetMileageVanRow {
  van_id: string;
  van_name: string;
  distance: number;
  stops: number;
  source: FleetMileageSource;
  ping_count: number;
}

export interface FleetMileageDayRow {
  day: string;
  vans: FleetMileageVanRow[];
  total_distance: number;
  total_stops: number;
}

export interface FleetMileageReport {
  unit: FleetDistanceUnit;
  days: FleetMileageDayRow[];
  total_distance: number;
  total_stops: number;
}

export interface FleetMileageRecomputeResult {
  day: string;
  tenant_id: number;
  vans_updated: number;
}

function fleetMileageQuery(from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function normalizeVan(raw: Record<string, unknown>): FleetMileageVanRow {
  const sourceRaw = String(raw.source ?? 'gps').toLowerCase();
  const source: FleetMileageSource = sourceRaw === 'odometer' ? 'odometer' : 'gps';
  return {
    van_id: String(raw.van_id ?? ''),
    van_name: String(raw.van_name ?? ''),
    distance: Number(raw.distance) || 0,
    stops: Number(raw.stops) || 0,
    source,
    ping_count: Number(raw.ping_count) || 0,
  };
}

function normalizeDay(raw: Record<string, unknown>): FleetMileageDayRow {
  const vansRaw = Array.isArray(raw.vans) ? raw.vans : [];
  return {
    day: String(raw.day ?? ''),
    vans: vansRaw.map((v) => normalizeVan(v as Record<string, unknown>)),
    total_distance: Number(raw.total_distance) || 0,
    total_stops: Number(raw.total_stops) || 0,
  };
}

function normalizeReport(body: Record<string, unknown>): FleetMileageReport {
  const unitRaw = String(body.unit ?? 'miles').toLowerCase();
  const unit: FleetDistanceUnit = unitRaw === 'km' ? 'km' : 'miles';
  const daysRaw = Array.isArray(body.days) ? body.days : [];
  return {
    unit,
    days: daysRaw.map((d) => normalizeDay(d as Record<string, unknown>)),
    total_distance: Number(body.total_distance) || 0,
    total_stops: Number(body.total_stops) || 0,
  };
}

/** Throws on HTTP error so the page can surface role="alert" (no silent empty state). */
export async function getFleetMileage(from?: string, to?: string): Promise<FleetMileageReport> {
  const r = await authFetch(`${getOilErpApiBase()}/fleet/mileage${fleetMileageQuery(from, to)}`);
  if (!r.ok) throw new Error(`Fleet mileage failed: HTTP ${r.status}`);
  const body = (await r.json()) as Record<string, unknown>;
  return normalizeReport(body);
}

/** Management-only recompute for a calendar day. */
export async function recomputeFleetMileage(day: string): Promise<FleetMileageRecomputeResult> {
  const qs = new URLSearchParams({ day }).toString();
  const r = await authFetch(`${getOilErpApiBase()}/fleet/mileage/recompute?${qs}`, {
    method: 'POST',
  });
  if (!r.ok) throw new Error(`Fleet mileage recompute failed: HTTP ${r.status}`);
  const body = (await r.json()) as Record<string, unknown>;
  return {
    day: String(body.day ?? day),
    tenant_id: Number(body.tenant_id) || 0,
    vans_updated: Number(body.vans_updated) || 0,
  };
}
