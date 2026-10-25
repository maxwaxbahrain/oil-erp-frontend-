/** Type column for a stock-ledger movement: source, plus movement type when it differs. */
export function formatMovementLabel(row: { source_type?: string | null; movement_type?: string | null }): string {
  const source = (row.source_type || '').trim();
  const kind = (row.movement_type || '').trim();
  if (source && kind && kind !== source) return `${source} · ${kind}`;
  return source || kind || 'movement';
}
