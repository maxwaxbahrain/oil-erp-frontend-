// ============================================
// POD TEST DATA GENERATOR
// Generates realistic test data for POD system
// ============================================

import { initializeVans, createDelivery, VAN_COLORS } from '../services/podService';
import { recordLocation, createGeofence } from '../services/locationService';
import { recordTimeEvent } from '../services/timeTrackingService';
import { initializeDailyMileage, recordMileageSegment } from '../services/mileageService';
import { updateVanStatus } from '../services/vanTrackingService';
import { createAlert } from '../services/alertService';

// ============================================
// CONFIGURATION
// ============================================

const WAREHOUSE_LOCATION = {
    latitude: 40.7128,
    longitude: -74.0060,
    name: 'Main Warehouse'
};

const DELIVERY_LOCATIONS = [
    { lat: 40.7580, lon: -73.9855, name: 'Times Square', address: '1560 Broadway, New York, NY' },
    { lat: 40.7614, lon: -73.9776, name: 'Central Park South', address: '59th St, New York, NY' },
    { lat: 40.7489, lon: -73.9680, name: 'Grand Central', address: '89 E 42nd St, New York, NY' },
    { lat: 40.7527, lon: -73.9772, name: 'Rockefeller Center', address: '45 Rockefeller Plaza, New York, NY' },
    { lat: 40.7484, lon: -73.9857, name: 'Empire State Building', address: '350 5th Ave, New York, NY' },
    { lat: 40.7061, lon: -74.0087, name: 'World Trade Center', address: '285 Fulton St, New York, NY' },
    { lat: 40.7067, lon: -74.0123, name: 'Battery Park', address: 'Battery Park, New York, NY' },
    { lat: 40.7282, lon: -73.9942, name: 'Washington Square', address: 'Washington Square Park, New York, NY' },
    { lat: 40.7614, lon: -73.9776, name: 'Columbus Circle', address: 'Columbus Circle, New York, NY' },
    { lat: 40.7829, lon: -73.9654, name: 'Upper East Side', address: 'E 86th St, New York, NY' }
];

const DRIVER_NAMES = [
    'John Smith',
    'Maria Garcia',
    'James Johnson',
    'Sarah Williams',
    'Michael Brown',
    'Jennifer Davis',
    'Robert Miller',
    'Lisa Wilson',
    'David Moore',
    'Emily Taylor'
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
    return Math.floor(randomBetween(min, max));
}

function randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ============================================
// GEOFENCE SETUP
// ============================================

export async function setupGeofences(): Promise<void> {
    console.log('🗺️  Setting up geofences...');

    // Warehouse geofence
    await createGeofence(
        WAREHOUSE_LOCATION.name,
        'warehouse',
        WAREHOUSE_LOCATION.latitude,
        WAREHOUSE_LOCATION.longitude,
        100 // 100 meter radius
    );

    // Delivery zone geofences
    for (const location of DELIVERY_LOCATIONS.slice(0, 5)) {
        await createGeofence(
            `${location.name} Zone`,
            'delivery_zone',
            location.lat,
            location.lon,
            50 // 50 meter radius
        );
    }

    console.log('✅ Geofences created');
}

// ============================================
// VAN INITIALIZATION
// ============================================

export async function setupVans(): Promise<void> {
    console.log('🚐 Initializing vans...');

    await initializeVans();

    console.log('✅ 10 vans initialized');
}

// ============================================
// DELIVERY GENERATION
// ============================================

export async function generateDeliveries(vanId: string, count: number = 10): Promise<void> {
    console.log(`📦 Generating ${count} deliveries for ${vanId}...`);

    const today = new Date().toISOString().split('T')[0];
    const driverName = randomChoice(DRIVER_NAMES);

    for (let i = 0; i < count; i++) {
        const location = randomChoice(DELIVERY_LOCATIONS);
        const items = [
            {
                name: randomChoice(['Motor Oil 5W-30', 'Brake Fluid', 'Transmission Fluid', 'Coolant']),
                quantity: randomInt(1, 5),
                unit: 'bottles'
            }
        ];
        const packageCount = items.reduce((s, it) => s + it.quantity, 0);
        const priority = randomChoice(['Normal', 'High', 'Urgent']);
        const progressNote = i < 3 ? `Delivery ${i + 1} - In progress` : '';

        await createDelivery({
            vanId,
            vanColor: VAN_COLORS[vanId as keyof typeof VAN_COLORS]?.color ?? '#0077C8',
            driverId: driverName,
            driverName: driverName,
            customerId: `CUST-${vanId}-${i + 1}`,
            customerName: `Customer ${i + 1}`,
            deliveryAddress: location.address,
            packageCount,
            status: 'Pending',
            scheduledDate: today,
            photos: [],
            deliveryNotes: [progressNote, `Priority: ${priority}`].filter(Boolean).join(' • ')
        });
    }

    console.log(`✅ ${count} deliveries created for ${vanId}`);
}

