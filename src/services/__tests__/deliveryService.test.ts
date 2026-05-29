import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import {
  completeDeliveryNote,
  createDeliveryNote,
  getDeliveryNote,
  listDeliveryNotes,
  toBackendDeliveryStatus,
  toDriverDeliveryStatus,
  type DeliveryNote,
} from '../deliveryService';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

const note: DeliveryNote = {
  id: 'dn-id',
  dn_number: 'DN-00001',
  sales_order_id: 'so-id',
  customer_id: '1',
  van_id: 'VAN-1',
  delivery_date: '2026-05-29',
  items: [
    {
      product_id: '101',
      product_name: 'Motor Oil',
      quantity: 2,
      unit_price: 50,
      total: 100,
      description: 'Line item',
    },
  ],
  status: 'pending',
  driver_name: 'Driver One',
  vehicle_number: 'TRUCK-1',
  pod_id: null,
  notes: 'Handle with care',
  created_at: '2026-05-29T12:00:00',
  pod: null,
};

describe('deliveryService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lists delivery notes with filters and auth header', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'delivery-token');
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, [note]));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await listDeliveryNotes({
      van_id: 'VAN-1',
      status: 'pending',
      delivery_date: '2026-05-29',
    });

    expect(rows).toEqual([note]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/delivery-notes\?/);
    expect(url).toContain('van_id=VAN-1');
    expect(url).toContain('status=pending');
    expect(url).toContain('delivery_date=2026-05-29');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer delivery-token',
    });
  });

  it('gets a delivery note by encoded id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, note));
    vi.stubGlobal('fetch', fetchMock);

    const row = await getDeliveryNote('dn id/with slash');

    expect(row.id).toBe('dn-id');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/delivery-notes\/dn%20id%2Fwith%20slash$/);
  });

  it('creates a delivery note with the backend payload shape', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 201, note));
    vi.stubGlobal('fetch', fetchMock);

    await createDeliveryNote({
      sales_order_id: 'so-id',
      van_id: 'VAN-1',
      driver_name: 'Driver One',
      vehicle_number: 'TRUCK-1',
      delivery_date: '2026-05-29',
      items: note.items ?? undefined,
      notes: 'Handle with care',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/delivery-notes$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      sales_order_id: 'so-id',
      van_id: 'VAN-1',
      driver_name: 'Driver One',
      vehicle_number: 'TRUCK-1',
      delivery_date: '2026-05-29',
      items: note.items,
      notes: 'Handle with care',
    });
  });

  it('completes a delivery note with POD payload and returns nested pod', async () => {
    const completed: DeliveryNote = {
      ...note,
      status: 'delivered',
      pod_id: 'pod-id',
      pod: {
        id: 'pod-id',
        delivery_note_id: 'dn-id',
        customer_signature: 'sig',
        delivery_photo: 'photo',
        gps_latitude: 40.7128,
        gps_longitude: -74.006,
        delivery_timestamp: '2026-05-29T13:00:00',
        items_received: note.items,
        customer_notes: 'Received',
        verified_by: 'Driver One',
        created_at: '2026-05-29T13:00:01',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, completed));
    vi.stubGlobal('fetch', fetchMock);

    const row = await completeDeliveryNote('dn-id', {
      customer_signature: 'sig',
      delivery_photo: 'photo',
      gps_latitude: 40.7128,
      gps_longitude: -74.006,
      items_received: note.items ?? undefined,
      customer_notes: 'Received',
      verified_by: 'Driver One',
    });

    expect(row.pod?.id).toBe('pod-id');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/delivery-notes\/dn-id\/complete$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      customer_signature: 'sig',
      delivery_photo: 'photo',
      gps_latitude: 40.7128,
      gps_longitude: -74.006,
      items_received: note.items,
      customer_notes: 'Received',
      verified_by: 'Driver One',
    });
  });

  it('normalizes statuses between backend and driver UI labels', () => {
    expect(toDriverDeliveryStatus('pending')).toBe('PENDING');
    expect(toDriverDeliveryStatus('in_transit')).toBe('ON THE WAY');
    expect(toDriverDeliveryStatus('delivered')).toBe('DELIVERED');
    expect(toDriverDeliveryStatus('failed')).toBe('FAILED');

    expect(toBackendDeliveryStatus('PENDING')).toBe('pending');
    expect(toBackendDeliveryStatus('ON THE WAY')).toBe('in_transit');
    expect(toBackendDeliveryStatus('DELIVERED')).toBe('delivered');
    expect(toBackendDeliveryStatus('FAILED')).toBe('failed');
  });

  it('throws backend detail for failed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResp(false, 400, { detail: 'items must be a list' })));

    await expect(listDeliveryNotes()).rejects.toThrow('items must be a list');
  });
});
