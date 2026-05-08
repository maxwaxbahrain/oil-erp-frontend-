// ============================================
// VAN STATUS CARD - Individual Van Overview
// Displays current status, progress, and metrics
// ============================================

import { Truck, MapPin, Clock, TrendingUp } from 'lucide-react';
import { type Van } from '../../../services/podService';
import { type VanStatusType } from '../../../services/vanTrackingService';

interface VanStatusCardProps {
    van: Van;
    status?: VanStatusType;
    deliveriesCompleted: number;
    deliveriesPending: number;
    totalDistance?: number;
    efficiency?: number;
    lastUpdate?: string;
    onClick?: () => void;
    selected?: boolean;
}

export default function VanStatusCard({
    van,
    status = 'Idle',
    deliveriesCompleted,
    deliveriesPending,
    totalDistance = 0,
    efficiency = 0,
    lastUpdate,
    onClick,
    selected = false
}: VanStatusCardProps) {

    const getStatusColor = (status: VanStatusType): string => {
        switch (status) {
            case 'Loading': return 'bg-orange-500';
            case 'In Transit': return 'bg-blue-600';
            case 'At Location': return 'bg-yellow-500';
            case 'Delivering': return 'bg-green-500';
            case 'Completed': return 'bg-green-700';
            case 'Returning': return 'bg-purple-600';
            default: return 'bg-gray-400';
        }
    };

    const getStatusIcon = (status: VanStatusType): string => {
        switch (status) {
            case 'Loading': return '📦';
            case 'In Transit': return '🚚';
            case 'At Location': return '📍';
            case 'Delivering': return '✅';
            case 'Completed': return '🎉';
            case 'Returning': return '🔙';
            default: return '⏸️';
        }
    };

    const getEfficiencyColor = (score: number): string => {
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
            style={{ borderLeft: `6px solid ${van.color}` }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: van.color + '20' }}
                    >
                        🚐
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-900">{van.name}</h3>
                        <p className="text-sm text-gray-600">{van.colorName}</p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className={`px-3 py-1 rounded-full text-white text-xs font-bold ${getStatusColor(status)}`}>
                    <span className="mr-1">{getStatusIcon(status)}</span>
                    {status}
                </div>
            </div>

            {/* Driver Info */}
            {van.currentDriverName && (
                <div className="mb-4 flex items-center gap-2 text-sm">
                    <Truck size={16} className="text-gray-400" />
                    <span className="text-gray-600">Driver:</span>
                    <span className="font-semibold text-gray-900">{van.currentDriverName}</span>
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
                            backgroundColor: van.color
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
                        {totalDistance.toFixed(1)} mi
                    </div>
                </div>

                {/* Efficiency */}
                <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-600">Efficiency</span>
                    </div>
                    <div className={`text-lg font-black ${getEfficiencyColor(efficiency)}`}>
                        {efficiency > 0 ? `${Math.round(efficiency)}%` : 'N/A'}
                    </div>
                    {efficiency > 0 && (
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
