import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExpiringStock from '../ExpiringStock';
import { expiringCsv } from '../expiryCsv';
import * as lotService from '../../../services/stockLotService';
import type { ExpiringLot } from '../../../services/stockLotService';
import { isSidebarPathAllowed, WAREHOUSE_PAGE_ROLES } from '../../../utils/rbac';

vi.mock('../../../services/stockLotService', () => ({ getExpiringLots: vi.fn() }));
vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn().mockResolvedValue([{ id: '9', name: 'Lot oil', sku: 'LOT-OIL' }]),
}));
vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn().mockResolvedValue([{ id: 5, code: 'B-01' }]),
}));

const rows: ExpiringLot[] = [
  { lot_id: 6, lot_number: 'OLD', expiry_date: '2026-10-01', product_id: 9, location_id: 5, qty: 1, days_left: -24, expired: true },
  { lot_id: 3, lot_number: 'A, "first"', expiry_date: '2026-11-14', product_id: 9, location_id: 5, qty: 5, days_left: 20, expired: false },
];

describe('Expiring stock page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(lotService.getExpiringLots).mockReset().mockResolvedValue(rows);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ExpiringStock />
        </MemoryRouter>,
      );
    });
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('renders rows, and the selector and toggle send their values', async () => {
    await render();
    expect(lotService.getExpiringLots).toHaveBeenLastCalledWith(30, true);
    const old = container.querySelector('[data-testid="expiring-row-6-5"]')!;
    expect(old.textContent).toContain('Lot oil');
    expect(old.textContent).toContain('LOT-OIL');
    expect(old.textContent).toContain('B-01');
    expect(old.textContent).toContain('-24');
    expect(old.textContent).toContain('expired');
    expect(old.querySelector('a')?.getAttribute('href')).toBe('/products/9');
    expect(container.querySelector('[data-testid="expiring-row-3-5"]')!.textContent).not.toContain('expired');

    const select = container.querySelector('select[aria-label="Within days"]') as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, '90');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(lotService.getExpiringLots).toHaveBeenLastCalledWith(90, true);
    await act(async () => (container.querySelector('input[aria-label="Include expired"]') as HTMLInputElement).click());
    expect(lotService.getExpiringLots).toHaveBeenLastCalledWith(90, false);
  });

  it('builds the CSV from the rows on screen', () => {
    const csv = expiringCsv(rows, new Map([[9, { name: 'Lot oil', sku: 'LOT-OIL' }]]), new Map([[5, 'B-01']]));
    expect(csv.split('\n')).toEqual([
      'Product,SKU,Lot,Expiry,Days left,Location,Qty,Expired',
      'Lot oil,LOT-OIL,OLD,2026-10-01,-24,B-01,1,yes',
      'Lot oil,LOT-OIL,"A, ""first""",2026-11-14,20,B-01,5,no',
    ]);
  });

  it('warehouse role can reach /warehouse/expiry', () => {
    expect(WAREHOUSE_PAGE_ROLES).toContain('warehouse');
    expect(isSidebarPathAllowed('warehouse', '/warehouse/expiry')).toBe(true);
  });
});
