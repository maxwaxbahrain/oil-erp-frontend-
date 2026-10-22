import { describe, expect, it } from 'vitest';

import { defaultPurchaseOrderDates } from './defaultPurchaseOrderDates';

describe('defaultPurchaseOrderDates', () => {
  it('seeds the local calendar day and seven local days later', () => {
    // Local Y/M/D components, so America/New_York and UTC both read Oct 21 21:04.
    const now = new Date(2026, 9, 21, 21, 4);
    expect(defaultPurchaseOrderDates(now)).toEqual({
      date: '2026-10-21',
      expectedDate: '2026-10-28',
    });
  });
});
