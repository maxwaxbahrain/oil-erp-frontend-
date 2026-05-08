// ============================================
// ALERT NOTIFICATION - Toast Notifications
// Real-time alert notifications with auto-dismiss
// ============================================

import { useEffect, useState } from 'react';
import { AlertCircle, X, Bell } from 'lucide-react';
import { type Alert, type AlertSeverity } from '../../../services/alertService';

interface AlertNotificationProps {
    alert: Alert;
    onDismiss: () => void;
    autoDismiss?: boolean;
    dismissDelay?: number; // milliseconds
}

export default function AlertNotification({
    alert,
    onDismiss,
    autoDismiss = true,
    dismissDelay = 5000
}: AlertNotificationProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        // Slide in animation
        setTimeout(() => setIsVisible(true), 10);

        if (autoDismiss) {
            // Progress bar animation
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    const newProgress = prev - (100 / (dismissDelay / 100));
                    return newProgress > 0 ? newProgress : 0;
                });
            }, 100);

            // Auto dismiss
            const dismissTimer = setTimeout(() => {
                handleDismiss();
            }, dismissDelay);

            return () => {
                clearInterval(progressInterval);
                clearTimeout(dismissTimer);
            };
        }
    }, [autoDismiss, dismissDelay]);

    const handleDismiss = () => {
        setIsVisible(false);
        setTimeout(onDismiss, 300); // Wait for slide-out animation
    };

    const getSeverityStyles = (severity: AlertSeverity) => {
        switch (severity) {
            case 'critical':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-500',
                    icon: 'text-red-600',
                    progress: 'bg-red-600'
                };
            case 'warning':
                return {
                    bg: 'bg-yellow-50',
                    border: 'border-yellow-500',
                    icon: 'text-yellow-600',
                    progress: 'bg-yellow-600'
                };
            case 'info':
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-500',
                    icon: 'text-blue-600',
                    progress: 'bg-blue-600'
                };
        }
    };

    const getSeverityIcon = (severity: AlertSeverity) => {
        const styles = getSeverityStyles(severity);
        switch (severity) {
            case 'critical':
            case 'warning':
                return <AlertCircle className={styles.icon} size={24} />;
            case 'info':
                return <Bell className={styles.icon} size={24} />;
        }
    };

    const styles = getSeverityStyles(alert.severity);

    return (
        <div
            className={`
                ${styles.bg} ${styles.border}
                border-l-4 rounded-lg shadow-2xl overflow-hidden
                transition-all duration-300 ease-out
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
                w-96 max-w-full
            `}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                        {getSeverityIcon(alert.severity)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-black text-gray-900">
                                {alert.title}
                            </h3>
                            <button
                                onClick={handleDismiss}
                                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs font-semibold text-gray-600 mb-2">
                            {alert.vanName}
                        </p>

                        <p className="text-sm text-gray-700 mb-3">
                            {alert.message}
                        </p>

                        {/* Suggested Action */}
                        {alert.suggestedAction && (
                            <div className="bg-white/50 rounded p-2 mb-2">
                                <p className="text-xs font-semibold text-gray-800">
                                    💡 {alert.suggestedAction}
                                </p>
                            </div>
                        )}

                        {/* Action Button */}
                        {alert.actionable && (
                            <button
                                onClick={handleDismiss}
                                className={`
                                    px-3 py-1.5 rounded-lg text-xs font-bold
                                    transition-colors
                                    ${alert.severity === 'critical' ? 'bg-red-600 hover:bg-red-700' :
                                        alert.severity === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                            'bg-blue-600 hover:bg-blue-700'}
                                    text-white
                                `}
                            >
                                View Details
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress Bar */}
            {autoDismiss && (
                <div className="h-1 bg-gray-200">
                    <div
                        className={`h-full ${styles.progress} transition-all duration-100 ease-linear`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
}

// ============================================
// ALERT NOTIFICATION CONTAINER
// Manages multiple toast notifications
// ============================================

interface AlertNotificationContainerProps {
    alerts: Alert[];
    onDismiss: (alertId: string) => void;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    maxVisible?: number;
}

export function AlertNotificationContainer({
    alerts,
    onDismiss,
    position = 'top-right',
    maxVisible = 5
}: AlertNotificationContainerProps) {
    const getPositionClasses = () => {
        switch (position) {
            case 'top-right':
                return 'top-4 right-4';
            case 'top-left':
                return 'top-4 left-4';
            case 'bottom-right':
                return 'bottom-4 right-4';
            case 'bottom-left':
                return 'bottom-4 left-4';
        }
    };

    const visibleAlerts = alerts.slice(0, maxVisible);

    return (
        <div className={`fixed ${getPositionClasses()} z-50 space-y-3`}>
            {visibleAlerts.map((alert) => (
                <AlertNotification
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => onDismiss(alert.id)}
                />
            ))}
        </div>
    );
}
