/**
 * Inventory valuation and cost revaluation history (app/api/inventory_ledger.py).
 * Every number comes from the backend; nothing here computes stock or money.
 */
import { authFetch } from '../api/axios';
import { API_BASE_URL } from './api';
import { parseError } from './reorderService';

/** valuation() row in app/services/inventory_valuation.py. */
export interface ValuationRow {
  product_id: number;
  sku: string | null;
  name: string | null;
  on_hand: number;
  cost: number;
  value: number;
  last_receipt_cost: number | null;
  last_movement_date: string | null;
  cost_method: string;
}

export interface ValuationReport {
  as_of: string | null;
  rows: ValuationRow[];
  totals: { products: number; units: number; value: number };
  gl_inventory: number;
  /** Null when a category or search filter narrows the rows. */
  difference: number | null;
}

export interface ValuationParams {
  /** YYYY-MM-DD. Blank means today. */
  as_of?: string;
  category_id?: number;
  search?: string;
}

/** revaluation_dict in app/services/cost_revaluation.py. */
export interface CostRevaluation {
  id: number;
  product_id: number;
  old_cost: number;
  new_cost: number;
  quantity: number;
  amount: number;
  journal_entry_id: number | null;
  reason: string | null;
  source: 'product_edit' | 'csv_import' | 'sku_merge' | 'manual';
  created_by: number | null;
  created_at: string | null;
}

function query(path: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ''}`;
}

function valuationParams(params: ValuationParams): Record<string, string | number | undefined> {
  return {
    as_of: params.as_of || undefined,
    category_id: params.category_id,
    search: params.search?.trim() || undefined,
  };
}

async function readJson<T>(url: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export function getValuation(params: ValuationParams = {}): Promise<ValuationReport> {
  return readJson<ValuationReport>(query('/inventory/valuation', valuationParams(params)));
}

export function valuationCsvUrl(params: ValuationParams = {}): string {
  return query('/inventory/valuation.csv', valuationParams(params));
}

/** Fetch the CSV with the session's auth and hand it to the browser as a file. */
export async function downloadValuationCsv(params: ValuationParams = {}): Promise<void> {
  const res = await authFetch(valuationCsvUrl(params));
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `inventory-valuation${params.as_of ? `-${params.as_of}` : ''}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function listRevaluations(productId?: number, limit?: number): Promise<CostRevaluation[]> {
  const body = await readJson<{ revaluations: CostRevaluation[] }>(
    query('/inventory/revaluations', { product_id: productId, limit }),
  );
  return body.revaluations ?? [];
}
