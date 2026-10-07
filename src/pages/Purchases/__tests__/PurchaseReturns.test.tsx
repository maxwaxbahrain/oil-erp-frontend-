import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseReturns from '../PurchaseReturns';
import * as purchaseReturnService from '../../../services/purchaseReturnService';
import * as purchasesService from '../../../services/purchasesService';
import type { PurchaseReturn } from '../../../services/purchaseReturnService';

vi.mock('../../../services/purchaseReturnService', () => ({
  list: vi.fn(),
}));

vi.mock('../../../services/purchasesService', () => ({
  getSuppliers: vi.fn(),
}));

function row(partial: Partial<PurchaseReturn> & Pick<PurchaseReturn, 'id' | 'number' | 'status'>): PurchaseReturn {
  return {
    supplier_id: 3,
    supplier_name: 'Acme Supply',
    date: '2026-10-01',
    reason: '',
    notes: '',
    total: 25,
    refund_mode: 'none',
    refund_amount: 10,
    refund_account_id: null,
    journal_entry_id: null,
    refund_journal_entry_id: null,
    posted_at: null,
    cancelled_at: null,
    created_at: '2026-10-01T00:00:00Z',
    ...partial,
  };
}

describe('Purchase returns list', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(purchaseReturnService.list).mockResolvedValue([]);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
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

  it('renders rows and status', async () => {
    vi.mocked(purchaseReturnService.list).mockResolvedValue([
      row({ id: 4, number: 'PR-4', status: 'posted' }),
      row({ id: 5, number: 'PR-5', status: 'draft', supplier_name: 'North Oil', total: 8, refund_amount: null }),
    ]);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/returns']}>
          <Routes>
            <Route path="/purchases/returns" element={<PurchaseReturns />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.textContent).toContain('PR-4');
    expect(container.textContent).toContain('Acme Supply');
    expect(container.textContent).toContain('posted');
    expect(container.textContent).toContain('PR-5');
    expect(container.textContent).toContain('draft');
    expect(container.textContent).toContain('New purchase return');
    const posted = container.querySelector('[data-status="posted"]');
    const draft = container.querySelector('[data-status="draft"]');
    expect(posted?.textContent).toBe('posted');
    expect(draft?.textContent).toBe('draft');
  });
});
