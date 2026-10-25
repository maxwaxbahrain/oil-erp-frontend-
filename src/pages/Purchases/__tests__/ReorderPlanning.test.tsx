import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ReorderPlanning from '../ReorderPlanning';
import * as reorderService from '../../../services/reorderService';
import type { ReorderSuggestion } from '../../../services/reorderService';
import { localIsoDatePlusDays } from '../../../utils/localDate';

const { authState } = vi.hoisted(() => ({ authState: { role: 'manager' } }));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(authState.role) }),
}));

vi.mock('../../../services/reorderService', () => ({
  getReorderSuggestions: vi.fn(),
  getReorderSummary: vi.fn(),
  getProductDemand: vi.fn(),
  snoozeProduct: vi.fn(),
  unsnoozeProduct: vi.fn(),
  runReorderNow: vi.fn(),
  createReorderDraftPo: vi.fn(),
}));

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => `$${n}`,
}));

// jsdom has no ResizeObserver; the chart only needs to receive the API series.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  BarChart: ({ data }: { data: Array<{ date: string; qty: number }> }) => (
    <div data-testid="demand-chart">{data.map((p) => `${p.date}:${p.qty}`).join(',')}</div>
  ),
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

function row(overrides: Partial<ReorderSuggestion>): ReorderSuggestion {
  return {
    product_id: 1,
    sku: 'SKU-1',
    name: 'Engine Oil 5W30',
    on_hand: 4,
    on_order: 0,
    projected: 4,
    avg_daily: 1.25,
    days_of_cover: 3.2,
    effective_reorder_point: 10,
    lead_time: 7,
    suggested_qty: 24,
    suggested_packs: 2,
    supplier_id: 5,
    supplier_name: 'Acme Lubes',
    due: true,
    snoozed_until: null,
    last_sale_date: '2026-10-20',
    ...overrides,
  };
}

const OIL = row({});
const FILTER = row({ product_id: 2, sku: 'SKU-2', name: 'Oil Filter', suggested_qty: 10, suggested_packs: null });
const GREASE = row({ product_id: 3, sku: 'SKU-3', name: 'Grease', supplier_id: null, supplier_name: null });

