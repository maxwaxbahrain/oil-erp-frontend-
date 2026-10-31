import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CountSheetPage from '../CountSheet';
import * as countService from '../../../services/cycleCountService';
import * as productService from '../../../services/productService';
import type { CycleCountDetail, CycleCountLine } from '../../../services/cycleCountService';

vi.mock('../../../services/cycleCountService', async (importOriginal) => {
  const actual = await importOriginal<typeof countService>();
  return {
    ...actual,
    getCount: vi.fn(),
    startCount: vi.fn(),
    recordLine: vi.fn(),
    recountLine: vi.fn(),
    skipLine: vi.fn(),
    addFoundLine: vi.fn(),
    completeCount: vi.fn(),
    getVariances: vi.fn(),
  };
});
vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
  lookupProductByBarcode: vi.fn(),
}));
vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn().mockResolvedValue([
    { id: 5, code: 'B1', path: 'MAIN/A/01', kind: 'bin', isActive: true, barcode: null },
    { id: 6, code: 'B9', path: 'MAIN/Z/09', kind: 'bin', isActive: true, barcode: null },
  ]),
}));
vi.mock('../../../services/settingsService', () => ({ formatCurrency: (n: number) => `$${n}` }));

const auth = vi.hoisted(() => ({ role: 'warehouse' }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: auth.role, full_name: 'Test', role: auth.role },
    hasRole: (...roles: string[]) => roles.includes(auth.role),
  }),
}));

function line(partial: Partial<CycleCountLine> & Pick<CycleCountLine, 'id' | 'sequence' | 'product_id' | 'location_id'>): CycleCountLine {
  return {
    sku: `SKU-${partial.product_id}`,
    name: `Product ${partial.product_id}`,
    location_code: partial.location_id === 5 ? 'B1' : 'B9',
    location_path: partial.location_id === 5 ? 'MAIN/A/01' : 'MAIN/Z/09',
    counted_qty: null,
    status: 'pending',
    counted_by: null,
    counted_at: null,
    note: null,
    decision: null,
    adjustment_id: null,
    ...partial,
  };
}

function detail(partial: Partial<CycleCountDetail> = {}, lines?: CycleCountLine[]): CycleCountDetail {
  return {
    id: 3,
    count_number: 'CC-000003',
    status: 'counting',
    scope_type: 'locations',
    scope_path_prefix: 'MAIN',
    scope_product_ids: null,
    blind: false,
    note: null,
    created_by: 1,
    created_at: null,
    started_at: null,
    completed_at: null,
    approved_at: null,
    approved_by: null,
    lines_total: 3,
    lines_counted: 0,
    variance_lines: 0,
    variance_units: 0,
    variance_value: 0,
    lines: lines ?? [
      line({ id: 12, sequence: 2, product_id: 2, location_id: 5, expected_qty: 0, unit_cost: 5, variance_qty: null, variance_value: null }),
      line({ id: 11, sequence: 1, product_id: 1, location_id: 5, expected_qty: 10, unit_cost: 4, variance_qty: null, variance_value: null }),
      line({ id: 13, sequence: 3, product_id: 3, location_id: 6, expected_qty: 6, unit_cost: 4, variance_qty: null, variance_value: null }),
    ],
    ...partial,
  };
}

function blindLines(): CycleCountLine[] {
  return [
    line({ id: 11, sequence: 1, product_id: 1, location_id: 5 }),
    line({ id: 13, sequence: 2, product_id: 3, location_id: 6, status: 'counted', counted_qty: 4 }),
  ];
}

