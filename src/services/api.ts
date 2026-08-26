import { ACCESS_TOKEN_KEY, authFetch } from '../api/axios';
import { handlePaymentRequiredStatus } from '../api/paymentRequired';
import { getOilErpApiBase } from '../config/apiBase';

export const API_BASE_URL = getOilErpApiBase();
const USE_MOCK = false;

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  balance?: number;
  credit_limit?: number;
  category?: string;
  opening_balance?: number;
  gps_location?: string;
  notes?: string;
  created_at?: string;
  code?: string;
}

export interface LedgerEntry {
  id: string;
  customer_id: string;
  date: string;
  type: 'invoice' | 'payment' | 'credit' | 'debit' | 'van_sale';
  amount: number;
  balance: number;
  description?: string;
  reference?: string;
  van_number?: string;
  salesman_name?: string;
}

// Root B — date-range party ledger. The BACKEND computes opening/closing and a
// per-row running balance; the UI only displays these values.
export interface PartyLedgerRow {
  id: string;
  date: string | null;
  type: string;
  reference: string | null;
  description?: string;
  debit: number;
  credit: number;
  running_balance: number;
  invoice_id?: number | null;
  purchase_order_id?: number | null;
  van_number?: string;
  salesman_name?: string;
}
export interface PartyLedger {
  opening_balance: number;
  rows: PartyLedgerRow[];
  closing_balance: number;
}

export interface Van {
  id: string;
  van_number: string;
  driver_name: string;
  driver_phone?: string;
  vehicle_number?: string;
  capacity_liters?: number;
  status: 'active' | 'inactive' | 'maintenance';
  created_at?: string;
}

export interface VanLocation {
  van_id: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  recorded_at?: string;
  van_number?: string;
  driver_name?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  /** Selling / list price used by invoice line items (maps from API `price`). */
  unit_price: number;
  cost_price?: number;
  current_stock: number;
  minimum_stock?: number;
  /** From API `unit` (e.g. 12x1 QT). */
  unit?: string;
}

export interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
  invoice_id?: string; // Link payment to specific invoice
  is_advance?: boolean; // Mark as advance payment
  transaction_type?: 'payment' | 'expense';
}

export interface SalesOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  salesman?: string;
  van?: string;
  status: 'Pending' | 'Converted' | 'Cancelled';
  /** Lowercase workflow status from API: draft | confirmed | delivered | invoiced | cancelled */
  workflowStatus?: string;
  podConfirmed?: boolean;
  signatureConfirmed?: boolean;
  lineItems: Array<{
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  notes?: string;
  createdAt: string;
}

