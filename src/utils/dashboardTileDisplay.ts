/**
 * Dashboard KPI display helpers — never show a false "$0" / "0" while loading
 * or after a failed fetch. Real zeros only when load === 'ok'.
 */

export type DashLoadState = 'loading' | 'ok' | 'failed';

export function formatDashMoneyTile(load: DashLoadState, amount: number): string {
  if (load === 'loading') return '—';
  if (load === 'failed') return "Couldn't load";
  return `$${Number(amount || 0).toLocaleString()}`;
}

export function formatDashCountTile(load: DashLoadState, count: number): string {
  if (load === 'loading') return '—';
  if (load === 'failed') return "Couldn't load";
  return String(Number(count || 0));
}

export function dashTileSub(
  load: DashLoadState,
  whenOk: string,
): { sub: string; onRetry?: true } {
  if (load === 'failed') return { sub: 'Retry', onRetry: true };
  if (load === 'loading') return { sub: 'loading…' };
  return { sub: whenOk };
}
