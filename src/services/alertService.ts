// ============================================
// ALERT SERVICE - Intelligent Notifications
// Automated alerts for POD system monitoring
// ============================================

import { getCurrentVanStatus } from './vanTrackingService';
import { getLatestLocation, checkGeofences } from './locationService';
import { getDailyTimeBreakdown } from './timeTrackingService';
import { getVanPerformanceMetrics } from './analyticsService';
const STORAGE_KEY_ALERTS = 'pod_alerts';
const STORAGE_KEY_ALERT_CONFIG = 'pod_alert_config';

// ============================================
// INTERFACES
// ============================================

export type AlertType = 'status' | 'performance' | 'location' | 'time' | 'delivery';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
    id: string;
    vanId: string;
    vanName: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
    acknowledgedAt?: string;
    acknowledgedBy?: string;
    metadata?: any;
    actionable: boolean;
    suggestedAction?: string;
}

export interface AlertConfig {
    // Time thresholds (minutes)
    maxLoadingTime: number;
    maxDeliveryTime: number;
    maxStopTime: number;
    maxIdleTime: number;

    // Performance thresholds
    minDeliveriesPerHour: number;
    minEfficiencyScore: number;
    minSuccessRate: number; // percentage

    // Location thresholds
    maxSpeedMph: number;
    enableGeofenceAlerts: boolean;
    enableOffRouteAlerts: boolean;

    // Schedule thresholds
    behindScheduleMinutes: number;
    aheadScheduleMinutes: number;

    // Enabled alert types
    enabledAlerts: {
        status: boolean;
        performance: boolean;
        location: boolean;
        time: boolean;
        delivery: boolean;
    };
}

