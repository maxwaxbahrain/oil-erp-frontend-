import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductForm from '../ProductForm';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as reorderService from '../../../services/reorderService';
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

vi.mock('../../../services/purchasesService', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../services/reorderService', () => ({
  getSuggestSettings: vi.fn(),
}));

vi.mock('../../../services/settingsService', () => ({
  getSystemSettings: () => ({ defaultCurrencyCode: 'USD' }),
  formatCurrency: (n: number) => String(n),
}));

vi.mock('../../../components/Inventory/ImageUpload', () => ({
  ImageUpload: () => null,
}));

const product = {
  id: '4',
  name: 'Case Oil',
  sku: 'CASE-1',
  category: 'Lubricants',
  categoryId: 3,
  status: 'Active',
  description: '',
  uom: 'Pieces',
  locations: [{ id: 'LOC-001', name: 'Main Warehouse', type: 'Warehouse', currentStock: 8, reorderPoint: 2 }],
  pricing: {
    purchasePriceExWorks: 1,
    freightShipping: 0,
    importDuty: 0,
    otherDirectCosts: 0,
    landedCost: 1,
    operatingExpenseAllocation: 0,
    sellingPrice: 3,
    taxRate: 0,
    taxIncluded: false,
  },
  images: [],
  specifications: [],
  tags: [],
  seo: { metaTitle: '', metaDescription: '', keywords: '' },
  reorderLevel: 2,
  reorderPoint: 5,
  reorderQty: 4,
  packQty: 12,
  leadTimeDays: 7,
  minOrderQty: 0,
} as unknown as Product;

describe('Product form reorder Suggest', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('alert', vi.fn());
    vi.mocked(productService.productCategoryService.list).mockResolvedValue([]);
    vi.mocked(productService.getProductById).mockResolvedValue(product);
    vi.mocked(productService.listProductBarcodes).mockResolvedValue([]);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
    vi.mocked(reorderService.getSuggestSettings).mockResolvedValue({
      product_id: 4,
      suggested_reorder_point: 11,
      suggested_reorder_qty: 36,
      avg_daily: 1,
      lead_time: 7,
      safety_factor: 1.5,
      pack_qty: 12,
      demand_window_days: 90,
    });
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

  async function renderAt(path: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/edit/:id" element={<ProductForm />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  function input(label: string) {
    return container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
  }

  it('shows the suggestion and Apply fills the two fields without saving', async () => {
    await renderAt('/products/edit/4');
    expect(input('Reorder point').value).toBe('5');
    expect(input('Reorder qty').value).toBe('4');

    await act(async () => {
      (container.querySelector('[data-testid="suggest-reorder"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(reorderService.getSuggestSettings).toHaveBeenCalledWith(4);
    const panel = container.querySelector('[data-testid="reorder-suggestion"]')?.textContent ?? '';
    expect(panel).toContain('Suggested reorder point 11 · reorder qty 36');
    expect(panel).toContain('avg daily 1');
    expect(panel).toContain('lead time 7 days');
    expect(panel).toContain('safety factor 1.5');
    expect(panel).toContain('pack qty 12');
    expect(panel).toContain('window 90 days');
    expect(input('Reorder point').value).toBe('5');

    await act(async () => {
      (container.querySelector('[data-testid="apply-reorder-suggestion"]') as HTMLButtonElement).click();
    });
    await flush();

    expect(input('Reorder point').value).toBe('11');
    expect(input('Reorder qty').value).toBe('36');
    expect(productService.saveProduct).not.toHaveBeenCalled();
  });

  it('hides Suggest in create mode', async () => {
    await renderAt('/products/new');
    expect(container.querySelector('[data-testid="suggest-reorder"]')).toBeNull();
    expect(reorderService.getSuggestSettings).not.toHaveBeenCalled();
  });
});
