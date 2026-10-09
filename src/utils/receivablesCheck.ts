import {
  calculateReceivables,
  legacyCalculateReceivables,
  serverRemainingBalance,
  type ArCreditInput,
  type ArCreditKind,
  type ReceivablesSummary,
} from './arMetrics';

export interface CheckInvoice {
  id: string;
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  grandTotal?: number;
  amount_paid?: number;
  remaining_balance?: number | null;
  status?: string;
}

export interface CheckPayment {
  invoice_id?: string;
  customer_id?: string;
  amount: number;
  payment_date?: string;
  voided?: boolean;
}

export interface CheckCreditNote {
  id: string;
  creditNoteNumber?: string;
  customerId?: string;
  customerName?: string;
  remainingCredit?: number;
  status?: string;
  originalInvoiceId?: string;
}

export interface ImportedCreditRow {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  date?: string | null;
  reference?: string | null;
  stored_as: 'sales_return' | 'adjustment' | 'transaction' | 'other';
}

export interface UnappliedPaymentRow {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  date?: string | null;
  reference?: string | null;
}

export interface CollectionsSlice {
  total: number;
  rows: { invoice_id: number | string; invoice_number?: string; outstanding: number; customer_name?: string }[];
}

export interface CheckRecord {
  id: string;
  label: string;
  customerName: string;
  amount: number;
  href: string;
  storedAs?: string;
  reason?: string;
}

export interface CustomerBalanceRow {
  customerId: string;
  customerName: string;
  gross: number;
  credits: number;
  net: number;
}

export interface GapLine {
  label: string;
  amount: number;
}

export interface ReceivablesCheckReport {
  paidShownOpen: { count: number; total: number; rows: CheckRecord[] };
  unappliedCredits: { count: number; total: number; rows: CheckRecord[] };
  unappliedPayments: { count: number; total: number; rows: CheckRecord[] };
  customers: CustomerBalanceRow[];
  gross: number;
  collectionsTotal: number;
  net: number;
  fallbackCount: number;
  gapLines: GapLine[];
  gapAddsUp: boolean;
  summary: ReceivablesSummary;
}

