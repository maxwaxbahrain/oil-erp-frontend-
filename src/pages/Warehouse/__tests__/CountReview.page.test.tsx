import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CountSheetPage from '../CountSheet';
import * as countService from '../../../services/cycleCountService';
import type { CountVariances, CycleCountDetail, CycleCountLine } from '../../../services/cycleCountService';

vi.mock('../../../services/cycleCountService', () => {
  class CountApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    CountApiError,
    getCount: vi.fn(),
    getVariances: vi.fn(),
    rejectLine: vi.fn(),
    approveCount: vi.fn(),
    startCount: vi.fn(),
    recordLine: vi.fn(),
    recountLine: vi.fn(),
    skipLine: vi.fn(),
    addFoundLine: vi.fn(),
    completeCount: vi.fn(),
  };
});
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn(), lookupProductByBarcode: vi.fn() }));
vi.mock('../../../services/stockLocationService', () => ({ getLocationsFlat: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/settingsService', () => ({ formatCurrency: (n: number) => `$${n}` }));

const auth = vi.hoisted(() => ({ role: 'manager' }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: auth.role, full_name: 'Test', role: auth.role },
    hasRole: (...roles: string[]) => roles.includes(auth.role),
  }),
}));

function line(partial: Partial<CycleCountLine> & Pick<CycleCountLine, 'id' | 'product_id' | 'location_id'>): CycleCountLine {
  return {
    sequence: partial.id,
    sku: `SKU-${partial.product_id}`,
    name: `Product ${partial.product_id}`,
    location_code: partial.location_id === 5 ? 'B1' : 'B9',
    location_path: partial.location_id === 5 ? 'MAIN/A/01' : 'MAIN/Z/09',
    counted_qty: 0,
    status: 'counted',
    counted_by: 1,
    counted_at: null,
    note: null,
    decision: null,
    adjustment_id: null,
    expected_qty: 0,
    unit_cost: 4,
    variance_qty: 0,
    variance_value: 0,
    posted_qty: null,
    posted_value: null,
    ...partial,
  };
}

const oil = line({ id: 11, product_id: 1, location_id: 5, expected_qty: 10, counted_qty: 12, variance_qty: 2, variance_value: 8 });
const grease = line({ id: 13, product_id: 3, location_id: 6, expected_qty: 6, counted_qty: 3, variance_qty: -3, variance_value: -12 });

function count(partial: Partial<CycleCountDetail> = {}): CycleCountDetail {
  return {
    id: 3,
    count_number: 'CC-000003',
    status: 'review',
    scope_type: 'all',
    scope_path_prefix: null,
    scope_product_ids: null,
    blind: false,
    note: null,
    created_by: 1,
    created_at: null,
    started_at: null,
    completed_at: null,
    approved_at: null,
    approved_by: null,
    lines_total: 2,
    lines_counted: 2,
    variance_lines: 2,
    variance_units: -1,
    variance_value: -4,
    posted_value: null,
    lines: [oil, grease],
    ...partial,
  };
}

function variances(lines: CycleCountLine[] = [oil, grease], status: CycleCountDetail['status'] = 'review'): CountVariances {
  return {
    count_id: 3,
    count_number: 'CC-000003',
    status,
    lines,
    totals: { lines: lines.length, units: -1, value: -4 },
    by_location: [
      { location_id: 5, location_code: 'B1', location_path: 'MAIN/A/01', lines: 1, units: 2, value: 8 },
      { location_id: 6, location_code: 'B9', location_path: 'MAIN/Z/09', lines: 1, units: -3, value: -12 },
    ].filter((group) => lines.some((row) => row.location_id === group.location_id)),
  };
}

