export interface LedgerRow {
  id: string;
  date: string | null;
  type: string;
  reference: string | null;
  description?: string;
  debit: number;
  credit: number;
  running_balance: number;
  source_type?: string | null;
  source_id?: string | null;
  is_reversed?: boolean;
  is_reversal?: boolean;
}

export type LedgerRowAction = 'void' | 'voided' | 'edit-delete' | 'none';

export type ChequeAction = 'clear' | 'bounce' | 'cancel';

export interface PaymentLookup {
  voided?: boolean;
}

/** Parse bank-transaction id from GL source_id ("12" or "12:r3" → 12). */
export function bankTxIdFromSourceId(sourceId: string | null | undefined): number | null {
  if (!sourceId) return null;
  const base = sourceId.includes(':r') ? sourceId.split(':r')[0] : sourceId;
  const n = parseInt(base, 10);
  return Number.isFinite(n) ? n : null;
}

/** Numeric payment id when row.source_type === "payment". */
export function paymentIdFromRow(row: {
  source_type?: string | null;
  source_id?: string | null;
}): number | null {
  if (row.source_type !== 'payment' || !row.source_id) return null;
  const n = parseInt(String(row.source_id), 10);
  return Number.isFinite(n) ? n : null;
}

export function ledgerRowAction(
  row: LedgerRow,
  paymentsById: Map<string, PaymentLookup> | Record<string, PaymentLookup>,
): LedgerRowAction {
  if (row.source_type === 'bank_transaction' && !row.is_reversed && !row.is_reversal) {
    return 'edit-delete';
  }
  if (row.source_type === 'payment') {
    const pid = paymentIdFromRow(row);
    if (pid == null) return 'none';
    const payment = paymentsById instanceof Map
      ? paymentsById.get(String(pid))
      : paymentsById[String(pid)];
    if (payment?.voided === true) return 'voided';
    return 'void';
  }
  return 'none';
}

/** Period movement on an asset account: money in = debits, money out = credits. */
export function periodTotals(rows: Pick<LedgerRow, 'debit' | 'credit'>[]): {
  moneyIn: number;
  moneyOut: number;
} {
  return {
    moneyIn: rows.reduce((s, r) => s + (r.debit || 0), 0),
    moneyOut: rows.reduce((s, r) => s + (r.credit || 0), 0),
  };
}

/** Display-only filter — never recomputes running_balance. */
export function filterLedgerRows(
  rows: LedgerRow[],
  opts: { search?: string; direction?: 'all' | 'in' | 'out' },
): LedgerRow[] {
  const search = (opts.search || '').trim().toLowerCase();
  const direction = opts.direction || 'all';
  return rows.filter((row) => {
    if (direction === 'in' && !(row.debit > 0)) return false;
    if (direction === 'out' && !(row.credit > 0)) return false;
    if (search) {
      const ref = (row.reference || '').toLowerCase();
      const desc = (row.description || '').toLowerCase();
      if (!ref.includes(search) && !desc.includes(search)) return false;
    }
    return true;
  });
}

export function chequeActions(status: string, type?: string): ChequeAction[] {
  void type;
  if (status === 'Pending') return ['clear', 'bounce', 'cancel'];
  if (status === 'Cleared') return ['bounce'];
  return [];
}

const TYPE_LABELS: Record<string, string> = {
  customer_payment: 'Customer payment',
  supplier_payment: 'Supplier payment',
  bank_transaction: 'Bank transaction',
  expense: 'Expense',
  journal_voucher: 'Journal voucher',
  reversal: 'Reversal',
};

export function ledgerTypeLabel(type: string): string {
  return TYPE_LABELS[type] || type || 'Other';
}

export function moneyDirectionLabel(type: 'Credit' | 'Debit' | string): string {
  if (type === 'Credit') return 'Money in';
  if (type === 'Debit') return 'Money out';
  return type;
}

export interface ContraAccountOption {
  id: number;
  code: string;
  name: string;
  system_key: string | null;
  is_active: boolean;
}

const EXCLUDED_CONTRA_SYSTEM_KEYS = new Set(['accounts_receivable', 'accounts_payable']);

export function contraAccountOptions(
  glAccounts: ContraAccountOption[],
  selectedAccountId: number | null,
): ContraAccountOption[] {
  return glAccounts.filter((account) => {
    if (!account.is_active) return false;
    if (selectedAccountId != null && account.id === selectedAccountId) return false;
    if (account.system_key && EXCLUDED_CONTRA_SYSTEM_KEYS.has(account.system_key)) return false;
    return true;
  });
}

export type LedgerRowOrder = 'newest' | 'oldest';

/** Display-only reorder — never changes running_balance on any row. */
export function orderLedgerRows(rows: LedgerRow[], order: LedgerRowOrder): LedgerRow[] {
  if (order === 'oldest') return rows;
  return [...rows].reverse();
}

export interface ChequeConfirmInput {
  chequeNo: string;
  amount: number;
  type: 'Received' | 'Issued';
  glPosted?: boolean;
}

export function chequeConfirmText(
  action: 'clear' | 'bounce' | 'cancel',
  cheque: ChequeConfirmInput,
  formatAmount: (amount: number) => string,
): string {
  const no = cheque.chequeNo;
  const amt = formatAmount(cheque.amount);
  if (action === 'clear' && cheque.type === 'Received') {
    return `Clear cheque ${no} for ${amt}? A customer payment of ${amt} will be recorded in the books, applied to this customer's oldest unpaid invoices.`;
  }
  if (action === 'clear' && cheque.type === 'Issued') {
    return `Mark cheque ${no} as cleared? Issued cheques are not posted to the books yet; this only changes the status.`;
  }
  if (action === 'bounce' && cheque.glPosted) {
    return `Bounce cheque ${no}? The payment of ${amt} will be reversed in the books, the invoices it paid become unpaid again, and this cannot be undone.`;
  }
  if (action === 'bounce') {
    return `Mark cheque ${no} as bounced? Nothing was posted for it, so only the status changes. This cannot be undone.`;
  }
  return `Cancel cheque ${no}? This cannot be undone.`;
}

export function bankTxHomeState(
  tx: { accountId?: number | null },
  selectedAccountId: number | null,
): 'here' | 'elsewhere' {
  if (selectedAccountId == null || tx.accountId == null) return 'elsewhere';
  return tx.accountId === selectedAccountId ? 'here' : 'elsewhere';
}

export interface ContraOptionWithCurrent extends ContraAccountOption {
  isCurrent?: boolean;
}

export function contraOptionsWithCurrent(
  options: ContraAccountOption[],
  storedContraAccountId: number | null | undefined,
  glAccounts: ContraAccountOption[],
  storedContraAccountName?: string | null,
): ContraOptionWithCurrent[] {
  if (storedContraAccountId == null) return options;
  if (options.some((account) => account.id === storedContraAccountId)) return options;
  const fromGl = glAccounts.find((account) => account.id === storedContraAccountId);
  if (fromGl) {
    return [...options, { ...fromGl, isCurrent: true }];
  }
  return [
    ...options,
    {
      id: storedContraAccountId,
      code: '',
      name: storedContraAccountName || String(storedContraAccountId),
      system_key: null,
      is_active: true,
      isCurrent: true,
    },
  ];
}
