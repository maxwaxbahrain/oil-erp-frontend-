import { describe, expect, it } from 'vitest';

import {
  alertShellReady,
  attentionFactsFromAlerts,
  computeAlertCounts,
  formatAttentionWelcome,
} from '../alertCounts';

describe('computeAlertCounts (shared App + Nexus)', () => {
  it('matches alert-bar unpaid / overdue / out-of-stock from the same inputs', () => {
    const asOf = new Date('2026-10-23T12:00:00');
    const counts = computeAlertCounts({
      asOf,
      productsLoad: 'ok',
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

  it('failed products load does not invent 0 out of stock; welcome is not "0 updates"', () => {
    const counts = computeAlertCounts({
      productsLoad: 'failed',
      invoices: [],
      payments: [],
      products: [],
      arSummary: null,
    });
    expect(counts.lowStock).toBe(0);
    expect(counts.outOfStock).toBe(0);
    expect(counts.productsLoadFailed).toBe(true);
    const facts = attentionFactsFromAlerts(counts);
    expect(facts).toHaveLength(0);
    expect(
      formatAttentionWelcome({
        firstName: 'Zohaib',
        shellReady: true,
        shellFailed: true,
        facts,
      }),
    ).toBe("I couldn't load your updates right now.");
    expect(formatAttentionWelcome({ firstName: 'Zohaib', shellReady: true, facts: [] })).not.toMatch(
      /0 update/i,
    );
  });

  it('shell ready only after productsLoad settles', () => {
    expect(alertShellReady({ productsLoad: 'loading' })).toBe(false);
    expect(alertShellReady({ productsLoad: 'ok' })).toBe(true);
    expect(alertShellReady({ productsLoad: 'failed' })).toBe(true);
  });

  it('welcome lists the same attention facts', () => {
    const line = formatAttentionWelcome({
      firstName: 'Zohaib',
      shellReady: true,
      facts: [
        { id: 'overdue', label: '161 overdue invoices' },
        { id: 'owed', label: '$94,341 owed' },
        { id: 'out_of_stock', label: '11 products out of stock' },
      ],
    });
    expect(line).toBe(
      'Welcome back, Zohaib. 3 things need you: 161 overdue invoices, $94,341 owed, 11 products out of stock.',
    );
  });
});
