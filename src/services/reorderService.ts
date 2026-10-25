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
  /** Latest run without an error, ISO with offset. Null before the first run. */
  last_run_at?: string | null;
}

/** GET/PUT /reorder/settings. timezone and tenant_id are read-only. */
export interface ReorderSettings {
  tenant_id: number;
  demand_window_days: number;
  safety_factor: number;
  default_lead_time_days: number;
  min_days_of_cover_alert: number;
  digest_enabled: boolean;
  digest_recipients: string | null;
  digest_hour_local: number;
  timezone: string;
}

export type ReorderSettingsUpdate = Partial<Omit<ReorderSettings, 'tenant_id' | 'timezone'>>;

/** Backend SettingsBody ranges (app/api/reorder.py). */
export const REORDER_SETTING_RANGES = {
  demand_window_days: { min: 7, max: 365 },
  safety_factor: { min: 1.0, max: 5.0 },
  default_lead_time_days: { min: 1, max: 365 },
  min_days_of_cover_alert: { min: 0, max: 365 },
  digest_hour_local: { min: 0, max: 23 },
} as const;

export interface ReorderRun {
  id: number;
  tenant_id: number;
  run_at: string | null;
  trigger: 'manual' | 'scheduled';
  due_count: number;
  suppliers_json: ReorderSupplierSummary[];
  digest_sent: boolean;
  error: string | null;
}

export interface SuggestSettings {
  product_id: number;
  suggested_reorder_point: number;
  suggested_reorder_qty: number;
  avg_daily: number;
  lead_time: number;
  safety_factor: number;
  pack_qty: number | null;
  demand_window_days: number;
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

/** Backend error text: string detail, or FastAPI 422 list as "field: msg". Shared by the agent services. */
export async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    // FastAPI 422: [{loc: [..., field], msg}] -> "field: msg"
    return detail
      .map((item: { msg?: string; loc?: Array<string | number> }) => {
        const field = item.loc?.[item.loc.length - 1] ?? 'field';
        return `${field}: ${item.msg ?? 'invalid'}`;
      })
      .join('; ');
  }
  return `HTTP ${res.status}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

function sendJson<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
  return readJson<T>(ledgerQuery(path, {}), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return sendJson<T>('POST', path, body);
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

/** DELETE /reorder/snooze/{product_id}. 404 when the product has no snooze. */
export function unsnoozeProduct(productId: number): Promise<{ product_id: number; snoozed: false }> {
  return readJson(ledgerQuery(`/reorder/snooze/${productId}`, {}), { method: 'DELETE' });
}

export function getReorderSettings(): Promise<ReorderSettings> {
  return readJson<ReorderSettings>(ledgerQuery('/reorder/settings', {}));
}

/** Partial PUT: fields left out keep their value on the server. */
export function updateReorderSettings(changes: ReorderSettingsUpdate): Promise<ReorderSettings> {
  return sendJson<ReorderSettings>('PUT', '/reorder/settings', changes);
}

export function runReorderNow(): Promise<ReorderRun> {
  return postJson<ReorderRun>('/reorder/run', {});
}

export function getReorderRuns(limit = 30): Promise<ReorderRun[]> {
  return readJson<ReorderRun[]>(ledgerQuery('/reorder/runs', { limit }));
}

/** Read-only. The backend never writes the product here. */
export function getSuggestSettings(productId: number): Promise<SuggestSettings> {
  return readJson<SuggestSettings>(ledgerQuery(`/reorder/products/${productId}/suggest-settings`, {}));
}

/** One draft PO for one supplier. Unit cost is left to the backend. */
export function createReorderDraftPo(supplierId: number, lines: DraftPoLine[]): Promise<DraftPoResult> {
  return postJson<DraftPoResult>('/reorder/draft-po', { supplier_id: supplierId, lines });
}
