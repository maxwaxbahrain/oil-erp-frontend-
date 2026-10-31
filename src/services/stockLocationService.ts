import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';
import { apiErrorDetail } from './productService';
import { ledgerQuery } from './inventoryLedgerService';

export interface StockLocationNode {
  id: number;
  code: string;
  name: string;
  kind: string;
  vanId: string | null;
  isActive: boolean;
  parentId: number | null;
  path: string | null;
  sortOrder: number | null;
  capacityUnits: number | null;
  barcode: string | null;
  onHandUnits?: number | null;
  pct?: number | null;
  children?: StockLocationNode[];
}

export interface PutawaySuggestion {
  locationId: number;
  code: string;
  path: string | null;
  reason: string;
}

export interface LocationOnHandRow {
  productId: number;
  sku: string | null;
  name: string | null;
  onHand: number;
  /** Lot-tracked products: lot balances here. Empty otherwise. */
  lots?: { lot_number: string; expiry_date: string | null; qty: number }[];
}

export interface LocationTransferRecord {
  sourceId: string;
  productId: number;
  fromLocationId: number | null;
  toLocationId: number | null;
  quantity: number | null;
  reference: string | null;
  note: string | null;
  journalEntryId: number | null;
}

type RawLocation = Record<string, unknown>;

function mapLocation(raw: RawLocation, children?: StockLocationNode[]): StockLocationNode {
  return {
    id: Number(raw.id),
    code: String(raw.code ?? ''),
    name: String(raw.name ?? ''),
    kind: String(raw.kind ?? ''),
    vanId: raw.van_id != null ? String(raw.van_id) : null,
    isActive: raw.is_active !== false,
    parentId: raw.parent_id != null ? Number(raw.parent_id) : null,
    path: raw.path != null ? String(raw.path) : null,
    sortOrder: raw.sort_order != null ? Number(raw.sort_order) : null,
    capacityUnits: raw.capacity_units != null ? Number(raw.capacity_units) : null,
    barcode: raw.barcode != null ? String(raw.barcode) : null,
    onHandUnits: raw.on_hand_units != null ? Number(raw.on_hand_units) : null,
    pct: raw.pct != null ? Number(raw.pct) : null,
    children,
  };
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init);
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(apiErrorDetail(raw) || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function mapTree(nodes: RawLocation[]): StockLocationNode[] {
  return nodes.map((node) => {
    const kids = Array.isArray(node.children) ? mapTree(node.children as RawLocation[]) : undefined;
    return mapLocation(node, kids);
  });
}

export function allowedChildKinds(parentKind: string): string[] {
  // Mirrors _PARENT_KINDS in app/services/stock_locations.py create_location.
  switch (parentKind) {
    case 'warehouse':
      return ['zone'];
    case 'zone':
      return ['aisle'];
    case 'aisle':
      return ['rack', 'bin'];
    case 'rack':
      return ['bin'];
    default:
      return [];
  }
}

export function isStockHoldingKind(kind: string): boolean {
  return kind === 'bin' || kind === 'warehouse' || kind === 'van';
}

export function flattenLocationTree(nodes: StockLocationNode[]): StockLocationNode[] {
  const out: StockLocationNode[] = [];
  const walk = (list: StockLocationNode[]) => {
    for (const node of list) {
      out.push({ ...node, children: undefined });
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export async function getLocationTree(kind?: string): Promise<StockLocationNode[]> {
  const payload = await readJson<{ locations: RawLocation[] }>(
    ledgerQuery('/inventory/locations', { tree: true, kind: kind?.trim() || undefined }),
  );
  return mapTree(payload.locations ?? []);
}

export async function getLocationsFlat(): Promise<StockLocationNode[]> {
  const payload = await readJson<{ locations: RawLocation[] }>(
    ledgerQuery('/inventory/locations', {}),
  );
  return (payload.locations ?? []).map((row) => mapLocation(row));
}

export async function createLocation(body: {
  code: string;
  name: string;
  kind: string;
  parentId?: number | null;
  sortOrder?: number | null;
  capacityUnits?: number | null;
  barcode?: string | null;
}): Promise<StockLocationNode> {
  const row = await readJson<RawLocation>(`${API_BASE_URL}/inventory/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: body.code,
      name: body.name,
      kind: body.kind,
      parent_id: body.parentId ?? null,
      sort_order: body.sortOrder ?? null,
      capacity_units: body.capacityUnits ?? null,
      barcode: body.barcode ?? null,
    }),
  });
  return mapLocation(row);
}

export async function updateLocation(
  id: number,
  body: {
    name?: string;
    isActive?: boolean;
    sortOrder?: number | null;
    capacityUnits?: number | null;
    barcode?: string | null;
  },
): Promise<StockLocationNode> {
  const row = await readJson<RawLocation>(`${API_BASE_URL}/inventory/locations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: body.name,
      is_active: body.isActive,
      sort_order: body.sortOrder,
      capacity_units: body.capacityUnits,
      barcode: body.barcode,
    }),
  });
  return mapLocation(row);
}

export async function deactivateLocation(id: number): Promise<StockLocationNode> {
  const row = await readJson<RawLocation>(`${API_BASE_URL}/inventory/locations/${id}/deactivate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return mapLocation(row);
}

export async function getLocationOnHand(id: number): Promise<LocationOnHandRow[]> {
  const payload = await readJson<{ rows: RawLocation[] }>(
    ledgerQuery(`/inventory/locations/${id}/on-hand`, {}),
  );
  return (payload.rows ?? []).map((row) => ({
    productId: Number(row.product_id),
    sku: row.sku != null ? String(row.sku) : null,
    name: row.name != null ? String(row.name) : null,
    onHand: Number(row.on_hand) || 0,
    lots: Array.isArray(row.lots) ? (row.lots as LocationOnHandRow['lots']) : [],
  }));
}

export async function postTransfer(body: {
  productId: number;
  fromLocationId: number;
  toLocationId: number;
  quantity: number;
  reference?: string;
  note?: string;
}): Promise<void> {
  await readJson(`${API_BASE_URL}/inventory/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: body.productId,
      from_location_id: body.fromLocationId,
      to_location_id: body.toLocationId,
      quantity: body.quantity,
      reference: body.reference ?? null,
      note: body.note ?? null,
    }),
  });
}

