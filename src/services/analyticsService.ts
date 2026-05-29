// ============================================
// ANALYTICS SERVICE - Performance Metrics & Insights
// Comprehensive analytics for POD system
// ============================================

import { getVans } from './api';
import { listDeliveryNotes, type DeliveryNote } from './deliveryService';

// ============================================
// INTERFACES
// ============================================

export interface VanPerformanceMetrics {
    vanId: string;
    vanName: string;
    date: string;

    // Delivery metrics
    deliveriesCompleted: number;
    deliveriesPending: number;
    deliverySuccessRate: number; // percentage

    // Time metrics
    totalShiftTime: number; // minutes
    loadingTime: number;
    transitTime: number;
    deliveryTime: number;
    breakTime: number;
    idleTime: number;
    averageDeliveryTime: number;

    // Distance metrics
    totalDistance: number; // miles
    averageDistancePerDelivery: number;

    // Efficiency metrics
    deliveriesPerHour: number;
    milesPerHour: number;
    timeEfficiency: number; // percentage

    // Scores
    overallEfficiencyScore: number; // 0-100
    performanceRating: 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';
}

export interface FleetAnalytics {
    date: string;

    // Fleet overview
    totalVans: number;
    activeVans: number;
    idleVans: number;

    // Delivery totals
    totalDeliveries: number;
    completedDeliveries: number;
    pendingDeliveries: number;
    failedDeliveries: number;

    // Time totals
    totalFleetTime: number; // minutes
    totalLoadingTime: number;
    totalTransitTime: number;
    totalDeliveryTime: number;

    // Distance totals
    totalFleetMiles: number;
    averageMilesPerVan: number;

    // Fleet averages
    averageDeliveriesPerVan: number;
    averageDeliveryTime: number;
    averageLoadingTime: number;
    averageEfficiencyScore: number;

    // Top performers
    topPerformer?: {
        vanId: string;
        vanName: string;
        score: number;
    };

    // Needs attention
    needsAttention?: {
        vanId: string;
        vanName: string;
        reason: string;
    }[];
}

export interface ComparativeAnalysis {
    vanId: string;
    vanName: string;

    // Comparison to fleet average
    vsFleetAverage: {
        deliveryTime: number; // percentage difference
        loadingTime: number;
        efficiency: number;
        milesPerDelivery: number;
    };

    // Comparison to personal best
    vsPersonalBest: {
        deliveryTime: number;
        loadingTime: number;
        efficiency: number;
    };

    // Ranking
    fleetRanking: number; // 1-10
    totalVans: number;
}

export interface PredictiveAnalytics {
    vanId: string;

    // Current status
    currentDeliveries: number;
    remainingDeliveries: number;

    // Predictions
    estimatedCompletionTime: string;
    estimatedReturnTime: string;
    estimatedRemainingDistance: number; // miles
    estimatedRemainingTime: number; // minutes

    // Confidence
    confidence: 'High' | 'Medium' | 'Low';

    // Alerts
    onSchedule: boolean;
    minutesAheadBehind: number; // positive = ahead, negative = behind

    // Recommendations
    recommendations: string[];
}

export interface TrendAnalysis {
    vanId: string;
    period: 'week' | 'month';

    // Trends
    deliveryTimeTrend: 'improving' | 'stable' | 'declining';
    efficiencyTrend: 'improving' | 'stable' | 'declining';
    mileageTrend: 'increasing' | 'stable' | 'decreasing';

    // Changes
    deliveryTimeChange: number; // percentage
    efficiencyChange: number;
    mileageChange: number;

    // Insights
    insights: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function notesForDate(notes: DeliveryNote[], targetDate: string): DeliveryNote[] {
    return notes.filter((note) => note.delivery_date?.slice(0, 10) === targetDate);
}

// ============================================
// VAN PERFORMANCE METRICS
// ============================================

export async function getVanPerformanceMetrics(
    vanId: string,
    date?: string
): Promise<VanPerformanceMetrics> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const [vans, notes] = await Promise.all([getVans(), listDeliveryNotes({ van_id: vanId })]);
    const van = vans.find(v => v.id === vanId || v.van_number === vanId);
    const vanName = van?.van_number || vanId;
    const todayDeliveries = notesForDate(notes, targetDate);
    const completed = todayDeliveries.filter(d => d.status === 'delivered').length;
    const pending = todayDeliveries.filter(d => ['pending', 'in_transit'].includes(d.status)).length;
    const failed = todayDeliveries.filter(d => d.status === 'failed').length;
    const totalAttempted = completed + failed;
    const successRate = totalAttempted > 0 ? (completed / totalAttempted) * 100 : 0;

