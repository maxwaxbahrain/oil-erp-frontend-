/** Shared shape for payment rows used in void display helpers. */
export type PaymentVoidRow = {
  amount?: number;
  reference?: string | null;
  payment_date?: string;
  date?: string;
  createdAt?: string;
  voided?: boolean;
  voided_on?: string | null;
};

export type LedgerVoidRow = {
  reverses_transaction_id?: number | null;
};

/** Legacy contra-payment rows (pre–Fix 4 void endpoint). */
export function isLegacyReversalRow(p: { amount?: number; reference?: string | null }): boolean {
  return (p.amount ?? 0) < 0 || (p.reference?.startsWith('VOID/') ?? false);
}

/** Backend void flag on a live payment row. */
export function isVoidedPayment(p: { voided?: boolean }): boolean {
  return p.voided === true;
}

/** Rows that still count toward sums and allocation (excludes voided === true only). */
export function livePayments<T extends { voided?: boolean }>(payments: T[]): T[] {
  return payments.filter((p) => p.voided !== true);
}

function paymentSortTime(p: PaymentVoidRow): number {
  const s = p.payment_date ?? p.date ?? p.createdAt;
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Sum amounts, skipping voided payments; legacy negative rows still count. */
export function netReceived(payments: PaymentVoidRow[]): number {
  return livePayments(payments).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );
}

/** Newest payment that is neither voided nor a legacy reversal row. */
export function lastLivePayment<T extends PaymentVoidRow>(payments: T[]): T | null {
  const live = payments.filter((p) => !isVoidedPayment(p) && !isLegacyReversalRow(p));
  if (live.length === 0) return null;
  return [...live].sort((a, b) => paymentSortTime(b) - paymentSortTime(a))[0];
}

/** Ledger adjustment labelling; null means keep the caller's existing mapping. */
export function ledgerTypeLabel(
  rawType: string,
  row: LedgerVoidRow,
): 'Reversal' | 'Adjustment' | null {
  if (rawType !== 'adjustment') return null;
  if (row.reverses_transaction_id != null) return 'Reversal';
  return 'Adjustment';
}
