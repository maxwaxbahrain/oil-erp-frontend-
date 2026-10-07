export function parseNewExpenseParams(search: string): { open: boolean; clientId: string | null } {
  const p = new URLSearchParams(search);
  const open = p.get('new') === '1';
  const raw = (p.get('client') ?? '').trim();
  const clientId = /^\d+$/.test(raw) ? raw : null;
  return { open, clientId };
}

export function buildNewExpenseUrl(customerId: string | number): string {
  return `/finance/expenses?new=1&client=${encodeURIComponent(String(customerId))}`;
}
