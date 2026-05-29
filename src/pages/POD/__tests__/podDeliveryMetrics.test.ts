import { describe, expect, it } from 'vitest';
import type { Van } from '../../../services/api';
import type { DeliveryNote } from '../../../services/deliveryService';
import { computePodFleetStats, computeVanDeliveryMetrics, podMapMarkers } from '../podDeliveryMetrics';

const vans: Van[] = [
  { id: 'v1', van_number: 'VAN-1', driver_name: 'A Driver', status: 'active' },
  { id: 'v2', van_number: 'VAN-2', driver_name: 'B Driver', status: 'maintenance' },
];

function note(overrides: Partial<DeliveryNote>): DeliveryNote {
  return {
    id: 'dn-1',
    dn_number: 'DN-00001',
    sales_order_id: 'so-1',
    customer_id: 'cust-1',
    van_id: 'v1',
    delivery_date: '2026-05-29',
    items: [],
    status: 'pending',
    driver_name: null,
    vehicle_number: null,
    pod_id: null,
    notes: null,
    created_at: '2026-05-29T10:00:00Z',
    pod: null,
    ...overrides,
  };
}

describe('pod delivery metrics', () => {
  it('computes fleet stats from real delivery notes without fabricated telemetry', () => {
    const notes = [
      note({ id: 'pending', status: 'pending' }),
      note({ id: 'transit', status: 'in_transit' }),
      note({ id: 'failed', status: 'failed', van_id: 'v2' }),
      note({
        id: 'delivered',
        status: 'delivered',
        delivery_date: '2026-05-29',
        pod: { id: 'pod-1', delivery_note_id: 'delivered', gps_latitude: 40.7, gps_longitude: -74.0 },
      }),
    ];

    expect(computePodFleetStats(vans, notes, new Date('2026-05-29T12:00:00Z'))).toEqual({
      totalVans: 2,
      activeVans: 1,
      inactiveVans: 1,
      totalDeliveries: 4,
      pendingDeliveries: 1,
      inTransitDeliveries: 1,
      completedDeliveries: 1,
      failedDeliveries: 1,
      deliveredToday: 1,
      podGpsPoints: 1,
    });
  });

  it('computes per-van delivery status counts', () => {
    const metrics = computeVanDeliveryMetrics([
      note({ id: 'one', van_id: 'v1', status: 'delivered', created_at: '2026-05-29T10:00:00Z' }),
      note({ id: 'two', van_id: 'v1', status: 'in_transit', created_at: '2026-05-29T11:00:00Z' }),
      note({ id: 'three', van_id: 'v2', status: 'failed', created_at: '2026-05-29T09:00:00Z' }),
    ]);

    expect(metrics.get('v1')).toMatchObject({
      deliveriesCompleted: 1,
      deliveriesPending: 0,
      deliveriesInTransit: 1,
      deliveriesFailed: 0,
      lastUpdate: '2026-05-29T11:00:00Z',
    });
    expect(metrics.get('v2')).toMatchObject({ deliveriesFailed: 1 });
  });

  it('only maps delivered notes with real POD GPS to map markers', () => {
    const markers = podMapMarkers([
      note({ id: 'missing-gps', status: 'delivered', pod: { id: 'pod-missing', delivery_note_id: 'missing-gps' } }),
      note({
        id: 'with-gps',
        dn_number: 'DN-00002',
        status: 'delivered',
        van_id: 'v1',
        pod: {
          id: 'pod-2',
          delivery_note_id: 'with-gps',
          gps_latitude: 25.2,
          gps_longitude: 55.3,
          delivery_timestamp: '2026-05-29T12:00:00Z',
        },
      }),
      note({ id: 'not-delivered', status: 'pending', pod: { id: 'pod-pending', delivery_note_id: 'not-delivered', gps_latitude: 1, gps_longitude: 2 } }),
    ]);

    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      deliveryNoteId: 'with-gps',
      dnNumber: 'DN-00002',
      latitude: 25.2,
      longitude: 55.3,
    });
  });
});
