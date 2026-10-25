/**
 * Shared low-stock rules for Dashboard, Nexus, and header alerts.
 *
 * belowMin   = active AND min_stock > 0 AND stock > 0 AND stock <= min_stock
 * outOfStock = active AND stock <= 0   (even if min_stock is 0)
 * noMinimum  = active AND (min_stock null or 0)
 * outOfStock and belowMin never overlap; outOfStock + belowMin === alertCount
 */

export type LowStockProductLike = {
  is_active?: boolean | null;
  stock?: number | null;
  current_stock?: number | null;
  min_stock?: number | null;
  minimum_stock?: number | null;
  name?: string | null;
  id?: string | number | null;
};

export type LowStockKind = 'out_of_stock' | 'below_minimum';

export type LowStockAlertItem = {
  product: LowStockProductLike;
  stock: number;
  minStock: number;
  kind: LowStockKind;
};

export type LowStockSummary = {
  belowMin: number;
  outOfStock: number;
  noMinimum: number;
  /** Unique products in belowMin ∪ outOfStock */
  alertCount: number;
  alerts: LowStockAlertItem[];
};

function isActive(p: LowStockProductLike): boolean {
  if (p.is_active === false) return false;
  // Some API payloads use 0/1 instead of boolean
  if ((p.is_active as unknown) === 0) return false;
  return true;
}

export function productStock(p: LowStockProductLike): number {
  const raw = p.current_stock ?? p.stock;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** null when unset; otherwise numeric (0 allowed). */
export function productMinStock(p: LowStockProductLike): number | null {
  if (p.min_stock == null && p.minimum_stock == null) return null;
  const n = Number(p.min_stock ?? p.minimum_stock);
  return Number.isFinite(n) ? n : null;
}

export function isBelowMinimum(p: LowStockProductLike): boolean {
  if (!isActive(p)) return false;
  const stock = productStock(p);
  if (stock <= 0) return false; // out-of-stock is a separate bucket
  const min = productMinStock(p);
  if (min == null || min <= 0) return false;
  return stock <= min;
}

export function isOutOfStock(p: LowStockProductLike): boolean {
  if (!isActive(p)) return false;
  return productStock(p) <= 0;
}

export function hasNoMinimum(p: LowStockProductLike): boolean {
  if (!isActive(p)) return false;
  const min = productMinStock(p);
  return min == null || min <= 0;
}

export function summarizeLowStock(products: LowStockProductLike[]): LowStockSummary {
  const alerts: LowStockAlertItem[] = [];
  let belowMin = 0;
  let outOfStock = 0;
  let noMinimum = 0;

  for (const product of products) {
    if (!isActive(product)) continue;
    const stock = productStock(product);
    const minRaw = productMinStock(product);
    const minStock = minRaw == null ? 0 : minRaw;

    if (minRaw == null || minStock <= 0) noMinimum += 1;

    const oos = stock <= 0;
    // Exclude OOS from belowMin so buckets never overlap
    const below = !oos && minStock > 0 && stock <= minStock;
    if (oos) outOfStock += 1;
    if (below) belowMin += 1;
    if (oos || below) {
      alerts.push({
        product,
        stock,
        minStock,
        kind: oos ? 'out_of_stock' : 'below_minimum',
      });
    }
  }

  // Deduplicate by identity if a row somehow matched twice (shouldn't)
  const seen = new Set<LowStockAlertItem>();
  const unique = alerts.filter((a) => {
    if (seen.has(a)) return false;
    seen.add(a);
    return true;
  });

  return {
    belowMin,
    outOfStock,
    noMinimum,
    alertCount: unique.length,
    alerts: unique,
  };
}

/** Dashboard / Nexus / header shared wording. */
export function formatLowStockHeadline(summary: Pick<LowStockSummary, 'outOfStock' | 'belowMin'>): string {
  return `${summary.outOfStock} out of stock · ${summary.belowMin} below minimum`;
}

export type ProductsLoadState = 'loading' | 'ok' | 'failed';

/** KPI tile value — never show a false "0 out of stock" while loading or after a failed fetch. */
export function formatLowStockTileValue(
  load: ProductsLoadState,
  summary: Pick<LowStockSummary, 'outOfStock' | 'belowMin'>,
): string {
  if (load === 'loading') return '—';
  if (load === 'failed') return "Couldn't load stock";
  return formatLowStockHeadline(summary);
}

/** Compact strip when one side dominates (still accurate). */
export function formatLowStockShort(summary: Pick<LowStockSummary, 'outOfStock' | 'belowMin' | 'alertCount'>): string {
  if (summary.alertCount === 0) return '0 low stock';
  if (summary.outOfStock > 0 && summary.belowMin === 0) {
    return `${summary.outOfStock} out of stock`;
  }
  if (summary.belowMin > 0 && summary.outOfStock === 0) {
    return `${summary.belowMin} below minimum`;
  }
  return formatLowStockHeadline(summary);
}

/**
 * Card list: out of stock first, then lowest stock vs minimum.
 * Cap is display-only — caller passes limit (e.g. 6).
 */
export function topLowStockAlerts(summary: LowStockSummary, limit: number = 6): LowStockAlertItem[] {
  const ranked = [...summary.alerts].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'out_of_stock' ? -1 : 1;
    return a.stock - b.stock;
  });
  return ranked.slice(0, Math.max(0, limit));
}
