import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DemandSummaryRow } from '../../../services/demandService';
import {
  accuracyColor,
  canonicalizeMethod,
  formatAccuracyWape,
  methodBadgeMeta,
  methodTileCounts,
  parseSeasonalStrength,
  seasonalStrengthKey,
} from '../DemandForecasting';

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

function row(partial: Partial<DemandSummaryRow> & Pick<DemandSummaryRow, 'product_id' | 'name' | 'method'>): DemandSummaryRow {
  return {
    sku: `SKU-${partial.product_id}`,
    pack_qty: 12,
    pack_unit: 'case',
    on_hand_units: 10,
    avg_daily: 1,
    trend_pct: 0,
    forecast_units: 30,
    low: 25,
    high: 35,
    days_of_cover: 20,
    stockout_date: '2026-12-01',
    accuracy_wape: 0.06,
    history_weeks: 52,
    ...partial,
  };
}

const HOLT_A = row({
  product_id: 1,
  name: 'Low cover oil',
  method: 'holt',
  days_of_cover: 2,
  stockout_date: '2026-11-01',
  accuracy_wape: 0.06,
});

const HOLT_B = row({
  product_id: 2,
  name: 'Stable grease',
  method: 'holt_weekly',
  pack_qty: 0,
  pack_unit: null,
  on_hand_units: 100,
  trend_pct: -5,
  days_of_cover: 100,
  stockout_date: '2027-01-01',
  accuracy_wape: 0.2,
});

const NO_HIST = row({
  product_id: 3,
  name: 'Quiet item',
  method: 'no_history',
  pack_qty: 6,
  pack_unit: 'box',
  on_hand_units: 0,
  avg_daily: 0,
  forecast_units: null,
  low: null,
  high: null,
  days_of_cover: null,
  stockout_date: null,
  accuracy_wape: null,
  history_weeks: 0,
});

const AVG = row({ product_id: 4, name: 'Flat average', method: 'average', accuracy_wape: 0.4 });
const SEASONAL = row({ product_id: 5, name: 'Winter oil', method: 'seasonal', accuracy_wape: 0.1 });

describe('demand method helpers', () => {
  it('maps badges for average, holt, seasonal, no_history, holt_weekly alias, and unknown', () => {
    expect(methodBadgeMeta('average').label).toBe('Average');
    expect(methodBadgeMeta('holt').label).toBe('Holt');
    expect(methodBadgeMeta('holt').title).toBe('trend');
    expect(methodBadgeMeta('holt_weekly').label).toBe('Holt');
    expect(canonicalizeMethod('holt_weekly')).toBe('holt');
    expect(methodBadgeMeta('seasonal').label).toBe('Seasonal');
    expect(methodBadgeMeta('seasonal').title).toBe('yearly pattern detected');
    expect(methodBadgeMeta('no_history').label).toBe('No history');
    expect(methodBadgeMeta('weird_future').label).toBe('weird_future');
    expect(methodBadgeMeta('weird_future').className).toContain('slate');
  });

  it('formats accuracy and colour bands; null is dash', () => {
    expect(formatAccuracyWape(0.06)).toBe('±6%');
    expect(formatAccuracyWape(null)).toBe('—');
    expect(formatAccuracyWape(undefined)).toBe('—');
    expect(accuracyColor(0.1)).toContain('green');
    expect(accuracyColor(0.25)).toBe('#d97706');
    expect(accuracyColor(0.5)).toContain('red');
  });

  it('detects seasonal strength key and parses value', () => {
    expect(seasonalStrengthKey({ average: 0.1, holt: 0.2 })).toBeNull();
    const key = 'seasonal: strength=0.824800';
    expect(seasonalStrengthKey({ [key]: 0.05, average: 0.1 })).toBe(key);
    expect(parseSeasonalStrength(key)).toBe('0.824800');
  });

  it('counts products by method including holt_weekly as holt', () => {
    const counts = methodTileCounts([HOLT_A, HOLT_B, NO_HIST, AVG, SEASONAL]);
    expect(counts).toEqual({ average: 1, holt: 2, seasonal: 1, no_history: 1 });
  });
});

