import { execSync } from 'node:child_process';
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

describe('InventoryReports Phase 3 velocity, theme, demand formatting', () => {
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

  it('sales-rate velocity, days of cover column, overstock chip, demand rounding, title, no stray hex', async () => {
    const { container, root } = mountPage();
    await flush();

    expect(container.textContent).toContain('Material audit & reporting');
    expect(container.textContent).not.toContain('Enterprise material audit');

    const movementCard = Array.from(container.querySelectorAll('[role="button"]')).find(el => el.textContent?.includes('Stock movement'));
    await act(async () => {
      movementCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    const movementTable = Array.from(container.querySelectorAll('table')).find(
      t => t.textContent?.includes('Days of cover') && t.textContent?.includes('Turnover'),
    );
    expect(movementTable).toBeTruthy();
    const headers = Array.from(movementTable!.querySelectorAll('thead th')).map(th => th.textContent?.trim());
    expect(headers).toContain('Days of cover');

    const velocityIdx = headers.indexOf('Velocity');
    const p011Row = Array.from(movementTable!.querySelectorAll('tbody tr')).find(tr => tr.textContent?.includes('P011'));
    const p003Row = Array.from(movementTable!.querySelectorAll('tbody tr')).find(tr => tr.textContent?.includes('P003'));
    expect(p011Row?.querySelectorAll('td')[velocityIdx]?.textContent?.trim()).toBe('Slow');
    expect(p003Row?.querySelectorAll('td')[velocityIdx]?.textContent?.trim()).toBe('Dead');

    root.unmount();
    document.body.innerHTML = '';

    const mounted = mountPage();
    await flush();

    const overstockChip = Array.from(mounted.container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Overstock risk');
    await act(async () => {
      overstockChip?.click();
    });
    await flush();

    const filterTable = Array.from(mounted.container.querySelectorAll('table')).find(
      t => t.textContent?.includes('Days Left') && t.textContent?.includes('Margin'),
    );
    const filterRows = filterTable ? Array.from(filterTable.querySelectorAll('tbody tr')) : [];
    expect(filterRows.length).toBe(2);
    expect(filterRows.some(tr => tr.textContent?.includes('0W-16'))).toBe(true);
    expect(filterRows.some(tr => tr.textContent?.includes('0W-20'))).toBe(true);

    const forecastCard = Array.from(mounted.container.querySelectorAll('[role="button"]')).find(el => el.textContent?.includes('Demand forecasting'));
    await act(async () => {
      forecastCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(mounted.container.textContent).toContain('2.5');
    const demandTable = Array.from(mounted.container.querySelectorAll('table')).find(
      t => t.textContent?.includes('Forecast') && t.textContent?.includes('Avg daily sales'),
    );
    expect(demandTable).toBeTruthy();
    const forecastIdx = Array.from(demandTable!.querySelectorAll('thead th')).findIndex(th => th.textContent?.includes('Forecast'));
    demandTable!.querySelectorAll('tbody tr').forEach(tr => {
      const forecastCell = tr.querySelectorAll('td')[forecastIdx]?.textContent ?? '';
      if (forecastCell !== '—') {
        expect(forecastCell).not.toMatch(/\./);
      }
    });

    const srcPath = 'src/pages/Inventory/InventoryReports.tsx';
    const hexLines = execSync(`grep -n "#[0-9A-Fa-f]\\{6\\}" ${srcPath} || true`, { encoding: 'utf8' }).trim();
    expect(hexLines).toBe('');

    mounted.root.unmount();
  });
});
