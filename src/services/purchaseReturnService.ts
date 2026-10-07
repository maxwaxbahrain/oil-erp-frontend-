/**
 * Purchase returns — backend /api/purchase-returns/
 */
import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

export type PurchaseReturnStatus = 'draft' | 'posted' | 'cancelled';
export type RefundMode = 'none' | 'cash' | 'bank';

export interface PurchaseReturnLine {
  id: number | string;
  product_id: number;
  quantity: number;
  unit_cost: number | null;
  amount: number | null;
  reason: string;
}

export interface PurchaseReturn {
  id: number | string;
  number: string;
  supplier_id: number;
  supplier_name: string;
  date: string;
  status: PurchaseReturnStatus;
  reason: string;
  notes: string;
  total: number | null;
  refund_mode: RefundMode;
  refund_amount: number | null;
  refund_account_id: number | null;
  journal_entry_id: number | null;
  refund_journal_entry_id: number | null;
  posted_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  lines?: PurchaseReturnLine[];
}

export interface PurchaseReturnLineInput {
  product_id: number;
  quantity: number;
  reason: string;
}

export interface PurchaseReturnWriteBody {
  supplier_id: number;
  date: string;
  reason: string;
  notes: string;
  refund_mode: RefundMode;
  refund_amount: number | null;
  refund_account_id: number | null;
  lines: PurchaseReturnLineInput[];
}

export interface PurchaseReturnListFilters {
  supplier_id?: string | number | null;
  status?: string | null;
}

async function parseError(res: Response): Promise<string> {
  const j = await res.json().catch(() => ({}));
  const d = (j as { detail?: unknown }).detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return JSON.stringify(d);
  return `HTTP ${res.status}`;
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapLine(raw: Record<string, unknown>): PurchaseReturnLine {
  return {
    id: (raw.id as number | string) ?? '',
    product_id: Number(raw.product_id),
    quantity: Number(raw.quantity) || 0,
    unit_cost: numOrNull(raw.unit_cost),
    amount: numOrNull(raw.amount),
    reason: String(raw.reason ?? ''),
  };
}

function mapRow(raw: Record<string, unknown>): PurchaseReturn {
  const lines = Array.isArray(raw.lines)
    ? raw.lines.map((line) => mapLine(line as Record<string, unknown>))
    : undefined;
  const dateRaw = String(raw.date ?? '');
  return {
    id: (raw.id as number | string) ?? '',
    number: String(raw.number ?? ''),
    supplier_id: Number(raw.supplier_id),
    supplier_name: String(raw.supplier_name ?? ''),
    date: dateRaw.length >= 10 ? dateRaw.slice(0, 10) : dateRaw,
    status: String(raw.status ?? 'draft').toLowerCase() as PurchaseReturnStatus,
    reason: String(raw.reason ?? ''),
    notes: raw.notes == null ? '' : String(raw.notes),
    total: numOrNull(raw.total),
    refund_mode: String(raw.refund_mode ?? 'none') as RefundMode,
    refund_amount: numOrNull(raw.refund_amount),
    refund_account_id: numOrNull(raw.refund_account_id),
    journal_entry_id: numOrNull(raw.journal_entry_id),
    refund_journal_entry_id: numOrNull(raw.refund_journal_entry_id),
    posted_at: raw.posted_at != null ? String(raw.posted_at) : null,
    cancelled_at: raw.cancelled_at != null ? String(raw.cancelled_at) : null,
    created_at: String(raw.created_at ?? ''),
    ...(lines ? { lines } : {}),
  };
}

function listUrl(filters?: PurchaseReturnListFilters): string {
  const params = new URLSearchParams();
  if (filters?.supplier_id != null && String(filters.supplier_id) !== '') {
    params.set('supplier_id', String(filters.supplier_id));
  }
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  return `${API_BASE_URL}/purchase-returns/${qs ? `?${qs}` : ''}`;
}

export async function list(filters?: PurchaseReturnListFilters): Promise<PurchaseReturn[]> {
  const res = await authFetch(listUrl(filters));
  if (!res.ok) throw new Error(await parseError(res));
  const raw = (await res.json()) as Record<string, unknown>[];
  return raw.map(mapRow);
}

export async function get(id: string | number): Promise<PurchaseReturn> {
  const res = await authFetch(`${API_BASE_URL}/purchase-returns/${encodeURIComponent(String(id))}`);
  if (!res.ok) throw new Error(await parseError(res));
  return mapRow((await res.json()) as Record<string, unknown>);
}

export async function create(body: PurchaseReturnWriteBody): Promise<PurchaseReturn> {
  const res = await authFetch(`${API_BASE_URL}/purchase-returns/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapRow((await res.json()) as Record<string, unknown>);
}

export async function update(id: string | number, body: PurchaseReturnWriteBody): Promise<PurchaseReturn> {
  const res = await authFetch(`${API_BASE_URL}/purchase-returns/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapRow((await res.json()) as Record<string, unknown>);
}

export async function post(id: string | number): Promise<PurchaseReturn> {
  const res = await authFetch(`${API_BASE_URL}/purchase-returns/${encodeURIComponent(String(id))}/post`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapRow((await res.json()) as Record<string, unknown>);
}

export async function cancel(id: string | number): Promise<PurchaseReturn> {
  const res = await authFetch(`${API_BASE_URL}/purchase-returns/${encodeURIComponent(String(id))}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return mapRow((await res.json()) as Record<string, unknown>);
}
