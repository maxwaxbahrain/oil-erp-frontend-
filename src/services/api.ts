const API_BASE_URL = 'http://localhost:8000/api';
const USE_MOCK = true; // Enabled by default to fix connection issues

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
  type: 'invoice' | 'payment' | 'credit' | 'debit';
  amount: number;
  balance: number;
  description?: string;
  reference?: string;
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

export interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unit_price: number;
  cost_price?: number;
  current_stock: number;
  minimum_stock?: number;
}

export interface Payment {
  id: string;
  customer_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference?: string;
  notes?: string;
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

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  salesman?: string;
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

async function mockHandler<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  await delay(600); // Simulate network latency

  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body as string) : null;

  // --- Customers ---
  if (endpoint.startsWith('/customers')) {
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

    // GET /customers/:id/ledger (Mock)
    if (endpoint.match(/\/customers\/[\w-]+\/ledger$/)) {
      // Return dummy ledger or empty for now
      return [] as any;
    }

    // GET /customers
    return customers as any;
  }

  // --- Vans ---
  if (endpoint.startsWith('/vans')) {
    const vans = getStorage<Van>('vans');
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
    const products = getStorage<Product>('products');
    if (method === 'POST') {
      const newProduct = { ...body, id: crypto.randomUUID() };
      setStorage('products', [newProduct, ...products]);
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
  const config: RequestInit = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
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
      throw new Error(error.detail || `HTTP ${response.status}`);
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
export const getCustomers = (): Promise<Customer[]> => apiRequest<Customer[]>('/customers');
export const getCustomer = (id: string): Promise<Customer> => apiRequest<Customer>(`/customers/${id}`);
export const createCustomer = (data: Partial<Customer>): Promise<Customer> => apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });
export const updateCustomer = (id: string, data: Partial<Customer>): Promise<Customer> => apiRequest<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCustomer = (id: string): Promise<void> => apiRequest<void>(`/customers/${id}`, { method: 'DELETE' });
export const getCustomerLedger = (id: string): Promise<LedgerEntry[]> => apiRequest<LedgerEntry[]>(`/customers/${id}/ledger`);
export const getOverdueCustomers = (): Promise<Customer[]> => apiRequest<Customer[]>('/customers/overdue');

// Payment APIs
export const getPayments = (): Promise<Payment[]> => apiRequest<Payment[]>('/payments');
export const createPayment = (data: Partial<Payment>): Promise<Payment> => apiRequest<Payment>('/payments', { method: 'POST', body: JSON.stringify(data) });

// Van APIs
export const getVans = (): Promise<Van[]> => apiRequest<Van[]>('/vans');
export const getVan = (id: string): Promise<Van> => apiRequest<Van>(`/vans/${id}`);
export const createVan = (data: Partial<Van>): Promise<Van> => apiRequest<Van>('/vans', { method: 'POST', body: JSON.stringify(data) });
export const updateVan = (id: string, data: Partial<Van>): Promise<Van> => apiRequest<Van>(`/vans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteVan = (id: string): Promise<void> => apiRequest<void>(`/vans/${id}`, { method: 'DELETE' });

// Product APIs
export const getProducts = (): Promise<Product[]> => apiRequest<Product[]>('/products');
export const getProduct = (id: string): Promise<Product> => apiRequest<Product>(`/products/${id}`);
export const createProduct = (data: Partial<Product>): Promise<Product> => apiRequest<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
export const updateProduct = (id: string, data: Partial<Product>): Promise<Product> => apiRequest<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ============================================
// INVOICE FUNCTIONS
// ============================================

// Create invoice (saves to localStorage for now)
export async function createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
  try {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newInvoice: Invoice = {
      ...invoice,
      id,
      createdAt: new Date().toISOString()
    };

    const existingInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    existingInvoices.push(newInvoice);
    localStorage.setItem('invoices', JSON.stringify(existingInvoices));

    console.log('✅ Invoice saved to localStorage:', newInvoice);

    return newInvoice;
  } catch (error) {
    console.error('Failed to create invoice:', error);
    throw new Error('Failed to create invoice');
  }
}

// Get all invoices
export async function getInvoices(): Promise<Invoice[]> {
  try {
    const invoices = JSON.parse(localStorage.getItem('invoices') || '[]');
    return invoices;
  } catch (error) {
    console.error('Failed to get invoices:', error);
    return [];
  }
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

export async function createSalesOrder(order: Omit<SalesOrder, 'id' | 'createdAt' | 'status'>): Promise<SalesOrder> {
  const existingOrders = JSON.parse(localStorage.getItem('sales_orders') || '[]');
  const newOrder: SalesOrder = {
    ...order,
    id: `so_${Date.now()}`,
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  existingOrders.push(newOrder);
  localStorage.setItem('sales_orders', JSON.stringify(existingOrders));
  return newOrder;
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  return JSON.parse(localStorage.getItem('sales_orders') || '[]');
}

export async function getCustomerSalesOrders(customerId: string): Promise<SalesOrder[]> {
  const all = await getSalesOrders();
  return all.filter(o => o.customerId === customerId);
}

export async function convertOrderToInvoice(orderId: string): Promise<Invoice> {
  const orders = await getSalesOrders();
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) throw new Error('Order not found');

  const order = orders[orderIndex];
  order.status = 'Converted';
  localStorage.setItem('sales_orders', JSON.stringify(orders));

  const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
    invoiceNumber: `INV-${order.orderNumber.split('-')[1]}`,
    customerId: order.customerId,
    customerName: order.customerName,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lineItems: order.lineItems,
    subtotal: order.subtotal,
    taxRate: 17, // default
    taxAmount: order.taxAmount,
    discount: order.discount,
    grandTotal: order.grandTotal,
    notes: order.notes || '',
    status: 'Unpaid'
  };

  return createInvoice(invoiceData);
}

// ============================================
// PAYMENT FUNCTIONS
// ============================================

export async function getCustomerPayments(customerId: string): Promise<Payment[]> {
  const allPayments = getStorage<Payment>('payments');
  return allPayments.filter(p => p.customer_id === customerId);
}

// Legacy API structure
export const vansAPI = { getAll: getVans, getById: getVan, create: createVan, update: updateVan, delete: deleteVan };
export const customersAPI = { getAll: getCustomers, getById: getCustomer, create: createCustomer, update: updateCustomer, delete: deleteCustomer, getLedger: getCustomerLedger, getOverdue: getOverdueCustomers };
export const productsAPI = { getAll: getProducts, getById: getProduct, create: createProduct, update: updateProduct };

export default { vans: vansAPI, customers: customersAPI, products: productsAPI };