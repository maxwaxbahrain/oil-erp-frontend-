import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DemandSummaryRow } from '../../../services/demandService';

const { authState } = vi.hoisted(() => ({
  authState: { role: 'manager' as string },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    user: { role: authState.role },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-chart">{children}</div>,
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

const getDemandSummary = vi.fn();
const getProductDemand = vi.fn();

vi.mock('../../../services/demandService', () => ({
  getDemandSummary: (...args: unknown[]) => getDemandSummary(...args),
  getProductDemand: (...args: unknown[]) => getProductDemand(...args),
}));

import DemandForecasting from '../DemandForecasting';

const HOLT_A: DemandSummaryRow = {
  product_id: 1,
  name: 'Low cover oil',
  sku: 'SKU-1',
  pack_qty: 12,
  pack_unit: 'case',
  on_hand_units: 5,
  avg_daily: 2,
  trend_pct: 10,
  forecast_units: 60,
  low: 50,
  high: 70,
  days_of_cover: 2,
  stockout_date: '2026-11-01',
  method: 'holt_weekly',
};

const HOLT_B: DemandSummaryRow = {
  product_id: 2,
  name: 'Stable grease',
  sku: 'SKU-2',
  pack_qty: 0,
  pack_unit: null,
  on_hand_units: 100,
  avg_daily: 1,
  trend_pct: -5,
  forecast_units: 30,
  low: 25,
  high: 35,
  days_of_cover: 100,
  stockout_date: '2027-01-01',
  method: 'holt_weekly',
};

const NO_HIST: DemandSummaryRow = {
  product_id: 3,
  name: 'Quiet item',
  sku: 'SKU-3',
  pack_qty: 6,
  pack_unit: 'box',
  on_hand_units: 0,
  avg_daily: 0,
  trend_pct: 0,
  forecast_units: null,
  low: null,
  high: null,
  days_of_cover: null,
  stockout_date: null,
  method: 'no_history',
};

describe('DemandForecasting page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authState.role = 'manager';
    getDemandSummary.mockResolvedValue([HOLT_A, HOLT_B, NO_HIST]);
    getProductDemand.mockResolvedValue({
      product_id: 1,
      series: [{ bucket_start: '2026-01-06', units: 4 }],
      stats: { total_units: 10, days_with_sales: 2, last_4w_units: 6, prior_4w_units: 4 },
      forecast: { method: 'holt_weekly' },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DemandForecasting />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('renders API rows with stockouts first and no_history forecast dashes', async () => {
    await renderPage();
    const table = container.querySelector('[data-testid="demand-table"]');
    expect(table).not.toBeNull();
    const ids = [...container.querySelectorAll('[data-testid^="demand-row-"]')].map((el) =>
      el.getAttribute('data-testid'),
    );
    expect(ids).toEqual(['demand-row-1', 'demand-row-2', 'demand-row-3']);
    expect(container.querySelector('[data-testid="demand-method-3"]')?.textContent).toBe('No history');
    expect(container.textContent).not.toContain('Requires accounting setup');
  });

  it('packs toggle divides by pack_qty and shows dash when pack_qty is 0', async () => {
    await renderPage();
    const row1Cells = container.querySelector('[data-testid="demand-row-1"]')?.querySelectorAll('td');
    expect(row1Cells?.[2]?.textContent).toBe('5');
    const toggle = container.querySelector('[data-testid="demand-units-toggle"]') as HTMLButtonElement;
    await act(async () => toggle.click());
    await act(async () => {
      await Promise.resolve();
    });
    const row1After = container.querySelector('[data-testid="demand-row-1"]')?.querySelectorAll('td');
    expect(row1After?.[2]?.textContent).toMatch(/0\.42/);
    const row2After = container.querySelector('[data-testid="demand-row-2"]')?.querySelectorAll('td');
    expect(row2After?.[2]?.textContent).toBe('—');
  });

  it('hides Plan reorder for driver', async () => {
    authState.role = 'driver';
    await renderPage();
    expect(container.querySelector('[data-testid="demand-reorder-link-1"]')).toBeNull();
  });
});