export interface AlertSummary {
    total: number;
    unacknowledged: number;
    byType: Record<AlertType, number>;
    bySeverity: Record<AlertSeverity, number>;
    critical: Alert[];
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

const getConfigStorage = (): AlertConfig => {
    const data = localStorage.getItem(STORAGE_KEY_ALERT_CONFIG);
    return data ? JSON.parse(data) : getDefaultAlertConfig();
};

const setConfigStorage = (config: AlertConfig) => {
    localStorage.setItem(STORAGE_KEY_ALERT_CONFIG, JSON.stringify(config));
};

// ============================================
// DEFAULT CONFIGURATION
// ============================================

function getDefaultAlertConfig(): AlertConfig {
    return {
        maxLoadingTime: 45,
        maxDeliveryTime: 10,
        maxStopTime: 20,
        maxIdleTime: 15,
        minDeliveriesPerHour: 2.0,
        minEfficiencyScore: 50,
        minSuccessRate: 80,
        maxSpeedMph: 70,
        enableGeofenceAlerts: true,
        enableOffRouteAlerts: false,
        behindScheduleMinutes: 30,
        aheadScheduleMinutes: 60,
        enabledAlerts: {
            status: true,
            performance: true,
            location: true,
            time: true,
            delivery: true
        }
    };
}

// ============================================
// ALERT MANAGEMENT
// ============================================

export async function createAlert(
    vanId: string,
    vanName: string,
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    actionable: boolean = false,
    suggestedAction?: string,
    metadata?: any
): Promise<Alert> {
    await delay(50);

    const alert: Alert = {
        id: crypto.randomUUID(),
        vanId,
        vanName,
        type,
        severity,
        title,
        message,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        actionable,
        suggestedAction,
        metadata
    };

    const alerts = getStorage<Alert>(STORAGE_KEY_ALERTS);
    setStorage(STORAGE_KEY_ALERTS, [alert, ...alerts]);

    return alert;
}

export async function getAlerts(
    vanId?: string,
    type?: AlertType,
    severity?: AlertSeverity,
    acknowledged?: boolean
): Promise<Alert[]> {
    await delay(100);
    let alerts = getStorage<Alert>(STORAGE_KEY_ALERTS);

    if (vanId) {
        alerts = alerts.filter(a => a.vanId === vanId);
    }

    if (type) {
        alerts = alerts.filter(a => a.type === type);
    }

    if (severity) {
        alerts = alerts.filter(a => a.severity === severity);
    }

    if (acknowledged !== undefined) {
        alerts = alerts.filter(a => a.acknowledged === acknowledged);
    }

    return alerts.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

export async function acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
): Promise<Alert | null> {
    await delay(100);

    const alerts = getStorage<Alert>(STORAGE_KEY_ALERTS);
    const index = alerts.findIndex(a => a.id === alertId);

    if (index === -1) return null;

    alerts[index].acknowledged = true;
    alerts[index].acknowledgedAt = new Date().toISOString();
    alerts[index].acknowledgedBy = acknowledgedBy;

    setStorage(STORAGE_KEY_ALERTS, alerts);
    return alerts[index];
}

export async function acknowledgeAllAlerts(
    vanId: string,
    acknowledgedBy: string
): Promise<number> {
    await delay(150);

    const alerts = getStorage<Alert>(STORAGE_KEY_ALERTS);
    let count = 0;

    alerts.forEach(alert => {
        if (alert.vanId === vanId && !alert.acknowledged) {
            alert.acknowledged = true;
            alert.acknowledgedAt = new Date().toISOString();
            alert.acknowledgedBy = acknowledgedBy;
            count++;
        }
    });

    setStorage(STORAGE_KEY_ALERTS, alerts);
    return count;
}

export async function deleteAlert(alertId: string): Promise<boolean> {
    await delay(100);

    const alerts = getStorage<Alert>(STORAGE_KEY_ALERTS);
    const filtered = alerts.filter(a => a.id !== alertId);

    if (filtered.length === alerts.length) return false;

    setStorage(STORAGE_KEY_ALERTS, filtered);
    return true;
}

// ============================================
// ALERT SUMMARY
// ============================================

export async function getAlertSummary(vanId?: string): Promise<AlertSummary> {
    await delay(100);

    const alerts = await getAlerts(vanId);
    const unacknowledged = alerts.filter(a => !a.acknowledged);

    const byType: Record<AlertType, number> = {
        status: 0,
        performance: 0,
        location: 0,
        time: 0,
        delivery: 0
    };

    const bySeverity: Record<AlertSeverity, number> = {
        info: 0,
        warning: 0,
        critical: 0
    };

    alerts.forEach(alert => {
        byType[alert.type]++;
        bySeverity[alert.severity]++;
    });

    const critical = alerts.filter(a => a.severity === 'critical' && !a.acknowledged);

    return {
        total: alerts.length,
        unacknowledged: unacknowledged.length,
        byType,
        bySeverity,
        critical
    };
}

// ============================================
// ALERT CONFIGURATION
// ============================================

export async function getAlertConfig(): Promise<AlertConfig> {
    await delay(50);
    return getConfigStorage();
}

export async function updateAlertConfig(updates: Partial<AlertConfig>): Promise<AlertConfig> {
    await delay(100);

    const current = getConfigStorage();
    const updated = { ...current, ...updates };
    setConfigStorage(updated);

    return updated;
}

export async function resetAlertConfig(): Promise<AlertConfig> {
    await delay(50);
    const defaultConfig = getDefaultAlertConfig();
    setConfigStorage(defaultConfig);
    return defaultConfig;
}

// ============================================
// AUTOMATED ALERT GENERATION
// ============================================

export async function checkVanAlerts(vanId: string, vanName: string): Promise<Alert[]> {
    await delay(200);

    const config = getConfigStorage();
    const newAlerts: Alert[] = [];

    // Check time-based alerts
    if (config.enabledAlerts.time) {
        const timeAlerts = await checkTimeAlerts(vanId, vanName, config);
        newAlerts.push(...timeAlerts);
    }

    // Check performance alerts
    if (config.enabledAlerts.performance) {
        const perfAlerts = await checkPerformanceAlerts(vanId, vanName, config);
        newAlerts.push(...perfAlerts);
    }

    // Check location alerts
    if (config.enabledAlerts.location) {
        const locAlerts = await checkLocationAlerts(vanId, vanName, config);
        newAlerts.push(...locAlerts);
    }

    // Check status alerts
    if (config.enabledAlerts.status) {
        const statusAlerts = await checkStatusAlerts(vanId, vanName, config);
        newAlerts.push(...statusAlerts);
    }

    return newAlerts;
}

async function checkTimeAlerts(
    vanId: string,
    vanName: string,
    config: AlertConfig
): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const timeBreakdown = await getDailyTimeBreakdown(vanId);

    // Check loading time
    if (timeBreakdown.loadingTime > config.maxLoadingTime) {
        alerts.push(await createAlert(
            vanId,
            vanName,
            'time',
            'warning',
            'Extended Loading Time',
            `Loading time (${timeBreakdown.loadingTime} min) exceeds threshold (${config.maxLoadingTime} min)`,
            true,
            'Check for loading process issues or staffing needs',
            { loadingTime: timeBreakdown.loadingTime, threshold: config.maxLoadingTime }
        ));
    }

    // Check idle time
    if (timeBreakdown.idleTime > config.maxIdleTime) {
        alerts.push(await createAlert(
            vanId,
            vanName,
            'time',
            'info',
            'High Idle Time',
            `Van has been idle for ${timeBreakdown.idleTime} minutes`,
            true,
            'Check driver status or assign new deliveries',
            { idleTime: timeBreakdown.idleTime }
        ));
    }