export interface PublicInvoicePayload {
  invoice_number: string;
  customer_name: string;
  customer_address?: string | null;
  date: string | null;
  due_date: string | null;
  items: Array<Record<string, unknown>>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  status?: string;
  share_token: string | null;
  company_settings: {
    name: string;
    address: string;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    phone: string;
    email: string;
    website: string;
    tax_id: string;
    logo: string | null;
  };
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  /** Public page token for /invoice/:token (no login) */
  shareToken?: string;
  invoiceDate: string;
  dueDate: string;
  salesman?: string;
  /** FK to employees.id — present when list API includes salesman_employee_id */
  salesmanEmployeeId?: number | string | null;
  van?: string;
  lineItems: Array<{
    product: string;
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  notes: string;
  status: 'Unpaid' | 'Paid' | 'Partial' | 'Overdue';
  payment_status?: 'Paid' | 'Unpaid' | 'Advance Paid';
  payment_method?: string;
  amount_paid?: number;
  remaining_balance?: number;
  createdAt: string;
  sales_order_id?: string | number;
  salesOrderId?: string | number;
}

// Mock Database Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize sample data if empty
const initializeSampleData = () => {
  const customers = getStorage<Customer>('customers');
  if (customers.length === 0) {
    const sampleCustomers: Customer[] = [
      {
        id: crypto.randomUUID(),
        name: 'Al-Khaleej Trading Co.',
        email: 'info@alkhaleej.com',
        phone: '+973-1234-5678',
        address: 'Manama, Bahrain',
        category: 'Wholesale',
        balance: -15000,
        credit_limit: 50000,
        created_at: new Date('2024-01-15').toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Gulf Petroleum Services',
        email: 'contact@gulfpetro.com',
        phone: '+973-9876-5432',
        address: 'Riffa, Bahrain',
        category: 'Retail',
        balance: -8500,
        credit_limit: 25000,
        created_at: new Date('2024-02-20').toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Bahrain Motors Ltd.',
        email: 'sales@bahrainmotors.com',
        phone: '+973-5555-1234',
        address: 'Sitra, Bahrain',
        category: 'Wholesale',
        balance: 0,
        credit_limit: 100000,
        created_at: new Date('2024-03-10').toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'MaxWax Oil Trading',
        email: 'info@maxwax.com',
        phone: '+973-7777-8888',
        address: 'Muharraq, Bahrain',
        category: 'Distributor',
        balance: -5000,
        credit_limit: 75000,
        created_at: new Date('2024-04-05').toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'Arabian Lubricants Co.',
        email: 'sales@arabianlube.com',
        phone: '+973-3333-4444',
        address: 'Hamad Town, Bahrain',
        category: 'Retail',
        balance: -2500,
        credit_limit: 20000,
        created_at: new Date('2024-05-12').toISOString()
      }
    ];
    setStorage('customers', sampleCustomers);
    console.log('✅ Initialized sample customer data');
  }
};

async function mockHandler<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  await delay(600); // Simulate network latency

  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body as string) : null;

  // --- Customers ---
  if (endpoint.startsWith('/customers')) {
    initializeSampleData(); // Ensure sample data exists
    const customers = getStorage<Customer>('customers');

    // GET /customers/overdue
    if (endpoint === '/customers/overdue') {
      // Mock logic: return customers with negative balance (debt)
      return customers.filter(c => (c.balance || 0) < 0) as any;
    }

    // POST /customers
    if (endpoint === '/customers' && method === 'POST') {
      const newCustomer = { ...body, id: crypto.randomUUID(), created_at: new Date().toISOString(), balance: body.opening_balance || 0 };
      setStorage('customers', [newCustomer, ...customers]);
      return newCustomer as any;
    }

    // PUT /customers/:id
    if (endpoint.match(/\/customers\/[\w-]+$/) && method === 'PUT') {
      const id = endpoint.split('/').pop();
      const updatedCustomers = customers.map(c => c.id === id ? { ...c, ...body } : c);
      setStorage('customers', updatedCustomers);
      return body as any;
    }

    // DELETE /customers/:id
    if (endpoint.match(/\/customers\/[\w-]+$/) && method === 'DELETE') {
      const id = endpoint.split('/').pop();
      const filtered = customers.filter(c => c.id !== id);
      setStorage('customers', filtered);
      return undefined as any;
    }

    // GET /customers/:id
    if (endpoint.match(/\/customers\/[\w-]+$/) && method === 'GET') {
      const id = endpoint.split('/').pop();
      const customer = customers.find(c => c.id === id);
      if (!customer) throw new Error('Customer not found');
      return customer as any;
    }

    // GET /customers/:id/ledger (Mock) — Root B object shape
    if (endpoint.match(/\/customers\/[\w-]+\/ledger(\?.*)?$/)) {
      return { opening_balance: 0, rows: [], closing_balance: 0 } as any;
    }

    // GET /customers
    return customers as any;
  }

  // --- Vans ---
  if (endpoint.startsWith('/vans')) {
    // FIX: seed sample vans on first request so the POD driver app
    // (and any other van-dependent screen) isn't blank on a fresh
    // install / cold mock. Mirrors what initializeSampleData() does
    // for customers — the original mock branch had no seed at all.
    let vans = getStorage<Van>('vans');
    if (vans.length === 0 && method === 'GET') {
      const seeded: Van[] = [
        { id: 'van-01', van_number: 'VAN-01', driver_name: 'Ahmed Hassan', driver_phone: '+973-3000-1001', vehicle_number: 'BH-1001', capacity_liters: 5000, status: 'active', created_at: new Date().toISOString() },
        { id: 'van-02', van_number: 'VAN-02', driver_name: 'Mohammed Ali',  driver_phone: '+973-3000-1002', vehicle_number: 'BH-1002', capacity_liters: 5000, status: 'active', created_at: new Date().toISOString() },
        { id: 'van-03', van_number: 'VAN-03', driver_name: 'Yusuf Khan',   driver_phone: '+973-3000-1003', vehicle_number: 'BH-1003', capacity_liters: 7500, status: 'active', created_at: new Date().toISOString() },
        { id: 'van-04', van_number: 'VAN-04', driver_name: 'Omar Salem',   driver_phone: '+973-3000-1004', vehicle_number: 'BH-1004', capacity_liters: 5000, status: 'active', created_at: new Date().toISOString() },
        { id: 'van-05', van_number: 'VAN-05', driver_name: 'Fahad Rashid', driver_phone: '+973-3000-1005', vehicle_number: 'BH-1005', capacity_liters: 7500, status: 'maintenance', created_at: new Date().toISOString() },
      ];
      setStorage('vans', seeded);
      vans = seeded;
    }
    if (method === 'POST') {
      const newVan = { ...body, id: crypto.randomUUID(), created_at: new Date().toISOString() };
      setStorage('vans', [newVan, ...vans]);
      return newVan as any;
    }
    if (endpoint.match(/\/vans\/[\w-]+$/) && method === 'PUT') {
      const id = endpoint.split('/').pop();
      const updated = vans.map(v => v.id === id ? { ...v, ...body } : v);
      setStorage('vans', updated);
      return body as any;
    }
    if (method === 'DELETE') { // /vans/:id
      const id = endpoint.split('/').pop();
      setStorage('vans', vans.filter(v => v.id !== id));
      return undefined as any;
    }
    return vans as any;
  }

  // --- Products ---
  if (endpoint.startsWith('/products')) {
    // Get products from zavi_products (productService storage)
    const rawProducts = getStorage<any>('zavi_products');

    // Map detailed product structure to simple API product structure
    const products: Product[] = rawProducts.map((p: any) => ({
      id: String(p.id ?? ''),
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.uom ?? p.unit,
      unit_price: p.pricing?.sellingPrice || p.unit_price || 0,
      cost_price: p.pricing?.landedCost || p.cost_price || 0,
      current_stock: p.locations?.reduce((sum: number, loc: any) => sum + (loc.currentStock || 0), 0) || p.current_stock || 0,
      minimum_stock: p.reorderLevel || p.minimum_stock || 0
    }));

    if (method === 'POST') {
      const newProduct = { ...body, id: crypto.randomUUID() };
      setStorage('zavi_products', [newProduct, ...rawProducts]);
      return newProduct as any;
    }
    return products as any;
  }

  // --- Payments ---
  if (endpoint.startsWith('/payments')) {
    const payments = getStorage<Payment>('payments');
    if (method === 'POST') {
      const newPayment = { ...body, id: crypto.randomUUID() };
      setStorage('payments', [newPayment, ...payments]);

      // Update customer balance locally
      const customers = getStorage<Customer>('customers');
      const updatedCustomers = customers.map(c => {
        if (c.id === body.customer_id) {
          return { ...c, balance: (c.balance || 0) - (body.amount || 0) };
        }
        return c;
      });
      setStorage('customers', updatedCustomers);

      return newPayment as any;
    }
    return payments as any;
  }

  throw new Error(`Mock endpoint not found: ${endpoint}`);
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  };

  if (USE_MOCK) {
    console.log(`[MOCK API] ${options.method || 'GET'} ${endpoint}`);
    return mockHandler<T>(endpoint, options);
  }

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      // Fallback to mock if connection refused
      if (response.status === 0 || response.status === 503 || response.status === 504) {
        console.warn('Backend unreachable, falling back to mock');
        return mockHandler<T>(endpoint, options);
      }
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      if (handlePaymentRequiredStatus(response.status, error.detail)) {
        throw new Error(
          typeof error.detail === 'string' ? error.detail : 'Your free trial has expired. Please upgrade to continue.',
        );
      }
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      console.warn('Network Error detected, switching to Mock Mode');
      return mockHandler<T>(endpoint, options);
    }
    console.error('API Error:', error);
    throw error;
  }
}

