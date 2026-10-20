import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { DivIcon, Icon, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useVisiblePolling } from '../../../hooks/useVisiblePolling';
import { isStaging } from '../../../config/appEnv';
import { getVanLocations, getVans, type Van, type VanLocation } from '../../../services/api';
import { getRouteWeek, type RouteWeekResponse } from '../../../services/routeService';
import { getArSummary } from '../../../services/customerService';
import { vanStatusColor, vanStatusLabel } from '../../../lib/vanLiveStatus';
import {
  CHIP_TONE_COLOR,
  OPS_MODULE_CHIPS,
  OPS_ROUTE_COLORS,
  applyArBalances,
  buildOpsVans,
  pickOpsInsight,
  routeSegments,
  shouldShowVansError,
  stopsForVisitDay,
  todayVisitDay,
  vanRouteProgress,
  type OpsInsight,
  type OpsStop,
  type OpsVanRow,
} from './opsMapModel';

export const OPS_POLL_MS = 30_000;
const DEFAULT_CENTER: LatLngExpression = [26.2235, 50.5876];
const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Floating van pill — matches design labels; status is moving/stopped/offline only. */
function createVanPillIcon(opts: {
  color: string;
  vanNumber: string;
  statusLabel: string;
  progress: string;
  selected: boolean;
}) {
  const scale = opts.selected ? 1.06 : 1;
  const html = `
    <div style="
      transform:scale(${scale});
      display:inline-flex;align-items:center;gap:8px;
      padding:6px 12px 6px 8px;border-radius:999px;
      background:rgba(6,12,24,0.92);
      border:1px solid ${opts.color};
      box-shadow:0 0 18px ${opts.color}88, 0 8px 24px rgba(0,0,0,0.45);
      color:#E8EEF9;font:700 11px/1.1 ui-sans-serif,system-ui,sans-serif;
      white-space:nowrap;pointer-events:auto;
    ">
      <span style="
        width:22px;height:22px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;
        background:${opts.color}33;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${opts.color}" stroke-width="2.2">
          <path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7V10z"/><circle cx="7" cy="17" r="1.6" fill="${opts.color}"/>
          <circle cx="17" cy="17" r="1.6" fill="${opts.color}"/>
        </svg>
      </span>
      <span style="display:flex;flex-direction:column;gap:2px;">
        <span style="letter-spacing:0.02em;">${escapeHtml(opts.vanNumber)}</span>
        <span style="display:flex;gap:8px;font-size:9px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">
          <span style="color:${opts.color}">${escapeHtml(opts.statusLabel)}</span>
          <span style="color:#94A3B8">${escapeHtml(opts.progress)}</span>
        </span>
      </span>
    </div>`;
  return new DivIcon({
    className: 'zava-van-pill',
    html,
    iconSize: [150, 40],
    iconAnchor: [75, 20],
    popupAnchor: [0, -18],
  });
}

