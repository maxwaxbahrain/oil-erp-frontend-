import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getSalesOrders: vi.fn(),
  getPurchaseOrders: vi.fn(),
}));

vi.mock('../productService', () => ({ getProducts: mocks.getProducts }));
vi.mock('../salesService', () => ({ getSalesOrders: mocks.getSalesOrders }));
vi.mock('../purchasesService', () => ({ getPurchaseOrders: mocks.getPurchaseOrders }));

import { calculateInventoryValuation, getInventoryMetrics } from '../inventoryService';

describe('inventory honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSalesOrders.mockResolvedValue([]);
    mocks.getPurchaseOrders.mockResolvedValue([]);
  });

  it('values inventory from known product cost and excludes no-cost stock', async () => {
    mocks.getProducts.mockResolvedValue([
      {
        id: 'with-cost',
        name: 'Known Cost Oil',
        category: 'Oil',
        pricing: { landedCost: 4, purchasePriceExWorks: 0, sellingPrice: 10 },
        locations: [{ name: 'Main', currentStock: 5 }],
      },
      {
        id: 'no-cost',
        name: 'No Cost Oil',
        category: 'Oil',
        pricing: { landedCost: 0, purchasePriceExWorks: 0, sellingPrice: 10 },
        locations: [{ name: 'Main', currentStock: 3 }],
      },
    ]);

    const valuation = await calculateInventoryValuation();

    expect(valuation.totalAssetValue).toBe(20);
    expect(valuation.totalUnits).toBe(5);
    expect(valuation.averageUnitCost).toBe(4);
    expect(valuation.isPartial).toBe(true);
    expect(valuation.excludedUnits).toBe(3);
  });

  it('does not fabricate accuracy, turnover, or growth without source data', async () => {
    mocks.getProducts.mockResolvedValue([]);

    const metrics = await getInventoryMetrics();

    expect(metrics.avgTurnover).toBeNull();
    expect(metrics.stockAccuracy).toBeNull();
    expect(metrics.growthRate).toBeNull();
  });
});
