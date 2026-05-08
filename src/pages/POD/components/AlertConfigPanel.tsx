// ============================================
// ALERT CONFIG PANEL - Configure Alert Thresholds
// Manage alert settings and thresholds
// ============================================

import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Bell, Clock, TrendingUp, MapPin, Truck } from 'lucide-react';
import { getAlertConfig, updateAlertConfig, resetAlertConfig, type AlertConfig } from '../../../services/alertService';

export default function AlertConfigPanel() {
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const configData = await getAlertConfig();
            setConfig(configData);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load config:', error);
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;

        setSaving(true);
        setMessage(null);

        try {
            await updateAlertConfig(config);
            setMessage({ type: 'success', text: 'Alert configuration saved successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Failed to save config:', error);
            setMessage({ type: 'error', text: 'Failed to save configuration. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Are you sure you want to reset to default settings?')) return;

        setSaving(true);
        setMessage(null);

        try {
            const defaultConfig = await resetAlertConfig();
            setConfig(defaultConfig);
            setMessage({ type: 'success', text: 'Configuration reset to defaults!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Failed to reset config:', error);
            setMessage({ type: 'error', text: 'Failed to reset configuration.' });
        } finally {
            setSaving(false);
        }
    };

    const updateValue = (key: keyof AlertConfig, value: any) => {
        if (!config) return;
        setConfig({ ...config, [key]: value });
    };

    const toggleAlertType = (type: keyof AlertConfig['enabledAlerts']) => {
        if (!config) return;
        setConfig({
            ...config,
            enabledAlerts: {
                ...config.enabledAlerts,
                [type]: !config.enabledAlerts[type]
            }
        });
    };

    if (loading || !config) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-40 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Settings className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Alert Configuration</h2>
                            <p className="text-sm text-gray-600">Configure alert thresholds and settings</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            disabled={saving}
                            className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <RotateCcw size={16} />
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Success/Error Message */}
                {message && (
                    <div className={`mt-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        <p className="text-sm font-semibold">{message.text}</p>
                    </div>
                )}
            </div>

            {/* Configuration Sections */}
            <div className="p-6 space-y-8">
                {/* Time Thresholds */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="text-gray-600" size={20} />
                        <h3 className="text-lg font-black text-gray-900">Time Thresholds</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Max Loading Time (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.maxLoadingTime}
                                onChange={(e) => updateValue('maxLoadingTime', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Max Delivery Time (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.maxDeliveryTime}
                                onChange={(e) => updateValue('maxDeliveryTime', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Max Stop Time (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.maxStopTime}
                                onChange={(e) => updateValue('maxStopTime', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Max Idle Time (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.maxIdleTime}
                                onChange={(e) => updateValue('maxIdleTime', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                    </div>
                </div>

                {/* Performance Thresholds */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="text-gray-600" size={20} />
                        <h3 className="text-lg font-black text-gray-900">Performance Thresholds</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Min Deliveries Per Hour
                            </label>
                            <input
                                type="number"
                                value={config.minDeliveriesPerHour}
                                onChange={(e) => updateValue('minDeliveriesPerHour', parseFloat(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                step="0.1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Min Efficiency Score (%)
                            </label>
                            <input
                                type="number"
                                value={config.minEfficiencyScore}
                                onChange={(e) => updateValue('minEfficiencyScore', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                max="100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Min Success Rate (%)
                            </label>
                            <input
                                type="number"
                                value={config.minSuccessRate}
                                onChange={(e) => updateValue('minSuccessRate', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>
                </div>

                {/* Location Thresholds */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="text-gray-600" size={20} />
                        <h3 className="text-lg font-black text-gray-900">Location Thresholds</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Max Speed (mph)
                            </label>
                            <input
                                type="number"
                                value={config.maxSpeedMph}
                                onChange={(e) => updateValue('maxSpeedMph', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.enableGeofenceAlerts}
                                    onChange={(e) => updateValue('enableGeofenceAlerts', e.target.checked)}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-gray-700">Enable Geofence Alerts</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Schedule Thresholds */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Truck className="text-gray-600" size={20} />
                        <h3 className="text-lg font-black text-gray-900">Schedule Thresholds</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Behind Schedule (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.behindScheduleMinutes}
                                onChange={(e) => updateValue('behindScheduleMinutes', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Ahead Schedule (minutes)
                            </label>
                            <input
                                type="number"
                                value={config.aheadScheduleMinutes}
                                onChange={(e) => updateValue('aheadScheduleMinutes', parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="1"
                            />
                        </div>
                    </div>
                </div>

                {/* Enabled Alert Types */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Bell className="text-gray-600" size={20} />
                        <h3 className="text-lg font-black text-gray-900">Enabled Alert Types</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(config.enabledAlerts).map(([type, enabled]) => (
                            <label
                                key={type}
                                className="flex items-center gap-2 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={() => toggleAlertType(type as keyof AlertConfig['enabledAlerts'])}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm font-semibold text-gray-700 capitalize">
                                    {type}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
