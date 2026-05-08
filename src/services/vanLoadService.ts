import { API_BASE_URL } from './api';
const USE_MOCK = false;

export interface VanLoad {
    id: string;
    van_id: string;
    load_date: string;
    status: 'pending' | 'loaded' | 'dispatched' | 'completed';
    items: VanLoadItem[];
}

export interface VanLoadItem {
    product_id: string;
    quantity: number;
}

// Mock Helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

async function mockHandler<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await delay(400);
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body as string) : null;

    if (endpoint.startsWith('/van-loads')) {
        const loads = getStorage<VanLoad>('van_loads');
        if (method === 'POST') {
            const newLoad = {
                ...body,
                id: crypto.randomUUID(),
                status: body.status || 'pending'
            };
            setStorage('van_loads', [newLoad, ...loads]);
            return newLoad as any;
        }
        return loads as any;
    }
    return [] as any;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (USE_MOCK) {
        return mockHandler<T>(endpoint, options);
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
    };
    try {
        const response = await fetch(url, config);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn('Backend unavailable, falling back to mock');
        return mockHandler<T>(endpoint, options);
    }
}

export const getVanLoads = (): Promise<VanLoad[]> => apiRequest<VanLoad[]>('/van-loads');
export const createVanLoad = (data: any): Promise<VanLoad> => apiRequest<VanLoad>('/van-loads', { method: 'POST', body: JSON.stringify(data) });

export const vanLoadService = {
    getAll: getVanLoads,
    create: createVanLoad
};
