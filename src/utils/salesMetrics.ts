import type { Invoice, Payment } from '../services/api';

export function calculateCollectionRate(invoices: Invoice[], payments: Payment[]): number | null {
  const invoicedTotal = invoices.reduce((sum, invoice) => sum + (Number(invoice.grandTotal) || 0), 0);
  if (invoicedTotal <= 0) return null;

  const paidFromPayments = payments.reduce((sum, payment) => {
    const amount = Number(payment.amount) || 0;
    return amount > 0 ? sum + amount : sum;
  }, 0);

  return Math.min(100, (paidFromPayments / invoicedTotal) * 100);
}
