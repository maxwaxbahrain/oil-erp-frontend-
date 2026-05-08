import { API_BASE_URL } from './api';

export interface DeliveryNote {
    id: string;
    sales_order_id: string;
    delivery_date: string;
    delivered_by: string;
    status: 'pending' | 'delivered' | 'failed';
    notes?: string;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    };
    const response = await fetch(url, config);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

export const getDeliveries = (): Promise<DeliveryNote[]> => apiRequest<DeliveryNote[]>('/delivery-notes');
export const createDelivery = (data: any): Promise<DeliveryNote> => apiRequest<DeliveryNote>('/delivery-notes', { method: 'POST', body: JSON.stringify(data) });

export const deliveryService = {
    getAll: getDeliveries,
    create: createDelivery
};