describe('Count review and approval', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    auth.role = 'manager';
    for (const fn of Object.values(countService)) {
      if (typeof fn === 'function' && 'mockReset' in fn) (fn as ReturnType<typeof vi.fn>).mockReset();
    }
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(body: CycleCountDetail) {
    vi.mocked(countService.getCount).mockResolvedValue(body);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/warehouse/counts/3']}>
          <Routes>
            <Route path="/warehouse/counts/:id" element={<CountSheetPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  function q(selector: string): HTMLElement {
    return container.querySelector(selector) as HTMLElement;
  }

  function button(label: string, scope: ParentNode = container): HTMLButtonElement {
    const found = [...scope.querySelectorAll('button')].find((el) => el.textContent?.trim() === label);
    if (!found) throw new Error(`button ${label} missing`);
    return found as HTMLButtonElement;
  }

  it('renders location groups and totals from the variances API', async () => {
    vi.mocked(countService.getVariances).mockResolvedValue(variances());
    await render(count());
    expect(countService.getVariances).toHaveBeenCalledWith(3);
    expect(q('[data-testid="variance-group-5"]').textContent).toContain('MAIN/A/01');
    const row = q('[data-testid="variance-line-11"]').textContent;
    expect(row).toContain('Expected 10');
    expect(row).toContain('Counted 12');
    expect(row).toContain('Variance +2');
    expect(row).toContain('Est. $8');
    expect(q('[data-testid="variance-decision-11"]').textContent).toBe('post');
    expect(q('[data-testid="variance-line-13"]').textContent).toContain('Variance -3');
    expect(q('[data-testid="variances-totals"]').textContent).toBe('2 line(s)Units -1Est. $-4');
    expect(q('[data-testid="posted-total"]')).toBeNull();
  });

  it('Reject posts the note and refetches', async () => {
    vi.mocked(countService.getVariances)
      .mockResolvedValueOnce(variances())
      .mockResolvedValue(variances([oil, { ...grease, decision: 'reject', note: 'wrong bin' }]));
    vi.mocked(countService.rejectLine).mockResolvedValue(count());
    await render(count());
    await act(async () => button('Reject', q('[data-testid="variance-line-13"]')).click());
    const input = container.querySelector('input[aria-label="Reject note"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'wrong bin');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button('Confirm reject').click());
    expect(countService.rejectLine).toHaveBeenCalledWith(3, 13, 'wrong bin');
    expect(vi.mocked(countService.getVariances).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(q('[data-testid="variance-decision-13"]').textContent).toBe('rejected');
    expect(q('[data-testid="variance-line-13"]').querySelector('button')).toBeNull();
  });

  it('Approve confirms with the line count and cost note, then shows posted values', async () => {
    vi.mocked(countService.getVariances)
      .mockResolvedValueOnce(variances([oil, { ...grease, decision: 'reject' }]))
      .mockResolvedValue(variances([
        { ...oil, decision: 'post', adjustment_id: 90, posted_qty: 2, posted_value: 18 },
        { ...grease, decision: 'reject' },
      ], 'approved'));
    vi.mocked(countService.approveCount).mockResolvedValue(count({ status: 'approved', posted_value: 18 }));
    await render(count());
    await act(async () => button('Approve').click());
    expect(q('[data-testid="approve-text"]').textContent).toBe(
      "Post 1 adjustment(s) for CC-000003? Each becomes an inventory adjustment at today's cost; the estimated value shown uses the cost frozen when the count was created.",
    );
    await act(async () => button('Confirm').click());
    expect(countService.approveCount).toHaveBeenCalledWith(3);
    expect(q('[data-testid="count-status"]').textContent).toBe('approved');
    expect(q('[data-testid="variance-posted-11"]').textContent).toContain('Posted +2 · $18');
    expect(q('[data-testid="variance-posted-11"] a').getAttribute('href')).toBe('/products/1');
    expect(q('[data-testid="posted-total"]').textContent).toBe('Posted total $18');
    expect([...container.querySelectorAll('button')].some((el) => el.textContent === 'Approve')).toBe(false);
  });

  it('a 400 line detail stays on screen and the count stays in review', async () => {
    vi.mocked(countService.getVariances).mockResolvedValue(variances());
    vi.mocked(countService.approveCount).mockRejectedValue(
      new Error('Line 13 SKU-3 @ B9: Adjustment would make stock negative'),
    );
    await render(count());
    await act(async () => button('Approve').click());
    await act(async () => button('Confirm').click());
    expect(q('[data-testid="variances-error"]').textContent).toBe('Line 13 SKU-3 @ B9: Adjustment would make stock negative');
    expect(q('[data-testid="count-status"]').textContent).toBe('review');
    expect(button('Approve')).toBeTruthy();
  });

  it('shows the 409 detail when the count was already approved', async () => {
    vi.mocked(countService.getVariances).mockResolvedValue(variances());
    vi.mocked(countService.approveCount).mockRejectedValue(new countService.CountApiError('this count is already approved', 409));
    await render(count());
    await act(async () => button('Approve').click());
    await act(async () => button('Confirm').click());
    expect(q('[data-testid="variances-error"]').textContent).toBe('this count is already approved');
  });

  it('shows "Nothing to post" when no line varied', async () => {
    vi.mocked(countService.getVariances).mockResolvedValue(variances([]));
    await render(count({ variance_lines: 0, variance_value: 0 }));
    expect(q('[data-testid="nothing-to-post"]')).not.toBeNull();
    expect(q('[data-testid="variances-totals"]')).toBeNull();
  });

  it('accountant and warehouse see the panel read-only', async () => {
    for (const role of ['accountant', 'warehouse']) {
      auth.role = role;
      vi.mocked(countService.getVariances).mockResolvedValue(variances());
      await render(count());
      expect(q('[data-testid="variances-panel"]')).not.toBeNull();
      const labels = [...container.querySelectorAll('button')].map((el) => el.textContent?.trim());
      expect(labels).not.toContain('Approve');
      expect(labels).not.toContain('Reject');
    }
  });

  it('warehouse gets a quiet 403 on a hidden blind count', async () => {
    auth.role = 'warehouse';
    vi.mocked(countService.getVariances).mockRejectedValue(
      new countService.CountApiError('variances are shown after the count is completed', 403),
    );
    await render(count({ blind: true, variance_lines: null, variance_value: null, lines: [] }));
    expect(q('[data-testid="variances-panel"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });
});
