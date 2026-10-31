import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InventoryReports from '../InventoryReports';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';
import * as glService from '../../../services/glService';
import * as productService from '../../../services/productService';
import * as demandService from '../../../services/demandService';
import * as inventoryService from '../../../services/inventoryService';

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  getSystemSettings: () => ({ valuationMethod: 'Average Cost' }),
}));

vi.mock('../../../services/inventoryLedgerService', () => ({
  getInventoryValuation: vi.fn(),
  getInventoryOnHand: vi.fn(),
  getAllMovements: vi.fn(),
}));

vi.mock('../../../services/glService', () => ({
  getGLProfitLoss: vi.fn(),
}));

vi.mock('../../../services/demandService', () => ({
  getDemandSummary: vi.fn(),
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

const valuationStub = {
  as_of: '2026-10-31',
  totals: { products: 2, units: 9020, value: 100 },
  gl_inventory: 100,
  difference: 0,
  rows: [],
};

const onHandStub = {
  total: 2,
  totals: { products: 2, units: 9020, value_at_cost: 100 },
  rows: [
    { product_id: 11, name: '0W-16', sku: 'P011', unit: 'ea', on_hand: 4827, stock_cached: 4827, cost: 39.01, value_at_cost: 188301.27, min_stock: 0, last_movement_date: '2026-10-20', days_since_movement: 12, drift: false },
    { product_id: 3, name: '0W-20', sku: 'P003', unit: 'ea', on_hand: 4193, stock_cached: 4193, cost: 26.21, value_at_cost: 109898.53, min_stock: 0, last_movement_date: '2026-07-01', days_since_movement: 95, drift: false },
  ],
};

const movementsStub = [
  { id: 1, entry_date: '2026-10-27', source_type: 'grn', source_id: 'grn-1', reference: 'PO', movement_type: 'grn', quantity_delta: 1, stock_before: 4826, stock_after: 4827, unit_cost: 58.05, journal_entry_id: 1, product_id: 11, product_name: '0W-16', sku: 'P011', note: null, created_at: null, location_id: null, location_code: null, location_path: null },
  { id: 2, entry_date: '2026-10-23', source_type: 'invoice', source_id: 'inv-1', reference: 'INV', movement_type: 'invoice', quantity_delta: -1, stock_before: 4827, stock_after: 4826, unit_cost: 39.01, journal_entry_id: 2, product_id: 11, product_name: '0W-16', sku: 'P011', note: null, created_at: null, location_id: null, location_code: null, location_path: null },
];

const demandStub = [
  { product_id: 11, name: '0W-16', sku: 'P011', pack_qty: null, pack_unit: null, on_hand_units: 4827, avg_daily: 2.5, trend_pct: 0, forecast_units: 75, low: null, high: null, days_of_cover: null, stockout_date: null, method: 'average', accuracy_wape: 0.12, history_weeks: 12 },
  { product_id: 3, name: '0W-20', sku: 'P003', pack_qty: null, pack_unit: null, on_hand_units: 4193, avg_daily: 0, trend_pct: 0, forecast_units: 0, low: null, high: null, days_of_cover: null, stockout_date: null, method: 'no_history', accuracy_wape: null, history_weeks: 0 },
];

function catalogProduct(id: string, name: string, sku: string, price: number, cost: number, reorderLevel: number) {
  return {
    id,
    name,
    sku,
    category: 'Imported',
    status: 'Active',
    description: '',
    uom: 'ea',
    velocityStatus: 'Medium',
    salesVelocity: 0,
    salesTrend: 0,
    revenueContribution: 0,
    grossMarginPercent: 0,
    netProfitPerUnit: 0,
    locations: [{ id: 'L', name: 'Main', type: 'Warehouse', currentStock: 0 }],
    avgDailySales: 0,
    daysStockRemaining: 0,
    reorderLevel,
    overstockRisk: 'Low',
    pricing: {
      purchasePriceExWorks: cost,
      freightShipping: 0,
      importDuty: 0,
      otherDirectCosts: 0,
      landedCost: cost,
      operatingExpenseAllocation: 0,
      sellingPrice: price,
      taxRate: 0,
    },
  };
}

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

describe('InventoryReports ledger Phase 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T12:00:00'));

    vi.mocked(inventoryLedgerService.getInventoryValuation).mockResolvedValue(valuationStub as never);
    vi.mocked(inventoryLedgerService.getInventoryOnHand).mockResolvedValue(onHandStub as never);
    vi.mocked(inventoryLedgerService.getAllMovements).mockResolvedValue(movementsStub as never);
    vi.mocked(glService.getGLProfitLoss).mockResolvedValue({ cogs: 1646840.94 } as never);
    vi.mocked(demandService.getDemandSummary).mockResolvedValue(demandStub as never);
    vi.mocked(productService.getProducts).mockResolvedValue([
      catalogProduct('11', '0W-16', 'P011', 55, 39.01, 500),
      catalogProduct('3', '0W-20', 'P003', 40, 26.21, 500),
    ] as never);
    vi.mocked(inventoryService.calculateSupplierAccuracy).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('ledger movement, demand, product metrics, visibility, and period refetch', async () => {
    const { container, root } = mountPage();
    await flush();

    expect(inventoryLedgerService.getAllMovements).toHaveBeenCalledWith({
      date_from: '2026-01-01',
      date_to: '2026-10-31',
    });

    const movementCard = Array.from(container.querySelectorAll('[role="button"]')).find(el => el.textContent?.includes('Stock movement'));
    await act(async () => {
      movementCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('4827');
    expect(container.textContent).toMatch(/0W-16[\s\S]*\+1[\s\S]*-1[\s\S]*4827/);
    expect(container.textContent).toContain('4193');
    expect(container.textContent).not.toContain('ledger gap');

    const movementTable = Array.from(container.querySelectorAll('table')).find(
      t => t.textContent?.includes('Adjustments') && t.textContent?.includes('Turnover'),
    );
    expect(movementTable).toBeTruthy();
    const openingColIdx = Array.from(movementTable!.querySelectorAll('thead th')).findIndex(
      th => th.textContent?.trim() === 'Opening',
    );
    movementTable!.querySelectorAll('tbody tr').forEach(tr => {
      const openingText = tr.querySelectorAll('td')[openingColIdx]?.textContent?.trim() ?? '';
      expect(Number(openingText)).toBeGreaterThanOrEqual(0);
    });

    const totalOpeningValue = 4827 * 39.01 + 4193 * 26.21;
    const totalClosingValue = totalOpeningValue;
    const valueDelta = totalClosingValue - totalOpeningValue;
    const netMovementText = Array.from(container.querySelectorAll('p'))
      .find(p => p.textContent?.trim() === 'Net Movement')
      ?.parentElement?.querySelectorAll('p')[1]?.textContent ?? '';
    expect(totalOpeningValue).toBeGreaterThan(0);
    const expectedPct = ((valueDelta / totalOpeningValue) * 100).toFixed(1);
    expect(netMovementText).toContain(`(${valueDelta >= 0 ? '+' : ''}${expectedPct}%)`);

    expect(container.textContent).toContain('Dead');

    const forecastCard = Array.from(container.querySelectorAll('[role="button"]')).find(el => el.textContent?.includes('Demand forecasting'));
    expect(forecastCard).toBeTruthy();
    await act(async () => {
      forecastCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain('2.5');
    expect(container.textContent).toContain('75');
    expect(container.textContent).toContain('12%');
    expect(container.textContent).toContain('High');
    expect(container.textContent).toContain('OK');

    const demandTable = Array.from(container.querySelectorAll('table')).find(
      t => t.textContent?.includes('Confidence') && t.textContent?.includes('Forecast'),
    );
    expect(demandTable).toBeTruthy();
    const demandHeaders = Array.from(demandTable!.querySelectorAll('thead th')).map(th => th.textContent?.trim());
    const confidenceIdx = demandHeaders.indexOf('Confidence');
    const p003DemandRow = Array.from(demandTable!.querySelectorAll('tbody tr')).find(tr =>
      tr.textContent?.includes('0W-20') || tr.textContent?.includes('P003'),
    );
    expect(p003DemandRow?.querySelectorAll('td')[confidenceIdx]?.textContent?.trim()).toBe('—');

    const filterTable = Array.from(container.querySelectorAll('table')).find(
      t => t.textContent?.includes('Days Left') && t.textContent?.includes('Margin'),
    );
    expect(filterTable).toBeTruthy();
    const filterHeaders = Array.from(filterTable!.querySelectorAll('thead th')).map(th => th.textContent?.trim());
    const daysLeftIdx = filterHeaders.indexOf('Days Left');
    const p003FilterRow = Array.from(filterTable!.querySelectorAll('tbody tr')).find(tr =>
      tr.textContent?.includes('0W-20'),
    );
    expect(p003FilterRow?.querySelectorAll('td')[daysLeftIdx]?.textContent?.trim()).toBe('—');

    expect(container.textContent).toContain('29.1%');
    expect(container.textContent).toContain('34.5%');
    expect(container.textContent).toContain('1931');

    expect(container.textContent).toContain('Demand forecasting');
    expect(container.textContent).not.toContain('FIFO valuation');
    expect(container.textContent).not.toContain('LIFO valuation');
    expect(container.textContent).not.toContain('Loss & leakage');

    const lastQuarterBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Last quarter'));
    await act(async () => {
      lastQuarterBtn?.click();
    });
    await flush();

    expect(inventoryLedgerService.getAllMovements).toHaveBeenCalledWith({
      date_from: '2026-07-01',
      date_to: '2026-09-30',
    });

    root.unmount();
  });
});
