import type { CycleCount } from '../../services/cycleCountService';

export function countStatusColor(status: string): string {
  if (status === 'approved') return '#22c55e';
  if (status === 'review') return '#a855f7';
  if (status === 'counting') return '#4F8EF7';
  if (status === 'cancelled') return '#94a3b8';
  return '#F59E0B';
}

export function scopeLabel(count: Pick<CycleCount, 'scope_type' | 'scope_path_prefix' | 'scope_product_ids'>): string {
  if (count.scope_type === 'locations') return `Locations under ${count.scope_path_prefix ?? '—'}`;
  if (count.scope_type === 'products') {
    const n = count.scope_product_ids?.length ?? 0;
    return `${n} product${n === 1 ? '' : 's'}`;
  }
  return 'All';
}
