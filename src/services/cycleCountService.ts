/**
 * Cycle counts (app/api/cycle_counts.py). Every quantity and value comes from the
 * backend; nothing here computes stock or money.
 */
import { authFetch } from '../api/axios';
import { API_BASE_URL } from './api';
import { parseError } from './reorderService';

export type CountStatus = 'draft' | 'counting' | 'review' | 'approved' | 'cancelled';
export type CountScopeType = 'locations' | 'products' | 'all';
export type CountLineStatus = 'pending' | 'counted' | 'recount' | 'skipped';

/** count_dict in app/services/cycle_counts.py. Variance fields are null on blind counts for counters. */
export interface CycleCount {
  id: number;
  count_number: string;
  status: CountStatus;
  scope_type: CountScopeType;
  scope_path_prefix: string | null;
  scope_product_ids: number[] | null;
  blind: boolean;
  note: string | null;
  created_by: number | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  approved_at: string | null;
  approved_by: number | null;
  lines_total: number;
  lines_counted: number;
  variance_lines?: number | null;
  variance_units?: number | null;
  variance_value?: number | null;
  posted_value?: number | null;
}

/** line_dict. expected_qty, unit_cost, variance_* and posted_* are absent on blind counts for counters. */
export interface CycleCountLine {
  id: number;
  sequence: number;
  product_id: number;
  sku: string | null;
  name: string | null;
  location_id: number;
  location_code: string | null;
  location_path: string | null;
  counted_qty: number | null;
  status: CountLineStatus;
  counted_by: number | null;
  counted_at: string | null;
  note: string | null;
  decision?: 'post' | 'reject' | null;
  adjustment_id?: number | null;
  expected_qty?: number;
  unit_cost?: number;
  variance_qty?: number | null;
  variance_value?: number | null;
  posted_qty?: number | null;
  posted_value?: number | null;
}

export interface CycleCountDetail extends CycleCount {
  lines: CycleCountLine[];
}

/** variance_summary. */
export interface CountVariances {
  count_id: number;
  count_number: string;
  status: CountStatus;
  lines: CycleCountLine[];
  totals: { lines: number; units: number; value: number };
  by_location: {
    location_id: number;
    location_code: string | null;
    location_path: string | null;
    lines: number;
    units: number;
    value: number;
  }[];
}

export interface CountCreateBody {
  scope_type: CountScopeType;
  scope_path_prefix?: string | null;
  scope_product_ids?: number[] | null;
  blind?: boolean;
  note?: string | null;
}

function url(path: string, params: Record<string, string | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return `${API_BASE_URL}/counts${path}${qs ? `?${qs}` : ''}`;
}

/** Error carrying the HTTP status, so a page can treat a 403 quietly. */
export class CountApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CountApiError';
    this.status = status;
  }
}

async function readJson<T>(target: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(target, init);
  if (!res.ok) throw new CountApiError(await parseError(res), res.status);
  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown = {}): Promise<T> {
  return readJson<T>(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function listCounts(status?: CountStatus | ''): Promise<CycleCount[]> {
  const body = await readJson<{ counts: CycleCount[] }>(url('', { status: status || undefined }));
  return body.counts ?? [];
}

export function getCount(id: number): Promise<CycleCountDetail> {
  return readJson<CycleCountDetail>(url(`/${id}`));
}

export function createCount(body: CountCreateBody): Promise<CycleCountDetail> {
  return post<CycleCountDetail>('', body);
}

export function startCount(id: number): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/start`);
}

export function recordLine(id: number, lineId: number, countedQty: number, note?: string): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/lines/${lineId}/count`, { counted_qty: countedQty, note: note?.trim() || null });
}

export function recountLine(id: number, lineId: number): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/lines/${lineId}/recount`);
}

export function skipLine(id: number, lineId: number, note?: string): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/lines/${lineId}/skip`, { note: note?.trim() || null });
}

export function addFoundLine(id: number, productId: number, locationId: number): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/lines`, { product_id: productId, location_id: locationId });
}

export function completeCount(id: number): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/complete`);
}

export function cancelCount(id: number): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/cancel`);
}

/** Admin/manager, status review: no adjustment will be posted for this line. */
export function rejectLine(id: number, lineId: number, note?: string): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/lines/${lineId}/reject`, { note: note?.trim() || null });
}

/** Admin/manager, status review: posts each variance line as one inventory adjustment at today's cost. */
export function approveCount(id: number): Promise<CycleCountDetail> {
  return post<CycleCountDetail>(`/${id}/approve`);
}

export function getVariances(id: number): Promise<CountVariances> {
  return readJson<CountVariances>(url(`/${id}/variances`));
}
