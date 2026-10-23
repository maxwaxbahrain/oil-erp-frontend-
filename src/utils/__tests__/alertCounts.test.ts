import { describe, expect, it } from 'vitest';

import {
  alertShellReady,
  attentionFactsFromAlerts,
  computeAlertCounts,
  formatAttentionWelcome,
  shellLoadFailureLines,
} from '../alertCounts';

const allOk = {
  productsLoad: 'ok' as const,
  invoicesLoad: 'ok' as const,
  paymentsLoad: 'ok' as const,
  arLoad: 'ok' as const,
};

describe('computeAlertCounts (shared App + Nexus)', () => {
  it('matches alert-bar unpaid / overdue / out-of-stock from the same inputs', () => {
    const asOf = new Date('2026-10-23T12:00:00');
    const counts = computeAlertCounts({
      asOf,
      ...allOk,
      invoices: [
        {
          id: 'inv-overdue',
          customerId: '10',
          invoiceDate: '2026-08-01',
          dueDate: '2026-09-01',
          grandTotal: 100,
        },
        {
          id: 'inv-current',
          customerId: '11',
          invoiceDate: '2026-10-01',
          dueDate: '2026-11-01',
          grandTotal: 50,
        },
      ],
      payments: [],
      products: [
        { id: 1, name: 'A', is_active: true, current_stock: 0, min_stock: 5 },
        { id: 2, name: 'B', is_active: true, current_stock: 2, min_stock: 10 },
      ],
      arSummary: {
        owed_to_us: 150,
        customer_credits: 0,
        net_receivable: 150,
        per_customer: [
          { id: 10, balance: 100 },
          { id: 11, balance: 50 },
        ],
      } as any,
    });

    expect(counts.unpaid).toBe(2);
    expect(counts.overdue).toBe(1);
    expect(counts.unpaidTotal).toBe(150);
    expect(counts.outOfStock).toBe(1);
    expect(counts.lowStock).toBe(2);
    expect(counts.productsLoadFailed).toBe(false);

    const facts = attentionFactsFromAlerts(counts);
    expect(facts.map((f) => f.id)).toEqual(['overdue', 'owed', 'out_of_stock']);
    expect(facts).toHaveLength(3);
  });

  it('invoices failed → never "Nothing needs you"', () => {
    const counts = computeAlertCounts({
      ...allOk,
      invoicesLoad: 'failed',
      invoices: [],
      payments: [],
      products: [],
      arSummary: null,
    });
    const facts = attentionFactsFromAlerts(counts);
    const failures = shellLoadFailureLines(counts);
    expect(failures).toContain("I couldn't load invoices right now.");
    const line = formatAttentionWelcome({
      firstName: 'Zohaib',
      shellReady: true,
      facts,
      loadFailures: failures,
    });
    expect(line).not.toMatch(/Nothing needs you/i);
    expect(line).toContain("couldn't load invoices");
  });

  it('products failed → "couldn\'t load stock"; can still mention other facts', () => {
    const counts = computeAlertCounts({
      asOf: new Date('2026-10-23T12:00:00'),
      ...allOk,
      productsLoad: 'failed',
      invoices: [],
      payments: [],
      products: [],
      arSummary: null,
    });
    expect(counts.productsLoadFailed).toBe(true);
    expect(counts.lowStock).toBe(0);
    const failures = shellLoadFailureLines(counts);
    expect(failures.some((l) => /stock/i.test(l))).toBe(true);

    const withStockFact = formatAttentionWelcome({
      firstName: 'Zohaib',
      shellReady: true,
      facts: [{ id: 'out_of_stock', label: '11 products out of stock' }],
      loadFailures: ["I couldn't load invoices right now."],
    });
    // Example shape when some facts + some failures
    expect(withStockFact).toBe(
      "Welcome back, Zohaib. 11 products out of stock. I couldn't load invoices right now.",
    );

    const productsOnlyFail = formatAttentionWelcome({
      firstName: 'Zohaib',
      shellReady: true,
      facts: attentionFactsFromAlerts(counts),
      loadFailures: failures,
    });
    expect(productsOnlyFail).toContain("couldn't load stock");
    expect(productsOnlyFail).not.toMatch(/Nothing needs you/i);
  });

  it('shell ready only after all sources settle', () => {
    expect(
      alertShellReady({
        productsLoad: 'ok',
        invoicesLoad: 'loading',
        paymentsLoad: 'ok',
        arLoad: 'ok',
      }),
    ).toBe(false);
    expect(alertShellReady({ ...allOk })).toBe(true);
    expect(
      alertShellReady({
        productsLoad: 'failed',
        invoicesLoad: 'failed',
        paymentsLoad: 'ok',
        arLoad: 'ok',
      }),
    ).toBe(true);
  });

  it('all ok → unchanged welcome', () => {
    const line = formatAttentionWelcome({
      firstName: 'Zohaib',
      shellReady: true,
      facts: [
        { id: 'overdue', label: '161 overdue invoices' },
        { id: 'owed', label: '$94,341 owed' },
        { id: 'out_of_stock', label: '11 products out of stock' },
      ],
      loadFailures: [],
    });
    expect(line).toBe(
      'Welcome back, Zohaib. 3 things need you: 161 overdue invoices, $94,341 owed, 11 products out of stock.',
    );
  });
});
