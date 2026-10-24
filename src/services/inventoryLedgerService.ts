/**
 * Warehouse ledger reads. Dates in the JSON are YYYY-MM-DD strings.
 */
import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

export interface MovementWindow {
  lines: number;
  units: number;
  value: number;
}

export interface TopMover {
  product_id: number;
  name: string;
  units_out: number;
}

export interface InventorySummary {
  products_active: number;
  units_on_hand: number;
  stock_value_at_cost: number;
  gl_inventory_1200: number;
  gl_difference: number;
  received_30d: MovementWindow;
  received_90d: MovementWindow;
  returned_to_supplier_30d: MovementWindow;
  returned_to_supplier_90d: MovementWindow;
  customer_returns_restocked_30d: MovementWindow;
  customer_returns_restocked_90d: MovementWindow;
  below_min_count: number;
  zero_stock_count: number;
  no_movement_90d_count: number;
  top_movers_90d: TopMover[];
  ledger_drift_count: number;
}

export interface OnHandLocationBreakdown {
  location_id: number | null;
  code: string | null;
  kind: string | null;
  path: string | null;
  on_hand: number;
}

export interface OnHandRow {
  product_id: number;
  name: string;
  sku: string;
  unit: string;
  on_hand: number;
  stock_cached: number;
  cost: number;
  value_at_cost: number;
  min_stock: number;
  last_movement_date: string | null;
  days_since_movement: number | null;
  drift: boolean;
  by_location?: OnHandLocationBreakdown[];
}

export interface OnHandPage {
  total: number;
  totals: {
    products: number;
    units: number;
    value_at_cost: number;
  };
  rows: OnHandRow[];
}

export interface OnHandQuery {
  search?: string;
  below_min?: boolean;
  zero?: boolean;
  location_id?: number;
  path_prefix?: string;
  by_location?: boolean;
  limit?: number;
  offset?: number;
}

export interface InventoryMovement {
  id: number;
  entry_date: string;
  source_type: string;
  source_id: string;
  reference: string | null;
  movement_type: string;
  quantity_delta: number;
  stock_before: number;
  stock_after: number;
  unit_cost: number | null;
  journal_entry_id: number | null;
  product_id: number;
  product_name: string;
  sku: string;
  note: string | null;
  created_at: string | null;
  location_id: number | null;
  location_code: string | null;
  location_path: string | null;
}

export interface MovementsPage {
  total: number;
  rows: InventoryMovement[];
}

export interface MovementsQuery {
  product_id?: number;
  location_id?: number;
  source_type?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return JSON.stringify(detail);
  return `HTTP ${res.status}`;
}

/** Query string for the ledger GETs. False and blank values are omitted. */
export function ledgerQuery(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, value === true ? 'true' : String(value));
  }
  const qs = search.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

export function getInventorySummary(): Promise<InventorySummary> {
  return readJson<InventorySummary>(ledgerQuery('/inventory/summary', {}));
}

export function getOnHand(query: OnHandQuery = {}): Promise<OnHandPage> {
  return readJson<OnHandPage>(ledgerQuery('/inventory/on-hand', {
    search: query.search?.trim(),
    below_min: query.below_min,
    zero: query.zero,
    location_id: query.location_id,
    path_prefix: query.path_prefix?.trim(),
    by_location: query.by_location,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  }));
}

export interface ProductLocationOnHand {
  locationId: number | null;
  code: string | null;
  kind: string | null;
  onHand: number;
}

export interface ProductOnHand {
  onHand: number;
  byLocation: ProductLocationOnHand[];
}

/** One product's ledger on-hand, including the per-location breakdown. */
export async function getProductOnHand(productId: number): Promise<ProductOnHand> {
  const page = await readJson<{
    rows: Array<OnHandRow & {
      by_location?: Array<{ location_id: number | null; code: string | null; kind: string | null; on_hand: number }>;
    }>;
  }>(ledgerQuery('/inventory/on-hand', {
    product_id: productId,
    by_location: true,
    limit: 1,
  }));
  const row = page.rows?.[0];
  if (!row) return { onHand: 0, byLocation: [] };
  return {
    onHand: Number(row.on_hand) || 0,
    byLocation: (row.by_location ?? []).map((loc) => ({
      locationId: loc.location_id,
      code: loc.code,
      kind: loc.kind,
      onHand: Number(loc.on_hand) || 0,
    })),
  };
}

export function getMovements(query: MovementsQuery = {}): Promise<MovementsPage> {
  return readJson<MovementsPage>(ledgerQuery('/inventory/movements', {
    product_id: query.product_id,
    location_id: query.location_id,
    source_type: query.source_type,
    date_from: query.date_from,
    date_to: query.date_to,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  }));
}

async function readJson<T>(url: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}
