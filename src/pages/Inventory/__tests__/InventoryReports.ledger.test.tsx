import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InventoryReports from '../InventoryReports';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';
import * as glService from '../../../services/glService';
import * as productService from '../../../services/productService';
import * as inventoryService from '../../../services/inventoryService';

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  getSystemSettings: () => ({ valuationMethod: 'Average Cost' }),
}));

vi.mock('../../../services/inventoryLedgerService', () => ({
  getInventoryValuation: vi.fn(),
  getInventoryOnHand: vi.fn(),
  getAllMovements: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/demandService', () => ({
  getDemandSummary: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/glService', () => ({
  getGLProfitLoss: vi.fn(),
}));

vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
}));

vi.mock('../../../services/inventoryService', () => ({
  calculateFIFOValuation: vi.fn(),
  calculateLIFOValuation: vi.fn(),
  calculateSupplierAccuracy: vi.fn(),
  calculateLossLeakage: vi.fn(),
}));

const valuationFixture = {
  as_of: '2026-10-31',
  totals: { products: 3, units: 257379, value: 11128274.99 },
  gl_inventory: 11128274.99,
  difference: 0,
  rows: [
    { product_id: 11, sku: 'P011', name: '0W-16', on_hand: 4827, cost: 39.01, value: 4827 * 39.01, last_receipt_cost: null, last_movement_date: '2026-10-20', cost_method: 'average' },
    { product_id: 3, sku: 'P003', name: '0W-20', on_hand: 4193, cost: 26.21, value: 4193 * 26.21, last_receipt_cost: null, last_movement_date: '2026-07-01', cost_method: 'average' },
    { product_id: 5, sku: 'P005', name: '10W-40', on_hand: 5387, cost: 67.14, value: 5387 * 67.14, last_receipt_cost: null, last_movement_date: '2026-04-01', cost_method: 'average' },
  ],
};

valuationFixture.rows[0].value = 188301.27;
valuationFixture.rows[1].value = 109898.53;
valuationFixture.rows[2].value = 361683.18;

const onHandFixture = {
  total: 3,
  totals: { products: 3, units: 14407, value_at_cost: 659883.98 },
  rows: [
    { product_id: 11, name: '0W-16', sku: 'P011', unit: 'ea', on_hand: 4827, stock_cached: 4827, cost: 39.01, value_at_cost: 188301.27, min_stock: 0, last_movement_date: '2026-10-20', days_since_movement: 12, drift: false },
    { product_id: 3, name: '0W-20', sku: 'P003', unit: 'ea', on_hand: 4193, stock_cached: 4193, cost: 26.21, value_at_cost: 109898.53, min_stock: 0, last_movement_date: '2026-07-01', days_since_movement: 95, drift: false },
    { product_id: 5, name: '10W-40', sku: 'P005', unit: 'ea', on_hand: 5387, stock_cached: 5387, cost: 67.14, value_at_cost: 361683.18, min_stock: 0, last_movement_date: '2026-04-01', days_since_movement: 200, drift: false },
  ],
};

function mountPage() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <InventoryReports />
      </MemoryRouter>,
    );
  });
  return { container, root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('InventoryReports ledger Phase 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T12:00:00'));

    vi.mocked(inventoryLedgerService.getInventoryValuation).mockImplementation(async (q) => {
      if (q?.as_of === '2026-01-01') {
        return { ...valuationFixture, as_of: '2026-01-01', totals: { ...valuationFixture.totals, value: 10_000_000 } };
      }
      return { ...valuationFixture };
    });
    vi.mocked(inventoryLedgerService.getInventoryOnHand).mockResolvedValue(onHandFixture as never);
    vi.mocked(glService.getGLProfitLoss).mockResolvedValue({ cogs: 1646840.94 } as never);
    vi.mocked(productService.getProducts).mockResolvedValue([
      { id: '11', name: '0W-16', sku: 'P011', category: 'Imported' },
      { id: '3', name: '0W-20', sku: 'P003', category: 'Imported' },
      { id: '5', name: '10W-40', sku: 'P005', category: 'Imported' },
    ] as never);
    vi.mocked(inventoryService.calculateSupplierAccuracy).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows ledger valuation tile, modal, dead stock, turnover, periods, and hides estimate reports', async () => {
    const { container, root } = mountPage();
    await flush();

    expect(glService.getGLProfitLoss).toHaveBeenCalledWith('2026-01-01', '2026-10-31');
    expect(container.textContent).toContain('$11,128,274.99');
    expect(container.textContent).toContain('Ties to GL');

    const runValuation = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Inventory valuation') || b.textContent?.includes('Run report'));
    expect(runValuation).toBeTruthy();

    const valuationCard = Array.from(container.querySelectorAll('[role="button"]')).find(el => el.textContent?.includes('Inventory valuation'));
    await act(async () => {
      valuationCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('0W-16');
    expect(container.textContent).toContain('0W-20');
    expect(container.textContent).toContain('10W-40');

    const deadCard = Array.from(container.querySelectorAll('[role="button"]')).find(el => el.textContent?.includes('Dead stock audit'));
    await act(async () => {
      deadCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('0W-20');
    expect(container.textContent).toContain('10W-40');
    expect(container.textContent).not.toMatch(/0W-16[\s\S]*Days idle[\s\S]*12/);
    expect(container.textContent).toContain('$471,581.71');

    expect(container.textContent).toMatch(/\d+\.\d+x/);
    expect(container.textContent).toContain('COGS');

    const lastQuarterBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Last quarter'));
    expect(lastQuarterBtn).toBeTruthy();
    await act(async () => {
      lastQuarterBtn?.click();
    });
    await flush();
    expect(glService.getGLProfitLoss).toHaveBeenCalledWith('2026-07-01', '2026-09-30');

    expect(container.textContent).toContain('2026');
    expect(container.textContent).not.toContain('May 2026');
    expect(container.textContent).not.toContain('FY 2025');

    expect(container.textContent).not.toContain('FIFO valuation');
    expect(container.textContent).not.toContain('LIFO valuation');
    expect(container.textContent).not.toContain('Loss & leakage');
    expect(container.textContent).not.toContain('SQL');

    root.unmount();
  });

  it('shows em dash on valuation tile when ledger valuation fails', async () => {
    vi.mocked(inventoryLedgerService.getInventoryValuation).mockRejectedValue(new Error('Network down'));
    const { container, root } = mountPage();
    await flush();

    expect(container.textContent).toContain('—');
    expect(container.textContent).toContain('Network down');
    expect(container.textContent).not.toContain('$0.00');

    root.unmount();
  });
});
