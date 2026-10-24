import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import {
  createReorderDraftPo,
  getProductDemand,
  getReorderRuns,
  getReorderSettings,
  getReorderSuggestions,
  getReorderSummary,
  getSuggestSettings,
  runReorderNow,
  snoozeProduct,
  unsnoozeProduct,
  updateReorderSettings,
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

  it('pins settings, run, runs, suggest-settings, and unsnooze', async () => {
    authFetch.mockImplementation(() => ok({}));
    await getReorderSettings();
    await updateReorderSettings({ safety_factor: 2, digest_recipients: 'a@example.com' });
    await runReorderNow();
    authFetch.mockImplementation(() => ok([]));
    await getReorderRuns();
    await getReorderRuns(5);
    authFetch.mockImplementation(() => ok({}));
    await getSuggestSettings(9);
    await unsnoozeProduct(3);

    const calls = authFetch.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET', init?.body ? JSON.parse(init.body) : undefined]);
    expect(calls).toEqual([
      ['https://api.test/api/reorder/settings', 'GET', undefined],
      ['https://api.test/api/reorder/settings', 'PUT', { safety_factor: 2, digest_recipients: 'a@example.com' }],
      ['https://api.test/api/reorder/run', 'POST', {}],
      ['https://api.test/api/reorder/runs?limit=30', 'GET', undefined],
      ['https://api.test/api/reorder/runs?limit=5', 'GET', undefined],
      ['https://api.test/api/reorder/products/9/suggest-settings', 'GET', undefined],
      ['https://api.test/api/reorder/snooze/3', 'DELETE', undefined],
    ]);
  });

  it('turns a FastAPI 422 detail list into field: message', async () => {
    authFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      detail: [{ loc: ['body', 'safety_factor'], msg: 'Input should be less than or equal to 5' }],
    }), { status: 422 })));
    await expect(updateReorderSettings({ safety_factor: 9 })).rejects.toThrow('safety_factor: Input should be less than or equal to 5');
  });
});
