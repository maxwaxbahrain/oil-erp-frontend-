import { describe, expect, it } from 'vitest';

import {
  businessHealthScore,
  buildPlanets,
  buildTimelineEvents,
  countOpenPurchaseOrders,
  owedToUsFromArSummary,
} from './nexusModel';

describe('nexusModel', () => {
  it('health score (Beta): urgent −12, today −6, fyi −2, clamped, unique by id', () => {
    expect(businessHealthScore([])).toBe(100);
    expect(
      businessHealthScore([
        { id: 'a', title: '', why: '', action: '', money: 0, priority: 'urgent', href: '/' },
        { id: 'b', title: '', why: '', action: '', money: 0, priority: 'today', href: '/' },
        { id: 'c', title: '', why: '', action: '', money: 0, priority: 'fyi', href: '/' },
      ]),
    ).toBe(100 - 12 - 6 - 2);
    expect(
      businessHealthScore([
        { id: 'a', title: '', why: '', action: '', money: 0, priority: 'urgent', href: '/' },
        { id: 'a', title: '', why: '', action: '', money: 0, priority: 'urgent', href: '/' },
      ]),
    ).toBe(88);
    expect(
      businessHealthScore(
        Array.from({ length: 20 }, (_, i) => ({
          id: `u${i}`,
          title: '',
          why: '',
          action: '',
          money: 0,
          priority: 'urgent',
          href: '/',
        })),
      ),
    ).toBe(0);
  });

  it('owed_to_us matches ar-summary / dashboard source field', () => {
    expect(owedToUsFromArSummary({ owed_to_us: 7118.25, total_outstanding: 999 })).toBe(7118.25);
    expect(owedToUsFromArSummary({ total_outstanding: 150 })).toBe(150);
    expect(owedToUsFromArSummary(null)).toBeNull();
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

  it('marks Payroll and AI & Team offline; Purchase uses open PO count', () => {
    const planets = buildPlanets({
      cards: [],
      owedToUs: 100,
      openPoCount: 4,
      lowStockCount: 2,
      vansOnline: 1,
      vansTotal: 3,
      pendingExpenses: 0,
      invoiceCountToday: 5,
    });
    expect(planets.find((p) => p.id === 'payroll')?.metricLabel).toBe('Not connected yet');
    expect(planets.find((p) => p.id === 'ai_team')?.status).toBe('offline');
    expect(planets.find((p) => p.id === 'purchase')?.metricLabel).toBe('4 open POs');
    expect(planets.find((p) => p.id === 'collections')?.metricLabel).toContain('100');
  });

  it('timeline only includes today events; empty lanes stay empty', () => {
    const now = new Date('2026-10-19T10:00:00');
    const events = buildTimelineEvents({
      now,
      payments: [
        { id: 1, payment_date: '2026-10-19T09:15:00', customer_name: 'Ada' },
        { id: 2, payment_date: '2026-10-18T09:15:00', customer_name: 'Old' },
      ],
      invoices: [{ id: 9, invoiceDate: '2026-10-19', invoiceNumber: 'INV-9' }],
      deliveryNotes: [],
      leaveRequests: [],
    });
    expect(events.map((e) => e.id)).toEqual(['pay-1', 'inv-9']);
    expect(events.filter((e) => e.lane === 'goods')).toEqual([]);
    expect(events.filter((e) => e.lane === 'team')).toEqual([]);
  });
});
