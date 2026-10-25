import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CountsPage from '../Counts';
import * as countService from '../../../services/cycleCountService';
import * as productService from '../../../services/productService';
import type { CycleCount } from '../../../services/cycleCountService';
import { isSidebarPathAllowed, WAREHOUSE_PAGE_ROLES } from '../../../utils/rbac';

vi.mock('../../../services/cycleCountService', () => ({
  listCounts: vi.fn(),
  createCount: vi.fn(),
  cancelCount: vi.fn(),
}));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));
vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn().mockResolvedValue([
    { id: 5, code: 'B1', path: 'MAIN/A/01', kind: 'bin', isActive: true },
  ]),
}));
vi.mock('../../../services/settingsService', () => ({ formatCurrency: (n: number) => `$${n}` }));

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: auth.role, full_name: 'Test', role: auth.role },
    hasRole: (...roles: string[]) => roles.includes(auth.role),
  }),
}));

const rows: CycleCount[] = [
  {
    id: 1,
    count_number: 'CC-000001',
    status: 'counting',
    scope_type: 'locations',
    scope_path_prefix: 'MAIN/A',
    scope_product_ids: null,
    blind: true,
    note: null,
    created_by: 1,
    created_at: '2026-10-25T09:00:00',
    started_at: '2026-10-25T09:30:00',
    completed_at: null,
    approved_at: null,
    approved_by: null,
    lines_total: 4,
    lines_counted: 1,
    variance_lines: null,
    variance_units: null,
    variance_value: null,
  },
  {
    id: 2,
    count_number: 'CC-000002',
    status: 'review',
    scope_type: 'products',
    scope_path_prefix: null,
    scope_product_ids: [7, 8],
    blind: false,
    note: null,
    created_by: 1,
    created_at: '2026-10-24T09:00:00',
    started_at: null,
    completed_at: null,
    approved_at: null,
    approved_by: null,
    lines_total: 3,
    lines_counted: 3,
    variance_lines: 2,
    variance_units: -1,
    variance_value: -4,
  },
];

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

