import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductForm from '../ProductForm';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
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

vi.mock('../../../services/settingsService', () => ({
  getSystemSettings: () => ({ defaultCurrencyCode: 'BHD' }),
  formatCurrency: (n: number) => String(n),
}));

vi.mock('../../../components/Inventory/ImageUpload', () => ({
  ImageUpload: () => null,
}));

function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = el instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function field(container: HTMLElement, label: string) {
  return container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | HTMLSelectElement;
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
  leadTimeDays: 0,
  minOrderQty: 0,
  packCount: 2,
} as Product;

describe('Product catalog form', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(productService.productCategoryService.list).mockResolvedValue([
      { id: 3, name: 'Lubricants', parent_id: null, is_active: true },
    ]);
    vi.mocked(productService.getProductById).mockResolvedValue(loadedProduct);
    vi.mocked(productService.listProductBarcodes).mockResolvedValue([]);
    vi.mocked(productService.saveProduct).mockResolvedValue(loadedProduct);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([
      { id: '8', name: 'Acme Supply', code: '', contactPerson: '', email: '', phone: '', taxId: '', status: 'Active', paymentTerms: 'Net 30', currency: 'USD' },
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

  async function renderAt(path: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/products/new" element={<ProductForm />} />
            <Route path="/products/edit/:id" element={<ProductForm />} />
            <Route path="/products" element={<div>Catalog</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((el) => el.textContent?.trim() === label);
    expect(button).toBeTruthy();
    button?.click();
  }

  it('submits catalog fields on create and on update, and a legacy payload still submits', async () => {
    await renderAt('/products/new');
    setValue(field(container, 'Brand') as HTMLInputElement, 'Mobil');
    const name = container.querySelector('input[placeholder="e.g. 15W40 Engine Oil (4L)"]') as HTMLInputElement;
    const sku = container.querySelector('input[placeholder="BT15-40"]') as HTMLInputElement;
    setValue(name, 'Catalog Oil');
    setValue(sku, 'CAT-1');
    setValue(field(container, 'Category') as HTMLSelectElement, '3');
    setValue(field(container, 'Base unit') as HTMLInputElement, 'qt');
    setValue(field(container, 'Pack qty') as HTMLInputElement, '12');
    setValue(field(container, 'Pack unit') as HTMLInputElement, 'case');
    setValue(field(container, 'Reorder point') as HTMLInputElement, '4');
    setValue(field(container, 'Reorder qty') as HTMLInputElement, '6');
    setValue(field(container, 'Max stock') as HTMLInputElement, '40');
    setValue(field(container, 'Lead time days') as HTMLInputElement, '5');
    setValue(field(container, 'Preferred supplier') as HTMLSelectElement, '8');
    setValue(field(container, 'Supplier SKU') as HTMLInputElement, 'SUP-1');
    (field(container, 'Lot tracked') as HTMLInputElement).click();
    (field(container, 'Expiry tracked') as HTMLInputElement).click();
    setValue(field(container, 'Shelf life days') as HTMLInputElement, '30');
    setValue(field(container, 'Hazmat class') as HTMLInputElement, '3');
    setValue(field(container, 'Weight kg') as HTMLInputElement, '1.2');
    setValue(field(container, 'Volume L') as HTMLInputElement, '4');
    setValue(field(container, 'Cost method') as HTMLSelectElement, 'fifo');
    (field(container, 'Discontinued') as HTMLInputElement).click();

    await act(async () => {
      clickButton('Save');
    });
    await flush();

    expect(productService.saveProduct).toHaveBeenCalled();
    const created = vi.mocked(productService.saveProduct).mock.calls[0][0];
    expect(created).toMatchObject({
      name: 'Catalog Oil',
      sku: 'CAT-1',
      category: 'Lubricants',
      categoryId: 3,
      brand: 'Mobil',
      baseUnit: 'qt',
      packQty: 12,
      packUnit: 'case',
      reorderPoint: 4,
      reorderQty: 6,
      maxStock: 40,
      leadTimeDays: 5,
      preferredSupplierId: 8,
      supplierSku: 'SUP-1',
      lotTracked: true,
      expiryTracked: true,
      shelfLifeDays: 30,
      hazmatClass: '3',
      weightKg: 1.2,
      volumeL: 4,
      costMethod: 'fifo',
      isDiscontinued: true,
    });
  });

  it('submits a legacy payload without the new catalog fields', async () => {
    await renderAt('/products/new');
    setValue(container.querySelector('input[placeholder="e.g. 15W40 Engine Oil (4L)"]') as HTMLInputElement, 'Legacy Oil');
    setValue(container.querySelector('input[placeholder="BT15-40"]') as HTMLInputElement, 'LEG-1');
    setValue(field(container, 'Category name') as HTMLInputElement, 'Lubricants');
    await act(async () => {
      clickButton('Save');
    });
    await flush();
    const legacy = vi.mocked(productService.saveProduct).mock.calls.at(-1)?.[0];
    expect(legacy?.name).toBe('Legacy Oil');
    expect(legacy?.sku).toBe('LEG-1');
    expect(legacy?.category).toBe('Lubricants');
    expect(legacy?.packQty).toBeUndefined();
    expect(legacy?.lotTracked).toBeUndefined();
    expect(legacy?.reorderQty).toBeUndefined();
    expect(legacy?.shelfLifeDays).toBeUndefined();
    expect(legacy?.costMethod).toBe('average');
  });

  it('submits catalog fields on update', async () => {
    await renderAt('/products/edit/4');
    setValue(field(container, 'Brand') as HTMLInputElement, 'Castrol');
    setValue(field(container, 'Pack qty') as HTMLInputElement, '6');
    await act(async () => {
      clickButton('Save');
    });
    await flush();
    const updated = vi.mocked(productService.saveProduct).mock.calls.at(-1)?.[0];
    expect(updated?.id).toBe('4');
    expect(updated?.brand).toBe('Castrol');
    expect(updated?.packQty).toBe(6);
    expect(updated?.categoryId).toBe(3);
  });

  it('disables and clears shelf life when expiry tracking is off', async () => {
    await renderAt('/products/new');
    const expiry = field(container, 'Expiry tracked') as HTMLInputElement;
    expiry.click();
    await flush();
    const shelf = field(container, 'Shelf life days') as HTMLInputElement;
    expect(shelf.disabled).toBe(false);
    setValue(shelf, '30');
    expect(shelf.value).toBe('30');
    expiry.click();
    await flush();
    const cleared = field(container, 'Shelf life days') as HTMLInputElement;
    expect(cleared.disabled).toBe(true);
    expect(cleared.value).toBe('');
  });

  it('posts a new category and selects the returned id', async () => {
    vi.mocked(productService.productCategoryService.create).mockResolvedValue({
      id: 9,
      name: 'Gear Oil',
      parent_id: null,
      is_active: true,
    });
    await renderAt('/products/new');
    await act(async () => {
      clickButton('+ Add category');
    });
    setValue(field(container, 'New category name') as HTMLInputElement, 'Gear Oil');
    await act(async () => {
      clickButton('Save category');
    });
    await flush();
    expect(productService.productCategoryService.create).toHaveBeenCalledWith({ name: 'Gear Oil', is_active: true });
    expect((field(container, 'Category') as HTMLSelectElement).value).toBe('9');
    expect((field(container, 'Category name') as HTMLInputElement).value).toBe('Gear Oil');
  });

  it('adds and deletes a barcode and renders a 409 detail', async () => {
    vi.mocked(productService.listProductBarcodes).mockResolvedValue([
      { id: 1, product_id: 4, barcode: 'PRI-1', pack_qty: null, is_primary: true },
    ]);
    vi.mocked(productService.addProductBarcode)
      .mockResolvedValueOnce({ id: 2, product_id: 4, barcode: 'CASE-6', pack_qty: 6, is_primary: false })
      .mockRejectedValueOnce(new Error('barcode already exists for this tenant'));
    await renderAt('/products/edit/4');
    expect(container.textContent).toContain('PRI-1');
    expect(container.textContent).toContain('Primary');
    expect(container.querySelector('[aria-label="Delete barcode PRI-1"]')).toBeNull();

    setValue(field(container, 'New barcode') as HTMLInputElement, 'CASE-6');
    setValue(field(container, 'Barcode pack qty') as HTMLInputElement, '6');
    await act(async () => {
      clickButton('Add barcode');
    });
    await flush();
    expect(productService.addProductBarcode).toHaveBeenCalledWith('4', {
      barcode: 'CASE-6',
      pack_qty: 6,
      is_primary: false,
    });
    expect(container.textContent).toContain('CASE-6');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[aria-label="Delete barcode CASE-6"]')?.click();
    });
    await flush();
    expect(productService.removeProductBarcode).toHaveBeenCalledWith('4', 2);

    setValue(field(container, 'New barcode') as HTMLInputElement, 'DUP-1');
    await act(async () => {
      clickButton('Add barcode');
    });
    await flush();
    expect(container.textContent).toContain('barcode already exists for this tenant');
  });
});
