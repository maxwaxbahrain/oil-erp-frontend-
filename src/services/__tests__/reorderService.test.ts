import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import {
  createReorderDraftPo,
  getProductDemand,
  getReorderSuggestions,
  getReorderSummary,
  snoozeProduct,
} from '../reorderService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe('reorderService URLs and bodies match app/api/reorder.py', () => {
  afterEach(() => authFetch.mockReset());

  it('reads suggestions, summary, and demand', async () => {
    authFetch.mockImplementation(() => ok([]));
    await getReorderSuggestions();
    await getReorderSuggestions({ include_snoozed: true, only_due: false, supplier_id: 5 });
    authFetch.mockImplementation(() => ok({ due_count: 0, suppliers: [] }));
    await getReorderSummary();
    authFetch.mockImplementation(() => ok({ series: [] }));
    await getProductDemand(9);

    expect(authFetch.mock.calls.map((call) => call[0])).toEqual([
      'https://api.test/api/reorder/suggestions',
      'https://api.test/api/reorder/suggestions?supplier_id=5&include_snoozed=true&only_due=false',
      'https://api.test/api/reorder/suggestions/summary',
      'https://api.test/api/reorder/products/9/demand',
    ]);
  });

  it('posts snooze and draft-po bodies', async () => {
    authFetch.mockImplementation(() => ok({}));
    await snoozeProduct(3, '2026-11-01');
    await createReorderDraftPo(5, [{ product_id: 3, quantity: 24 }]);

    const [snoozeUrl, snoozeInit] = authFetch.mock.calls[0];
    expect(snoozeUrl).toBe('https://api.test/api/reorder/snooze');
    expect(snoozeInit.method).toBe('POST');
    expect(JSON.parse(snoozeInit.body)).toEqual({ product_id: 3, until: '2026-11-01', reason: null });

    const [draftUrl, draftInit] = authFetch.mock.calls[1];
    expect(draftUrl).toBe('https://api.test/api/reorder/draft-po');
    expect(JSON.parse(draftInit.body)).toEqual({ supplier_id: 5, lines: [{ product_id: 3, quantity: 24 }] });
  });

  it('surfaces the backend detail on failure', async () => {
    authFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Not enough permissions' }), { status: 403 })));
    await expect(snoozeProduct(3, '2026-11-01')).rejects.toThrow('Not enough permissions');
  });
});
