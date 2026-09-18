import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvoiceFormPage from '../InvoiceFormPage';
import * as api from '../../../services/api';
vi.mock('../../../api/axios', () => ({
  ACCESS_TOKEN_KEY: 'bettano_access_token',
  authFetch: vi.fn(),
}));

import { authFetch } from '../../../api/axios';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasRole: () => false,
    user: { role: 'sales', username: 'sales1', full_name: 'Sales User' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../services/employeeService', () => ({
  getSalesmen: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../Accounts/ChartOfAccounts', () => ({
  getAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/invoicePDF', () => ({
  generateInvoicePDF: vi.fn(),
}));

const heldHold: api.CreditHoldDetail = {
  mode: 'warn',
  held: true,
  message: 'Customer has $500 unpaid for 60 days (INV-1001).',
  invoices: [
    { invoice_id: 1, invoice_number: 'INV-1001', outstanding: 500, days_unpaid: 60 },
  ],
};

const blockHold: api.CreditHoldDetail = {
  code: 'credit_hold',
  mode: 'block',
  held: true,
  message: 'Credit order blocked until balance cleared.',
  invoices: heldHold.invoices,
};

describe('InvoiceFormPage credit hold', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getCustomers').mockResolvedValue([
      { id: '10', name: 'Held Customer' },
    ] as api.Customer[]);
    vi.spyOn(api, 'getProducts').mockResolvedValue([
      {
        id: '1',
        name: 'Motor Oil',
        unit_price: 25,
        price: 25,
        sku: 'OIL-1',
      },
    ] as api.Product[]);
    vi.spyOn(api, 'getInvoices').mockResolvedValue([]);
    vi.spyOn(api, 'getVans').mockResolvedValue([]);
    vi.spyOn(api, 'getCreditHold').mockResolvedValue(heldHold);
    vi.spyOn(api, 'getCustomerPrice').mockImplementation((_cid, _pid, fallback) => fallback);
    vi.mocked(authFetch).mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function renderWithCustomer() {
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/sales/invoices/new',
              state: { customerId: '10', customerName: 'Held Customer' },
            },
          ]}
        >
          <Routes>
            <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('shows credit hold banner when a held customer is selected', async () => {
    renderWithCustomer();
    await flushEffects();

    expect(api.getCreditHold).toHaveBeenCalledWith('10');
    expect(container.textContent).toContain('Credit hold — warning');
    expect(container.textContent).toContain('INV-1001');
  });

  it('shows block banner after a credit_hold 409 on save', async () => {
    act(() => {
      root.render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/sales/invoices/new',
              state: {
                voicePrefill: {
                  customer: 'Held Customer',
                  items: [{ name: 'Motor Oil', qty: 2, price: 25 }],
                },
              },
            },
          ]}
        >
          <Routes>
            <Route path="/sales/invoices/new" element={<InvoiceFormPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flushEffects();
    await flushEffects();

    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: blockHold }),
    } as Response);

    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Confirm & Save'),
    );
    expect(saveBtn).toBeTruthy();

    await act(async () => {
      saveBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Credit hold — order blocked');
    expect(container.textContent).toContain('Ask a manager to override or collect payment first');
  });
});
