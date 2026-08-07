import { describe, expect, it } from 'vitest';

import { calculateReceivables } from '../arMetrics';

describe('AR metrics honesty', () => {
  it('calculates outstanding AR and aging buckets from invoices and payments', () => {
    const asOf = new Date('2026-05-29T12:00:00');
    const invoices = [
      {
        id: 'inv-current',
        customerId: 'c1',
        invoiceDate: '2026-05-20',
        dueDate: '2026-06-10',
        grandTotal: 100,
      },
      {
        id: 'inv-30',
        customerId: 'c1',
        invoiceDate: '2026-04-01',
        dueDate: '2026-05-01',
        grandTotal: 200,
      },
      {
        id: 'inv-paid',
        customerId: 'c2',
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-15',
        grandTotal: 300,
      },
    ];
    const payments = [
      { invoice_id: 'inv-30', amount: 50, payment_date: '2026-05-10' },
      { invoice_id: 'inv-paid', amount: 300, payment_date: '2026-04-01' },
    ];

    const summary = calculateReceivables(invoices, payments, asOf);

    expect(summary.current).toBe(100);
    expect(summary.days30).toBe(150);
    expect(summary.days60).toBe(0);
    expect(summary.days90).toBe(0);
    expect(summary.total).toBe(250);
    expect(summary.invoices).toHaveLength(2);
  });

  it('applies unlinked customer payments without inventing balances', () => {
    const asOf = new Date('2026-05-29T12:00:00');
    const invoices = [
      { id: 'old', customerId: 'c1', invoiceDate: '2026-01-01', dueDate: '2026-01-31', grandTotal: 100 },
      { id: 'new', customerId: 'c1', invoiceDate: '2026-05-01', dueDate: '2026-05-31', grandTotal: 100 },
    ];
    const payments = [
      { customer_id: 'c1', amount: 75, payment_date: '2026-05-15' },
    ];

    const summary = calculateReceivables(invoices, payments, asOf);

    expect(summary.days90).toBe(25);
    expect(summary.current).toBe(100);
    expect(summary.total).toBe(125);
  });

  it('ignores backend remaining_balance 0 when payments still leave an open balance', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const invoices = [
      {
        id: '1',
        customerId: 'alpha',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: 1000,
        amount_paid: 0,
        remaining_balance: 0,
      },
    ];
    const payments = [{ customer_id: 'alpha', amount: 500, payment_date: '2026-08-01' }];

    const summary = calculateReceivables(invoices, payments, asOf);

    expect(summary.total).toBe(500);
    expect(summary.invoices).toHaveLength(1);
    expect(summary.invoices[0].balance).toBe(500);
  });
});
