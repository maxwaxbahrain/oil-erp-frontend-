import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveProduct } from '../productService';

function mockResp(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}

const product = {
  id: '7',
  name: 'Oil',
  sku: 'OIL-7',
  category: 'Lubricants',
  status: 'Active' as const,
  uom: 'pcs',
  locations: [{ id: 'L1', name: 'Main', type: 'Warehouse' as const, currentStock: 10 }],
  pricing: {
    purchasePriceExWorks: 6,
    freightShipping: 0,
    importDuty: 0,
    otherDirectCosts: 0,
    landedCost: 6,
    operatingExpenseAllocation: 0,
    sellingPrice: 10,
    taxRate: 0,
    taxIncluded: false,
  },
};

describe('saveProduct cost_change_reason', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('sends cost_change_reason only when one is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp({ id: 7, is_active: true }));
    vi.stubGlobal('fetch', fetchMock);

    await saveProduct(product);
    await saveProduct(product, { costChangeReason: '  New supplier contract ' });
    await saveProduct(product, { costChangeReason: '   ' });

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(call[1].body as string));
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(bodies[0].cost).toBe(6);
    expect('cost_change_reason' in bodies[0]).toBe(false);
    expect(bodies[1].cost_change_reason).toBe('New supplier contract');
    expect('cost_change_reason' in bodies[2]).toBe(false);
  });
});