// Customer APIs
export const getCustomers = (): Promise<Customer[]> => apiRequest<Customer[]>('/customers/');
export const getCustomer = (id: string): Promise<Customer> => apiRequest<Customer>(`/customers/${id}`);
function formatApiErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: string }).msg);
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return 'Request failed';
}

/** POST /api/customers/ — trailing slash required (bare /customers 307 breaks fetch POST). */
export async function createCustomer(data: Partial<Customer>): Promise<Customer> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const body = {
    name: data.name ?? '',
    email: data.email?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    address: data.address?.trim() || undefined,
    category: (data.category ?? 'retail').toLowerCase(),
    credit_limit: data.credit_limit ?? 0,
    opening_balance: data.opening_balance ?? 0,
    gps_location: data.gps_location?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
  };

  const response = await fetch(`${API_BASE_URL}/customers/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let detail = `HTTP ${response.status}`;
    try {
      const err = JSON.parse(text) as { detail?: unknown };
      if (err.detail !== undefined) detail = formatApiErrorDetail(err.detail);
    } catch {
      if (text) detail = text.slice(0, 300);
    }
    throw new Error(detail);
  }

  const row = (await response.json()) as Record<string, unknown>;
  const bal = row.balance;
  const balanceNum =
    typeof bal === 'number' && !Number.isNaN(bal)
      ? bal
      : parseFloat(String(bal ?? '0')) || 0;
  return {
    ...(row as unknown as Customer),
    id: String(row.id ?? ''),
    name: row.name != null ? String(row.name) : '',
    balance: balanceNum,
  };
}
export const updateCustomer = (id: string, data: Partial<Customer>): Promise<Customer> => apiRequest<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCustomer = (id: string): Promise<void> => apiRequest<void>(`/customers/${id}`, { method: 'DELETE' });
// FIX W2-1 — Invoice delete (paid-invoice guard lives at the call site).
export const deleteInvoice = (id: string): Promise<void> => apiRequest<void>(`/invoices/${id}`, { method: 'DELETE' });
/**
 * Root B — customer receivable ledger. Returns backend-computed
 * { opening_balance, rows[], closing_balance }. With start/end the backend
 * seeds the opening balance from everything strictly before the window and
 * returns only in-window rows (each with a server-computed running balance);
 * with no dates it returns full history (opening = setup opening balance).
 */
export const getCustomerLedger = (id: string, startDate?: string, endDate?: string): Promise<PartyLedger> => {
  const qs = new URLSearchParams();
  if (startDate) qs.set('start_date', startDate);
  if (endDate) qs.set('end_date', endDate);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<PartyLedger>(`/customers/${id}/ledger${suffix}`);
};
/** Root B — supplier payable ledger (same shape/params, same shared backend helper). */
export const getSupplierLedger = (id: string, startDate?: string, endDate?: string): Promise<PartyLedger> => {
  const qs = new URLSearchParams();
  if (startDate) qs.set('start_date', startDate);
  if (endDate) qs.set('end_date', endDate);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<PartyLedger>(`/suppliers/${id}/ledger${suffix}`);
};
export const getOverdueCustomers = (): Promise<Customer[]> => apiRequest<Customer[]>('/customers/overdue');

// Payment APIs
export const getPayments = (): Promise<Payment[]> => apiRequest<Payment[]>('/payments');

/** True for customer receipt rows from GET /api/payments (excludes expense-type transactions). */
export function isCustomerPayment(p: Payment): boolean {
  if (p.transaction_type === 'expense') return false;
  if (p.transaction_type === 'payment') return true;
  const cid = String(p.customer_id ?? '').trim();
  return cid.length > 0;
}

/** Customer payments only — use for AR FIFO, cash collected, and paid-this-month KPIs. */
export async function getCustomerPayments(): Promise<Payment[]> {
  const all = await getPayments();
  return all.filter(isCustomerPayment);
}
/** Record payment against customer ledger (backend `PaymentCreate`: customer_id, amount, mode, reference, date). */
export const createPayment = (data: any): Promise<any> => {
  const customer_id = parseInt(String(data.customer_id), 10);
  if (Number.isNaN(customer_id)) {
    return Promise.reject(new Error('Invalid customer_id'));
  }
  const body: Record<string, unknown> = {
    customer_id,
    amount: Number(data.amount),
    mode: data.payment_method || 'Cash',
    reference: data.reference ?? data.reference_number ?? null,
    date: data.payment_date ?? null,
  };
  if (data.notes) body.notes = data.notes;
  const depositId = data.deposit_account_id ?? data.account_id;
  if (depositId != null && String(depositId) !== '') {
    body.deposit_account_id = parseInt(String(depositId), 10);
    body.account_id = body.deposit_account_id;
  }
  // FIX #2B — forward per-line allocations to the 2A backend. Each line is
  // { invoice_id | null, amount, discount }; invoice_id === null means the
  // opening-balance / advance line (backend applies_to='opening_balance').
  // The backend derives invoice/PO settlement from these rows — the UI sends
  // them and then re-reads the API; it never computes settlement locally.
  if (Array.isArray(data.allocations) && data.allocations.length > 0) {
    body.allocations = (data.allocations as Array<Record<string, unknown>>).map((a) => ({
      invoice_id:
        a.invoice_id == null || String(a.invoice_id) === ''
          ? null
          : parseInt(String(a.invoice_id), 10),
      amount: Number(a.amount),
      discount: Number(a.discount ?? 0),
    }));
  } else if (data.invoice_id != null && String(data.invoice_id) !== '') {
    const iid = parseInt(String(data.invoice_id), 10);
    if (!Number.isNaN(iid)) body.invoice_id = iid;
  }
  return apiRequest<any>('/ledger/payment', {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

// FIX W6-1 — Void a payment by posting a reversing (negative-amount)
// contra-payment via the same /ledger/payment endpoint. The original
// record stays in place for audit; both rows remain visible in Banking,
// joined by reference: VOID/<originalId>. Customer + invoice balance
// recompute on the backend ledger side.
//
// Standard accounting practice — never delete a posted payment, always
// post a contra-entry. Refuses to void rows that are themselves
// reversals (prevents double-void).
export async function voidPayment(p: {
  id: string;
  customer_id: string;
  amount: number;
  invoice_id?: string | null;
  reason?: string;
}): Promise<any> {
  if (p.amount === 0) {
    throw new Error('Cannot void a zero-amount payment.');
  }
  if (p.amount < 0) {
    throw new Error('This is already a reversal entry — cannot void a void.');
  }
  return createPayment({
    customer_id: p.customer_id,
    amount: -Math.abs(p.amount),
    payment_method: 'Void',
    reference: `VOID/${p.id}`,
    payment_date: new Date().toISOString().slice(0, 10),
    invoice_id: p.invoice_id || undefined,
    notes: `Reversal of payment ${p.id}` + (p.reason ? ` — ${p.reason}` : ''),
    is_advance: !p.invoice_id,
  });
}

// Van APIs
export const getVans = (): Promise<Van[]> => apiRequest<Van[]>('/vans');
export const getVanLocations = (): Promise<VanLocation[]> => apiRequest<VanLocation[]>('/vans/locations');
export const getVan = (id: string): Promise<Van> => apiRequest<Van>(`/vans/${id}`);
export const createVan = (data: Partial<Van>): Promise<Van> => apiRequest<Van>('/vans', { method: 'POST', body: JSON.stringify(data) });
export const updateVan = (id: string, data: Partial<Van>): Promise<Van> => apiRequest<Van>(`/vans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteVan = (id: string): Promise<void> => apiRequest<void>(`/vans/${id}`, { method: 'DELETE' });

function numField(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const n = parseFloat(String(v ?? ''));
  return Number.isNaN(n) ? fallback : n;
}

/** Normalize FastAPI product JSON (id, price, stock, …) to `Product`. */
function normalizeApiProductRow(raw: Record<string, unknown>): Product {
  const id = String(raw.id ?? '');
  const name = raw.name != null ? String(raw.name) : '';
  const sku = raw.sku != null ? String(raw.sku) : '';
  const category = raw.category != null ? String(raw.category) : undefined;
  const unit = raw.unit != null ? String(raw.unit) : undefined;
  const unit_price = numField(raw.unit_price, numField(raw.price));
  const costRaw = raw.cost_price !== undefined ? raw.cost_price : raw.cost;
  const cost_price = costRaw !== undefined ? numField(costRaw) : undefined;
  return {
    id,
    name,
    sku,
    category,
    unit,
    unit_price,
    cost_price,
    current_stock: numField(raw.current_stock, numField(raw.stock)),
    minimum_stock: numField(raw.minimum_stock, numField(raw.min_stock)),
  };
}

// Product APIs
export async function getProducts(): Promise<Product[]> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}/products/`, {
      cache: 'no-store',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json().catch(() => []);
    const list = Array.isArray(raw) ? raw : [];
    return list.map((row) => normalizeApiProductRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getProduct(id: string): Promise<Product> {
  const payload = await apiRequest<unknown>(`/products/${encodeURIComponent(id)}`);
  if (Array.isArray(payload)) {
    const row = (payload as Record<string, unknown>[]).find((p) => String(p.id) === String(id));
    if (!row) throw new Error('Product not found');
    return normalizeApiProductRow(row);
  }
  if (!payload || typeof payload !== 'object') throw new Error('Product not found');
  return normalizeApiProductRow(payload as Record<string, unknown>);
}

/** Map frontend `Product` fields to FastAPI `ProductCreate` / `ProductUpdate` keys. */
function toBackendProductPayload(data: Partial<Product>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.name !== undefined) out.name = data.name;
  if (data.sku !== undefined) out.sku = data.sku;
  if (data.category !== undefined) out.category = data.category;
  if (data.unit !== undefined) out.unit = data.unit;

  const price = data.unit_price ?? (data as { price?: number }).price;
  if (price !== undefined) out.price = numField(price);

  const cost = data.cost_price ?? (data as { cost?: number }).cost;
  if (cost !== undefined) out.cost = numField(cost);

  const stock = data.current_stock ?? (data as { stock?: number }).stock;
  if (stock !== undefined) out.stock = numField(stock);

  const minStock = data.minimum_stock ?? (data as { min_stock?: number }).min_stock;
  if (minStock !== undefined) out.min_stock = numField(minStock);

  return out;
}

export const createProduct = (data: Partial<Product>): Promise<Product> =>
  apiRequest<Product>('/products/', { method: 'POST', body: JSON.stringify(toBackendProductPayload(data)) });
export const updateProduct = (id: string, data: Partial<Product>): Promise<Product> =>
  apiRequest<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(toBackendProductPayload(data)) });

// ============================================
// INVOICE FUNCTIONS
// ============================================

/** POST /api/invoices/ — body matches backend `InvoiceCreate` (camelCase + snake_case payment fields). */
export async function createInvoice(
  invoice: Omit<Invoice, 'id' | 'createdAt'>
): Promise<Invoice> {
  const inv = invoice as Omit<Invoice, 'id' | 'createdAt'> & {
    paymentStatus?: string;
    paymentMethod?: string;
    remainingBalance?: number;
    amount_paid?: number;
  };
  const paymentStatus =
    inv.paymentStatus ?? inv.payment_status ?? 'Unpaid';
  const paymentMethod =
    inv.paymentMethod ?? inv.payment_method ?? 'Cash';
  const grand = Number(invoice.grandTotal) || 0;
  const amountPaid =
    paymentStatus === 'Paid'
      ? grand
      : Number(inv.amount_paid ?? invoice.amount_paid ?? 0) || 0;
  const remainingBalance =
    Number(
      inv.remainingBalance ??
        invoice.remaining_balance ??
        Math.max(0, grand - amountPaid)
    ) || 0;

  const payload = {
    invoiceNumber: invoice.invoiceNumber || `INV-${Date.now()}`,
    customerId: String(invoice.customerId),
    customerName: invoice.customerName || '',
    invoiceDate: invoice.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: invoice.dueDate || null,
    lineItems: (invoice.lineItems || []).map((item: any) => {
      const rawPid = item.productId ?? item.product_id;
      const product_id =
        rawPid != null && String(rawPid).trim() !== '' && Number(rawPid) > 0
          ? Number(rawPid)
          : undefined;
      return {
        product: item.product || item.name || '',
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || 0,
        product_id,
        itemCode: item.itemCode || item.sku || null,
      };
    }),
    subtotal: Number(invoice.subtotal) || 0,
    taxRate: Number(invoice.taxRate) || 0,
    taxAmount: Number(invoice.taxAmount) || 0,
    discount: Number(invoice.discount) || 0,
    grandTotal: grand,
    notes: invoice.notes || '',
    salesman: invoice.salesman || '',
    van: invoice.van || '',
    payment_status: paymentStatus,
    payment_method: paymentMethod,
    amount_paid: amountPaid,
    remaining_balance: remainingBalance,
    status: invoice.status,
  };

  const raw = await apiRequest<any>('/invoices/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    ...invoice,
    id: String(raw.id),
    shareToken: raw.share_token != null ? String(raw.share_token) : invoice.shareToken,
    createdAt: raw.created_at || new Date().toISOString(),
  };
}

/** Public invoice by share token — no auth. */
export async function updateInvoice(id: string, invoice: Partial<Invoice>): Promise<Invoice> {
  const payload = {
    invoiceNumber: invoice.invoiceNumber,
    customerId: String(invoice.customerId),
    customerName: invoice.customerName || '',
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate || null,
    lineItems: (invoice.lineItems || []).map((item: any) => {
      const rawPid = item.productId ?? item.product_id;
      const product_id =
        rawPid != null && String(rawPid).trim() !== '' && Number(rawPid) > 0
          ? Number(rawPid)
          : undefined;
      return {
        product: item.product || '',
        description: item.description || '',
        quantity: Number(item.quantity) || 1,
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || 0,
        product_id,
      };
    }),
    subtotal: Number(invoice.subtotal) || 0,
    taxRate: Number(invoice.taxRate) || 0,
    taxAmount: Number(invoice.taxAmount) || 0,
    discount: Number(invoice.discount) || 0,
    grandTotal: Number(invoice.grandTotal) || 0,
    notes: invoice.notes || '',
    status: invoice.status,
  };
  const raw = await apiRequest<any>(`/invoices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return { ...invoice, id: String(raw.id || id), ...raw } as Invoice;
}

