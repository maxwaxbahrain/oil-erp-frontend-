import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';
import { apiErrorDetail } from './productService';

export type PickListStatus = 'draft' | 'released' | 'picking' | 'picked' | 'cancelled';
export type PickLineStatus = 'open' | 'picked' | 'short' | 'skipped';
export type PickSourceKind = 'invoice' | 'route';

export interface PickListSummary {
  id: number;
  number: string;
  status: PickListStatus;
  sourceKind: PickSourceKind;
  routeDate: string | null;
  vanId: string | null;
  assignedTo: number | null;
  createdAt: string | null;
  releasedAt: string | null;
  pickedAt: string | null;
  lineCount: number | null;
  pickedCount: number | null;
  invoiceIds: number[];
}

export interface PickLine {
  id: number;
  sequence: number;
  invoiceId: number;
  invoiceNumber: string | null;
  customerName: string | null;
  productId: number;
  sku: string | null;
  productName: string | null;
  locationId: number;
  locationCode: string | null;
  locationPath: string | null;
  qtyRequired: number;
  qtyPicked: number;
  pickedLocationId: number | null;
  status: PickLineStatus;
  note: string | null;
}

export interface PickShortage {
  invoiceId: number;
  productId: number;
  required: number;
  picked: number;
}

export interface PickListDetail extends PickListSummary {
  lines: PickLine[];
  shortages: PickShortage[];
  notes: string | null;
}

export interface PickListPage {
  total: number;
  items: PickListSummary[];
}

export class PickingRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PickingRequestError';
    this.status = status;
  }
}

export type CreatePickListInput =
  | { invoiceIds: number[]; notes?: string }
  | { routeDate: string; vanId?: string | null; notes?: string };

export interface ListPickListsQuery {
  status?: string;
  routeDate?: string;
  assignedTo?: number;
  limit?: number;
  offset?: number;
}

export interface RecordPickInput {
  qty: number;
  pickedLocationId?: number | null;
  note?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optStr(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value);
  return text.length ? text : null;
}

function mapLine(raw: Record<string, unknown>): PickLine {
  const status = String(raw.status || 'open');
  return {
    id: num(raw.id),
    sequence: num(raw.sequence),
    invoiceId: num(raw.invoice_id ?? raw.invoiceId),
    invoiceNumber: optStr(raw.invoice_number ?? raw.invoiceNumber),
    customerName: optStr(raw.customer_name ?? raw.customerName),
    productId: num(raw.product_id ?? raw.productId),
    sku: optStr(raw.sku),
    productName: optStr(raw.product_name ?? raw.productName ?? raw.name),
    locationId: num(raw.location_id ?? raw.locationId),
    locationCode: optStr(raw.location_code ?? raw.locationCode),
    locationPath: optStr(raw.location_path ?? raw.locationPath),
    qtyRequired: num(raw.qty_required ?? raw.qtyRequired),
    qtyPicked: num(raw.qty_picked ?? raw.qtyPicked),
    pickedLocationId: optNum(raw.picked_location_id ?? raw.pickedLocationId),
    status: (status === 'picked' || status === 'short' || status === 'skipped' ? status : 'open'),
    note: optStr(raw.note),
  };
}

function mapShortage(raw: Record<string, unknown>): PickShortage {
  return {
    invoiceId: num(raw.invoice_id ?? raw.invoiceId),
    productId: num(raw.product_id ?? raw.productId),
    required: num(raw.required ?? raw.qty_required ?? raw.qtyRequired),
    picked: num(raw.picked ?? raw.qty_picked ?? raw.qtyPicked),
  };
}

function invoiceIdsFrom(raw: Record<string, unknown>, lines: PickLine[]): number[] {
  const direct = raw.invoice_ids ?? raw.invoiceIds;
  if (Array.isArray(direct)) return direct.map((id) => num(id)).filter((id) => id > 0);
  return [...new Set(lines.map((line) => line.invoiceId).filter((id) => id > 0))];
}

