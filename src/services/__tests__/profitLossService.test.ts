import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSalesOrders: vi.fn(),
  getInvoices: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getExpenses: vi.fn(),
  getProducts: vi.fn(),
  getCustomers: vi.fn(),
}));

vi.mock('../salesService', () => ({ getSalesOrders: mocks.getSalesOrders }));
vi.mock('../api', () => ({ getInvoices: mocks.getInvoices, getProducts: mocks.getProducts }));
vi.mock('../purchasesService', () => ({ getPurchaseOrders: mocks.getPurchaseOrders }));
vi.mock('../expenseService', () => ({ getExpenses: mocks.getExpenses }));
vi.mock('../productService', () => ({ getProducts: mocks.getProducts }));
vi.mock('../customerService', () => ({ getCustomers: mocks.getCustomers }));

import { getRealMonthCompare } from '../../pages/Reports/ProfitabilityReports';
import { calculateProfitLoss } from '../profitLossService';

describe('profit loss honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const today = new Date().toISOString();
    mocks.getInvoices.mockResolvedValue([
      {
        invoiceDate: today,
        grandTotal: 200,
      },
    ]);
    mocks.getSalesOrders.mockResolvedValue([
      {
        order_date: today,
        status: 'delivered',
        items: [{ product_id: 'p1', product_name: 'Oil 5W30', quantity: 2 }],
      },
    ]);
    mocks.getPurchaseOrders.mockResolvedValue([]);
    mocks.getExpenses.mockResolvedValue([]);
    mocks.getCustomers.mockResolvedValue([]);
  });

  it('uses real product cost for COGS and never the selling price fallback', async () => {
    mocks.getProducts.mockResolvedValue([
      {
        id: 'p1',
        name: 'Oil 5W30',
        pricing: {
          landedCost: 40,
          purchasePriceExWorks: 0,
          sellingPrice: 100,
        },
      },
    ]);

    const result = await calculateProfitLoss(1);

    expect(result.cogs.rawMaterials).toBe(80);
    expect(result.cogs.totalCOGS).toBe(80);
    expect(result.grossProfit.amount).toBe(120);
    expect(result.cogs.isPartial).toBe(false);
  });

  it('excludes lines with no known product cost instead of using selling price', async () => {
    mocks.getProducts.mockResolvedValue([
      {
        id: 'p1',
        name: 'Oil 5W30',
        pricing: {
          landedCost: 0,
          purchasePriceExWorks: 0,
          sellingPrice: 100,
        },
      },
    ]);

    const result = await calculateProfitLoss(1);

    expect(result.cogs.rawMaterials).toBe(0);
    expect(result.cogs.totalCOGS).toBe(0);
    expect(result.grossProfit.amount).toBe(200);
    expect(result.cogs.isPartial).toBe(true);
    expect(result.cogs.missingCostLines).toBe(1);
  });

  it('returns null comparison values when there is no prior real month', () => {
    const comparison = getRealMonthCompare([
      { month: 'May 26', revenue: 200, cogs: 80, profit: 120 },
    ]);

    expect(comparison.hasPrior).toBe(false);
    expect(comparison.revenuePct).toBeNull();
    expect(comparison.profitPct).toBeNull();
    expect(comparison.expensePct).toBeNull();
    expect(comparison.lastMonthRevenue).toBeNull();
  });
});
