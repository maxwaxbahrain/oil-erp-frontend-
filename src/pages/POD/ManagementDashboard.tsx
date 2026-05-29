// ============================================
// MANAGEMENT DASHBOARD - Fleet Overview
// Backend-backed delivery note/POD monitoring
// ============================================

import { useState, useEffect } from 'react';
import { Truck, Package, AlertCircle, MapPin, RefreshCw } from 'lucide-react';
import FleetMap from './components/FleetMap';
import VanStatusCard from './components/VanStatusCard';
import ErrorBoundary from '../../components/ErrorBoundary';
import { getVans, type Van } from '../../services/api';
import { listDeliveryNotes, type DeliveryNote } from '../../services/deliveryService';
import { computePodFleetStats, computeVanDeliveryMetrics, type PodFleetStats, type VanDeliveryMetric } from './podDeliveryMetrics';

export default function ManagementDashboard() {
    const [vans, setVans] = useState<Van[]>([]);
    const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
    const [selectedVanId, setSelectedVanId] = useState<string | null>(null);
    const [fleetStats, setFleetStats] = useState<PodFleetStats | null>(null);
    const [vanMetrics, setVanMetrics] = useState<Map<string, VanDeliveryMetric>>(new Map());
    const [error, setError] = useState<string | null>(null);
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
            setError(null);
            const [vansData, notesData] = await Promise.all([
                getVans(),
                listDeliveryNotes(),
            ]);
            setVans(vansData);
            setDeliveryNotes(notesData);
            setFleetStats(computePodFleetStats(vansData, notesData));
            setVanMetrics(computeVanDeliveryMetrics(notesData));
            setLastRefresh(new Date());
            setLoading(false);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            setError(error instanceof Error ? error.message : 'Failed to load delivery dashboard data');
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
                        <p className="text-gray-600">Backend delivery notes and proof-of-delivery monitoring</p>
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

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-lg">
                    <div className="flex items-center">
                        <AlertCircle className="text-red-600 mr-3" size={24} />
                        <div>
                            <h3 className="text-sm font-bold text-red-800">Could not load real delivery data</h3>
                            <p className="text-xs text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

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
                            {fleetStats.inactiveVans} inactive/maintenance
                        </p>
                    </div>

                    {/* Total Deliveries */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Package size={24} className="text-green-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">{fleetStats.completedDeliveries}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Delivered Notes</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {fleetStats.deliveredToday} delivered today
                        </p>
                    </div>

                    {/* Open Deliveries */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <MapPin size={24} className="text-purple-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">
                                {fleetStats.pendingDeliveries + fleetStats.inTransitDeliveries}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Open Deliveries</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            {fleetStats.pendingDeliveries} pending · {fleetStats.inTransitDeliveries} in transit
                        </p>
                    </div>

                    {/* Unbacked Analytics */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                <Package size={24} className="text-orange-600" />
                            </div>
                            <span className="text-3xl font-black text-gray-900">
                                —
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-600">Distance / Efficiency</h3>
                        <p className="text-xs text-gray-500 mt-1">No backend telemetry yet</p>
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
                                    deliveryNotes={deliveryNotes}
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
                            const metrics = vanMetrics.get(van.id) ?? vanMetrics.get(van.van_number);
                            return (
                                <VanStatusCard
                                    key={van.id}
                                    van={van}
                                    status={metrics ? 'Delivery notes' : undefined}
                                    deliveriesCompleted={metrics?.deliveriesCompleted || 0}
                                    deliveriesPending={(metrics?.deliveriesPending || 0) + (metrics?.deliveriesInTransit || 0)}
                                    totalDistance={null}
                                    efficiency={null}
                                    lastUpdate={metrics?.lastUpdate}
                                    onClick={() => setSelectedVanId(van.id)}
                                    selected={selectedVanId === van.id}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-xl font-black text-gray-900 mb-4">Delivery Status</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="font-bold">Pending:</span> {fleetStats?.pendingDeliveries ?? 0}</div>
                    <div><span className="font-bold">In transit:</span> {fleetStats?.inTransitDeliveries ?? 0}</div>
                    <div><span className="font-bold">Delivered:</span> {fleetStats?.completedDeliveries ?? 0}</div>
                    <div><span className="font-bold">Failed:</span> {fleetStats?.failedDeliveries ?? 0}</div>
                </div>
            </div>
        </div>
    );
}