describe('DemandForecasting page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authState.role = 'manager';
    getDemandSummary.mockResolvedValue([HOLT_A, HOLT_B, NO_HIST, AVG, SEASONAL]);
    getProductDemand.mockResolvedValue({
      product_id: 1,
      series: [{ bucket_start: '2026-01-06', units: 4 }],
      stats: {
        total_units: 10,
        total: 10,
        days_with_sales: 2,
        last_4w_units: 6,
        prior_4w_units: 4,
        avg_daily: 1,
        last_sale_date: null,
        trend_pct: 0,
      },
      forecast: {
        method: 'holt',
        avg_daily: 1,
        trend_pct: 0,
        forecasts: { 30: 30 },
        low: { 30: 25 },
        high: { 30: 35 },
        stockout_date: null,
        days_of_cover: 10,
        on_hand_units: 10,
        accuracy_wape: 0.06,
        history_weeks: 40,
        methods_tried: { average: 0.08, holt: 0.06 },
      },
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
    expect(ids).toEqual([
      'demand-row-1',
      'demand-row-2',
      'demand-row-3',
      'demand-row-4',
      'demand-row-5',
    ]);
    expect(container.querySelector('[data-testid="demand-method-3"]')?.textContent).toBe('No history');
    expect(container.querySelector('[data-testid="demand-method-2"]')?.textContent).toBe('Holt');
    expect(container.querySelector('[data-testid="demand-method-4"]')?.textContent).toBe('Average');
    expect(container.querySelector('[data-testid="demand-method-5"]')?.textContent).toBe('Seasonal');
    expect(container.textContent).not.toContain('Requires accounting setup');
  });

  it('shows accuracy column formatting', async () => {
    await renderPage();
    expect(container.querySelector('[data-testid="demand-accuracy-1"]')?.textContent).toBe('±6%');
    expect(container.querySelector('[data-testid="demand-accuracy-3"]')?.textContent).toBe('—');
  });

  it('shows products-by-method tile counts', async () => {
    await renderPage();
    expect(container.querySelector('[data-testid="method-count-average"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-testid="method-count-holt"]')?.textContent).toBe('2');
    expect(container.querySelector('[data-testid="method-count-seasonal"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-testid="method-count-no_history"]')?.textContent).toBe('1');
  });

  it('expand panel shows method line; in-sample only when seasonal strength key present', async () => {
    getProductDemand.mockResolvedValueOnce({
      product_id: 5,
      series: [{ bucket_start: '2026-01-06', units: 4 }],
      stats: {
        total_units: 10,
        total: 10,
        days_with_sales: 2,
        last_4w_units: 6,
        prior_4w_units: 4,
        avg_daily: 1,
        last_sale_date: null,
        trend_pct: 0,
      },
      forecast: {
        method: 'seasonal',
        avg_daily: 1,
        trend_pct: 0,
        forecasts: { 30: 40 },
        low: { 30: 30 },
        high: { 30: 50 },
        stockout_date: null,
        days_of_cover: 8,
        on_hand_units: 10,
        accuracy_wape: 0.05,
        history_weeks: 120,
        methods_tried: {
          average: 0.08,
          holt: 0.09,
          'seasonal: strength=0.824800': 0.05,
        },
      },
    });
    await renderPage();
    const expandBtn = container
      .querySelector('[data-testid="demand-row-5"]')
      ?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement;
    await act(async () => expandBtn.click());
    await act(async () => {
      await Promise.resolve();
    });
    const methodLine = container.querySelector('[data-testid="demand-expand-method-5"]');
    expect(methodLine?.textContent).toContain('Method: Seasonal · 120 weeks of history');
    expect(methodLine?.textContent).toContain('Seasonal pattern strength 0.824800');
    expect(methodLine?.textContent).toContain('accuracy measured in-sample');
    expect(container.querySelector('[data-testid="demand-expand-accuracy-5"]')?.textContent).toContain(
      '(in-sample)',
    );

    getProductDemand.mockResolvedValueOnce({
      product_id: 1,
      series: [{ bucket_start: '2026-01-06', units: 4 }],
      stats: {
        total_units: 10,
        total: 10,
        days_with_sales: 2,
        last_4w_units: 6,
        prior_4w_units: 4,
        avg_daily: 1,
        last_sale_date: null,
        trend_pct: 0,
      },
      forecast: {
        method: 'holt',
        avg_daily: 1,
        trend_pct: 0,
        forecasts: { 30: 30 },
        low: { 30: 25 },
        high: { 30: 35 },
        stockout_date: null,
        days_of_cover: 10,
        on_hand_units: 10,
        accuracy_wape: 0.06,
        history_weeks: 40,
        methods_tried: { average: 0.08, holt: 0.06 },
      },
    });
    const expandHolt = container
      .querySelector('[data-testid="demand-row-1"]')
      ?.querySelector('button[aria-label="Expand"]') as HTMLButtonElement;
    await act(async () => expandHolt.click());
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="demand-expand-method-1"]')?.textContent).not.toContain(
      'in-sample',
    );
    expect(container.querySelector('[data-testid="demand-expand-accuracy-1"]')?.textContent).not.toContain(
      '(in-sample)',
    );
  });

  it('packs toggle divides by pack_qty and shows dash when pack_qty is 0', async () => {
    await renderPage();
    const row1Cells = container.querySelector('[data-testid="demand-row-1"]')?.querySelectorAll('td');
    expect(row1Cells?.[2]?.textContent).toBe('10');
    const toggle = container.querySelector('[data-testid="demand-units-toggle"]') as HTMLButtonElement;
    await act(async () => toggle.click());
    await act(async () => {
      await Promise.resolve();
    });
    const row1After = container.querySelector('[data-testid="demand-row-1"]')?.querySelectorAll('td');
    expect(row1After?.[2]?.textContent).toMatch(/0\.83/);
    const row2After = container.querySelector('[data-testid="demand-row-2"]')?.querySelectorAll('td');
    expect(row2After?.[2]?.textContent).toBe('—');
  });

  it('hides Plan reorder for driver', async () => {
    authState.role = 'driver';
    await renderPage();
    expect(container.querySelector('[data-testid="demand-reorder-link-1"]')).toBeNull();
  });
});
