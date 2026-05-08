// ============================================
// LOCATION SERVICE - GPS Tracking & Geofencing
// Handles real-time location tracking for 10 vans
// ============================================

import * as turf from '@turf/turf';

const STORAGE_KEY_LOCATION_HISTORY = 'pod_location_history';
const STORAGE_KEY_GEOFENCES = 'pod_geofences';

// ============================================
// INTERFACES
// ============================================

export interface LocationPoint {
    id: string;
    vanId: string;
    latitude: number;
    longitude: number;
    accuracy: number; // meters
    speed?: number; // mph
    heading?: number; // degrees
    timestamp: string;
    batteryLevel?: number; // percentage
}

export interface Geofence {
    id: string;
    name: string;
    type: 'warehouse' | 'delivery_zone' | 'restricted';
    center: {
        latitude: number;
        longitude: number;
    };
    radius: number; // meters
    active: boolean;
}

export interface GeofenceEvent {
    id: string;
    vanId: string;
    geofenceId: string;
    geofenceName: string;
    eventType: 'enter' | 'exit';
    timestamp: string;
    location: {
        latitude: number;
        longitude: number;
    };
}

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

// ============================================
// LOCATION TRACKING
// ============================================

export async function recordLocation(
    vanId: string,
    latitude: number,
    longitude: number,
    accuracy: number,
    speed?: number,
    heading?: number,
    batteryLevel?: number
): Promise<LocationPoint> {
    await delay(50);

    const location: LocationPoint = {
        id: crypto.randomUUID(),
        vanId,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        timestamp: new Date().toISOString(),
        batteryLevel
    };

    const history = getStorage<LocationPoint>(STORAGE_KEY_LOCATION_HISTORY);
    setStorage(STORAGE_KEY_LOCATION_HISTORY, [location, ...history]);

    return location;
}

export async function getLatestLocation(vanId: string): Promise<LocationPoint | null> {
    await delay(50);
    const history = getStorage<LocationPoint>(STORAGE_KEY_LOCATION_HISTORY);
    return history.find(l => l.vanId === vanId) || null;
}

export async function getLocationHistory(
    vanId: string,
    startDate?: string,
    endDate?: string,
    limit?: number
): Promise<LocationPoint[]> {
    await delay(100);
    let history = getStorage<LocationPoint>(STORAGE_KEY_LOCATION_HISTORY);

    history = history.filter(l => l.vanId === vanId);

    if (startDate) {
        history = history.filter(l => l.timestamp >= startDate);
    }

    if (endDate) {
        history = history.filter(l => l.timestamp <= endDate);
    }

    history.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (limit) {
        history = history.slice(0, limit);
    }

    return history;
}

export async function getTodayLocationHistory(vanId: string): Promise<LocationPoint[]> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    return getLocationHistory(vanId, today, tomorrow);
}

// ============================================
// GEOFENCING
// ============================================

export async function createGeofence(
    name: string,
    type: Geofence['type'],
    latitude: number,
    longitude: number,
    radius: number
): Promise<Geofence> {
    await delay(100);

    const geofence: Geofence = {
        id: crypto.randomUUID(),
        name,
        type,
        center: { latitude, longitude },
        radius,
        active: true
    };

    const geofences = getStorage<Geofence>(STORAGE_KEY_GEOFENCES);
    setStorage(STORAGE_KEY_GEOFENCES, [...geofences, geofence]);

    return geofence;
}

export async function getGeofences(type?: Geofence['type']): Promise<Geofence[]> {
    await delay(50);
    let geofences = getStorage<Geofence>(STORAGE_KEY_GEOFENCES);

    if (type) {
        geofences = geofences.filter(g => g.type === type);
    }

    return geofences.filter(g => g.active);
}

export async function updateGeofence(
    id: string,
    updates: Partial<Geofence>
): Promise<Geofence | null> {
    await delay(100);

    const geofences = getStorage<Geofence>(STORAGE_KEY_GEOFENCES);
    const index = geofences.findIndex(g => g.id === id);

    if (index === -1) return null;

    geofences[index] = { ...geofences[index], ...updates };
    setStorage(STORAGE_KEY_GEOFENCES, geofences);

    return geofences[index];
}

export async function deleteGeofence(id: string): Promise<boolean> {
    await delay(100);

    const geofences = getStorage<Geofence>(STORAGE_KEY_GEOFENCES);
    const filtered = geofences.filter(g => g.id !== id);

    if (filtered.length === geofences.length) return false;

    setStorage(STORAGE_KEY_GEOFENCES, filtered);
    return true;
}