function setValue(el: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

describe('Count screen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    auth.role = 'warehouse';
    for (const fn of Object.values(countService)) vi.mocked(fn as () => unknown).mockReset?.();
    vi.mocked(countService.getVariances).mockResolvedValue({
      count_id: 3,
      count_number: 'CC-000003',
      status: 'review',
      lines: [],
      totals: { lines: 0, units: 0, value: 0 },
      by_location: [],
    });
    vi.mocked(productService.getProducts).mockReset().mockResolvedValue([
      { id: '4', sku: 'FLT-1', name: 'Filter' },
    ] as productService.Product[]);
    vi.mocked(productService.lookupProductByBarcode).mockReset();
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
            <Route path="/warehouse/counts" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  function button(label: string, scope: ParentNode = container): HTMLButtonElement {
    const found = [...scope.querySelectorAll('button')].find((el) => el.textContent?.trim() === label);
    if (!found) throw new Error(`button ${label} missing`);
    return found as HTMLButtonElement;
  }

  function lineEl(id: number): HTMLElement {
    return container.querySelector(`[data-testid="count-line-${id}"]`) as HTMLElement;
  }

  it('renders lines in sequence grouped by location', async () => {
    await render(detail());
    expect(countService.getCount).toHaveBeenCalledWith(3);
    const groups = [...container.querySelectorAll('section')];
    expect(groups.map((group) => group.querySelector('h2')!.textContent)).toEqual(['MAIN/A/01', 'MAIN/Z/09']);
    expect([...groups[0].querySelectorAll('article')].map((el) => el.dataset.testid)).toEqual(['count-line-11', 'count-line-12']);
    expect(container.querySelector('[data-testid="line-expected-11"]')!.textContent).toBe('Expected 10');
    expect(container.querySelector('[data-testid="count-progress"]')!.textContent).toBe('0/3 counted');
  });

  it('Start posts on a draft', async () => {
    await render(detail({ status: 'draft' }));
    vi.mocked(countService.startCount).mockResolvedValue(detail());
    await act(async () => button('Start').click());
    expect(countService.startCount).toHaveBeenCalledWith(3);
    expect(container.querySelector('[data-testid="count-status"]')!.textContent).toBe('counting');
  });

  it('Count posts counted_qty and shows the returned variance', async () => {
    await render(detail());
    const counted = detail({ lines_counted: 1 });
    counted.lines = counted.lines.map((row) => (row.id === 11
      ? { ...row, status: 'counted', counted_qty: 12, variance_qty: 2, variance_value: 8 }
      : row));
    vi.mocked(countService.recordLine).mockResolvedValue(counted);
    await act(async () => setValue(lineEl(11).querySelector('input[aria-label="Counted 11"]') as HTMLInputElement, '12'));
    await act(async () => button('Count', lineEl(11)).click());
    expect(countService.recordLine).toHaveBeenCalledWith(3, 11, 12);
    expect(container.querySelector('[data-testid="line-variance-11"]')!.textContent).toBe('Variance +2 · $8');
    expect(container.querySelector('[data-testid="line-status-11"]')!.textContent).toBe('counted');
  });

  it('a blind count shows no expected or variance and no undefined/NaN', async () => {
    await render(detail({ blind: true, variance_lines: null, variance_units: null, variance_value: null, lines_total: 2, lines_counted: 1 }, blindLines()));
    expect(container.querySelector('[data-testid^="line-expected-"]')).toBeNull();
    expect(container.querySelector('[data-testid^="line-variance-"]')).toBeNull();
    expect(container.textContent).toContain('Counted 4');
    expect(container.textContent).not.toMatch(/undefined|NaN|Expected/);
  });

  it('Skip posts the note', async () => {
    await render(detail());
    vi.mocked(countService.skipLine).mockResolvedValue(detail());
    await act(async () => button('Skip', lineEl(13)).click());
    await act(async () => setValue(container.querySelector('input[aria-label="Skip note 13"]') as HTMLInputElement, 'blocked by pallet'));
    await act(async () => button('Save skip').click());
    expect(countService.skipLine).toHaveBeenCalledWith(3, 13, 'blocked by pallet');
  });

  it('Found item posts product and location', async () => {
    await render(detail());
    vi.mocked(countService.addFoundLine).mockResolvedValue(detail());
    await act(async () => button('Found item').click());
    const dialog = container.querySelector('[role="dialog"][aria-label="Found item"]')!;
    await act(async () => setValue(dialog.querySelector('input[aria-label="Search product"]') as HTMLInputElement, 'flt'));
    await act(async () => (dialog.querySelector('input[aria-label="Pick FLT-1"]') as HTMLInputElement).click());
    await act(async () => setValue(dialog.querySelector('input[aria-label="Location code"]') as HTMLInputElement, 'b9'));
    await act(async () => button('Add line', dialog).click());
    expect(countService.addFoundLine).toHaveBeenCalledWith(3, 4, 6);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('scan jumps to the product line in the current location', async () => {
    await render(detail());
    vi.mocked(productService.lookupProductByBarcode).mockResolvedValue({ product: { id: '3' } } as never);
    const scan = container.querySelector('input[aria-label="Scan barcode"]') as HTMLInputElement;
    await act(async () => setValue(scan, '123'));
    await act(async () => scan.form!.requestSubmit());
    expect(lineEl(13).style.outline).toContain('solid');
    vi.mocked(productService.lookupProductByBarcode).mockResolvedValue({ product: { id: '99' } } as never);
    await act(async () => setValue(scan, '999'));
    await act(async () => scan.form!.requestSubmit());
    expect(container.querySelector('[data-testid="scan-error"]')!.textContent).toBe('not on this count');
  });

  it('Complete navigates to the board with review selected', async () => {
    const done = detail({ lines_counted: 3 }, detail().lines.map((row) => ({ ...row, status: 'counted', counted_qty: 1 })));
    await render(done);
    vi.mocked(countService.completeCount).mockResolvedValue({ ...done, status: 'review' });
    await act(async () => button('Complete').click());
    expect(countService.completeCount).toHaveBeenCalledWith(3);
    expect(container.querySelector('[data-testid="where"]')!.textContent).toBe('/warehouse/counts?status=review');
  });

  it('shows the backend 400 detail inline', async () => {
    const done = detail({ lines_counted: 3 }, detail().lines.map((row) => ({ ...row, status: 'counted', counted_qty: 1 })));
    await render(done);
    vi.mocked(countService.completeCount).mockRejectedValue(new Error('y'));
    await act(async () => button('Complete').click());
    expect(countService.skipLine).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="count-footer-error"]')!.textContent).toBe('y');
  });

  it('with partial progress, Complete opens skip dialog then skips open lines and completes', async () => {
    const seven = Array.from({ length: 7 }, (_, index) => line({
      id: 100 + index,
      sequence: index + 1,
      product_id: index + 1,
      location_id: index < 4 ? 5 : 6,
      status: index < 2 ? 'counted' : 'pending',
      counted_qty: index < 2 ? 1 : null,
    }));
    await render(detail({ lines_total: 7, lines_counted: 2 }, seven));
    vi.mocked(countService.skipLine).mockImplementation(async (_id, lineId) => {
      return detail(
        { lines_total: 7, lines_counted: 2 },
        seven.map((row) => (row.id === lineId ? { ...row, status: 'skipped' } : row)),
      );
    });
    vi.mocked(countService.completeCount).mockResolvedValue(detail({ status: 'review', lines_counted: 7 }, seven.map((row) => ({ ...row, status: row.status === 'pending' ? 'skipped' : row.status }))));
    await act(async () => button('Complete').click());
    expect(container.querySelector('[data-testid="complete-skip-dialog"]')!.textContent).toContain('5 lines are not counted');
    await act(async () => button('Skip & complete').click());
    expect(vi.mocked(countService.skipLine).mock.calls.map((call) => call[1])).toEqual([102, 103, 104, 105, 106]);
    expect(countService.completeCount).toHaveBeenCalledWith(3);
    expect(container.querySelector('[data-testid="where"]')!.textContent).toBe('/warehouse/counts?status=review');
  });

  it('with all lines counted or skipped, Complete does not call skip', async () => {
    const done = detail({ lines_counted: 3 }, detail().lines.map((row) => ({ ...row, status: 'counted', counted_qty: 1 })));
    await render(done);
    vi.mocked(countService.completeCount).mockResolvedValue({ ...done, status: 'review' });
    await act(async () => button('Complete').click());
    expect(countService.skipLine).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="complete-skip-dialog"]')).toBeNull();
    expect(countService.completeCount).toHaveBeenCalledWith(3);
  });

  it('Recount is offered to managers on counted lines only', async () => {
    auth.role = 'manager';
    const body = detail();
    body.lines = body.lines.map((row) => (row.id === 11 ? { ...row, status: 'counted', counted_qty: 10, variance_qty: 0 } : row));
    await render(body);
    vi.mocked(countService.recountLine).mockResolvedValue(detail());
    await act(async () => button('Recount', lineEl(11)).click());
    expect(countService.recountLine).toHaveBeenCalledWith(3, 11);
    auth.role = 'warehouse';
  });

  it('accountant sees the count read-only', async () => {
    auth.role = 'accountant';
    await render(detail());
    const labels = [...container.querySelectorAll('button')].map((el) => el.textContent?.trim());
    expect(labels).not.toContain('Count');
    expect(labels).not.toContain('Skip');
    expect(labels).not.toContain('Complete');
    expect(labels).not.toContain('Found item');
    expect(container.querySelector('input[aria-label^="Counted"]')).toBeNull();
    expect(container.textContent).toContain('CC-000003');
  });
});
