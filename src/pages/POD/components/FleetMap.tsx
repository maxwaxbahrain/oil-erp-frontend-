// ============================================
// FLEET MAP - Proof-of-delivery GPS map
// Shows only delivered notes with real POD GPS coordinates.
// ============================================

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin, Clock } from 'lucide-react';
import type { DeliveryNote } from '../../../services/deliveryService';
import { podMapMarkers } from '../podDeliveryMetrics';

interface FleetMapProps {
    center?: LatLngExpression;
    zoom?: number;
    onVanClick?: (vanId: string) => void;
    selectedVanId?: string;
    deliveryNotes: DeliveryNote[];
}

export default function FleetMap({
    center = [40.7128, -74.0060], // Default: New York
    zoom = 12,
    onVanClick,
    selectedVanId,
    deliveryNotes,
}: FleetMapProps) {
    const markers = podMapMarkers(deliveryNotes);
    const createPodIcon = (label: string) => {
        const color = '#28A745';

        const svgString = `
            <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
                <text x="20" y="26" font-size="13" font-weight="bold" text-anchor="middle" fill="white">${label.slice(0, 3)}</text>
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

    if (markers.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-xl">
                <div className="text-center">
                    <div className="text-gray-400 text-5xl mb-4">📍</div>
                    <p className="text-gray-900 font-bold mb-2">No POD GPS Available</p>
                    <p className="text-gray-600 text-sm mb-4">
                        Delivered notes will appear here only when their proof-of-delivery includes GPS.
                    </p>
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

                {markers.map((marker) => {
                    const position: LatLngExpression = [marker.latitude, marker.longitude];
                    const isSelected = marker.vanId === selectedVanId;

                    return (
                        <div key={marker.id}>
                            <Marker
                                position={position}
                                icon={createPodIcon(marker.dnNumber)}
                                eventHandlers={{
                                    click: () => marker.vanId && onVanClick?.(marker.vanId)
                                }}
                            >
                                <Popup>
                                    <div className="p-2 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-4 h-4 rounded-full bg-green-600" />
                                            <h3 className="font-black text-lg">{marker.dnNumber}</h3>
                                        </div>

                                        <div className="space-y-1 text-sm">
                                            <div className="flex items-center gap-2">
                                                <Truck size={14} className="text-gray-500" />
                                                <span className="font-semibold">{marker.vanId || 'No van assigned'}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-gray-500" />
                                                <span className="text-gray-600">
                                                    {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
                                                </span>
                                            </div>

                                            {marker.timestamp && <div className="flex items-center gap-2">
                                                <Clock size={14} className="text-gray-500" />
                                                <span className="text-gray-600">
                                                    {formatTimestamp(marker.timestamp)}
                                                </span>
                                            </div>}

                                            <div className="mt-2 pt-2 border-t">
                                                <div className="text-xs text-gray-500">
                                                    Customer ID: {marker.customerId}
                                                </div>
                                            </div>
                                        </div>

                                        {onVanClick && marker.vanId && (
                                            <button
                                                onClick={() => onVanClick(marker.vanId!)}
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
                                radius={50}
                                pathOptions={{
                                    color: '#28A745',
                                    fillColor: '#28A745',
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
                <h4 className="font-bold text-sm mb-2">POD GPS</h4>
                <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-600"></div>
                        <span>Delivered with GPS</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
