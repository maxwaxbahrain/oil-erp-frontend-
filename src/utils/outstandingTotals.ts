/** Ledger closings from GET /customers/ar-summary. Credits are signed (≤ 0). */
export interface OutstandingTotals {
  owedToUs: number;
  customerCredits: number;
  netReceivable: number;
}

export function outstandingTotals(summary: {
  owed_to_us?: number;
  customer_credits?: number;
  net_receivable?: number;
  total_outstanding?: number;
} | null | undefined): OutstandingTotals | null {
  if (!summary) return null;
  const owedToUs = Number(summary.owed_to_us ?? summary.total_outstanding ?? 0) || 0;
  const customerCredits = Number(summary.customer_credits ?? 0) || 0;
  const netReceivable = Number(summary.net_receivable ?? owedToUs + customerCredits) || 0;
  return { owedToUs, customerCredits, netReceivable };
}

/** The customer card shows the signed ledger closing, including a credit. */
export function signedOutstanding(closing: number): number {
  const value = Number(closing) || 0;
  return Math.round(value * 100) / 100;
}
