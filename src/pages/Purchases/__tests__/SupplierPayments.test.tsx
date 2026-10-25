import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SupplierPayments from '../SupplierPayments';
import * as purchasesService from '../../../services/purchasesService';
import * as glService from '../../../services/glService';
import { formatLocalDate } from '../../../utils/dates';
import { formatCurrency } from '../../../utils/formatters';
import type { SupplierPaymentRow, SupplierPaymentsPage } from '../../../services/purchasesService';

vi.mock('../../../services/purchasesService', () => ({
  getAllSupplierPayments: vi.fn(),
  getSuppliers: vi.fn(),
}));

vi.mock('../../../services/glService', () => ({
  getGLAccounts: vi.fn(),
}));

function row(partial: Partial<SupplierPaymentRow> & Pick<SupplierPaymentRow, 'id' | 'supplierId'>): SupplierPaymentRow {
  return {
    amount: 0,
    date: '2026-10-01',
    paymentMethod: 'Cash',
    supplier_name: 'Acme Supply',
    account_code: '1010',
    account_name: 'Main Bank',
    allocated_total: 0,
    unallocated: 0,
    allocations: [],
    ...partial,
  };
}

const page: SupplierPaymentsPage = {
  total: 3,
  sum_amount: 1500,
  items: [
    row({
      id: '1',
      supplierId: '9',
      supplier_name: 'Acme Supply',
      amount: 1000,
      date: '2026-10-01',
      paymentMethod: 'Bank Transfer',
      reference: 'PAY-1',
      account_code: '1010',
      account_name: 'Main Bank',
      allocated_total: 1000,
      unallocated: 0,
      allocations: [{ po_id: 4, po_number: 'PO-4', amount: 1000 }],
    }),
    row({
      id: '2',
      supplierId: '8',
      supplier_name: 'North Oil',
      amount: 400,
      date: '2026-10-02',
      paymentMethod: 'Cash',
      reference: 'PAY-2',
      account_code: '1000',
      account_name: 'Cash on Hand',
      allocated_total: 0,
      unallocated: 400,
      allocations: [],
    }),
    row({
      id: '3',
      supplierId: '9',
      supplier_name: 'Acme Supply',
      amount: 100,
      date: '2026-10-03',
      paymentMethod: 'Check',
      reference: 'PAY-3',
      account_code: null,
      account_name: null,
      allocated_total: 0,
      unallocated: 100,
      allocations: [{ po_id: 5, po_number: null, amount: 0 }],
    }),
  ],
};

describe('Supplier payments list', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(purchasesService.getAllSupplierPayments).mockResolvedValue(page);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
    vi.mocked(glService.getGLAccounts).mockResolvedValue([]);
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

  function tile(name: string): string {
    return container.querySelector(`[data-tile="${name}"] [data-tile-value]`)?.textContent || '';
  }

  it('shows page totals, null account, unallocated orders, supplier links, and the range', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/payments']}>
          <Routes>
            <Route path="/purchases/payments" element={<SupplierPayments />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(tile('total-paid')).toBe(formatCurrency(1500));
    expect(tile('payments')).toBe('3');
    expect(tile('suppliers-paid')).toBe('2');
    expect(tile('unallocated')).toBe(formatCurrency(500));
    expect(container.textContent).toContain('Unallocated (this page)');

    const rows = Array.from(container.querySelectorAll('tbody tr'));
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toContain('—');
    expect(rows[2].textContent).not.toContain('null');
    expect(rows[1].textContent).toContain('Not allocated');
    expect(rows[0].textContent).toContain('PO-4');
    expect(rows[0].textContent).toContain(formatLocalDate('2026-10-01'));

    const link = container.querySelector('a[href="/suppliers/9?tab=payments"]');
    expect(link?.textContent).toContain('Acme Supply');
    expect(container.textContent).toContain('Showing 1–3 of 3');
    expect(container.querySelector('input[aria-label="Date from"]')?.getAttribute('value')).toBe('');
    expect(container.querySelector('input[aria-label="Date to"]')?.getAttribute('value')).toBe('');
  });

  it('shows the HTTP error and hides the empty state', async () => {
    vi.mocked(purchasesService.getAllSupplierPayments).mockRejectedValue(
      new Error('Supplier payments failed: HTTP 500'),
    );

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/payments']}>
          <Routes>
            <Route path="/purchases/payments" element={<SupplierPayments />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('HTTP 500');
    expect(container.textContent).not.toContain('No supplier payments yet.');
  });
});
