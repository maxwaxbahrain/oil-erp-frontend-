import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InvoiceFormPage from '../InvoiceFormPage';
import * as api from '../../../services/api';

const { authFetch, getPickListForInvoice } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  getPickListForInvoice: vi.fn(),
}));

vi.mock('../../../api/axios', () => ({
  ACCESS_TOKEN_KEY: 'bettano_access_token',
  authFetch,
}));

vi.mock('../../../services/pickingService', () => ({
  getPickListForInvoice,
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
    getBankingAccounts: vi.fn().mockResolvedValue([]),
    getGLAccounts: vi.fn().mockResolvedValue([]),
  };
});

describe('Invoice pick list link', () => {
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
    });
    getPickListForInvoice.mockReset();
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

  async function renderInvoice() {
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
  }

  it('shows the pick-list link when the lookup returns one', async () => {
    getPickListForInvoice.mockResolvedValue({
      id: 12,
      number: 'PK-000012',
      status: 'picking',
    });
    await renderInvoice();
    const link = container.querySelector('[data-testid="invoice-pick-list-link"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent).toBe('Pick list PK-000012 · picking');
    expect(link.getAttribute('href')).toBe('/warehouse/picking/12');
    expect(getPickListForInvoice).toHaveBeenCalledWith(42);
  });

  it('stays silent when the lookup is a 404', async () => {
    getPickListForInvoice.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
    await renderInvoice();
    expect(container.querySelector('[data-testid="invoice-pick-list-link"]')).toBeNull();
    expect(container.textContent).not.toContain('Pick list');
  });
});