export async function updatePayment(id: string, data: Partial<Payment>): Promise<Payment> {
  const raw = await apiRequest<any>(`/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return raw as Payment;
}

/** Public invoice by share token — no auth; uses configured API base. */
export async function fetchPublicInvoiceByToken(token: string): Promise<PublicInvoicePayload> {
  const url = `${API_BASE_URL}/invoices/view/${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Create or replace share token for an invoice (authenticated). */
export async function regenerateInvoiceShareToken(
  invoiceId: string | number
): Promise<{ share_token: string; share_url: string }> {
  return apiRequest<{ share_token: string; share_url: string }>(
    `/invoices/${invoiceId}/share-token`,
    { method: 'POST' }
  );
}

function sliceDatePart(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function mapApiInvoiceToInvoice(inv: Record<string, unknown>): Invoice {
  const items = inv.items;
  let lineItems: Invoice['lineItems'] = [];
  if (Array.isArray(items)) {
    lineItems = (items as Record<string, unknown>[]).map((it) => ({
      product: String(it.product ?? it.name ?? ''),
      description: String(it.description ?? ''),
      quantity: Number(it.quantity) || 0,
      rate: Number(it.rate) || 0,
      amount: Number(it.amount) || 0,
    }));
  }
  const grandTotal = Number(inv.total ?? inv.total_amount ?? inv.grand_total ?? inv.grandTotal ?? 0);
  const paid = Number(inv.paid_amount ?? inv.amount_paid ?? 0);
  const balanceRaw = inv.balance ?? inv.balance_due ?? inv.remaining_balance;
  const remaining_balance =
    balanceRaw !== undefined && balanceRaw !== null
      ? Number(balanceRaw)
      : Math.max(0, grandTotal - paid);

  const statusRaw = String(inv.status ?? 'Unpaid').toLowerCase();
  const statusNorm: Invoice['status'] =
    statusRaw === 'paid'
      ? 'Paid'
      : statusRaw === 'partial'
        ? 'Partial'
        : statusRaw === 'overdue'
          ? 'Overdue'
          : 'Unpaid';

  const cid = inv.customer_id ?? inv.customerId;
  const cname = inv.customer_name ?? inv.customerName;

  return {
    id: String(inv.id ?? ''),
    customerId: cid != null ? String(cid) : '',
    customerName: cname != null ? String(cname) : '',
    shareToken:
      inv.share_token != null && inv.share_token !== ''
        ? String(inv.share_token)
        : inv.shareToken != null && inv.shareToken !== ''
          ? String(inv.shareToken)
          : undefined,
    invoiceNumber: String(inv.invoice_number ?? inv.invoiceNumber ?? inv.id ?? ''),
    invoiceDate: sliceDatePart(inv.date ?? inv.invoiceDate),
    dueDate: sliceDatePart(inv.due_date ?? inv.dueDate ?? inv.date),
    lineItems,
    subtotal: Number(inv.subtotal ?? 0),
    taxRate: Number(inv.tax_rate ?? inv.taxRate ?? 0),
    taxAmount: Number(inv.tax ?? inv.taxAmount ?? 0),
    discount: Number(inv.discount ?? 0),
    grandTotal,
    notes: String(inv.notes ?? ''),
    salesmanEmployeeId:
      inv.salesman_employee_id != null
        ? Number(inv.salesman_employee_id)
        : inv.salesmanEmployeeId != null
          ? Number(inv.salesmanEmployeeId)
          : null,
    status: statusNorm,
    payment_status:
      remaining_balance <= 0 && grandTotal > 0 ? 'Paid' : paid > 0 ? 'Advance Paid' : 'Unpaid',
    amount_paid: paid,
    remaining_balance,
    createdAt: inv.created_at != null ? String(inv.created_at) : new Date().toISOString(),
    sales_order_id: inv.sales_order_id != null ? (inv.sales_order_id as string | number) : undefined,
    salesOrderId: inv.sales_order_id != null ? String(inv.sales_order_id) : undefined,
  };
}

// Get all invoices (from backend). Throws on auth/network/API errors.
export async function getInvoices(): Promise<Invoice[]> {
  const raw = await apiRequest<unknown>('/invoices/');
  const list = Array.isArray(raw) ? raw : [];
  return list.map((inv) => mapApiInvoiceToInvoice(inv as Record<string, unknown>));
}

// Get invoices for a specific customer
export async function getCustomerInvoices(customerId: string): Promise<Invoice[]> {
  try {
    const allInvoices = await getInvoices();
    return allInvoices.filter(inv => inv.customerId === customerId);
  } catch (error) {
    console.error('Failed to get customer invoices:', error);
    return [];
  }
}

// Get single invoice by ID
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  try {
    const allInvoices = await getInvoices();
    return allInvoices.find(inv => inv.id === id) || null;
  } catch (error) {
    console.error('Failed to get invoice:', error);
    return null;
  }
}

// ============================================
// SALES ORDER FUNCTIONS
// ============================================

function legacySalesOrderFromWorkflow(so: import('./salesService').SalesOrder): SalesOrder {
  const status: SalesOrder['status'] =
    so.status === 'invoiced' ? 'Converted' : so.status === 'cancelled' ? 'Cancelled' : 'Pending';
  return {
    id: so.id,
    orderNumber: so.so_number,
    customerId: so.customer_id,
    customerName: so.customer_name || '',
    orderDate: so.order_date,
    salesman: so.salesman_name || undefined,
    van: so.van_id || undefined,
    status,
    workflowStatus: so.status,
    podConfirmed: so.pod_confirmed,
    signatureConfirmed: so.signature_confirmed,
    lineItems: so.items.map((i) => ({
      product: i.product_name,
      description: i.description || '',
      quantity: i.quantity,
      rate: i.unit_price,
      amount: i.total,
    })),
    subtotal: so.subtotal,
    taxAmount: so.tax,
    discount: 0,
    grandTotal: so.total,
    notes: so.notes,
    createdAt: so.created_at || so.order_date,
  };
}

export async function createSalesOrder(order: Omit<SalesOrder, 'id' | 'createdAt' | 'status'>): Promise<SalesOrder> {
  const { createSalesOrder: createSo } = await import('./salesService');
  const created = await createSo({
    customer_id: order.customerId,
    order_date: order.orderDate,
    items: order.lineItems.map((li) => ({
      product_id: '',
      product_name: li.product,
      quantity: li.quantity,
      unit_price: li.rate,
      total: li.amount,
      description: li.description,
    })) as unknown as Array<Record<string, unknown>>,
    notes: order.notes || '',
    status: 'confirmed',
    salesman_name: order.salesman,
    van_id: order.van || null,
    payment_status: 'unpaid',
    subtotal: order.subtotal,
    tax: order.taxAmount,
    total: order.grandTotal,
  });
  return legacySalesOrderFromWorkflow(created);
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  const { getSalesOrders: fetchSo, hydrateSalesOrdersWithCustomers } = await import('./salesService');
  const rows = await fetchSo();
  const hydrated = await hydrateSalesOrdersWithCustomers(rows);
  return hydrated.map(legacySalesOrderFromWorkflow);
}

export async function getCustomerSalesOrders(customerId: string): Promise<SalesOrder[]> {
  const all = await getSalesOrders();
  return all.filter((o) => o.customerId === String(customerId));
}

export async function convertOrderToInvoice(orderId: string): Promise<Invoice> {
  const { convertSalesOrderToInvoice } = await import('./salesService');
  const updated = await convertSalesOrderToInvoice(orderId);
  if (!updated.linked_invoice_number) {
    throw new Error('Order was not invoiced (check POD and DELIVERED status).');
  }
  const invoices = await getInvoices();
  const inv = invoices.find((i) => i.invoiceNumber === updated.linked_invoice_number);
  if (!inv) {
    await new Promise((r) => setTimeout(r, 400));
    const again = await getInvoices();
    const retry = again.find((i) => i.invoiceNumber === updated.linked_invoice_number);
    if (!retry) throw new Error('Invoice not found after conversion');
    return retry;
  }
  return inv;
}

// ============================================
// PAYMENT FUNCTIONS
// ============================================

export async function getPaymentsForCustomer(customerId: string): Promise<Payment[]> {
  const allPayments = getStorage<Payment>('payments');
  return allPayments.filter(p => p.customer_id === customerId);
}

// Get unpaid or partially paid invoices for a customer
export async function getUnpaidInvoices(customerId: string): Promise<Invoice[]> {
  try {
    const allInvoices = await getInvoices();
    return allInvoices.filter(inv => {
      if (inv.customerId !== customerId) return false;
      // FIX #2B — settlement is the BACKEND's call. `inv.status` and
      // `inv.remaining_balance` come straight from GET /api/invoices/, which
      // the 2A layer derives from PaymentAllocation rows (mapApiInvoiceToInvoice
      // reads inv.status + inv.balance). We DO NOT fall back to grandTotal or
      // recompute anything — a 'Paid' invoice (outstanding 0) is excluded, full
      // stop. No stale local balance can resurrect it.
      if (inv.status === 'Paid') return false;
      return Number(inv.remaining_balance ?? 0) > 0.005;
    });
  } catch (error) {
    console.error('Failed to get unpaid invoices:', error);
    return [];
  }
}

// FIX #2B — updateInvoicePayment removed. It was a `return null` no-op that
// pretended to update invoice settlement client-side. Settlement is now written
// by the 2A backend when /ledger/payment records PaymentAllocation rows; the UI
// re-reads GET /api/invoices/ (allocation-derived status/balance) instead.

// Get customer's advance payment balance
export async function getCustomerAdvanceBalance(customerId: string): Promise<number> {
  try {
    const payments = await getPaymentsForCustomer(customerId);
    const advancePayments = payments.filter(p => p.is_advance && !p.invoice_id);
    return advancePayments.reduce((sum, p) => sum + p.amount, 0);
  } catch (error) {
    console.error('Failed to get advance balance:', error);
    return 0;
  }
}

// Legacy API structure
export const vansAPI = { getAll: getVans, getById: getVan, create: createVan, update: updateVan, delete: deleteVan };
export const customersAPI = { getAll: getCustomers, getById: getCustomer, create: createCustomer, update: updateCustomer, delete: deleteCustomer, getLedger: getCustomerLedger, getOverdue: getOverdueCustomers };
export const productsAPI = { getAll: getProducts, getById: getProduct, create: createProduct, update: updateProduct };

export default { vans: vansAPI, customers: customersAPI, products: productsAPI };
// ── Customer Price Lists ─────────────────────────────────────────────────────

const PRICE_LISTS_API = `${getOilErpApiBase()}/customer-price-lists`;

export interface CustomerPriceList {
    id?: number;
    customerId: string;
    customerName: string;
    notes?: string;
    prices: Array<{
        productId: string;
        productName: string;
        customPrice: number;
        discountPct: number;
    }>;
    updatedAt: string;
}

function mapPriceListFromApi(raw: Record<string, unknown>): CustomerPriceList {
    const pricesRaw = Array.isArray(raw.prices) ? raw.prices : [];
    return {
        id: raw.id != null ? Number(raw.id) : undefined,
        customerId: String(raw.customerId ?? raw.customer_id ?? ''),
        customerName: '',
        notes: raw.notes != null ? String(raw.notes) : undefined,
        prices: pricesRaw.map((row) => {
            const p = row as Record<string, unknown>;
            return {
                productId: String(p.productId ?? p.product_id ?? ''),
                productName: '',
                customPrice: Number(p.customPrice ?? p.custom_price ?? 0) || 0,
                discountPct: Number(p.discountPct ?? p.discount_pct ?? 0) || 0,
            };
        }),
        updatedAt: String(raw.updatedAt ?? raw.updated_at ?? new Date().toISOString()),
    };
}

function priceListToApiBody(list: CustomerPriceList): Record<string, unknown> {
    return {
        customerId: Number(list.customerId),
        notes: list.notes ?? null,
        prices: list.prices.map((p) => ({
            productId: Number(p.productId),
            customPrice: p.customPrice > 0 ? p.customPrice : null,
            discountPct: p.discountPct > 0 ? p.discountPct : null,
        })),
    };
}

export async function getCustomerPriceLists(): Promise<CustomerPriceList[]> {
    const response = await authFetch(`${PRICE_LISTS_API}/`, { cache: 'no-store' });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `Failed to load price lists (${response.status})`);
    }
    const raw = await response.json().catch(() => []);
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map((row) => mapPriceListFromApi(row as Record<string, unknown>));
}

export async function getCustomerPriceListByCustomer(
    customerId: string | number,
): Promise<CustomerPriceList | null> {
    const response = await authFetch(
        `${PRICE_LISTS_API}/by-customer/${encodeURIComponent(String(customerId))}`,
        { cache: 'no-store' },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `Failed to load price list (${response.status})`);
    }
    return mapPriceListFromApi((await response.json()) as Record<string, unknown>);
}