function mapSummary(raw: Record<string, unknown>, lines?: PickLine[]): PickListSummary {
  const mappedLines = lines ?? (Array.isArray(raw.lines)
    ? raw.lines.map((line) => mapLine(asRecord(line) ?? {})).filter((line) => line.id > 0)
    : undefined);
  const hasCount = raw.line_count != null || raw.lineCount != null;
  const hasPicked = raw.picked_count != null || raw.pickedCount != null;
  let lineCount: number | null = hasCount ? num(raw.line_count ?? raw.lineCount) : null;
  let pickedCount: number | null = hasPicked ? num(raw.picked_count ?? raw.pickedCount) : null;
  if ((lineCount == null || pickedCount == null) && mappedLines) {
    if (lineCount == null) lineCount = mappedLines.length;
    if (pickedCount == null) {
      pickedCount = mappedLines.filter((line) => line.status !== 'open').length;
    }
  }
  const source = String(raw.source_kind ?? raw.sourceKind ?? (raw.route_date || raw.routeDate ? 'route' : 'invoice'));
  return {
    id: num(raw.id),
    number: optStr(raw.number) ?? '',
    status: (String(raw.status || 'draft') as PickListStatus),
    sourceKind: source === 'route' ? 'route' : 'invoice',
    routeDate: optStr(raw.route_date ?? raw.routeDate),
    vanId: optStr(raw.van_id ?? raw.vanId),
    assignedTo: optNum(raw.assigned_to ?? raw.assignedTo),
    createdAt: optStr(raw.created_at ?? raw.createdAt),
    releasedAt: optStr(raw.released_at ?? raw.releasedAt),
    pickedAt: optStr(raw.picked_at ?? raw.pickedAt),
    lineCount,
    pickedCount,
    invoiceIds: invoiceIdsFrom(raw, mappedLines ?? []),
  };
}

function mapDetail(raw: unknown): PickListDetail {
  const row = asRecord(raw);
  if (!row || row.id == null) throw new PickingRequestError('Pick list not found', 404);
  const lines = Array.isArray(row.lines)
    ? row.lines.map((line) => mapLine(asRecord(line) ?? {})).filter((line) => line.id > 0)
    : [];
  const shortages = Array.isArray(row.shortages)
    ? row.shortages.map((item) => mapShortage(asRecord(item) ?? {}))
    : [];
  return {
    ...mapSummary(row, lines),
    lines,
    shortages,
    notes: optStr(row.notes),
  };
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authFetch(`${API_BASE_URL}/picking${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new PickingRequestError(apiErrorDetail(text) || `HTTP ${response.status}`, response.status);
  }
  return response.json().catch(() => ({}));
}

function createBody(input: CreatePickListInput): Record<string, unknown> {
  if ('invoiceIds' in input) {
    const body: Record<string, unknown> = { invoice_ids: input.invoiceIds };
    if (input.notes) body.notes = input.notes;
    return body;
  }
  const body: Record<string, unknown> = { route_date: input.routeDate };
  if (input.vanId) body.van_id = input.vanId;
  if (input.notes) body.notes = input.notes;
  return body;
}

export async function listPickLists(query: ListPickListsQuery = {}): Promise<PickListPage> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.routeDate) params.set('route_date', query.routeDate);
  if (query.assignedTo != null) params.set('assigned_to', String(query.assignedTo));
  if (query.limit != null) params.set('limit', String(query.limit));
  if (query.offset != null) params.set('offset', String(query.offset));
  const qs = params.toString();
  const raw = asRecord(await request(`/pick-lists${qs ? `?${qs}` : ''}`)) ?? {};
  const rows = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.pick_lists) ? raw.pick_lists : [];
  return {
    total: num(raw.total, rows.length),
    items: rows.map((row) => mapSummary(asRecord(row) ?? {})).filter((row) => row.id > 0),
  };
}

export async function getPickList(id: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/${id}`));
}

export async function createPickList(input: CreatePickListInput): Promise<PickListDetail> {
  return mapDetail(await request('/pick-lists', { method: 'POST', body: JSON.stringify(createBody(input)) }));
}

export async function releasePickList(id: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/${id}/release`, { method: 'POST' }));
}

export async function assignPickList(id: number, userId: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  }));
}

export async function cancelPickList(id: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/${id}/cancel`, { method: 'POST' }));
}

export async function completePickList(id: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/${id}/complete`, { method: 'POST' }));
}

export async function recordPick(listId: number, lineId: number, input: RecordPickInput): Promise<void> {
  const body: Record<string, unknown> = { qty: input.qty };
  if (input.pickedLocationId != null) body.picked_location_id = input.pickedLocationId;
  if (input.note) body.note = input.note;
  await request(`/pick-lists/${listId}/lines/${lineId}/pick`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getPickListForInvoice(invoiceId: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/for-invoice/${invoiceId}`));
}
