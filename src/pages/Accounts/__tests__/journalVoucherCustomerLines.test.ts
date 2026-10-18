import { describe, expect, it } from 'vitest';

import { normalizeLine } from '../JournalVoucher';

describe('journal voucher customer lines', () => {
  it('treats a saved customer_id as a customer line', () => {
    const line = normalizeLine({
      id: '9',
      accountId: '1100',
      accountCode: '1100',
      accountName: 'Ada',
      customerId: '42',
      customerName: 'Ada',
      debit: 10,
      credit: 0,
    });
    expect(line.lineType).toBe('customer');
    expect(line.customerId).toBe('42');
  });

  it('defaults a blank line to Account', () => {
    expect(normalizeLine({ id: '1' }).lineType).toBe('account');
  });
});