export async function suggestPutaway(productId: number, quantity: number): Promise<PutawaySuggestion> {
  const row = await readJson<Record<string, unknown>>(
    ledgerQuery('/inventory/putaway-suggest', { product_id: productId, quantity }),
  );
  return {
    locationId: Number(row.location_id),
    code: String(row.code ?? ''),
    path: row.path != null ? String(row.path) : null,
    reason: String(row.reason ?? ''),
  };
}

export async function lookupLocationByBarcode(code: string): Promise<StockLocationNode> {
  const row = await readJson<RawLocation>(
    ledgerQuery('/inventory/locations/lookup', { barcode: code.trim() }),
  );
  return mapLocation(row);
}

export async function getTransfers(productId?: number, limit = 50): Promise<LocationTransferRecord[]> {
  const payload = await readJson<{ transfers: RawLocation[] }>(
    ledgerQuery('/inventory/transfers', { product_id: productId, limit }),
  );
  return (payload.transfers ?? []).map((row) => ({
    sourceId: String(row.source_id ?? ''),
    productId: Number(row.product_id),
    fromLocationId: row.from_location_id != null ? Number(row.from_location_id) : null,
    toLocationId: row.to_location_id != null ? Number(row.to_location_id) : null,
    quantity: row.quantity != null ? Number(row.quantity) : null,
    reference: row.reference != null ? String(row.reference) : null,
    note: row.note != null ? String(row.note) : null,
    journalEntryId: row.journal_entry_id != null ? Number(row.journal_entry_id) : null,
  }));
}
