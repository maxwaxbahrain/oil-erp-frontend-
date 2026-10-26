import type { DeliveryNote } from '../../services/deliveryService';
import type { PickManifest, PickManifestStop } from '../../services/pickingService';

export type VanDispatchCard = {
  stops: number;
  orderValue: number;
  loaded: boolean;
  nextLabel: string | null;
};

export type DispatchedManifest = {
  vanId: string | null;
  dispatchedAt: string | null;
  manifest: PickManifest;
};

type VanKey = { id: string; van_number: string };

const EMPTY_CARD: VanDispatchCard = {
  stops: 0,
  orderValue: 0,
  loaded: false,
  nextLabel: null,
};

function customerKey(stop: PickManifestStop): string | null {
  const name = stop.customerName?.trim().toLowerCase();
  if (name) return `name:${name}`;
  const invoice = stop.invoiceNumber?.trim();
  if (invoice) return `invoice:${invoice}`;
  return null;
}

function completedInvoiceKeys(notes: DeliveryNote[]): Set<string> {
  const keys = new Set<string>();
  for (const note of notes) {
    if (note.status !== 'delivered') continue;
    const raw = note as DeliveryNote & { invoice_number?: unknown; invoiceNumber?: unknown };
    for (const value of [note.sales_order_id, raw.invoice_number, raw.invoiceNumber]) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text) keys.add(text);
    }
  }
  return keys;
}

function manifestHasCompletedDelivery(manifest: PickManifest, keys: Set<string>): boolean {
  return manifest.stops.some((stop) => {
    const invoice = stop.invoiceNumber?.trim();
    return Boolean(invoice && keys.has(invoice));
  });
}

export function formatNextStop(stop: PickManifestStop): string | null {
  const customer = stop.customerName?.trim() ?? '';
  const address = stop.address?.trim() ?? '';
  if (!customer && !address) return null;
  if (customer && address) return `${customer} · ${address}`;
  return customer || address;
}

function timeValue(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function listsForVan(van: VanKey, rows: DispatchedManifest[]): DispatchedManifest[] {
  return rows.filter((row) => row.vanId != null && (row.vanId === van.id || row.vanId === van.van_number));
}

export function buildVanDispatch(
  vans: VanKey[],
  rows: DispatchedManifest[],
  deliveredNotes: DeliveryNote[],
): { totalStops: number; byVanId: Record<string, VanDispatchCard> } {
  const completed = completedInvoiceKeys(deliveredNotes);
  const byVanId: Record<string, VanDispatchCard> = {};
  let totalStops = 0;

  for (const van of vans) {
    const mine = listsForVan(van, rows);
    if (mine.length === 0) {
      byVanId[van.id] = EMPTY_CARD;
      continue;
    }

    const customers = new Set<string>();
    const invoices = new Set<string>();
    let orderValue = 0;
    for (const row of mine) {
      for (const stop of row.manifest.stops) {
        const key = customerKey(stop);
        if (key) customers.add(key);
        const invoice = stop.invoiceNumber?.trim();
        if (invoice && invoices.has(invoice)) continue;
        if (invoice) invoices.add(invoice);
        if (stop.invoiceTotal != null) orderValue += stop.invoiceTotal;
      }
    }

    const open = mine
      .filter((row) => !manifestHasCompletedDelivery(row.manifest, completed))
      .sort((a, b) => timeValue(a.manifest.dispatchedAt ?? a.dispatchedAt) - timeValue(b.manifest.dispatchedAt ?? b.dispatchedAt));
    const firstStop = open[0]?.manifest.stops[0];
    const stops = customers.size;
    totalStops += stops;
    byVanId[van.id] = {
      stops,
      orderValue,
      loaded: true,
      nextLabel: firstStop ? formatNextStop(firstStop) : null,
    };
  }

  return { totalStops, byVanId };
}
