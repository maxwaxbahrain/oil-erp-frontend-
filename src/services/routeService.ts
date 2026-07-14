import { getOilErpApiBase } from '../config/apiBase';
import { authFetch } from '../api/axios';

function routeApiBase(): string {
  return getOilErpApiBase().replace(/\/$/, '');
}

export interface RouteDay {
  day_id: number;
  day_name: string;
  total_stops: number;
  priority_stops: number;
  neighborhoods: string[];
}

export interface RouteStop {
  id: number;
  name: string;
  address: string;
  business_type: string;
  phone?: string | null;
  day_id: number;
  day_name: string;
  neighborhood: string;
  is_priority: boolean;
  stop_order: number;
}

export interface SyncRoutePriorityResult {
  created: number;
  skipped_existing: number;
  total_priority_stops: number;
}

export interface CreateRouteStopInput {
  name: string;
  address: string;
  business_type: string;
  phone?: string;
  neighborhood?: string;
  is_priority?: boolean;
  opening_balance?: number;
  credit_limit?: number;
  category?: string;
  notes?: string;
  gps_location?: string;
}

/** PATCH body: only send fields you want to change. */
export interface UpdateRouteStopInput {
  name?: string;
  address?: string;
  business_type?: string;
  phone?: string | null;
  neighborhood?: string;
  is_priority?: boolean;
}

const getJson = async <T>(path: string): Promise<T> => {
  const response = await authFetch(`${routeApiBase()}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

export const getRoutes = () => getJson<RouteDay[]>('/routes/');
export const getRouteByDay = (dayId: number) => getJson<RouteDay>(`/routes/${dayId}`);
export const getRouteStops = (dayId: number) => getJson<RouteStop[]>(`/routes/${dayId}/stops`);

/** Priority (★) route stops → global customers table. */
export const syncPriorityRouteToCustomers = async (): Promise<SyncRoutePriorityResult> => {
  const response = await authFetch(`${routeApiBase()}/routes/sync-priority-to-customers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    let message = `Sync failed (${response.status})`;
    try {
      const err = await response.json();
      if (typeof err?.detail === 'string') message = err.detail;
      else if (Array.isArray(err?.detail))
        message = err.detail.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join('; ');
    } catch {
      const text = await response.text();
      if (text) message = text.slice(0, 300);
    }
    throw new Error(message);
  }
  return response.json();
};

export const createRouteStop = async (dayId: number, data: CreateRouteStopInput): Promise<RouteStop> => {
  const response = await authFetch(`${routeApiBase()}/routes/${dayId}/stops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Failed to create route stop: ${response.status}`);
  }
  return response.json();
};

export const updateRouteStop = async (
  dayId: number,
  stopId: number,
  data: UpdateRouteStopInput
): Promise<RouteStop> => {
  const response = await authFetch(`${routeApiBase()}/routes/${dayId}/stops/${stopId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let message = `Failed to update route stop (${response.status})`;
    try {
      const err = await response.json();
      if (typeof err?.detail === 'string') message = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return response.json();
};

export const searchRouteCustomers = (params: {
  q?: string;
  day_id?: number;
  neighborhood?: string;
  priority_only?: boolean;
  limit?: number;
}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.day_id) qs.set('day_id', String(params.day_id));
  if (params.neighborhood) qs.set('neighborhood', params.neighborhood);
  if (typeof params.priority_only === 'boolean') qs.set('priority_only', String(params.priority_only));
  if (params.limit) qs.set('limit', String(params.limit));
  return getJson<RouteStop[]>(`/customers/route?${qs.toString()}`);
};

// --- Weekly route planner (canonical customers) ---

export interface RouteWeekCustomer {
  customer_id: number;
  name: string;
  address?: string | null;
  phone?: string | null;
  gps_location?: string | null;
  balance: number;
  credit_limit: number;
  credit_left: number;
  line_name?: string | null;
  visit_day?: number | null;
  visited: boolean;
  visited_at?: string | null;
  visited_by?: number | null;
  pending_from_last_week: boolean;
}

export interface RouteWeekDay {
  visit_day: number;
  day_name: string;
  total_count: number;
  visited_count: number;
  remaining_count: number;
  customers: RouteWeekCustomer[];
}

export interface RouteWeekResponse {
  week_start: string;
  collected_today: number;
  days: RouteWeekDay[];
}

export interface RouteAssignInput {
  customer_id: number;
  visit_day?: number | null;
  line_name?: string | null;
}

export interface RouteAssignResult {
  customer_id: number;
  visit_day: number | null;
  line_name: string | null;
}

export const getRouteWeek = () => getJson<RouteWeekResponse>('/routes/week');

export const assignRouteCustomer = async (data: RouteAssignInput): Promise<RouteAssignResult> => {
  const response = await authFetch(`${routeApiBase()}/routes/assign`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    let message = `Assign failed (${response.status})`;
    try {
      const err = await response.json();
      if (typeof err?.detail === 'string') message = err.detail;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return response.json();
};
