// ============================================
// MANAGEMENT DASHBOARD - Fleet Overview
// Real-time monitoring of all 10 vans
// ============================================

import { useState, useEffect } from 'react';
import { Truck, Package, TrendingUp, AlertCircle, MapPin, RefreshCw } from 'lucide-react';
import FleetMap from './components/FleetMap';
import VanStatusCard from './components/VanStatusCard';
import ErrorBoundary from '../../components/ErrorBoundary';
import { getVans, type Van } from '../../services/podService';
import { getCurrentVanStatus } from '../../services/vanTrackingService';
import { getVanPerformanceMetrics, getFleetAnalytics } from '../../services/analyticsService';
import { getAlertSummary } from '../../services/alertService';
import { getLatestLocation } from '../../services/locationService';

export default function ManagementDashboard() {
    const [vans, setVans] = useState<Van[]>([]);
    const [selectedVanId, setSelectedVanId] = useState<string | null>(null);
    const [fleetStats, setFleetStats] = useState<any>(null);
    const [vanMetrics, setVanMetrics] = useState<Map<string, any>>(new Map());
    const [alerts, setAlerts] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    useEffect(() => {
        loadDashboardData();

        // Auto-refresh every 10 seconds
        const interval = setInterval(() => {
            loadDashboardData();
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = async () => {
        try {
            // Load vans
            const vansData = await getVans();
            setVans(vansData);

            // Load fleet analytics
            const fleet = await getFleetAnalytics();
            setFleetStats(fleet);

            // Load metrics for each van
            const metrics = new Map();
            for (const van of vansData) {
                const vanMetrics = await getVanPerformanceMetrics(van.id);
                const status = await getCurrentVanStatus(van.id);
                const location = await getLatestLocation(van.id);

                metrics.set(van.id, {
                    ...vanMetrics,
                    status: status?.status,
                    lastUpdate: location?.timestamp
                });
            }
            setVanMetrics(metrics);

            // Load alerts
            const alertSummary = await getAlertSummary();
            setAlerts(alertSummary);

            setLastRefresh(new Date());
            setLoading(false);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        loadDashboardData();
    };

    if (loading && !fleetStats) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading fleet dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 mb-2">Fleet Management</h1>
                        <p className="text-gray-600">Real-time monitoring of all delivery vans</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500">
                            Last updated: {lastRefresh.toLocaleTimeString()}
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Fleet Stats Cards */}
            {fleetStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Active Vans */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Truck size={24} className="text-blue-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">
                                {fleetStats.activeVans}/{fleetStats.totalVans}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Active Vans</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {fleetStats.idleVans} idle
                        </p>
                    </div>

                    {/* Total Deliveries */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Package size={24} className="text-green-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">
                                {fleetStats.completedDeliveries}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Completed Today</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {fleetStats.pendingDeliveries} pending
                        </p>
                    </div>

                    {/* Fleet Distance */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <MapPin size={24} className="text-purple-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">
                                {fleetStats.totalFleetMiles.toFixed(0)}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Total Miles</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {fleetStats.averageMilesPerVan.toFixed(1)} avg/van
                        </p>
                    </div>

                    {/* Efficiency Score */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                <TrendingUp size={24} className="text-orange-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">
                                {Math.round(fleetStats.averageEfficiencyScore)}%
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Avg Efficiency</h3>
                        {fleetStats.topPerformer && (
                            <p className="text-xs text-gray-500 mt-1">
                                Top: {fleetStats.topPerformer.vanName}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Alerts Banner */}
            {alerts && alerts.unacknowledged > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-lg">
                    <div className="flex items-center">
                        <AlertCircle className="text-yellow-600 mr-3" size={24} />
                        <div>
                            <h3 className="text-sm font-bold text-yellow-800">
                                {alerts.unacknowledged} Unacknowledged Alert{alerts.unacknowledged > 1 ? 's' : ''}
                            </h3>
                            <p className="text-xs text-yellow-700 mt-1">
                                {alerts.critical.length} critical alert{alerts.critical.length !== 1 ? 's' : ''} require immediate attention
                            </p>
                        </div>
                        <button className="ml-auto px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-bold hover:bg-yellow-700">
                            View Alerts
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Fleet Map - Takes 2 columns */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-lg p-4">
                        <h2 className="text-xl font-black text-gray-900 mb-4">Live Fleet Map</h2>
                        <div className="h-[600px]">
                            <ErrorBoundary>
                                <FleetMap
                                    onVanClick={(vanId) => setSelectedVanId(vanId)}
                                    selectedVanId={selectedVanId || undefined}
                                />
                            </ErrorBoundary>
                        </div>
                    </div>
                </div>

                {/* Van Status Cards - 1 column */}
                <div className="space-y-4">
                    <h2 className="text-xl font-black text-gray-900">Van Status</h2>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {vans.map((van) => {
                            const metrics = vanMetrics.get(van.id);
                            return (
                                <VanStatusCard
                                    key={van.id}
                                    van={van}
                                    status={metrics?.status}
                                    deliveriesCompleted={metrics?.deliveriesCompleted || 0}
                                    deliveriesPending={metrics?.deliveriesPending || 0}
                                    totalDistance={metrics?.totalDistance || 0}
                                    efficiency={metrics?.overallEfficiencyScore || 0}
                                    lastUpdate={metrics?.lastUpdate}
                                    onClick={() => setSelectedVanId(van.id)}
                                    selected={selectedVanId === van.id}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Performance Summary */}
            {fleetStats && fleetStats.needsAttention && fleetStats.needsAttention.length > 0 && (
                <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-4">Needs Attention</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {fleetStats.needsAttention.map((item: any) => (
                            <div
                                key={item.vanId}
                                className="border-2 border-red-200 rounded-lg p-4 bg-red-50"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle size={20} className="text-red-600" />
                                    <h3 className="font-bold text-gray-900">{item.vanName}</h3>
                                </div>
                                <p className="text-sm text-gray-700">{item.reason}</p>
                                <button className="mt-3 text-sm font-bold text-red-600 hover:text-red-700">
                                    View Details →
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
