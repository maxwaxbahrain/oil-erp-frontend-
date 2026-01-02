import { type Customer } from './api';

export interface SalesOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface SalesOrder {
  id: string;
  customer_id: string;
  customer?: Customer; // Optional expanded customer details
  van_id: string;
  order_date: string;
  items: SalesOrderItem[];
  total_amount: number;
  status: 'pending' | 'approved' | 'confirmed' | 'delivered' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'partial';
}

const API_BASE_URL = 'http://localhost:8000/api';
const USE_MOCK = true;

// Mock Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export async function createSalesOrder(order: Omit<SalesOrder, 'id'>): Promise<SalesOrder> {
  if (USE_MOCK) {
    await delay(500);
    const orders = getStorage<SalesOrder>('sales_orders');
    const newOrder = {
      ...order,
      id: crypto.randomUUID(),
      status: order.status || 'pending',
      payment_status: order.payment_status || 'unpaid'
    } as SalesOrder;
    setStorage('sales_orders', [newOrder, ...orders]);
    return newOrder;
  }

  const response = await fetch(`${API_BASE_URL}/sales-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  if (!response.ok) throw new Error('Failed to create sales order');
  return response.json();
}

export async function getSalesOrders(): Promise<SalesOrder[]> {
  if (USE_MOCK) {
    await delay(500);
    const orders = getStorage<SalesOrder>('sales_orders');
    // Hydrate customer names if possible (optional for now, but helpful)
    const customers = getStorage<Customer>('customers');
    return orders.map(o => ({
      ...o,
      customer: customers.find(c => c.id === o.customer_id)
    }));
  }

  const response = await fetch(`${API_BASE_URL}/sales-orders`);
  if (!response.ok) throw new Error('Failed to fetch sales orders');
  return response.json();
}

export async function getSalesOrder(id: string): Promise<SalesOrder> {
  if (USE_MOCK) {
    await delay(300);
    const orders = getStorage<SalesOrder>('sales_orders');
    const order = orders.find(o => o.id === id);
    if (!order) throw new Error('Sales order not found');
    const customers = getStorage<Customer>('customers');
    return {
      ...order,
      customer: customers.find(c => c.id === order.customer_id)
    };
  }

  const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`);
  if (!response.ok) throw new Error('Failed to fetch sales order');
  return response.json();
}
