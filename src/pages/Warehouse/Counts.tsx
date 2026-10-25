/**
 * Cycle counts board. Every number comes from GET /counts; this page only formats it.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  cancelCount,
  createCount,
  listCounts,
  type CountScopeType,
  type CountStatus,
  type CycleCount,
} from '../../services/cycleCountService';
import { getProducts, type Product } from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';
import { getLocationsFlat } from '../../services/stockLocationService';
import { countStatusColor, scopeLabel } from './countLabels';

const STATUSES: CountStatus[] = ['draft', 'counting', 'review', 'approved', 'cancelled'];

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

/** Review: lines to post and the estimate at frozen cost. Approved: the amount actually posted. */
function varianceSummary(row: CycleCount): string {
  if (row.status === 'approved' && row.posted_value != null) return `posted ${formatCurrency(row.posted_value)}`;
  if (row.variance_lines == null) return '—';
  const value = row.variance_value != null ? ` · est. ${formatCurrency(row.variance_value)}` : '';
  if (row.status === 'review') return `${row.variance_lines} to post${value}`;
  return `${row.variance_lines}${value}`;
}

function when(value: string | null): string {
  return value ? value.slice(0, 16).replace('T', ' ') : '—';
}

export default function CountsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { hasRole } = useAuth();
  const canManage = hasRole('admin', 'manager');
  const statusFilter = (params.get('status') ?? '') as CountStatus | '';
  const [items, setItems] = useState<CycleCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listCounts(statusFilter));
      setError(null);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function pickStatus(status: CountStatus | '') {
    const next = new URLSearchParams(params);
    if (status) next.set('status', status);
    else next.delete('status');
    setParams(next);
  }

  async function onCancel(row: CycleCount) {
    if (!window.confirm(`Cancel ${row.count_number}?`)) return;
    setError(null);
    try {
      await cancelCount(row.id);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Counts</h1>
        {canManage && (
          <button type="button" style={primary} onClick={() => setDialogOpen(true)}>New count</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filter status">
        <button type="button" aria-pressed={statusFilter === ''} style={chip(statusFilter === '')} onClick={() => pickStatus('')}>All</button>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={statusFilter === status}
            style={chip(statusFilter === status)}
            onClick={() => pickStatus(status)}
          >
            {status}
          </button>
        ))}
      </div>

      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ fontSize: 13 }}>Loading counts…</p>}

      <div style={{ overflowX: 'auto' }}>
        <table aria-label="Counts" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              {['Number', 'Scope', 'Status', 'Counted', 'Variances', 'Created', 'Started', ''].map((heading) => (
                <th key={heading} style={th}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                data-testid={`count-row-${row.id}`}
                onClick={() => navigate(`/warehouse/counts/${row.id}`)}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--color-redwood-border)' }}
              >
                <td style={td}>{row.count_number}</td>
                <td style={td}>
                  {scopeLabel(row)}
                  {row.blind && <span data-testid={`count-blind-${row.id}`} style={{ ...pill('#64748b'), marginLeft: 6 }}>blind</span>}
                </td>
                <td style={td}><span style={pill(countStatusColor(row.status))}>{row.status}</span></td>
                <td style={td}>{`${row.lines_counted} / ${row.lines_total}`}</td>
                <td style={td} data-testid={`count-variance-${row.id}`}>{varianceSummary(row)}</td>
                <td style={td}>{when(row.created_at)}</td>
                <td style={td}>{when(row.started_at)}</td>
                <td style={td}>
                  {canManage && (row.status === 'draft' || row.status === 'counting') && (
                    <button
                      type="button"
                      style={btn}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onCancel(row);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && items.length === 0 && <p style={{ fontSize: 13, marginTop: 8 }}>No counts.</p>}
      </div>

      {dialogOpen && (
        <NewCountDialog
          onClose={() => setDialogOpen(false)}
          onCreated={(id) => {
            setDialogOpen(false);
            navigate(`/warehouse/counts/${id}`);
          }}
        />
      )}
    </div>
  );
}

function NewCountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [scopeType, setScopeType] = useState<CountScopeType>('locations');
  const [prefix, setPrefix] = useState('');
  const [paths, setPaths] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [blind, setBlind] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLocationsFlat()
      .then((rows) => setPaths(
        rows
          .filter((row) => row.isActive && row.kind !== 'van')
          .map((row) => row.path || row.code)
          .filter(Boolean),
      ))
      .catch(() => setPaths([]));
  }, []);

  useEffect(() => {
    if (scopeType !== 'products' || products.length) return;
    getProducts().then(setProducts).catch(() => setProducts([]));
  }, [scopeType, products.length]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((row) => row.sku?.toLowerCase().includes(q) || row.name?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, query]);

  const chosen = products.filter((row) => selected.includes(Number(row.id)));

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  const ready = scopeType === 'all'
    || (scopeType === 'locations' && prefix.trim() !== '')
    || (scopeType === 'products' && selected.length > 0);

  async function submit() {
    setError(null);
    setSaving(true);
    try {
      const created = await createCount({
        scope_type: scopeType,
        scope_path_prefix: scopeType === 'locations' ? prefix.trim() : null,
        scope_product_ids: scopeType === 'products' ? selected : null,
        blind,
        note: note.trim() || null,
      });
      onCreated(created.id);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-label="New count" style={{ ...panel, position: 'fixed', inset: 40, overflow: 'auto', zIndex: 20, maxWidth: 520, margin: '0 auto' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>New count</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        <fieldset style={{ border: 'none', padding: 0, display: 'flex', gap: 12, fontSize: 13 }}>
          <legend style={{ fontSize: 12, marginBottom: 4 }}>Scope</legend>
          {([['locations', 'Locations'], ['products', 'Products'], ['all', 'All']] as const).map(([value, label]) => (
            <label key={value} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="radio" name="scope" value={value} checked={scopeType === value} onChange={() => setScopeType(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        {scopeType === 'locations' && (
          <label style={{ fontSize: 12 }}>
            Location path
            <input
              aria-label="Location path"
              list="count-location-paths"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              placeholder="e.g. MAIN/A"
              style={field}
            />
            <datalist id="count-location-paths">
              {paths.map((path) => <option key={path} value={path} />)}
            </datalist>
            <span style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>e.g. MAIN/A — counts every bin and warehouse under it.</span>
          </label>
        )}

        {scopeType === 'products' && (
          <div style={{ display: 'grid', gap: 6 }}>
            <input
              aria-label="Search products"
              placeholder="Search SKU or name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={field}
            />
            {chosen.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-testid="chosen-products">
                {chosen.map((row) => (
                  <button key={row.id} type="button" style={btn} onClick={() => toggle(Number(row.id))} aria-label={`Remove ${row.sku}`}>
                    {row.sku} ×
                  </button>
                ))}
              </div>
            )}
            <div style={{ maxHeight: 220, overflow: 'auto', display: 'grid', gap: 4 }}>
              {matches.map((row) => (
                <label key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.sku}`}
                    checked={selected.includes(Number(row.id))}
                    onChange={() => toggle(Number(row.id))}
                  />
                  <span>{row.sku} · {row.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" aria-label="Blind count" checked={blind} onChange={(event) => setBlind(event.target.checked)} />
          Blind count — counters do not see expected quantities
        </label>
        <label style={{ fontSize: 12 }}>
          Note
          <textarea aria-label="Count note" value={note} onChange={(event) => setNote(event.target.value)} style={field} />
        </label>
      </div>
      {error && <p role="alert" data-testid="create-count-error" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" style={primary} disabled={!ready || saving} onClick={() => void submit()}>Create draft</button>
        <button type="button" style={btn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: '12px 14px',
};
const btn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 7,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
const primary: CSSProperties = { ...btn, background: '#4F8EF7', color: '#fff', border: 'none' };
const field: CSSProperties = { ...btn, width: '100%', textAlign: 'left', display: 'block' };
const th: CSSProperties = { padding: '8px 6px', borderBottom: '1px solid var(--color-redwood-border)' };
const td: CSSProperties = { padding: '8px 6px' };

function chip(active: boolean): CSSProperties {
  return {
    ...btn,
    borderRadius: 20,
    textTransform: 'capitalize',
    background: active ? '#4F8EF7' : btn.background,
    color: active ? '#fff' : undefined,
    border: active ? '1px solid #4F8EF7' : btn.border,
  };
}

function pill(color: string): CSSProperties {
  return {
    border: `1px solid ${color}`,
    color,
    borderRadius: 20,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
  };
}
