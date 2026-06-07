import { API_BASE_URL } from './api';
import { ACCESS_TOKEN_KEY } from '../api/axios';
const USE_MOCK = false;
const STORAGE_KEY = 'vans';

export interface Van {
    id: string;
    van_number: string;
    driver_name: string;
    driver_phone?: string;
    vehicle_number?: string;
    capacity_liters?: number;
    status: 'active' | 'inactive' | 'maintenance';
}

// Mock data helper
const getMockVans = (): Van[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);

    // Default mock vans
    const mockVans: Van[] = [
        { id: '1', van_number: 'Van 1', driver_name: 'Ahmed Khan', driver_phone: '+973-1234-5678', vehicle_number: 'BH-12345', capacity_liters: 5000, status: 'active' },
        { id: '2', van_number: 'Van 2', driver_name: 'Mohammed Ali', driver_phone: '+973-2345-6789', vehicle_number: 'BH-23456', capacity_liters: 5000, status: 'active' },
        { id: '3', van_number: 'Van 3', driver_name: 'Hassan Ahmed', driver_phone: '+973-3456-7890', vehicle_number: 'BH-34567', capacity_liters: 5000, status: 'active' },
        { id: '4', van_number: 'Van 4', driver_name: 'Ali Hassan', driver_phone: '+973-4567-8901', vehicle_number: 'BH-45678', capacity_liters: 5000, status: 'active' },
        { id: '5', van_number: 'Van 5', driver_name: 'Omar Khalid', driver_phone: '+973-5678-9012', vehicle_number: 'BH-56789', capacity_liters: 5000, status: 'active' },
        { id: '6', van_number: 'Van 6', driver_name: 'Khalid Omar', driver_phone: '+973-6789-0123', vehicle_number: 'BH-67890', capacity_liters: 5000, status: 'active' },
        { id: '7', van_number: 'Van 7', driver_name: 'Youssef Ibrahim', driver_phone: '+973-7890-1234', vehicle_number: 'BH-78901', capacity_liters: 5000, status: 'active' },
        { id: '8', van_number: 'Van 8', driver_name: 'Ibrahim Youssef', driver_phone: '+973-8901-2345', vehicle_number: 'BH-89012', capacity_liters: 5000, status: 'active' },
        { id: '9', van_number: 'Van 9', driver_name: 'Tariq Mansoor', driver_phone: '+973-9012-3456', vehicle_number: 'BH-90123', capacity_liters: 5000, status: 'active' },
        { id: '10', van_number: 'Van 10', driver_name: 'Mansoor Tariq', driver_phone: '+973-0123-4567', vehicle_number: 'BH-01234', capacity_liters: 5000, status: 'active' }
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockVans));
    return mockVans;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (USE_MOCK) {
        await delay(300);

        // GET all vans
        if ((endpoint === '/vans' || endpoint === '/vans/') && !options.method) {
            return getMockVans() as T;
        }

        // GET single van
        if (endpoint.startsWith('/vans/') && !options.method) {
            const id = endpoint.split('/')[2];
            const vans = getMockVans();
            const van = vans.find(v => v.id === id);
            if (!van) throw new Error('Van not found');
            return van as T;
        }

        // POST - Create new van
        if ((endpoint === '/vans' || endpoint === '/vans/') && options.method === 'POST') {
            const vans = getMockVans();
            const newVan: Van = {
                ...JSON.parse(options.body as string),
                id: `${Date.now()}`
            };
            vans.push(newVan);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(vans));
            return newVan as T;
        }

        // PUT - Update van
        if (endpoint.startsWith('/vans/') && options.method === 'PUT') {
            const id = endpoint.split('/')[2];
            const vans = getMockVans();
            const index = vans.findIndex(v => v.id === id);
            if (index === -1) throw new Error('Van not found');

            vans[index] = { ...vans[index], ...JSON.parse(options.body as string) };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(vans));
            return vans[index] as T;
        }

        // DELETE - Delete van
        if (endpoint.startsWith('/vans/') && options.method === 'DELETE') {
            const id = endpoint.split('/')[2];
            const vans = getMockVans();
            const filtered = vans.filter(v => v.id !== id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
            return undefined as T;
        }

        throw new Error('Mock endpoint not implemented');
    }

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

    try {
        const response = await fetch(url, config);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    } catch (error) {
        console.warn('API unavailable, falling back to mock data');
        // Fallback to mock if API fails
        if (endpoint === '/vans' || endpoint === '/vans/') {
            return getMockVans() as T;
        }
        throw error;
    }
}

export const getVans = (): Promise<Van[]> => apiRequest<Van[]>('/vans');
export const getVan = (id: string): Promise<Van> => apiRequest<Van>(`/vans/${id}`);
export const createVan = (data: Partial<Van>): Promise<Van> => apiRequest<Van>('/vans/', { method: 'POST', body: JSON.stringify(data) });
export const updateVan = (id: string, data: Partial<Van>): Promise<Van> => apiRequest<Van>(`/vans/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteVan = (id: string): Promise<void> => apiRequest<void>(`/vans/${id}`, { method: 'DELETE' });

export const vanService = {
    getAll: getVans,
    getById: getVan,
    create: createVan,
    update: updateVan,
    delete: deleteVan
};
