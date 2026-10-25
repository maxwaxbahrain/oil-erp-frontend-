import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StockOnHand from '../StockOnHand';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';

vi.mock('../../../services/inventoryLedgerService', () => ({ getOnHand: vi.fn() }));
vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn().mockResolvedValue([]),
  isStockHoldingKind: (kind: string) => kind === 'bin' || kind === 'warehouse' || kind === 'van',
}));
vi.mock('../InventoryAgentPanel', () => ({ default: () => null }));
vi.mock('../../../services/settingsService', () => ({ formatCurrency: (n: number) => `$${n}` }));

function row(productId: number, lots: { lot_number: string; expiry_date: string | null; qty: number }[]) {
  return {
    product_id: productId,
    name: `Product ${productId}`,
    sku: `SKU-${productId}`,
    unit: 'qt',
    on_hand: 15,
    stock_cached: 15,
    cost: 4,
    value_at_cost: 60,
    min_stock: 0,
    last_movement_date: null,
    days_since_movement: null,
    drift: false,
    by_location: [{ location_id: 5, code: 'B-01', kind: 'bin', path: 'MAIN/A/B-01', on_hand: 15, lots }],
  };
}

describe('StockOnHand lots', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(inventoryLedgerService.getOnHand).mockResolvedValue({
      total: 2,
      totals: { products: 2, units: 30, value_at_cost: 120 },
      rows: [
        row(9, [{ lot_number: 'A', expiry_date: '2026-11-14', qty: 5 }, { lot_number: 'B', expiry_date: null, qty: 10 }]),
        row(10, []),
      ],
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('by-location rows show lots as a sub-line when present', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <StockOnHand />
        </MemoryRouter>,
      );
    });
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    const rowFor = (sku: string) => Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes(sku)) as HTMLElement;
    await act(async () => rowFor('SKU-9').click());
    expect(container.querySelector('[data-testid="by-location-lots-9-5"]')?.textContent).toMatch(/^A 5 \(exp .+\) · B 10$/);
    await act(async () => rowFor('SKU-10').click());
    expect(container.querySelector('[data-testid="by-location-9"]')).toBeNull();
    expect(container.querySelector('[data-testid="by-location-10"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="by-location-lots-10-5"]')).toBeNull();
  });
});
