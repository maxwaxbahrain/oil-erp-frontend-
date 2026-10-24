import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductForm from '../ProductForm';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as stockLocationService from '../../../services/stockLocationService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
  getProductById: vi.fn(),
  saveProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listProductBarcodes: vi.fn(),
  addProductBarcode: vi.fn(),
  removeProductBarcode: vi.fn(),
  productCategoryService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../../services/purchasesService', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn(),
}));

vi.mock('../../../services/settingsService', () => ({
  getSystemSettings: () => ({ defaultCurrencyCode: 'BHD' }),
  formatCurrency: (n: number) => String(n),
}));

vi.mock('../../../components/Inventory/ImageUpload', () => ({
  ImageUpload: () => null,
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const loadedProduct = {
  id: '4',
  name: 'Loaded Oil',
  sku: 'LOAD-1',
  category: 'Lubricants',
  categoryId: 3,
  status: 'Active',
  description: '',
  uom: 'Pieces',
  defaultLocationId: 10,
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
} as Product;

describe('ProductForm default bin', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(stockLocationService.getLocationsFlat).mockResolvedValue([
      {
        id: 10,
        code: 'B-01',
        name: 'Bin 01',
        kind: 'bin',
        vanId: null,
        isActive: true,
        parentId: 1,
        path: 'MAIN/B-01',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
      },
    ]);
    vi.mocked(productService.productCategoryService.list).mockResolvedValue([
      { id: 3, name: 'Lubricants', parent_id: null, is_active: true },
    ]);
    vi.mocked(productService.getProductById).mockResolvedValue(loadedProduct);
    vi.mocked(productService.listProductBarcodes).mockResolvedValue([]);
    vi.mocked(productService.saveProduct).mockResolvedValue(loadedProduct);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
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

  it('clearing default bin sends null on save', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/products/edit/4']}>
          <Routes>
            <Route path="/products/edit/:id" element={<ProductForm />} />
            <Route path="/products" element={<div>Catalog</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    const select = container.querySelector('[aria-label="Default bin"]') as HTMLSelectElement;
    expect(select.value).toBe('10');

    setValue(select, '');
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save');
    await act(async () => {
      saveBtn?.click();
    });
    await flush();
    expect(productService.saveProduct).toHaveBeenCalled();
    expect(vi.mocked(productService.saveProduct).mock.calls.at(-1)?.[0]?.defaultLocationId).toBeNull();
  });

  it('keeps default_location_id when saved without clearing', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/products/edit/4']}>
          <Routes>
            <Route path="/products/edit/:id" element={<ProductForm />} />
            <Route path="/products" element={<div>Catalog</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save');
    await act(async () => {
      saveBtn?.click();
    });
    await flush();
    expect(vi.mocked(productService.saveProduct).mock.calls.at(-1)?.[0]?.defaultLocationId).toBe(10);
  });
});
