import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';
import { apiErrorDetail } from './productService';

export type PickListStatus = 'draft' | 'released' | 'picking' | 'picked' | 'dispatched' | 'delivered' | 'cancelled';
export type ShortageResolution = 'open' | 'backorder' | 'credited' | 'ignored';
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
  driverId: number | null;
  dispatchedAt: string | null;
  manifestNumber: string | null;
  deliveredAt: string | null;
  hasFailedDelivery: boolean | null;
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
  /** Lot-tracked: the FEFO split an issue of qtyRequired would take at this bin now. */
  lots: PickLineLot[];
  lotsPicked: { lotId: number; lotNumber: string | null; qty: number }[] | null;
}

export interface PickLineLot {
  lotId: number | null;
  lotNumber: string;
  expiryDate: string | null;
  qty: number;
}

export interface PickShortage {
  invoiceId: number;
  productId: number;
  required: number;
  picked: number;
}

export interface ShortageRow {
  id: number;
  pickListId: number | null;
  pickListLineId: number | null;
  pickListNumber: string | null;
  invoiceId: number;
  invoiceNumber: string | null;
  customerName: string | null;
  productId: number;
  sku: string | null;
  productName: string | null;
  qtyShort: number;
  resolution: ShortageResolution;
  backorderQtyOpen: number | null;
  salesReturnId: number | null;
  resolvedAt: string | null;
  note: string | null;
}

export interface ResolveShortageInput {
  mode: 'backorder' | 'credited' | 'ignored';
  note?: string;
}

export interface ListShortagesQuery {
  resolution?: string;
  invoiceId?: number;
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
  /** Lot-tracked: what the picker took, for the record. */
  lotsPicked?: { lotId: number; qty: number }[];
}

export interface DispatchPickListInput {
  vanId: string;
  driverId: number;
  note?: string;
}

export interface PickManifestLine {
  sku: string | null;
  name: string | null;
  qtyRequired: number;
  qtyPicked: number;
  short: boolean;
}

export interface PickManifestStop {
  invoiceNumber: string | null;
  customerName: string | null;
  address: string | null;
  phone: string | null;
  lines: PickManifestLine[];
  invoiceTotal: number | null;
  paymentTerms: string | null;
}

