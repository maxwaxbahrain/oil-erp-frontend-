/**
 * Same formula as Dashboard "Low stock" KPI / alerts card
 * (Dashboard.tsx: current_stock &lt; 10 count, and current_stock &lt; 20 list capped at 6).
 */
export function dashboardLowStockAlertCount(
  products: Array<{ current_stock?: number | null }>,
): number {
  const lowStockCount = products.filter((p) => Number(p.current_stock || 0) < 10).length;
  const lowStockItems = products
    .filter((p) => Number(p.current_stock || 0) < 20)
    .sort((a, b) => Number(a.current_stock || 0) - Number(b.current_stock || 0))
    .slice(0, 6);
  return lowStockItems.length || lowStockCount;
}
