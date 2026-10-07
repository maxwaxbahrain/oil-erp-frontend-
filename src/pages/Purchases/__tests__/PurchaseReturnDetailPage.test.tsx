import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseReturnDetailPage from '../PurchaseReturnDetailPage';
import * as purchaseReturnService from '../../../services/purchaseReturnService';
import type { PurchaseReturn } from '../../../services/purchaseReturnService';

const { authState } = vi.hoisted(() => ({
  authState: { role: 'manager' as 'manager' | 'admin' | 'accountant' },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    user: { role: authState.role, username: 'u', full_name: 'User' },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../services/purchaseReturnService', () => ({
  get: vi.fn(),
  post: vi.fn(),
  cancel: vi.fn(),
}));

function postedReturn(): PurchaseReturn {
  return {
    id: 4,
    number: 'PR-4',
    supplier_id: 3,
    supplier_name: 'Acme Supply',
    date: '2026-10-01',
    status: 'posted',
    reason: 'damaged',
    notes: '',
    total: 8,
    refund_mode: 'none',
    refund_amount: null,
    refund_account_id: null,
    journal_entry_id: 1,
    refund_journal_entry_id: null,
    posted_at: '2026-10-01T00:00:00Z',
    cancelled_at: null,
    created_at: '2026-10-01T00:00:00Z',
    lines: [{ id: 1, product_id: 9, quantity: 2, unit_cost: 4, amount: 8, reason: 'damaged' }],
  };
}

function buttonNamed(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => (button.textContent ?? '').trim() === label,
  ) as HTMLButtonElement | undefined;
}

describe('Purchase return detail cancel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'manager';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
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

  async function renderDetail() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/returns/4']}>
          <Routes>
            <Route path="/purchases/returns/:id" element={<PurchaseReturnDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('hides Cancel on a posted return for a manager', async () => {
    vi.mocked(purchaseReturnService.get).mockResolvedValue(postedReturn());
    await renderDetail();
    expect(container.textContent).toContain('PR-4');
    expect(container.textContent).toContain('posted');
    expect(buttonNamed(container, 'Cancel')).toBeUndefined();
    expect(buttonNamed(container, 'Edit')).toBeUndefined();
    expect(buttonNamed(container, 'Post')).toBeUndefined();
  });

  it('shows Cancel on a posted return for an admin', async () => {
    authState.role = 'admin';
    vi.mocked(purchaseReturnService.get).mockResolvedValue(postedReturn());
    await renderDetail();
    expect(buttonNamed(container, 'Cancel')).toBeTruthy();
    expect(buttonNamed(container, 'Edit')).toBeUndefined();
  });

  it('shows the backend detail in an alert', async () => {
    authState.role = 'admin';
    vi.mocked(purchaseReturnService.get).mockResolvedValue({
      ...postedReturn(),
      status: 'draft',
      lines: [{ id: 1, product_id: 9, quantity: 2, unit_cost: null, amount: null, reason: '' }],
    });
    vi.mocked(purchaseReturnService.post).mockRejectedValue(new Error('Insufficient stock'));
    await renderDetail();
    await act(async () => {
      buttonNamed(container, 'Post')?.click();
    });
    await flush();
    expect(window.confirm).toHaveBeenCalledWith(
      'Post this return? Stock will go down and the supplier balance will be reduced.',
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Insufficient stock');
  });
});
