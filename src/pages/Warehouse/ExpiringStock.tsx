/**
 * Expiring stock: lot balances that expire within N days, from GET /inventory/lots/expiring.
 * Days left and the expired flag come from the backend; the CSV is built from the rows
 * already on screen (formatting only).
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, type Product } from '../../services/productService';
import { getExpiringLots, type ExpiringLot } from '../../services/stockLotService';
import { expiringCsv } from './expiryCsv';
import { getLocationsFlat } from '../../services/stockLocationService';
import { formatLocalDate } from '../../utils/dates';

const WINDOWS = [7, 30, 60, 90];

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Could not load expiring stock.';
}

export default function ExpiringStock() {
  const [withinDays, setWithinDays] = useState(30);
  const [includeExpired, setIncludeExpired] = useState(true);
  const [rows, setRows] = useState<ExpiringLot[]>([]);
  const [products, setProducts] = useState<Map<number, Pick<Product, 'name' | 'sku'>>>(new Map());
  const [codes, setCodes] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProducts()
      .then((list) => setProducts(new Map(list.map((row) => [Number(row.id), { name: row.name, sku: row.sku }]))))
      .catch(() => setProducts(new Map()));
    getLocationsFlat()
      .then((locs) => setCodes(new Map(locs.map((loc) => [loc.id, loc.code]))))
      .catch(() => setCodes(new Map()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getExpiringLots(withinDays, includeExpired)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(errorText(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [withinDays, includeExpired]);

  function exportCsv() {
    const blob = new Blob([expiringCsv(rows, products, codes)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `expiring-stock-${withinDays}d.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Expiring stock</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select aria-label="Within days" value={withinDays} onChange={(e) => { setLoading(true); setWithinDays(Number(e.target.value)); }} style={field}>
            {WINDOWS.map((days) => (
              <option key={days} value={days}>{`Within ${days} days`}</option>
            ))}
          </select>
          <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              type="checkbox"
              aria-label="Include expired"
              checked={includeExpired}
              onChange={(e) => { setLoading(true); setIncludeExpired(e.target.checked); }}
            />
            Include expired
          </label>
          <button type="button" style={field} disabled={rows.length === 0} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-redwood-border)', borderRadius: 12 }}>
        <table aria-label="Expiring stock" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              {['Product', 'SKU', 'Lot', 'Expiry', 'Days left', 'Location', 'Qty', ''].map((label) => (
                <th key={label} style={th}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={td}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={td}>{error ? '—' : `Nothing expires within ${withinDays} days.`}</td></tr>
            )}
            {!loading && rows.map((row) => {
              const product = products.get(row.product_id);
              return (
                <tr key={`${row.lot_id}-${row.location_id ?? 'none'}`} data-testid={`expiring-row-${row.lot_id}-${row.location_id ?? 'none'}`} style={{ borderTop: '1px solid var(--color-redwood-border)' }}>
                  <td style={td}><Link to={`/products/${row.product_id}`} style={{ textDecoration: 'underline' }}>{product?.name ?? `Product ${row.product_id}`}</Link></td>
                  <td style={td}>{product?.sku ?? '—'}</td>
                  <td style={{ ...td, fontFamily: 'monospace' }}>{row.lot_number}</td>
                  <td style={td}>{row.expiry_date ? formatLocalDate(row.expiry_date) || row.expiry_date : '—'}</td>
                  <td style={td}>{row.days_left}</td>
                  <td style={td}>{row.location_id == null ? '—' : (codes.get(row.location_id) ?? row.location_id)}</td>
                  <td style={td}>{row.qty}</td>
                  <td style={td}>
                    {row.expired && <span style={{ border: '1px solid #ef4444', color: '#ef4444', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>expired</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const field: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};
const th: CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' };
const td: CSSProperties = { padding: '8px 10px' };
