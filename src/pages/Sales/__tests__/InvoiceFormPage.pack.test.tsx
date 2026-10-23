import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvoiceFormPage from '../InvoiceFormPage';
import * as api from '../../../services/api';
import * as productService from '../../../services/productService';
import type { Product } from '../../../services/productService';

const { authFetch } = vi.hoisted(() => ({
  authFetch: vi.fn(),
}));

vi.mock('../../../api/axios', () => ({
  ACCESS_TOKEN_KEY: 'bettano_access_token',
  authFetch,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasRole: () => false,
    user: { role: 'manager', username: 'mgr', full_name: 'Manager' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../services/employeeService', () => ({
  getSalesmen: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/glService', () => ({
  getBankingAccounts: vi.fn().mockResolvedValue([]),
  getGLAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
  lookupProductByBarcode: vi.fn(),
}));

const packInvoice = {
  id: '5',
  customerId: '10',
  customerName: 'Held Customer',
  invoiceNumber: 'INV-000009',
  invoiceDate: '2026-10-23',
  dueDate: '2026-11-23',
  lineItems: [
    {
      product: 'Oil',
      productId: '4',
      description: 'Oil',
      quantity: 24,
      rate: 10,
      amount: 240,
      entered_qty: 2,
      entered_uom: 'pack',
      entered_unit_price: 120,
      pack_qty_snapshot: 12,
    },
    {
      product: 'Filter',
      productId: '5',
      description: 'Filter',
      quantity: 3,
      rate: 8,
      amount: 24,
    },
  ],
  subtotal: 264,
  taxRate: 0,
  taxAmount: 0,
  discount: 0,
  grandTotal: 264,
  notes: '',
  status: 'Unpaid' as const,
};

describe('InvoiceFormPage pack lines', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authFetch.mockReset();
    authFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT' || init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ id: 5, invoice_number: 'INV-000009' }) };
      }
      return { ok: true, status: 200, json: async () => [] };
    });
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(api, 'getCustomers').mockResolvedValue([{ id: '10', name: 'Held Customer' }] as api.Customer[]);
    vi.spyOn(api, 'getProducts').mockResolvedValue([
      { id: '4', name: 'Oil', sku: 'OIL', unit_price: 10, current_stock: 100 },
      { id: '5', name: 'Filter', sku: 'FIL', unit_price: 8, current_stock: 20 },
    ] as api.Product[]);
    vi.spyOn(api, 'getInvoices').mockResolvedValue([packInvoice as api.Invoice]);
    vi.spyOn(api, 'getVans').mockResolvedValue([]);
    vi.spyOn(api, 'getCreditHold').mockResolvedValue({ mode: 'off', held: false, message: '', invoices: [] });
    vi.spyOn(api, 'getCustomerPrice').mockImplementation((_cid, _pid, fallback) => fallback);
    vi.mocked(productService.getProducts).mockResolvedValue([
      { id: '4', packQty: 24, packUnit: 'case', baseUnit: 'qt', uom: 'qt', name: 'Oil' } as Product,
    ]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('submits a loaded pack row from its snapshot and a base row as base', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/sales/invoices/5']}>
          <Routes>
            <Route path="/sales/invoices/:id" element={<InvoiceFormPage />} />
            <Route path="/sales/invoices" element={<div>List</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.textContent).toContain('= 24 qt');
    const packQty = container.querySelector('input[aria-label="Pack quantity"]') as HTMLInputElement;
    const packPrice = container.querySelector('input[aria-label="Price per pack"]') as HTMLInputElement;
    expect(packQty.value).toBe('2');
    expect(packPrice.value).toBe('120');

    const saveBtn = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save as Draft'),
    );
    await act(async () => {
      saveBtn?.click();
    });
    await flush();

    const call = [...authFetch.mock.calls].reverse().find((entry) => {
      const init = entry[1] as RequestInit | undefined;
      return init?.method === 'PUT';
    });
    expect(call).toBeTruthy();
    const body = JSON.parse(String((call?.[1] as RequestInit).body));
    expect(body.lineItems[0]).toMatchObject({
      quantity: 24,
      amount: 240,
      entered_qty: 2,
      entered_uom: 'pack',
      entered_unit_price: 120,
    });
    expect(body.lineItems[1]).toMatchObject({
      quantity: 3,
      entered_qty: 3,
      entered_uom: 'base',
      entered_unit_price: 8,
    });
  });
});
