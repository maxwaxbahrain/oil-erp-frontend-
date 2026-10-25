import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import {
  addFoundLine,
  approveCount,
  cancelCount,
  completeCount,
  createCount,
  getCount,
  getVariances,
  listCounts,
  recordLine,
  recountLine,
  rejectLine,
  skipLine,
  startCount,
} from '../cycleCountService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

function calls() {
  return authFetch.mock.calls.map(([target, init]) => [
    target,
    (init as RequestInit | undefined)?.method ?? 'GET',
    (init as RequestInit | undefined)?.body ? JSON.parse(String((init as RequestInit).body)) : undefined,
  ]);
}

describe('cycleCountService URLs and bodies match app/api/cycle_counts.py', () => {
  afterEach(() => authFetch.mockReset());

  it('pins every route', async () => {
    authFetch.mockImplementation(() => ok({ counts: [{ id: 1 }], lines: [] }));
    expect(await listCounts()).toEqual([{ id: 1 }]);
    await listCounts('review');
    await getCount(7);
    await createCount({ scope_type: 'locations', scope_path_prefix: 'MAIN/A', blind: true, note: 'x' });
    await startCount(7);
    await recordLine(7, 3, 12, ' two short ');
    await recountLine(7, 3);
    await skipLine(7, 4, 'blocked');
    await skipLine(7, 5);
    await addFoundLine(7, 11, 22);
    await completeCount(7);
    await cancelCount(7);
    await getVariances(7);
    await rejectLine(7, 3, ' wrong bin ');
    await rejectLine(7, 4);
    await approveCount(7);

    expect(calls()).toEqual([
      ['https://api.test/api/counts', 'GET', undefined],
      ['https://api.test/api/counts?status=review', 'GET', undefined],
      ['https://api.test/api/counts/7', 'GET', undefined],
      ['https://api.test/api/counts', 'POST', { scope_type: 'locations', scope_path_prefix: 'MAIN/A', blind: true, note: 'x' }],
      ['https://api.test/api/counts/7/start', 'POST', {}],
      ['https://api.test/api/counts/7/lines/3/count', 'POST', { counted_qty: 12, note: 'two short' }],
      ['https://api.test/api/counts/7/lines/3/recount', 'POST', {}],
      ['https://api.test/api/counts/7/lines/4/skip', 'POST', { note: 'blocked' }],
      ['https://api.test/api/counts/7/lines/5/skip', 'POST', { note: null }],
      ['https://api.test/api/counts/7/lines', 'POST', { product_id: 11, location_id: 22 }],
      ['https://api.test/api/counts/7/complete', 'POST', {}],
      ['https://api.test/api/counts/7/cancel', 'POST', {}],
      ['https://api.test/api/counts/7/variances', 'GET', undefined],
      ['https://api.test/api/counts/7/lines/3/reject', 'POST', { note: 'wrong bin' }],
      ['https://api.test/api/counts/7/lines/4/reject', 'POST', { note: null }],
      ['https://api.test/api/counts/7/approve', 'POST', {}],
    ]);
  });

  it('surfaces the backend detail on failure', async () => {
    authFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ detail: '2 line(s) still need a count or a skip' }), { status: 400 })),
    );
    await expect(completeCount(7)).rejects.toThrow('2 line(s) still need a count or a skip');
    authFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ detail: 'variances are shown after the count is completed' }), { status: 403 })),
    );
    await expect(getVariances(7)).rejects.toMatchObject({ status: 403, message: 'variances are shown after the count is completed' });
  });
});
