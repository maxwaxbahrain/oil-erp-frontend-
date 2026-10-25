import { afterEach, describe, expect, it, vi } from 'vitest';

const { authFetch } = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock('../../api/axios', () => ({ authFetch }));
vi.mock('../api', () => ({ API_BASE_URL: 'https://api.test/api' }));

import { getExpiringLots, getLot, getLotBalances, patchLot, setLotTracking } from '../stockLotService';

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

describe('stockLotService URLs and bodies match app/api/stock_lots.py', () => {
  afterEach(() => authFetch.mockReset());

  it('pins every route', async () => {
    authFetch.mockImplementation(() => ok({ lots: [{ lot_id: 1 }] }));
    expect(await getLotBalances()).toEqual([{ lot_id: 1 }]);
    await getLotBalances(7, 3, true);
    await getExpiringLots(30, true);
    await getExpiringLots(7, false);
    await getLot(9);
    await patchLot(9, { expiry_date: '2026-12-31', note: 'relabelled' });
    await setLotTracking(7, { lot_tracked: true, expiry_tracked: false });

    expect(calls()).toEqual([
      ['https://api.test/api/inventory/lots', 'GET', undefined],
      ['https://api.test/api/inventory/lots?product_id=7&location_id=3&include_empty=true', 'GET', undefined],
      ['https://api.test/api/inventory/lots/expiring?within_days=30', 'GET', undefined],
      ['https://api.test/api/inventory/lots/expiring?within_days=7&include_expired=false', 'GET', undefined],
      ['https://api.test/api/inventory/lots/9', 'GET', undefined],
      ['https://api.test/api/inventory/lots/9', 'PATCH', { expiry_date: '2026-12-31', note: 'relabelled' }],
      ['https://api.test/api/inventory/products/7/lot-tracking', 'POST', { lot_tracked: true, expiry_tracked: false }],
    ]);
  });

  it('surfaces the backend detail on failure', async () => {
    authFetch.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ detail: 'Not enough permissions' }), { status: 403 })),
    );
    await expect(patchLot(9, { note: 'x' })).rejects.toThrow('Not enough permissions');
  });
});
