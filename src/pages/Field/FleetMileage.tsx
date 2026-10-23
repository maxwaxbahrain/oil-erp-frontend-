import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronRight, Gauge, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MANAGEMENT_ROLES } from '../../utils/rbac';
import { formatLocalDate } from '../../utils/dates';
import { localIsoDate, localIsoDatePlusDays } from '../../utils/localDate';
import {
  getFleetMileage,
  recomputeFleetMileage,
  type FleetDistanceUnit,
  type FleetMileageReport,
  type FleetMileageSource,
} from '../../services/fleetService';

const C = {
  bg: '#060f1c',
  bg2: '#0a1726',
  bg3: '#0f1f33',
  blue: '#4F8EF7',
  green: '#22C55E',
  orange: '#F59E0B',
  purple: '#7C3AED',
  text: '#EEF2FF',
  muted: '#8BA3C7',
  dim: '#3E5678',
};

const panel: CSSProperties = {
  background: C.bg2,
  border: '1px solid rgba(255,255,255,.07)',
  borderRadius: 12,
};

type RangePreset = '7' | '30' | 'custom';

function formatDistance(value: number, unit: FleetDistanceUnit): string {
  const label = unit === 'km' ? 'km' : 'mi';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${label}`;
}

function sourceBadge(source: FleetMileageSource): { label: string; bg: string; color: string } {
  if (source === 'odometer') {
    return { label: 'Odometer', bg: 'rgba(245,158,11,.15)', color: C.orange };
  }
  return { label: 'GPS', bg: 'rgba(79,142,247,.15)', color: C.blue };
}

type VanAggregate = {
  van_id: string;
  van_name: string;
  daysActive: number;
  totalDistance: number;
  totalStops: number;
};

function buildVanAggregates(report: FleetMileageReport): VanAggregate[] {
  const map = new Map<string, VanAggregate>();
  for (const day of report.days) {
    for (const van of day.vans) {
      const existing = map.get(van.van_id);
      if (existing) {
        existing.daysActive += 1;
        existing.totalDistance += van.distance;
        existing.totalStops += van.stops;
      } else {
        map.set(van.van_id, {
          van_id: van.van_id,
          van_name: van.van_name,
          daysActive: 1,
          totalDistance: van.distance,
          totalStops: van.stops,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.van_name.localeCompare(b.van_name));
}

export default function FleetMileage() {
  const { hasRole } = useAuth();
  const canRecompute = hasRole(...MANAGEMENT_ROLES);

  const [preset, setPreset] = useState<RangePreset>('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [report, setReport] = useState<FleetMileageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const [recomputeDay, setRecomputeDay] = useState(localIsoDate());
  const [recomputing, setRecomputing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    const today = localIsoDate();
    if (preset === '7') {
      return { from: localIsoDatePlusDays(-6), to: today };
    }
    if (preset === '30') {
      return { from: localIsoDatePlusDays(-29), to: today };
    }
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    if (preset === 'custom' && (!customFrom || !customTo)) {
      setReport(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getFleetMileage(from || undefined, to || undefined);
      setReport(data);
      setExpandedDays(new Set());
    } catch (e) {
      setReport(null);
      setError(e instanceof Error ? e.message : 'Failed to load fleet mileage');
    } finally {
      setLoading(false);
    }
  }, [from, to, preset, customFrom, customTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const unit = report?.unit ?? 'miles';
  const unitShort = unit === 'km' ? 'km' : 'mi';

  const metrics = useMemo(() => {
    if (!report) {
      return {
        activeVans: 0,
        vanActiveDays: 0,
        avgPerVanActiveDay: 0,
      };
    }
    const vanIds = new Set<string>();
    let vanActiveDays = 0;
    for (const day of report.days) {
      vanActiveDays += day.vans.length;
      for (const van of day.vans) {
        vanIds.add(van.van_id);
      }
    }
    const avgPerVanActiveDay =
      vanActiveDays > 0 ? report.total_distance / vanActiveDays : 0;
    return {
      activeVans: vanIds.size,
      vanActiveDays,
      avgPerVanActiveDay,
    };
  }, [report]);

  const vanAggregates = useMemo(
    () => (report ? buildVanAggregates(report) : []),
    [report],
  );

  const sortedDays = useMemo(() => {
    if (!report) return [];
    return [...report.days].sort((a, b) => b.day.localeCompare(a.day));
  }, [report]);

  const toggleDay = (day: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleRecompute = async () => {
    if (!recomputeDay) return;
    setRecomputing(true);
    try {
      const result = await recomputeFleetMileage(recomputeDay);
      setToast(`Recomputed ${result.vans_updated} vans`);
      window.setTimeout(() => setToast(null), 3200);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recompute failed');
    } finally {
      setRecomputing(false);
    }
  };

  const darkInput: CSSProperties = {
    background: C.bg3,
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    color: C.text,
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 12px',
    fontFamily: 'inherit',
  };

  const th: CSSProperties = {
    padding: '10px 12px',
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.4px',
    color: C.muted,
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,.07)',
  };

  const td: CSSProperties = {
    padding: '11px 12px',
    fontSize: 11,
    color: C.text,
    borderBottom: '1px solid rgba(255,255,255,.04)',
  };

  const presetBtn = (id: RangePreset, label: string) => (
    <button
      type="button"
      onClick={() => setPreset(id)}
      style={{
        ...darkInput,
        cursor: 'pointer',
        background: preset === id ? 'rgba(79,142,247,.2)' : C.bg3,
        borderColor: preset === id ? C.blue : 'rgba(255,255,255,.1)',
        color: preset === id ? C.text : C.muted,
      }}
    >
      {label}
    </button>
  );

  const showEmpty =
    !loading && !error && report && report.days.length === 0;

  const showTables =
    !loading && !error && report && report.days.length > 0;

  return (
    <div
      className="flex flex-col gap-5 -mx-3 sm:-mx-6 lg:-mx-10 min-h-[calc(100vh-10rem)] px-3 sm:px-6 lg:px-10 pb-8"
      style={{ background: C.bg, color: C.text, fontFamily: 'inherit' }}
    >
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 50,
            background: C.bg2,
            border: `1px solid ${C.green}`,
            color: C.text,
            padding: '10px 16px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}
        >
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 pt-2">
        <div>
          <h1
            className="text-xl font-black uppercase tracking-tight flex items-center gap-2"
            style={{ color: C.text }}
          >
            <Gauge size={22} style={{ color: C.blue }} />
            Fleet mileage
          </h1>
          <p className="text-xs mt-1" style={{ color: C.muted }}>
            SPOD GPS & odometer distance by van and day
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{ ...darkInput, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          aria-label="Refresh fleet mileage"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>

      <div style={{ ...panel, padding: 16 }} className="flex flex-wrap items-end gap-3">
        {presetBtn('7', 'Last 7 days')}
        {presetBtn('30', 'Last 30 days')}
        {presetBtn('custom', 'Custom range')}
        {preset === 'custom' && (
          <>
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
              From
              <input
                type="date"
                aria-label="Range from"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={darkInput}
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
              To
              <input
                type="date"
                aria-label="Range to"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={darkInput}
              />
            </label>
          </>
        )}
        {from && to && preset !== 'custom' && (
          <span className="text-xs ml-auto" style={{ color: C.dim }}>
            {formatLocalDate(from)} – {formatLocalDate(to)}
          </span>
        )}
      </div>

      {canRecompute && (
        <div style={{ ...panel, padding: 16 }} className="flex flex-wrap items-end gap-3">
          <span className="text-[10px] font-black uppercase tracking-wider w-full" style={{ color: C.muted }}>
            Management — recompute day
          </span>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>
            Day
            <input
              type="date"
              aria-label="Recompute day"
              value={recomputeDay}
              onChange={(e) => setRecomputeDay(e.target.value)}
              style={darkInput}
            />
          </label>
          <button
            type="button"
            data-testid="fleet-mileage-recompute"
            disabled={recomputing || !recomputeDay}
            onClick={() => void handleRecompute()}
            style={{
              ...darkInput,
              background: C.blue,
              borderColor: C.blue,
              color: '#fff',
              cursor: recomputing ? 'wait' : 'pointer',
            }}
          >
            {recomputing ? 'Recomputing…' : 'Recompute day'}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{ ...panel, padding: 14, borderColor: 'rgba(239,68,68,.4)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: C.muted }}>
          <Loader2 size={18} className="animate-spin" />
          Loading fleet mileage…
        </div>
      )}

      {!loading && !error && report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: `Total distance (${unitShort})`, value: formatDistance(report.total_distance, unit) },
            { label: 'Active vans', value: String(metrics.activeVans) },
            { label: 'Total stops', value: report.total_stops.toLocaleString('en-US') },
            {
              label: `Avg / van / active day (${unitShort})`,
              value: formatDistance(metrics.avgPerVanActiveDay, unit),
            },
          ].map((tile) => (
            <div key={tile.label} style={{ ...panel, padding: '14px 16px' }}>
              <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: C.muted }}>
                {tile.label}
              </div>
              <div className="text-lg font-bold mt-1" style={{ color: C.text }}>
                {tile.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {showEmpty && (
        <div style={{ ...panel, padding: 24, textAlign: 'center', color: C.muted, fontSize: 13 }}>
          No trips recorded yet. Miles appear the day after drivers use SPOD.
        </div>
      )}

      {showTables && (
        <>
          <div style={{ ...panel, overflow: 'hidden' }}>
            <div className="px-4 py-3 border-b text-[10px] font-black uppercase tracking-wider" style={{ borderColor: 'rgba(255,255,255,.07)', color: C.muted }}>
              By day
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th} aria-hidden />
                    <th style={th}>Day</th>
                    <th style={th}>Distance</th>
                    <th style={th}>Stops</th>
                    <th style={th}>Vans active</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDays.map((dayRow) => {
                    const open = expandedDays.has(dayRow.day);
                    return (
                      <Fragment key={dayRow.day}>
                        <tr>
                          <td style={td}>
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={`${open ? 'Collapse' : 'Expand'} ${dayRow.day}`}
                              onClick={() => toggleDay(dayRow.day)}
                              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', padding: 0 }}
                            >
                              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          </td>
                          <td style={td}>{formatLocalDate(dayRow.day)}</td>
                          <td style={td}>{formatDistance(dayRow.total_distance, unit)}</td>
                          <td style={td}>{dayRow.total_stops}</td>
                          <td style={td}>{dayRow.vans.length}</td>
                        </tr>
                        {open &&
                          dayRow.vans.map((van) => {
                            const badge = sourceBadge(van.source);
                            return (
                              <tr key={`${dayRow.day}-${van.van_id}`} style={{ background: C.bg3 }}>
                                <td style={td} />
                                <td style={{ ...td, paddingLeft: 28 }} colSpan={1}>
                                  {van.van_name || `Van ${van.van_id}`}
                                </td>
                                <td style={td}>{formatDistance(van.distance, unit)}</td>
                                <td style={td}>{van.stops}</td>
                                <td style={td}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      fontSize: 9,
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '.3px',
                                      padding: '3px 8px',
                                      borderRadius: 6,
                                      background: badge.bg,
                                      color: badge.color,
                                      marginRight: 8,
                                    }}
                                  >
                                    {badge.label}
                                  </span>
                                  <span style={{ color: C.dim, fontSize: 10 }}>{van.ping_count} pings</span>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...panel, overflow: 'hidden' }}>
            <div className="px-4 py-3 border-b text-[10px] font-black uppercase tracking-wider" style={{ borderColor: 'rgba(255,255,255,.07)', color: C.muted }}>
              By van (range totals)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]" data-testid="fleet-mileage-by-van">
                <thead>
                  <tr>
                    <th style={th}>Van</th>
                    <th style={th}>Days active</th>
                    <th style={th}>Total distance</th>
                    <th style={th}>Avg / day</th>
                    <th style={th}>Stops</th>
                  </tr>
                </thead>
                <tbody>
                  {vanAggregates.map((row) => (
                    <tr key={row.van_id}>
                      <td style={td}>{row.van_name || `Van ${row.van_id}`}</td>
                      <td style={td}>{row.daysActive}</td>
                      <td style={td}>{formatDistance(row.totalDistance, unit)}</td>
                      <td style={td}>
                        {formatDistance(row.daysActive > 0 ? row.totalDistance / row.daysActive : 0, unit)}
                      </td>
                      <td style={td}>{row.totalStops}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
