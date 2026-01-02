const API_BASE_URL = 'http://localhost:8000/api';

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
    const config: RequestInit = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    };
    const response = await fetch(url, config);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
