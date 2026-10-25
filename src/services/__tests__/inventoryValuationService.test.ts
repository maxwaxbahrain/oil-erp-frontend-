import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import { getValuation, listRevaluations, valuationCsvUrl } from '../inventoryValuationService';

function ok(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

describe('inventoryValuationService URLs match app/api/inventory_ledger.py', () => {
  afterEach(() => authFetch.mockReset());

  it('pins valuation, the CSV URL, and revaluations', async () => {
    authFetch.mockImplementation(() => ok({ rows: [], totals: {}, gl_inventory: 0, difference: 0 }));
    await getValuation();
    await getValuation({ as_of: '2026-10-01', category_id: 3, search: ' oil ' });
    authFetch.mockImplementation(() => ok({ revaluations: [{ id: 1 }] }));
    expect(await listRevaluations()).toEqual([{ id: 1 }]);
    await listRevaluations(9, 1);

    expect(authFetch.mock.calls.map((call) => call[0])).toEqual([
      'https://api.test/api/inventory/valuation',
      'https://api.test/api/inventory/valuation?as_of=2026-10-01&category_id=3&search=oil',
      'https://api.test/api/inventory/revaluations',
      'https://api.test/api/inventory/revaluations?product_id=9&limit=1',
    ]);
    expect(valuationCsvUrl()).toBe('https://api.test/api/inventory/valuation.csv');
    expect(valuationCsvUrl({ as_of: '2026-10-01', search: 'grease' })).toBe(
      'https://api.test/api/inventory/valuation.csv?as_of=2026-10-01&search=grease',
    );
  });

  it('surfaces the backend detail on failure', async () => {
    authFetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ detail: 'Not enough permissions' }), { status: 403 })));
    await expect(getValuation()).rejects.toThrow('Not enough permissions');
  });
});
