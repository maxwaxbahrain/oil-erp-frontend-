import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseReturnFormPage from '../PurchaseReturnFormPage';
import * as purchaseReturnService from '../../../services/purchaseReturnService';
import * as purchasesService from '../../../services/purchasesService';
import * as api from '../../../services/api';
import * as productService from '../../../services/productService';
import type { PurchaseReturn } from '../../../services/purchaseReturnService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/purchaseReturnService', () => ({
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../services/purchasesService', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  getProducts: vi.fn(),
}));

vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
  lookupProductByBarcode: vi.fn(),
}));

vi.mock('../../../hooks/useCompanyPaymentAccounts', () => ({
  useCompanyPaymentAccounts: () => ({
    accounts: [{ id: 7, code: '1020', name: 'Operating', role: 'bank', is_active: true, is_default: true, system_key: 'bank', type: 'Asset', balance: 0 }],
    cash: [],
    banks: [{ id: 7, code: '1020', name: 'Operating', role: 'bank', is_active: true, is_default: true, system_key: 'bank', type: 'Asset', balance: 0 }],
    defaultBank: null,
    loading: false,
    error: null,
  }),
}));

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Purchase return form', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([
      { id: '3', name: 'Acme Supply', code: '', contactPerson: '', email: '', phone: '', taxId: '', status: 'Active', paymentTerms: 'Net 30', currency: 'USD' },
    ]);
    vi.mocked(api.getProducts).mockResolvedValue([
      {
        id: '9',
        name: 'Oil',
        sku: 'OIL',
        unit_price: 4,
        cost_price: 2.5,
        current_stock: 10,
      },
    ]);
    vi.mocked(productService.getProducts).mockResolvedValue([]);
    vi.mocked(purchaseReturnService.create).mockResolvedValue({
      id: 11,
      number: 'PR-11',
      status: 'draft',
    } as PurchaseReturn);
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

  async function renderForm() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/returns/new']}>
          <Routes>
            <Route path="/purchases/returns/new" element={<PurchaseReturnFormPage />} />
            <Route path="/purchases/returns/:id" element={<div>Saved</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  function clickSaveDraft() {
    const button = Array.from(container.querySelectorAll('button')).find((el) => el.textContent?.trim() === 'Save draft');
    expect(button).toBeTruthy();
    button?.click();
  }

  it('blocks submit without a supplier or lines', async () => {
    await renderForm();
    await act(async () => {
      clickSaveDraft();
    });
    expect(container.textContent).toContain('Supplier is required');
    expect(purchaseReturnService.create).not.toHaveBeenCalled();

    await act(async () => {
      setValue(container.querySelector('select[aria-label="Supplier"]') as HTMLSelectElement, '3');
    });
    await act(async () => {
      clickSaveDraft();
    });
    expect(container.textContent).toContain('Add at least one line');
    expect(purchaseReturnService.create).not.toHaveBeenCalled();
  });

  it('sends refund_amount null when the amount is blank', async () => {
    await renderForm();
    expect(container.textContent).toContain('stock 10 · cost $2.50');
    const date = (container.querySelector('input[aria-label="Date"]') as HTMLInputElement).value;

    await act(async () => {
      setValue(container.querySelector('select[aria-label="Supplier"]') as HTMLSelectElement, '3');
      setValue(container.querySelector('select[aria-label="Product"]') as HTMLSelectElement, '9');
      setValue(container.querySelector('input[aria-label="Quantity"]') as HTMLInputElement, '2');
    });
    await act(async () => {
      clickSaveDraft();
    });
    await flush();

    expect(purchaseReturnService.create).toHaveBeenCalledWith({
      supplier_id: 3,
      date,
      reason: '',
      notes: '',
      refund_mode: 'none',
      refund_amount: null,
      refund_account_id: null,
      lines: [{
        product_id: 9,
        quantity: 2,
        reason: '',
        entered_qty: 2,
        entered_uom: 'base',
        entered_unit_price: 2.5,
      }],
    });
  });

  it('keeps a pack return price read-only at cost times pack qty', async () => {
    vi.mocked(api.getProducts).mockResolvedValue([
      { id: '9', name: 'Oil', sku: 'OIL', unit_price: 20, cost_price: 8, current_stock: 40 },
    ]);
    vi.mocked(productService.getProducts).mockResolvedValue([
      { id: '9', packQty: 12, packUnit: 'case', baseUnit: 'qt', uom: 'qt' } as Product,
    ]);
    await renderForm();
    await act(async () => {
      setValue(container.querySelector('select[aria-label="Supplier"]') as HTMLSelectElement, '3');
      setValue(container.querySelector('select[aria-label="Product"]') as HTMLSelectElement, '9');
    });
    const pack = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'case');
    expect(pack).toBeTruthy();
    await act(async () => {
      pack?.click();
    });
    const price = container.querySelector('input[aria-label="Price per pack"]') as HTMLInputElement;
    expect(price.readOnly).toBe(true);
    expect(price.value).toBe('96');
    await act(async () => {
      setValue(price, '1');
    });
    expect(price.value).toBe('96');
    await act(async () => {
      clickSaveDraft();
    });
    await flush();
    const body = vi.mocked(purchaseReturnService.create).mock.calls.at(-1)?.[0];
    expect(body?.lines[0]).toMatchObject({
      product_id: 9,
      quantity: 12,
      entered_qty: 1,
      entered_uom: 'pack',
      entered_unit_price: 96,
    });
  });
});
