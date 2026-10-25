/**
 * Inventory valuation: ledger on-hand × current cost per product, against the GL.
 * Every figure comes from GET /inventory/valuation; this page only formats it.
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { formatCurrency } from '../../services/settingsService';
import { productCategoryService, type ProductCategory } from '../../services/productService';
import {
  downloadValuationCsv,
  getValuation,
  type ValuationParams,
  type ValuationReport,
} from '../../services/inventoryValuationService';
import { formatLocalDate } from '../../utils/dates';

function qty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function InventoryValuation() {
  const [asOf, setAsOf] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [report, setReport] = useState<ValuationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const params: ValuationParams = {
    as_of: asOf || undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    search: search || undefined,
  };

  useEffect(() => {
    productCategoryService.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getValuation({
      as_of: asOf || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
      search: search || undefined,
    })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setReport(null);
        setError(err instanceof Error ? err.message : 'Could not load the valuation.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asOf, categoryId, search]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(draftSearch.trim());
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadValuationCsv(params);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the valuation.');
    } finally {
      setExporting(false);
    }
  }

  const rows = report?.rows ?? [];

  return (
    <div style={{ paddingBottom: '80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
            Inventory valuation
          </h1>
          <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-subtle)', marginTop: '4px' }}>
            As-of shows past quantities at today&apos;s cost.
          </div>
        </div>
        <form onSubmit={applySearch} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" aria-label="As of" value={asOf} onChange={(event) => setAsOf(event.target.value)} style={input} />
          <select aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} style={input}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>{category.name}</option>
            ))}
          </select>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search name or SKU"
            aria-label="Search name or SKU"
            style={input}
          />
          <button type="submit" style={chip}>Search</button>
          <button type="button" style={chip} disabled={exporting} onClick={() => void exportCsv()}>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </form>
      </div>

      {error && <div role="alert" style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-brand-red)' }}>{error}</div>}

      {report && (
        <div data-testid="valuation-gl-strip" style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--color-redwood-text-main)' }}>
          {report.difference !== null
            ? `GL inventory ${formatCurrency(report.gl_inventory)} · Difference ${formatCurrency(report.difference)}`
            : 'Difference shown for the whole company only'}
        </div>
      )}

      <div style={{ overflowX: 'auto', border: '1px solid var(--color-redwood-border)', borderRadius: '12px' }}>
        <table aria-label="Inventory valuation" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-redwood-text-muted)' }}>
              {['SKU', 'Product', 'On hand', 'Cost', 'Value', 'Last receipt cost', 'Last movement', 'Method'].map((label) => (
                <th key={label} style={th}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ ...td, color: 'var(--color-redwood-text-muted)' }}>—</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, color: 'var(--color-redwood-text-muted)' }}>{error ? '—' : 'No products match these filters.'}</td></tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.product_id} style={{ borderTop: '1px solid var(--color-redwood-border)' }} data-testid={`valuation-row-${row.product_id}`}>
                <td style={td}>{row.sku ?? '—'}</td>
                <td style={{ ...td, color: 'var(--color-redwood-text-main)' }}>{row.name ?? '—'}</td>
                <td style={td}>{qty(row.on_hand)}</td>
                <td style={td}>{formatCurrency(row.cost)}</td>
                <td style={td}>{formatCurrency(row.value)}</td>
                <td style={td}>{row.last_receipt_cost == null ? '—' : formatCurrency(row.last_receipt_cost)}</td>
                <td style={td}>{row.last_movement_date ? (formatLocalDate(row.last_movement_date) || '—') : '—'}</td>
                <td style={td}>{row.cost_method}</td>
              </tr>
            ))}
          </tbody>
          {!loading && report && rows.length > 0 && (
            <tfoot>
              <tr data-testid="valuation-totals" style={{ borderTop: '2px solid var(--color-redwood-border)', fontWeight: 600 }}>
                <td style={td} colSpan={2}>{report.totals.products} products</td>
                <td style={td}>{qty(report.totals.units)}</td>
                <td style={td} />
                <td style={td}>{formatCurrency(report.totals.value)}</td>
                <td style={td} colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

const input: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '12px',
  color: 'var(--color-redwood-text-main)',
};
const chip: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '8px',
  padding: '7px 10px',
  fontSize: '11px',
  color: 'var(--color-redwood-text-main)',
  cursor: 'pointer',
};
const th: CSSProperties = { padding: '8px 10px', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: CSSProperties = { padding: '8px 10px' };
