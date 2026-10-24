import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../services/settingsService';
import {
  createReorderDraftPo,
  getProductDemand,
  getReorderSuggestions,
  getReorderSummary,
  runReorderNow,
  snoozeProduct,
  unsnoozeProduct,
  type DemandSeries,
  type ReorderSuggestion,
  type ReorderSummary,
} from '../../services/reorderService';
import { formatLocalDate, formatStoredDateTime } from '../../utils/dates';
import { localIsoDate, localIsoDatePlusDays } from '../../utils/localDate';

const SNOOZE_DAYS = [7, 14, 30] as const;
const NO_SUPPLIER_TIP = 'Set a preferred supplier on the product first';
const READ_ONLY_TIP = 'Only admin and manager can create draft POs or snooze';
const COLUMNS = ['', '', 'Product', 'On hand (warehouse)', 'On order', 'Projected', 'Reorder point', 'Avg daily demand', 'Days of cover', 'Lead time', 'Suggested qty', ''];

type Group = { key: string; supplierId: number | null; supplierName: string; rows: ReorderSuggestion[] };
type Notice =
  | { kind: 'po'; poNumber: string; supplierId: number }
  | { kind: 'run'; dueCount: number; digestSent: boolean }
  | { kind: 'error'; message: string };

function qty(n: number | null | undefined, digits = 4): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function suggestedLabel(row: ReorderSuggestion): string {
  if (row.suggested_packs == null) return qty(row.suggested_qty);
  return `${qty(row.suggested_qty)} (${qty(row.suggested_packs)} ${row.suggested_packs === 1 ? 'pack' : 'packs'})`;
}

/** Group API rows by the supplier the API chose. Rows keep the API's order. */
function groupBySupplier(rows: ReorderSuggestion[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = row.supplier_id == null ? 'none' : String(row.supplier_id);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        supplierId: row.supplier_id,
        supplierName: row.supplier_id == null ? 'No supplier' : (row.supplier_name || `Supplier ${row.supplier_id}`),
        rows: [],
      };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.supplierId == null) return 1;
    if (b.supplierId == null) return -1;
    return a.supplierName.localeCompare(b.supplierName);
  });
}

