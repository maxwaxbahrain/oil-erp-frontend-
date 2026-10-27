import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDemandSummary,
  getProductDemand,
  type DemandProductDetail,
  type DemandSummaryRow,
} from '../../services/demandService';
import { INTERNAL_WEB_ROLES } from '../../utils/rbac';

const WINDOW_OPTIONS = [30, 90, 180, 365] as const;
const HORIZON_OPTIONS = [30, 60, 90] as const;

export type CanonicalMethod = 'average' | 'holt' | 'seasonal' | 'no_history' | 'unknown';

/** Normalize backend method; holt_weekly → holt. Unknown stays as raw for badge text. */
export function canonicalizeMethod(method: string | null | undefined): CanonicalMethod | string {
  const m = (method || '').trim();
  if (m === 'holt_weekly' || m === 'holt') return 'holt';
  if (m === 'average' || m === 'seasonal' || m === 'no_history') return m;
  return m || 'unknown';
}

export function methodBadgeMeta(method: string | null | undefined): {
  label: string;
  className: string;
  title?: string;
} {
  const key = canonicalizeMethod(method);
  if (key === 'average') {
    return {
      label: 'Average',
      className: 'bg-slate-200 text-slate-700',
    };
  }
  if (key === 'holt') {
    return {
      label: 'Holt',
      className: 'bg-blue-100 text-blue-800',
      title: 'trend',
    };
  }
  if (key === 'seasonal') {
    return {
      label: 'Seasonal',
      className: 'bg-purple-100 text-purple-800',
      title: 'yearly pattern detected',
    };
  }
  if (key === 'no_history') {
    return {
      label: 'No history',
      className: 'border border-slate-400 text-slate-600 bg-transparent',
    };
  }
  return {
    label: String(method || key),
    className: 'bg-slate-100 text-slate-600',
  };
}

export function formatAccuracyWape(wape: number | null | undefined): string {
  if (wape == null || Number.isNaN(Number(wape))) return '—';
  return `±${Math.round(Number(wape) * 100)}%`;
}

export function accuracyColor(wape: number | null | undefined): string {
  if (wape == null || Number.isNaN(Number(wape))) return 'var(--color-redwood-text-muted)';
  const pct = Number(wape) * 100;
  if (pct <= 15) return 'var(--color-brand-green)';
  if (pct <= 35) return '#d97706';
  return 'var(--color-brand-red)';
}

export function seasonalStrengthKey(
  methodsTried: Record<string, number | string> | null | undefined,
): string | null {
  if (!methodsTried) return null;
  return Object.keys(methodsTried).find((k) => k.startsWith('seasonal: strength=')) ?? null;
}

export function parseSeasonalStrength(key: string): string {
  const m = key.match(/seasonal:\s*strength=(.+)$/i);
  return m ? m[1].trim() : '';
}

export function methodTileCounts(rows: DemandSummaryRow[]): {
  average: number;
  holt: number;
  seasonal: number;
  no_history: number;
} {
  const out = { average: 0, holt: 0, seasonal: 0, no_history: 0 };
  for (const r of rows) {
    const c = canonicalizeMethod(r.method);
    if (c === 'average') out.average += 1;
    else if (c === 'holt') out.holt += 1;
    else if (c === 'seasonal') out.seasonal += 1;
    else if (c === 'no_history') out.no_history += 1;
  }
  return out;
}

