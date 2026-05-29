import { describe, expect, it } from 'vitest';

import { calculateCollectionRate } from '../salesMetrics';

describe('sales metrics', () => {
  it('calculates collection rate from real payments over real invoices', () => {
    const invoices = [
      { grandTotal: 100 },
      { grandTotal: 50 },
    ] as any;
    const payments = [
      { amount: 30 },
      { amount: 45 },
    ] as any;

    expect(calculateCollectionRate(invoices, payments)).toBe(50);
  });

  it('returns null when there is no invoice total instead of a fake target/rate', () => {
    expect(calculateCollectionRate([], [{ amount: 25 }] as any)).toBeNull();
  });
});
