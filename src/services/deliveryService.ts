import { ACCESS_TOKEN_KEY } from '../api/axios';
import { API_BASE_URL } from './api';

export type DeliveryNoteStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';
export type DriverDeliveryStatus = 'PENDING' | 'ON THE WAY' | 'DELIVERED' | 'FAILED';

export interface DeliveryNoteItem {
  product_id?: string | number | null;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total: number;
  description?: string;
}

export interface ProofOfDelivery {
  id: string;
  delivery_note_id: string;
  customer_signature?: string | null;
  delivery_photo?: string | null;
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  delivery_timestamp?: string | null;
  items_received?: DeliveryNoteItem[] | null;
  customer_notes?: string | null;
  verified_by?: string | null;
  created_at?: string | null;
}

export interface DeliveryNote {
  id: string;
  dn_number: string;
  sales_order_id: string | null;
  customer_id: string;
  van_id: string | null;
  delivery_date: string;
  items: DeliveryNoteItem[] | null;
  status: DeliveryNoteStatus;
  driver_name: string | null;
  vehicle_number: string | null;
  pod_id: string | null;
  notes: string | null;
  created_at: string | null;
  pod: ProofOfDelivery | null;
}

export interface ListDeliveryNotesFilters {
  van_id?: string;
  status?: DeliveryNoteStatus;
  delivery_date?: string;
}

export interface CreateDeliveryNotePayload {
  sales_order_id: string;
  van_id?: string;
  driver_name?: string;
  vehicle_number?: string;
  delivery_date?: string;
  items?: DeliveryNoteItem[];
  notes?: string;
}

export interface CompleteDeliveryNotePayload {
  customer_signature?: string;
  delivery_photo?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  items_received?: DeliveryNoteItem[];
  customer_notes?: string;
  verified_by?: string;
}

const BACKEND_TO_DRIVER_STATUS: Record<DeliveryNoteStatus, DriverDeliveryStatus> = {
  pending: 'PENDING',
  in_transit: 'ON THE WAY',
  delivered: 'DELIVERED',
  failed: 'FAILED',
};

const DRIVER_TO_BACKEND_STATUS: Record<DriverDeliveryStatus, DeliveryNoteStatus> = {
  PENDING: 'pending',
  'ON THE WAY': 'in_transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

export function toDriverDeliveryStatus(status: DeliveryNoteStatus): DriverDeliveryStatus {
  return BACKEND_TO_DRIVER_STATUS[status];
}

export function toBackendDeliveryStatus(status: DriverDeliveryStatus): DeliveryNoteStatus {
  return DRIVER_TO_BACKEND_STATUS[status];
}

function queryString(filters: ListDeliveryNotesFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.van_id) params.set('van_id', filters.van_id);
  if (filters.status) params.set('status', filters.status);
  if (filters.delivery_date) params.set('delivery_date', filters.delivery_date);
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const error = await response.json();
      if (error?.detail) detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
    } catch {
      /* ignore malformed error payloads */
    }
    throw new Error(detail);
  }
  return response.json();
}

export function listDeliveryNotes(filters: ListDeliveryNotesFilters = {}): Promise<DeliveryNote[]> {
  return apiRequest<DeliveryNote[]>(`/delivery-notes${queryString(filters)}`);
}

export function getDeliveryNote(id: string): Promise<DeliveryNote> {
  return apiRequest<DeliveryNote>(`/delivery-notes/${encodeURIComponent(id)}`);
}

export function createDeliveryNote(payload: CreateDeliveryNotePayload): Promise<DeliveryNote> {
  return apiRequest<DeliveryNote>('/delivery-notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function completeDeliveryNote(id: string, payload: CompleteDeliveryNotePayload): Promise<DeliveryNote> {
  return apiRequest<DeliveryNote>(`/delivery-notes/${encodeURIComponent(id)}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export const deliveryService = {
  listDeliveryNotes,
  getDeliveryNote,
  createDeliveryNote,
  completeDeliveryNote,
  toDriverDeliveryStatus,
  toBackendDeliveryStatus,
};
