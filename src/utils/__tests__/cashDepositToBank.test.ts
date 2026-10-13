import { describe, expect, it } from 'vitest';

import {
  MANUAL_TX_SUSPENSE_HINT,
  cashDepositToBankPayload,
  methodIsCashReceipt,
} from '../bankingAccounts';

describe('cash deposit to bank', () => {
  it('always debits the bank and credits Cash on Hand', () => {
    expect(cashDepositToBankPayload({
      bankAccountId: 8,
      cashAccountId: 3,
      amount: 25,
      date: '2026-10-10',
      memo: 'Till to bank',
      reference: 'DEP-1',
    })).toEqual({
      date: '2026-10-10',
      description: 'Till to bank',
      type: 'Credit',
      amount: 25,
      reference: 'DEP-1',
      category: 'Cash deposit',
      account_id: 8,
      contra_account_id: 3,
    });
  });

  it('says a blank manual transaction does not reduce Cash on Hand', () => {
    expect(MANUAL_TX_SUSPENSE_HINT).toContain('does not reduce Cash on Hand');
  });
});

describe('petty cash receipts', () => {
  it('treats petty cash the same as cash', () => {
    expect(methodIsCashReceipt('Petty cash')).toBe(true);
    expect(methodIsCashReceipt('Cash')).toBe(true);
    expect(methodIsCashReceipt('Bank Transfer')).toBe(false);
  });
});
