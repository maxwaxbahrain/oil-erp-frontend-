import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InventoryValuation from '../InventoryValuation';
import * as productService from '../../../services/productService';
import * as valuationService from '../../../services/inventoryValuationService';
import { isSidebarPathAllowed } from '../../../utils/rbac';
import type { ValuationReport } from '../../../services/inventoryValuationService';

vi.mock('../../../services/productService', () => ({
  productCategoryService: { list: vi.fn() },
}));
vi.mock('../../../services/inventoryValuationService', () => ({
  getValuation: vi.fn(),
  downloadValuationCsv: vi.fn(),
}));
vi.mock('../../../services/settingsService', () => ({ formatCurrency: (n: number) => `$${n}` }));

const report: ValuationReport = {
  as_of: null,
  rows: [
    {
      product_id: 1,
      sku: 'OIL-1',
      name: 'Engine Oil',
      on_hand: 20,
      cost: 6,
      value: 120,
      last_receipt_cost: 8,
      last_movement_date: '2026-10-20',
      cost_method: 'average',
    },
    {
      product_id: 2,
      sku: 'GRS-1',
      name: 'Grease',
      on_hand: 5,
      cost: 3,
      value: 15,
      last_receipt_cost: null,
      last_movement_date: null,
      cost_method: 'average',
    },
  ],
  totals: { products: 2, units: 25, value: 135 },
  gl_inventory: 130,
  difference: 5,
};

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Inventory valuation page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(productService.productCategoryService.list).mockResolvedValue([
      { id: 3, name: 'Lubricants', parent_id: null, is_active: true },
    ]);
    vi.mocked(valuationService.getValuation).mockResolvedValue(report);
    vi.mocked(valuationService.downloadValuationCsv).mockResolvedValue();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <InventoryValuation />
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('renders rows, totals, the GL strip and the as-of note', async () => {
    await render();
    expect(valuationService.getValuation).toHaveBeenCalledWith({ as_of: undefined, category_id: undefined, search: undefined });
    const first = container.querySelector('[data-testid="valuation-row-1"]') as HTMLElement;
    expect(first.textContent).toContain('OIL-1');
    expect(first.textContent).toContain('Engine Oil');
    expect(first.textContent).toContain('$6');
    expect(first.textContent).toContain('$120');
    expect(first.textContent).toContain('$8');
    expect(container.querySelector('[data-testid="valuation-row-2"]')?.textContent).toContain('—');
    const totals = container.querySelector('[data-testid="valuation-totals"]') as HTMLElement;
    expect(totals.textContent).toContain('2 products');
    expect(totals.textContent).toContain('25');
    expect(totals.textContent).toContain('$135');
    expect(container.querySelector('[data-testid="valuation-gl-strip"]')?.textContent).toBe('GL inventory $130 · Difference $5');
    expect(container.textContent).toContain("As-of shows past quantities at today's cost.");
  });

  it('filters send their params and a null difference shows the note', async () => {
    await render();
    vi.mocked(valuationService.getValuation).mockResolvedValue({ ...report, difference: null });
    await act(async () => {
      setValue(container.querySelector('[aria-label="As of"]') as HTMLInputElement, '2026-10-01');
    });
    await flush();
    await act(async () => {
      setValue(container.querySelector('[aria-label="Category"]') as HTMLSelectElement, '3');
    });
    await flush();
    await act(async () => {
      setValue(container.querySelector('[aria-label="Search name or SKU"]') as HTMLInputElement, ' oil ');
    });
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(valuationService.getValuation).toHaveBeenLastCalledWith({ as_of: '2026-10-01', category_id: 3, search: 'oil' });
    expect(container.querySelector('[data-testid="valuation-gl-strip"]')?.textContent).toBe('Difference shown for the whole company only');

    const exportButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Export CSV') as HTMLButtonElement;
    await act(async () => {
      exportButton.click();
    });
    await flush();
    expect(valuationService.downloadValuationCsv).toHaveBeenCalledWith({ as_of: '2026-10-01', category_id: 3, search: 'oil' });
  });

  it('is not on the warehouse role allowlist', () => {
    expect(isSidebarPathAllowed('warehouse', '/warehouse/valuation')).toBe(false);
    expect(isSidebarPathAllowed('accountant', '/warehouse/valuation')).toBe(true);
  });
});