function fmtNum(n: number, digits = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function displayQty(units: number | null | undefined, packQty: number | null, packs: boolean): string {
  if (units == null) return '—';
  if (packs && packQty != null && packQty > 0) return fmtNum(units / packQty, 2);
  if (packs && (!packQty || packQty <= 0)) return '—';
  return fmtNum(units, 1);
}

function coverColor(days: number | null): string {
  if (days == null) return 'var(--color-redwood-text-muted)';
  if (days < 14) return 'var(--color-brand-red)';
  if (days < 30) return '#d97706';
  return 'var(--color-redwood-text-main)';
}

export default function DemandForecasting() {
  const { hasRole } = useAuth();
  const canPlanReorder = INTERNAL_WEB_ROLES.some((r) => hasRole(r));

  const [windowDays, setWindowDays] = useState<number>(90);
  const [horizon, setHorizon] = useState<number>(30);
  const [search, setSearch] = useState('');
  const [packsMode, setPacksMode] = useState(false);
  const [rows, setRows] = useState<DemandSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<number, DemandProductDetail | 'loading' | 'error'>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDemandSummary({ windowDays, horizon });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load demand forecast.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [windowDays, horizon]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.sku ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const tiles = useMemo(() => {
    const withHistory = filtered.filter((r) => canonicalizeMethod(r.method) !== 'no_history');
    const atRisk = withHistory.filter(
      (r) => r.days_of_cover != null && r.days_of_cover < 14,
    );
    const forecastTotal = withHistory.reduce((s, r) => s + (r.forecast_units ?? 0), 0);
    const noHistory = filtered.filter((r) => canonicalizeMethod(r.method) === 'no_history').length;
    return { withHistory: withHistory.length, atRisk: atRisk.length, forecastTotal, noHistory };
  }, [filtered]);

  const byMethod = useMemo(() => methodTileCounts(filtered), [filtered]);

  const emptyWindow = !loading && !error && filtered.length > 0 && tiles.withHistory === 0;

  async function toggleExpand(productId: number) {
    if (expanded === productId) {
      setExpanded(null);
      return;
    }
    setExpanded(productId);
    if (detail[productId] != null) return;
    setDetail((d) => ({ ...d, [productId]: 'loading' }));
    try {
      const data = await getProductDemand(productId, {
        days: 365,
        bucket: 'week',
        windowDays,
      });
      setDetail((d) => ({ ...d, [productId]: data }));
    } catch {
      setDetail((d) => ({ ...d, [productId]: 'error' }));
    }
  }

  const chartWeeks = (productId: number) => {
    const d = detail[productId];
    if (!d || d === 'loading' || d === 'error') return [];
    return d.series.slice(-52).map((p) => ({
      week: p.bucket_start.slice(5),
      units: p.units,
    }));
  };

  return (
    <div data-testid="demand-forecast-page" className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-redwood-text-main">Demand Forecast</h1>
        <p className="text-sm text-redwood-text-muted mt-1">
          Net demand from the stock ledger — the same figures Reorder planning uses.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="text-xs text-redwood-text-muted">
          Window (days)
          <select
            data-testid="demand-window"
            className="block mt-1 border border-redwood-border rounded px-2 py-1 text-sm"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-redwood-text-muted">
          Forecast horizon (days)
          <select
            data-testid="demand-horizon"
            className="block mt-1 border border-redwood-border rounded px-2 py-1 text-sm"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          >
            {HORIZON_OPTIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-redwood-text-muted flex-1 min-w-[200px]">
          Search
          <span className="flex items-center gap-1 mt-1 border border-redwood-border rounded px-2 py-1">
            <Search size={14} />
            <input
              data-testid="demand-search"
              className="flex-1 text-sm outline-none bg-transparent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or SKU"
            />
          </span>
        </label>
        <button
          type="button"
          data-testid="demand-units-toggle"
          className="text-sm border border-redwood-border rounded px-3 py-2"
          onClick={() => setPacksMode((p) => !p)}
        >
          {packsMode ? 'Units / Packs (packs)' : 'Units / Packs (units)'}
        </button>
      </div>

      {!loading && !error && (
        <div data-testid="demand-tiles" className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4 text-sm">
          <div className="border border-redwood-border rounded p-2">
            <div className="text-redwood-text-muted text-xs">With history</div>
            <div className="font-bold">{tiles.withHistory}</div>
          </div>
          <div className="border border-redwood-border rounded p-2">
            <div className="text-redwood-text-muted text-xs">At risk (&lt;14d cover)</div>
            <div className="font-bold">{tiles.atRisk}</div>
          </div>
          <div className="border border-redwood-border rounded p-2">
            <div className="text-redwood-text-muted text-xs">Forecast units ({horizon}d)</div>
            <div className="font-bold">{fmtNum(tiles.forecastTotal, 0)}</div>
          </div>
          <div className="border border-redwood-border rounded p-2">
            <div className="text-redwood-text-muted text-xs">No history</div>
            <div className="font-bold">{tiles.noHistory}</div>
          </div>
          <div data-testid="demand-method-tiles" className="border border-redwood-border rounded p-2">
            <div className="text-redwood-text-muted text-xs mb-1">Products by method</div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
              <span>Average <strong data-testid="method-count-average">{byMethod.average}</strong></span>
              <span>Holt <strong data-testid="method-count-holt">{byMethod.holt}</strong></span>
              <span>Seasonal <strong data-testid="method-count-seasonal">{byMethod.seasonal}</strong></span>
              <span>No history <strong data-testid="method-count-no_history">{byMethod.no_history}</strong></span>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <p data-testid="demand-loading" className="text-sm text-redwood-text-muted">Loading demand summary…</p>
      )}

      {error && (
        <div data-testid="demand-error" className="text-sm text-redwood-text-main mb-2">
          {error}{' '}
          <button type="button" className="underline inline-flex items-center gap-1" onClick={() => void load()}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {emptyWindow && (
        <p data-testid="demand-empty" className="text-sm text-redwood-text-muted">
          No sales in the selected window.
        </p>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto border border-redwood-border rounded">
          <table data-testid="demand-table" className="w-full text-sm">
            <thead className="bg-redwood-row-bg text-left text-xs text-redwood-text-muted">
              <tr>
                <th className="p-2 w-8" />
                <th className="p-2">Product</th>
                <th className="p-2 text-right">On hand</th>
                <th className="p-2 text-right">Avg/day</th>
                <th className="p-2 text-right">Trend %</th>
                <th className="p-2 text-right">Forecast {horizon}d</th>
                <th className="p-2 text-right">Days cover</th>
                <th className="p-2">Stockout</th>
                <th className="p-2">Accuracy</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const open = expanded === row.product_id;
                const noHist = canonicalizeMethod(row.method) === 'no_history';
                const trendUp = row.trend_pct > 0;
                const trendDown = row.trend_pct < 0;
                const badge = methodBadgeMeta(row.method);
                return (
                  <Fragment key={row.product_id}>
                    <tr data-testid={`demand-row-${row.product_id}`} className="border-t border-redwood-border">
                      <td className="p-2">
                        <button type="button" aria-label="Expand" onClick={() => void toggleExpand(row.product_id)}>
                          {open ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-redwood-text-muted">{row.sku ?? '—'}</div>
                        <span
                          data-testid={`demand-method-${row.product_id}`}
                          title={badge.title}
                          className={`inline-block mt-0.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-2 text-right">{displayQty(row.on_hand_units, row.pack_qty, packsMode)}</td>
                      <td className="p-2 text-right">{noHist ? '—' : fmtNum(row.avg_daily, 2)}</td>
                      <td
                        className="p-2 text-right"
                        style={{ color: trendUp ? 'var(--color-brand-green)' : trendDown ? 'var(--color-brand-red)' : undefined }}
                      >
                        {noHist ? '—' : `${row.trend_pct > 0 ? '↑' : row.trend_pct < 0 ? '↓' : ''}${fmtNum(Math.abs(row.trend_pct), 1)}%`}
                      </td>
                      <td className="p-2 text-right">
                        {noHist ? (
                          '—'
                        ) : (
                          <>
                            <div>{displayQty(row.forecast_units, row.pack_qty, packsMode)}</div>
                            <div className="text-[10px] text-redwood-text-muted">
                              {displayQty(row.low, row.pack_qty, packsMode)}–{displayQty(row.high, row.pack_qty, packsMode)}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="p-2 text-right" style={{ color: coverColor(row.days_of_cover) }}>
                        {noHist || row.days_of_cover == null ? '—' : row.days_of_cover}
                      </td>
                      <td className="p-2 text-xs">{noHist ? '—' : row.stockout_date ?? '—'}</td>
                      <td
                        className="p-2 text-right text-xs"
                        data-testid={`demand-accuracy-${row.product_id}`}
                        title="Average error on recent weeks the model did not see."
                        style={{ color: accuracyColor(row.accuracy_wape) }}
                      >
                        {formatAccuracyWape(row.accuracy_wape)}
                      </td>
                      <td className="p-2">
                        {canPlanReorder && !noHist && (
                          <Link
                            data-testid={`demand-reorder-link-${row.product_id}`}
                            to={`/purchases/reorder?product_id=${row.product_id}`}
                            className="text-xs underline"
                          >
                            Plan reorder
                          </Link>
                        )}
                      </td>
                    </tr>
                    {open && (() => {
                      const rowDetail = detail[row.product_id];
                      const detailFc =
                        rowDetail != null && rowDetail !== 'loading' && rowDetail !== 'error'
                          ? rowDetail.forecast
                          : null;
                      const strengthKey = seasonalStrengthKey(detailFc?.methods_tried);
                      const strengthVal = strengthKey ? parseSeasonalStrength(strengthKey) : '';
                      const methodName = methodBadgeMeta(detailFc?.method ?? row.method).label;
                      const historyWeeks =
                        detailFc?.history_weeks ?? row.history_weeks ?? 0;
                      const panelWape =
                        detailFc?.accuracy_wape !== undefined
                          ? detailFc.accuracy_wape
                          : row.accuracy_wape;
                      return (
                      <tr>
                        <td colSpan={10} className="p-3 bg-redwood-row-bg">
                          {rowDetail === 'loading' && <span className="text-xs">Loading chart…</span>}
                          {rowDetail === 'error' && <span className="text-xs text-red-600">Could not load detail.</span>}
                          {rowDetail != null &&
                            rowDetail !== 'loading' &&
                            rowDetail !== 'error' && (
                              <>
                                <p className="text-xs text-redwood-text-muted mb-1">
                                  Total {fmtNum(rowDetail.stats.total_units, 1)} units ·{' '}
                                  {rowDetail.stats.days_with_sales} days with sales · Last 4w{' '}
                                  {fmtNum(rowDetail.stats.last_4w_units, 1)} vs prior 4w{' '}
                                  {fmtNum(rowDetail.stats.prior_4w_units, 1)}
                                </p>
                                <p
                                  data-testid={`demand-expand-method-${row.product_id}`}
                                  className="text-xs text-redwood-text-muted mb-1"
                                >
                                  Method: {methodName} · {historyWeeks} weeks of history
                                  {strengthKey ? (
                                    <>
                                      {' '}
                                      · Seasonal pattern strength {strengthVal} · accuracy measured
                                      in-sample
                                    </>
                                  ) : null}
                                </p>
                                <p
                                  data-testid={`demand-expand-accuracy-${row.product_id}`}
                                  className="text-xs mb-2"
                                  style={{ color: accuracyColor(panelWape) }}
                                >
                                  Accuracy: {formatAccuracyWape(panelWape)}
                                  {strengthKey ? ' (in-sample)' : ''}
                                </p>
                                <div style={{ width: '100%', height: 140 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartWeeks(row.product_id)}>
                                      <ReferenceLine y={0} stroke="#999" />
                                      <XAxis dataKey="week" tick={{ fontSize: 9 }} />
                                      <YAxis tick={{ fontSize: 9 }} width={36} />
                                      <Tooltip />
                                      <Bar dataKey="units">
                                        {chartWeeks(row.product_id).map((entry, i) => (
                                          <Cell key={i} fill={entry.units >= 0 ? '#4f8ef7' : '#ef4444'} />
                                        ))}
                                      </Bar>
                                    </BarChart>
                                  </ResponsiveContainer>
                                </div>
                              </>
                            )}
                        </td>
                      </tr>
                      );
                    })()}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
