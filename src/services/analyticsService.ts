// ============================================
// ANALYTICS SERVICE - Performance Metrics & Insights
// Comprehensive analytics for POD system
// ============================================

import { getVans, getDeliveriesByVan } from './podService';
import { getCurrentVanStatus } from './vanTrackingService';
import { getDailyTimeBreakdown, getAverageDeliveryTime } from './timeTrackingService';
import { getMileageStats, getTimeDistanceCorrelation, getFleetMileageStats } from './mileageService';

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// VAN PERFORMANCE METRICS
// ============================================

export async function getVanPerformanceMetrics(
    vanId: string,
    date?: string
): Promise<VanPerformanceMetrics> {
    await delay(200);

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get van info
    const vans = await getVans();
    const van = vans.find(v => v.id === vanId);
    const vanName = van?.name || vanId;

    // Get deliveries
    const deliveries = await getDeliveriesByVan(vanId);
    const todayDeliveries = deliveries.filter(d => d.scheduledDate === targetDate);
    const completed = todayDeliveries.filter(d => d.status === 'Delivered').length;
    const pending = todayDeliveries.filter(d => ['Pending', 'In Transit'].includes(d.status)).length;
    const failed = todayDeliveries.filter(d => ['Failed', 'Refused', 'Not Home'].includes(d.status)).length;

    // Get time breakdown
    const timeBreakdown = await getDailyTimeBreakdown(vanId, targetDate);
    const avgDeliveryTime = await getAverageDeliveryTime(vanId, 1);

    // Get mileage stats
    const mileageStats = await getMileageStats(vanId, targetDate);
    const correlation = await getTimeDistanceCorrelation(vanId, targetDate);

    // Calculate success rate
    const totalAttempted = completed + failed;
    const successRate = totalAttempted > 0 ? (completed / totalAttempted) * 100 : 0;

    // Calculate efficiency score (0-100)
    const efficiencyScore = calculateEfficiencyScore({
        deliveriesPerHour: correlation.efficiency.deliveriesPerHour,
        avgDeliveryTime,
        timeEfficiency: correlation.efficiency.timeEfficiency,
        successRate
    });

    // Determine performance rating
    const rating = getPerformanceRating(efficiencyScore);

    return {
        vanId,
        vanName,
        date: targetDate,

        deliveriesCompleted: completed,
        deliveriesPending: pending,
        deliverySuccessRate: successRate,

        totalShiftTime: timeBreakdown.totalShiftTime,
        loadingTime: timeBreakdown.loadingTime,
        transitTime: timeBreakdown.transitTime,
        deliveryTime: timeBreakdown.deliveryTime,
        breakTime: timeBreakdown.breakTime,
        idleTime: timeBreakdown.idleTime,
        averageDeliveryTime: avgDeliveryTime,

        totalDistance: mileageStats.totalMiles,
        averageDistancePerDelivery: mileageStats.averageMilesPerDelivery,

        deliveriesPerHour: correlation.efficiency.deliveriesPerHour,
        milesPerHour: correlation.efficiency.milesPerHour,
        timeEfficiency: correlation.efficiency.timeEfficiency,

        overallEfficiencyScore: efficiencyScore,
        performanceRating: rating
    };
}

// ============================================
// FLEET ANALYTICS
// ============================================

