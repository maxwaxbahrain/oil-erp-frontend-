import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductForm from '../ProductForm';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as stockLocationService from '../../../services/stockLocationService';
import * as valuationService from '../../../services/inventoryValuationService';
import * as lotService from '../../../services/stockLotService';
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
vi.mock('../../../services/stockLotService', () => ({ setLotTracking: vi.fn() }));
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

describe('ProductForm lot tracking', () => {
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
    vi.mocked(valuationService.listRevaluations).mockResolvedValue([]);
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

  function button(label: string): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
    if (!found) throw new Error(`No button ${label}`);
    return found as HTMLButtonElement;
  }

  it('edit mode: the toggle calls setLotTracking, shows the seeded message, and the PUT leaves tracking out', async () => {
    vi.mocked(lotService.setLotTracking).mockResolvedValue({
      product_id: 4,
      lot_tracked: true,
      expiry_tracked: false,
      seeded: [{ location_id: 1, qty: 6 }, { location_id: 5, qty: 2 }],
    });
    await render();
    await act(async () => {
      (container.querySelector('[aria-label="Lot tracked"]') as HTMLInputElement).click();
    });
    await flush();
    expect(lotService.setLotTracking).toHaveBeenCalledWith(4, { lot_tracked: true, expiry_tracked: false });
    expect(container.querySelector('[data-testid="tracking-message"]')?.textContent).toBe('Seeded 8 units into UNASSIGNED at 2 location(s)');
    expect((container.querySelector('[aria-label="Lot tracked"]') as HTMLInputElement).checked).toBe(true);

    await act(async () => {
      button('Save').click();
    });
    await flush();
    const saved = vi.mocked(productService.saveProduct).mock.calls[0][0];
    expect(saved.lotTracked).toBeUndefined();
    expect(saved.expiryTracked).toBeUndefined();
  });

  it('edit mode: a refusal is shown and the box stays as it was', async () => {
    vi.mocked(lotService.setLotTracking).mockRejectedValue(new Error('Not enough permissions'));
    await render();
    await act(async () => {
      (container.querySelector('[aria-label="Lot tracked"]') as HTMLInputElement).click();
    });
    await flush();
    expect(container.querySelector('[data-testid="tracking-error"]')?.textContent).toBe('Not enough permissions');
    expect((container.querySelector('[aria-label="Lot tracked"]') as HTMLInputElement).checked).toBe(false);
  });

  it('create mode: tracking stays in the normal save body', async () => {
    await render('/products/new');
    await act(async () => {
      (container.querySelector('[aria-label="Lot tracked"]') as HTMLInputElement).click();
    });
    await flush();
    expect(lotService.setLotTracking).not.toHaveBeenCalled();
    expect((container.querySelector('[aria-label="Lot tracked"]') as HTMLInputElement).checked).toBe(true);
  });
});
