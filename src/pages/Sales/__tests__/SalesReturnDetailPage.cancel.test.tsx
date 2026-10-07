import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SalesReturnDetailPage from '../SalesReturnDetailPage';
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
  getSalesReturn: vi.fn(),
  patchSalesReturn: vi.fn(),
  cancelSalesReturn: vi.fn(),
  reasonLabel: (code: string) => code,
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

describe('Sales return detail cancel action', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'accountant';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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

  async function renderDetail(id: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/sales/returns/${id}`]}>
          <Routes>
            <Route path="/sales/returns/:id" element={<SalesReturnDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('offers Cancel return on an approved return and a terminal Cancelled timeline', async () => {
    vi.mocked(salesReturnService.getSalesReturn).mockResolvedValue(
      salesReturn({ id: '7', status: 'approved', returnNumber: 'RTN-7' }),
    );
    await renderDetail('7');

    expect(container.querySelector('button[title="Cancel return"]')).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll('button')).some((button) => /Reject/.test(button.textContent ?? '')),
    ).toBe(false);

    act(() => root.unmount());
    root = createRoot(container);
    vi.mocked(salesReturnService.getSalesReturn).mockResolvedValue(
      salesReturn({ id: '8', status: 'cancelled', returnNumber: 'RTN-8' }),
    );
    await renderDetail('8');

    const labels = Array.from(container.querySelectorAll('button')).map((button) =>
      (button.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(
      labels.some((label) =>
        label === 'Cancel return' ||
        label === 'Approve' ||
        label === 'Reject' ||
        label === 'Mark completed' ||
        label === 'Edit draft' ||
        label === 'Complete',
      ),
    ).toBe(false);
    expect(container.querySelector('button[title="Cancel return"]')).toBeNull();
    expect(container.textContent).toContain('Cancelled');
    const activeDraft = Array.from(container.querySelectorAll('div')).find(
      (el) => el.textContent?.trim() === 'Draft' && el.className.includes('800020'),
    );
    expect(activeDraft).toBeUndefined();
  });
});
