import { describe, expect, it, vi } from 'vitest';
import { ASK_TIMEOUT_MESSAGE, queryNexusAsk } from './nexusAskQuery';
import type { AskAnswer } from './nexusAskNav';

describe('queryNexusAsk', () => {
  it('uses fast path without calling chat', async () => {
    const chat = vi.fn();
    const { fromFastPath, answer } = await queryNexusAsk(
      "Today's sales",
      {
        homeSummary: {
          generated_at: 'x',
          needs_you_count: 0,
          biggest_line: '',
          load_failures: [],
          owed_to_us: { state: 'unavailable' },
          expenses_to_approve: { state: 'unavailable' },
          stock: { state: 'unavailable' },
          cash_and_bank: { state: 'unavailable' },
          sales_today: { state: 'ok', sentence: '$100 today.' },
          profit_month: { state: 'unavailable' },
          modules: {
            sales: { state: 'unavailable' },
            customers: { state: 'unavailable' },
            collections: { state: 'unavailable' },
            purchase: { state: 'unavailable' },
            inventory: { state: 'unavailable' },
            warehouse: { state: 'unavailable' },
            delivery: { state: 'unavailable' },
            finance: { state: 'unavailable' },
            expenses: { state: 'unavailable' },
            payroll: { state: 'unavailable' },
          },
        },
        needsItems: [],
      },
      chat,
    );
    expect(fromFastPath).toBe(true);
    expect(answer.headline).toContain('$100');
    expect(chat).not.toHaveBeenCalled();
  });

  it('times out slow chat with retry message', async () => {
    vi.useFakeTimers();
    const chat = vi.fn(
      () =>
        new Promise<AskAnswer>((resolve) => {
          setTimeout(() => resolve({ headline: 'late', detail: '', buttons: [] }), 25_000);
        }),
    );
    const pending = queryNexusAsk('obscure question', { homeSummary: null, needsItems: [] }, chat);
    await vi.advanceTimersByTimeAsync(20_001);
    const result = await pending;
    expect(result.timedOut).toBe(true);
    expect(result.answer.headline).toBe(ASK_TIMEOUT_MESSAGE);
    vi.useRealTimers();
  });
});