// ============================================
// GEOFENCE DETECTION
// ============================================

export function isPointInGeofence(
    latitude: number,
    longitude: number,
    geofence: Geofence
): boolean {
    const point = turf.point([longitude, latitude]);
    const center = turf.point([geofence.center.longitude, geofence.center.latitude]);
    const distance = turf.distance(point, center, { units: 'meters' });

    return distance <= geofence.radius;
}

export async function checkGeofences(
    _vanId: string,
    latitude: number,
    longitude: number
): Promise<{
    inside: Geofence[];
    outside: Geofence[];
}> {
    await delay(50);

    const geofences = await getGeofences();
    const inside: Geofence[] = [];
    const outside: Geofence[] = [];

    geofences.forEach(geofence => {
        if (isPointInGeofence(latitude, longitude, geofence)) {
            inside.push(geofence);
        } else {
            outside.push(geofence);
        }
    });

    return { inside, outside };
}

// ============================================
// DISTANCE CALCULATIONS
// ============================================

export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    unit: 'meters' | 'kilometers' | 'miles' = 'miles'
): number {
    const point1 = turf.point([lon1, lat1]);
    const point2 = turf.point([lon2, lat2]);

    const distanceKm = turf.distance(point1, point2, { units: 'kilometers' });

    switch (unit) {
        case 'meters':
            return distanceKm * 1000;
        case 'kilometers':
            return distanceKm;
        case 'miles':
            return distanceKm * 0.621371;
        default:
            return distanceKm;
    }
}

export async function calculateRouteDistance(vanId: string, date?: string): Promise<number> {
    await delay(100);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const history = await getLocationHistory(vanId, targetDate);

    if (history.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 0; i < history.length - 1; i++) {
        const current = history[i];
        const next = history[i + 1];

        totalDistance += calculateDistance(
            current.latitude,
            current.longitude,
            next.latitude,
            next.longitude,
            'miles'
        );
    }

    return totalDistance;
}

// ============================================
// MOVEMENT DETECTION
// ============================================

export async function isVanMoving(
    vanId: string,
    speedThreshold: number = 3 // mph
): Promise<boolean> {
    await delay(50);

    const latest = await getLatestLocation(vanId);
    if (!latest) return false;

    // Check if speed is available and above threshold
    if (latest.speed !== undefined) {
        return latest.speed > speedThreshold;
    }

    // Fallback: check last 2 locations
    const history = await getLocationHistory(vanId, undefined, undefined, 2);
    if (history.length < 2) return false;

    const [current, previous] = history;
    const timeDiff = (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000; // seconds

    if (timeDiff === 0) return false;

    const distance = calculateDistance(
        current.latitude,
        current.longitude,
        previous.latitude,
        previous.longitude,
        'miles'
    );

    const speed = (distance / timeDiff) * 3600; // mph
    return speed > speedThreshold;
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupOldLocationHistory(daysToKeep: number = 30): Promise<number> {
    await delay(100);

    const cutoffDate = new Date(Date.now() - daysToKeep * 86400000).toISOString();
    const history = getStorage<LocationPoint>(STORAGE_KEY_LOCATION_HISTORY);
    const filtered = history.filter(l => l.timestamp >= cutoffDate);
    const removed = history.length - filtered.length;

    setStorage(STORAGE_KEY_LOCATION_HISTORY, filtered);
    return removed;
}

// ============================================
// INITIALIZATION
// ============================================

export async function initializeDefaultGeofences(): Promise<void> {
    const existing = await getGeofences();

    if (existing.length === 0) {
        // Create default warehouse geofence (example coordinates - should be configured)
        await createGeofence(
            'Main Warehouse',
            'warehouse',
            40.7128, // Example: New York
            -74.0060,
            100 // 100 meter radius
        );
    }
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Location tracking
    recordLocation,
    getLatestLocation,
    getLocationHistory,
    getTodayLocationHistory,

    // Geofencing
    createGeofence,
    getGeofences,
    updateGeofence,
    deleteGeofence,
    isPointInGeofence,
    checkGeofences,

    // Distance calculations
    calculateDistance,
    calculateRouteDistance,

    // Movement detection
    isVanMoving,

    // Cleanup
    cleanupOldLocationHistory,

    // Initialization
    initializeDefaultGeofences
};
