import { type Customer, API_BASE_URL } from './api';
const USE_MOCK = false;

export type SalesOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'delivered'
  | 'invoiced'
  | 'cancelled';

export interface SalesOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  description?: string;
}

/** Normalized sales order (API + client helpers). */
export interface SalesOrder {
  id: string;
  so_number: string;
  customer_id: string;
  customer?: Customer;
  customer_name?: string;
  order_date: string;
  items: SalesOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  /** Alias for legacy UIs */
  total_amount: number;
  status: SalesOrderStatus;
  notes: string;
  created_at?: string;
  van_id?: string | null;
  payment_status: string;
  salesman_name?: string | null;
  pod_confirmed: boolean;
  signature_confirmed: boolean;
  linked_invoice_number?: string | null;
  linked_invoice_id?: number | null;
  payment_method?: string | null;
  payment_due_days?: number | null;
  payment_notes?: string | null;
}

export interface SalesOrderCreatePayload {
  customer_id: string;
  order_date?: string;
  items: Array<Record<string, unknown>>;
  notes?: string;
  status: SalesOrderStatus;
  salesman_name?: string;
  van_id?: string | null;
  payment_status?: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_method?: string;
  payment_due_days?: number;
  payment_notes?: string;
}

// Mock Helpers
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

function sliceDate(d: unknown): string {
  if (d == null) return '';
  const s = typeof d === 'string' ? d : String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function mapItem(raw: Record<string, unknown>): SalesOrderItem {
  const q = Number(raw.quantity ?? 0) || 0;
  const r = Number(raw.unit_price ?? raw.rate ?? 0) || 0;
  const tot = Number(raw.total ?? raw.amount ?? q * r) || 0;
  return {
    product_id: String(raw.product_id ?? ''),
    product_name: String(raw.product_name ?? raw.product ?? ''),
    quantity: q,
    unit_price: r,
    total: tot,
    description: raw.description != null ? String(raw.description) : undefined,
  };
}

export function mapApiSalesOrder(raw: Record<string, unknown>): SalesOrder {
  const itemsRaw = raw.items;
  const items: SalesOrderItem[] = Array.isArray(itemsRaw)
    ? (itemsRaw as Record<string, unknown>[]).map((r) => mapItem(r))
    : [];

  const subtotal = Number(raw.subtotal ?? 0) || 0;
  const tax = Number(raw.tax ?? 0) || 0;
  const total = Number(raw.total ?? raw.total_amount ?? 0) || 0;

  return {
    id: String(raw.id ?? ''),
    so_number: String(raw.so_number ?? ''),
    customer_id: String(raw.customer_id ?? ''),
    order_date: sliceDate(raw.order_date),
    items,
    subtotal,
    tax,
    total,
    total_amount: total,
    status: String(raw.status ?? 'draft').toLowerCase() as SalesOrderStatus,
    notes: String(raw.notes ?? ''),
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    van_id: raw.van_id != null ? String(raw.van_id) : null,
    payment_status: String(raw.payment_status ?? 'unpaid'),
    salesman_name: raw.salesman_name != null ? String(raw.salesman_name) : null,
    pod_confirmed: Boolean(raw.pod_confirmed),
    signature_confirmed: Boolean(raw.signature_confirmed),
    linked_invoice_number:
      raw.linked_invoice_number != null ? String(raw.linked_invoice_number) : null,
    linked_invoice_id:
      raw.linked_invoice_id != null && raw.linked_invoice_id !== ''
        ? Number(raw.linked_invoice_id)
        : null,
    payment_method: raw.payment_method != null ? String(raw.payment_method) : null,
    payment_due_days:
      raw.payment_due_days != null && raw.payment_due_days !== ''
        ? Number(raw.payment_due_days)
        : null,
    payment_notes: raw.payment_notes != null ? String(raw.payment_notes) : null,
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.detail) detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function createSalesOrder(order: SalesOrderCreatePayload): Promise<SalesOrder> {
  if (USE_MOCK) {
    await delay(500);
    const orders = getStorage<Record<string, unknown>>('sales_orders');
    const row = {
      ...order,
      id: crypto.randomUUID(),
      so_number: `SO-${String(orders.length + 1).padStart(6, '0')}`,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      pod_confirmed: false,
      signature_confirmed: false,
    };
    setStorage('sales_orders', [row, ...orders]);
    return mapApiSalesOrder(row);
  }

  const raw = await fetchJson<Record<string, unknown>>(`${API_BASE_URL}/sales-orders`, {
    method: 'POST',
    body: JSON.stringify({
      customer_id: order.customer_id,
      order_date: order.order_date || undefined,
      items: order.items,
      notes: order.notes ?? '',
      status: order.status,
      salesman_name: order.salesman_name ?? null,
      van_id: order.van_id ?? null,
      payment_status: order.payment_status ?? 'unpaid',
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      payment_method: order.payment_method ?? null,
      payment_due_days: order.payment_due_days ?? null,
      payment_notes: order.payment_notes ?? '',
    }),
  });
  return mapApiSalesOrder(raw);
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  if (USE_MOCK) {
    await delay(500);
    const orders = getStorage<Record<string, unknown>>('sales_orders');
    const customers = getStorage<Customer>('customers');
    return orders.map((o) => {
      const m = mapApiSalesOrder(o);
      m.customer = customers.find((c) => c.id === m.customer_id);
      m.customer_name = m.customer?.name;
      return m;
    });
  }

  const raw = await fetchJson<unknown[]>(`${API_BASE_URL}/sales-orders`);
  const list = Array.isArray(raw) ? raw : [];
  return list.map((r) => mapApiSalesOrder(r as Record<string, unknown>));
}

export async function getSalesOrder(id: string): Promise<SalesOrder> {
  if (USE_MOCK) {
    await delay(300);
    const orders = getStorage<Record<string, unknown>>('sales_orders');
    const row = orders.find((o) => String(o.id) === id);
    if (!row) throw new Error('Sales order not found');
    const customers = getStorage<Customer>('customers');
    const m = mapApiSalesOrder(row);
    m.customer = customers.find((c) => c.id === m.customer_id);
    m.customer_name = m.customer?.name;
    return m;
  }

  const raw = await fetchJson<Record<string, unknown>>(`${API_BASE_URL}/sales-orders/${encodeURIComponent(id)}`);
  return mapApiSalesOrder(raw);
}

export async function patchSalesOrder(
  id: string,
  body: Partial<{
    status: SalesOrderStatus;
    notes: string;
    pod_confirmed: boolean;
    signature_confirmed: boolean;
    payment_status: string;
    payment_method?: string;
    payment_due_days?: number;
    payment_notes?: string;
  }>
): Promise<SalesOrder> {
  if (USE_MOCK) {
    await delay(300);
    const orders = getStorage<Record<string, unknown>>('sales_orders');
    const idx = orders.findIndex((o) => String(o.id) === id);
    if (idx === -1) throw new Error('Sales order not found');
    orders[idx] = { ...orders[idx], ...body };
    setStorage('sales_orders', orders);
    return mapApiSalesOrder(orders[idx]);
  }

  const raw = await fetchJson<Record<string, unknown>>(`${API_BASE_URL}/sales-orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapApiSalesOrder(raw);
}

export async function convertSalesOrderToInvoice(id: string): Promise<SalesOrder> {
  if (USE_MOCK) {
    await delay(400);
    return patchSalesOrder(id, { status: 'invoiced' });
  }

  const raw = await fetchJson<Record<string, unknown>>(
    `${API_BASE_URL}/sales-orders/${encodeURIComponent(id)}/convert-to-invoice`,
    { method: 'POST', body: '{}' }
  );
  return mapApiSalesOrder(raw);
}

/** Hydrate customer names from GET /customers/ */
export async function hydrateSalesOrdersWithCustomers(orders: SalesOrder[]): Promise<SalesOrder[]> {
  try {
    const { getCustomers } = await import('./api');
    const customers = await getCustomers();
    const byId = new Map(customers.map((c) => [String(c.id), c]));
    return orders.map((o) => {
      const c = byId.get(o.customer_id);
      return { ...o, customer: c, customer_name: c?.name };
    });
  } catch {
    return orders;
  }
}
