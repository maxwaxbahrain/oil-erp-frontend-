/**
 * Demand forecast API — mirrors app/api/demand.py (ledger net demand + Holt forecast).
 */
import { authFetch } from '../api/axios';
import { ledgerQuery } from './inventoryLedgerService';

export interface DemandSummaryRow {
  product_id: number;
  name: string;
  sku: string | null;
  pack_qty: number | null;
  pack_unit: string | null;
  on_hand_units: number;
  avg_daily: number;
  trend_pct: number;
  forecast_units: number | null;
  low: number | null;
  high: number | null;
  days_of_cover: number | null;
  stockout_date: string | null;
  method: 'holt_weekly' | 'no_history' | string;
}

export interface DemandSeriesPoint {
  bucket_start: string;
  units: number;
}

export interface DemandProductStats {
  avg_daily: number;
  total_units: number;
  total: number;
  days_with_sales: number;
  last_sale_date: string | null;
  last_4w_units: number;
  prior_4w_units: number;
  trend_pct: number;
}

export interface DemandProductForecast {
  method: string;
  avg_daily: number;
  trend_pct: number;
  forecasts: Record<number, number | null>;
  low: Record<number, number | null>;
  high: Record<number, number | null>;
  stockout_date: string | null;
  days_of_cover: number | null;
  on_hand_units: number;
}

export interface DemandProductDetail {
  product_id: number;
  series: DemandSeriesPoint[];
  stats: DemandProductStats;
  forecast: DemandProductForecast;
}

async function readJson<T>(url: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) throw new Error(`Demand API failed (${res.status})`);
  return res.json() as Promise<T>;
}

export async function getDemandSummary(params?: {
  windowDays?: number;
  horizon?: number;
  asOf?: string;
}): Promise<DemandSummaryRow[]> {
  return readJson<DemandSummaryRow[]>(
    ledgerQuery('/demand/summary', {
      window_days: params?.windowDays,
      horizon: params?.horizon,
      as_of: params?.asOf,
    }),
  );
}

export async function getProductDemand(
  productId: number,
  params?: { days?: number; bucket?: 'day' | 'week'; windowDays?: number; asOf?: string },
): Promise<DemandProductDetail> {
  return readJson<DemandProductDetail>(
    ledgerQuery(`/demand/products/${productId}`, {
      days: params?.days,
      bucket: params?.bucket,
      window_days: params?.windowDays,
      as_of: params?.asOf,
    }),
  );
}