    return alerts;
}

async function checkPerformanceAlerts(
    vanId: string,
    vanName: string,
    config: AlertConfig
): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const metrics = await getVanPerformanceMetrics(vanId);

    // Check deliveries per hour
    if (metrics.deliveriesPerHour < config.minDeliveriesPerHour) {
        alerts.push(await createAlert(
            vanId,
            vanName,
            'performance',
            'warning',
            'Low Delivery Rate',
            `Delivery rate (${metrics.deliveriesPerHour.toFixed(1)} del/hr) below target (${config.minDeliveriesPerHour} del/hr)`,
            true,
            'Review route efficiency or check for delays',
            { rate: metrics.deliveriesPerHour, target: config.minDeliveriesPerHour }
        ));
    }

    // Check efficiency score
    if (metrics.overallEfficiencyScore < config.minEfficiencyScore) {
        alerts.push(await createAlert(
            vanId,
            vanName,
            'performance',
            'warning',
            'Low Efficiency Score',
            `Efficiency score (${metrics.overallEfficiencyScore}) below minimum (${config.minEfficiencyScore})`,
            true,
            'Analyze performance metrics and provide driver coaching',
            { score: metrics.overallEfficiencyScore, minimum: config.minEfficiencyScore }
        ));
    }

    // Check success rate
    if (metrics.deliverySuccessRate < config.minSuccessRate) {
        alerts.push(await createAlert(
            vanId,
            vanName,
            'performance',
            'critical',
            'Low Success Rate',
            `Delivery success rate (${metrics.deliverySuccessRate.toFixed(1)}%) below target (${config.minSuccessRate}%)`,
            true,
            'Investigate failed deliveries and address issues',
            { rate: metrics.deliverySuccessRate, target: config.minSuccessRate }
        ));
    }

    return alerts;
}

async function checkLocationAlerts(
    vanId: string,
    vanName: string,
    config: AlertConfig
): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const location = await getLatestLocation(vanId);

    if (!location) return alerts;

    // Check speed
    if (location.speed && location.speed > config.maxSpeedMph) {
        alerts.push(await createAlert(
            vanId,
            vanName,
            'location',
            'warning',
            'Speeding Detected',
            `Van traveling at ${location.speed.toFixed(0)} mph (limit: ${config.maxSpeedMph} mph)`,
            true,
            'Contact driver about safe driving practices',
            { speed: location.speed, limit: config.maxSpeedMph }
        ));
    }

    // Check geofences
    if (config.enableGeofenceAlerts) {
        const { inside } = await checkGeofences(vanId, location.latitude, location.longitude);

        // Alert if van left delivery zone
        const deliveryZones = inside.filter(g => g.type === 'delivery_zone');
        if (deliveryZones.length === 0) {
            // Check if was previously in zone (would need historical tracking)
            // For now, skip this check
        }
    }

    return alerts;
}

async function checkStatusAlerts(
    vanId: string,
    vanName: string,
    config: AlertConfig
): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const status = await getCurrentVanStatus(vanId);

    if (!status) return alerts;

    // Check for extended "At Location" status
    if (status.status === 'At Location') {
        const minutesAtLocation = (Date.now() - new Date(status.timestamp).getTime()) / 60000;

        if (minutesAtLocation > config.maxStopTime) {
            alerts.push(await createAlert(
                vanId,
                vanName,
                'status',
                'warning',
                'Extended Stop Time',
                `Van has been at location for ${Math.round(minutesAtLocation)} minutes`,
                true,
                'Check if driver needs assistance',
                { duration: minutesAtLocation, location: status.metadata?.address }
            ));
        }
    }

    return alerts;
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupOldAlerts(daysToKeep: number = 7): Promise<number> {
    await delay(100);

    const cutoffDate = new Date(Date.now() - daysToKeep * 86400000).toISOString();
    const alerts = getStorage<Alert>(STORAGE_KEY_ALERTS);

    // Keep unacknowledged alerts and recent alerts
    const filtered = alerts.filter(a =>
        !a.acknowledged || a.timestamp >= cutoffDate
    );

    const removed = alerts.length - filtered.length;
    setStorage(STORAGE_KEY_ALERTS, filtered);

    return removed;
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Alert management
    createAlert,
    getAlerts,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    deleteAlert,
    getAlertSummary,

    // Configuration
    getAlertConfig,
    updateAlertConfig,
    resetAlertConfig,

    // Automated checks
    checkVanAlerts,

    // Cleanup
    cleanupOldAlerts
};