function cents(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function money(n: number): number {
  return cents(n);
}

export function creditNoteInputs(notes: CheckCreditNote[]): ArCreditInput[] {
  const out: ArCreditInput[] = [];
  for (const note of notes) {
    const status = String(note.status ?? '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled' || status === 'fully_used') continue;
    const amount = Number(note.remainingCredit) || 0;
    if (amount <= 0.005) continue;
    const linked = String(note.originalInvoiceId ?? '').trim().length > 0;
    out.push({
      id: `cn-${note.id}`,
      customerId: String(note.customerId ?? ''),
      customerName: note.customerName,
      amount,
      label: note.creditNoteNumber || `Credit note ${note.id}`,
      kind: 'credit_note',
      href: `/sales/credit-notes/${note.id}`,
      storedAs: 'credit note',
      reason: linked
        ? 'This credit note names an invoice, but the unused amount is not applied to it. The credit note screen can apply an amount only by typing an invoice number; nothing applied this balance automatically.'
        : 'This credit note has no original invoice. Bookkeeper import does not create credit notes, and this note was never applied to an invoice.',
    });
  }
  return out;
}

const STORED_AS: Record<ImportedCreditRow['stored_as'], { label: string; kind: ArCreditKind; reason: string }> = {
  sales_return: {
    label: 'sales return',
    kind: 'sales_return',
    reason:
      'Bookkeeper import saves this as a customer transaction of type sales_return. That row has no invoice field. The sales-return screen only creates a Sales Return that requires an original invoice, and there is no control that attaches this imported transaction to an invoice.',
  },
  adjustment: {
    label: 'transaction',
    kind: 'transaction',
    reason:
      'Bookkeeper import saves a negative receipt as an adjustment transaction. That row has no invoice field, and no screen applies an adjustment transaction to an invoice.',
  },
  transaction: {
    label: 'transaction',
    kind: 'transaction',
    reason:
      'This credit is stored as a customer transaction with no invoice field, and no screen links that transaction to an invoice.',
  },
  other: {
    label: 'other',
    kind: 'other',
    reason: 'This credit is not stored as an invoice, credit note, or sales return, so it cannot be applied to an invoice.',
  },
};

export function importedCreditInputs(rows: ImportedCreditRow[]): ArCreditInput[] {
  return rows
    .filter((row) => Number(row.amount) > 0.005)
    .map((row) => {
      const meta = STORED_AS[row.stored_as] ?? STORED_AS.other;
      const customerId = String(row.customer_id ?? '');
      return {
        id: `txn-${row.id}`,
        customerId,
        customerName: row.customer_name,
        amount: Number(row.amount) || 0,
        label: row.reference || `Transaction ${row.id}`,
        kind: meta.kind,
        href: customerId ? `/customers/${customerId}` : '/customers',
        storedAs: meta.label,
        reason: meta.reason,
      };
    });
}

function markedPaid(inv: CheckInvoice): boolean {
  const status = String(inv.status ?? '').trim().toLowerCase();
  if (status === 'paid') return true;
  const server = serverRemainingBalance(inv);
  const total = Number(inv.grandTotal) || 0;
  return server != null && server <= 0.005 && total >= -0.005;
}

export function buildReceivablesCheck(input: {
  invoices: CheckInvoice[];
  payments: CheckPayment[];
  creditNotes?: CheckCreditNote[];
  importedCredits?: ImportedCreditRow[];
  unappliedPayments?: UnappliedPaymentRow[];
  collections?: CollectionsSlice;
  asOf?: Date;
}): ReceivablesCheckReport {
  const asOf = input.asOf ?? new Date();
  const creditInputs = [
    ...creditNoteInputs(input.creditNotes ?? []),
    ...importedCreditInputs(input.importedCredits ?? []),
  ];
  const summary = calculateReceivables(input.invoices, input.payments, asOf, { credits: creditInputs });
  const legacy = legacyCalculateReceivables(input.invoices, input.payments, asOf);
  const legacyById = new Map(legacy.invoices.map((row) => [String(row.invoice.id), row.balance]));

  const paidRows: CheckRecord[] = [];
  for (const inv of input.invoices) {
    const status = String(inv.status ?? '').trim().toLowerCase();
    if (status === 'void' || status === 'cancelled' || status === 'canceled') continue;
    if (!markedPaid(inv)) continue;
    const oldBalance = legacyById.get(String(inv.id)) ?? 0;
    if (oldBalance <= 0.005) continue;
    paidRows.push({
      id: String(inv.id),
      label: inv.invoiceNumber || `Invoice ${inv.id}`,
      customerName: inv.customerName || 'Unknown',
      amount: money(oldBalance),
      href: `/sales/invoices/${inv.id}`,
      reason: 'SOLTOL shows this invoice as paid. The old browser balance ignored a server remaining balance of 0 and kept the payment-math remainder.',
    });
  }

  const creditRows: CheckRecord[] = summary.credits.map((credit) => ({
    id: credit.id,
    label: credit.label,
    customerName: credit.customerName || 'Unknown',
    amount: money(credit.amount),
    href: credit.href,
    storedAs: credit.storedAs,
    reason: credit.reason,
  }));

  const paymentRows: CheckRecord[] = (input.unappliedPayments ?? [])
    .filter((row) => Number(row.amount) > 0.005)
    .map((row) => ({
      id: String(row.id),
      label: row.reference || `Payment ${row.id}`,
      customerName: row.customer_name || 'Unknown',
      amount: money(row.amount),
      href: row.customer_id ? `/customers/${row.customer_id}` : '/customers',
      storedAs: 'transaction',
      reason: 'This customer payment has no allocation to an invoice.',
    }));

  const byCustomer = new Map<string, CustomerBalanceRow>();
  const touch = (customerId: string, name?: string) => {
    const id = customerId || 'unknown';
    const existing = byCustomer.get(id);
    if (existing) {
      if (name && existing.customerName === 'Unknown') existing.customerName = name;
      return existing;
    }
    const row: CustomerBalanceRow = {
      customerId: id,
      customerName: name || 'Unknown',
      gross: 0,
      credits: 0,
      net: 0,
    };
    byCustomer.set(id, row);
    return row;
  };

  for (const row of summary.invoices) {
    const customer = touch(String(row.invoice.customerId ?? ''), row.invoice.customerName);
    customer.gross = money(customer.gross + row.balance);
  }
  for (const credit of summary.credits) {
    const customer = touch(credit.customerId, credit.customerName);
    customer.credits = money(customer.credits + credit.amount);
  }
  const customers = [...byCustomer.values()]
    .map((row) => ({ ...row, net: money(row.gross - row.credits) }))
    .sort((a, b) => b.gross - a.gross || b.credits - a.credits || a.customerName.localeCompare(b.customerName));

  const collections = input.collections ?? { total: 0, rows: [] };
  const arById = new Map(summary.invoices.map((row) => [String(row.invoice.id), row.balance]));
  const colById = new Map(
    collections.rows.map((row) => [String(row.invoice_id), Number(row.outstanding) || 0]),
  );

  let onlyAged = 0;
  let onlyCollections = 0;
  let sameInvoiceDifference = 0;
  for (const [id, balance] of arById) {
    if (!colById.has(id)) onlyAged += balance;
    else sameInvoiceDifference += balance - (colById.get(id) || 0);
  }
  for (const [id, outstanding] of colById) {
    if (!arById.has(id)) onlyCollections += outstanding;
  }

  const gross = money(summary.total);
  const collectionsTotal = money(collections.total);
  const net = money(summary.net);
  const difference = money(gross - collectionsTotal);
  const explained = money(onlyAged - onlyCollections + sameInvoiceDifference);

  const gapLines: GapLine[] = [
    { label: 'Aged Receivable gross outstanding', amount: gross },
    { label: 'Collections all outstanding', amount: collectionsTotal },
    { label: 'Difference (gross minus Collections)', amount: difference },
    { label: 'In Aged Receivable only', amount: money(onlyAged) },
    { label: 'In Collections only', amount: money(onlyCollections) },
    { label: 'Same invoice, different amount (Aged minus Collections)', amount: money(sameInvoiceDifference) },
    { label: 'Unapplied credits', amount: money(summary.unappliedCredits) },
    { label: 'Net balance (gross minus unapplied credits)', amount: net },
  ];

  return {
    paidShownOpen: {
      count: paidRows.length,
      total: money(paidRows.reduce((sum, row) => sum + row.amount, 0)),
      rows: paidRows,
    },
    unappliedCredits: {
      count: creditRows.length,
      total: money(creditRows.reduce((sum, row) => sum + row.amount, 0)),
      rows: creditRows,
    },
    unappliedPayments: {
      count: paymentRows.length,
      total: money(paymentRows.reduce((sum, row) => sum + row.amount, 0)),
      rows: paymentRows,
    },
    customers,
    gross,
    collectionsTotal,
    net,
    fallbackCount: summary.fallbackCount,
    gapLines,
    gapAddsUp: Math.abs(difference - explained) < 0.001,
    summary,
  };
}