function createStopIcon(opts: { visited: boolean; owed: boolean; color: string }) {
  const fill = opts.visited ? '#64748B' : opts.owed ? '#EF4444' : opts.color;
  const size = opts.owed ? 16 : 12;
  const svg = `
    <svg width="${size + 8}" height="${size + 8}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 2}"
        fill="${fill}" stroke="#0B1220" stroke-width="2"
        style="filter:drop-shadow(0 0 6px ${fill})"/>
      <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 4}" fill="#061018"/>
    </svg>`;
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
    popupAnchor: [0, -(size / 2)],
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
  const segments = useMemo(() => routeSegments(stops), [stops]);
  const progress = useMemo(() => vanRouteProgress(stops, vans), [stops, vans]);
  const progressByVan = useMemo(() => new Map(progress.map((p) => [p.vanId, p])), [progress]);

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
  const remaining = Math.max(0, stops.length - done);
  const liveVans = vans.filter((v) => v.hasPingToday).length;

  return (
    <div style={rootStyle}>
      <div className="zava-ops-map" style={mapLayer}>
        {vansError ? (
          <div style={errorOverlay}>
            <p style={{ fontWeight: 800, marginBottom: 10, fontSize: 16 }}>Couldn&apos;t load vans</p>
            <button type="button" style={primaryBtn} onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={11}
            zoomControl={false}
            attributionControl
            style={{ height: '100%', width: '100%', background: '#050a14' }}
          >
            <TileLayer attribution={OSM_ATTR} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapFocus target={focusTarget} />
            {segments.map((seg, i) => (
              <Polyline
                key={`seg-${seg.lineKey}-${i}`}
                positions={seg.points.map((p) => [p.lat, p.lng] as LatLngExpression)}
                pathOptions={{
                  color: seg.color,
                  weight: seg.dashed ? 3 : 4,
                  opacity: seg.dashed ? 0.75 : 0.95,
                  dashArray: seg.dashed ? '8 10' : undefined,
                  lineCap: 'round',
                  lineJoin: 'round',
                  className: 'zava-ops-route',
                }}
              />
            ))}
            {mappedStops.map((s, i) => {
              const color = OPS_ROUTE_COLORS[i % OPS_ROUTE_COLORS.length];
              const owed = s.owed != null && s.owed > 0.005;
              return (
                <Marker
                  key={`stop-${s.customerId}`}
                  position={[s.position!.lat, s.position!.lng]}
                  icon={createStopIcon({ visited: s.visited, owed, color })}
                >
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <strong>{s.name}</strong>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{s.visited ? 'Visited' : 'Remaining'}</div>
                      {owed && (
                        <div style={{ fontSize: 12, color: '#FCA5A5' }}>
                          Owes ${Math.round(s.owed!).toLocaleString('en-US')}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {vans
              .filter((v) => v.position)
              .map((v) => {
                const color = vanStatusColor(v.status);
                const prog = progressByVan.get(v.vanId);
                const progressLabel =
                  prog && prog.total > 0 ? `${prog.done}/${prog.total}` : '—';
                return (
                  <Marker
                    key={v.vanId}
                    position={[v.position!.lat, v.position!.lng]}
                    icon={createVanPillIcon({
                      color,
                      vanNumber: v.vanNumber,
                      statusLabel: vanStatusLabel(v.status),
                      progress: progressLabel,
                      selected: selectedVanId === v.vanId,
                    })}
                    eventHandlers={{ click: () => selectVan(v) }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>{v.vanNumber}</strong>
                        <div>{v.driverName}</div>
                        <div style={{ color, fontWeight: 700, marginTop: 4 }}>{vanStatusLabel(v.status)}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8' }}>{v.pingLabel}</div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
          </MapContainer>
        )}
      </div>

      {/* Top chrome */}
      <div style={topBar}>
        <Link to="/agent/nexus" style={backLink}>
          <ArrowLeft size={14} /> Nexus
        </Link>
        <div style={liveBadge}>
          LIVE MAP · {liveVans || vans.length} VANS · {remaining} STOPS LEFT
        </div>
        <button type="button" style={ghostIconBtn} onClick={() => void load()} disabled={loading} aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Insight — Open customer / Dismiss only (no driver message) */}
      {insight && !vansError && (
        <div className="zava-ops-insight" style={insightCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={insightOrb} aria-hidden />
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.16em', color: '#C4B5FD' }}>
              ZAVA · AN IDEA FOR YOU
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#E8EEF9' }}>
            <strong>{insight.vanLabel}</strong> visits <strong>{insight.customerName}</strong> today. They owe{' '}
            <strong>${Math.round(insight.amount).toLocaleString('en-US')}</strong>. Ask the driver to collect?
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" style={outlineTealBtn} onClick={() => navigate(insight.href)}>
              Open customer
            </button>
            <button
              type="button"
              style={textBtn}
              onClick={() => setDismissedInsightKey(`${insight.customerId}:${insight.amount}`)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Vans today */}
      <aside className="zava-ops-side" style={sidePanel}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Vans today</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: '#94A3B8' }}>
            {done} OF {stops.length || 0} DONE
          </div>
        </div>

        {loading && <p style={{ color: '#64748B', fontSize: 12 }}>Loading…</p>}
        {!loading && !vansError && vans.length === 0 && (
          <p style={{ color: '#64748B', fontSize: 12 }}>No vans in the fleet list.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', flex: 1 }}>
          {vans.map((v, i) => {
            const color = progressByVan.get(v.vanId)?.color || OPS_ROUTE_COLORS[i % OPS_ROUTE_COLORS.length];
            const statusColor = vanStatusColor(v.status);
            const prog = progressByVan.get(v.vanId);
            const selected = selectedVanId === v.vanId;
            const pct = prog && prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
            return (
              <button
                key={v.vanId}
                type="button"
                onClick={() => selectVan(v)}
                style={{
                  ...vanRow,
                  borderColor: selected ? `${color}99` : 'transparent',
                  boxShadow: selected ? `0 0 0 1px ${color}55` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      {v.vanNumber}
                      {prog?.lineLabel && prog.lineLabel !== v.vanNumber ? (
                        <span style={{ color: '#94A3B8', fontWeight: 600 }}> · {prog.lineLabel}</span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{v.driverName}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: statusColor }}>
                      {prog && prog.total > 0 ? `${prog.done} OF ${prog.total}` : vanStatusLabel(v.status)}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{v.pingLabel}</div>
                  </div>
                </div>
                <div style={progressTrack}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: color,
                      boxShadow: `0 0 10px ${color}`,
                    }}
                  />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#64748B', textAlign: 'left' }}>
                  {vanStatusLabel(v.status)}
                  {!v.position ? ' · No map location' : ''}
                </div>
              </button>
            );
          })}
        </div>

        {unmappedStops.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid rgba(148,163,184,0.12)', paddingTop: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#7C8DB5' }}>
              NO MAP LOCATION
            </div>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, maxHeight: 110, overflow: 'auto' }}>
              {unmappedStops.map((s) => (
                <li key={s.customerId} style={{ fontSize: 12, color: '#CBD5E1', padding: '3px 0' }}>
                  {s.name}
                  <span style={{ color: '#64748B' }}> · {s.visited ? 'visited' : 'remaining'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      {/* Module chips — design strip */}
      <nav style={chipsRow} aria-label="Modules">
        {OPS_MODULE_CHIPS.map((c) => (
          <Link key={c.label} to={c.href} style={chip}>
            <span style={{ ...chipDot, background: CHIP_TONE_COLOR[c.tone], boxShadow: `0 0 8px ${CHIP_TONE_COLOR[c.tone]}` }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 12, color: '#E2E8F0' }}>{c.label}</span>
              <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.blurb}
              </span>
            </span>
          </Link>
        ))}
      </nav>

      <style>{`
        .zava-ops-map .leaflet-container {
          filter: grayscale(0.45) brightness(0.55) contrast(1.25) saturate(0.55) hue-rotate(190deg);
          background: #050a14 !important;
        }
        .zava-ops-map .leaflet-control-attribution {
          background: rgba(6,12,24,.7) !important;
          color: #64748b !important;
          font-size: 10px !important;
        }
        .zava-ops-map .leaflet-control-attribution a { color: #64748b !important; }
        .zava-ops-map .leaflet-popup-content-wrapper {
          background: #0b1220;
          color: #e2e8f0;
          border-radius: 12px;
          border: 1px solid rgba(45,212,191,0.25);
        }
        .zava-ops-map .leaflet-popup-tip { background: #0b1220; }
        .zava-ops-map .leaflet-marker-icon.zava-van-pill {
          background: transparent !important;
          border: none !important;
        }
        .zava-ops-map .zava-ops-route {
          filter: drop-shadow(0 0 4px currentColor);
        }
        @media (max-width: 900px) {
          .zava-ops-side { width: min(100%, 320px) !important; max-height: 42vh !important; top: auto !important; bottom: 88px !important; }
          .zava-ops-insight { max-width: calc(100% - 24px) !important; }
        }
      `}</style>
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: 'relative',
  height: '100%',
  minHeight: '100vh',
  overflow: 'hidden',
  background: '#030712',
  color: '#E8EEF9',
  fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
};

const mapLayer: CSSProperties = {
  position: 'absolute',
  inset: 0,
};

const topBar: CSSProperties = {
  position: 'absolute',
  zIndex: 600,
  top: 14,
  left: 16,
  right: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  pointerEvents: 'none',
};

const backLink: CSSProperties = {
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: '#93C5FD',
  fontSize: 12,
  fontWeight: 700,
  textDecoration: 'none',
  padding: '6px 10px',
  borderRadius: 999,
  background: 'rgba(6,12,24,0.7)',
  border: '1px solid rgba(148,163,184,0.2)',
};

const liveBadge: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.14em',
  color: '#CBD5E1',
  textShadow: '0 0 12px rgba(0,0,0,0.8)',
};

const ghostIconBtn: CSSProperties = {
  pointerEvents: 'auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '1px solid rgba(148,163,184,0.25)',
  background: 'rgba(6,12,24,0.7)',
  color: '#CBD5E1',
  cursor: 'pointer',
};

const insightCard: CSSProperties = {
  position: 'absolute',
  zIndex: 600,
  top: 56,
  left: 16,
  width: 360,
  maxWidth: 'calc(100% - 360px)',
  padding: 16,
  borderRadius: 16,
  background: 'rgba(8,12,28,0.88)',
  border: '1px solid rgba(167,139,250,0.35)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 40px rgba(99,102,241,0.12)',
  backdropFilter: 'blur(14px)',
};

const insightOrb: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'conic-gradient(from 210deg, #22D3EE, #A78BFA, #F472B6, #22D3EE)',
  boxShadow: '0 0 16px rgba(167,139,250,0.7)',
  flexShrink: 0,
};

const sidePanel: CSSProperties = {
  position: 'absolute',
  zIndex: 600,
  top: 56,
  right: 16,
  width: 300,
  maxHeight: 'calc(100% - 150px)',
  padding: 16,
  borderRadius: 16,
  background: 'rgba(8,12,28,0.88)',
  border: '1px solid rgba(148,163,184,0.18)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
  backdropFilter: 'blur(14px)',
  display: 'flex',
  flexDirection: 'column',
};

const vanRow: CSSProperties = {
  textAlign: 'left',
  width: '100%',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 12,
  padding: '8px 6px',
  color: '#E2E8F0',
  cursor: 'pointer',
};

const progressTrack: CSSProperties = {
  height: 4,
  borderRadius: 999,
  background: 'rgba(148,163,184,0.18)',
  overflow: 'hidden',
};

const chipsRow: CSSProperties = {
  position: 'absolute',
  zIndex: 600,
  left: 16,
  right: 16,
  bottom: 16,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'center',
};

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(8,12,28,0.88)',
  backdropFilter: 'blur(12px)',
  textDecoration: 'none',
  maxWidth: 220,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
};

const chipDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
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

const primaryBtn: CSSProperties = {
  border: 'none',
  borderRadius: 10,
  padding: '8px 14px',
  background: '#2DD4BF',
  color: '#042f2e',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};

const outlineTealBtn: CSSProperties = {
  border: '1px solid #2DD4BF',
  borderRadius: 10,
  padding: '8px 12px',
  background: 'transparent',
  color: '#5EEAD4',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
};

const textBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#94A3B8',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  padding: '8px 4px',
};
