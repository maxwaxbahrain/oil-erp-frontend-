import { isCustomerPayment, type Payment } from '../../services/api';
import type { GLAccountLine } from '../../services/glService';
import type { ReceivableInvoice } from '../../utils/arMetrics';
import { parseLocalDate } from '../../utils/dates';
import { invoiceCountsTowardCustomerBalance } from '../../utils/invoiceBalance';

const CASH_KEYS = new Set(['cash_on_hand', 'bank']);

export type RatedInvoice = {
  invoiceDate?: string | null;
  grandTotal?: number | null;
  status?: string | null;
};

export interface WorstOverdueCustomer {
  customer: string;
  balance: number;
  days: number;
}

/** Whole local calendar days from `from` to `now`. A date-only string is never parsed with `new Date("YYYY-MM-DD")`. */
export function daysPastDue(dueDate: string | null | undefined, now: Date): number | null {
  const due = parseLocalDate(dueDate);
  if (!due) return null;
  const start = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((end - start) / 86400000);
}

/** Cash on hand plus bank. Every other system key is ignored. */
export function sumGlCash(lines: GLAccountLine[]): number {
  return lines.reduce((sum, line) => {
    if (!CASH_KEYS.has(line.system_key ?? '')) return sum;
    const balance = Number(line.balance);
    return Number.isFinite(balance) ? sum + balance : sum;
  }, 0);
}

/**
 * Receipts YTD ÷ invoiced YTD, as a percent capped at 100.
 * Receipts are customer payments only. Cancelled and void invoices are excluded.
 * Null when nothing was invoiced in the calendar year of `now`.
 */
export function collectionRateYtd(
  invoices: RatedInvoice[],
  payments: Payment[],
  now: Date,
): number | null {
  const year = now.getFullYear();
  let collected = 0;
  for (const payment of payments) {
    if (!isCustomerPayment(payment)) continue;
    const paidOn = parseLocalDate(payment.payment_date);
    if (!paidOn || paidOn.getFullYear() !== year) continue;
    const amount = Number(payment.amount);
    if (Number.isFinite(amount)) collected += amount;
  }

  let invoiced = 0;
  for (const invoice of invoices) {
    if (!invoiceCountsTowardCustomerBalance(invoice.status)) continue;
    const issued = parseLocalDate(invoice.invoiceDate);
    if (!issued || issued.getFullYear() !== year) continue;
    const total = Number(invoice.grandTotal);
    if (Number.isFinite(total)) invoiced += total;
  }

  if (invoiced === 0) return null;
  return Math.min(100, (collected / invoiced) * 100);
}

/** Largest overdue customer balance. Days are measured from that customer's oldest overdue due date. */
export function worstOverdueCustomer(
  rows: ReceivableInvoice[],
  now: Date,
): WorstOverdueCustomer | null {
  const groups = new Map<string, { balance: number; oldestDue: string | null; oldestTime: number }>();

  for (const row of rows) {
    if (row.bucket === 'current') continue;
    const customer = String(row.invoice.customerName ?? '').trim();
    const group = groups.get(customer) ?? { balance: 0, oldestDue: null, oldestTime: Infinity };
    const balance = Number(row.balance);
    if (Number.isFinite(balance)) group.balance += balance;
    const due = parseLocalDate(row.invoice.dueDate);
    if (due && due.getTime() < group.oldestTime) {
      group.oldestTime = due.getTime();
      group.oldestDue = row.invoice.dueDate ?? null;
    }
    groups.set(customer, group);
  }

  let best: WorstOverdueCustomer | null = null;
  for (const [customer, group] of groups) {
    if (best && group.balance <= best.balance) continue;
    best = {
      customer,
      balance: group.balance,
      days: group.oldestDue == null ? 0 : (daysPastDue(group.oldestDue, now) ?? 0),
    };
  }
  return best;
}

/** `$1,234` or `-$1,234`. The minus is in front of the dollar sign. */
export function formatSignedDollars(amount: number, fractionDigits: number): string {
  const abs = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return amount < 0 ? `-$${abs}` : `$${abs}`;
}