describe('Reorder planning page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'manager';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([OIL, FILTER, GREASE]);
    vi.mocked(reorderService.getReorderSummary).mockResolvedValue({
      due_count: 3,
      suppliers: [
        { supplier_id: 5, supplier_name: 'Acme Lubes', due_count: 2, suggested_value: 310.5 },
        { supplier_id: null, supplier_name: null, due_count: 1, suggested_value: 0 },
      ],
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function renderPage(entry = '/purchases/reorder') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/purchases/reorder" element={<ReorderPlanning />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  function groupButton(key: string): HTMLButtonElement {
    const section = container.querySelector(`[data-testid="supplier-group-${key}"]`);
    const button = [...(section?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'Create draft PO');
    if (!button) throw new Error(`no Create draft PO in group ${key}`);
    return button as HTMLButtonElement;
  }

  async function click(el: Element | null) {
    if (!el) throw new Error('missing element');
    await act(async () => {
      (el as HTMLElement).click();
    });
    await flush();
  }

  async function choose(select: HTMLSelectElement, value: string) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();
  }

  it('renders supplier groups, the API numbers, the summary, and the on-order note', async () => {
    await renderPage();

    expect(container.querySelector('h1')?.textContent).toBe('Reorder planning');
    expect(container.querySelector('[data-testid="on-order-note"]')?.textContent).toBe(
      'On order includes draft POs — a suggestion disappears as soon as its draft PO exists.',
    );
    const acme = container.querySelector('[data-testid="supplier-group-5"]');
    const none = container.querySelector('[data-testid="supplier-group-none"]');
    expect(acme?.querySelector('h2')?.textContent).toBe('Acme Lubes');
    expect(none?.querySelector('h2')?.textContent).toBe('No supplier');
    expect(acme?.textContent).toContain('Engine Oil 5W30');
    expect(acme?.textContent).toContain('Oil Filter');
    expect(none?.textContent).toContain('Grease');

    const oil = container.querySelector('[data-testid="reorder-row-1"]');
    expect(oil?.textContent).toContain('24 (2 packs)');
    expect(oil?.textContent).toContain('1.25');
    expect(oil?.textContent).toContain('3.2');
    expect(oil?.textContent).toContain('7 d');

    const summary = container.querySelector('[data-testid="reorder-summary"]')?.textContent ?? '';
    expect(summary).toContain('Due to reorder3');
    expect(summary).toContain('2 due · $310.5');

    expect(reorderService.getReorderSuggestions).toHaveBeenCalledWith({ include_snoozed: false, only_due: true });
    expect(groupButton('none').disabled).toBe(true);
    expect(groupButton('none').parentElement?.getAttribute('title')).toBe('Set a preferred supplier on the product first');
  });

  it('creates a draft PO from the selected rows and links the RO number', async () => {
    vi.mocked(reorderService.createReorderDraftPo).mockResolvedValue({ po_id: 77, po_number: 'RO-1A2B3C4D', status: 'Draft' });
    await renderPage();

    expect(groupButton('5').disabled).toBe(true);
    await click(container.querySelector('input[aria-label="Select Engine Oil 5W30"]'));
    expect(groupButton('5').disabled).toBe(false);

    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([FILTER, GREASE]);
    await click(groupButton('5'));

    expect(reorderService.createReorderDraftPo).toHaveBeenCalledWith(5, [{ product_id: 1, quantity: 24 }]);
    const link = container.querySelector('[data-testid="draft-po-created"] a');
    expect(link?.textContent).toBe('RO-1A2B3C4D');
    expect(link?.getAttribute('href')).toBe('/suppliers/5?tab=purchases');
    expect(reorderService.getReorderSuggestions).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="reorder-row-1"]')).toBeNull();
  });

  it('snoozes a row, drops it, and shows it with a chip when Show snoozed is on', async () => {
    const until = localIsoDatePlusDays(7);
    vi.mocked(reorderService.snoozeProduct).mockResolvedValue({ product_id: 1, until, reason: null });
    await renderPage();

    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([FILTER, GREASE]);
    await choose(container.querySelector('select[aria-label="Snooze Engine Oil 5W30"]') as HTMLSelectElement, '7');

    expect(reorderService.snoozeProduct).toHaveBeenCalledWith(1, until);
    expect(container.querySelector('[data-testid="reorder-row-1"]')).toBeNull();

    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([{ ...OIL, snoozed_until: until }, FILTER, GREASE]);
    const toggle = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Show snoozed');
    await click(toggle ?? null);

    expect(reorderService.getReorderSuggestions).toHaveBeenLastCalledWith({ include_snoozed: true, only_due: true });
    expect(container.querySelector('[data-testid="snoozed-chip-1"]')?.textContent).toContain('Snoozed until');
  });

  it('expands a row into the demand series from the API', async () => {
    vi.mocked(reorderService.getProductDemand).mockResolvedValue({
      series: [{ date: '2026-10-01', qty: 3 }, { date: '2026-10-02', qty: 5 }],
      avg_daily: 0.09,
      total: 8,
      days_with_sales: 2,
      last_sale_date: '2026-10-02',
    });
    await renderPage();
    await click(container.querySelector('button[aria-label="Show demand for Engine Oil 5W30"]'));

    expect(reorderService.getProductDemand).toHaveBeenCalledWith(1);
    const panel = container.querySelector('[data-testid="demand-1"]');
    expect(panel?.textContent).toContain('Total 8');
    expect(panel?.textContent).toContain('2 days with sales');
    expect(container.querySelector('[data-testid="demand-chart"]')?.textContent).toBe('2026-10-01:3,2026-10-02:5');
  });

  it('pre-filters to one product from product_id, including a product that is not due', async () => {
    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([
      OIL,
      { ...FILTER, due: false, suggested_qty: 0 },
      GREASE,
    ]);
    await renderPage('/purchases/reorder?product_id=2');

    expect(reorderService.getReorderSuggestions).toHaveBeenCalledWith({ include_snoozed: false, only_due: false });
    expect(container.querySelector('[data-testid="reorder-row-2"]')?.textContent).toContain('Not due');
    expect(container.querySelector('[data-testid="reorder-row-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="reorder-row-3"]')).toBeNull();
  });

  it('keeps accountant read-only, matching the backend write roles', async () => {
    authState.role = 'accountant';
    await renderPage();

    expect(container.querySelector('[data-testid="reorder-row-1"]')).not.toBeNull();
    expect((container.querySelector('input[aria-label="Select Engine Oil 5W30"]') as HTMLInputElement).disabled).toBe(true);
    expect((container.querySelector('select[aria-label="Snooze Engine Oil 5W30"]') as HTMLSelectElement).disabled).toBe(true);
    expect(groupButton('5').disabled).toBe(true);
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'Run now')).toBe(false);
  });

  it('shows the last run from the summary and refetches after Run now', async () => {
    await renderPage();
    expect(container.querySelector('[data-testid="reorder-last-run"]')?.textContent).toBe('No runs yet');
    expect(reorderService.getReorderSuggestions).toHaveBeenCalledTimes(1);
    expect(reorderService.getReorderSummary).toHaveBeenCalledTimes(1);

    vi.mocked(reorderService.runReorderNow).mockResolvedValue({
      id: 9,
      tenant_id: 4,
      run_at: '2026-10-24T13:05:00+00:00',
      trigger: 'manual',
      due_count: 3,
      suppliers_json: [],
      digest_sent: false,
      error: null,
    });
    vi.mocked(reorderService.getReorderSummary).mockResolvedValue({
      due_count: 3,
      suppliers: [],
      last_run_at: '2026-10-24T13:05:00+00:00',
    });
    await click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Run now') ?? null);

    expect(reorderService.runReorderNow).toHaveBeenCalledTimes(1);
    expect(reorderService.getReorderSuggestions).toHaveBeenCalledTimes(2);
    expect(reorderService.getReorderSummary).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="reorder-run-result"]')?.textContent).toBe('Run complete: 3 due · digest not sent');
    const lastRun = container.querySelector('[data-testid="reorder-last-run"]')?.textContent ?? '';
    expect(lastRun.startsWith('Last run ')).toBe(true);
    expect(lastRun).toContain('2026');
  });

  it('unsnoozes a snoozed row by product id and refetches', async () => {
    const until = localIsoDatePlusDays(7);
    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([{ ...OIL, snoozed_until: until }, FILTER]);
    vi.mocked(reorderService.unsnoozeProduct).mockResolvedValue({ product_id: 1, snoozed: false });
    await renderPage();

    expect(container.querySelector('button[aria-label="Unsnooze Oil Filter"]')).toBeNull();
    vi.mocked(reorderService.getReorderSuggestions).mockResolvedValue([OIL, FILTER]);
    await click(container.querySelector('button[aria-label="Unsnooze Engine Oil 5W30"]'));

    expect(reorderService.unsnoozeProduct).toHaveBeenCalledWith(1);
    expect(reorderService.getReorderSuggestions).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="snoozed-chip-1"]')).toBeNull();
  });
});
