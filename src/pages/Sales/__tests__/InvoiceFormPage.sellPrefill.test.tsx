import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvoiceFormPage from '../InvoiceFormPage';
import * as api from '../../../services/api';
import * as productService from '../../../services/productService';

vi.mock('../../../api/axios', () => ({
  ACCESS_TOKEN_KEY: 'bettano_access_token',
  authFetch: vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }),
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

vi.mock('../../../components/common/SearchableSelect', () => ({
  default: ({
    onChange,
    options,
    value,
    placeholder,
  }: {
    onChange: (id: string) => void;
    options: { id: string; name: string }[];
    value: string;
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder || 'SearchableSelect'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder || 'Select'}</option>
      {options.map((row) => (
        <option key={row.id} value={row.id}>{row.name}</option>
      ))}
    </select>
  ),
}));

function setSelectValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('InvoiceFormPage sell price prefill', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(api, 'getCustomers').mockResolvedValue([{ id: '10', name: 'Customer' }] as api.Customer[]);
    vi.spyOn(api, 'getProducts').mockResolvedValue([
      { id: '1', name: 'QA Plain', sku: 'QP', unit_price: 9, cost_price: 4, current_stock: 10 },
    ] as api.Product[]);
    vi.spyOn(api, 'getVans').mockResolvedValue([]);
    vi.spyOn(api, 'getInvoices').mockResolvedValue([]);
    vi.spyOn(api, 'getCreditHold').mockResolvedValue({ mode: 'off', held: false, message: '', invoices: [] });
    vi.spyOn(api, 'getCustomerPrice').mockImplementation((_cid, _pid, fallback) => fallback);
    vi.mocked(productService.getProducts).mockResolvedValue([
      { id: '1', name: 'QA Plain', sku: 'QP', packQty: 1, uom: 'ea' } as productService.Product,
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

  it('still prefills the selling price when cost differs', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/sales/invoices/new']}>
          <Routes>
            <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
    for (let i = 0; i < 40; i += 1) {
      if (container.querySelector('[aria-label="Search product..."]')) break;
      await act(async () => {
        await Promise.resolve();
      });
    }
    const select = container.querySelector('[aria-label="Search product..."]') as HTMLSelectElement;
    await act(async () => {
      setSelectValue(select, '1');
    });
    await flush();
    const rateInput = container.querySelector('input[aria-label="Rate"]') as HTMLInputElement;
    expect(rateInput?.value).toBe('9');
  });
});
