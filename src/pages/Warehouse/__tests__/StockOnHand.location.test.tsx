import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StockOnHand from '../StockOnHand';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';
import * as stockLocationService from '../../../services/stockLocationService';

vi.mock('../../../services/inventoryLedgerService', () => ({
  getOnHand: vi.fn(),
}));

vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn(),
  isStockHoldingKind: (kind: string) => kind === 'bin' || kind === 'warehouse' || kind === 'van',
}));

// The inventory agent panel has its own tests (InventoryAgentPanel.test.tsx).
vi.mock('../InventoryAgentPanel', () => ({ default: () => null }));

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => `$${n}`,
}));

function setValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('StockOnHand location filter', () => {
  beforeEach(() => {
    vi.mocked(stockLocationService.getLocationsFlat).mockResolvedValue([
      {
        id: 1,
        code: 'MAIN',
        name: 'Main',
        kind: 'warehouse',
        vanId: null,
        isActive: true,
        parentId: null,
        path: 'MAIN',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
      },
      {
        id: 2,
        code: 'A',
        name: 'Zone A',
        kind: 'zone',
        vanId: null,
        isActive: true,
        parentId: 1,
        path: 'MAIN/A',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
      },
    ]);
    vi.mocked(inventoryLedgerService.getOnHand).mockResolvedValue({
      rows: [
        {
          product_id: 7,
          name: 'Oil',
          sku: 'OIL-1',
          unit: 'qt',
          on_hand: 10,
          stock_cached: 10,
          cost: 4,
          value_at_cost: 40,
          min_stock: 0,
          last_movement_date: null,
          days_since_movement: null,
          drift: false,
          by_location: [
            { location_id: 2, code: 'A', kind: 'zone', path: 'MAIN/A', on_hand: 10 },
          ],
        },
      ],
      total: 1,
      totals: { products: 1, units: 10, value_at_cost: 40 },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('choosing Under MAIN/A calls getOnHand with path_prefix and shows path in breakdown', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/warehouse/stock']}>
          <StockOnHand />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const select = container.querySelector('[aria-label="Location filter"]') as HTMLSelectElement;
    await act(() => {
      setValue(select, 'under:MAIN/A');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(inventoryLedgerService.getOnHand).toHaveBeenCalledWith(
      expect.objectContaining({ path_prefix: 'MAIN/A', by_location: true }),
    );

    const productRow = Array.from(container.querySelectorAll('tr')).find((tr) => tr.textContent?.includes('Oil'));
    await act(() => {
      productRow!.click();
    });
    const row = container.querySelector('[data-testid="by-location-7"]');
    expect(row?.textContent).toContain('MAIN/A');

    await act(() => {
      root.unmount();
    });
    container.remove();
  });
});
