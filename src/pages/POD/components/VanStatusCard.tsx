// ============================================
// VAN STATUS CARD - Individual Van Overview
// Displays current status, progress, and metrics
// ============================================

import { Truck, MapPin, Clock, TrendingUp } from 'lucide-react';
import { type Van } from '../../../services/api';

interface VanStatusCardProps {
    van: Van;
    status?: string;
    deliveriesCompleted: number;
    deliveriesPending: number;
    totalDistance?: number | null;
    efficiency?: number | null;
    lastUpdate?: string;
    onClick?: () => void;
    selected?: boolean;
}

export default function VanStatusCard({
    van,
    status = 'No data',
    deliveriesCompleted,
    deliveriesPending,
    totalDistance = null,
    efficiency = null,
    lastUpdate,
    onClick,
    selected = false
}: VanStatusCardProps) {

    const vanColor = colorForVan(van);
    const vanLabel = van.van_number || `Van ${van.id}`;

    const getEfficiencyColor = (score: number | null): string => {
        if (score == null) return 'text-gray-400';
        if (score >= 80) return 'text-green-600';
        if (score >= 65) return 'text-blue-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getEfficiencyLabel = (score: number): string => {
        if (score >= 80) return 'Excellent';
        if (score >= 65) return 'Good';
        if (score >= 50) return 'Average';
        return 'Below Avg';
    };

    const totalDeliveries = deliveriesCompleted + deliveriesPending;
    const progress = totalDeliveries > 0 ? (deliveriesCompleted / totalDeliveries) * 100 : 0;

    const formatTimestamp = (timestamp: string): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        return `${Math.floor(diffMins / 60)}h ago`;
    };

    return (
        <div
            onClick={onClick}
            className={`
                bg-white rounded-xl shadow-lg p-5 transition-all cursor-pointer
                ${selected ? 'ring-4 ring-blue-500 shadow-2xl' : 'hover:shadow-xl'}
                ${onClick ? 'hover:scale-[1.02]' : ''}
            `}
            style={{ borderLeft: `6px solid ${vanColor}` }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${vanColor}20` }}
                    >
                        🚐
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">{vanLabel}</h3>
                        <p className="text-sm text-gray-600">{van.driver_name || 'No driver assigned'}</p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="px-3 py-1 rounded-full text-white text-xs font-bold bg-gray-400">
                    {status}
                </div>
            </div>

            {/* Driver Info */}
            {van.driver_name && (
                <div className="mb-4 flex items-center gap-2 text-sm">
                    <Truck size={16} className="text-gray-400" />
                    <span className="text-gray-600">Driver:</span>
                    <span className="font-semibold text-gray-900">{van.driver_name}</span>
                </div>
            )}

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Deliveries</span>
                    <span className="text-sm font-bold text-gray-900">
                        {deliveriesCompleted}/{totalDeliveries}
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${progress}%`,
                            backgroundColor: vanColor
                        }}
                    />
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                    <span>{deliveriesCompleted} completed</span>
                    <span>{deliveriesPending} pending</span>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Distance */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <MapPin size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-600">Distance</span>
                    </div>
                    <div className="text-lg font-black text-gray-900">
                        {totalDistance == null ? '—' : `${totalDistance.toFixed(1)} mi`}
                    </div>
                    {totalDistance == null && <div className="text-xs text-gray-500 mt-1">No data</div>}
                </div>

                {/* Efficiency */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-600">Efficiency</span>
                    </div>
                    <div className={`text-lg font-black ${getEfficiencyColor(efficiency)}`}>
                        {efficiency == null ? '—' : `${Math.round(efficiency)}%`}
                    </div>
                    {efficiency == null ? (
                        <div className="text-xs text-gray-500 mt-1">No data</div>
                    ) : (
                        <div className="text-xs text-gray-500 mt-1">
                            {getEfficiencyLabel(efficiency)}
                        </div>
                    )}
                </div>
            </div>

            {/* Last Update */}
            {lastUpdate && (
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-3 border-t border-gray-200">
                    <Clock size={12} />
                    <span>Updated {formatTimestamp(lastUpdate)}</span>
                </div>
            )}

            {/* Quick Actions (if clickable) */}
            {onClick && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <button className="w-full py-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                        View Details →
                    </button>
                </div>
            )}
        </div>
    );
}

function colorForVan(van: Van): string {
    const palette = ['#0077C8', '#DC3545', '#45B854', '#FD7E14', '#6F42C1'];
    const seed = String(van.id || van.van_number || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return palette[seed % palette.length];
}
