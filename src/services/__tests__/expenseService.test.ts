import { afterEach, describe, expect, it, vi } from 'vitest';

describe('expense service stale snapshots', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('flags cached expenses as stale after a fetch failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, category: 'Travel', amount: 42, currency: 'USD', date: '2026-05-01', vendor: 'Taxi' },
        ],
      })
      .mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const { getExpensesSnapshot } = await import('../expenseService');

    const live = await getExpensesSnapshot();
    expect(live.stale).toBe(false);
    expect(live.expenses).toHaveLength(1);

    const stale = await getExpensesSnapshot();
    expect(stale.stale).toBe(true);
    expect(stale.expenses).toHaveLength(1);
    expect(stale.error?.message).toBe('network down');
  });

  it('getExpenses throws instead of silently returning stale cached data', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, category: 'Travel', amount: 42, currency: 'USD', date: '2026-05-01', vendor: 'Taxi' },
        ],
      })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    const { getExpenses, getExpensesSnapshot } = await import('../expenseService');

    await getExpensesSnapshot();
    await expect(getExpenses()).rejects.toThrow('HTTP 503');
  });
});
