/** Labels and export lines for the customer ledger statement. */

export function customerLedgerRowLabel(
  rawType: string,
): 'Opening Balance' | 'Balance brought forward' | null {
  const type = rawType.trim().toLowerCase();
  if (type === 'opening_balance') return 'Opening Balance';
  if (type === 'balance_brought_forward') return 'Balance brought forward';
  return null;
}

export type CustomerLedgerStatementLine = {
  date: string;
  type: string;
  referenceNumber: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
  voided?: boolean;
};

export function customerLedgerStatementType(entry: CustomerLedgerStatementLine): string {
  if (entry.voided && entry.type === 'Payment') return 'Payment (Voided)';
  return entry.type;
}

/** Shared by Download PDF, Download Excel, and Send statement. */
export function customerLedgerStatementCsv(entries: CustomerLedgerStatementLine[]): string {
  const header = 'Date,Type,Reference,Description,Debit,Credit,Balance';
  const lines = entries.map((entry) => [
    entry.date,
    customerLedgerStatementType(entry),
    entry.referenceNumber,
    entry.description || '',
    entry.debit,
    entry.credit,
    entry.balance,
  ].join(','));
  return [header, ...lines].join('\n');
}
