import { API_BASE_URL } from './api';
import { ACCESS_TOKEN_KEY } from '../api/axios';

export interface Van {
    id: string;
    van_number: string;
    driver_name: string;
    driver_phone?: string;
    vehicle_number?: string;
    capacity_liters?: number;
    status: 'active' | 'inactive' | 'maintenance';
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const config: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers as Record<string, string> | undefined),
        },
        ...options,
    };

    const response = await fetch(url, config);
    if (!response.ok) {
        let detail = '';
        try {
            const error = await response.json();
            if (error?.detail) {
                detail = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
            }
        } catch {
            /* ignore malformed error payloads */
        }
        throw new Error(detail || `Van request failed (${response.status})`);
    }
    return response.json();
}

export const getVans = (): Promise<Van[]> => apiRequest<Van[]>('/vans');
export const getVan = (id: string): Promise<Van> => apiRequest<Van>(`/vans/${id}`);
export const createVan = (data: Partial<Van>): Promise<Van> => apiRequest<Van>('/vans', { method: 'POST', body: JSON.stringify(data) });
export const updateVan = (id: string, data: Partial<Van>): Promise<Van> => apiRequest<Van>(`/vans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteVan = (id: string): Promise<void> => apiRequest<void>(`/vans/${id}`, { method: 'DELETE' });

export const vanService = {
    getAll: getVans,
    getById: getVan,
    create: createVan,
    update: updateVan,
    delete: deleteVan
};