export async function getFleetAnalytics(date?: string): Promise<FleetAnalytics> {
    await delay(300);

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get all vans
    const vans = await getVans();
    const totalVans = vans.length;

    // Get van statuses
    let activeVans = 0;
    for (const van of vans) {
        const status = await getCurrentVanStatus(van.id);
        if (status && status.status !== 'Idle') {
            activeVans++;
        }
    }
    const idleVans = totalVans - activeVans;

    // Get all performance metrics
    const allMetrics: VanPerformanceMetrics[] = [];
    for (const van of vans) {
        const metrics = await getVanPerformanceMetrics(van.id, targetDate);
        allMetrics.push(metrics);
    }

    // Calculate totals
    const totalDeliveries = allMetrics.reduce((sum, m) => sum + m.deliveriesCompleted + m.deliveriesPending, 0);
    const completedDeliveries = allMetrics.reduce((sum, m) => sum + m.deliveriesCompleted, 0);
    const pendingDeliveries = allMetrics.reduce((sum, m) => sum + m.deliveriesPending, 0);

    const totalFleetTime = allMetrics.reduce((sum, m) => sum + m.totalShiftTime, 0);
    const totalLoadingTime = allMetrics.reduce((sum, m) => sum + m.loadingTime, 0);
    const totalTransitTime = allMetrics.reduce((sum, m) => sum + m.transitTime, 0);
    const totalDeliveryTime = allMetrics.reduce((sum, m) => sum + m.deliveryTime, 0);

    const fleetMileageStats = await getFleetMileageStats(targetDate);

    // Calculate averages
    const averageDeliveriesPerVan = totalVans > 0 ? totalDeliveries / totalVans : 0;
    const averageDeliveryTime = allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.averageDeliveryTime, 0) / allMetrics.length
        : 0;
    const averageLoadingTime = allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.loadingTime, 0) / allMetrics.length
        : 0;
    const averageEfficiencyScore = allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.overallEfficiencyScore, 0) / allMetrics.length
        : 0;

    // Find top performer
    const sortedByScore = [...allMetrics].sort((a, b) => b.overallEfficiencyScore - a.overallEfficiencyScore);
    const topPerformer = sortedByScore[0] ? {
        vanId: sortedByScore[0].vanId,
        vanName: sortedByScore[0].vanName,
        score: sortedByScore[0].overallEfficiencyScore
    } : undefined;

    // Find vans needing attention
    const needsAttention = allMetrics
        .filter(m => m.overallEfficiencyScore < 50 || m.deliverySuccessRate < 80)
        .map(m => ({
            vanId: m.vanId,
            vanName: m.vanName,
            reason: m.overallEfficiencyScore < 50
                ? 'Low efficiency score'
                : 'Low delivery success rate'
        }));

    return {
        date: targetDate,
        totalVans,
        activeVans,
        idleVans,
        totalDeliveries,
        completedDeliveries,
        pendingDeliveries,
        failedDeliveries: 0, // TODO: track failed deliveries
        totalFleetTime,
        totalLoadingTime,
        totalTransitTime,
        totalDeliveryTime,
        totalFleetMiles: fleetMileageStats.totalFleetMiles,
        averageMilesPerVan: fleetMileageStats.averageMilesPerVan,
        averageDeliveriesPerVan,
        averageDeliveryTime,
        averageLoadingTime,
        averageEfficiencyScore,
        topPerformer,
        needsAttention
    };
}

// ============================================
// COMPARATIVE ANALYSIS
// ============================================

export async function getComparativeAnalysis(
    vanId: string,
    date?: string
): Promise<ComparativeAnalysis> {
    await delay(200);

    const targetDate = date || new Date().toISOString().split('T')[0];

    const vans = await getVans();
    const van = vans.find(v => v.id === vanId);
    const vanName = van?.name || vanId;

    // Get this van's metrics
    const vanMetrics = await getVanPerformanceMetrics(vanId, targetDate);

    // Get fleet analytics for comparison
    const fleetAnalytics = await getFleetAnalytics(targetDate);

    // Calculate differences from fleet average
    const deliveryTimeDiff = fleetAnalytics.averageDeliveryTime > 0
        ? ((vanMetrics.averageDeliveryTime - fleetAnalytics.averageDeliveryTime) / fleetAnalytics.averageDeliveryTime) * 100
        : 0;

    const loadingTimeDiff = fleetAnalytics.averageLoadingTime > 0
        ? ((vanMetrics.loadingTime - fleetAnalytics.averageLoadingTime) / fleetAnalytics.averageLoadingTime) * 100
        : 0;

    const efficiencyDiff = fleetAnalytics.averageEfficiencyScore > 0
        ? ((vanMetrics.overallEfficiencyScore - fleetAnalytics.averageEfficiencyScore) / fleetAnalytics.averageEfficiencyScore) * 100
        : 0;

    const milesDiff = fleetAnalytics.averageMilesPerVan > 0
        ? ((vanMetrics.averageDistancePerDelivery - (fleetAnalytics.totalFleetMiles / fleetAnalytics.totalDeliveries)) / (fleetAnalytics.totalFleetMiles / fleetAnalytics.totalDeliveries)) * 100
        : 0;

    // Get all vans' scores for ranking
    const allMetrics: VanPerformanceMetrics[] = [];
    for (const v of vans) {
        const metrics = await getVanPerformanceMetrics(v.id, targetDate);
        allMetrics.push(metrics);
    }

    const sortedByScore = [...allMetrics].sort((a, b) => b.overallEfficiencyScore - a.overallEfficiencyScore);
    const ranking = sortedByScore.findIndex(m => m.vanId === vanId) + 1;

    return {
        vanId,
        vanName,
        vsFleetAverage: {
            deliveryTime: deliveryTimeDiff,
            loadingTime: loadingTimeDiff,
            efficiency: efficiencyDiff,
            milesPerDelivery: milesDiff
        },
        vsPersonalBest: {
            deliveryTime: 0, // TODO: implement personal best tracking
            loadingTime: 0,
            efficiency: 0
        },
        fleetRanking: ranking,
        totalVans: vans.length
    };
}