    return {
        vanId,
        vanName,
        date: targetDate,

        deliveriesCompleted: completed,
        deliveriesPending: pending,
        deliverySuccessRate: successRate,

        totalShiftTime: 0,
        loadingTime: 0,
        transitTime: 0,
        deliveryTime: 0,
        breakTime: 0,
        idleTime: 0,
        averageDeliveryTime: 0,

        totalDistance: 0,
        averageDistancePerDelivery: 0,

        deliveriesPerHour: 0,
        milesPerHour: 0,
        timeEfficiency: 0,

        overallEfficiencyScore: 0,
        performanceRating: 'Average'
    };
}

// ============================================
// FLEET ANALYTICS
// ============================================

export async function getFleetAnalytics(date?: string): Promise<FleetAnalytics> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const [vans, notes] = await Promise.all([getVans(), listDeliveryNotes()]);
    const totalVans = vans.length;
    const activeVans = vans.filter((van) => String(van.status).toLowerCase() === 'active').length;
    const idleVans = totalVans - activeVans;
    const dateNotes = notesForDate(notes, targetDate);
    const totalDeliveries = dateNotes.length;
    const completedDeliveries = dateNotes.filter((note) => note.status === 'delivered').length;
    const pendingDeliveries = dateNotes.filter((note) => ['pending', 'in_transit'].includes(note.status)).length;
    const failedDeliveries = dateNotes.filter((note) => note.status === 'failed').length;
    const averageDeliveriesPerVan = totalVans > 0 ? totalDeliveries / totalVans : 0;

    return {
        date: targetDate,
        totalVans,
        activeVans,
        idleVans,
        totalDeliveries,
        completedDeliveries,
        pendingDeliveries,
        failedDeliveries,
        totalFleetTime: 0,
        totalLoadingTime: 0,
        totalTransitTime: 0,
        totalDeliveryTime: 0,
        totalFleetMiles: 0,
        averageMilesPerVan: 0,
        averageDeliveriesPerVan,
        averageDeliveryTime: 0,
        averageLoadingTime: 0,
        averageEfficiencyScore: 0,
        topPerformer: undefined,
        needsAttention: []
    };
}

// ============================================
// COMPARATIVE ANALYSIS
// ============================================

export async function getComparativeAnalysis(
    vanId: string,
    date?: string
): Promise<ComparativeAnalysis> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const vanMetrics = await getVanPerformanceMetrics(vanId, targetDate);
    const fleetAnalytics = await getFleetAnalytics(targetDate);

    return {
        vanId,
        vanName: vanMetrics.vanName,
        vsFleetAverage: {
            deliveryTime: 0,
            loadingTime: 0,
            efficiency: 0,
            milesPerDelivery: 0
        },
        vsPersonalBest: {
            deliveryTime: 0, // TODO: implement personal best tracking
            loadingTime: 0,
            efficiency: 0
        },
        fleetRanking: 0,
        totalVans: fleetAnalytics.totalVans
    };
}

// ============================================
// PREDICTIVE ANALYTICS
// ============================================

export async function getPredictiveAnalytics(
    vanId: string,
    date?: string
): Promise<PredictiveAnalytics> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const notes = await listDeliveryNotes({ van_id: vanId });
    const todayDeliveries = notesForDate(notes, targetDate);
    const completed = todayDeliveries.filter(d => d.status === 'delivered').length;
    const remaining = todayDeliveries.filter(d => ['pending', 'in_transit'].includes(d.status)).length;

    return {
        vanId,
        currentDeliveries: completed,
        remainingDeliveries: remaining,
        estimatedCompletionTime: '',
        estimatedReturnTime: '',
        estimatedRemainingDistance: 0,
        estimatedRemainingTime: 0,
        confidence: 'Low',
        onSchedule: true,
        minutesAheadBehind: 0,
        recommendations: ['No backend predictive telemetry yet']
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export default {
    getVanPerformanceMetrics,
    getFleetAnalytics,
    getComparativeAnalysis,
    getPredictiveAnalytics
};
