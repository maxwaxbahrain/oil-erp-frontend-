import type { Van } from '../../services/api';
import type { DeliveryNote, DeliveryNoteStatus } from '../../services/deliveryService';

export type DeliveryStatusCounts = Record<DeliveryNoteStatus, number>;

export interface PodFleetStats {
  totalVans: number;
  activeVans: number;
  inactiveVans: number;
  totalDeliveries: number;
  pendingDeliveries: number;
  inTransitDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  deliveredToday: number;
  podGpsPoints: number;
}

export interface VanDeliveryMetric {
  vanId: string;
  deliveriesCompleted: number;
  deliveriesPending: number;
  deliveriesInTransit: number;
  deliveriesFailed: number;
  lastUpdate?: string;
}

export interface PodMapMarker {
  id: string;
  deliveryNoteId: string;
  dnNumber: string;
  vanId: string | null;
  latitude: number;
  longitude: number;
  timestamp: string | null;
  customerId: string;
  status: DeliveryNoteStatus;
}

export function isToday(day: string | null | undefined, now = new Date()): boolean {
  if (!day) return false;
  return day.slice(0, 10) === now.toISOString().slice(0, 10);
}

export function countDeliveryStatuses(notes: DeliveryNote[]): DeliveryStatusCounts {
  return notes.reduce<DeliveryStatusCounts>(
    (acc, note) => {
      acc[note.status] += 1;
      return acc;
    },
    { pending: 0, in_transit: 0, delivered: 0, failed: 0 },
  );
}

export function computePodFleetStats(vans: Van[], notes: DeliveryNote[], now = new Date()): PodFleetStats {
  const counts = countDeliveryStatuses(notes);
  return {
    totalVans: vans.length,
    activeVans: vans.filter((van) => String(van.status).toLowerCase() === 'active').length,
    inactiveVans: vans.filter((van) => String(van.status).toLowerCase() !== 'active').length,
    totalDeliveries: notes.length,
    pendingDeliveries: counts.pending,
    inTransitDeliveries: counts.in_transit,
    completedDeliveries: counts.delivered,
    failedDeliveries: counts.failed,
    deliveredToday: notes.filter((note) => note.status === 'delivered' && isToday(note.delivery_date, now)).length,
    podGpsPoints: podMapMarkers(notes).length,
  };
}

export function computeVanDeliveryMetrics(notes: DeliveryNote[]): Map<string, VanDeliveryMetric> {
  const metrics = new Map<string, VanDeliveryMetric>();
  for (const note of notes) {
    const vanId = note.van_id || 'unassigned';
    const current = metrics.get(vanId) ?? {
      vanId,
      deliveriesCompleted: 0,
      deliveriesPending: 0,
      deliveriesInTransit: 0,
      deliveriesFailed: 0,
      lastUpdate: undefined,
    };
    if (note.status === 'delivered') current.deliveriesCompleted += 1;
    if (note.status === 'pending') current.deliveriesPending += 1;
    if (note.status === 'in_transit') current.deliveriesInTransit += 1;
    if (note.status === 'failed') current.deliveriesFailed += 1;
    if (note.created_at && (!current.lastUpdate || note.created_at > current.lastUpdate)) {
      current.lastUpdate = note.created_at;
    }
    metrics.set(vanId, current);
  }
  return metrics;
}

export function podMapMarkers(notes: DeliveryNote[]): PodMapMarker[] {
  return notes
    .filter((note) => note.status === 'delivered' && note.pod?.gps_latitude != null && note.pod?.gps_longitude != null)
    .map((note) => ({
      id: note.pod?.id || note.id,
      deliveryNoteId: note.id,
      dnNumber: note.dn_number,
      vanId: note.van_id,
      latitude: Number(note.pod?.gps_latitude),
      longitude: Number(note.pod?.gps_longitude),
      timestamp: note.pod?.delivery_timestamp || note.created_at,
      customerId: note.customer_id,
      status: note.status,
    }));
}
