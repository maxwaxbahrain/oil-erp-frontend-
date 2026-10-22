import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatLocalDate } from '../../utils/dates';
import { formatCurrency } from '../../services/settingsService';
import { getOnHand, type OnHandPage } from '../../services/inventoryLedgerService';

const PAGE_SIZE = 50;

function qty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function StockOnHand() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const belowMin = params.get('below_min') === '1';
  const zero = params.get('zero') === '1';
  const driftOnly = params.get('drift') === '1';
  const page = Math.max(0, Number(params.get('page') || '0') || 0);

  const [draftSearch, setDraftSearch] = useState(search);
  const [data, setData] = useState<OnHandPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOnHand({
      search,
      below_min: belowMin,
      zero,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((pageData) => {
        if (!cancelled) setData(pageData);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : 'Could not load stock on hand.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, belowMin, zero, page]);

  function setFlag(key: 'below_min' | 'zero' | 'drift', on: boolean) {
    const next = new URLSearchParams(params);
    if (on) next.set(key, '1');
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }

  function applySearch(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    const trimmed = draftSearch.trim();
    if (trimmed) next.set('search', trimmed);
    else next.delete('search');
    next.delete('page');
    setParams(next);
  }

  function goPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 0) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
  }

  const rows = (data?.rows ?? []).filter((row) => (driftOnly ? row.drift : true));
  const pageCount = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
            Stock on hand
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-subtle)', marginTop: '4px' }}>
            {loading || !data
              ? '—'
              : `${data.totals.products} products · ${qty(data.totals.units)} units · ${formatCurrency(data.totals.value_at_cost)}`}
          </div>
        </div>
        <form onSubmit={applySearch} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search name or SKU"
            aria-label="Search name or SKU"
            style={{
              background: 'var(--color-redwood-bg-surface)',
              border: '1px solid var(--color-redwood-border)',
              borderRadius: '8px',
              padding: '7px 10px',
              fontSize: '12px',
              color: 'var(--color-redwood-text-main)',
            }}
          />
          <button type="submit" style={chip(false)}>Search</button>
          <button type="button" style={chip(belowMin)} onClick={() => setFlag('below_min', !belowMin)}>Below min</button>
          <button type="button" style={chip(zero)} onClick={() => setFlag('zero', !zero)}>Zero</button>
          <button type="button" style={chip(driftOnly)} onClick={() => setFlag('drift', !driftOnly)}>Drift</button>
        </form>
      </div>

      {error && (
        <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-brand-red)' }}>{error}</div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-redwood-border)', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-redwood-text-muted)' }}>
              {['Name', 'SKU', 'Unit', 'On hand', 'Min', 'Cost', 'Value', 'Last movement', 'Days idle'].map((label) => (
                <th key={label} style={{ padding: '8px 10px', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ padding: '16px 10px', color: 'var(--color-redwood-text-muted)' }}>—</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '16px 10px', color: 'var(--color-redwood-text-muted)' }}>
                  {error ? '—' : 'No products match these filters.'}
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr
                key={row.product_id}
                onClick={() => navigate(`/products/${row.product_id}`)}
                style={{ cursor: 'pointer', borderTop: '1px solid var(--color-redwood-border)' }}
              >
                <td style={{ padding: '8px 10px', color: 'var(--color-redwood-text-main)' }}>{row.name}</td>
                <td style={{ padding: '8px 10px' }}>{row.sku}</td>
                <td style={{ padding: '8px 10px' }}>{row.unit}</td>
                <td
                  style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums' }}
                  title={row.drift ? `Cached stock ${qty(row.stock_cached)} · ledger ${qty(row.on_hand)}` : undefined}
                >
                  {qty(row.on_hand)}
                </td>
                <td style={{ padding: '8px 10px' }}>{qty(row.min_stock)}</td>
                <td style={{ padding: '8px 10px' }}>{formatCurrency(row.cost)}</td>
                <td style={{ padding: '8px 10px' }}>{formatCurrency(row.value_at_cost)}</td>
                <td style={{ padding: '8px 10px' }}>{row.last_movement_date ? (formatLocalDate(row.last_movement_date) || '—') : '—'}</td>
                <td style={{ padding: '8px 10px' }}>{row.days_since_movement == null ? '—' : row.days_since_movement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>
        <span>{data ? `${data.total} products` : '—'}</span>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" style={chip(false)} disabled={page <= 0} onClick={() => goPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pageCount}</span>
          <button type="button" style={chip(false)} disabled={!data || (page + 1) * PAGE_SIZE >= data.total} onClick={() => goPage(page + 1)}>Next</button>
        </span>
      </div>
    </div>
  );
}

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
