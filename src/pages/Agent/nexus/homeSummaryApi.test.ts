import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import type { ErpShellData } from '../../../contexts/ErpShellContext';
import {
  clearHomeSummaryCache,
  formatUpdatedAgo,
  homeSummaryCacheKey,
  homeSummaryFromShell,
  readHomeSummaryCache,
  writeHomeSummaryCache,
} from './homeSummaryApi';
import { visibleTopMetrics } from './NexusTopMetrics';

function shell(partial: Partial<ErpShellData>): ErpShellData {
  return {
    invoices: [],
    customers: [],
    products: [],
    payments: [],
    purchaseOrders: [],
    arSummary: null,
    productsLoad: 'ok',
    invoicesLoad: 'ok',
    paymentsLoad: 'ok',
    arLoad: 'ok',
    ...partial,
  };
}

describe('homeSummaryFromShell', () => {
  it('AR failed → owed_to_us is error and never a number', () => {
    const summary = homeSummaryFromShell({
      shell: shell({
        arLoad: 'failed',
        arSummary: null,
        invoices: [
          {
            id: 'inv-1',
            customerId: '1',
            invoiceDate: '2020-01-01',
            dueDate: '2020-01-15',
            grandTotal: 9999,
          },
        ],
      }),
      pendingExpenses: { state: 'ok', count: 0 },
    });
    expect(summary.owed_to_us.state).toBe('error');
    expect(summary.owed_to_us.value).toBeUndefined();
    expect(summary.owed_to_us.sentence).toBe("Couldn't load");
  });

  it('AR ok → owed shows AR owed_to_us amount', () => {
    const summary = homeSummaryFromShell({
      shell: shell({
        arLoad: 'ok',
        arSummary: {
          owed_to_us: 94342,
          customer_credits: 0,
          net_receivable: 94342,
          per_customer: [],
        } as any,
      }),
      pendingExpenses: { state: 'ok', count: 2 },
    });
    expect(summary.owed_to_us.state).toBe('ok');
    expect(summary.owed_to_us.value).toBe(94342);
  });

  it('unavailable blocks are hidden by visibleTopMetrics', () => {
    const summary = homeSummaryFromShell({
      shell: shell({ arLoad: 'ok', arSummary: { owed_to_us: 10 } as any }),
      pendingExpenses: { state: 'unavailable' },
    });
    expect(summary.cash_and_bank.state).toBe('unavailable');
    expect(summary.sales_today.state).toBe('unavailable');
    expect(summary.profit_month.state).toBe('unavailable');
    const visible = visibleTopMetrics(summary);
    expect(visible.every((v) => v.block.state !== 'unavailable')).toBe(true);
    expect(visible.find((v) => v.id === 'cash_and_bank')).toBeUndefined();
    expect(visible.find((v) => v.id === 'owed_to_us')).toBeTruthy();
  });

  it('error tile never exposes a numeric value', () => {
    const summary = homeSummaryFromShell({
      shell: shell({ productsLoad: 'failed' }),
      pendingExpenses: { state: 'error' },
    });
    expect(summary.stock.state).toBe('error');
    expect(typeof summary.stock.value === 'number').toBe(false);
    expect(summary.expenses_to_approve.state).toBe('error');
    expect(typeof summary.expenses_to_approve.value === 'number').toBe(false);
  });
});

describe('home summary cache', () => {
  const key = homeSummaryCacheKey('t1', 'u1');

  beforeEach(() => {
    clearHomeSummaryCache(key);
  });
  afterEach(() => {
    clearHomeSummaryCache(key);
  });

  it('shows cached summary instantly', () => {
    const summary = homeSummaryFromShell({
      shell: shell({
        arLoad: 'ok',
        arSummary: { owed_to_us: 50 } as any,
      }),
      pendingExpenses: { state: 'ok', count: 0 },
      generatedAt: '2026-10-25T12:00:00.000Z',
    });
    writeHomeSummaryCache(key, summary);
    const cached = readHomeSummaryCache(key);
    expect(cached?.owed_to_us.value).toBe(50);
    expect(cached?.generated_at).toBe('2026-10-25T12:00:00.000Z');
    expect(formatUpdatedAgo('2026-10-25T12:00:00.000Z', new Date('2026-10-25T12:05:00.000Z'))).toBe(
      'Updated 5 min ago',
    );
  });
});