export async function saveCustomerPriceList(list: CustomerPriceList): Promise<CustomerPriceList> {
    const response = await authFetch(`${PRICE_LISTS_API}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(priceListToApiBody(list)),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `Failed to save price list (${response.status})`);
    }
    return mapPriceListFromApi((await response.json()) as Record<string, unknown>);
}

export async function deleteCustomerPriceList(id: number): Promise<void> {
    const response = await authFetch(`${PRICE_LISTS_API}/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `Failed to delete price list (${response.status})`);
    }
}

/** TODO Stage 3: resolve custom price via GET /customer-price-lists/by-customer/{id} at billing time. */
export const getCustomerPrice = (
    customerId: string,
    productId: string,
    defaultPrice: number,
): number => {
    void customerId;
    void productId;
    return defaultPrice;
};

// ── Recurring Invoices ───────────────────────────────────────────────────────

export interface RecurringInvoice {
    id: string;
    customerId: string;
    customerName: string;
    frequency: 'weekly' | 'monthly' | 'quarterly';
    nextRunDate: string;
    lastRunDate?: string;
    lineItems: Array<{ product: string; description: string; quantity: number; rate: number; amount: number }>;
    subtotal: number;
    taxRate: number;
    discount: number;
    grandTotal: number;
    notes: string;
    active: boolean;
    createdAt: string;
}

