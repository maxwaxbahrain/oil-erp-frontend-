import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Truck } from 'lucide-react';
import clsx from 'clsx';
import { getVanLocations, type VanLocation } from '../../services/api';
import {
  deriveVanLiveStatus,
  formatRelativeTime,
  speedKmh,
  vanStatusColor,
  vanStatusLabel,
  type VanLiveStatus,
} from '../../lib/vanLiveStatus';

const POLL_MS = 15_000;
const DEFAULT_CENTER: LatLngExpression = [26.2235, 50.5876];

type TrackedVan = VanLocation & {
  liveStatus: VanLiveStatus;
};

function createVanIcon(color: string, label: string) {
  const svg = `
    <svg width="36" height="36" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="18" y="22" font-size="11" font-weight="bold" text-anchor="middle" fill="white">${label.slice(0, 2)}</text>
    </svg>
  `;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

function MapFocus({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 14, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

export default function VanTracking() {
  const [locations, setLocations] = useState<VanLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVanId, setSelectedVanId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number } | null>(null);

  const fetchLocations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const rows = await getVanLocations();
      setLocations(Array.isArray(rows) ? rows : []);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to load van locations:', e);
      setError('Could not load van locations. Check your connection and try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    const timer = window.setInterval(() => fetchLocations(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [fetchLocations]);

  const trackedVans: TrackedVan[] = useMemo(
    () =>
      locations
        .filter((loc) => loc.latitude != null && loc.longitude != null)
        .map((loc) => ({
          ...loc,
          liveStatus: deriveVanLiveStatus(loc.recorded_at, loc.speed),
        }))
        .sort((a, b) => {
          const rank: Record<VanLiveStatus, number> = { moving: 0, stopped: 1, offline: 2 };
          return rank[a.liveStatus] - rank[b.liveStatus];
        }),
    [locations],
  );

  const mapCenter: LatLngExpression = useMemo(() => {
    if (trackedVans.length === 0) return DEFAULT_CENTER;
    const lat =
      trackedVans.reduce((sum, v) => sum + Number(v.latitude), 0) / trackedVans.length;
    const lng =
      trackedVans.reduce((sum, v) => sum + Number(v.longitude), 0) / trackedVans.length;
    return [lat, lng];
  }, [trackedVans]);

  const handleSelectVan = (van: TrackedVan) => {
    setSelectedVanId(String(van.van_id));
    setFocusTarget({ lat: Number(van.latitude), lng: Number(van.longitude) });
  };

  return (
    <div className="flex flex-col gap-4 -mx-3 sm:-mx-6 lg:-mx-10 min-h-[calc(100vh-10rem)]">
      <div className="px-3 sm:px-6 lg:px-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-redwood-text-main uppercase tracking-tight flex items-center gap-2">
            <MapPin size={22} className="text-redwood-brand" />
            Live Van Tracking
          </h1>
          <p className="text-xs text-redwood-text-muted mt-1">
            Real-time fleet positions from SPOD driver shifts
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-redwood-text-muted">
          {lastRefresh && (
            <span>Updated {formatRelativeTime(lastRefresh.toISOString())}</span>
          )}
          <button
            type="button"
            onClick={() => fetchLocations()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-redwood-border bg-redwood-bg-surface hover:bg-redwood-bg-light font-semibold"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-3 sm:mx-6 lg:mx-10 rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-1 min-h-[520px] border-y border-redwood-border bg-redwood-bg-surface overflow-hidden">
        <aside className="w-full max-w-[320px] shrink-0 border-r border-redwood-border flex flex-col bg-redwood-midnight/95 text-white">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-redwood-secondary">
              Fleet ({trackedVans.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {trackedVans.length === 0 && !loading ? (
              <div className="p-6 text-center text-sm text-redwood-text-muted leading-relaxed">
                <Truck size={32} className="mx-auto mb-3 opacity-40" />
                No vans reporting yet — drivers appear here when they start a shift in SPOD.
              </div>
            ) : (
              trackedVans.map((van) => {
                const color = vanStatusColor(van.liveStatus);
                const isSelected = String(van.van_id) === selectedVanId;
                return (
                  <button
                    key={String(van.van_id)}
                    type="button"
                    onClick={() => handleSelectVan(van)}
                    className={clsx(
                      'w-full text-left px-4 py-3 border-b border-white/5 transition-colors',
                      isSelected ? 'bg-white/10' : 'hover:bg-white/5',
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-bold text-sm truncate">
                        {van.van_number || `Van ${van.van_id}`}
                      </span>
                      <span className="ml-auto text-[10px] font-bold uppercase" style={{ color }}>
                        {vanStatusLabel(van.liveStatus)}
                      </span>
                    </div>
                    <p className="text-xs text-redwood-text-muted truncate pl-4">
                      {van.driver_name || 'No driver'}
                    </p>
                    <p className="text-[11px] text-redwood-text-muted pl-4 mt-0.5">
                      {speedKmh(van.speed)} km/h · {formatRelativeTime(van.recorded_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
          <div className="px-4 py-3 border-t border-white/10 text-[10px] text-redwood-text-muted space-y-1">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Moving</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#D97706]" /> Stopped</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#6B7280]" /> Offline (&gt;10 min)</div>
          </div>
        </aside>

        <div className="flex-1 relative min-h-[420px]">
          {trackedVans.length === 0 && !loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-redwood-bg-light text-center p-8">
              <div>
                <div className="text-4xl mb-3">🗺️</div>
                <p className="font-bold text-redwood-text-main mb-2">No vans on the map yet</p>
                <p className="text-sm text-redwood-text-muted max-w-md">
                  No vans reporting yet — drivers appear here when they start a shift in SPOD.
                </p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={11}
              className="h-full w-full z-0"
              style={{ height: '100%', minHeight: '420px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapFocus target={focusTarget} />
              {trackedVans.map((van) => {
                const color = vanStatusColor(van.liveStatus);
                const label = van.van_number || String(van.van_id);
                return (
                  <Marker
                    key={String(van.van_id)}
                    position={[Number(van.latitude), Number(van.longitude)]}
                    icon={createVanIcon(color, label)}
                    eventHandlers={{ click: () => handleSelectVan(van) }}
                  >
                    <Popup>
                      <div className="min-w-[200px] text-sm">
                        <p className="font-black text-base text-gray-900">{van.van_number}</p>
                        <p className="text-gray-600">{van.driver_name || 'No driver'}</p>
                        <p className="mt-2">
                          <span className="font-semibold" style={{ color }}>
                            {vanStatusLabel(van.liveStatus)}
                          </span>
                          {' · '}
                          {speedKmh(van.speed)} km/h
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {formatRelativeTime(van.recorded_at)}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}