// ============================================
// PREDICTIVE ANALYTICS
// ============================================

export async function getPredictiveAnalytics(
    vanId: string,
    date?: string
): Promise<PredictiveAnalytics> {
    await delay(200);

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get deliveries
    const deliveries = await getDeliveriesByVan(vanId);
    const todayDeliveries = deliveries.filter(d => d.scheduledDate === targetDate);
    const completed = todayDeliveries.filter(d => d.status === 'Delivered').length;
    const remaining = todayDeliveries.filter(d => ['Pending', 'In Transit'].includes(d.status)).length;

    // Get current performance
    const correlation = await getTimeDistanceCorrelation(vanId, targetDate);
    const avgDeliveryTime = await getAverageDeliveryTime(vanId, 1);

    // Predict remaining time and distance
    const estimatedRemainingTime = avgDeliveryTime * remaining;
    const estimatedRemainingDistance = correlation.milesPerDelivery * remaining;

    // Calculate completion time
    const now = new Date();
    const completionTime = new Date(now.getTime() + estimatedRemainingTime * 60000);
    const returnTime = new Date(completionTime.getTime() + 30 * 60000); // +30 min return

    // Determine if on schedule (assuming 8-hour shift)
    const shiftEndTime = new Date();
    shiftEndTime.setHours(17, 0, 0, 0); // 5 PM
    const onSchedule = completionTime <= shiftEndTime;
    const minutesAheadBehind = Math.round((shiftEndTime.getTime() - completionTime.getTime()) / 60000);

    // Determine confidence
    const confidence = completed >= 5 ? 'High' : completed >= 2 ? 'Medium' : 'Low';

    // Generate recommendations
    const recommendations: string[] = [];
    if (!onSchedule) {
        recommendations.push('Consider optimizing route to save time');
    }
    if (correlation.efficiency.deliveriesPerHour < 2) {
        recommendations.push('Delivery time is slower than average - check for issues');
    }
    if (estimatedRemainingDistance > 20) {
        recommendations.push('Long distance remaining - plan fuel stop if needed');
    }

    return {
        vanId,
        currentDeliveries: completed,
        remainingDeliveries: remaining,
        estimatedCompletionTime: completionTime.toISOString(),
        estimatedReturnTime: returnTime.toISOString(),
        estimatedRemainingDistance,
        estimatedRemainingTime,
        confidence,
        onSchedule,
        minutesAheadBehind,
        recommendations
    };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateEfficiencyScore(metrics: {
    deliveriesPerHour: number;
    avgDeliveryTime: number;
    timeEfficiency: number;
    successRate: number;
}): number {
    // Weighted scoring (0-100)
    const deliverySpeedScore = Math.min(100, (metrics.deliveriesPerHour / 3) * 100); // 3 del/hr = 100%
    const deliveryTimeScore = Math.max(0, 100 - (metrics.avgDeliveryTime / 5) * 100); // 5 min = 0%
    const timeEfficiencyScore = metrics.timeEfficiency;
    const successRateScore = metrics.successRate;

    // Weighted average
    const score = (
        deliverySpeedScore * 0.3 +
        deliveryTimeScore * 0.2 +
        timeEfficiencyScore * 0.3 +
        successRateScore * 0.2
    );

    return Math.round(Math.max(0, Math.min(100, score)));
}

function getPerformanceRating(score: number): VanPerformanceMetrics['performanceRating'] {
    if (score >= 80) return 'Excellent';
    if (score >= 65) return 'Good';
    if (score >= 50) return 'Average';
    if (score >= 35) return 'Below Average';
    return 'Poor';
}

// ============================================
// EXPORTS
// ============================================

export default {
    getVanPerformanceMetrics,
    getFleetAnalytics,
    getComparativeAnalysis,
    getPredictiveAnalytics
};