export interface PickManifest {
  manifestNumber: string | null;
  dispatchedAt: string | null;
  van: { code: string | null; plate: string | null };
  driverName: string | null;
  stops: PickManifestStop[];
  totals: { stops: number; units: number; shortLines: number };
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

function optBool(value: unknown): boolean | null {
  if (value == null || value === '') return null;
  return Boolean(value);
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
    lots: Array.isArray(raw.lots)
      ? (raw.lots as Record<string, unknown>[]).map((lot) => ({
        lotId: optNum(lot.lot_id),
        lotNumber: String(lot.lot_number ?? ''),
        expiryDate: optStr(lot.expiry_date),
        qty: num(lot.qty),
      }))
      : [],
    lotsPicked: Array.isArray(raw.lots_picked)
      ? (raw.lots_picked as Record<string, unknown>[]).map((lot) => ({
        lotId: num(lot.lot_id),
        lotNumber: optStr(lot.lot_number),
        qty: num(lot.qty),
      }))
      : null,
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
    driverId: optNum(raw.driver_id ?? raw.driverId),
    dispatchedAt: optStr(raw.dispatched_at ?? raw.dispatchedAt),
    manifestNumber: optStr(raw.manifest_number ?? raw.manifestNumber),
    deliveredAt: optStr(raw.delivered_at ?? raw.deliveredAt),
    hasFailedDelivery: optBool(raw.has_failed_delivery ?? raw.hasFailedDelivery),
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
    cache: 'no-store',
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

export async function recordPick(listId: number, lineId: number, input: RecordPickInput): Promise<PickListDetail> {
  const body: Record<string, unknown> = { qty: input.qty };
  if (input.pickedLocationId != null) body.picked_location_id = input.pickedLocationId;
  if (input.note) body.note = input.note;
  if (input.lotsPicked && input.lotsPicked.length > 0) {
    body.lots_picked = input.lotsPicked.map((lot) => ({ lot_id: lot.lotId, qty: lot.qty }));
  }
  return mapDetail(await request(`/pick-lists/${listId}/lines/${lineId}/pick`, {
    method: 'POST',
    body: JSON.stringify(body),
  }));
}

export async function getPickListForInvoice(invoiceId: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/for-invoice/${invoiceId}`));
}

export async function dispatchPickList(id: number, input: DispatchPickListInput): Promise<PickListDetail> {
  const body: Record<string, unknown> = { van_id: input.vanId, driver_id: input.driverId };
  if (input.note) body.note = input.note;
  return mapDetail(await request(`/pick-lists/${id}/dispatch`, { method: 'POST', body: JSON.stringify(body) }));
}

export async function undispatchPickList(id: number): Promise<PickListDetail> {
  return mapDetail(await request(`/pick-lists/${id}/undispatch`, { method: 'POST' }));
}

function mapManifestLine(raw: Record<string, unknown>): PickManifestLine {
  return {
    sku: optStr(raw.sku),
    name: optStr(raw.name ?? raw.product_name),
    qtyRequired: num(raw.qty_required ?? raw.qtyRequired),
    qtyPicked: num(raw.qty_picked ?? raw.qtyPicked),
    short: Boolean(raw.short),
  };
}

function mapManifest(raw: unknown): PickManifest {
  const row = asRecord(raw) ?? {};
  const van = asRecord(row.van) ?? {};
  const totals = asRecord(row.totals) ?? {};
  const stops = Array.isArray(row.stops) ? row.stops : [];
  return {
    manifestNumber: optStr(row.manifest_number ?? row.manifestNumber),
    dispatchedAt: optStr(row.dispatched_at ?? row.dispatchedAt),
    van: {
      code: optStr(van.code ?? van.van_number),
      plate: optStr(van.plate ?? van.vehicle_number),
    },
    driverName: optStr(row.driver_name ?? row.driverName),
    stops: stops.map((stop) => {
      const item = asRecord(stop) ?? {};
      const lines = Array.isArray(item.lines) ? item.lines : [];
      return {
        invoiceNumber: optStr(item.invoice_number ?? item.invoiceNumber),
        customerName: optStr(item.customer_name ?? item.customerName),
        address: optStr(item.address),
        phone: optStr(item.phone),
        lines: lines.map((line) => mapManifestLine(asRecord(line) ?? {})),
        invoiceTotal: optNum(item.invoice_total ?? item.invoiceTotal),
        paymentTerms: optStr(item.payment_terms ?? item.paymentTerms),
      };
    }),
    totals: {
      stops: num(totals.stops),
      units: num(totals.units),
      shortLines: num(totals.short_lines ?? totals.shortLines),
    },
  };
}

export async function getManifest(id: number): Promise<PickManifest> {
  return mapManifest(await request(`/pick-lists/${id}/manifest`));
}

const SHORTAGE_RESOLUTIONS = new Set(['open', 'backorder', 'credited', 'ignored']);

function mapShortageRow(raw: Record<string, unknown>): ShortageRow {
  const resolution = String(raw.resolution || 'open');
  return {
    id: num(raw.id),
    pickListId: optNum(raw.pick_list_id ?? raw.pickListId),
    pickListLineId: optNum(raw.pick_list_line_id ?? raw.pickListLineId),
    pickListNumber: optStr(raw.pick_list_number ?? raw.pickListNumber),
    invoiceId: num(raw.invoice_id ?? raw.invoiceId),
    invoiceNumber: optStr(raw.invoice_number ?? raw.invoiceNumber),
    customerName: optStr(raw.customer_name ?? raw.customerName),
    productId: num(raw.product_id ?? raw.productId),
    sku: optStr(raw.sku),
    productName: optStr(raw.product_name ?? raw.productName ?? raw.name),
    qtyShort: num(raw.qty_short ?? raw.qtyShort),
    resolution: (SHORTAGE_RESOLUTIONS.has(resolution) ? resolution : 'open') as ShortageResolution,
    backorderQtyOpen: optNum(raw.backorder_qty_open ?? raw.backorderQtyOpen),
    salesReturnId: optNum(raw.sales_return_id ?? raw.salesReturnId),
    resolvedAt: optStr(raw.resolved_at ?? raw.resolvedAt),
    note: optStr(raw.note),
  };
}

function shortageRows(raw: unknown): ShortageRow[] {
  const list = Array.isArray(raw)
    ? raw
    : (asRecord(raw)?.items ?? asRecord(raw)?.shortages ?? asRecord(raw)?.rows);
  if (!Array.isArray(list)) return [];
  return list.map((row) => mapShortageRow(asRecord(row) ?? {})).filter((row) => row.id > 0);
}

export async function listShortages(pickListId: number): Promise<ShortageRow[]> {
  return shortageRows(await request(`/pick-lists/${pickListId}/shortages`));
}

export async function listOpenShortages(query: ListShortagesQuery = {}): Promise<ShortageRow[]> {
  const params = new URLSearchParams();
  if (query.resolution) params.set('resolution', query.resolution);
  if (query.invoiceId != null) params.set('invoice_id', String(query.invoiceId));
  const qs = params.toString();
  return shortageRows(await request(`/shortages${qs ? `?${qs}` : ''}`));
}

export async function resolveShortage(id: number, input: ResolveShortageInput): Promise<ShortageRow> {
  const body: Record<string, unknown> = { mode: input.mode };
  if (input.note) body.note = input.note;
  const raw = asRecord(await request(`/shortages/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })) ?? {};
  const row = mapShortageRow(raw);
  if (row.id > 0) return row;
  return { ...row, id };
}

export async function hydrateShortageLabels(rows: ShortageRow[]): Promise<ShortageRow[]> {
  const ids = [...new Set(rows.filter((row) => row.pickListId && !row.pickListNumber).map((row) => row.pickListId as number))];
  if (!ids.length) return rows;
  const lists = await Promise.all(ids.map((id) => getPickList(id).catch(() => null)));
  const byId = new Map(lists.filter((list): list is PickListDetail => list != null).map((list) => [list.id, list]));
  return rows.map((row) => {
    const list = row.pickListId == null ? undefined : byId.get(row.pickListId);
    if (!list) return row;
    const line = list.lines.find((item) => item.id === row.pickListLineId)
      ?? list.lines.find((item) => item.invoiceId === row.invoiceId && item.productId === row.productId);
    return {
      ...row,
      pickListNumber: row.pickListNumber ?? (list.number || null),
      invoiceNumber: row.invoiceNumber ?? line?.invoiceNumber ?? null,
      customerName: row.customerName ?? line?.customerName ?? null,
      sku: row.sku ?? line?.sku ?? null,
      productName: row.productName ?? line?.productName ?? null,
    };
  });
}
