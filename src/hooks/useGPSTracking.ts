// ============================================
// GPS TRACKING HOOK - Background Location Updates
// Automatically tracks van location every 30 seconds
// ============================================

import { useEffect, useRef, useState } from 'react';
import { recordLocation } from '../services/locationService';
import { updateVanStatus, detectStatusFromActivity } from '../services/vanTrackingService';
import { checkGeofences } from '../services/locationService';
export interface GPSTrackingOptions {
    vanId: string;
    driverId: string;
    driverName: string;
    enabled: boolean;
    updateInterval?: number; // milliseconds (default: 30000 = 30 seconds)
    highAccuracy?: boolean; // default: true
}

export interface GPSStatus {
    isTracking: boolean;
    lastUpdate?: Date;
    accuracy?: number;
    error?: string;
    batteryLevel?: number;
}

export function useGPSTracking(options: GPSTrackingOptions) {
    const [status, setStatus] = useState<GPSStatus>({
        isTracking: false
    });

    const watchIdRef = useRef<number | null>(null);
    const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        if (!options.enabled || !options.vanId) {
            stopTracking();
            return;
        }

        startTracking();

        return () => {
            stopTracking();
        };
    }, [options.enabled, options.vanId, options.driverId]);

    const startTracking = () => {
        if (!navigator.geolocation) {
            setStatus({
                isTracking: false,
                error: 'Geolocation not supported by browser'
            });
            return;
        }

        // Request permission and start watching position
        const watchOptions: PositionOptions = {
            enableHighAccuracy: options.highAccuracy ?? true,
            timeout: 10000,
            maximumAge: 0
        };

        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePositionUpdate,
            handlePositionError,
            watchOptions
        );

        // Set up periodic updates
        const interval = options.updateInterval || 30000; // 30 seconds default
        intervalIdRef.current = setInterval(() => {
            // Force a position update
            navigator.geolocation.getCurrentPosition(
                handlePositionUpdate,
                handlePositionError,
                watchOptions
            );
        }, interval);

        setStatus(prev => ({ ...prev, isTracking: true, error: undefined }));
    };

    const stopTracking = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        if (intervalIdRef.current !== null) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
        }

        setStatus({ isTracking: false });
    };

    const handlePositionUpdate = async (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy, speed, heading } = position.coords;

        try {
            // Get battery level if available
            let batteryLevel: number | undefined;
            if ('getBattery' in navigator) {
                try {
                    const battery = await (navigator as any).getBattery();
                    batteryLevel = Math.round(battery.level * 100);
                } catch (e) {
                    // Battery API not available
                }
            }

            // Record location
            await recordLocation(
                options.vanId,
                latitude,
                longitude,
                accuracy,
                speed ? speed * 2.237 : undefined, // Convert m/s to mph
                heading || undefined,
                batteryLevel
            );

            // Check geofences
            const { inside } = await checkGeofences(options.vanId, latitude, longitude);
            const nearWarehouse = inside.some(g => g.type === 'warehouse');
            const nearDeliveryLocation = inside.some(g => g.type === 'delivery_zone');

            // Detect if van is moving
            const isMoving = speed ? speed > 1.34 : false; // 1.34 m/s = 3 mph

            // Detect status from activity
            const detectedStatus = await detectStatusFromActivity(options.vanId, {
                isMoving,
                speed: speed ? speed * 2.237 : undefined,
                nearWarehouse,
                nearDeliveryLocation,
                deliveryInProgress: false, // Will be set by delivery flow
                allDeliveriesComplete: false // Will be set by delivery flow
            });

            // Update van status if changed
            await updateVanStatus(
                options.vanId,
                detectedStatus,
                { latitude, longitude, accuracy },
                undefined,
                'auto',
                'GPS tracking update'
            );

            // Update status
            setStatus({
                isTracking: true,
                lastUpdate: new Date(),
                accuracy,
                batteryLevel,
                error: undefined
            });

            lastLocationRef.current = { latitude, longitude };

        } catch (error) {
            console.error('Error processing GPS update:', error);
            setStatus(prev => ({
                ...prev,
                error: 'Failed to process location update'
            }));
        }
    };

    const handlePositionError = (error: GeolocationPositionError) => {
        let errorMessage = 'Unknown GPS error';

        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location unavailable';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timeout';
                break;
        }

        setStatus(prev => ({
            ...prev,
            error: errorMessage
        }));

        console.error('GPS Error:', errorMessage, error);
    };

    const requestPermission = async (): Promise<boolean> => {
        if (!navigator.geolocation) {
            return false;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => resolve(true),
                () => resolve(false),
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    };

    return {
        status,
        requestPermission,
        startTracking,
        stopTracking
    };
}
