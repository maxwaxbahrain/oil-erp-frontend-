// ============================================
// TIME TRACKING SERVICE - Delivery Time Analytics
// Tracks loading, delivery, and transit times
// ============================================

import { differenceInMinutes } from 'date-fns';

const STORAGE_KEY_TIME_TRACKING = 'pod_time_tracking';

// ============================================
// INTERFACES
// ============================================

export type TimeEventType =
    | 'shift_start'
    | 'loading_start'
    | 'loading_end'
    | 'transit_start'
    | 'arrival'
    | 'delivery_start'
    | 'delivery_end'
    | 'departure'
    | 'break_start'
    | 'break_end'
    | 'shift_end';

export interface TimeEvent {
    id: string;
    vanId: string;
    driverId: string;
    driverName: string;
    eventType: TimeEventType;
    timestamp: string;
    deliveryId?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
    metadata?: any;
}

export interface TimeSegment {
    type: 'loading' | 'transit' | 'delivery' | 'break' | 'idle';
    startTime: string;
    endTime: string;
    duration: number; // minutes
    deliveryId?: string;
}

export interface DailyTimeBreakdown {
    date: string;
    vanId: string;
    driverId: string;
    shiftStart?: string;
    shiftEnd?: string;
    totalShiftTime: number; // minutes
    loadingTime: number;
    transitTime: number;
    deliveryTime: number;
    breakTime: number;
    idleTime: number;
    segments: TimeSegment[];
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
// TIME EVENT RECORDING
// ============================================

export async function recordTimeEvent(
    vanId: string,
    driverId: string,
    driverName: string,
    eventType: TimeEventType,
    deliveryId?: string,
    location?: { latitude: number; longitude: number },
    metadata?: any
): Promise<TimeEvent> {
    await delay(50);

    const event: TimeEvent = {
        id: crypto.randomUUID(),
        vanId,
        driverId,
        driverName,
        eventType,
        timestamp: new Date().toISOString(),
        deliveryId,
        location,
        metadata
    };

    const events = getStorage<TimeEvent>(STORAGE_KEY_TIME_TRACKING);
    setStorage(STORAGE_KEY_TIME_TRACKING, [event, ...events]);

    return event;
}

export async function getTimeEvents(
    vanId: string,
    startDate?: string,
    endDate?: string
): Promise<TimeEvent[]> {
    await delay(100);
    let events = getStorage<TimeEvent>(STORAGE_KEY_TIME_TRACKING);

    events = events.filter(e => e.vanId === vanId);

    if (startDate) {
        events = events.filter(e => e.timestamp >= startDate);
    }

    if (endDate) {
        events = events.filter(e => e.timestamp <= endDate);
    }

    return events.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}

export async function getTodayTimeEvents(vanId: string): Promise<TimeEvent[]> {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    return getTimeEvents(vanId, today, tomorrow);
}

// ============================================
// TIME CALCULATIONS
// ============================================

export async function calculateLoadingTime(
    vanId: string,
    date?: string
): Promise<number> {
    await delay(100);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = await getTimeEvents(vanId, targetDate);

    const loadingStarts = events.filter(e => e.eventType === 'loading_start');
    const loadingEnds = events.filter(e => e.eventType === 'loading_end');

    if (loadingStarts.length === 0 || loadingEnds.length === 0) return 0;

    let totalMinutes = 0;

    for (let i = 0; i < Math.min(loadingStarts.length, loadingEnds.length); i++) {
        const start = new Date(loadingStarts[i].timestamp);
        const end = new Date(loadingEnds[i].timestamp);
        totalMinutes += differenceInMinutes(end, start);
    }

    return totalMinutes;
}

export async function calculateDeliveryTime(
    deliveryId: string
): Promise<{
    arrivalTime?: string;
    deliveryStartTime?: string;
    deliveryEndTime?: string;
    totalStopTime: number; // minutes
    activeDeliveryTime: number; // minutes
    idleTime: number; // minutes
}> {
    await delay(100);

    const events = getStorage<TimeEvent>(STORAGE_KEY_TIME_TRACKING);
    const deliveryEvents = events.filter(e => e.deliveryId === deliveryId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const arrival = deliveryEvents.find(e => e.eventType === 'arrival');
    const deliveryStart = deliveryEvents.find(e => e.eventType === 'delivery_start');
    const deliveryEnd = deliveryEvents.find(e => e.eventType === 'delivery_end');
    const departure = deliveryEvents.find(e => e.eventType === 'departure');

    let totalStopTime = 0;
    let activeDeliveryTime = 0;
    let idleTime = 0;

    if (arrival && (departure || deliveryEnd)) {
        const end = departure || deliveryEnd;
        totalStopTime = differenceInMinutes(new Date(end!.timestamp), new Date(arrival.timestamp));
    }

    if (deliveryStart && deliveryEnd) {
        activeDeliveryTime = differenceInMinutes(
            new Date(deliveryEnd.timestamp),
            new Date(deliveryStart.timestamp)
        );
    }

    idleTime = totalStopTime - activeDeliveryTime;

    return {
        arrivalTime: arrival?.timestamp,
        deliveryStartTime: deliveryStart?.timestamp,
        deliveryEndTime: deliveryEnd?.timestamp,
        totalStopTime,
        activeDeliveryTime,
        idleTime
    };
}

export async function calculateTransitTime(
    vanId: string,
    fromDeliveryId?: string,
    toDeliveryId?: string
): Promise<number> {
    await delay(100);

    const events = getStorage<TimeEvent>(STORAGE_KEY_TIME_TRACKING);

    let departureEvent: TimeEvent | undefined;
    let arrivalEvent: TimeEvent | undefined;

    if (fromDeliveryId) {
        departureEvent = events.find(e =>
            e.vanId === vanId &&
            e.deliveryId === fromDeliveryId &&
            e.eventType === 'departure'
        );
    }

    if (toDeliveryId) {
        arrivalEvent = events.find(e =>
            e.vanId === vanId &&
            e.deliveryId === toDeliveryId &&
            e.eventType === 'arrival'
        );
    }

    if (!departureEvent || !arrivalEvent) return 0;

    return differenceInMinutes(
        new Date(arrivalEvent.timestamp),
        new Date(departureEvent.timestamp)
    );
}

// ============================================
// DAILY TIME BREAKDOWN
// ============================================

export async function getDailyTimeBreakdown(
    vanId: string,
    date?: string
): Promise<DailyTimeBreakdown> {
    await delay(150);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = await getTimeEvents(vanId, targetDate);

    const shiftStart = events.find(e => e.eventType === 'shift_start');
    const shiftEnd = events.find(e => e.eventType === 'shift_end');

    const segments: TimeSegment[] = [];
    let loadingTime = 0;
    let transitTime = 0;
    let deliveryTime = 0;
    let breakTime = 0;
    let idleTime = 0;

    // Calculate loading time
    const loadingStarts = events.filter(e => e.eventType === 'loading_start');
    const loadingEnds = events.filter(e => e.eventType === 'loading_end');

    for (let i = 0; i < Math.min(loadingStarts.length, loadingEnds.length); i++) {
        const start = loadingStarts[i].timestamp;
        const end = loadingEnds[i].timestamp;
        const duration = differenceInMinutes(new Date(end), new Date(start));

        loadingTime += duration;
        segments.push({
            type: 'loading',
            startTime: start,
            endTime: end,
            duration
        });
    }

    // Calculate delivery times
    const deliveryStarts = events.filter(e => e.eventType === 'delivery_start');
    const deliveryEnds = events.filter(e => e.eventType === 'delivery_end');

    for (let i = 0; i < Math.min(deliveryStarts.length, deliveryEnds.length); i++) {
        const start = deliveryStarts[i].timestamp;
        const end = deliveryEnds[i].timestamp;
        const duration = differenceInMinutes(new Date(end), new Date(start));

        deliveryTime += duration;
        segments.push({
            type: 'delivery',
            startTime: start,
            endTime: end,
            duration,
            deliveryId: deliveryStarts[i].deliveryId
        });
    }

    // Calculate break times
    const breakStarts = events.filter(e => e.eventType === 'break_start');
    const breakEnds = events.filter(e => e.eventType === 'break_end');

    for (let i = 0; i < Math.min(breakStarts.length, breakEnds.length); i++) {
        const start = breakStarts[i].timestamp;
        const end = breakEnds[i].timestamp;
        const duration = differenceInMinutes(new Date(end), new Date(start));

        breakTime += duration;
        segments.push({
            type: 'break',
            startTime: start,
            endTime: end,
            duration
        });
    }

    // Calculate transit time (time between deliveries)
    const departures = events.filter(e => e.eventType === 'departure');
    const arrivals = events.filter(e => e.eventType === 'arrival');

    for (let i = 0; i < Math.min(departures.length, arrivals.length); i++) {
        const start = departures[i].timestamp;
        const end = arrivals[i].timestamp;
        const duration = differenceInMinutes(new Date(end), new Date(start));

        transitTime += duration;
        segments.push({
            type: 'transit',
            startTime: start,
            endTime: end,
            duration
        });
    }

    const totalShiftTime = shiftStart && shiftEnd
        ? differenceInMinutes(new Date(shiftEnd.timestamp), new Date(shiftStart.timestamp))
        : 0;

    // Calculate idle time (remaining time)
    idleTime = Math.max(0, totalShiftTime - loadingTime - transitTime - deliveryTime - breakTime);

    return {
        date: targetDate,
        vanId,
        driverId: shiftStart?.driverId || '',
        shiftStart: shiftStart?.timestamp,
        shiftEnd: shiftEnd?.timestamp,
        totalShiftTime,
        loadingTime,
        transitTime,
        deliveryTime,
        breakTime,
        idleTime,
        segments: segments.sort((a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
    };
}

// ============================================
// AVERAGE TIME CALCULATIONS
// ============================================

export async function getAverageDeliveryTime(
    vanId: string,
    days: number = 7
): Promise<number> {
    await delay(100);

    const startDate = new Date(Date.now() - days * 86400000).toISOString();
    const events = await getTimeEvents(vanId, startDate);

    const deliveryStarts = events.filter(e => e.eventType === 'delivery_start');
    const deliveryEnds = events.filter(e => e.eventType === 'delivery_end');

    if (deliveryStarts.length === 0 || deliveryEnds.length === 0) return 0;

    let totalMinutes = 0;
    let count = 0;

    for (let i = 0; i < Math.min(deliveryStarts.length, deliveryEnds.length); i++) {
        const start = new Date(deliveryStarts[i].timestamp);
        const end = new Date(deliveryEnds[i].timestamp);
        totalMinutes += differenceInMinutes(end, start);
        count++;
    }

    return count > 0 ? totalMinutes / count : 0;
}

export async function getAverageLoadingTime(
    vanId: string,
    days: number = 7
): Promise<number> {
    await delay(100);

    const startDate = new Date(Date.now() - days * 86400000).toISOString();
    const events = await getTimeEvents(vanId, startDate);

    const loadingStarts = events.filter(e => e.eventType === 'loading_start');
    const loadingEnds = events.filter(e => e.eventType === 'loading_end');

    if (loadingStarts.length === 0 || loadingEnds.length === 0) return 0;

    let totalMinutes = 0;
    let count = 0;

    for (let i = 0; i < Math.min(loadingStarts.length, loadingEnds.length); i++) {
        const start = new Date(loadingStarts[i].timestamp);
        const end = new Date(loadingEnds[i].timestamp);
        totalMinutes += differenceInMinutes(end, start);
        count++;
    }

    return count > 0 ? totalMinutes / count : 0;
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupOldTimeEvents(daysToKeep: number = 30): Promise<number> {
    await delay(100);

    const cutoffDate = new Date(Date.now() - daysToKeep * 86400000).toISOString();
    const events = getStorage<TimeEvent>(STORAGE_KEY_TIME_TRACKING);
    const filtered = events.filter(e => e.timestamp >= cutoffDate);
    const removed = events.length - filtered.length;

    setStorage(STORAGE_KEY_TIME_TRACKING, filtered);
    return removed;
}

// ============================================
// EXPORTS
// ============================================

export default {
    // Event recording
    recordTimeEvent,
    getTimeEvents,
    getTodayTimeEvents,

    // Time calculations
    calculateLoadingTime,
    calculateDeliveryTime,
    calculateTransitTime,
    getDailyTimeBreakdown,

    // Averages
    getAverageDeliveryTime,
    getAverageLoadingTime,

    // Cleanup
    cleanupOldTimeEvents
};
