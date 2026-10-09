import { describe, expect, it, vi } from 'vitest';

import { calculateReceivables, legacyCalculateReceivables } from '../arMetrics';

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

  it('excludes a fully paid invoice when the server balance is 0', () => {
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
        status: 'Paid',
      },
    ];
    const payments = [{ customer_id: 'alpha', amount: 500, payment_date: '2026-08-01' }];

    const summary = calculateReceivables(invoices, payments, asOf);

    expect(summary.total).toBe(0);
    expect(summary.invoices).toHaveLength(0);
    expect(legacyCalculateReceivables(invoices, payments, asOf).total).toBe(500);
  });

  it('uses the server balance for a partially paid invoice', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const invoices = [
      {
        id: '1',
        customerId: 'alpha',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: 100,
        amount_paid: 0,
        remaining_balance: 40,
        status: 'Partial',
      },
    ];
    const payments = [{ customer_id: 'alpha', amount: 90, payment_date: '2026-08-01' }];

    const summary = calculateReceivables(invoices, payments, asOf);

    expect(summary.total).toBe(40);
    expect(summary.invoices).toHaveLength(1);
    expect(summary.invoices[0].balance).toBe(40);
  });

  it('excludes a void invoice', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const invoices = [
      {
        id: '1',
        customerId: 'alpha',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: 100,
        remaining_balance: 100,
        status: 'Void',
      },
    ];

    expect(calculateReceivables(invoices, [], asOf).invoices).toHaveLength(0);
    expect(calculateReceivables([{ ...invoices[0], status: 'Cancelled' }], [], asOf).total).toBe(0);
  });

  it('keeps a negative-total invoice as an unapplied credit', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const invoices = [
      {
        id: 'cr',
        customerId: 'alpha',
        customerName: 'Alpha',
        invoiceNumber: 'INV-CR',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: -80,
        remaining_balance: -80,
        status: 'Unpaid',
      },
    ];

    const summary = calculateReceivables(invoices, [], asOf);

    expect(summary.invoices).toHaveLength(0);
    expect(summary.total).toBe(0);
    expect(summary.unappliedCredits).toBe(80);
    expect(summary.net).toBe(-80);
    expect(summary.credits[0].kind).toBe('negative_invoice');
    expect(summary.credits[0].storedAs).toBe('negative invoice');
  });

  it('gives the banner and Aged Receivable the same gross total', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const invoices = [
      {
        id: 'open',
        customerId: 'alpha',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: 100,
        remaining_balance: 40,
        status: 'Partial',
      },
      {
        id: 'paid',
        customerId: 'alpha',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: 100,
        remaining_balance: 0,
        status: 'Paid',
      },
    ];
    const payments = [{ customer_id: 'alpha', amount: 10 }];
    const credits = [
      {
        id: 'cn-1',
        customerId: 'alpha',
        amount: 15,
        label: 'CN-1',
        kind: 'credit_note' as const,
        href: '/sales/credit-notes/1',
        storedAs: 'credit note',
        reason: 'unused',
      },
    ];

    const banner = calculateReceivables(invoices, payments, asOf);
    const aged = calculateReceivables(invoices, payments, asOf, { credits });

    expect(banner.total).toBe(aged.total);
    expect(aged.total).toBe(40);
    expect(aged.net).toBe(25);
  });

  it('falls back to payment math only when the server sends no balance', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const invoices = [
      { id: 't1', customerId: 'alpha', invoiceDate: '2026-08-01', dueDate: '2026-08-01', grandTotal: 1000, amount_paid: 1000 },
      { id: 't2', customerId: 'bravo', invoiceDate: '2026-08-01', dueDate: '2026-08-01', grandTotal: 1000, amount_paid: 1000 },
      { id: 't3', customerId: 'charlie', invoiceDate: '2026-08-01', dueDate: '2026-08-01', grandTotal: 800, amount_paid: 500 },
      { id: 't4', customerId: 'alpha', invoiceDate: '2026-08-02', dueDate: '2026-08-02', grandTotal: 500, amount_paid: 0 },
      { id: 't5', customerId: 'delta', invoiceDate: '2026-08-01', dueDate: '2026-08-01', grandTotal: 400, amount_paid: 400 },
      { id: 't6', customerId: 'bravo', invoiceDate: '2026-08-02', dueDate: '2026-08-02', grandTotal: 600, amount_paid: 0 },
    ];
    const payments = [
      { customer_id: 'alpha', amount: 1000 },
      { customer_id: 'bravo', amount: 1000 },
      { customer_id: 'charlie', amount: 500 },
      { customer_id: 'delta', amount: 400 },
    ];

    const summary = calculateReceivables(invoices, payments, asOf);

    expect(summary.total).toBe(1400);
    expect(summary.fallbackCount).toBe(6);
    expect(warn).toHaveBeenCalled();
    const byId = Object.fromEntries(summary.invoices.map((r) => [r.invoice.id, r.balance]));
    expect(byId.t3).toBe(300);
    expect(byId.t4).toBe(500);
    expect(byId.t6).toBe(600);
    warn.mockRestore();
  });

  it('ignores voided payments when allocating receivables', () => {
    const asOf = new Date('2026-08-01T12:00:00');
    const invoices = [
      {
        id: '1',
        customerId: 'c1',
        invoiceDate: '2026-08-01',
        dueDate: '2026-08-01',
        grandTotal: 100,
      },
    ];
    const payments = [
      { customer_id: 'c1', amount: 40, voided: true },
      { customer_id: 'c1', amount: 40 },
    ];

    expect(calculateReceivables(invoices, payments, asOf).total).toBe(60);

    const withoutVoidFlag = [
      { customer_id: 'c1', amount: 40 },
      { customer_id: 'c1', amount: 40 },
    ];
    expect(calculateReceivables(invoices, withoutVoidFlag, asOf).total).toBe(20);
  });
});
