import { describe, expect, it, vi } from 'vitest';

import {
  calculateReceivables,
  capReceivablesByLedger,
  legacyCalculateReceivables,
  type ReceivableInvoice,
  type ReceivablesSummary,
} from '../arMetrics';

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

function openInvoice(
  id: string,
  customerId: string,
  balance: number,
  bucket: ReceivableInvoice['bucket'],
  dueDate: string,
): ReceivableInvoice {
  return { invoice: { id, customerId, dueDate }, balance, bucket };
}

function summaryFrom(
  invoices: ReceivableInvoice[],
  extras?: Partial<Pick<ReceivablesSummary, 'unappliedCredits' | 'fallbackCount' | 'credits'>>,
): ReceivablesSummary {
  const summary: ReceivablesSummary = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    total: 0,
    unappliedCredits: extras?.unappliedCredits ?? 0,
    net: 0,
    invoices,
    credits: extras?.credits ?? [],
    fallbackCount: extras?.fallbackCount ?? 0,
  };
  for (const row of invoices) {
    summary[row.bucket] += row.balance;
    summary.total += row.balance;
  }
  summary.net = summary.total - summary.unappliedCredits;
  return summary;
}

describe('capReceivablesByLedger', () => {
  it('returns identical contents when there is no ledger', () => {
    const summary = summaryFrom([
      openInvoice('old', 'c1', 100, 'days90', '2026-01-01'),
      openInvoice('new', 'c1', 126.6, 'current', '2026-07-01'),
    ]);

    expect(capReceivablesByLedger(summary, null)).toBe(summary);
    expect(capReceivablesByLedger(summary, undefined)).toBe(summary);
    expect(capReceivablesByLedger(summary, new Map())).toBe(summary);
    expect(capReceivablesByLedger(summary, null)).toEqual(summary);
  });

  it('keeps the oldest invoice and reduces the newest to the ledger remainder', () => {
    const summary = summaryFrom(
      [
        openInvoice('old', 'c1', 100, 'days90', '2026-01-01'),
        openInvoice('new', 'c1', 126.6, 'current', '2026-07-01'),
      ],
      { unappliedCredits: 12, fallbackCount: 3 },
    );

    const capped = capReceivablesByLedger(summary, new Map([['c1', 154]]));

    expect(capped.total).toBe(154);
    expect(capped.net).toBe(142);
    expect(capped.unappliedCredits).toBe(12);
    expect(capped.fallbackCount).toBe(3);
    expect(capped.invoices.map((row) => [row.invoice.id, row.balance])).toEqual([
      ['old', 100],
      ['new', 54],
    ]);
    expect(capped.days90).toBe(100);
    expect(capped.current).toBe(54);
    expect(capped.days30).toBe(0);
    expect(capped.days60).toBe(0);
    expect(capped.days30 + capped.days60 + capped.days90 + capped.current).toBe(capped.total);
  });

  it('removes invoices when the customer is absent or the ledger is not positive', () => {
    const summary = summaryFrom([
      openInvoice('a', 'c1', 80, 'days30', '2026-01-01'),
      openInvoice('b', 'c1', 20, 'current', '2026-06-01'),
    ]);

    for (const ledger of [new Map([['other', 500]]), new Map([['c1', 0]]), new Map([['c1', -40]])]) {
      const capped = capReceivablesByLedger(summary, ledger);
      expect(capped.total).toBe(0);
      expect(capped.invoices).toHaveLength(0);
      expect(capped.current).toBe(0);
      expect(capped.days30).toBe(0);
    }
  });

  it('leaves a customer unchanged when the ledger exceeds their invoices', () => {
    const summary = summaryFrom([
      openInvoice('old', 'c1', 100, 'days60', '2026-02-01'),
      openInvoice('new', 'c1', 40, 'current', '2026-07-01'),
    ]);

    const capped = capReceivablesByLedger(summary, new Map([['c1', 500]]));

    expect(capped).toBe(summary);
    expect(capped.total).toBe(140);
    expect(capped.invoices.map((row) => row.balance)).toEqual([100, 40]);
  });

  it('caps only the customer whose invoices exceed the ledger', () => {
    const untouched = openInvoice('b1', 'b', 40, 'days30', '2026-03-01');
    const summary = summaryFrom([
      openInvoice('a1', 'a', 100, 'days60', '2026-01-01'),
      openInvoice('a2', 'a', 80, 'current', '2026-07-01'),
      untouched,
    ]);

    const capped = capReceivablesByLedger(summary, new Map([['a', 150], ['b', 999]]));

    expect(capped.total).toBe(190);
    expect(capped.invoices.map((row) => [row.invoice.id, row.balance])).toEqual([
      ['a1', 100],
      ['a2', 50],
      ['b1', 40],
    ]);
    expect(capped.invoices[2]).toBe(untouched);
    expect(capped.days60).toBe(100);
    expect(capped.current).toBe(50);
    expect(capped.days30).toBe(40);
  });

  it('does not mutate the input summary', () => {
    const summary = summaryFrom([
      openInvoice('old', 'c1', 100, 'days90', '2026-01-01'),
      openInvoice('new', 'c1', 126.6, 'current', '2026-07-01'),
    ]);
    const before = JSON.parse(JSON.stringify(summary));

    const capped = capReceivablesByLedger(summary, new Map([['c1', 154]]));

    expect(summary).toEqual(before);
    expect(summary.invoices[1].balance).toBe(126.6);
    expect(capped).not.toBe(summary);
    expect(capped.invoices[1]).not.toBe(summary.invoices[1]);
    expect(capped.invoices[1].balance).toBe(54);
  });
});
