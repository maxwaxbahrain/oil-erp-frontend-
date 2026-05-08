// ============================================
// VAN TRACKING SERVICE - Automated Status Tracking
// Handles automated status transitions for 10 vans
// ============================================

const STORAGE_KEY_VAN_STATUS = 'pod_van_status';
const STORAGE_KEY_STATUS_HISTORY = 'pod_status_history';

// ============================================
// INTERFACES
// ============================================

export type VanStatusType =
    | 'Loading'
    | 'In Transit'
    | 'At Location'
    | 'Delivering'
    | 'Completed'
    | 'Returning'
    | 'Idle';

export interface VanStatus {
    id: string;
    vanId: string;
    status: VanStatusType;
    timestamp: string;
    location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
    };
    metadata?: {
        deliveryId?: string;
        customerName?: string;
        address?: string;
        packageCount?: number;
    };
}

export interface StatusHistory {
    id: string;
    vanId: string;
    fromStatus: VanStatusType;
    toStatus: VanStatusType;
    timestamp: string;
    duration: number; // milliseconds in previous status
    triggeredBy: 'auto' | 'manual';
    reason?: string;
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
// VAN STATUS MANAGEMENT
// ============================================

export async function getCurrentVanStatus(vanId: string): Promise<VanStatus | null> {
    await delay(100);
    const statuses = getStorage<VanStatus>(STORAGE_KEY_VAN_STATUS);
    return statuses.find(s => s.vanId === vanId) || null;
}

export async function getAllVanStatuses(): Promise<VanStatus[]> {
    await delay(100);
    return getStorage<VanStatus>(STORAGE_KEY_VAN_STATUS);
}

export async function updateVanStatus(
    vanId: string,
    newStatus: VanStatusType,
    location?: { latitude: number; longitude: number; accuracy: number },
    metadata?: VanStatus['metadata'],
    triggeredBy: 'auto' | 'manual' = 'auto',
    reason?: string
): Promise<VanStatus> {
    await delay(200);

    const statuses = getStorage<VanStatus>(STORAGE_KEY_VAN_STATUS);
    const existingIndex = statuses.findIndex(s => s.vanId === vanId);
    const existing = existingIndex !== -1 ? statuses[existingIndex] : null;

    // Create new status
    const newStatusObj: VanStatus = {
        id: crypto.randomUUID(),
        vanId,
        status: newStatus,
        timestamp: new Date().toISOString(),
        location,
        metadata
    };

    // Record status history if status changed
    if (existing && existing.status !== newStatus) {
        const history = getStorage<StatusHistory>(STORAGE_KEY_STATUS_HISTORY);
        const duration = new Date().getTime() - new Date(existing.timestamp).getTime();

        const historyEntry: StatusHistory = {
            id: crypto.randomUUID(),
            vanId,
            fromStatus: existing.status,
            toStatus: newStatus,
            timestamp: new Date().toISOString(),
            duration,
            triggeredBy,
            reason
        };

        setStorage(STORAGE_KEY_STATUS_HISTORY, [historyEntry, ...history]);
    }

    // Update or add status
    if (existingIndex !== -1) {
        statuses[existingIndex] = newStatusObj;
    } else {
        statuses.push(newStatusObj);
    }

    setStorage(STORAGE_KEY_VAN_STATUS, statuses);
    return newStatusObj;
}

// ============================================
// STATUS HISTORY
// ============================================

export async function getVanStatusHistory(
    vanId: string,
    startDate?: string,
    endDate?: string
): Promise<StatusHistory[]> {
    await delay(150);
    let history = getStorage<StatusHistory>(STORAGE_KEY_STATUS_HISTORY);

    history = history.filter(h => h.vanId === vanId);

    if (startDate) {
        history = history.filter(h => h.timestamp >= startDate);
    }

    if (endDate) {
        history = history.filter(h => h.timestamp <= endDate);
    }

    return history.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

export async function getTodayStatusHistory(vanId: string): Promise<StatusHistory[]> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    return getVanStatusHistory(vanId, today, tomorrow);
}

// ============================================
// AUTOMATED STATUS DETECTION
// ============================================

export async function detectStatusFromActivity(
    vanId: string,
    activity: {
        isMoving: boolean;
        speed?: number; // mph
        nearWarehouse: boolean;
        nearDeliveryLocation: boolean;
        deliveryInProgress: boolean;
        allDeliveriesComplete: boolean;
    }
): Promise<VanStatusType> {
    await delay(100);

    const currentStatus = await getCurrentVanStatus(vanId);
    const current = currentStatus?.status || 'Idle';

    // Status detection logic
    if (activity.deliveryInProgress) {
        return 'Delivering';
    }

    if (activity.allDeliveriesComplete && activity.isMoving) {
        return 'Returning';
    }

    if (activity.allDeliveriesComplete && activity.nearWarehouse) {
        return 'Completed';
    }

    if (activity.nearDeliveryLocation && !activity.isMoving) {
        return 'At Location';
    }

    if (activity.isMoving && !activity.nearWarehouse) {
        return 'In Transit';
    }

    if (activity.nearWarehouse && !activity.isMoving && current === 'Idle') {
        return 'Loading';
    }

    return current;
}

// ============================================
// STATUS ANALYTICS
// ============================================

export interface StatusDurationStats {
    status: VanStatusType;
    totalDuration: number; // milliseconds
    count: number;
    averageDuration: number;
    percentage: number;
}

export async function getStatusDurationStats(
    vanId: string,
    date?: string
): Promise<StatusDurationStats[]> {
    await delay(200);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const history = await getVanStatusHistory(vanId, targetDate);

    const stats = new Map<VanStatusType, { total: number; count: number }>();

    history.forEach(h => {
        const existing = stats.get(h.fromStatus) || { total: 0, count: 0 };
        stats.set(h.fromStatus, {
            total: existing.total + h.duration,
            count: existing.count + 1
        });
    });

    const totalTime = Array.from(stats.values()).reduce((sum, s) => sum + s.total, 0);

    const result: StatusDurationStats[] = [];
    stats.forEach((value, status) => {
        result.push({
            status,
            totalDuration: value.total,
            count: value.count,
            averageDuration: value.total / value.count,
            percentage: totalTime > 0 ? (value.total / totalTime) * 100 : 0
        });
    });

    return result.sort((a, b) => b.totalDuration - a.totalDuration);
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupOldStatusHistory(daysToKeep: number = 30): Promise<number> {
    await delay(100);

    const cutoffDate = new Date(Date.now() - daysToKeep * 86400000).toISOString();
    const history = getStorage<StatusHistory>(STORAGE_KEY_STATUS_HISTORY);
    const filtered = history.filter(h => h.timestamp >= cutoffDate);
    const removed = history.length - filtered.length;

    setStorage(STORAGE_KEY_STATUS_HISTORY, filtered);
    return removed;
}

// ============================================
// EXPORTS
// ============================================

export default {
    getCurrentVanStatus,
    getAllVanStatuses,
    updateVanStatus,
    getVanStatusHistory,
    getTodayStatusHistory,
    detectStatusFromActivity,
    getStatusDurationStats,
    cleanupOldStatusHistory
};
