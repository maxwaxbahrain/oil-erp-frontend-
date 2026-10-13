import { describe, expect, it } from 'vitest';

import { customerStatementTotals, invoiceCountsTowardCustomerBalance } from '../invoiceBalance';

describe('invoice counts toward customer balance', () => {
  it('keeps a normal invoice and drops cancelled and void', () => {
    expect(invoiceCountsTowardCustomerBalance('unpaid')).toBe(true);
    expect(invoiceCountsTowardCustomerBalance('Paid')).toBe(true);
    expect(invoiceCountsTowardCustomerBalance('cancelled')).toBe(false);
    expect(invoiceCountsTowardCustomerBalance('Canceled')).toBe(false);
    expect(invoiceCountsTowardCustomerBalance('Void')).toBe(false);
  });

  it('leaves a void invoice out of the statement even when a balance is still stored', () => {
    const totals = customerStatementTotals([
      { status: 'unpaid', grandTotal: 100, remaining_balance: 75 },
      { status: 'cancelled', grandTotal: 40, remaining_balance: 40 },
      { status: 'void', grandTotal: 30, remaining_balance: 30 },
    ]);
    expect(totals.invoiced).toBe(100);
    expect(totals.outstanding).toBe(75);
  });
});
