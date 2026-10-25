/**
 * Lots and expiry (app/api/stock_lots.py). Every quantity and date comes from the
 * backend; nothing here computes stock or dates.
 */
import { authFetch } from '../api/axios';
import { API_BASE_URL } from './api';
import { parseError } from './reorderService';

/** lot_balances() row. */
export interface LotBalance {
  lot_id: number;
  lot_number: string;
  expiry_date: string | null;
  product_id: number;
  location_id: number | null;
  qty: number;
}

/** expiring() row. */
export interface ExpiringLot extends LotBalance {
  days_left: number;
  expired: boolean;
}

/** lot_dict(). */
export interface StockLot {
  id: number;
  product_id: number;
  lot_number: string;
  expiry_date: string | null;
  received_date: string | null;
  supplier_id: number | null;
  source_grn_id: string | null;
  note: string | null;
  unassigned: boolean;
}

export interface LotMovement {
  id: number;
  stock_movement_id: number | null;
  location_id: number | null;
  quantity_delta: number;
  entry_date: string | null;
  source_type: string;
  source_id: string | null;
  movement_type: string | null;
  reference: string | null;
}

export interface StockLotDetail extends StockLot {
  balances: LotBalance[];
  movements: LotMovement[];
}

export interface LotTrackingResult {
  product_id: number;
  lot_tracked: boolean;
  expiry_tracked: boolean;
  seeded: { location_id: number | null; qty: number }[];
}

/** A lot split as on-hand and movement rows carry it. */
export interface LotQty {
  lot_number: string;
  expiry_date?: string | null;
  qty: number;
}

function url(path: string, params: Record<string, string | number | boolean | undefined | null> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return `${API_BASE_URL}/inventory${path}${qs ? `?${qs}` : ''}`;
}

async function readJson<T>(target: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(target, init);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

function send<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
  return readJson<T>(url(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getLotBalances(productId?: number, locationId?: number, includeEmpty = false): Promise<LotBalance[]> {
  const body = await readJson<{ lots: LotBalance[] }>(
    url('/lots', { product_id: productId, location_id: locationId, include_empty: includeEmpty }),
  );
  return body.lots ?? [];
}

export async function getExpiringLots(withinDays = 30, includeExpired = true): Promise<ExpiringLot[]> {
  const body = await readJson<{ lots: ExpiringLot[] }>(
    // include_expired defaults to true on the backend, so only false is sent.
    `${url('/lots/expiring', { within_days: withinDays })}${includeExpired ? '' : '&include_expired=false'}`,
  );
  return body.lots ?? [];
}

export function getLot(id: number): Promise<StockLotDetail> {
  return readJson<StockLotDetail>(url(`/lots/${id}`));
}

export function patchLot(id: number, body: { expiry_date?: string | null; note?: string | null }): Promise<StockLot> {
  return send<StockLot>('PATCH', `/lots/${id}`, body);
}

export function setLotTracking(productId: number, body: { lot_tracked: boolean; expiry_tracked: boolean }): Promise<LotTrackingResult> {
  return send<LotTrackingResult>('POST', `/products/${productId}/lot-tracking`, body);
}