describe('Counts board', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    auth.role = 'admin';
    vi.mocked(countService.listCounts).mockReset().mockResolvedValue(rows);
    vi.mocked(countService.createCount).mockReset();
    vi.mocked(countService.cancelCount).mockReset();
    vi.mocked(productService.getProducts).mockReset().mockResolvedValue([
      { id: '7', sku: 'OIL-1', name: 'Engine Oil' },
      { id: '8', sku: 'GRS-1', name: 'Grease' },
    ] as productService.Product[]);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(path = '/warehouse/counts') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/warehouse/counts" element={<><CountsPage /><LocationProbe /></>} />
            <Route path="/warehouse/counts/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((el) => el.textContent?.trim() === label);
    if (!found) throw new Error(`button ${label} missing`);
    return found as HTMLButtonElement;
  }

  it('renders rows and the status chip sends the filter', async () => {
    await render();
    expect(countService.listCounts).toHaveBeenLastCalledWith('');
    const first = container.querySelector('[data-testid="count-row-1"]')!;
    expect(first.textContent).toContain('CC-000001');
    expect(first.textContent).toContain('Locations under MAIN/A');
    expect(first.textContent).toContain('1 / 4');
    expect(container.querySelector('[data-testid="count-blind-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="count-variance-1"]')!.textContent).toBe('—');
    const second = container.querySelector('[data-testid="count-row-2"]')!;
    expect(second.textContent).toContain('2 products');
    expect(container.querySelector('[data-testid="count-variance-2"]')!.textContent).toBe('2 to post · est. $-4');
    expect(container.textContent).not.toMatch(/undefined|NaN/);

    await act(async () => button('review').click());
    expect(countService.listCounts).toHaveBeenLastCalledWith('review');
    expect(button('review').getAttribute('aria-pressed')).toBe('true');
  });

  it('approved rows show the posted amount', async () => {
    vi.mocked(countService.listCounts).mockResolvedValue([
      { ...rows[1], id: 3, count_number: 'CC-000003', status: 'approved', posted_value: 6 },
    ]);
    await render();
    expect(container.querySelector('[data-testid="count-variance-3"]')!.textContent).toBe('posted $6');
  });

  it('opens the review chip from the URL', async () => {
    await render('/warehouse/counts?status=review');
    expect(countService.listCounts).toHaveBeenLastCalledWith('review');
  });

  it('row click opens the count screen', async () => {
    await render();
    await act(async () => (container.querySelector('[data-testid="count-row-2"]') as HTMLElement).click());
    expect(container.querySelector('[data-testid="where"]')!.textContent).toBe('/warehouse/counts/2');
  });

  it('New count sends the body and navigates to the draft', async () => {
    vi.mocked(countService.createCount).mockResolvedValue({ ...rows[0], id: 9, status: 'draft', lines: [] });
    await render();
    await act(async () => button('New count').click());
    const path = container.querySelector('input[aria-label="Location path"]') as HTMLInputElement;
    expect(path.placeholder).toBe('e.g. MAIN/A');
    expect(container.querySelector('#count-location-paths option')?.getAttribute('value')).toBe('MAIN/A/01');
    await act(async () => setValue(path, ' MAIN/A '));
    await act(async () => (container.querySelector('input[aria-label="Blind count"]') as HTMLInputElement).click());
    await act(async () => setValue(container.querySelector('textarea[aria-label="Count note"]') as HTMLTextAreaElement, 'monthly'));
    await act(async () => button('Create draft').click());
    expect(countService.createCount).toHaveBeenCalledWith({
      scope_type: 'locations',
      scope_path_prefix: 'MAIN/A',
      scope_product_ids: null,
      blind: true,
      note: 'monthly',
    });
    expect(container.querySelector('[data-testid="where"]')!.textContent).toBe('/warehouse/counts/9');
  });

  it('products scope sends the picked product ids and shows a 400 detail', async () => {
    vi.mocked(countService.createCount).mockRejectedValue(new Error('nothing to count in that scope'));
    await render();
    await act(async () => button('New count').click());
    await act(async () => (container.querySelector('input[value="products"]') as HTMLInputElement).click());
    await act(async () => setValue(container.querySelector('input[aria-label="Search products"]') as HTMLInputElement, 'grs'));
    await act(async () => (container.querySelector('input[aria-label="Select GRS-1"]') as HTMLInputElement).click());
    await act(async () => button('Create draft').click());
    expect(countService.createCount).toHaveBeenCalledWith({
      scope_type: 'products',
      scope_path_prefix: null,
      scope_product_ids: [8],
      blind: false,
      note: null,
    });
    expect(container.querySelector('[data-testid="create-count-error"]')!.textContent).toBe('nothing to count in that scope');
  });

  it('cancel asks first and posts for a counting count', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(countService.cancelCount).mockResolvedValue({ ...rows[0], status: 'cancelled', lines: [] });
    await render();
    const cancels = [...container.querySelectorAll('button')].filter((el) => el.textContent === 'Cancel');
    expect(cancels).toHaveLength(1);
    await act(async () => cancels[0].click());
    expect(window.confirm).toHaveBeenCalledWith('Cancel CC-000001?');
    expect(countService.cancelCount).toHaveBeenCalledWith(1);
  });

  it('warehouse sees the board without New count or Cancel', async () => {
    auth.role = 'warehouse';
    await render();
    expect(container.textContent).toContain('CC-000001');
    expect(container.textContent).not.toContain('New count');
    expect([...container.querySelectorAll('button')].some((el) => el.textContent === 'Cancel')).toBe(false);
  });

  it('warehouse role can reach both count routes', () => {
    expect(WAREHOUSE_PAGE_ROLES).toContain('warehouse');
    expect(isSidebarPathAllowed('warehouse', '/warehouse/counts')).toBe(true);
    expect(isSidebarPathAllowed('warehouse', '/warehouse/counts/:id')).toBe(true);
    expect(isSidebarPathAllowed('warehouse', '/warehouse/valuation')).toBe(false);
  });
});
