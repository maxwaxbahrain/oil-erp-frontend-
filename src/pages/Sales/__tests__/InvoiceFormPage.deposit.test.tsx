import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvoiceFormPage from '../InvoiceFormPage';
import * as api from '../../../services/api';

const { getBankingAccountOptions, authFetch } = vi.hoisted(() => ({
  getBankingAccountOptions: vi.fn(),
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

vi.mock('../../../services/glService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/glService')>('../../../services/glService');
  return { ...actual, getBankingAccountOptions };
});

const options = {
  accounts: [
    { id: 2, code: '1011', name: 'Operating', role: 'bank', is_default: false },
    { id: 3, code: '1000', name: 'Cash on Hand', role: 'cash', is_default: false },
    { id: 1, code: '1010', name: 'Main Bank', role: 'bank', is_default: true },
  ],
  collections_bank_account_id: null,
};

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('InvoiceFormPage deposit account', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    getBankingAccountOptions.mockReset();
    getBankingAccountOptions.mockResolvedValue(options);
    authFetch.mockReset();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(api, 'getCustomers').mockResolvedValue([{ id: '10', name: 'Held Customer' }] as api.Customer[]);
    vi.spyOn(api, 'getProducts').mockResolvedValue([]);
    vi.spyOn(api, 'getInvoices').mockResolvedValue([]);
    vi.spyOn(api, 'getVans').mockResolvedValue([]);
    vi.spyOn(api, 'getCreditHold').mockResolvedValue({ mode: 'off', held: false, message: '', invoices: [] });
    vi.spyOn(api, 'getCustomerPrice').mockImplementation((_cid, _pid, fallback) => fallback);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  function depositSelect() {
    return container.querySelector('[data-testid="deposit-to-account"]') as HTMLSelectElement;
  }

  async function saveDraft() {
    authFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 5, invoice_number: 'INV-000001' }),
    } as Response);
    const saveBtn = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save as Draft'),
    );
    await act(async () => {
      saveBtn?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    const call = [...authFetch.mock.calls].reverse().find((entry) => {
      const init = entry[1] as RequestInit | undefined;
      return init?.method === 'POST' || init?.method === 'PUT';
    });
    expect(call).toBeTruthy();
    return JSON.parse(String((call?.[1] as RequestInit).body));
  }

  it('lists banks and cash, and sends deposit_account_id or null', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[{ pathname: '/sales/invoices/new', state: { customerId: '10', customerName: 'Held Customer' } }]}>
          <Routes>
            <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    const select = depositSelect();
    expect(select).toBeTruthy();
    expect(container.textContent).toContain('Deposit to (optional)');
    const labels = Array.from(select.options).map((option) => option.textContent);
    expect(labels[0]).toBe('No preference');
    expect(labels).toContain('1010 — Main Bank');
    expect(labels).toContain('1011 — Operating');
    expect(labels).toContain('1000 — Cash on Hand');
    expect(labels.indexOf('1010 — Main Bank')).toBeLessThan(labels.indexOf('1000 — Cash on Hand'));

    const blank = await saveDraft();
    expect(blank.deposit_account_id).toBeNull();

    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[{ pathname: '/sales/invoices/new', state: { customerId: '10', customerName: 'Held Customer' } }]}>
          <Routes>
            <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
    await act(async () => {
      setSelectValue(depositSelect(), '2');
    });
    const chosen = await saveDraft();
    expect(chosen.deposit_account_id).toBe(2);
  });

  it('preselects deposit_account_id from the invoice API in edit mode', async () => {
    authFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 42, deposit_account_id: 2, salesman_employee_id: null }],
    } as Response);
    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[{
            pathname: '/sales/invoices/42',
            state: {
              editMode: true,
              invoice: {
                id: 42,
                customerId: '10',
                customerName: 'Held Customer',
                invoiceNumber: 'INV-000042',
                lineItems: [],
              },
            },
          }]}
        >
          <Routes>
            <Route path="/sales/invoices/:id" element={<InvoiceFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
    expect(depositSelect().value).toBe('2');
  });
});
