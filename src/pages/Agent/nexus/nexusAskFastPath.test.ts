import { describe, expect, it } from 'vitest';
import type { ArSummary } from '../../../services/customerService';
import type { HomeSummary } from './homeSummaryApi';
import { AR_NOT_LOADED_MSG, topDebtorFromAr, tryAskFastPath } from './nexusAskFastPath';

const summary: HomeSummary = {
  generated_at: '2026-10-26T12:00:00Z',
  needs_you_count: 2,
  biggest_line: 'Wrong: $7,000 company total.',
  load_failures: [],
  owed_to_us: { state: 'ok', value: 7000, overdue_count: 4, sentence: '$7,000 owed to us.' },
  expenses_to_approve: { state: 'ok', value: 0 },
  stock: { state: 'ok', value: 11, out_of_stock: 11 },
  cash_and_bank: { state: 'ok', value: 48000 },
  sales_today: { state: 'ok', value: 3240, sentence: '$3,240 in sales today.' },
  profit_month: { state: 'ok', value: 18000 },
  modules: {
    sales: { state: 'ok' },
    customers: { state: 'ok' },
    collections: { state: 'ok' },
    purchase: { state: 'ok' },
    inventory: { state: 'ok' },
    warehouse: { state: 'unavailable' },
    delivery: { state: 'ok', sub_line: '2 vans moving, 1 stopped.' },
    finance: { state: 'ok' },
    expenses: { state: 'ok' },
    payroll: { state: 'unavailable' },
  },
};

const arSummary: ArSummary = {
  as_of: '2026-10-26',
  total_outstanding: 8000,
  owed_to_us: 8000,
  customer_credits: 0,
  net_receivable: 8000,
  customer_count: 3,
  per_customer: [
    { id: 12, name: 'Gamma Garage', balance: 7118 },
    { id: 5, name: 'Beta Auto', balance: 882 },
    { id: 9, name: 'Credit Co', balance: -120 },
  ],
};

function ctx(overrides: Partial<{ arLoadedOk: boolean; arSummary: ArSummary | null }> = {}) {
  return {
    homeSummary: summary,
    needsItems: [],
    arSummary: overrides.arSummary ?? arSummary,
    arLoadedOk: overrides.arLoadedOk ?? true,
  };
}

describe('who owes the most', () => {
  it('names top customer from per_customer ledger balances', () => {
    const hit = tryAskFastPath('Who owes the most?', ctx());
    expect(hit?.headline).toBe('Gamma Garage owes the most: $7,118.');
    expect(hit?.buttons[0]?.label).toBe('Open Gamma Garage');
    expect(hit?.headline).not.toContain('$7,000');
    expect(topDebtorFromAr(arSummary)?.name).toBe('Gamma Garage');
  });

  it('does not use company total when AR failed', () => {
    const hit = tryAskFastPath('Who owes the most?', ctx({ arLoadedOk: false, arSummary: null }));
    expect(hit?.headline).toBe(AR_NOT_LOADED_MSG);
    expect(hit?.headline).not.toContain('7,000');
  });
});

describe('customer balance fast path', () => {
  it('answers how much a customer owes from per_customer', () => {
    const hit = tryAskFastPath('how much does Gamma Garage owe', ctx());
    expect(hit?.headline).toBe('Gamma Garage owes $7,118.');
    expect(hit?.buttons[0]?.href).toBe('/customers/12');
  });

  it('handles owes nothing and credit', () => {
    expect(tryAskFastPath('Beta Auto balance', ctx())?.headline).toBe('Beta Auto owes $882.');
    expect(tryAskFastPath('Credit Co balance', ctx())?.headline).toContain('credit');
  });

  it('disambiguates several matches', () => {
    const multi: ArSummary = {
      ...arSummary,
      per_customer: [
        { id: 1, name: 'Gamma Garage', balance: 100 },
        { id: 2, name: 'Gamma Motors', balance: 200 },
      ],
    };
    const hit = tryAskFastPath('how much does gamma owe', ctx({ arSummary: multi }));
    expect(hit?.headline).toBe('Did you mean Gamma Garage or Gamma Motors?');
  });

  it('reports missing customer', () => {
    expect(tryAskFastPath('how much does Unknown Shop owe', ctx())?.headline).toBe(
      "I couldn't find that customer.",
    );
  });
});

describe('tryAskFastPath other', () => {
  it('answers reorder / sales without chat', () => {
    const base = ctx();
    expect(tryAskFastPath('What should I reorder?', base)?.headline).toContain('11');
    expect(tryAskFastPath("Today's sales", base)?.headline).toContain('3,240');
  });

  it('returns null for unknown questions', () => {
    expect(tryAskFastPath('Explain quantum accounting', ctx())).toBeNull();
  });
});