const RECURRING_KEY = 'recurring_invoices';

export const getRecurringInvoices = (): RecurringInvoice[] => {
    try {
        return JSON.parse(localStorage.getItem(RECURRING_KEY) || '[]');
    } catch { return []; }
};

export const saveRecurringInvoice = (inv: RecurringInvoice): void => {
    const list = getRecurringInvoices();
    const idx = list.findIndex(r => r.id === inv.id);
    if (idx >= 0) list[idx] = inv;
    else list.push(inv);
    localStorage.setItem(RECURRING_KEY, JSON.stringify(list));
};

export const deleteRecurringInvoice = (id: string): void => {
    const list = getRecurringInvoices().filter(r => r.id !== id);
    localStorage.setItem(RECURRING_KEY, JSON.stringify(list));
};

export const runDueRecurringInvoices = async (): Promise<number> => {
    const list = getRecurringInvoices();
    const today = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const rec of list) {
        if (!rec.active || rec.nextRunDate > today) continue;
        try {
            await createInvoice({
                invoiceNumber: '',
                customerId: rec.customerId,
                customerName: rec.customerName,
                invoiceDate: today,
                dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                lineItems: rec.lineItems,
                subtotal: rec.subtotal,
                taxRate: rec.taxRate,
                taxAmount: rec.subtotal * rec.taxRate / 100,
                discount: rec.discount,
                grandTotal: rec.grandTotal,
                notes: rec.notes || `Recurring invoice — ${rec.frequency}`,
                status: 'Unpaid',
            });
            // Advance next run date
            const next = new Date(rec.nextRunDate);
            if (rec.frequency === 'weekly') next.setDate(next.getDate() + 7);
            else if (rec.frequency === 'monthly') next.setMonth(next.getMonth() + 1);
            else next.setMonth(next.getMonth() + 3);
            rec.nextRunDate = next.toISOString().slice(0, 10);
            rec.lastRunDate = today;
            saveRecurringInvoice(rec);
            count++;
        } catch (e) {
            console.error('Failed to run recurring invoice:', rec.id, e);
        }
    }
    return count;
};

