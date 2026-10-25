import { describe, expect, it } from 'vitest';

import { formatLowStockShort, summarizeLowStock } from '../../../utils/lowStock';
import {
  businessHealthScore,
  buildPlanets,
  buildTimelineEvents,
  countOpenPurchaseOrders,
  hasRealTimestamp,
  owedToUsFromArSummary,
  type SourceResult,
} from './nexusModel';

const ok = <T>(value: T): SourceResult<T> => ({ state: 'ok', value });
const err = <T = never>(): SourceResult<T> => ({ state: 'error' });
const none = <T = never>(): SourceResult<T> => ({ state: 'unavailable' });
const lowStockOk = (outOfStock: number, belowMin: number) =>
  ok({
    alertCount: outOfStock + belowMin,
    outOfStock,
    belowMin,
  });

describe('nexusModel', () => {
  it('health score (Beta): urgent −12, today −6, fyi −2, clamped, unique by id', () => {
    expect(businessHealthScore([], true)).toBe(100);
    expect(
      businessHealthScore(
        [
          { id: 'a', title: '', why: '', action: '', money: 0, priority: 'urgent', href: '/' },
          { id: 'b', title: '', why: '', action: '', money: 0, priority: 'today', href: '/' },
          { id: 'c', title: '', why: '', action: '', money: 0, priority: 'fyi', href: '/' },
        ],
        true,
      ),
    ).toBe(100 - 12 - 6 - 2);
    expect(
      businessHealthScore(
        [
          { id: 'a', title: '', why: '', action: '', money: 0, priority: 'urgent', href: '/' },
          { id: 'a', title: '', why: '', action: '', money: 0, priority: 'urgent', href: '/' },
        ],
        true,
      ),
    ).toBe(88);
  });

  it('signals fail → no health score (not 100)', () => {
    expect(
      businessHealthScore(
        [{ id: 'a', title: '', why: '', action: '', money: 0, priority: 'fyi', href: '/' }],
        false,
      ),
    ).toBeNull();
    expect(businessHealthScore([], false)).toBeNull();
  });

  it('owed_to_us matches ar-summary / dashboard source field', () => {
    expect(owedToUsFromArSummary({ owed_to_us: 7118.25, total_outstanding: 999 })).toBe(7118.25);
    expect(owedToUsFromArSummary({ total_outstanding: 150 })).toBe(150);
    expect(owedToUsFromArSummary(null)).toBeNull();
  });

  it('ar-summary fail → Collections shows Couldn\'t load', () => {
    const planets = buildPlanets({
      cards: [],
      cardsLoadOk: true,
      owedToUs: err(),
      openPoCount: ok(0),
      lowStockCount: lowStockOk(0, 0),
      vansOnline: ok(0),
      vansTotal: ok(0),
      pendingExpenses: ok(0),
      invoiceCountToday: none(),
    });
    expect(planets.find((p) => p.id === 'collections')?.metricLabel).toBe("Couldn't load");
    expect(planets.find((p) => p.id === 'collections')?.status).toBe('error');
  });

  it('data-health/signals fail → Finance/Reports do not say Books quiet', () => {
    const planets = buildPlanets({
      cards: [],
      cardsLoadOk: false,
      owedToUs: ok(0),
      openPoCount: ok(0),
      lowStockCount: lowStockOk(0, 0),
      vansOnline: ok(0),
      vansTotal: ok(0),
      pendingExpenses: ok(0),
      invoiceCountToday: none(),
    });
    expect(planets.find((p) => p.id === 'finance')?.metricLabel).toBe("Couldn't load");
    expect(planets.find((p) => p.id === 'reports')?.metricLabel).toBe("Couldn't load");
  });

  it('Nexus low-stock wording === Dashboard shared helper', () => {
    const products = [
      { current_stock: 0, min_stock: 0, is_active: true },
      { current_stock: 0, min_stock: 5, is_active: true },
      { current_stock: 3, min_stock: 10, is_active: true },
      { current_stock: 40, min_stock: 5, is_active: true },
    ];
    const summary = summarizeLowStock(products);
    const expected = formatLowStockShort(summary);
    const planets = buildPlanets({
      cards: [],
      cardsLoadOk: true,
      owedToUs: ok(0),
      openPoCount: ok(0),
      lowStockCount: ok({
        alertCount: summary.alertCount,
        outOfStock: summary.outOfStock,
        belowMin: summary.belowMin,
      }),
      vansOnline: ok(0),
      vansTotal: ok(0),
      pendingExpenses: ok(0),
      invoiceCountToday: none(),
    });
    // OOS: #1 (min0) + #2 (min5); belowMin: #3 only (OOS excluded from belowMin)
    expect(summary.outOfStock).toBe(2);
    expect(summary.belowMin).toBe(1);
    expect(summary.alertCount).toBe(3);
    expect(summary.outOfStock + summary.belowMin).toBe(summary.alertCount);
    expect(planets.find((p) => p.id === 'inventory')?.metricLabel).toBe(expected);
    expect(expected).toBe('2 out of stock · 1 below minimum');
  });

  it('open PO count excludes draft/rejected/completed/paid', () => {
    expect(
      countOpenPurchaseOrders([
        { status: 'Pending' },
        { status: 'Approved' },
        { status: 'Draft' },
        { status: 'Rejected' },
        { status: 'Completed' },
        { status: 'Paid' },
        { status: 'GRN' },
      ]),
    ).toBe(3);
  });

  it('hides Payroll, AI & Team, and Sales-today; Purchase uses open PO count', () => {
    const planets = buildPlanets({
      cards: [],
      cardsLoadOk: true,
      cardsLoad: ok(true),
      owedToUs: ok(100),
      openPoCount: ok(4),
      lowStockCount: lowStockOk(2, 0),
      vansOnline: ok(1),
      vansTotal: ok(3),
      pendingExpenses: ok(0),
      invoiceCountToday: none(),
    });
    expect(planets.find((p) => p.id === 'payroll')?.visible).toBe(false);
    expect(planets.find((p) => p.id === 'ai_team')?.visible).toBe(false);
    expect(planets.find((p) => p.id === 'sales')?.visible).toBe(false);
    expect(planets.find((p) => p.id === 'purchase')?.metricLabel).toBe('4 open POs');
    expect(planets.find((p) => p.id === 'collections')?.metricLabel).toContain('100');
    expect(planets.find((p) => p.id === 'inventory')?.metricLabel).toBe('2 out of stock');
    expect(planets.every((p) => !p.visible || p.orbitValue !== '—')).toBe(true);
  });

  it('error tiles show Couldn\'t load / Retry — never a bare em dash', () => {
    const planets = buildPlanets({
      cards: [],
      cardsLoadOk: false,
      cardsLoad: err(),
      owedToUs: err(),
      openPoCount: err(),
      lowStockCount: err(),
      vansOnline: err(),
      vansTotal: err(),
      pendingExpenses: err(),
      invoiceCountToday: none(),
    });
    const visible = planets.filter((p) => p.visible);
    expect(visible.length).toBeGreaterThan(0);
    for (const p of visible) {
      expect(p.orbitValue).not.toBe('—');
      expect(p.metricLabel).toBe("Couldn't load");
    }
  });

  it('hasRealTimestamp rejects date-only and midnight', () => {
    expect(hasRealTimestamp('2026-10-19')).toBe(false);
    expect(hasRealTimestamp('2026-10-19T00:00:00')).toBe(false);
    expect(hasRealTimestamp('2026-10-19T09:15:00')).toBe(true);
  });

  it('timeline: date-only stays off the axis; timed events keep clock position', () => {
    const now = new Date('2026-10-19T10:00:00');
    const events = buildTimelineEvents({
      now,
      payments: [
        { id: 1, payment_date: '2026-10-19', created_at: '2026-10-19T09:15:00', customer_name: 'Ada' },
        { id: 2, payment_date: '2026-10-19', created_at: '2026-10-19T00:00:00', customer_name: 'NoTime' },
      ],
      deliveryNotes: [{ id: 3, delivery_date: '2026-10-19', dn_number: 'DN-1' }],
      leaveRequests: [{ id: 4, startDate: '2026-10-19', status: 'approved', employeeName: 'Sam' }],
    });
    const timed = events.find((e) => e.id === 'pay-1');
    expect(timed?.minuteOfDay).toBe(9 * 60 + 15);
    expect(timed?.timeNotRecorded).toBeFalsy();
    expect(events.find((e) => e.id === 'pay-2')?.timeNotRecorded).toBe(true);
    expect(events.find((e) => e.id === 'pay-2')?.minuteOfDay).toBeNull();
    expect(events.find((e) => e.id === 'dn-3')?.timeNotRecorded).toBe(true);
    expect(events.find((e) => e.id === 'leave-4')?.timeNotRecorded).toBe(true);
  });
});
