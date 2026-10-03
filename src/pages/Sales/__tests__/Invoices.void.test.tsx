import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Invoices from '../Invoices';
import * as api from '../../../services/api';

const { authState } = vi.hoisted(() => ({
  authState: { role: 'accountant' },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    user: { role: authState.role, username: 'u', full_name: 'User' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/useTracking', () => ({
  useTracking: () => ({ trackPage: () => Promise.resolve() }),
}));

vi.mock('../../../services/customerService', () => ({
  getCustomers: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/employeeService', () => ({
  getSalesmen: vi.fn().mockResolvedValue([]),
}));

function invoice(partial: Partial<api.Invoice> & Pick<api.Invoice, 'id' | 'status' | 'invoiceNumber'>): api.Invoice {
  return {
    customerId: '1',
    customerName: 'Acme',
    invoiceDate: '2026-07-01',
    lineItems: [],
    subtotal: 10,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 10,
    notes: '',
    amount_paid: 0,
    remaining_balance: 10,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...partial,
  };
}

function rowFor(container: HTMLElement, invoiceNumber: string): HTMLTableRowElement {
  const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
    tr.textContent?.includes(invoiceNumber),
  );
  expect(row).toBeTruthy();
  return row as HTMLTableRowElement;
}

function hasButton(row: HTMLElement, title: string): boolean {
  return row.querySelector(`button[title="${title}"]`) != null;
}

describe('Invoices void action', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'accountant';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(api, 'getInvoices').mockResolvedValue([]);
    vi.spyOn(api, 'voidInvoice').mockResolvedValue({
      id: 1,
      invoice_number: 'INV-1',
      status: 'void',
      reversed_entries: [],
      customer_balance: null,
    });
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

  async function renderList() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/sales/invoices']}>
          <Routes>
            <Route path="/sales/invoices" element={<Invoices />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('shows Void and Edit for an unpaid invoice, and hides both when paid or void', async () => {
    vi.mocked(api.getInvoices).mockResolvedValue([
      invoice({ id: '1', invoiceNumber: 'INV-UNPAID', status: 'Unpaid', amount_paid: 0 }),
      invoice({ id: '2', invoiceNumber: 'INV-PAID', status: 'Paid', amount_paid: 10, remaining_balance: 0 }),
      invoice({ id: '3', invoiceNumber: 'INV-VOID', status: 'Void', amount_paid: 0 }),
    ]);
    await renderList();

    const unpaid = rowFor(container, 'INV-UNPAID');
    expect(hasButton(unpaid, 'Void Invoice')).toBe(true);
    expect(hasButton(unpaid, 'Edit Invoice')).toBe(true);
    expect(unpaid.querySelector('button[title="Delete Invoice"]')).toBeNull();
    expect(unpaid.querySelector('[aria-label="Delete invoice"]')).toBeNull();
    expect(unpaid.textContent).not.toMatch(/Delete/);

    const paid = rowFor(container, 'INV-PAID');
    expect(hasButton(paid, 'Void Invoice')).toBe(false);
    expect(hasButton(paid, 'Edit Invoice')).toBe(false);

    const voided = rowFor(container, 'INV-VOID');
    expect(hasButton(voided, 'Void Invoice')).toBe(false);
    expect(hasButton(voided, 'Edit Invoice')).toBe(false);
    const badge = Array.from(voided.querySelectorAll('span')).find((span) => span.textContent?.trim() === 'Void');
    expect(badge).toBeTruthy();
  });

  it('hides Void for a sales user and still shows Edit on an unpaid invoice', async () => {
    authState.role = 'sales';
    vi.mocked(api.getInvoices).mockResolvedValue([
      invoice({ id: '1', invoiceNumber: 'INV-UNPAID', status: 'Unpaid', amount_paid: 0 }),
    ]);
    await renderList();

    const unpaid = rowFor(container, 'INV-UNPAID');
    expect(hasButton(unpaid, 'Edit Invoice')).toBe(true);
    expect(hasButton(unpaid, 'Void Invoice')).toBe(false);
  });

  it('confirms voidInvoice with the id and surfaces a 409 detail', async () => {
    vi.mocked(api.getInvoices).mockResolvedValue([
      invoice({ id: '42', invoiceNumber: 'INV-42', status: 'Unpaid', amount_paid: 0 }),
    ]);
    const voidSpy = vi.mocked(api.voidInvoice);
    await renderList();

    const row = rowFor(container, 'INV-42');
    await act(async () => {
      row.querySelector<HTMLButtonElement>('button[title="Void Invoice"]')?.click();
    });
    expect(container.textContent).toContain(
      'Void invoice INV-42? This reverses its ledger entries and restores stock. This cannot be undone.',
    );

    const confirm = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Void');
    expect(confirm).toBeTruthy();
    await act(async () => {
      confirm?.click();
    });
    await flush();
    expect(voidSpy).toHaveBeenCalledWith('42');

    voidSpy.mockRejectedValueOnce(new api.ApiError(409, 'Invoice has payments…'));
    const rowAgain = rowFor(container, 'INV-42');
    await act(async () => {
      rowAgain.querySelector<HTMLButtonElement>('button[title="Void Invoice"]')?.click();
    });
    const confirmAgain = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Void');
    await act(async () => {
      confirmAgain?.click();
    });
    await flush();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Invoice has payments…'));
  });
});
