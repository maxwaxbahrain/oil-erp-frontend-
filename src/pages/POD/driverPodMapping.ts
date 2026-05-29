import {
  toBackendDeliveryStatus,
  type CompleteDeliveryNotePayload,
  type CreateDeliveryNotePayload,
  type DeliveryNoteItem,
  type DriverDeliveryStatus,
} from '../../services/deliveryService';

export type DriverPodItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type DriverPodStop = {
  id: string;
  items: DriverPodItem[];
  status: DriverDeliveryStatus;
  orderId?: string;
};

export type DriverPodVan = {
  id: string;
  van_number?: string;
  driver_name?: string;
};

export type PodCaptureInput = {
  signatureData?: string;
  photoData?: string;
  gpsLocation?: { latitude: number; longitude: number } | null;
  recipientName?: string;
  notes?: string;
};

export function stopItemsToDeliveryNoteItems(items: DriverPodItem[]): DeliveryNoteItem[] {
  return items.map((item) => ({
    product_name: item.description,
    description: item.description,
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.rate) || 0,
    total: Number(item.amount) || 0,
  }));
}

export function buildDeliveryNotePayload(
  stop: DriverPodStop,
  van: DriverPodVan,
  driverName: string,
): CreateDeliveryNotePayload {
  if (!stop.orderId) {
    throw new Error('Delivery note requires a sales order id');
  }
  return {
    sales_order_id: stop.orderId,
    van_id: van.id || van.van_number,
    driver_name: driverName || van.driver_name || 'Driver',
    vehicle_number: van.van_number,
    delivery_date: new Date().toISOString().slice(0, 10),
    items: stopItemsToDeliveryNoteItems(stop.items),
  };
}

export function buildCompleteDeliveryPayload(
  stop: DriverPodStop,
  capture: PodCaptureInput,
): CompleteDeliveryNotePayload {
  return {
    customer_signature: capture.signatureData || undefined,
    delivery_photo: capture.photoData || undefined,
    gps_latitude: capture.gpsLocation?.latitude,
    gps_longitude: capture.gpsLocation?.longitude,
    items_received: stopItemsToDeliveryNoteItems(stop.items),
    customer_notes: capture.notes?.trim() || undefined,
    verified_by: capture.recipientName?.trim() || undefined,
  };
}

export function backendStatusForDriverStop(status: DriverDeliveryStatus) {
  return toBackendDeliveryStatus(status);
}
