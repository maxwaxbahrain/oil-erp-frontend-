import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseReturnFormPage from '../PurchaseReturnFormPage';
import * as purchaseReturnService from '../../../services/purchaseReturnService';
import * as purchasesService from '../../../services/purchasesService';
import * as api from '../../../services/api';
import * as productService from '../../../services/productService';
import * as lotService from '../../../services/stockLotService';
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

vi.mock('../../../services/stockLotService', () => ({ getLotBalances: vi.fn() }));

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

describe('Purchase return form lots', () => {
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
      { id: '9', name: 'Lot oil', sku: 'LOT-OIL', unit_price: 4, cost_price: 2.5, current_stock: 10 },
    ]);
    vi.mocked(productService.getProducts).mockResolvedValue([
      { id: '9', lotTracked: true, expiryTracked: false, uom: 'qt' } as Product,
    ]);
    vi.mocked(lotService.getLotBalances).mockResolvedValue([
      { lot_id: 3, lot_number: 'A', expiry_date: '2026-11-14', product_id: 9, location_id: 1, qty: 5 },
      { lot_id: 4, lot_number: 'B', expiry_date: null, product_id: 9, location_id: 1, qty: 5 },
    ]);
    vi.mocked(purchaseReturnService.create).mockResolvedValue({ id: 11, number: 'PR-11', status: 'draft' } as PurchaseReturn);
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

  async function fillLine(lot: string | null) {
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
    await act(async () => {
      setValue(container.querySelector('select[aria-label="Supplier"]') as HTMLSelectElement, '3');
      setValue(container.querySelector('select[aria-label="Product"]') as HTMLSelectElement, '9');
      setValue(container.querySelector('input[aria-label="Quantity"]') as HTMLInputElement, '2');
    });
    await flush();
    expect(lotService.getLotBalances).toHaveBeenCalledWith(9);
    const select = container.querySelector('select[aria-label="Lot"]') as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toBe('Earliest expiry first (FEFO)');
    expect(labels[1]).toMatch(/^A · .+ · 5$/);
    expect(labels[1]).not.toContain('no expiry');
    expect(labels[2]).toBe('B · no expiry · 5');
    if (lot != null) {
      await act(async () => setValue(select, lot));
    }
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((el) => el.textContent?.trim() === 'Save draft')?.click();
    });
    await flush();
  }

  it('sends lot_id for the chosen lot', async () => {
    await fillLine('3');
    expect(vi.mocked(purchaseReturnService.create).mock.calls[0][0].lines[0]).toMatchObject({ product_id: 9, quantity: 2, lot_id: 3 });
  });

  it('leaves lot_id out for FEFO', async () => {
    await fillLine(null);
    expect(vi.mocked(purchaseReturnService.create).mock.calls[0][0].lines[0]).not.toHaveProperty('lot_id');
  });

  it('shows no lot select for an untracked product', async () => {
    vi.mocked(productService.getProducts).mockResolvedValue([]);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/returns/new']}>
          <Routes>
            <Route path="/purchases/returns/new" element={<PurchaseReturnFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
    await act(async () => {
      setValue(container.querySelector('select[aria-label="Product"]') as HTMLSelectElement, '9');
    });
    await flush();
    expect(container.querySelector('select[aria-label="Lot"]')).toBeNull();
    expect(lotService.getLotBalances).not.toHaveBeenCalled();
  });
});
