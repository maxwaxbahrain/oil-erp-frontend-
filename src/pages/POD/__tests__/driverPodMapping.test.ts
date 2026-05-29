import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  backendStatusForDriverStop,
  buildCompleteDeliveryPayload,
  buildDeliveryNotePayload,
  stopItemsToDeliveryNoteItems,
  type DriverPodStop,
} from '../driverPodMapping';

const stop: DriverPodStop = {
  id: 'so-123',
  orderId: 'sales-order-123',
  status: 'ON THE WAY',
  items: [
    {
      description: 'Motor Oil 5W-30',
      quantity: 3,
      rate: 25,
      amount: 75,
    },
  ],
};

describe('driver POD payload mapping', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps stop items into backend delivery note line items', () => {
    expect(stopItemsToDeliveryNoteItems(stop.items)).toEqual([
      {
        product_name: 'Motor Oil 5W-30',
        description: 'Motor Oil 5W-30',
        quantity: 3,
        unit_price: 25,
        total: 75,
      },
    ]);
  });

  it('builds createDeliveryNote payload from stop and van data', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T14:00:00Z'));

    expect(
      buildDeliveryNotePayload(
        stop,
        { id: 'van-db-id', van_number: 'VAN-1', driver_name: 'Default Driver' },
        'Driver One',
      ),
    ).toEqual({
      sales_order_id: 'sales-order-123',
      van_id: 'van-db-id',
      driver_name: 'Driver One',
      vehicle_number: 'VAN-1',
      delivery_date: '2026-05-29',
      items: [
        {
          product_name: 'Motor Oil 5W-30',
          description: 'Motor Oil 5W-30',
          quantity: 3,
          unit_price: 25,
          total: 75,
        },
      ],
    });
  });

  it('requires a sales order id for backend delivery note creation', () => {
    expect(() =>
      buildDeliveryNotePayload({ ...stop, orderId: undefined }, { id: 'van-db-id' }, 'Driver One'),
    ).toThrow('Delivery note requires a sales order id');
  });

  it('builds completeDeliveryNote POD payload from capture data', () => {
    expect(
      buildCompleteDeliveryPayload(stop, {
        signatureData: 'data:image/png;base64,signature',
        photoData: 'data:image/jpeg;base64,photo',
        gpsLocation: { latitude: 40.7128, longitude: -74.006 },
        recipientName: 'Receiving Clerk',
        notes: '  Left at loading dock  ',
      }),
    ).toEqual({
      customer_signature: 'data:image/png;base64,signature',
      delivery_photo: 'data:image/jpeg;base64,photo',
      gps_latitude: 40.7128,
      gps_longitude: -74.006,
      items_received: [
        {
          product_name: 'Motor Oil 5W-30',
          description: 'Motor Oil 5W-30',
          quantity: 3,
          unit_price: 25,
          total: 75,
        },
      ],
      customer_notes: 'Left at loading dock',
      verified_by: 'Receiving Clerk',
    });
  });

  it('uses adapter status mapping for driver labels', () => {
    expect(backendStatusForDriverStop('PENDING')).toBe('pending');
    expect(backendStatusForDriverStop('ON THE WAY')).toBe('in_transit');
    expect(backendStatusForDriverStop('DELIVERED')).toBe('delivered');
    expect(backendStatusForDriverStop('FAILED')).toBe('failed');
  });
});
