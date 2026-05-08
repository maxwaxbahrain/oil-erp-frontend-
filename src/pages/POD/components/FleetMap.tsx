// ============================================
// FLEET MAP - Real-time Van Tracking Map
// Shows all 10 vans on interactive map using Leaflet
// ============================================

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getLatestLocation } from '../../../services/locationService';
import { getCurrentVanStatus } from '../../../services/vanTrackingService';
import { getVans, type Van } from '../../../services/podService';
import { Truck, MapPin, Clock } from 'lucide-react';

interface VanMapData {
    van: Van;
    location?: {
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: string;
    };
    status?: string;
}

interface FleetMapProps {
    center?: LatLngExpression;
    zoom?: number;
    onVanClick?: (vanId: string) => void;
    selectedVanId?: string;
}

export default function FleetMap({
    center = [40.7128, -74.0060], // Default: New York
    zoom = 12,
    onVanClick,
    selectedVanId
}: FleetMapProps) {
    const [vansData, setVansData] = useState<VanMapData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadVansData();

        // Refresh every 10 seconds
        const interval = setInterval(loadVansData, 10000);

        return () => clearInterval(interval);
    }, []);

    const loadVansData = async () => {
        try {
            setError(null);
            const vans = await getVans();
            const vansWithLocations: VanMapData[] = [];

            for (const van of vans) {
                try {
                    const location = await getLatestLocation(van.id);
                    const status = await getCurrentVanStatus(van.id);

                    if (location) {
                        vansWithLocations.push({
                            van,
                            location: {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                accuracy: location.accuracy,
                                timestamp: location.timestamp
                            },
                            status: status?.status
                        });
                    }
                } catch (vanError) {
                    console.warn(`Failed to load data for van ${van.id}:`, vanError);
                    // Continue with other vans even if one fails
                }
            }

            setVansData(vansWithLocations);
            setLoading(false);
        } catch (error) {
            console.error('Failed to load vans data:', error);
            setError(error instanceof Error ? error.message : 'Failed to load fleet data');
            setLoading(false);
        }
    };

    const getStatusColor = (status?: string): string => {
        switch (status) {
            case 'Loading': return '#FD7E14'; // Orange
            case 'In Transit': return '#0077C8'; // Blue
            case 'At Location': return '#FFC107'; // Yellow
            case 'Delivering': return '#45B854'; // Green
            case 'Completed': return '#28A745'; // Dark Green
            case 'Returning': return '#6F42C1'; // Purple
            default: return '#6C757D'; // Gray
        }
    };

    const createVanIcon = (van: Van, status?: string) => {
        const color = van.color || getStatusColor(status);

        // Get the van number (e.g., "VAN-1" -> "1")
        const vanNumber = van.name.split('-')[1] || van.name.charAt(0);

        // Create SVG without emojis to avoid btoa encoding issues
        const svgString = `
            <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
                <text x="20" y="27" font-size="18" font-weight="bold" text-anchor="middle" fill="white">${vanNumber}</text>
            </svg>
        `;

        return new Icon({
            iconUrl: `data:image/svg+xml;base64,${btoa(svgString)}`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
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

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading fleet map...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
                <div className="text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <p className="text-gray-900 font-bold mb-2">Failed to Load Map</p>
                    <p className="text-gray-600 text-sm mb-4">{error}</p>
                    <button
                        onClick={() => {
                            setLoading(true);
                            loadVansData();
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Show message if no vans have location data
    if (vansData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
                <div className="text-center">
                    <div className="text-gray-400 text-5xl mb-4">📍</div>
                    <p className="text-gray-900 font-bold mb-2">No Van Locations Available</p>
                    <p className="text-gray-600 text-sm mb-4">
                        Vans will appear on the map once they start sharing their location.
                    </p>
                    <button
                        onClick={() => {
                            setLoading(true);
                            loadVansData();
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full rounded-xl overflow-hidden shadow-lg">
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ height: '100%', width: '100%' }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {vansData.map(({ van, location, status }) => {
                    if (!location) return null;

                    const position: LatLngExpression = [location.latitude, location.longitude];
                    const isSelected = van.id === selectedVanId;

                    return (
                        <div key={van.id}>
                            {/* Van Marker */}
                            <Marker
                                position={position}
                                icon={createVanIcon(van, status)}
                                eventHandlers={{
                                    click: () => onVanClick?.(van.id)
                                }}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: van.color }}
                                            />
                                            <h3 className="font-black text-lg">{van.name}</h3>
                                        </div>

                                        <div className="space-y-1 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Truck size={14} className="text-gray-500" />
                                                <span className="font-semibold">
                                                    {status || 'Idle'}
                                                </span>
                                            </div>

                                            {van.currentDriverName && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-gray-500">Driver:</span>
                                                    <span className="font-semibold">
                                                        {van.currentDriverName}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-gray-500" />
                                                <span className="text-gray-600">
                                                    ±{Math.round(location.accuracy)}m accuracy
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-500" />
                                                <span className="text-gray-600">
                                                    {formatTimestamp(location.timestamp)}
                                                </span>
                                            </div>

                                            <div className="mt-2 pt-2 border-t">
                                                <div className="text-xs text-gray-500">
                                                    Today: {van.completedToday} completed, {van.pendingToday} pending
                                                </div>
                                            </div>
                                        </div>

                                        {onVanClick && (
                                            <button
                                                onClick={() => onVanClick(van.id)}
                                                className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                                            >
                                                View Details
                                            </button>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>

                            {/* Accuracy Circle */}
                            <Circle
                                center={position}
                                radius={location.accuracy}
                                pathOptions={{
                                    color: van.color,
                                    fillColor: van.color,
                                    fillOpacity: isSelected ? 0.2 : 0.1,
                                    weight: isSelected ? 2 : 1
                                }}
                            />
                        </div>
                    );
                })}
            </MapContainer>

            {/* Map Legend */}
            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
                <h4 className="font-bold text-sm mb-2">Van Status</h4>
                <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>Loading</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span>In Transit</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <span>At Location</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Delivering</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-700"></div>
                        <span>Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                        <span>Returning</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
