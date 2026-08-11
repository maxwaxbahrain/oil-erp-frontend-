import { API_BASE_URL } from './api';
import { ACCESS_TOKEN_KEY } from '../api/axios';

const USE_MOCK = false;

export interface VanLoad {
    id: string;
    van_id: string;
    load_date: string;
    status: string;
    items: VanLoadItem[];
    total_value?: number;
    is_additional?: boolean;
    approved_by?: string | null;
}

export interface VanLoadItem {
    product_id: string;
    quantity: number;
}

export interface VanLoadConflictDetail {
    message: string;
    existing_load_id: string;
    status: string;
    load_date: string;
}

export class VanLoadApiError extends Error {
    status: number;
    detail?: unknown;

    constructor(status: number, message: string, detail?: unknown) {
        super(message);
        this.name = 'VanLoadApiError';
        this.status = status;
        this.detail = detail;
    }
}

export interface CreateVanLoadPayload {
    van_id: string;
    load_date: string;
    items: Array<{ product_id: string; quantity: number }>;
    total_value: number;
    status?: string;
    additional_load?: boolean;
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
                status: body.status || 'pending',
            };
            setStorage('van_loads', [newLoad, ...loads]);
            return newLoad as T;
        }
        return loads as T;
    }
    return [] as T;
}

function isWriteMethod(method: string | undefined): boolean {
    const m = (method || 'GET').toUpperCase();
    return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

async function parseErrorDetail(response: Response): Promise<unknown> {
    try {
        const body = await response.json();
        return body?.detail ?? body;
    } catch {
        try {
            return await response.text();
        } catch {
            return undefined;
        }
    }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (USE_MOCK) {
        return mockHandler<T>(endpoint, options);
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

    const writeOp = isWriteMethod(config.method);

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const detail = await parseErrorDetail(response);
            const message =
                typeof detail === 'object' && detail !== null && 'message' in detail
                    ? String((detail as VanLoadConflictDetail).message)
                    : `HTTP ${response.status}`;
            throw new VanLoadApiError(response.status, message, detail);
        }
        return await response.json();
    } catch (error) {
        if (writeOp || error instanceof VanLoadApiError) {
            throw error;
        }
        console.warn('Backend unavailable, falling back to mock');
        return mockHandler<T>(endpoint, options);
    }
}

export const getVanLoads = (): Promise<VanLoad[]> => apiRequest<VanLoad[]>('/van-loads');

export const getVanLoadsToday = (): Promise<VanLoad[]> =>
    apiRequest<VanLoad[]>('/van-loads/today');

export const createVanLoad = (data: CreateVanLoadPayload): Promise<VanLoad> =>
    apiRequest<VanLoad>('/van-loads', { method: 'POST', body: JSON.stringify(data) });

export const approveVanLoad = (loadId: string, approvedBy: string): Promise<unknown> => {
    const params = new URLSearchParams({ approved_by: approvedBy });
    return apiRequest(`/van-loads/${encodeURIComponent(loadId)}/approve?${params.toString()}`, {
        method: 'PUT',
    });
};

export const vanLoadService = {
    getAll: getVanLoads,
    getToday: getVanLoadsToday,
    create: createVanLoad,
    approve: approveVanLoad,
};
