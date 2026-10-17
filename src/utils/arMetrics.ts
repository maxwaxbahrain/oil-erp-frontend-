import { invoiceCountsTowardCustomerBalance } from './invoiceBalance';

type InvoiceLike = {
  id: string;
  customerId?: string;
  customerName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  grandTotal?: number;
  subtotal?: number;
  amount_paid?: number;
  remaining_balance?: number | null;
  status?: string;
};

type PaymentLike = {
  invoice_id?: string;
  customer_id?: string;
  amount: number;
  payment_date?: string;
  voided?: boolean;
};

export type ArCreditKind = 'negative_invoice' | 'credit_note' | 'sales_return' | 'transaction' | 'other';

export interface ArCreditInput {
  id: string;
  customerId: string;
  customerName?: string;
  amount: number;
  label: string;
  kind: ArCreditKind;
  href: string;
  storedAs: string;
  reason: string;
}

export interface ArExtras {
  credits?: ArCreditInput[];
}

export interface ReceivableInvoice {
  invoice: InvoiceLike;
  balance: number;
  bucket: 'current' | 'days30' | 'days60' | 'days90';
}

export interface ArCreditLine extends ArCreditInput {
  amount: number;
}

export interface ReceivablesSummary {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  /** Open invoices only. Unapplied credits are not subtracted here. */
  total: number;
  unappliedCredits: number;
  /** Open invoices minus unapplied credits. */
  net: number;
  invoices: ReceivableInvoice[];
  credits: ArCreditLine[];
  /** Invoices that arrived with no remaining_balance, so payment math was used. */
  fallbackCount: number;
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function invoiceTotal(inv: InvoiceLike): number {
  return Number(inv.grandTotal ?? inv.subtotal ?? 0) || 0;
}

function isVoidOrCancelled(inv: InvoiceLike): boolean {
  return !invoiceCountsTowardCustomerBalance(inv.status);
}

/** null when the server did not send a balance. 0 is a real balance. */
export function serverRemainingBalance(inv: InvoiceLike): number | null {
  if (inv.remaining_balance === undefined || inv.remaining_balance === null) return null;
  const n = Number(inv.remaining_balance);
  return Number.isFinite(n) ? n : null;
}

function bucketFor(inv: InvoiceLike, asOf: Date): ReceivableInvoice['bucket'] {
  const due = parseDate(inv.dueDate) ?? parseDate(inv.invoiceDate);
  if (!due) return 'current';
  const days = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
  if (days <= 0) return 'current';
  if (days <= 30) return 'days30';
  if (days <= 60) return 'days60';
  return 'days90';
}

function emptySummary(): ReceivablesSummary {
  return {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    total: 0,
    unappliedCredits: 0,
    net: 0,
    invoices: [],
    credits: [],
    fallbackCount: 0,
  };
}

function pushCredit(summary: ReceivablesSummary, credit: ArCreditInput) {
  const amount = Math.abs(Number(credit.amount) || 0);
  if (amount <= 0.005) return;
  summary.credits.push({ ...credit, amount });
  summary.unappliedCredits += amount;
}

/**
 * Previous browser balance. Kept only so Receivables Check can show invoices
 * the old math still treated as open. Aged Receivable and the banner do not call this.
 */
export function legacyCalculateReceivables(
  invoices: InvoiceLike[],
  payments: PaymentLike[],
  asOf: Date = new Date(),
): ReceivablesSummary {
  const explicitPaid = new Map<string, number>();
  const customerPaymentTotal = new Map<string, number>();

  for (const payment of payments) {
    if (payment.voided === true) continue;
    const amount = Number(payment.amount) || 0;
    if (amount <= 0) continue;
    const invoiceId = payment.invoice_id ? String(payment.invoice_id) : '';
    if (invoiceId) {
      explicitPaid.set(invoiceId, (explicitPaid.get(invoiceId) || 0) + amount);
      continue;
    }
    const customerId = payment.customer_id ? String(payment.customer_id) : '';
    if (customerId) {
      customerPaymentTotal.set(
        customerId,
        (customerPaymentTotal.get(customerId) || 0) + amount,
      );
    }
  }

  const allocatedByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    const customerId = inv.customerId ? String(inv.customerId) : '';
    if (!customerId) continue;
    allocatedByCustomer.set(
      customerId,
      (allocatedByCustomer.get(customerId) || 0) + (Number(inv.amount_paid) || 0),
    );
  }

