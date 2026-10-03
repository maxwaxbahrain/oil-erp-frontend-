import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvoiceFormPage from '../InvoiceFormPage';
import * as api from '../../../services/api';

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

vi.mock('../../../services/glService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/glService')>('../../../services/glService');
  return {
    ...actual,
    getBankingAccountOptions: vi.fn().mockResolvedValue({ accounts: [], collections_bank_account_id: null }),
  };
});

const HINT = 'Customer cannot be changed on a saved invoice — void it and create a new one.';

function customerButton(container: HTMLElement): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((node) =>
    node.textContent?.includes('Search and select customer') || node.textContent?.includes('Held Customer'),
  );
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

describe('InvoiceFormPage customer lock', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authFetch.mockReset();
    authFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as Response);
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
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('disables the customer select in edit mode and leaves it enabled when creating', async () => {
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

    expect(customerButton(container).disabled).toBe(true);
    expect(container.textContent).toContain(HINT);

    act(() => root.unmount());
    root = createRoot(container);
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

    expect(customerButton(container).disabled).toBe(false);
    expect(container.textContent).not.toContain(HINT);
  });
});
