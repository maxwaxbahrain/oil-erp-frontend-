import { describe, expect, it } from 'vitest';
import { outstandingTotals, signedOutstanding } from '../outstandingTotals';

describe('outstanding totals', () => {
  it('splits owed, credits, and net from the ledger summary', () => {
    const totals = outstandingTotals({
      total_outstanding: 150,
      owed_to_us: 150,
      customer_credits: -30,
      net_receivable: 120,
    });
    expect(totals).toEqual({ owedToUs: 150, customerCredits: -30, netReceivable: 120 });
  });

  it('keeps a credit closing visible on the customer card', () => {
    expect(signedOutstanding(-40)).toBe(-40);
    expect(signedOutstanding(25.5)).toBe(25.5);
  });
});
