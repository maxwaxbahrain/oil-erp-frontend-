type InvoiceLike = {
  id: string;
  customerId?: string;
  customerName?: string;
  invoiceDate?: string;
  dueDate?: string;
  grandTotal?: number;
  subtotal?: number;
  amount_paid?: number;
  remaining_balance?: number;
};

type PaymentLike = {
  invoice_id?: string;
  customer_id?: string;
  amount: number;
  payment_date?: string;
};

export interface ReceivableInvoice {
  invoice: InvoiceLike;
  balance: number;
  bucket: 'current' | 'days30' | 'days60' | 'days90';
}

export interface ReceivablesSummary {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  total: number;
  invoices: ReceivableInvoice[];
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function invoiceTotal(inv: InvoiceLike): number {
  return Number(inv.grandTotal ?? inv.subtotal ?? 0) || 0;
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

export function calculateReceivables(
  invoices: InvoiceLike[],
  payments: PaymentLike[],
  asOf: Date = new Date(),
): ReceivablesSummary {
  const explicitPaid = new Map<string, number>();
  const customerPaymentTotal = new Map<string, number>();

  for (const payment of payments) {
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

  const rows: ReceivableInvoice[] = [];
  const summary: ReceivablesSummary = { current: 0, days30: 0, days60: 0, days90: 0, total: 0, invoices: rows };

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
    // Trust allocation-derived list balance only when positive; explicit 0 from the
    // API must not zero out open AR when payment FIFO still shows a balance.
    const balance =
      backendBalance != null && backendBalance > 0
        ? Math.min(backendBalance, balanceFromPaid)
        : balanceFromPaid;
    if (balance <= 0.005) continue;

    const bucket = bucketFor(inv, asOf);
    summary[bucket] += balance;
    summary.total += balance;
    rows.push({ invoice: inv, balance, bucket });
  }

  return summary;
}
