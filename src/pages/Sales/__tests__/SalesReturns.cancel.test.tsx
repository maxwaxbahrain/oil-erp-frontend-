import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SalesReturns from '../SalesReturns';
import * as creditNoteService from '../../../services/creditNoteService';
import * as salesReturnService from '../../../services/salesReturnService';
import type { SalesReturn } from '../../../services/salesReturnService';

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

vi.mock('../../../services/salesReturnService', () => ({
  getSalesReturns: vi.fn(),
  getReturnStats: vi.fn(),
  patchSalesReturn: vi.fn(),
  cancelSalesReturn: vi.fn(),
  reasonLabel: (code: string) => code,
}));

vi.mock('../../../services/creditNoteService', () => ({
  getCreditNotes: vi.fn(),
}));

function salesReturn(
  partial: Partial<SalesReturn> & Pick<SalesReturn, 'id' | 'status' | 'returnNumber'>,
): SalesReturn {
  return {
    invoiceId: '1',
    invoiceNumber: 'INV-1',
    customerId: '1',
    customerName: 'Acme',
    returnDate: '2026-07-01',
    lineItems: [],
    returnReason: 'damaged',
    refundAmount: 10,
    notes: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    subtotal: 10,
    tax: 0,
    itemsJson: [],
    ...partial,
  };
}

function rowFor(container: HTMLElement, returnNumber: string): HTMLTableRowElement {
  const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) =>
    tr.textContent?.includes(returnNumber),
  );
  expect(row).toBeTruthy();
  return row as HTMLTableRowElement;
}

function buttonText(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('button')).map((button) =>
    (button.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

describe('Sales returns cancel action', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'accountant';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(salesReturnService.getSalesReturns).mockResolvedValue([]);
    vi.mocked(salesReturnService.getReturnStats).mockResolvedValue({
      totalReturnsToday: 0,
      totalReturnValue: 0,
      pendingApprovals: 0,
      completedReturns: 0,
    });
    vi.mocked(salesReturnService.cancelSalesReturn).mockResolvedValue(
      salesReturn({ id: '1', status: 'cancelled', returnNumber: 'RTN-1' }),
    );
    vi.mocked(creditNoteService.getCreditNotes).mockResolvedValue([]);
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
        <MemoryRouter initialEntries={['/sales/returns']}>
          <Routes>
            <Route path="/sales/returns" element={<SalesReturns />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('shows Cancel return for open statuses and a Cancelled badge with no actions', async () => {
    vi.mocked(salesReturnService.getSalesReturns).mockResolvedValue([
      salesReturn({ id: '1', status: 'draft', returnNumber: 'RTN-DRAFT' }),
      salesReturn({ id: '2', status: 'pending', returnNumber: 'RTN-PENDING' }),
      salesReturn({ id: '3', status: 'approved', returnNumber: 'RTN-APPROVED' }),
      salesReturn({ id: '4', status: 'completed', returnNumber: 'RTN-COMPLETED' }),
      salesReturn({ id: '5', status: 'cancelled', returnNumber: 'RTN-CANCELLED' }),
    ]);
    await renderList();

    for (const number of ['RTN-DRAFT', 'RTN-PENDING', 'RTN-APPROVED', 'RTN-COMPLETED']) {
      const row = rowFor(container, number);
      expect(row.querySelector('button[title="Cancel return"]')).not.toBeNull();
    }

    const cancelled = rowFor(container, 'RTN-CANCELLED');
    const actions = buttonText(cancelled);
    expect(actions.some((label) => label === 'Approve' || label === 'Complete' || label === 'Cancel return')).toBe(false);
    expect(cancelled.querySelector('button[title="Cancel return"]')).toBeNull();
    const badge = Array.from(cancelled.querySelectorAll('span')).find((span) => span.textContent?.trim() === 'Cancelled');
    expect(badge).toBeTruthy();
  });

  it('hides Cancel return for a sales user and still shows Approve on pending', async () => {
    authState.role = 'sales';
    vi.mocked(salesReturnService.getSalesReturns).mockResolvedValue([
      salesReturn({ id: '1', status: 'draft', returnNumber: 'RTN-DRAFT' }),
      salesReturn({ id: '2', status: 'pending', returnNumber: 'RTN-PENDING' }),
      salesReturn({ id: '3', status: 'approved', returnNumber: 'RTN-APPROVED' }),
      salesReturn({ id: '4', status: 'completed', returnNumber: 'RTN-COMPLETED' }),
    ]);
    await renderList();

    expect(container.querySelector('button[title="Cancel return"]')).toBeNull();
    const pending = rowFor(container, 'RTN-PENDING');
    expect(buttonText(pending).some((label) => label === 'Approve')).toBe(true);
  });

  it('confirms cancelSalesReturn with the id and surfaces a 409 detail', async () => {
    vi.mocked(salesReturnService.getSalesReturns).mockResolvedValue([
      salesReturn({ id: '42', status: 'approved', returnNumber: 'RTN-42' }),
    ]);
    await renderList();

    const row = rowFor(container, 'RTN-42');
    await act(async () => {
      row.querySelector<HTMLButtonElement>('button[title="Cancel return"]')?.click();
    });
    await flush();
    expect(window.confirm).toHaveBeenCalledWith(
      'Cancel return RTN-42? Any ledger credit, journal and restocked quantities will be reversed. This cannot be undone.',
    );
    expect(salesReturnService.cancelSalesReturn).toHaveBeenCalledWith('42');

    vi.mocked(salesReturnService.cancelSalesReturn).mockRejectedValueOnce(
      new Error('Sales return is linked to a credit note and cannot be cancelled'),
    );
    const rowAgain = rowFor(container, 'RTN-42');
    await act(async () => {
      rowAgain.querySelector<HTMLButtonElement>('button[title="Cancel return"]')?.click();
    });
    await flush();
    expect(window.alert).toHaveBeenCalledWith('Sales return is linked to a credit note and cannot be cancelled');
  });
});