export default function ReorderPlanning() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('admin', 'manager');
  const [params, setParams] = useSearchParams();
  const productIdParam = params.get('product_id');
  const productId = productIdParam && Number.isFinite(Number(productIdParam)) ? Number(productIdParam) : null;

  const [includeSnoozed, setIncludeSnoozed] = useState(false);
  const [rows, setRows] = useState<ReorderSuggestion[]>([]);
  const [summary, setSummary] = useState<ReorderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [demand, setDemand] = useState<Record<number, DemandSeries | 'error'>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, totals] = await Promise.all([
        // A single product is shown whether or not it is due.
        getReorderSuggestions({ include_snoozed: includeSnoozed, only_due: productId == null }),
        getReorderSummary(),
      ]);
      setRows(productId == null ? list : list.filter((row) => row.product_id === productId));
      setSummary(totals);
      setSelected(new Set());
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not load reorder suggestions.');
    } finally {
      setLoading(false);
    }
  }, [includeSnoozed, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupBySupplier(rows), [rows]);
  const today = localIsoDate();

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createDraft(group: Group) {
    if (group.supplierId == null) return;
    const lines = group.rows
      .filter((row) => selected.has(row.product_id) && row.suggested_qty > 0)
      .map((row) => ({ product_id: row.product_id, quantity: row.suggested_qty }));
    if (lines.length === 0) return;
    setBusyGroup(group.key);
    setNotice(null);
    try {
      const created = await createReorderDraftPo(group.supplierId, lines);
      setNotice({ kind: 'po', poNumber: created.po_number, supplierId: group.supplierId });
      await load();
    } catch (err: unknown) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not create the draft PO.' });
    } finally {
      setBusyGroup(null);
    }
  }

  async function snooze(row: ReorderSuggestion, days: number) {
    setNotice(null);
    try {
      await snoozeProduct(row.product_id, localIsoDatePlusDays(days));
      await load();
    } catch (err: unknown) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not snooze.' });
    }
  }

  async function unsnooze(row: ReorderSuggestion) {
    setNotice(null);
    try {
      await unsnoozeProduct(row.product_id);
      await load();
    } catch (err: unknown) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not unsnooze.' });
    }
  }

  async function runNow() {
    setRunning(true);
    setNotice(null);
    try {
      const run = await runReorderNow();
      setNotice({ kind: 'run', dueCount: run.due_count, digestSent: run.digest_sent });
      await load();
    } catch (err: unknown) {
      setNotice({ kind: 'error', message: err instanceof Error ? err.message : 'Could not run reorder planning.' });
    } finally {
      setRunning(false);
    }
  }

  function toggleExpand(id: number) {
    const next = expanded === id ? null : id;
    setExpanded(next);
    if (next == null || demand[next]) return;
    getProductDemand(next)
      .then((series) => setDemand((prev) => ({ ...prev, [next]: series })))
      .catch(() => setDemand((prev) => ({ ...prev, [next]: 'error' })));
  }

  function clearProduct() {
    const next = new URLSearchParams(params);
    next.delete('product_id');
    setParams(next);
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h1 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
          Reorder planning
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {productId != null && (
            <button type="button" style={chip(true)} onClick={clearProduct}>
              One product · Clear
            </button>
          )}
          <button
            type="button"
            style={chip(includeSnoozed)}
            aria-pressed={includeSnoozed}
            onClick={() => setIncludeSnoozed((on) => !on)}
          >
            Show snoozed
          </button>
        </div>
      </div>

      <div data-testid="reorder-summary" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div style={card}>
          <div style={cardLabel}>Due to reorder</div>
          <div style={cardValue}>{summary ? summary.due_count : '—'}</div>
        </div>
        {(summary?.suppliers ?? []).map((s) => (
          <div key={s.supplier_id ?? 'none'} style={card}>
            <div style={cardLabel}>{s.supplier_id == null ? 'No supplier' : (s.supplier_name || `Supplier ${s.supplier_id}`)}</div>
            <div style={cardValue}>{s.due_count} due · {formatCurrency(s.suggested_value)}</div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <span data-testid="reorder-last-run" style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>
            {summary?.last_run_at ? `Last run ${formatStoredDateTime(summary.last_run_at)}` : 'No runs yet'}
          </span>
          {canWrite && (
            <button type="button" style={chip(false)} disabled={running} onClick={() => void runNow()}>
              {running ? 'Running…' : 'Run now'}
            </button>
          )}
        </div>
      </div>

      <p data-testid="on-order-note" style={{ margin: '0 0 10px', fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>
        On order includes draft POs — a suggestion disappears as soon as its draft PO exists.
      </p>

      {notice?.kind === 'po' && (
        <div data-testid="draft-po-created" style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-redwood-text-main)' }}>
          Draft PO{' '}
          <Link to={`/suppliers/${notice.supplierId}?tab=purchases`} style={{ fontWeight: 600, textDecoration: 'underline' }}>
            {notice.poNumber}
          </Link>{' '}
          created.
        </div>
      )}
      {notice?.kind === 'run' && (
        <div data-testid="reorder-run-result" style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-redwood-text-main)' }}>
          Run complete: {notice.dueCount} due · {notice.digestSent ? 'digest sent' : 'digest not sent'}
        </div>
      )}
      {notice?.kind === 'error' && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-brand-red)' }}>{notice.message}</div>
      )}
      {error && <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-brand-red)' }}>{error}</div>}

      {loading && <div style={{ fontSize: '12px', color: 'var(--color-redwood-text-muted)' }}>—</div>}
      {!loading && !error && groups.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--color-redwood-text-muted)' }}>Nothing to reorder.</div>
      )}

      {!loading && groups.map((group) => {
        const noSupplier = group.supplierId == null;
        const chosen = group.rows.filter((row) => selected.has(row.product_id) && row.suggested_qty > 0).length;
        const disabled = noSupplier || !canWrite || chosen === 0 || busyGroup === group.key;
        const tip = noSupplier ? NO_SUPPLIER_TIP : !canWrite ? READ_ONLY_TIP : chosen === 0 ? 'Select rows first' : undefined;
        return (
          <section key={group.key} data-testid={`supplier-group-${group.key}`} style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                {group.supplierName}
              </h2>
              <span title={tip}>
                <button
                  type="button"
                  style={{ ...chip(false), opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                  disabled={disabled}
                  onClick={() => void createDraft(group)}
                >
                  {busyGroup === group.key ? 'Creating…' : 'Create draft PO'}
                </button>
              </span>
            </div>
            <div style={{ overflowX: 'auto', border: '1px solid var(--color-redwood-border)', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--color-redwood-text-muted)' }}>
                    {COLUMNS.map((label, i) => (
                      <th key={`${label}-${i}`} style={th}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    const label = row.name || row.sku || `Product ${row.product_id}`;
                    const snoozed = row.snoozed_until != null && row.snoozed_until >= today;
                    const open = expanded === row.product_id;
                    const series = demand[row.product_id];
                    return (
                      <Fragment key={row.product_id}>
                        <tr data-testid={`reorder-row-${row.product_id}`} style={{ borderTop: '1px solid var(--color-redwood-border)' }}>
                          <td style={td}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${label}`}
                              checked={selected.has(row.product_id)}
                              disabled={noSupplier || !canWrite || row.suggested_qty <= 0}
                              onChange={() => toggleRow(row.product_id)}
                            />
                          </td>
                          <td style={td}>
                            <button
                              type="button"
                              aria-label={`Show demand for ${label}`}
                              aria-expanded={open}
                              onClick={() => toggleExpand(row.product_id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-redwood-text-muted)' }}
                            >
                              {open ? '▾' : '▸'}
                            </button>
                          </td>
                          <td style={{ ...td, color: 'var(--color-redwood-text-main)' }}>
                            <Link to={`/products/${row.product_id}`}>{label}</Link>
                            {row.sku && row.name && <span style={{ color: 'var(--color-redwood-text-subtle)' }}> · {row.sku}</span>}
                            {snoozed && (
                              <span data-testid={`snoozed-chip-${row.product_id}`} style={snoozeChip}>
                                Snoozed until {formatLocalDate(row.snoozed_until) || row.snoozed_until}
                              </span>
                            )}
                            {snoozed && canWrite && (
                              <button
                                type="button"
                                aria-label={`Unsnooze ${label}`}
                                onClick={() => void unsnooze(row)}
                                style={{ marginLeft: '6px', background: 'none', border: 'none', padding: 0, fontSize: '10px', textDecoration: 'underline', cursor: 'pointer', color: 'var(--color-redwood-text-main)' }}
                              >
                                Unsnooze
                              </button>
                            )}
                          </td>
                          <td style={num}>{qty(row.on_hand)}</td>
                          <td style={num}>{qty(row.on_order)}</td>
                          <td style={num}>{qty(row.projected)}</td>
                          <td style={num}>{qty(row.effective_reorder_point)}</td>
                          <td style={num}>{qty(row.avg_daily, 2)}</td>
                          <td style={num}>{qty(row.days_of_cover, 1)}</td>
                          <td style={num}>{row.lead_time} d</td>
                          <td style={num}>{row.due ? suggestedLabel(row) : 'Not due'}</td>
                          <td style={td}>
                            <select
                              aria-label={`Snooze ${label}`}
                              value=""
                              disabled={!canWrite}
                              title={canWrite ? undefined : READ_ONLY_TIP}
                              onChange={(e) => {
                                const days = Number(e.target.value);
                                if (days > 0) void snooze(row, days);
                              }}
                              style={selectStyle}
                            >
                              <option value="">Snooze…</option>
                              {SNOOZE_DAYS.map((d) => (
                                <option key={d} value={d}>{d} days</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={COLUMNS.length} style={{ padding: '8px 16px 12px', background: 'var(--color-redwood-row-bg)' }}>
                              <div data-testid={`demand-${row.product_id}`}>
                                {series == null && <span style={{ fontSize: '11px' }}>—</span>}
                                {series === 'error' && <span style={{ fontSize: '11px', color: 'var(--color-brand-red)' }}>Could not load demand.</span>}
                                {series != null && series !== 'error' && (
                                  <>
                                    <p style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>
                                      Avg daily {qty(series.avg_daily, 2)} · Total {qty(series.total)} · {series.days_with_sales} days with sales
                                      {series.last_sale_date ? ` · Last sale ${formatLocalDate(series.last_sale_date) || series.last_sale_date}` : ''}
                                    </p>
                                    {series.series.length === 0 ? (
                                      <span style={{ fontSize: '11px' }}>No sales in the window.</span>
                                    ) : (
                                      <div style={{ width: '100%', height: 120 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={series.series}>
                                            <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                                            <YAxis tick={{ fontSize: 9 }} width={32} />
                                            <Tooltip />
                                            <Bar dataKey="qty" fill="#4f8ef7" />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const th: CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: CSSProperties = { padding: '8px 10px' };
const num: CSSProperties = { ...td, fontVariantNumeric: 'tabular-nums' };
const card: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '10px',
  padding: '8px 12px',
};
const cardLabel: CSSProperties = { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-redwood-text-muted)' };
const cardValue: CSSProperties = { fontSize: '14px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginTop: '2px' };
const snoozeChip: CSSProperties = {
  marginLeft: '8px',
  padding: '1px 6px',
  borderRadius: '6px',
  fontSize: '10px',
  background: 'rgba(245,158,11,.15)',
  color: 'var(--color-redwood-text-main)',
};
const selectStyle: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '8px',
  padding: '4px 6px',
  fontSize: '11px',
  color: 'var(--color-redwood-text-main)',
};

function chip(active: boolean): CSSProperties {
  return {
    background: active ? 'rgba(79,142,247,.18)' : 'var(--color-redwood-bg-surface)',
    border: '1px solid var(--color-redwood-border)',
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '11px',
    color: 'var(--color-redwood-text-main)',
    cursor: 'pointer',
  };
}
