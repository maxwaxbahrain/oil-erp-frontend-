import { describe, expect, it } from 'vitest';

import {
  applyArBalances,
  buildOpsVans,
  opsChipPresentation,
  parseGpsLocation,
  pickOpsInsight,
  routeLineProgress,
  routePolylines,
  routeSegments,
  shouldShowVansError,
  stopsForVisitDay,
  todayVisitDay,
  vanLabelForStop,
  vanPingLabel,
} from './opsMapModel';
import type { NexusPlanet } from '../nexus/nexusModel';

const baseVan = {
  driverName: 'A',
  status: 'moving' as const,
  position: null,
  recordedAt: null,
  pingLabel: 'No data',
  hasPingToday: false,
};

describe('opsMapModel', () => {
  it('parses usable gps_location and rejects junk', () => {
    expect(parseGpsLocation('26.22, 50.58')).toEqual({ lat: 26.22, lng: 50.58 });
    expect(parseGpsLocation('26.22;50.58')).toEqual({ lat: 26.22, lng: 50.58 });
    expect(parseGpsLocation('')).toBeNull();
    expect(parseGpsLocation('near the roundabout')).toBeNull();
    expect(parseGpsLocation('999, 50')).toBeNull();
  });

  it('status from speed + age only (moving / stopped / offline)', () => {
    const now = new Date('2026-10-20T12:00:00');
    const rows = buildOpsVans(
      [
        {
          van_id: '1',
          van_number: 'VAN-01',
          latitude: 26.2,
          longitude: 50.5,
          speed: 5,
          recorded_at: '2026-10-20T11:55:00',
        },
        {
          van_id: '2',
          van_number: 'VAN-02',
          latitude: 26.3,
          longitude: 50.6,
          speed: 0,
          recorded_at: '2026-10-20T11:58:00',
        },
        {
          van_id: '3',
          van_number: 'VAN-03',
          latitude: 26.4,
          longitude: 50.7,
          speed: 0,
          recorded_at: '2026-10-20T10:00:00',
        },
      ],
      [
        { id: '1', van_number: 'VAN-01', driver_name: 'A' },
        { id: '2', van_number: 'VAN-02', driver_name: 'B' },
        { id: '3', van_number: 'VAN-03', driver_name: 'C' },
      ],
      now,
    );
    expect(rows.find((v) => v.vanId === '1')?.status).toBe('moving');
    expect(rows.find((v) => v.vanId === '2')?.status).toBe('stopped');
    expect(rows.find((v) => v.vanId === '3')?.status).toBe('offline');
  });

  it('missing ping today → No location today; no invented coords', () => {
    const now = new Date('2026-10-20T12:00:00');
    expect(vanPingLabel('2026-10-19T15:00:00', now).label).toBe('No location today');
    expect(vanPingLabel(null, now).label).toBe('No data');
    expect(vanPingLabel('2026-10-20T11:50:00', now).label).toBe('Last update 10 min ago');

    const rows = buildOpsVans(
      [{ van_id: '1', van_number: 'VAN-01', recorded_at: '2026-10-19T12:00:00' }],
      [{ id: '1', van_number: 'VAN-01', driver_name: 'A' }],
      now,
    );
    expect(rows[0].position).toBeNull();
    expect(rows[0].pingLabel).toBe('No location today');
  });

  it('route lines only between known points; missing coords break the chain', () => {
    const lines = routePolylines([
      { customerId: 1, name: 'A', visited: false, position: { lat: 1, lng: 1 }, owed: 0, lineName: null, vanId: null },
      { customerId: 2, name: 'B', visited: false, position: null, owed: 0, lineName: null, vanId: null },
      { customerId: 3, name: 'C', visited: false, position: { lat: 2, lng: 2 }, owed: 0, lineName: null, vanId: null },
      { customerId: 4, name: 'D', visited: false, position: { lat: 3, lng: 3 }, owed: 0, lineName: null, vanId: null },
    ]);
    expect(lines).toEqual([[{ lat: 2, lng: 2 }, { lat: 3, lng: 3 }]]);
  });

  it('route segments: dashed for remaining, solid for visited; no invented coords', () => {
    const segs = routeSegments([
      {
        customerId: 1,
        name: 'A',
        visited: true,
        position: { lat: 1, lng: 1 },
        owed: 0,
        lineName: 'East',
        vanId: null,
      },
      {
        customerId: 2,
        name: 'B',
        visited: true,
        position: { lat: 2, lng: 2 },
        owed: 0,
        lineName: 'East',
        vanId: null,
      },
      {
        customerId: 3,
        name: 'C',
        visited: false,
        position: { lat: 3, lng: 3 },
        owed: 0,
        lineName: 'East',
        vanId: null,
      },
      {
        customerId: 4,
        name: 'D',
        visited: false,
        position: { lat: 4, lng: 4 },
        owed: 0,
        lineName: 'East',
        vanId: null,
      },
      {
        customerId: 5,
        name: 'Gap',
        visited: false,
        position: null,
        owed: 0,
        lineName: 'East',
        vanId: null,
      },
      {
        customerId: 6,
        name: 'E',
        visited: false,
        position: { lat: 5, lng: 5 },
        owed: 0,
        lineName: 'East',
        vanId: null,
      },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0].dashed).toBe(false);
    expect(segs[0].points).toHaveLength(2);
    expect(segs[1].dashed).toBe(true);
    expect(segs[1].points).toEqual([
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
      { lat: 4, lng: 4 },
    ]);
  });

  it('progress is per route line — van V1 must NOT match line V10 or Route 12', () => {
    const progress = routeLineProgress([
      {
        customerId: 1,
        name: 'A',
        visited: true,
        position: null,
        owed: 0,
        lineName: 'V10',
        vanId: null,
      },
      {
        customerId: 2,
        name: 'B',
        visited: false,
        position: null,
        owed: 0,
        lineName: 'V10',
        vanId: null,
      },
      {
        customerId: 3,
        name: 'C',
        visited: false,
        position: null,
        owed: 0,
        lineName: 'Route 12',
        vanId: null,
      },
    ]);
    expect(progress.map((p) => p.lineLabel).sort()).toEqual(['Route 12', 'V10']);
    expect(progress.find((p) => p.lineLabel === 'V10')).toMatchObject({ done: 1, total: 2 });
    expect(progress.find((p) => p.lineLabel === 'Route 12')).toMatchObject({ done: 0, total: 1 });

    const vans = [{ ...baseVan, vanId: 'v1', vanNumber: 'V1' }];
    const stopV10 = {
      customerId: 1,
      name: 'A',
      visited: false,
      position: null,
      owed: 100,
      lineName: 'V10',
      vanId: null as string | null,
    };
    expect(vanLabelForStop(stopV10, vans)).toBeNull();
    expect(vanLabelForStop({ ...stopV10, lineName: 'Route 12' }, vans)).toBeNull();
    expect(pickOpsInsight([stopV10], vans)?.vanLabel).toBeNull();
  });

  it('exact van_id link names the van; no link → insight has no van name', () => {
    const vans = [{ ...baseVan, vanId: 'van-99', vanNumber: 'VAN-99' }];
    const withLink = {
      customerId: 9,
      name: 'Gamma Garage',
      visited: false,
      position: { lat: 26, lng: 50 },
      owed: 7118,
      lineName: 'VAN-01',
      vanId: 'van-99',
    };
    const noLink = { ...withLink, vanId: null, lineName: 'VAN-01' };

    expect(pickOpsInsight([withLink], vans)?.vanLabel).toBe('VAN-99');
    expect(pickOpsInsight([noLink], vans)?.vanLabel).toBeNull();
    expect(pickOpsInsight([noLink], vans)?.customerName).toBe('Gamma Garage');
    // No vans[0] fallback when fleet exists but no van_id on stop
    expect(pickOpsInsight([noLink], vans)?.vanLabel).not.toBe('VAN-99');
    expect(pickOpsInsight([{ ...noLink, owed: 0 }], vans)).toBeNull();
  });

  it('insight only when owed > 0 (wording uses owe, not overdue aging)', () => {
    const insight = pickOpsInsight(
      [
        {
          customerId: 9,
          name: 'Gamma Garage',
          visited: false,
          position: null,
          owed: 7118,
          lineName: null,
          vanId: null,
        },
      ],
      [],
    );
    expect(insight?.amount).toBe(7118);
    expect(insight?.vanLabel).toBeNull();
  });

  it('ar-summary balances override route week balance for insight', () => {
    const stops = stopsForVisitDay(
      {
        days: [
          {
            visit_day: 1,
            customers: [
              {
                customer_id: 5,
                name: 'Ada',
                gps_location: '26,50',
                visited: false,
                balance: 1,
                line_name: null,
              },
            ],
          },
        ],
      },
      1,
    );
    expect(stops[0].vanId).toBeNull();
    const withAr = applyArBalances(stops, [{ id: 5, balance: 250 }]);
    expect(withAr[0].owed).toBe(250);
    expect(pickOpsInsight(withAr, [])?.amount).toBe(250);
  });

  it('todayVisitDay is Mon–Fri only', () => {
    expect(todayVisitDay(new Date('2026-10-19T12:00:00'))).toBe(1); // Monday
    expect(todayVisitDay(new Date('2026-10-18T12:00:00'))).toBeNull(); // Sunday
  });

  it('API-failure state: locations fail → show error, not empty success', () => {
    expect(shouldShowVansError(false)).toBe(true);
    expect(shouldShowVansError(true)).toBe(false);
  });

  it('chips: source fails → no status color; loading → grey', () => {
    const goodPlanet: NexusPlanet = {
      id: 'collections',
      label: 'Collections',
      href: '/finance/collections',
      status: 'needs_you',
      metricLabel: 'Owed $7,118',
      orbitValue: '$7,118',
      connected: true,
    };
    expect(opsChipPresentation(goodPlanet, 'error')).toEqual({
      blurb: "Couldn't load",
      dotColor: null,
    });
    expect(opsChipPresentation(undefined, 'error').dotColor).toBeNull();
    expect(opsChipPresentation(goodPlanet, 'loading').dotColor).toBe('#64748B');
    expect(opsChipPresentation(goodPlanet, 'ok').dotColor).toBeTruthy();
    expect(opsChipPresentation({ ...goodPlanet, status: 'error' }, 'ok')).toEqual({
      blurb: "Couldn't load",
      dotColor: null,
    });
  });
});
