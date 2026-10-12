/** Same closed statuses as the backend invoice_counts_toward_customer_balance. */
const CLOSED = new Set(['cancelled', 'canceled', 'void']);

export function invoiceCountsTowardCustomerBalance(status: string | null | undefined): boolean {
  return !CLOSED.has(String(status ?? '').trim().toLowerCase());
}

export function customerStatementTotals(
  invoices: Array<{
    status?: string | null;
    grandTotal?: number | null;
    remaining_balance?: number | null;
  }>,
): { invoiced: number; outstanding: number } {
  let invoiced = 0;
  let outstanding = 0;
  for (const inv of invoices) {
    if (!invoiceCountsTowardCustomerBalance(inv.status)) continue;
    const grand = Number(inv.grandTotal) || 0;
    invoiced += grand;
    const remaining = inv.remaining_balance == null ? grand : Number(inv.remaining_balance) || 0;
    outstanding += Math.max(0, remaining);
  }
  return {
    invoiced: Math.round(invoiced * 100) / 100,
    outstanding: Math.round(outstanding * 100) / 100,
  };
}
