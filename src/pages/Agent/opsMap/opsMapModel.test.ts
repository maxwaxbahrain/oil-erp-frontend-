import { describe, expect, it } from 'vitest';

import {
  applyArBalances,
  buildOpsVans,
  parseGpsLocation,
  pickOpsInsight,
  routePolylines,
  routeSegments,
  shouldShowVansError,
  stopsForVisitDay,
  todayVisitDay,
  vanPingLabel,
  vanRouteProgress,
} from './opsMapModel';

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
      { customerId: 1, name: 'A', visited: false, position: { lat: 1, lng: 1 }, owed: 0, lineName: null },
      { customerId: 2, name: 'B', visited: false, position: null, owed: 0, lineName: null },
      { customerId: 3, name: 'C', visited: false, position: { lat: 2, lng: 2 }, owed: 0, lineName: null },
      { customerId: 4, name: 'D', visited: false, position: { lat: 3, lng: 3 }, owed: 0, lineName: null },
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
      },
      {
        customerId: 2,
        name: 'B',
        visited: true,
        position: { lat: 2, lng: 2 },
        owed: 0,
        lineName: 'East',
      },
      {
        customerId: 3,
        name: 'C',
        visited: false,
        position: { lat: 3, lng: 3 },
        owed: 0,
        lineName: 'East',
      },
      {
        customerId: 4,
        name: 'D',
        visited: false,
        position: { lat: 4, lng: 4 },
        owed: 0,
        lineName: 'East',
      },
      {
        customerId: 5,
        name: 'Gap',
        visited: false,
        position: null,
        owed: 0,
        lineName: 'East',
      },
      {
        customerId: 6,
        name: 'E',
        visited: false,
        position: { lat: 5, lng: 5 },
        owed: 0,
        lineName: 'East',
      },
    ]);
    expect(segs).toHaveLength(2);
    expect(segs[0].dashed).toBe(false);
    expect(segs[0].points).toHaveLength(2);
    expect(segs[1].dashed).toBe(true);
    // Bridge from last visited → remaining (real coords only)
    expect(segs[1].points).toEqual([
      { lat: 2, lng: 2 },
      { lat: 3, lng: 3 },
      { lat: 4, lng: 4 },
    ]);
  });

  it('van route progress matches line stops without inventing late status', () => {
    const vans = [
      {
        vanId: '1',
        vanNumber: 'Van 1',
        driverName: 'A',
        status: 'moving' as const,
        position: null,
        recordedAt: null,
        pingLabel: 'No data',
        hasPingToday: false,
      },
    ];
    const progress = vanRouteProgress(
      [
        {
          customerId: 1,
          name: 'A',
          visited: true,
          position: null,
          owed: 0,
          lineName: 'Van 1',
        },
        {
          customerId: 2,
          name: 'B',
          visited: false,
          position: null,
          owed: 0,
          lineName: 'Van 1',
        },
        {
          customerId: 3,
          name: 'C',
          visited: false,
          position: null,
          owed: 0,
          lineName: 'Van 1',
        },
      ],
      vans,
    );
    expect(progress[0].done).toBe(1);
    expect(progress[0].total).toBe(3);
  });

  it('insight only when overdue > 0', () => {
    const stops = [
      {
        customerId: 9,
        name: 'Gamma Garage',
        visited: false,
        position: { lat: 26, lng: 50 },
        owed: 7118,
        lineName: 'VAN-01',
      },
      {
        customerId: 10,
        name: 'Paid Up',
        visited: false,
        position: null,
        owed: 0,
        lineName: null,
      },
    ];
    const vans = [
      {
        vanId: '1',
        vanNumber: 'VAN-01',
        driverName: 'A',
        status: 'moving' as const,
        position: { lat: 26, lng: 50 },
        recordedAt: null,
        pingLabel: 'No data',
        hasPingToday: false,
      },
    ];
    const insight = pickOpsInsight(stops, vans);
    expect(insight?.customerName).toBe('Gamma Garage');
    expect(insight?.amount).toBe(7118);
    expect(insight?.vanLabel).toBe('VAN-01');
    expect(pickOpsInsight(stops.map((s) => ({ ...s, owed: 0 })), vans)).toBeNull();
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
});
