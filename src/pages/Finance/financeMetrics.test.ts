import { describe, expect, it } from 'vitest';

import type { Payment } from '../../services/api';
import type { GLAccountLine } from '../../services/glService';
import type { ReceivableInvoice } from '../../utils/arMetrics';
import { collectionRateYtd, sumGlCash, worstOverdueCustomer } from './financeMetrics';

function glLine(systemKey: string | null, balance: number, type = 'asset'): GLAccountLine {
  return {
    account_id: 1,
    code: '1000',
    name: systemKey ?? 'other',
    type,
    system_key: systemKey,
    normal_balance: 'debit',
    debit: 0,
    credit: 0,
    balance,
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'p',
    customer_id: 'c1',
    amount: 0,
    payment_date: '2026-04-01',
    payment_method: 'Cash',
    transaction_type: 'payment',
    ...overrides,
  };
}

function receivable(
  customerName: string,
  balance: number,
  dueDate: string,
  bucket: ReceivableInvoice['bucket'],
): ReceivableInvoice {
  return {
    invoice: { id: `${customerName}-${dueDate}-${bucket}`, customerName, dueDate },
    balance,
    bucket,
  };
}

describe('sumGlCash', () => {
  it('adds cash_on_hand and bank and ignores every other key', () => {
    expect(sumGlCash([
      glLine('cash_on_hand', 100),
      glLine('bank', -50),
      glLine('accounts_payable', 1000, 'liability'),
      glLine('operating_expenses', 500, 'expense'),
    ])).toBe(50);
  });
});

describe('collectionRateYtd', () => {
  const now = new Date(2026, 5, 15);

  it('uses 2026 customer receipts over 2026 open invoices', () => {
    const rate = collectionRateYtd(
      [
        { invoiceDate: '2025-05-01', grandTotal: 8000, status: 'Unpaid' },
        { invoiceDate: '2026-03-01', grandTotal: 4000, status: 'Cancelled' },
        { invoiceDate: '2026-02-01', grandTotal: 1000, status: 'Unpaid' },
      ],
      [
        payment({ amount: 5000, payment_date: '2025-11-01', transaction_type: 'payment' }),
        payment({ amount: 700, payment_date: '2026-05-01', transaction_type: 'expense', customer_id: 'c1' }),
        payment({ amount: 300, payment_date: '2026-04-01', transaction_type: 'payment' }),
      ],
      now,
    );
    expect(rate).toBe(30);
  });

  it('returns null when the year has no invoices that count', () => {
    const rate = collectionRateYtd(
      [{ invoiceDate: '2025-06-01', grandTotal: 1000, status: 'Unpaid' }],
      [payment({ amount: 300, payment_date: '2026-04-01', transaction_type: 'payment' })],
      now,
    );
    expect(rate).toBeNull();
  });
});

describe('worstOverdueCustomer', () => {
  const now = new Date(2026, 9, 20, 23, 30, 0);

  it('picks the largest overdue customer and counts days from the oldest due date', () => {
    const result = worstOverdueCustomer(
      [
        receivable('A', 100, '2026-09-01', 'days60'),
        receivable('A', 150, '2026-08-01', 'days90'),
        receivable('B', 200, '2026-07-15', 'days90'),
        receivable('B', 10000, '2026-01-01', 'current'),
        receivable('C', 9999, '2026-01-01', 'current'),
      ],
      now,
    );
    expect(result).toEqual({ customer: 'A', balance: 250, days: 80 });
  });

  it('returns null when there are no overdue rows', () => {
    expect(worstOverdueCustomer([], now)).toBeNull();
    expect(worstOverdueCustomer([
      receivable('C', 9999, '2026-01-01', 'current'),
    ], now)).toBeNull();
  });
});