// ============================================
// SIMULATE VAN ACTIVITY
// ============================================

export async function simulateVanActivity(vanId: string, driverName: string): Promise<void> {
    console.log(`🚚 Simulating activity for ${vanId}...`);

    const today = new Date().toISOString().split('T')[0];
    let currentTime = new Date();
    currentTime.setHours(8, 0, 0, 0); // Start at 8 AM

    // 1. Shift Start
    await recordTimeEvent(vanId, driverName, driverName, 'shift_start');
    await updateVanStatus(vanId, 'Loading', {
        latitude: WAREHOUSE_LOCATION.latitude,
        longitude: WAREHOUSE_LOCATION.longitude,
        accuracy: 10
    });

    // 2. Loading
    await recordTimeEvent(vanId, driverName, driverName, 'loading_start');
    currentTime = addMinutes(currentTime, randomInt(20, 40));

    await recordLocation(
        vanId,
        WAREHOUSE_LOCATION.latitude,
        WAREHOUSE_LOCATION.longitude,
        10,
        0,
        0,
        95
    );

    await recordTimeEvent(vanId, driverName, driverName, 'loading_end');

    // 3. Initialize mileage
    await initializeDailyMileage(vanId, randomInt(50000, 100000), today);

    // 4. Simulate deliveries
    const deliveryCount = randomInt(3, 8);
    let currentLat = WAREHOUSE_LOCATION.latitude;
    let currentLon = WAREHOUSE_LOCATION.longitude;

    for (let i = 0; i < deliveryCount; i++) {
        const location = DELIVERY_LOCATIONS[i % DELIVERY_LOCATIONS.length];

        // Transit
        await updateVanStatus(vanId, 'In Transit', {
            latitude: currentLat,
            longitude: currentLon,
            accuracy: 15
        });

        const distance = calculateDistance(currentLat, currentLon, location.lat, location.lon);
        const transitTime = (distance / 25) * 60; // Assume 25 mph average
        currentTime = addMinutes(currentTime, transitTime);

        // Record transit location points
        const steps = 3;
        for (let j = 0; j < steps; j++) {
            const progress = (j + 1) / steps;
            const lat = currentLat + (location.lat - currentLat) * progress;
            const lon = currentLon + (location.lon - currentLon) * progress;

            await recordLocation(vanId, lat, lon, 12, 25, randomInt(0, 360), 90);
        }

        // Arrival
        await recordTimeEvent(vanId, driverName, driverName, 'arrival', `delivery-${i + 1}`, {
            latitude: location.lat,
            longitude: location.lon
        });

        await updateVanStatus(vanId, 'At Location', {
            latitude: location.lat,
            longitude: location.lon,
            accuracy: 8
        });

        currentTime = addMinutes(currentTime, randomInt(2, 5));

        // Delivery
        await recordTimeEvent(vanId, driverName, driverName, 'delivery_start', `delivery-${i + 1}`);
        await updateVanStatus(vanId, 'Delivering');

        const deliveryTime = randomInt(5, 15);
        currentTime = addMinutes(currentTime, deliveryTime);

        await recordTimeEvent(vanId, driverName, driverName, 'delivery_end', `delivery-${i + 1}`);

        // Record mileage segment
        await recordMileageSegment(
            vanId,
            i === 0 ? WAREHOUSE_LOCATION.name : DELIVERY_LOCATIONS[(i - 1) % DELIVERY_LOCATIONS.length].name,
            location.name,
            distance,
            transitTime + deliveryTime,
            `delivery-${i + 1}`,
            today
        );

        // Departure
        await recordTimeEvent(vanId, driverName, driverName, 'departure', `delivery-${i + 1}`);

        currentLat = location.lat;
        currentLon = location.lon;
    }

    // 5. Return to warehouse
    await updateVanStatus(vanId, 'Returning', {
        latitude: currentLat,
        longitude: currentLon,
        accuracy: 12
    });

    const returnDistance = calculateDistance(currentLat, currentLon, WAREHOUSE_LOCATION.latitude, WAREHOUSE_LOCATION.longitude);
    const returnTime = (returnDistance / 25) * 60;
    currentTime = addMinutes(currentTime, returnTime);

    await recordLocation(
        vanId,
        WAREHOUSE_LOCATION.latitude,
        WAREHOUSE_LOCATION.longitude,
        10,
        0,
        0,
        85
    );

    await recordMileageSegment(
        vanId,
        DELIVERY_LOCATIONS[(deliveryCount - 1) % DELIVERY_LOCATIONS.length].name,
        WAREHOUSE_LOCATION.name,
        returnDistance,
        returnTime,
        undefined,
        today
    );

    // 6. Shift end
    await updateVanStatus(vanId, 'Completed', {
        latitude: WAREHOUSE_LOCATION.latitude,
        longitude: WAREHOUSE_LOCATION.longitude,
        accuracy: 10
    });

    await recordTimeEvent(vanId, driverName, driverName, 'shift_end');

    console.log(`✅ Activity simulated for ${vanId} (${deliveryCount} deliveries)`);
}

