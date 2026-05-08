// ============================================
// ALERTS PANEL - Alert Management Interface
// View, acknowledge, and manage fleet alerts
// ============================================

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Bell, BellOff } from 'lucide-react';
import { getAlerts, acknowledgeAlert, acknowledgeAllAlerts, type Alert, type AlertType, type AlertSeverity } from '../../../services/alertService';

interface AlertsPanelProps {
    vanId?: string;
    autoRefresh?: boolean;
    refreshInterval?: number; // milliseconds
}

export default function AlertsPanel({
    vanId,
    autoRefresh = true,
    refreshInterval = 10000
}: AlertsPanelProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [filteredAlerts, setFilteredAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<AlertType | 'all'>('all');
    const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'all'>('all');
    const [showAcknowledged, setShowAcknowledged] = useState(false);

    useEffect(() => {
        loadAlerts();

        if (autoRefresh) {
            const interval = setInterval(loadAlerts, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [vanId, autoRefresh, refreshInterval]);

    useEffect(() => {
        applyFilters();
    }, [alerts, filterType, filterSeverity, showAcknowledged]);

    const loadAlerts = async () => {
        try {
            const alertsData = await getAlerts(vanId);
            setAlerts(alertsData);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load alerts:', error);
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...alerts];

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(a => a.type === filterType);
        }

        // Filter by severity
        if (filterSeverity !== 'all') {
            filtered = filtered.filter(a => a.severity === filterSeverity);
        }

        // Filter by acknowledged status
        if (!showAcknowledged) {
            filtered = filtered.filter(a => !a.acknowledged);
        }

        setFilteredAlerts(filtered);
    };

    const handleAcknowledge = async (alertId: string) => {
        try {
            await acknowledgeAlert(alertId, 'Manager'); // TODO: Get actual user name
            loadAlerts();
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
    };

    const handleAcknowledgeAll = async () => {
        if (!vanId) return;

        try {
            await acknowledgeAllAlerts(vanId, 'Manager');
            loadAlerts();
        } catch (error) {
            console.error('Failed to acknowledge all alerts:', error);
        }
    };

    const getSeverityIcon = (severity: AlertSeverity) => {
        switch (severity) {
            case 'critical': return <AlertCircle className="text-red-600" size={20} />;
            case 'warning': return <AlertCircle className="text-yellow-600" size={20} />;
            case 'info': return <Bell className="text-blue-600" size={20} />;
        }
    };

    const getTypeLabel = (type: AlertType): string => {
        switch (type) {
            case 'status': return 'Status';
            case 'performance': return 'Performance';
            case 'location': return 'Location';
            case 'time': return 'Time';
            case 'delivery': return 'Delivery';
        }
    };

    const formatTimestamp = (timestamp: string): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return date.toLocaleString();
    };

    const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
    const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <Bell className="text-red-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Alerts</h2>
                            <p className="text-sm text-gray-600">
                                {unacknowledgedCount} unacknowledged
                                {criticalCount > 0 && ` (${criticalCount} critical)`}
                            </p>
                        </div>
                    </div>

                    {vanId && unacknowledgedCount > 0 && (
                        <button
                            onClick={handleAcknowledgeAll}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                        >
                            Acknowledge All
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    {/* Type Filter */}
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as AlertType | 'all')}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Types</option>
                        <option value="status">Status</option>
                        <option value="performance">Performance</option>
                        <option value="location">Location</option>
                        <option value="time">Time</option>
                        <option value="delivery">Delivery</option>
                    </select>

                    {/* Severity Filter */}
                    <select
                        value={filterSeverity}
                        onChange={(e) => setFilterSeverity(e.target.value as AlertSeverity | 'all')}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Severities</option>
                        <option value="critical">Critical</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
                    </select>

                    {/* Show Acknowledged */}
                    <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={showAcknowledged}
                            onChange={(e) => setShowAcknowledged(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-gray-700">Show Acknowledged</span>
                    </label>
                </div>
            </div>

            {/* Alerts List */}
            <div className="max-h-[600px] overflow-y-auto">
                {filteredAlerts.length === 0 ? (
                    <div className="p-12 text-center">
                        <BellOff size={48} className="text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No Alerts</h3>
                        <p className="text-sm text-gray-600">
                            {showAcknowledged
                                ? 'No alerts match your filters'
                                : 'All alerts have been acknowledged'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={`p-4 hover:bg-gray-50 transition-colors ${alert.acknowledged ? 'opacity-60' : ''
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Severity Icon */}
                                    <div className="flex-shrink-0 mt-1">
                                        {getSeverityIcon(alert.severity)}
                                    </div>

                                    {/* Alert Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900">
                                                    {alert.title}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-semibold text-gray-600">
                                                        {alert.vanName}
                                                    </span>
                                                    <span className="text-xs text-gray-400">•</span>
                                                    <span className="text-xs text-gray-500">
                                                        {getTypeLabel(alert.type)}
                                                    </span>
                                                    <span className="text-xs text-gray-400">•</span>
                                                    <span className="text-xs text-gray-500">
                                                        {formatTimestamp(alert.timestamp)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Severity Badge */}
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                    alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-blue-100 text-blue-700'
                                                }`}>
                                                {alert.severity.toUpperCase()}
                                            </span>
                                        </div>

                                        <p className="text-sm text-gray-700 mb-3">
                                            {alert.message}
                                        </p>

                                        {/* Suggested Action */}
                                        {alert.suggestedAction && (
                                            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-3 rounded">
                                                <p className="text-xs font-semibold text-blue-900">
                                                    💡 Suggested Action: {alert.suggestedAction}
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex items-center gap-3">
                                            {!alert.acknowledged ? (
                                                <button
                                                    onClick={() => handleAcknowledge(alert.id)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                                >
                                                    <CheckCircle size={14} />
                                                    Acknowledge
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <CheckCircle size={14} className="text-green-600" />
                                                    <span>
                                                        Acknowledged by {alert.acknowledgedBy}
                                                        {alert.acknowledgedAt && ` ${formatTimestamp(alert.acknowledgedAt)}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
