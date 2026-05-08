// ============================================
// GEOLOCATION UTILITY
// GPS coordinate capture and validation
// ============================================

export interface GeolocationResult {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export interface GeolocationError {
    code: number;
    message: string;
}

/**
 * Get current GPS location
 */
export async function getCurrentLocation(): Promise<GeolocationResult> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject({
                code: 0,
                message: 'Geolocation is not supported by this browser'
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                reject({
                    code: error.code,
                    message: error.message
                });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

/**
 * Watch location changes (for real-time tracking)
 */
export function watchLocation(
    onSuccess: (location: GeolocationResult) => void,
    onError: (error: GeolocationError) => void
): number | null {
    if (!navigator.geolocation) {
        onError({
            code: 0,
            message: 'Geolocation is not supported'
        });
        return null;
    }

    return navigator.geolocation.watchPosition(
        (position) => {
            onSuccess({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp
            });
        },
        (error) => {
            onError({
                code: error.code,
                message: error.message
            });
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

/**
 * Stop watching location
 */
export function stopWatchingLocation(watchId: number): void {
    if (navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
    }
}

/**
 * Calculate distance between two points (in meters)
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lonDir = longitude >= 0 ? 'E' : 'W';

    return `${Math.abs(latitude).toFixed(6)}° ${latDir}, ${Math.abs(longitude).toFixed(6)}° ${lonDir}`;
}

/**
 * Check if location accuracy is acceptable
 */
export function isAccuracyAcceptable(accuracy: number): boolean {
    return accuracy <= 100; // Within 100 meters
}

export default {
    getCurrentLocation,
    watchLocation,
    stopWatchingLocation,
    calculateDistance,
    formatCoordinates,
    isAccuracyAcceptable
};
