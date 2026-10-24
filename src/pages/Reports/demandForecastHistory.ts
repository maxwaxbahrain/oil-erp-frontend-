import type { Invoice } from '../../services/api';

export const DEMAND_FORECAST_HISTORY_MONTHS = 12;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function getMonthKey(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/** Last N calendar months ending in the current month (local date). */
export function buildRollingMonthKeys(count: number, today = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    keys.push(`${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
  }
  return keys;
}

/** Status values excluded from demand-forecast sales history (normalized or raw API). */
export function isInvoiceStatusExcludedForForecast(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'void' || s === 'voided' || s === 'cancelled' || s === 'draft';
}

export function invoiceEligibleForDemandForecast(inv: Pick<Invoice, 'status' | 'invoiceDate' | 'createdAt'>, monthKeys: string[]): boolean {
  if (isInvoiceStatusExcludedForForecast(inv.status)) return false;
  const mk = getMonthKey(inv.invoiceDate || inv.createdAt || '');
  return Boolean(mk && monthKeys.includes(mk));
}

/** Count invoices that contribute line items to the forecast window (for tests). */
export function countForecastEligibleInvoices(
  invoices: Array<Pick<Invoice, 'status' | 'invoiceDate' | 'createdAt'>>,
  monthKeys: string[],
): number {
  return invoices.filter((inv) => invoiceEligibleForDemandForecast(inv, monthKeys)).length;
}

/** Triangular weights (older → lighter, recent → heavier), length `count`, sum = 1. */
export function forecastMonthWeights(count: number): number[] {
  const denom = (count * (count + 1)) / 2;
  return Array.from({ length: count }, (_, i) => (i + 1) / denom);
}
