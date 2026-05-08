// ============================================
// POD TEST RUNNER - Browser-based Testing Tool
// Quick access to test data generation and cleanup
// ============================================

import { useState } from 'react';
import { Play, Trash2, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { setupTestData, cleanupTestData } from '../../utils/podTestDataGenerator';

export default function PODTestRunner() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSetupTestData = async () => {
        setLoading(true);
        setMessage(null);

        try {
            await setupTestData();
            setMessage({
                type: 'success',
                text: 'Test data generated successfully! Check console for details.'
            });
        } catch (error) {
            console.error('Error generating test data:', error);
            setMessage({
                type: 'error',
                text: `Failed to generate test data: ${error}`
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCleanupTestData = async () => {
        if (!confirm('Are you sure you want to delete all POD test data?')) return;

        setLoading(true);
        setMessage(null);

        try {
            await cleanupTestData();
            setMessage({
                type: 'success',
                text: 'Test data cleaned up successfully!'
            });
        } catch (error) {
            console.error('Error cleaning up test data:', error);
            setMessage({
                type: 'error',
                text: `Failed to cleanup test data: ${error}`
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h1 className="text-3xl font-black text-gray-900 mb-2">POD Test Runner</h1>
                    <p className="text-gray-600">Generate and manage test data for POD system testing</p>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        <div className="flex items-center gap-2">
                            {message.type === 'success' ? (
                                <CheckCircle size={20} />
                            ) : (
                                <AlertCircle size={20} />
                            )}
                            <p className="font-semibold">{message.text}</p>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Generate Test Data */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <Play className="text-green-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900">Generate Test Data</h2>
                                <p className="text-sm text-gray-600">Create sample data for testing</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4 text-sm text-gray-700">
                            <p>✅ 10 vans initialized</p>
                            <p>✅ 6 geofences created</p>
                            <p>✅ 80-120 deliveries generated</p>
                            <p>✅ 5 vans with simulated activity</p>
                            <p>✅ 5 sample alerts created</p>
                        </div>

                        <button
                            onClick={handleSetupTestData}
                            disabled={loading}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Play size={20} />
                                    Generate Test Data
                                </>
                            )}
                        </button>
                    </div>

                    {/* Cleanup Test Data */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                                <Trash2 className="text-red-600" size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900">Cleanup Test Data</h2>
                                <p className="text-sm text-gray-600">Remove all POD data</p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-4 text-sm text-gray-700">
                            <p>⚠️ Removes all vans</p>
                            <p>⚠️ Removes all deliveries</p>
                            <p>⚠️ Removes all GPS data</p>
                            <p>⚠️ Removes all alerts</p>
                            <p>⚠️ This cannot be undone!</p>
                        </div>

                        <button
                            onClick={handleCleanupTestData}
                            disabled={loading}
                            className="w-full py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader className="animate-spin" size={20} />
                                    Cleaning...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={20} />
                                    Cleanup Test Data
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-4">Quick Links</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <a
                            href="/logistics/pod"
                            className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                            <h3 className="font-bold text-blue-900 mb-1">Driver App</h3>
                            <p className="text-sm text-gray-600">/logistics/pod</p>
                        </a>
                        <a
                            href="/pod/management"
                            className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                        >
                            <h3 className="font-bold text-purple-900 mb-1">Management Dashboard</h3>
                            <p className="text-sm text-gray-600">/pod/management</p>
                        </a>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-6 rounded">
                    <h3 className="font-bold text-blue-900 mb-2">📋 Testing Instructions</h3>
                    <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Click "Generate Test Data" to create sample data</li>
                        <li>Open browser console (F12) to see detailed logs</li>
                        <li>Navigate to Driver App or Management Dashboard</li>
                        <li>Test all features according to the testing guide</li>
                        <li>Use "Cleanup Test Data" to reset when done</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
