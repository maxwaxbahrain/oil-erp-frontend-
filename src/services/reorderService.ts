/**
 * Reorder planning. Every number comes from /reorder on the backend; nothing
 * here computes stock or reorder quantities. Dates are YYYY-MM-DD strings.
 */
import { authFetch } from '../api/axios';
import { ledgerQuery } from './inventoryLedgerService';

export interface ReorderSuggestion {
  product_id: number;
  sku: string | null;
  name: string | null;
  on_hand: number;
  on_order: number;
  projected: number;
  avg_daily: number;
  days_of_cover: number | null;
  effective_reorder_point: number | null;
  lead_time: number;
  suggested_qty: number;
  suggested_packs: number | null;
  supplier_id: number | null;
  supplier_name: string | null;
  due: boolean;
  snoozed_until: string | null;
  last_sale_date: string | null;
}

export interface ReorderSupplierSummary {
  supplier_id: number | null;
  supplier_name: string | null;
  due_count: number;
  suggested_value: number;
}

export interface ReorderSummary {
  due_count: number;
  suppliers: ReorderSupplierSummary[];
}

export interface DemandSeries {
  series: Array<{ date: string; qty: number }>;
  avg_daily: number;
  total: number;
  days_with_sales: number;
  last_sale_date: string | null;
}

export interface SnoozeResult {
  product_id: number;
  until: string;
  reason: string | null;
}

export interface DraftPoLine {
  product_id: number;
  quantity: number;
}

export interface DraftPoResult {
  po_id: number;
  po_number: string;
  status: string;
}

export interface SuggestionsQuery {
  supplier_id?: number;
  only_due?: boolean;
  days?: number;
  include_snoozed?: boolean;
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return JSON.stringify(detail);
  return `HTTP ${res.status}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return readJson<T>(ledgerQuery(path, {}), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getReorderSuggestions(query: SuggestionsQuery = {}): Promise<ReorderSuggestion[]> {
  // ledgerQuery drops false values, so only_due=false is sent explicitly.
  const url = ledgerQuery('/reorder/suggestions', {
    supplier_id: query.supplier_id,
    days: query.days,
    include_snoozed: query.include_snoozed,
  });
  if (query.only_due === false) {
    return readJson<ReorderSuggestion[]>(`${url}${url.includes('?') ? '&' : '?'}only_due=false`);
  }
  return readJson<ReorderSuggestion[]>(url);
}

export function getReorderSummary(days?: number): Promise<ReorderSummary> {
  return readJson<ReorderSummary>(ledgerQuery('/reorder/suggestions/summary', { days }));
}

export function getProductDemand(productId: number, days?: number): Promise<DemandSeries> {
  return readJson<DemandSeries>(ledgerQuery(`/reorder/products/${productId}/demand`, { days }));
}

export function snoozeProduct(productId: number, until: string, reason?: string): Promise<SnoozeResult> {
  return postJson<SnoozeResult>('/reorder/snooze', { product_id: productId, until, reason: reason ?? null });
}

/** One draft PO for one supplier. Unit cost is left to the backend. */
export function createReorderDraftPo(supplierId: number, lines: DraftPoLine[]): Promise<DraftPoResult> {
  return postJson<DraftPoResult>('/reorder/draft-po', { supplier_id: supplierId, lines });
}
