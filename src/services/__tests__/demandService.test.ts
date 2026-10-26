import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import { getDemandSummary, getProductDemand } from '../demandService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe('demandService URLs match app/api/demand.py', () => {
  afterEach(() => authFetch.mockReset());

  it('pins summary and product demand query strings', async () => {
    authFetch.mockImplementation(() => ok([]));
    await getDemandSummary();
    await getDemandSummary({ windowDays: 90, horizon: 30 });
    authFetch.mockImplementation(() => ok({ product_id: 1, series: [], stats: {}, forecast: {} }));
    await getProductDemand(42);
    await getProductDemand(42, { days: 365, bucket: 'week', windowDays: 90 });

    expect(authFetch.mock.calls.map((c) => c[0])).toEqual([
      'https://api.test/api/demand/summary',
      'https://api.test/api/demand/summary?window_days=90&horizon=30',
      'https://api.test/api/demand/products/42',
      'https://api.test/api/demand/products/42?days=365&bucket=week&window_days=90',
    ]);
  });
});
