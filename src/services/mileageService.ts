// ============================================
// MILEAGE SERVICE - Distance Tracking & Analytics
// Tracks mileage per delivery and correlates with time
// ============================================

import { calculateDistance } from './locationService';

const STORAGE_KEY_MILEAGE_RECORDS = 'pod_mileage_records';

// ============================================
// INTERFACES
// ============================================

export interface MileageRecord {
    id: string;
    vanId: string;
    date: string;
    startMileage: number;
    currentMileage: number;
    totalDistance: number; // miles
    deliveryCount: number;
    segmentDistances: MileageSegment[];
}

export interface MileageSegment {
    id: string;
    from: string; // location name or "Warehouse"
    to: string; // location name or delivery address
    distance: number; // miles
    duration: number; // minutes
    deliveryId?: string;
    timestamp: string;
}

export interface MileageStats {
    totalMiles: number;
    averageMilesPerDelivery: number;
    averageMilesPerHour: number;
    longestSegment: number;
    shortestSegment: number;
    efficiency: number; // deliveries per mile
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
// MILEAGE RECORD MANAGEMENT
// ============================================

export async function initializeDailyMileage(
    vanId: string,
    startMileage: number,
    date?: string
): Promise<MileageRecord> {
    await delay(100);

    const targetDate = date || new Date().toISOString().split('T')[0];

    const record: MileageRecord = {
        id: crypto.randomUUID(),
        vanId,
        date: targetDate,
        startMileage,
        currentMileage: startMileage,
        totalDistance: 0,
        deliveryCount: 0,
        segmentDistances: []
    };

    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);
    setStorage(STORAGE_KEY_MILEAGE_RECORDS, [record, ...records]);

    return record;
}

export async function getMileageRecord(
    vanId: string,
    date?: string
): Promise<MileageRecord | null> {
    await delay(100);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);

    return records.find(r => r.vanId === vanId && r.date === targetDate) || null;
}

export async function updateMileage(
    vanId: string,
    newMileage: number,
    date?: string
): Promise<MileageRecord | null> {
    await delay(100);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);
    const index = records.findIndex(r => r.vanId === vanId && r.date === targetDate);

    if (index === -1) return null;

    records[index].currentMileage = newMileage;
    records[index].totalDistance = newMileage - records[index].startMileage;

    setStorage(STORAGE_KEY_MILEAGE_RECORDS, records);
    return records[index];
}

// ============================================
// SEGMENT TRACKING
// ============================================

export async function recordMileageSegment(
    vanId: string,
    from: string,
    to: string,
    distance: number,
    duration: number,
    deliveryId?: string,
    date?: string
): Promise<MileageSegment> {
    await delay(100);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);
    const index = records.findIndex(r => r.vanId === vanId && r.date === targetDate);

    const segment: MileageSegment = {
        id: crypto.randomUUID(),
        from,
        to,
        distance,
        duration,
        deliveryId,
        timestamp: new Date().toISOString()
    };

    if (index !== -1) {
        records[index].segmentDistances.push(segment);
        records[index].totalDistance += distance;
        if (deliveryId) {
            records[index].deliveryCount += 1;
        }
        setStorage(STORAGE_KEY_MILEAGE_RECORDS, records);
    }

    return segment;
}

export async function calculateSegmentDistance(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number
): Promise<number> {
    await delay(50);
    return calculateDistance(fromLat, fromLon, toLat, toLon, 'miles');
}

// ============================================
// MILEAGE STATISTICS
// ============================================

export async function getMileageStats(
    vanId: string,
    date?: string
): Promise<MileageStats> {
    await delay(150);

    const record = await getMileageRecord(vanId, date);

    if (!record || record.segmentDistances.length === 0) {
        return {
            totalMiles: 0,
            averageMilesPerDelivery: 0,
            averageMilesPerHour: 0,
            longestSegment: 0,
            shortestSegment: 0,
            efficiency: 0
        };
    }

    const distances = record.segmentDistances.map(s => s.distance);
    const totalMiles = record.totalDistance;
    const deliveryCount = record.deliveryCount;

    const totalDuration = record.segmentDistances.reduce((sum, s) => sum + s.duration, 0);
    const totalHours = totalDuration / 60;

    return {
        totalMiles,
        averageMilesPerDelivery: deliveryCount > 0 ? totalMiles / deliveryCount : 0,
        averageMilesPerHour: totalHours > 0 ? totalMiles / totalHours : 0,
        longestSegment: Math.max(...distances, 0),
        shortestSegment: Math.min(...distances.filter(d => d > 0), 0) || 0,
        efficiency: totalMiles > 0 ? deliveryCount / totalMiles : 0
    };
}

export async function getFleetMileageStats(
    date?: string
): Promise<{
    totalFleetMiles: number;
    totalDeliveries: number;
    averageMilesPerVan: number;
    averageMilesPerDelivery: number;
    mostEfficientVan?: string;
    leastEfficientVan?: string;
}> {
    await delay(200);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);
    const dayRecords = records.filter(r => r.date === targetDate);

    if (dayRecords.length === 0) {
        return {
            totalFleetMiles: 0,
            totalDeliveries: 0,
            averageMilesPerVan: 0,
            averageMilesPerDelivery: 0
        };
    }

    const totalFleetMiles = dayRecords.reduce((sum, r) => sum + r.totalDistance, 0);
    const totalDeliveries = dayRecords.reduce((sum, r) => sum + r.deliveryCount, 0);

    // Find most and least efficient vans
    const vanEfficiencies = dayRecords.map(r => ({
        vanId: r.vanId,
        efficiency: r.totalDistance > 0 ? r.deliveryCount / r.totalDistance : 0
    }));

    vanEfficiencies.sort((a, b) => b.efficiency - a.efficiency);

    return {
        totalFleetMiles,
        totalDeliveries,
        averageMilesPerVan: dayRecords.length > 0 ? totalFleetMiles / dayRecords.length : 0,
        averageMilesPerDelivery: totalDeliveries > 0 ? totalFleetMiles / totalDeliveries : 0,
        mostEfficientVan: vanEfficiencies[0]?.vanId,
        leastEfficientVan: vanEfficiencies[vanEfficiencies.length - 1]?.vanId
    };
}