export type MarketingPlatform =
  | 'linkedin' | 'instagram' | 'tiktok' | 'facebook'
  | 'x' | 'youtube' | 'google' | 'email';

// Only draft, approved and archived are settable through the API; scheduled and posted are Phase 2 and read-only.
export type MarketingStatus =
  | 'draft' | 'approved' | 'archived' | 'scheduled' | 'posted';

export interface MarketingPost {
  id: number;
  title: string;
  body: string;
  platform: MarketingPlatform;
  status: MarketingStatus;
  generation_id: string | null;
  source_context: { products?: string[]; customer_count?: number } | null;
  model_used: string | null;
  scheduled_for: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export const generateMarketingPosts = (params: {
  platforms: MarketingPlatform[];
  campaign_type: string;
  brand_voice?: string;
  target_audience?: string;
}): Promise<MarketingPost[]> =>
  apiRequest<MarketingPost[]>('/marketing/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const listMarketingPosts = (params?: {
  status?: MarketingStatus;
  platform?: MarketingPlatform;
  generation_id?: string;
  limit?: number;
  offset?: number;
}): Promise<MarketingPost[]> => {
  const qs = new URLSearchParams();
  if (params) {
    const entries: [string, string | number | undefined][] = [
      ['status', params.status],
      ['platform', params.platform],
      ['generation_id', params.generation_id],
      ['limit', params.limit],
      ['offset', params.offset],
    ];
    for (const [key, value] of entries) {
      if (value === undefined || value === '') continue;
      qs.set(key, String(value));
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<MarketingPost[]>(`/marketing/posts${suffix}`);
};

export const getMarketingPost = (id: number): Promise<MarketingPost> =>
  apiRequest<MarketingPost>(`/marketing/posts/${id}`);

export const createMarketingPost = (params: {
  title: string;
  body?: string;
  platform: MarketingPlatform;
  generation_id?: string;
}): Promise<MarketingPost> =>
  apiRequest<MarketingPost>('/marketing/posts', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const updateMarketingPost = (
  id: number,
  params: {
    title?: string;
    body?: string;
    status?: 'draft' | 'approved' | 'archived';
  },
): Promise<MarketingPost> =>
  apiRequest<MarketingPost>(`/marketing/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });

export const deleteMarketingPost = (id: number): Promise<void> =>
  apiRequest<void>(`/marketing/posts/${id}`, { method: 'DELETE' });