// ============================================
// GENERATE SAMPLE ALERTS
// ============================================

export async function generateSampleAlerts(): Promise<void> {
    console.log('🔔 Generating sample alerts...');

    const vans = ['VAN-1', 'VAN-2', 'VAN-3', 'VAN-4', 'VAN-5'];

    // Critical alert
    await createAlert(
        vans[0],
        'Van 1',
        'performance',
        'critical',
        'Low Success Rate',
        'Delivery success rate (65%) below target (80%)',
        true,
        'Investigate failed deliveries and address issues',
        { rate: 65, target: 80 }
    );

    // Warning alerts
    await createAlert(
        vans[1],
        'Van 2',
        'time',
        'warning',
        'Extended Loading Time',
        'Loading time (52 min) exceeds threshold (45 min)',
        true,
        'Check for loading process issues or staffing needs',
        { loadingTime: 52, threshold: 45 }
    );

    await createAlert(
        vans[2],
        'Van 3',
        'performance',
        'warning',
        'Low Delivery Rate',
        'Delivery rate (1.5 del/hr) below target (2.0 del/hr)',
        true,
        'Review route efficiency or check for delays',
        { rate: 1.5, target: 2.0 }
    );

    // Info alerts
    await createAlert(
        vans[3],
        'Van 4',
        'location',
        'info',
        'Geofence Entry',
        'Van entered delivery zone',
        false,
        undefined,
        { zone: 'Times Square Zone' }
    );

    await createAlert(
        vans[4],
        'Van 5',
        'status',
        'info',
        'Status Change',
        'Van status changed to In Transit',
        false,
        undefined,
        { fromStatus: 'Loading', toStatus: 'In Transit' }
    );

    console.log('✅ Sample alerts generated');
}

// ============================================
// MAIN SETUP FUNCTION
// ============================================

export async function setupTestData(): Promise<void> {
    console.log('🚀 Starting POD test data generation...\n');

    try {
        // 1. Setup geofences
        await setupGeofences();
        console.log('');

        // 2. Initialize vans
        await setupVans();
        console.log('');

        // 3. Generate deliveries for all vans
        const vans = ['VAN-1', 'VAN-2', 'VAN-3', 'VAN-4', 'VAN-5', 'VAN-6', 'VAN-7', 'VAN-8', 'VAN-9', 'VAN-10'];
        for (const vanId of vans) {
            await generateDeliveries(vanId, randomInt(8, 12));
        }
        console.log('');

        // 4. Simulate activity for first 5 vans
        for (let i = 0; i < 5; i++) {
            await simulateVanActivity(vans[i], DRIVER_NAMES[i]);
        }
        console.log('');

        // 5. Generate sample alerts
        await generateSampleAlerts();
        console.log('');

        console.log('✅ Test data generation complete!\n');
        console.log('📊 Summary:');
        console.log('   - 10 vans initialized');
        console.log('   - 6 geofences created');
        console.log('   - 80-120 deliveries generated');
        console.log('   - 5 vans with simulated activity');
        console.log('   - 5 sample alerts created');
        console.log('\n🎯 You can now test the POD system!');
        console.log('   Driver App: http://localhost:5173/logistics/pod');
        console.log('   Management Dashboard: http://localhost:5173/pod/management');

    } catch (error) {
        console.error('❌ Error generating test data:', error);
        throw error;
    }
}

// ============================================
// CLEANUP FUNCTION
// ============================================

export async function cleanupTestData(): Promise<void> {
    console.log('🧹 Cleaning up test data...');

    const keys = [
        'pod_vans',
        'pod_deliveries',
        'pod_driver_sessions',
        'pod_van_status',
        'pod_status_history',
        'pod_location_history',
        'pod_geofences',
        'pod_time_tracking',
        'pod_mileage_records',
        'pod_alerts',
        'pod_alert_config'
    ];

    keys.forEach(key => localStorage.removeItem(key));

    console.log('✅ Test data cleaned up');
}
