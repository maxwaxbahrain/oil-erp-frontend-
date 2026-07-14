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

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
  border: 'rgba(255,255,255,.07)',
};

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type TrackedVan = VanLocation & {
  liveStatus: VanLiveStatus;
};

function createVanIcon(_color: string, label: string, selected = false) {
  const size = selected ? 48 : 40;
  const radius = selected ? 18 : 15;
  const strokeWidth = selected ? 3.5 : 2.5;
  const cx = size / 2;
  const cy = size / 2;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${C.blue}" stroke="#ffffff" stroke-width="${strokeWidth}"/>
      <text x="${cx}" y="${cy + 4}" font-size="${selected ? 12 : 11}" font-weight="bold" text-anchor="middle" fill="white">${label.slice(0, 2)}</text>
    </svg>
  `;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size, size],
    iconAnchor: [cx, cy],
    popupAnchor: [0, -cy],
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
    <div
      className="flex flex-col gap-4 -mx-3 sm:-mx-6 lg:-mx-10 min-h-[calc(100vh-10rem)]"
      style={{ color: C.text, fontFamily: 'inherit' }}
    >
      <style>{`
        .van-tracking-map .leaflet-container {
          background: #e8eef4;
        }
        .van-tracking-map .leaflet-popup-content-wrapper {
          background: ${C.bg2};
          color: ${C.text};
          border: 1px solid ${C.border};
          border-radius: 12px;
          box-shadow: 0 12px 32px rgba(0,0,0,.55);
        }
        .van-tracking-map .leaflet-popup-content {
          margin: 12px 14px;
          line-height: 1.45;
        }
        .van-tracking-map .leaflet-popup-tip {
          background: ${C.bg2};
        }
        .van-tracking-map .leaflet-control-attribution {
          background: rgba(255,255,255,.88) !important;
          color: #4b5563 !important;
          border-radius: 6px 0 0 0;
          font-size: 10px;
        }
        .van-tracking-map .leaflet-control-attribution a {
          color: #2563eb !important;
        }
      `}</style>

      <div className="px-3 sm:px-6 lg:px-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl font-black uppercase tracking-tight flex items-center gap-2"
            style={{ color: C.text }}
          >
            <MapPin size={22} style={{ color: C.blue }} />
            Live Van Tracking
          </h1>
          <p className="text-xs mt-1" style={{ color: C.muted }}>
            Real-time fleet positions from SPOD driver shifts
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
          {lastRefresh && (
            <span>Updated {formatRelativeTime(lastRefresh.toISOString())}</span>
          )}
          <button
            type="button"
            onClick={() => fetchLocations()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors"
            style={{
              border: `1px solid ${C.border}`,
              background: C.bg2,
              color: C.text,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(79,142,247,.35)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: C.blue }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div
          className="mx-3 sm:mx-6 lg:mx-10 rounded-lg px-4 py-3 text-sm"
          style={{
            border: '1px solid rgba(239,68,68,.35)',
            background: 'rgba(239,68,68,.12)',
            color: '#FCA5A5',
          }}
        >
          {error}
        </div>
      )}

      <div
        className="flex flex-1 min-h-[520px] overflow-hidden rounded-xl mx-3 sm:mx-6 lg:mx-10"
        style={{ border: `1px solid ${C.border}`, background: C.bg2 }}
      >
        <aside
          className="w-full max-w-[320px] shrink-0 flex flex-col"
          style={{ background: C.bg, borderRight: `1px solid ${C.border}` }}
        >
          <div className="px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
            <p
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: C.blue }}
            >
              Fleet ({trackedVans.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {trackedVans.length === 0 && !loading ? (
              <div
                className="m-2 p-6 text-center text-sm leading-relaxed rounded-xl"
                style={{ color: C.muted, background: C.bg2, border: `1px solid ${C.border}` }}
              >
                <Truck size={32} className="mx-auto mb-3 opacity-40" style={{ color: C.blue }} />
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
                      'w-full text-left px-3 py-3 rounded-xl transition-all',
                    )}
                    style={{
                      background: isSelected ? 'rgba(79,142,247,.14)' : C.bg2,
                      border: isSelected
                        ? '1px solid rgba(79,142,247,.45)'
                        : `1px solid ${C.border}`,
                      boxShadow: isSelected ? '0 0 0 1px rgba(79,142,247,.15)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
                      />
                      <span className="font-bold text-sm truncate" style={{ color: C.text }}>
                        {van.van_number || `Van ${van.van_id}`}
                      </span>
                      <span
                        className="ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
                        style={{
                          color,
                          background: `${color}22`,
                          border: `1px solid ${color}44`,
                        }}
                      >
                        {vanStatusLabel(van.liveStatus)}
                      </span>
                    </div>
                    <p className="text-xs truncate pl-4" style={{ color: C.muted }}>
                      {van.driver_name || 'No driver'}
                    </p>
                    <p className="text-[11px] pl-4 mt-1" style={{ color: C.dim }}>
                      {speedKmh(van.speed)} km/h · {formatRelativeTime(van.recorded_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div
            className="px-4 py-3 space-y-1.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ borderTop: `1px solid ${C.border}`, color: C.dim }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Moving
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D97706]" /> Stopped
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#6B7280]" /> Offline (&gt;10 min)
            </div>
          </div>
        </aside>

        <div className="flex-1 relative min-h-[420px] van-tracking-map">
          {trackedVans.length === 0 && !loading ? (
            <div
              className="absolute inset-0 flex items-center justify-center text-center p-8"
              style={{ background: C.bg }}
            >
              <div>
                <div className="text-4xl mb-3 opacity-60">🗺️</div>
                <p className="font-bold mb-2" style={{ color: C.text }}>
                  No vans on the map yet
                </p>
                <p className="text-sm max-w-md" style={{ color: C.muted }}>
                  No vans reporting yet — drivers appear here when they start a shift in SPOD.
                </p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={11}
              className="h-full w-full z-0"
              style={{ height: '100%', minHeight: '420px', background: '#e8eef4' }}
            >
              <TileLayer
                attribution={OSM_ATTR}
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapFocus target={focusTarget} />
              {trackedVans.map((van) => {
                const color = vanStatusColor(van.liveStatus);
                const label = van.van_number || String(van.van_id);
                const isSelected = String(van.van_id) === selectedVanId;
                return (
                  <Marker
                    key={String(van.van_id)}
                    position={[Number(van.latitude), Number(van.longitude)]}
                    icon={createVanIcon(color, label, isSelected)}
                    eventHandlers={{ click: () => handleSelectVan(van) }}
                  >
                    <Popup>
                      <div className="min-w-[200px] text-sm">
                        <p className="font-black text-base" style={{ color: C.blue }}>
                          {van.van_number}
                        </p>
                        <p style={{ color: C.muted }}>{van.driver_name || 'No driver'}</p>
                        <p className="mt-2" style={{ color: C.text }}>
                          <span className="font-semibold" style={{ color }}>
                            {vanStatusLabel(van.liveStatus)}
                          </span>
                          {' · '}
                          <span style={{ color: C.muted }}>{speedKmh(van.speed)} km/h</span>
                        </p>
                        <p className="text-xs mt-1" style={{ color: C.dim }}>
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