// ============================================
// TIME & MILEAGE CORRELATION
// ============================================

export interface TimeDistanceCorrelation {
    totalDistance: number; // miles
    totalTime: number; // minutes
    averageSpeed: number; // mph (including stops)
    timePerMile: number; // minutes
    deliveries: number;
    timePerDelivery: number; // minutes
    milesPerDelivery: number;
    efficiency: {
        deliveriesPerHour: number;
        milesPerHour: number;
        timeEfficiency: number; // percentage (0-100)
    };
}

export async function getTimeDistanceCorrelation(
    vanId: string,
    date?: string
): Promise<TimeDistanceCorrelation> {
    await delay(150);

    const record = await getMileageRecord(vanId, date);

    if (!record) {
        return {
            totalDistance: 0,
            totalTime: 0,
            averageSpeed: 0,
            timePerMile: 0,
            deliveries: 0,
            timePerDelivery: 0,
            milesPerDelivery: 0,
            efficiency: {
                deliveriesPerHour: 0,
                milesPerHour: 0,
                timeEfficiency: 0
            }
        };
    }

    const totalDistance = record.totalDistance;
    const totalTime = record.segmentDistances.reduce((sum, s) => sum + s.duration, 0);
    const deliveries = record.deliveryCount;

    const totalHours = totalTime / 60;
    const averageSpeed = totalHours > 0 ? totalDistance / totalHours : 0;
    const timePerMile = totalDistance > 0 ? totalTime / totalDistance : 0;

    const deliveriesPerHour = totalHours > 0 ? deliveries / totalHours : 0;
    const milesPerHour = averageSpeed;
    const timePerDelivery = deliveries > 0 ? totalTime / deliveries : 0;
    const milesPerDelivery = deliveries > 0 ? totalDistance / deliveries : 0;

    // Time efficiency: ratio of active time vs total time (higher is better)
    // Assumes ideal is 80% active (20% for breaks, etc.)
    const idealActivePercentage = 80;
    const actualActivePercentage = totalTime > 0 ? (totalTime / (totalHours * 60)) * 100 : 0;
    const timeEfficiency = Math.min(100, (actualActivePercentage / idealActivePercentage) * 100);

    return {
        totalDistance,
        totalTime,
        averageSpeed,
        timePerMile,
        deliveries,
        timePerDelivery,
        milesPerDelivery,
        efficiency: {
            deliveriesPerHour,
            milesPerHour,
            timeEfficiency
        }
    };
}

// ============================================
// PREDICTIVE ANALYTICS
// ============================================

export async function predictRemainingMileage(
    vanId: string,
    remainingDeliveries: number,
    date?: string
): Promise<{
    estimatedDistance: number;
    estimatedTime: number; // minutes
    estimatedCompletionTime: string;
}> {
    await delay(100);

    const stats = await getMileageStats(vanId, date);
    const correlation = await getTimeDistanceCorrelation(vanId, date);

    const estimatedDistance = stats.averageMilesPerDelivery * remainingDeliveries;
    const estimatedTime = correlation.timePerDelivery * remainingDeliveries;

    const now = new Date();
    const completionTime = new Date(now.getTime() + estimatedTime * 60000);

    return {
        estimatedDistance,
        estimatedTime,
        estimatedCompletionTime: completionTime.toISOString()
    };
}

// ============================================
// HISTORICAL ANALYSIS
// ============================================

export async function getMileageHistory(
    vanId: string,
    days: number = 7
): Promise<MileageRecord[]> {
    await delay(150);

    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);

    return records
        .filter(r => r.vanId === vanId && r.date >= startDate)
        .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getAverageDailyMileage(
    vanId: string,
    days: number = 7
): Promise<number> {
    await delay(100);

    const history = await getMileageHistory(vanId, days);

    if (history.length === 0) return 0;

    const totalMiles = history.reduce((sum, r) => sum + r.totalDistance, 0);
    return totalMiles / history.length;
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupOldMileageRecords(daysToKeep: number = 30): Promise<number> {
    await delay(100);

    const cutoffDate = new Date(Date.now() - daysToKeep * 86400000).toISOString().split('T')[0];
    const records = getStorage<MileageRecord>(STORAGE_KEY_MILEAGE_RECORDS);
    const filtered = records.filter(r => r.date >= cutoffDate);
    const removed = records.length - filtered.length;

    setStorage(STORAGE_KEY_MILEAGE_RECORDS, filtered);
    return removed;
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Record management
    initializeDailyMileage,
    getMileageRecord,
    updateMileage,

    // Segment tracking
    recordMileageSegment,
    calculateSegmentDistance,

    // Statistics
    getMileageStats,
    getFleetMileageStats,

    // Correlation
    getTimeDistanceCorrelation,

    // Predictions
    predictRemainingMileage,

    // Historical
    getMileageHistory,
    getAverageDailyMileage,

    // Cleanup
    cleanupOldMileageRecords
};
