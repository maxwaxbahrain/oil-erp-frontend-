// ============================================
// POD (Proof of Delivery) SERVICE - MVP
// Simple, fast delivery tracking for 5 vans
// ============================================

const STORAGE_KEY_DELIVERIES = 'pod_deliveries';
const STORAGE_KEY_VANS = 'pod_vans';
const STORAGE_KEY_SESSIONS = 'pod_driver_sessions';

// ============================================
// INTERFACES
// ============================================

export interface Van {
    id: string;                     // "VAN-1" to "VAN-5"
    name: string;                   // "Van 1", "Van 2", etc.
    color: string;                  // "#0077C8", "#DC3545", etc.
    colorName: string;              // "Blue", "Red", etc.
    currentDriverId?: string;
    currentDriverName?: string;
    currentLocation?: {
        latitude: number;
        longitude: number;
        lastUpdated: string;
    };
    status: 'Active' | 'Inactive';
    completedToday: number;
    pendingToday: number;
}

export interface Delivery {
    id: string;
    deliveryNumber: string;         // "DEL-XXXXXX"
    vanId: string;                  // "VAN-1" to "VAN-5"
    vanColor: string;
    driverId: string;
    driverName: string;
    customerId: string;
    customerName: string;
    deliveryAddress: string;
    packageCount: number;
    orderNumber?: string;
    status: 'Pending' | 'In Transit' | 'Delivered' | 'Failed' | 'Refused' | 'Not Home';
    scheduledDate: string;
    deliveryDate?: string;
    deliveryTime?: string;
    photos: string[];               // Base64 images
    signature?: string;             // Base64 signature
    recipientName?: string;
    deliveryNotes?: string;
    failureReason?: string;
    gpsLocation?: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface DriverSession {
    id: string;
    driverId: string;
    driverName: string;
    vanId: string;
    loginTime: string;
    logoutTime?: string;
    status: 'active' | 'break' | 'ended';
    deliveriesCompleted: number;
    deliveriesFailed: number;
}

// ============================================
// CONSTANTS
// ============================================

export const VAN_COLORS = {
    'VAN-1': { color: '#0077C8', name: 'Blue' },
    'VAN-2': { color: '#DC3545', name: 'Red' },
    'VAN-3': { color: '#45B854', name: 'Green' },
    'VAN-4': { color: '#FD7E14', name: 'Orange' },
    'VAN-5': { color: '#6F42C1', name: 'Purple' }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getStorage = <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

const setStorage = <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
};

function generateDeliveryNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DEL-${timestamp.toString().slice(-6)}${random}`;
}

// ============================================
// VAN MANAGEMENT
// ============================================

export async function initializeVans(): Promise<Van[]> {
    await delay(200);

    let vans = getStorage<Van>(STORAGE_KEY_VANS);

    if (vans.length === 0) {
        // Initialize 5 vans
        vans = [
            {
                id: 'VAN-1',
                name: 'Van 1',
                color: VAN_COLORS['VAN-1'].color,
                colorName: VAN_COLORS['VAN-1'].name,
                status: 'Active',
                completedToday: 0,
                pendingToday: 0
            },
            {
                id: 'VAN-2',
                name: 'Van 2',
                color: VAN_COLORS['VAN-2'].color,
                colorName: VAN_COLORS['VAN-2'].name,
                status: 'Active',
                completedToday: 0,
                pendingToday: 0
            },
            {
                id: 'VAN-3',
                name: 'Van 3',
                color: VAN_COLORS['VAN-3'].color,
                colorName: VAN_COLORS['VAN-3'].name,
                status: 'Active',
                completedToday: 0,
                pendingToday: 0
            },
            {
                id: 'VAN-4',
                name: 'Van 4',
                color: VAN_COLORS['VAN-4'].color,
                colorName: VAN_COLORS['VAN-4'].name,
                status: 'Active',
                completedToday: 0,
                pendingToday: 0
            },
            {
                id: 'VAN-5',
                name: 'Van 5',
                color: VAN_COLORS['VAN-5'].color,
                colorName: VAN_COLORS['VAN-5'].name,
                status: 'Active',
                completedToday: 0,
                pendingToday: 0
            }
        ];

        setStorage(STORAGE_KEY_VANS, vans);
    }

    return vans;
}

export async function getVans(): Promise<Van[]> {
    await delay(200);
    return getStorage<Van>(STORAGE_KEY_VANS);
}

export async function getVan(vanId: string): Promise<Van | null> {
    await delay(100);
    const vans = getStorage<Van>(STORAGE_KEY_VANS);
    return vans.find(v => v.id === vanId) || null;
}

export async function updateVanLocation(vanId: string, latitude: number, longitude: number): Promise<void> {
    await delay(100);
    const vans = getStorage<Van>(STORAGE_KEY_VANS);
    const vanIndex = vans.findIndex(v => v.id === vanId);

    if (vanIndex !== -1) {
        vans[vanIndex].currentLocation = {
            latitude,
            longitude,
            lastUpdated: new Date().toISOString()
        };
        setStorage(STORAGE_KEY_VANS, vans);
    }
}

// ============================================
// DRIVER SESSION MANAGEMENT
// ============================================

export async function startDriverSession(driverId: string, driverName: string, vanId: string): Promise<DriverSession> {
    await delay(300);

    const session: DriverSession = {
        id: crypto.randomUUID(),
        driverId,
        driverName,
        vanId,
        loginTime: new Date().toISOString(),
        status: 'active',
        deliveriesCompleted: 0,
        deliveriesFailed: 0
    };

    const sessions = getStorage<DriverSession>(STORAGE_KEY_SESSIONS);
    setStorage(STORAGE_KEY_SESSIONS, [session, ...sessions]);

    // Update van with current driver
    const vans = getStorage<Van>(STORAGE_KEY_VANS);
    const vanIndex = vans.findIndex(v => v.id === vanId);
    if (vanIndex !== -1) {
        vans[vanIndex].currentDriverId = driverId;
        vans[vanIndex].currentDriverName = driverName;
        setStorage(STORAGE_KEY_VANS, vans);
    }

    return session;
}

export async function endDriverSession(sessionId: string): Promise<void> {
    await delay(200);

    const sessions = getStorage<DriverSession>(STORAGE_KEY_SESSIONS);
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);

    if (sessionIndex !== -1) {
        sessions[sessionIndex].status = 'ended';
        sessions[sessionIndex].logoutTime = new Date().toISOString();
        setStorage(STORAGE_KEY_SESSIONS, sessions);

        // Clear driver from van
        const vanId = sessions[sessionIndex].vanId;
        const vans = getStorage<Van>(STORAGE_KEY_VANS);
        const vanIndex = vans.findIndex(v => v.id === vanId);
        if (vanIndex !== -1) {
            delete vans[vanIndex].currentDriverId;
            delete vans[vanIndex].currentDriverName;
            setStorage(STORAGE_KEY_VANS, vans);
        }
    }
}

export async function getActiveSession(driverId: string): Promise<DriverSession | null> {
    await delay(100);
    const sessions = getStorage<DriverSession>(STORAGE_KEY_SESSIONS);
    return sessions.find(s => s.driverId === driverId && s.status === 'active') || null;
}

// ============================================
// DELIVERY MANAGEMENT
// ============================================

export async function getDeliveries(): Promise<Delivery[]> {
    await delay(300);
    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    return deliveries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getDeliveriesByVan(vanId: string): Promise<Delivery[]> {
    await delay(200);
    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    return deliveries.filter(d => d.vanId === vanId);
}

export async function getDeliveriesByDriver(driverId: string): Promise<Delivery[]> {
    await delay(200);
    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    const today = new Date().toISOString().split('T')[0];
    return deliveries.filter(d =>
        d.driverId === driverId &&
        d.scheduledDate === today
    );
}

export async function getDelivery(id: string): Promise<Delivery | null> {
    await delay(100);
    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    return deliveries.find(d => d.id === id) || null;
}

export async function createDelivery(data: Omit<Delivery, 'id' | 'deliveryNumber' | 'createdAt' | 'updatedAt'>): Promise<Delivery> {
    await delay(400);

    const delivery: Delivery = {
        ...data,
        id: crypto.randomUUID(),
        deliveryNumber: generateDeliveryNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    setStorage(STORAGE_KEY_DELIVERIES, [delivery, ...deliveries]);

    // Update van pending count
    const vans = getStorage<Van>(STORAGE_KEY_VANS);
    const vanIndex = vans.findIndex(v => v.id === data.vanId);
    if (vanIndex !== -1) {
        vans[vanIndex].pendingToday += 1;
        setStorage(STORAGE_KEY_VANS, vans);
    }

    return delivery;
}

export async function updateDelivery(id: string, updates: Partial<Delivery>): Promise<Delivery> {
    await delay(300);

    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    const deliveryIndex = deliveries.findIndex(d => d.id === id);

    if (deliveryIndex === -1) {
        throw new Error('Delivery not found');
    }

    const oldStatus = deliveries[deliveryIndex].status;
    const newStatus = updates.status;

    deliveries[deliveryIndex] = {
        ...deliveries[deliveryIndex],
        ...updates,
        updatedAt: new Date().toISOString()
    };

    setStorage(STORAGE_KEY_DELIVERIES, deliveries);

    // Update van counts if status changed
    if (oldStatus !== newStatus) {
        const vans = getStorage<Van>(STORAGE_KEY_VANS);
        const vanIndex = vans.findIndex(v => v.id === deliveries[deliveryIndex].vanId);

        if (vanIndex !== -1) {
            if (oldStatus === 'Pending') {
                vans[vanIndex].pendingToday -= 1;
            }
            if (newStatus === 'Delivered') {
                vans[vanIndex].completedToday += 1;
            }
            setStorage(STORAGE_KEY_VANS, vans);
        }
    }

    return deliveries[deliveryIndex];
}

export async function completeDelivery(
    id: string,
    photos: string[],
    signature: string,
    recipientName: string,
    notes: string,
    gpsLocation?: { latitude: number; longitude: number; accuracy: number }
): Promise<Delivery> {
    await delay(500);

    return updateDelivery(id, {
        status: 'Delivered',
        photos,
        signature,
        recipientName,
        deliveryNotes: notes,
        gpsLocation,
        deliveryDate: new Date().toISOString().split('T')[0],
        deliveryTime: new Date().toLocaleTimeString()
    });
}

export async function failDelivery(
    id: string,
    status: 'Failed' | 'Refused' | 'Not Home',
    reason: string,
    photos: string[],
    gpsLocation?: { latitude: number; longitude: number; accuracy: number }
): Promise<Delivery> {
    await delay(400);

    return updateDelivery(id, {
        status,
        failureReason: reason,
        photos,
        gpsLocation,
        deliveryDate: new Date().toISOString().split('T')[0],
        deliveryTime: new Date().toLocaleTimeString()
    });
}

// ============================================
// STATISTICS
// ============================================

export interface PODStats {
    totalDeliveries: number;
    completed: number;
    pending: number;
    inTransit: number;
    failed: number;
    successRate: number;
    activeVans: number;
}

export async function getPODStats(): Promise<PODStats> {
    await delay(300);

    const deliveries = getStorage<Delivery>(STORAGE_KEY_DELIVERIES);
    const today = new Date().toISOString().split('T')[0];
    const todayDeliveries = deliveries.filter(d => d.scheduledDate === today);

    const completed = todayDeliveries.filter(d => d.status === 'Delivered').length;
    const pending = todayDeliveries.filter(d => d.status === 'Pending').length;
    const inTransit = todayDeliveries.filter(d => d.status === 'In Transit').length;
    const failed = todayDeliveries.filter(d => ['Failed', 'Refused', 'Not Home'].includes(d.status)).length;

    const vans = getStorage<Van>(STORAGE_KEY_VANS);
    const activeVans = vans.filter(v => v.currentDriverId).length;

    const successRate = todayDeliveries.length > 0
        ? (completed / todayDeliveries.length) * 100
        : 0;

    return {
        totalDeliveries: todayDeliveries.length,
        completed,
        pending,
        inTransit,
        failed,
        successRate,
        activeVans
    };
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Vans
    initializeVans,
    getVans,
    getVan,
    updateVanLocation,

    // Driver Sessions
    startDriverSession,
    endDriverSession,
    getActiveSession,

    // Deliveries
    getDeliveries,
    getDeliveriesByVan,
    getDeliveriesByDriver,
    getDelivery,
    createDelivery,
    updateDelivery,
    completeDelivery,
    failDelivery,

    // Stats
    getPODStats,

    // Constants
    VAN_COLORS
};
