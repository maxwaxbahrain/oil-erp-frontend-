import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Icon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, MapPin, RefreshCw, Truck } from 'lucide-react';
import { useVisiblePolling } from '../../../hooks/useVisiblePolling';
import { isStaging } from '../../../config/appEnv';
import { getVanLocations, getVans, type Van, type VanLocation } from '../../../services/api';
import { getRouteWeek, type RouteWeekResponse } from '../../../services/routeService';
import { getArSummary } from '../../../services/customerService';
import { vanStatusColor, vanStatusLabel } from '../../../lib/vanLiveStatus';
import {
  OPS_MODULE_CHIPS,
  applyArBalances,
  buildOpsVans,
  pickOpsInsight,
  routePolylines,
  shouldShowVansError,
  stopsForVisitDay,
  todayVisitDay,
  type OpsInsight,
  type OpsStop,
  type OpsVanRow,
} from './opsMapModel';

export const OPS_POLL_MS = 30_000;
const DEFAULT_CENTER: LatLngExpression = [26.2235, 50.5876];
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function createDotIcon(color: string, label: string, size = 36) {
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#fff" stroke-width="2"
        style="filter:drop-shadow(0 0 6px ${color})"/>
      <text x="${cx}" y="${cy + 4}" font-size="10" font-weight="700" text-anchor="middle" fill="#fff">${label.slice(0, 3)}</text>
    </svg>`;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size, size],
    iconAnchor: [cx, cy],
    popupAnchor: [0, -cy],
  });
}

function createStopIcon(visited: boolean) {
  const color = visited ? '#64748B' : '#F59E0B';
  const svg = `
    <svg width="22" height="28" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 0C5.5 0 1 4.5 1 10c0 7 10 18 10 18s10-11 10-18C21 4.5 16.5 0 11 0z"
        fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="11" cy="10" r="3.5" fill="#fff"/>
    </svg>`;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -28],
  });
}

function MapFocus({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 13, { duration: 0.7 });
  }, [target, map]);
  return null;
}

export default function OpsMapPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<VanLocation[]>([]);
  const [fleet, setFleet] = useState<Van[]>([]);
  const [week, setWeek] = useState<RouteWeekResponse | null>(null);
  const [arRows, setArRows] = useState<Array<{ id: number; balance: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [vansError, setVansError] = useState(false);
  const [selectedVanId, setSelectedVanId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [dismissedInsightKey, setDismissedInsightKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (silent = false) => {
    if (!isStaging) return;
    if (!silent) setLoading(true);
    setNow(new Date());
    const settled = await Promise.allSettled([
      getVanLocations(),
      getVans(),
      getRouteWeek(),
      getArSummary(),
    ]);
    const [locS, vansS, weekS, arS] = settled;

    setVansError(shouldShowVansError(locS.status === 'fulfilled'));
    if (locS.status === 'fulfilled') {
      setLocations(Array.isArray(locS.value) ? locS.value : []);
    } else {
      setLocations([]);
    }
    if (vansS.status === 'fulfilled') {
      setFleet(Array.isArray(vansS.value) ? vansS.value : []);
    } else if (locS.status === 'rejected') {
      setFleet([]);
    }

    if (weekS.status === 'fulfilled') setWeek(weekS.value);
    if (arS.status === 'fulfilled' && Array.isArray(arS.value.per_customer)) {
      setArRows(arS.value.per_customer.map((r) => ({ id: r.id, balance: r.balance })));
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useVisiblePolling(() => {
    void load(true);
  }, OPS_POLL_MS, { immediate: false });

  const vans: OpsVanRow[] = useMemo(
    () => buildOpsVans(locations, fleet, now),
    [locations, fleet, now],
  );

  const stops: OpsStop[] = useMemo(() => {
    const raw = stopsForVisitDay(week, todayVisitDay(now));
    return applyArBalances(raw, arRows);
  }, [week, now, arRows]);

  const mappedStops = useMemo(() => stops.filter((s) => s.position), [stops]);
  const unmappedStops = useMemo(() => stops.filter((s) => !s.position), [stops]);
  const lines = useMemo(() => routePolylines(stops), [stops]);

  const insight: OpsInsight | null = useMemo(() => {
    const pick = pickOpsInsight(stops, vans);
    if (!pick) return null;
    const key = `${pick.customerId}:${pick.amount}`;
    if (dismissedInsightKey === key) return null;
    return pick;
  }, [stops, vans, dismissedInsightKey]);

  const mapCenter: LatLngExpression = useMemo(() => {
    const pts = [
      ...vans.filter((v) => v.position).map((v) => v.position!),
      ...mappedStops.map((s) => s.position!),
    ];
    if (pts.length === 0) return DEFAULT_CENTER;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
    return [lat, lng];
  }, [vans, mappedStops]);

  const selectVan = (van: OpsVanRow) => {
    setSelectedVanId(van.vanId);
    if (van.position) setFocusTarget(van.position);
  };

  if (!isStaging) {
    return (
      <div style={{ padding: 40, color: '#94A3B8' }}>
        Ops Map is staging only. <Link to="/dashboard">Go to dashboard</Link>
      </div>
    );
  }

  const done = stops.filter((s) => s.visited).length;
  const remaining = stops.length - done;

  return (
    <div style={rootStyle}>
      <div aria-hidden style={starsStyle} />

      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/agent/nexus" style={backLink}>
            <ArrowLeft size={14} /> Nexus
          </Link>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', color: '#7C8DB5', textTransform: 'uppercase' }}>
              Zava · Ops Map
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Vans & today&apos;s route</h1>
          </div>
        </div>
        <button type="button" style={ghostBtn} onClick={() => void load()} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <div className="zava-ops-grid" style={gridStyle}>
        {/* Map */}
        <section style={mapPanel}>
          {insight && (
            <div style={insightCard}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', color: '#5EEAD4', marginBottom: 8 }}>
                ZAVA INSIGHT
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: '#E2E8F0' }}>
                <strong>{insight.vanLabel}</strong> visits <strong>{insight.customerName}</strong> today. They owe{' '}
                <strong>${Math.round(insight.amount).toLocaleString('en-US')}</strong>. Ask the driver to collect?
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" style={tealBtn} onClick={() => navigate(insight.href)}>
                  Open customer
                </button>
                <button
                  type="button"
                  style={ghostBtn}
                  onClick={() => setDismissedInsightKey(`${insight.customerId}:${insight.amount}`)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {vansError ? (
            <div style={errorOverlay}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>Couldn&apos;t load vans</p>
              <button type="button" style={tealBtn} onClick={() => void load()}>
                Retry
              </button>
            </div>
          ) : (
            <div className="zava-ops-map" style={{ position: 'absolute', inset: 0 }}>
              <MapContainer
                center={mapCenter}
                zoom={11}
                className="h-full w-full"
                style={{ height: '100%', width: '100%', background: '#0a1220' }}
              >
                <TileLayer attribution={OSM_ATTR} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapFocus target={focusTarget} />
                {lines.map((line, i) => (
                  <Polyline
                    key={`line-${i}`}
                    positions={line.map((p) => [p.lat, p.lng] as LatLngExpression)}
                    pathOptions={{
                      color: '#2DD4BF',
                      weight: 3,
                      opacity: 0.85,
                      className: 'zava-ops-route',
                    }}
                  />
                ))}
                {mappedStops.map((s) => (
                  <Marker
                    key={`stop-${s.customerId}`}
                    position={[s.position!.lat, s.position!.lng]}
                    icon={createStopIcon(s.visited)}
                  >
                    <Popup>
                      <div style={{ minWidth: 160 }}>
                        <strong>{s.name}</strong>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{s.visited ? 'Visited' : 'Remaining'}</div>
                        {s.owed != null && s.owed > 0.005 && (
                          <div style={{ fontSize: 12, color: '#B45309' }}>
                            Owes ${Math.round(s.owed).toLocaleString('en-US')}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {vans
                  .filter((v) => v.position)
                  .map((v) => {
                    const color = vanStatusColor(v.status);
                    return (
                      <Marker
                        key={v.vanId}
                        position={[v.position!.lat, v.position!.lng]}
                        icon={createDotIcon(color, v.vanNumber, selectedVanId === v.vanId ? 42 : 36)}
                        eventHandlers={{ click: () => selectVan(v) }}
                      >
                        <Popup>
                          <div style={{ minWidth: 180 }}>
                            <strong>{v.vanNumber}</strong>
                            <div>{v.driverName}</div>
                            <div style={{ color, fontWeight: 700, marginTop: 4 }}>{vanStatusLabel(v.status)}</div>
                            <div style={{ fontSize: 12, color: '#64748B' }}>{v.pingLabel}</div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
              </MapContainer>
            </div>
          )}
        </section>

        {/* Right: Vans today */}
        <aside style={sidePanel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={sectionTitle}>Vans today</div>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>
              {done}/{stops.length || 0} stops · {remaining} left
            </span>
          </div>

          {loading && <p style={{ color: '#64748B', fontSize: 12 }}>Loading…</p>}
          {!loading && !vansError && vans.length === 0 && (
            <p style={{ color: '#64748B', fontSize: 12 }}>No vans in the fleet list.</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', flex: 1 }}>
            {vans.map((v) => {
              const color = vanStatusColor(v.status);
              const selected = selectedVanId === v.vanId;
              return (
                <button
                  key={v.vanId}
                  type="button"
                  onClick={() => selectVan(v)}
                  style={{
                    ...vanCard,
                    borderColor: selected ? color : 'rgba(148,163,184,0.16)',
                    boxShadow: selected ? `0 0 16px ${color}44` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: color,
                        boxShadow: `0 0 10px ${color}`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{v.vanNumber}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8' }}>{v.driverName}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color }}>{vanStatusLabel(v.status)}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{v.pingLabel}</div>
                    </div>
                  </div>
                  {!v.position && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#94A3B8' }}>
                      <MapPin size={10} style={{ display: 'inline', marginRight: 4 }} />
                      Van dot only when a ping has coordinates
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {unmappedStops.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={sectionTitle}>No map location</div>
              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, maxHeight: 140, overflow: 'auto' }}>
                {unmappedStops.map((s) => (
                  <li key={s.customerId} style={{ fontSize: 12, color: '#CBD5E1', padding: '4px 0' }}>
                    {s.name}
                    <span style={{ color: '#64748B' }}> · {s.visited ? 'visited' : 'remaining'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* Module chips */}
      <nav style={chipsRow} aria-label="Modules">
        {OPS_MODULE_CHIPS.map((c) => (
          <Link
            key={c.label}
            to={c.href}
            style={{
              ...chip,
              borderColor: c.href === '/agent/ops-map' ? 'rgba(45,212,191,0.55)' : 'rgba(148,163,184,0.2)',
              color: c.href === '/agent/ops-map' ? '#5EEAD4' : '#CBD5E1',
            }}
          >
            {c.label === 'Delivery' ? <Truck size={12} /> : null}
            {c.label}
          </Link>
        ))}
      </nav>

      <style>{`
        .zava-ops-map .leaflet-container {
          filter: grayscale(0.35) brightness(0.72) contrast(1.15) saturate(0.75);
          background: #0a1220 !important;
        }
        .zava-ops-map .leaflet-control-attribution {
          background: rgba(6,12,24,.75) !important;
          color: #94a3b8 !important;
        }
        .zava-ops-map .leaflet-control-attribution a { color: #93c5fd !important; }
        .zava-ops-map .leaflet-popup-content-wrapper {
          background: #0f1a2e;
          color: #e2e8f0;
          border-radius: 12px;
        }
        .zava-ops-map .leaflet-popup-tip { background: #0f1a2e; }
        @media (max-width: 1000px) {
          .zava-ops-grid { grid-template-columns: 1fr !important; }
          .zava-ops-grid > section { min-height: 420px !important; }
        }
      `}</style>
    </div>
  );
}

const rootStyle: CSSProperties = {
  minHeight: '100%',
  position: 'relative',
  background: '#030712',
  color: '#E8EEF9',
  padding: '16px 18px 20px',
  fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const starsStyle: CSSProperties = {
  pointerEvents: 'none',
  position: 'absolute',
  inset: 0,
  opacity: 0.35,
  backgroundImage:
    'radial-gradient(1px 1px at 12% 20%, #fff 0, transparent 2px), radial-gradient(1px 1px at 70% 40%, #cbd5e1 0, transparent 2px), radial-gradient(1px 1px at 40% 80%, #fff 0, transparent 2px)',
};

const headerStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

const backLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: '#93C5FD',
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
};

const gridStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '1fr minmax(280px, 340px)',
  gap: 12,
  flex: 1,
  minHeight: 520,
};

const mapPanel: CSSProperties = {
  position: 'relative',
  borderRadius: 18,
  overflow: 'hidden',
  border: '1px solid rgba(148,163,184,0.14)',
  background: '#0a1220',
  minHeight: 520,
};

const sidePanel: CSSProperties = {
  position: 'relative',
  borderRadius: 18,
  border: '1px solid rgba(148,163,184,0.14)',
  background: 'rgba(8,14,28,0.72)',
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  backdropFilter: 'blur(12px)',
  maxHeight: '70vh',
};

const sectionTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#7C8DB5',
};

const vanCard: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  background: 'rgba(10,18,34,0.8)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: 12,
  padding: '10px 12px',
  color: '#E2E8F0',
  cursor: 'pointer',
};

const insightCard: CSSProperties = {
  position: 'absolute',
  zIndex: 500,
  top: 14,
  left: 14,
  maxWidth: 340,
  padding: 14,
  borderRadius: 14,
  background: 'rgba(8,16,32,0.92)',
  border: '1px solid rgba(45,212,191,0.35)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(10px)',
};

const errorOverlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(3,7,18,0.92)',
  zIndex: 400,
  color: '#E2E8F0',
};

const tealBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '8px 12px',
  background: '#2DD4BF',
  color: '#042f2e',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: 10,
  padding: '8px 12px',
  background: 'transparent',
  color: '#CBD5E1',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
};

const chipsRow: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'center',
  paddingTop: 4,
};

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,0.2)',
  background: 'rgba(8,14,28,0.65)',
  fontSize: 11,
  fontWeight: 700,
  textDecoration: 'none',
};
