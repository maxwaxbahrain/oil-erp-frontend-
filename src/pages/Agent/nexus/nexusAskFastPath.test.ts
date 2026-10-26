import { describe, expect, it } from 'vitest';
import type { HomeSummary } from './homeSummaryApi';
import { tryAskFastPath } from './nexusAskFastPath';

const summary: HomeSummary = {
  generated_at: '2026-10-26T12:00:00Z',
  needs_you_count: 2,
  biggest_line: 'Gamma Garage owes the most at $7,118.',
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

describe('tryAskFastPath', () => {
  it('answers who owes / reorder / sales without chat', () => {
    const ctx = { homeSummary: summary, needsItems: [] };
    expect(tryAskFastPath('Who owes the most?', ctx)?.headline).toContain('Gamma');
    expect(tryAskFastPath('What should I reorder?', ctx)?.headline).toContain('11');
    expect(tryAskFastPath("Today's sales", ctx)?.headline).toContain('3,240');
  });

  it('returns null for unknown questions', () => {
    expect(tryAskFastPath('Explain quantum accounting', { homeSummary: summary, needsItems: [] })).toBeNull();
  });
});
