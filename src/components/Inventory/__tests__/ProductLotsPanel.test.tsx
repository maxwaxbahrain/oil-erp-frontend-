import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductLotsPanel from '../ProductLotsPanel';
import * as lotService from '../../../services/stockLotService';

vi.mock('../../../services/stockLotService', () => ({
  getLotBalances: vi.fn(),
  getExpiringLots: vi.fn(),
  getLot: vi.fn(),
  patchLot: vi.fn(),
}));
vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn().mockResolvedValue([
    { id: 1, code: 'MAIN' },
    { id: 5, code: 'B-01' },
  ]),
}));

const balances = [
  { lot_id: 3, lot_number: 'A', expiry_date: '2026-11-14', product_id: 9, location_id: 5, qty: 5 },
  { lot_id: 3, lot_number: 'A', expiry_date: '2026-11-14', product_id: 9, location_id: 1, qty: 2 },
  { lot_id: 4, lot_number: 'B', expiry_date: '2027-02-22', product_id: 9, location_id: 5, qty: 10 },
  { lot_id: 6, lot_number: 'OLD', expiry_date: '2026-10-01', product_id: 9, location_id: 5, qty: 1 },
];

describe('ProductLotsPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(lotService.getLotBalances).mockResolvedValue(balances);
    vi.mocked(lotService.getExpiringLots).mockResolvedValue([
      { ...balances[0], days_left: 20, expired: false },
      { ...balances[3], days_left: -24, expired: true },
      { lot_id: 99, lot_number: 'OTHER', expiry_date: '2026-11-01', product_id: 77, location_id: 5, qty: 1, days_left: 7, expired: false },
    ]);
    vi.mocked(lotService.getLot).mockResolvedValue({
      id: 3, product_id: 9, lot_number: 'A', expiry_date: '2026-11-14', received_date: '2026-10-01',
      supplier_id: null, source_grn_id: 'PO-1', note: 'shelf 3', unassigned: false, balances: [], movements: [],
    });
    vi.mocked(lotService.patchLot).mockResolvedValue({
      id: 3, product_id: 9, lot_number: 'A', expiry_date: '2026-12-31', received_date: '2026-10-01',
      supplier_id: null, source_grn_id: 'PO-1', note: 'relabelled', unassigned: false,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function render(canEdit: boolean) {
    await act(async () => {
      root.render(<ProductLotsPanel productId={9} canEdit={canEdit} />);
    });
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  function type(el: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('renders balances by lot then location with expiring and expired chips', async () => {
    await render(false);
    expect(lotService.getLotBalances).toHaveBeenCalledWith(9);
    const rows = Array.from(container.querySelectorAll('tbody tr')).map((row) => row.getAttribute('data-testid'));
    expect(rows).toEqual(['lot-row-3-5', 'lot-row-3-1', 'lot-row-4-5', 'lot-row-6-5']);
    const first = container.querySelector('[data-testid="lot-row-3-5"]')!.textContent;
    expect(first).toContain('B-01');
    expect(first).toContain('expires in 20d');
    expect(container.querySelector('[data-testid="lot-row-6-5"]')!.textContent).toContain('expired');
    expect(container.querySelector('[data-testid="lot-row-4-5"]')!.textContent).not.toContain('expire');
    expect(container.textContent).not.toContain('Edit');
  });

  it('patchLot sends the edit and refetches', async () => {
    await render(true);
    const edit = container.querySelector('[data-testid="lot-row-3-5"] button') as HTMLButtonElement;
    await act(async () => edit.click());
    await act(async () => {
      await Promise.resolve();
    });
    expect(lotService.getLot).toHaveBeenCalledWith(3);
    const note = container.querySelector('input[aria-label="Lot note"]') as HTMLInputElement;
    expect(note.value).toBe('shelf 3');
    await act(async () => type(container.querySelector('input[aria-label="Lot expiry"]') as HTMLInputElement, '2026-12-31'));
    await act(async () => type(note, 'relabelled'));
    const save = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Save lot') as HTMLButtonElement;
    await act(async () => save.click());
    await act(async () => {
      await Promise.resolve();
    });
    expect(lotService.patchLot).toHaveBeenCalledWith(3, { expiry_date: '2026-12-31', note: 'relabelled' });
    expect(vi.mocked(lotService.getLotBalances).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