  const unappliedByCustomer = new Map<string, number>();
  for (const [customerId, payTotal] of customerPaymentTotal) {
    const allocated = allocatedByCustomer.get(customerId) || 0;
    unappliedByCustomer.set(customerId, Math.max(0, payTotal - allocated));
  }

  const ordered = [...invoices].sort((a, b) => {
    const ad = parseDate(a.dueDate) ?? parseDate(a.invoiceDate);
    const bd = parseDate(b.dueDate) ?? parseDate(b.invoiceDate);
    return (ad?.getTime() ?? 0) - (bd?.getTime() ?? 0);
  });

  const summary = emptySummary();

  for (const inv of ordered) {
    const total = invoiceTotal(inv);
    if (total <= 0) continue;
    const customerId = inv.customerId ? String(inv.customerId) : '';
    const paidOnInvoice = Number(inv.amount_paid) || 0;
    const paidFromPayments = explicitPaid.get(String(inv.id)) || 0;
    let paid = Math.max(paidOnInvoice, paidFromPayments);

    const unlinked = customerId ? (unappliedByCustomer.get(customerId) || 0) : 0;
    if (unlinked > 0 && paid < total) {
      const applied = Math.min(unlinked, total - paid);
      paid += applied;
      unappliedByCustomer.set(customerId, unlinked - applied);
    }

    const balanceFromPaid = Math.max(0, total - paid);
    const backendBalance =
      inv.remaining_balance == null ? null : Math.max(0, Number(inv.remaining_balance) || 0);
    const balance =
      backendBalance != null && backendBalance > 0
        ? Math.min(backendBalance, balanceFromPaid)
        : balanceFromPaid;
    if (balance <= 0.005) continue;

    const bucket = bucketFor(inv, asOf);
    summary[bucket] += balance;
    summary.total += balance;
    summary.invoices.push({ invoice: inv, balance, bucket });
  }

  summary.net = summary.total;
  return summary;
}

export function calculateReceivables(
  invoices: InvoiceLike[],
  payments: PaymentLike[],
  asOf: Date = new Date(),
  extras?: ArExtras,
): ReceivablesSummary {
  const explicitPaid = new Map<string, number>();
  const customerPaymentTotal = new Map<string, number>();

  for (const payment of payments) {
    if (payment.voided === true) continue;
    const amount = Number(payment.amount) || 0;
    if (amount <= 0) continue;
    const invoiceId = payment.invoice_id ? String(payment.invoice_id) : '';
    if (invoiceId) {
      explicitPaid.set(invoiceId, (explicitPaid.get(invoiceId) || 0) + amount);
      continue;
    }
    const customerId = payment.customer_id ? String(payment.customer_id) : '';
    if (customerId) {
      customerPaymentTotal.set(
        customerId,
        (customerPaymentTotal.get(customerId) || 0) + amount,
      );
    }
  }

  const allocatedByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    const customerId = inv.customerId ? String(inv.customerId) : '';
    if (!customerId) continue;
    allocatedByCustomer.set(
      customerId,
      (allocatedByCustomer.get(customerId) || 0) + (Number(inv.amount_paid) || 0),
    );
  }

  const unappliedByCustomer = new Map<string, number>();
  for (const [customerId, payTotal] of customerPaymentTotal) {
    const allocated = allocatedByCustomer.get(customerId) || 0;
    unappliedByCustomer.set(customerId, Math.max(0, payTotal - allocated));
  }

  const ordered = [...invoices].sort((a, b) => {
    const ad = parseDate(a.dueDate) ?? parseDate(a.invoiceDate);
    const bd = parseDate(b.dueDate) ?? parseDate(b.invoiceDate);
    return (ad?.getTime() ?? 0) - (bd?.getTime() ?? 0);
  });

  const summary = emptySummary();

  for (const inv of ordered) {
    if (isVoidOrCancelled(inv)) continue;

    const total = invoiceTotal(inv);
    const customerId = inv.customerId ? String(inv.customerId) : '';

    if (total < -0.005) {
      const server = serverRemainingBalance(inv);
      const amount = server == null ? Math.abs(total) : Math.abs(server);
      if (amount <= 0.005) continue;
      pushCredit(summary, {
        id: String(inv.id),
        customerId,
        customerName: inv.customerName,
        amount,
        label: inv.invoiceNumber || `Invoice ${inv.id}`,
        kind: 'negative_invoice',
        href: `/sales/invoices/${inv.id}`,
        storedAs: 'negative invoice',
        reason:
          'This invoice has a negative total. It is not applied to another invoice, and there is no screen that links a negative invoice to one.',
      });
      continue;
    }

    if (total <= 0) continue;

    const server = serverRemainingBalance(inv);
    let balance: number;
    if (server != null) {
      balance = server;
    } else {
      summary.fallbackCount += 1;
      const paidOnInvoice = Number(inv.amount_paid) || 0;
      const paidFromPayments = explicitPaid.get(String(inv.id)) || 0;
      let paid = Math.max(paidOnInvoice, paidFromPayments);
      const unlinked = customerId ? (unappliedByCustomer.get(customerId) || 0) : 0;
      if (unlinked > 0 && paid < total) {
        const applied = Math.min(unlinked, total - paid);
        paid += applied;
        unappliedByCustomer.set(customerId, unlinked - applied);
      }
      balance = Math.max(0, total - paid);
    }

    if (balance <= 0.005) continue;

    const bucket = bucketFor(inv, asOf);
    summary[bucket] += balance;
    summary.total += balance;
    summary.invoices.push({ invoice: inv, balance, bucket });
  }

  for (const credit of extras?.credits ?? []) {
    pushCredit(summary, credit);
  }

  summary.net = summary.total - summary.unappliedCredits;
  if (summary.fallbackCount > 0) {
    console.warn(
      `[ar] ${summary.fallbackCount} invoice(s) had no server balance; used the payment fallback`,
    );
  }
  return summary;
}

