import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductForm from '../ProductForm';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as stockLocationService from '../../../services/stockLocationService';
import * as valuationService from '../../../services/inventoryValuationService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
  getProductById: vi.fn(),
  saveProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProductBarcodes: vi.fn(),
  addProductBarcode: vi.fn(),
  removeProductBarcode: vi.fn(),
  productCategoryService: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
vi.mock('../../../services/purchasesService', () => ({ getSuppliers: vi.fn() }));
vi.mock('../../../services/stockLocationService', () => ({ getLocationsFlat: vi.fn() }));
vi.mock('../../../services/reorderService', () => ({ getSuggestSettings: vi.fn() }));
vi.mock('../../../services/inventoryValuationService', () => ({ listRevaluations: vi.fn() }));
vi.mock('../../../services/settingsService', () => ({
  getSystemSettings: () => ({ defaultCurrencyCode: 'BHD' }),
  formatCurrency: (n: number) => `$${n}`,
}));
vi.mock('../../../components/Inventory/ImageUpload', () => ({ ImageUpload: () => null }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const loaded = {
  id: '4',
  name: 'Loaded Oil',
  sku: 'LOAD-1',
  category: 'Lubricants',
  categoryId: 3,
  status: 'Active',
  description: '',
  uom: 'Pieces',
  locations: [{ id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse', currentStock: 8, reorderPoint: 2 }],
  pricing: {
    purchasePriceExWorks: 4,
    freightShipping: 0,
    importDuty: 0,
    otherDirectCosts: 0,
    landedCost: 4,
    operatingExpenseAllocation: 0,
    sellingPrice: 9,
    taxRate: 0,
    taxIncluded: false,
  },
  images: [],
  specifications: [],
  tags: [],
  seo: { metaTitle: '', metaDescription: '', keywords: '' },
} as Product;

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ProductForm cost change', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(stockLocationService.getLocationsFlat).mockResolvedValue([]);
    vi.mocked(productService.productCategoryService.list).mockResolvedValue([{ id: 3, name: 'Lubricants', parent_id: null, is_active: true }]);
    vi.mocked(productService.getProductById).mockResolvedValue(loaded);
    vi.mocked(productService.listProductBarcodes).mockResolvedValue([]);
    vi.mocked(productService.saveProduct).mockResolvedValue(loaded);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
    vi.mocked(valuationService.listRevaluations).mockResolvedValue([
      {
        id: 21,
        product_id: 4,
        old_cost: 3,
        new_cost: 4,
        quantity: 8,
        amount: 8,
        journal_entry_id: 77,
        reason: 'Price list',
        source: 'product_edit',
        created_by: 1,
        created_at: '2026-10-20T08:00:00+00:00',
      },
    ]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function render(path = '/products/edit/4') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/products/edit/:id" element={<ProductForm />} />
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products" element={<div>Catalog</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  function button(label: string, scope: ParentNode = container): HTMLButtonElement {
    const found = Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
    if (!found) throw new Error(`No button ${label}`);
    return found as HTMLButtonElement;
  }

  async function click(el: HTMLElement) {
    await act(async () => {
      el.click();
    });
    await flush();
  }

  it('saves straight away when the cost is unchanged', async () => {
    await render();
    expect(container.textContent).toContain('Changing the cost revalues stock on hand and posts a journal.');
    await click(button('Save'));
    expect(container.querySelector('[aria-label="Confirm cost change"]')).toBeNull();
    expect(productService.saveProduct).toHaveBeenCalledTimes(1);
    expect(vi.mocked(productService.saveProduct).mock.calls[0][1]).toBeUndefined();
  });

  it('asks first when the cost changed; Confirm sends the reason, Cancel saves nothing', async () => {
    await render();
    await act(async () => {
      setValue(container.querySelector('[aria-label="Cost"]') as HTMLInputElement, '6');
    });
    await click(button('Save'));
    const dialog = container.querySelector('[aria-label="Confirm cost change"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[data-testid="cost-change-summary"]')?.textContent).toBe('Cost $4 → $6');
    expect(productService.saveProduct).not.toHaveBeenCalled();

    await click(button('Cancel', dialog));
    expect(container.querySelector('[aria-label="Confirm cost change"]')).toBeNull();
    expect(productService.saveProduct).not.toHaveBeenCalled();

    await click(button('Save'));
    await act(async () => {
      setValue(container.querySelector('[aria-label="Cost change reason"]') as HTMLTextAreaElement, 'New supplier contract');
    });
    await click(button('Confirm', container.querySelector('[aria-label="Confirm cost change"]') as HTMLElement));
    expect(productService.saveProduct).toHaveBeenCalledTimes(1);
    const [saved, options] = vi.mocked(productService.saveProduct).mock.calls[0];
    expect(saved.pricing?.purchasePriceExWorks).toBe(6);
    expect(options).toEqual({ costChangeReason: 'New supplier contract' });
  });

  it('never asks in create mode', async () => {
    await render('/products/new');
    expect(container.textContent).not.toContain('Changing the cost revalues stock on hand');
  });

  it('Cost history opens the read-only panel', async () => {
    await render();
    await click(button('Cost history'));
    const panel = container.querySelector('[role="dialog"][aria-label="Cost history"]') as HTMLElement;
    expect(valuationService.listRevaluations).toHaveBeenCalledWith(4);
    const row = panel.querySelector('[data-testid="revaluation-21"]') as HTMLElement;
    expect(row.textContent).toContain('$3 → $4');
    expect(row.textContent).toContain('Product edit');
    expect(row.textContent).toContain('Price list');
    expect(row.textContent).toContain('#77');
  });
});
