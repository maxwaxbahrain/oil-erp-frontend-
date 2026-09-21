import { describe, expect, it } from 'vitest';

import {
  isLegacyReversalRow,
  isVoidedPayment,
  lastLivePayment,
  ledgerTypeLabel,
  netReceived,
} from '../paymentVoid';

describe('isLegacyReversalRow', () => {
  it('detects negative amounts and VOID/ references', () => {
    expect(isLegacyReversalRow({ amount: -50 })).toBe(true);
    expect(isLegacyReversalRow({ amount: 50, reference: 'VOID/12' })).toBe(true);
    expect(isLegacyReversalRow({ amount: 50, reference: 'PAY-12' })).toBe(false);
  });
});

describe('isVoidedPayment', () => {
  it('is true only when voided === true', () => {
    expect(isVoidedPayment({ voided: true })).toBe(true);
    expect(isVoidedPayment({ voided: false })).toBe(false);
    expect(isVoidedPayment({})).toBe(false);
  });
});

describe('netReceived', () => {
  it('skips voided rows but keeps legacy negative rows in the sum', () => {
    const total = netReceived([
      { amount: 1, voided: true },
      { amount: 104.22 },
      { amount: 305.41 },
    ]);
    expect(total).toBeCloseTo(409.63);

    expect(netReceived([{ amount: -25, reference: 'VOID/9' }, { amount: 100 }])).toBe(75);
  });
});

describe('lastLivePayment', () => {
  it('skips the newest payment when it is voided', () => {
    const picked = lastLivePayment([
      { amount: 500, payment_date: '2026-09-20', voided: true },
      { amount: 104.22, payment_date: '2026-09-15' },
      { amount: 305.41, payment_date: '2026-08-01' },
    ]);
    expect(picked?.amount).toBe(104.22);
  });

  it('returns null when every row is voided or legacy reversal', () => {
    expect(lastLivePayment([{ amount: -10 }, { amount: 50, voided: true }])).toBeNull();
  });
});

describe('ledgerTypeLabel', () => {
  it('returns Reversal, Adjustment, or null', () => {
    expect(ledgerTypeLabel('adjustment', { reverses_transaction_id: 12 })).toBe('Reversal');
    expect(ledgerTypeLabel('adjustment', { reverses_transaction_id: null })).toBe('Adjustment');
    expect(ledgerTypeLabel('adjustment', {})).toBe('Adjustment');
    expect(ledgerTypeLabel('payment', { reverses_transaction_id: 12 })).toBeNull();
  });
});