function dueMillis(inv: InvoiceLike): number {
  return (parseDate(inv.dueDate) ?? parseDate(inv.invoiceDate))?.getTime() ?? 0;
}

/**
 * Cap each customer's open invoices at that customer's ledger balance.
 * Newest invoices absorb the difference: credit on account is treated as
 * paying the oldest debt first. The input summary is not mutated.
 */
export function capReceivablesByLedger(
  summary: ReceivablesSummary,
  ledgerByCustomer: ReadonlyMap<string, number> | null | undefined,
): ReceivablesSummary {
  if (!ledgerByCustomer || ledgerByCustomer.size === 0) return summary;

  const groups = new Map<string, ReceivableInvoice[]>();
  for (const row of summary.invoices) {
    const customerId = String(row.invoice.customerId);
    const group = groups.get(customerId);
    if (group) group.push(row);
    else groups.set(customerId, [row]);
  }

  const nextBalance = new Map<ReceivableInvoice, number>();
  let capped = false;

  for (const [customerId, rows] of groups) {
    const raw = ledgerByCustomer.get(customerId);
    const cap = Math.max(0, typeof raw === 'number' && Number.isFinite(raw) ? raw : 0);
    const invoiceSum = rows.reduce((sum, row) => sum + row.balance, 0);
    if (invoiceSum <= cap + 0.005) continue;

    capped = true;
    const ordered = [...rows].sort((a, b) => dueMillis(a.invoice) - dueMillis(b.invoice));
    let running = 0;
    for (const row of ordered) {
      const room = cap - running;
      if (room <= 0.005 || row.balance <= 0.005) {
        nextBalance.set(row, 0);
        continue;
      }
      if (row.balance <= room + 0.005) {
        nextBalance.set(row, row.balance);
        running += row.balance;
        continue;
      }
      nextBalance.set(row, room);
      running = cap;
    }
  }

  if (!capped) return summary;

  const invoices: ReceivableInvoice[] = [];
  for (const row of summary.invoices) {
    if (!nextBalance.has(row)) {
      invoices.push(row);
      continue;
    }
    const balance = nextBalance.get(row) ?? 0;
    if (balance <= 0.005) continue;
    invoices.push(balance === row.balance ? row : { ...row, balance });
  }

  const next = emptySummary();
  next.unappliedCredits = summary.unappliedCredits;
  next.fallbackCount = summary.fallbackCount;
  next.credits = summary.credits;
  for (const row of invoices) {
    next[row.bucket] += row.balance;
    next.total += row.balance;
  }
  next.invoices = invoices;
  next.net = next.total - next.unappliedCredits;
  return next;
}
