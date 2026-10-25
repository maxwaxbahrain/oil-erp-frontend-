/**
 * Phone-first count screen. Expected quantities and variances are shown only when the
 * API returns them (blind counts hide them from counters). No stock math here.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarcodeScanField } from '../../components/Inventory/PackQtyInput';
import { useAuth } from '../../contexts/AuthContext';
import {
  addFoundLine,
  completeCount,
  getCount,
  recordLine,
  recountLine,
  skipLine,
  startCount,
  type CycleCountDetail,
  type CycleCountLine,
} from '../../services/cycleCountService';
import { getProducts, lookupProductByBarcode, type Product } from '../../services/productService';
import { formatCurrency } from '../../services/settingsService';
import { getLocationsFlat, type StockLocationNode } from '../../services/stockLocationService';
import { countStatusColor, scopeLabel } from './countLabels';
import CountVariances from './CountVariances';

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function lineColor(status: string): string {
  if (status === 'counted') return '#22c55e';
  if (status === 'recount') return '#f59e0b';
  if (status === 'skipped') return '#94a3b8';
  return '#4F8EF7';
}

function groupByLocation(lines: CycleCountLine[]): { key: string; label: string; lines: CycleCountLine[] }[] {
  const groups: { key: string; label: string; lines: CycleCountLine[] }[] = [];
  for (const line of lines) {
    const label = line.location_path || line.location_code || `Location ${line.location_id}`;
    const last = groups[groups.length - 1];
    if (last && last.key === String(line.location_id)) last.lines.push(line);
    else groups.push({ key: String(line.location_id), label, lines: [line] });
  }
  return groups;
}

export default function CountSheetPage() {
  const { id } = useParams<{ id: string }>();
  const countId = Number(id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canCount = hasRole('admin', 'manager', 'warehouse');
  const canManage = hasRole('admin', 'manager');
  const [count, setCount] = useState<CycleCountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [qtyByLine, setQtyByLine] = useState<Record<number, string>>({});
  const [skipFor, setSkipFor] = useState<number | null>(null);
  const [skipNote, setSkipNote] = useState('');
  const [lineError, setLineError] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [foundOpen, setFoundOpen] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(countId)) return;
    let cancelled = false;
    getCount(countId)
      .then((row) => {
        if (!cancelled) setCount(row);
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [countId]);

  useEffect(() => {
    if (highlightId == null) return;
    const input = document.getElementById(`count-qty-${highlightId}`);
    input?.focus();
    input?.scrollIntoView?.({ block: 'center' });
  }, [highlightId, count]);

  const lines = useMemo(
    () => [...(count?.lines ?? [])].sort((a, b) => a.sequence - b.sequence || a.id - b.id),
    [count],
  );
  const groups = useMemo(() => groupByLocation(lines), [lines]);
  const open = lines.filter((line) => line.status === 'pending' || line.status === 'recount').length;
  const editable = canCount && (count?.status === 'counting' || (count?.status === 'review' && canManage));

  async function run(action: () => Promise<CycleCountDetail>, lineId?: number): Promise<boolean> {
    setBusy(true);
    setError(null);
    if (lineId != null) setLineError((prev) => ({ ...prev, [lineId]: '' }));
    try {
      setCount(await action());
      return true;
    } catch (err) {
      if (lineId != null) setLineError((prev) => ({ ...prev, [lineId]: errorText(err) }));
      else setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCount(line: CycleCountLine) {
    const raw = (qtyByLine[line.id] ?? '').trim();
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value)) {
      setLineError((prev) => ({ ...prev, [line.id]: 'Enter the counted quantity' }));
      return;
    }
    if (await run(() => recordLine(countId, line.id, value), line.id)) {
      setQtyByLine((prev) => ({ ...prev, [line.id]: '' }));
    }
  }

  async function onSkip(line: CycleCountLine) {
    if (await run(() => skipLine(countId, line.id, skipNote), line.id)) {
      setSkipFor(null);
      setSkipNote('');
    }
  }

  async function onComplete() {
    setBusy(true);
    setError(null);
    try {
      await completeCount(countId);
      navigate('/warehouse/counts?status=review');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onScan(code: string) {
    setScanError(null);
    let productId: number;
    try {
      const found = await lookupProductByBarcode(code);
      productId = Number(found.product.id);
    } catch {
      setScanError('not on this count');
      return;
    }
    const matches = lines.filter((line) => line.product_id === productId);
    if (matches.length === 0) {
      setScanError('not on this count');
      return;
    }
    const current = lines.find((line) => line.id === highlightId)
      ?? lines.find((line) => line.status === 'pending' || line.status === 'recount');
    const here = current ? matches.filter((line) => line.location_id === current.location_id) : [];
    const target = here[0] ?? (matches.length === 1 ? matches[0] : null);
    if (!target) {
      setScanError('in more than one location — tap the line');
      return;
    }
    setHighlightId(target.id);
  }

  if (!count && !error) return <div style={shell}>Loading count…</div>;
  if (!count) return <div style={shell}><p role="alert">{error}</p></div>;

  return (
    <div style={shell}>
      <header style={{ display: 'grid', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}>{count.count_number}</h1>
          <span data-testid="count-status" style={pill(countStatusColor(count.status))}>{count.status}</span>
        </div>
        <div style={{ fontSize: 13 }}>
          {scopeLabel(count)}
          {count.blind && <span style={{ ...pill('#64748b'), marginLeft: 6 }}>blind</span>}
        </div>
        <div data-testid="count-progress" style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>
          {`${count.lines_counted}/${count.lines_total} counted`}
        </div>
      </header>

      {error && <p role="alert" data-testid="count-error" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

      {count.status === 'draft' && canCount && (
        <button type="button" style={primary} disabled={busy} onClick={() => void run(() => startCount(countId))}>Start</button>
      )}

      {count.status === 'counting' && canCount && (
        <div style={{ display: 'grid', gap: 6 }}>
          <BarcodeScanField onScan={onScan} />
          {scanError && <p role="alert" data-testid="scan-error" style={{ color: '#ef4444', fontSize: 12 }}>{scanError}</p>}
          <button type="button" style={btn} onClick={() => setFoundOpen(true)}>Found item</button>
        </div>
      )}

      {(count.status === 'review' || count.status === 'approved') && (
        <CountVariances count={count} canManage={canManage} onChanged={setCount} />
      )}

      {groups.map((group) => (
        <section key={group.key} data-testid={`count-group-${group.key}`} style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{group.label}</h2>
          {group.lines.map((line) => {
            const showExpected = typeof line.expected_qty === 'number';
            const showVariance = typeof line.variance_qty === 'number';
            const canEnter = editable && line.status !== 'counted' && line.status !== 'skipped';
            return (
              <article
                key={line.id}
                data-testid={`count-line-${line.id}`}
                style={{ ...card, outline: highlightId === line.id ? '2px solid #4F8EF7' : 'none' }}
                onClick={() => setHighlightId(line.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{line.name ?? `Product ${line.product_id}`}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>{line.sku ?? '—'}</div>
                  </div>
                  <span data-testid={`line-status-${line.id}`} style={pill(lineColor(line.status))}>{line.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
                  {showExpected && <span data-testid={`line-expected-${line.id}`}>Expected {qty(line.expected_qty as number)}</span>}
                  {line.counted_qty != null && <span>Counted {qty(line.counted_qty)}</span>}
                  {showVariance && (
                    <span data-testid={`line-variance-${line.id}`} style={{ color: (line.variance_qty as number) === 0 ? undefined : '#f59e0b' }}>
                      Variance {(line.variance_qty as number) > 0 ? '+' : ''}{qty(line.variance_qty as number)}
                      {typeof line.variance_value === 'number' ? ` · ${formatCurrency(line.variance_value)}` : ''}
                    </span>
                  )}
                </div>
                {line.note && <div style={{ fontSize: 12 }}>{line.note}</div>}
                {canEnter && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      id={`count-qty-${line.id}`}
                      aria-label={`Counted ${line.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={qtyByLine[line.id] ?? ''}
                      onChange={(event) => setQtyByLine((prev) => ({ ...prev, [line.id]: event.target.value }))}
                      style={{ ...btn, flex: 1, fontSize: 16 }}
                    />
                    <button type="button" style={primary} disabled={busy} onClick={() => void onCount(line)}>Count</button>
                    <button type="button" style={btn} disabled={busy} onClick={() => { setSkipFor(line.id); setSkipNote(''); }}>Skip</button>
                  </div>
                )}
                {canEnter && skipFor === line.id && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      aria-label={`Skip note ${line.id}`}
                      value={skipNote}
                      onChange={(event) => setSkipNote(event.target.value)}
                      placeholder="Note (optional)"
                      style={{ ...btn, flex: 1 }}
                    />
                    <button type="button" style={btn} disabled={busy} onClick={() => void onSkip(line)}>Save skip</button>
                  </div>
                )}
                {canManage && line.status === 'counted' && (count.status === 'counting' || count.status === 'review') && (
                  <button type="button" style={btn} disabled={busy} onClick={() => void run(() => recountLine(countId, line.id), line.id)}>
                    Recount
                  </button>
                )}
                {lineError[line.id] ? <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{lineError[line.id]}</p> : null}
              </article>
            );
          })}
        </section>
      ))}

      {count.status === 'counting' && canCount && (
        <footer style={{ display: 'grid', gap: 4 }}>
          <button type="button" style={primary} disabled={open > 0 || busy} onClick={() => void onComplete()}>Complete</button>
          {open > 0 && <span style={{ fontSize: 12 }}>{`${open} line(s) still need a count or a skip`}</span>}
        </footer>
      )}

      {foundOpen && (
        <FoundItemDialog
          busy={busy}
          onClose={() => setFoundOpen(false)}
          onSubmit={async (productId, locationId) => {
            if (await run(() => addFoundLine(countId, productId, locationId))) setFoundOpen(false);
          }}
        />
      )}
    </div>
  );
}

function FoundItemDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (productId: number, locationId: number) => Promise<void>;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<StockLocationNode[]>([]);
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setProducts([]));
    getLocationsFlat().then(setLocations).catch(() => setLocations([]));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products.filter((row) => row.sku?.toLowerCase().includes(q) || row.name?.toLowerCase().includes(q)).slice(0, 10);
  }, [products, query]);

  async function submit() {
    setError(null);
    const wanted = code.trim().toLowerCase();
    const location = locations.find((row) => row.code.toLowerCase() === wanted || (row.barcode ?? '').toLowerCase() === wanted);
    if (!location) {
      setError(`No location has code "${code.trim()}"`);
      return;
    }
    if (productId == null) return;
    await onSubmit(productId, location.id);
  }

  return (
    <div role="dialog" aria-label="Found item" style={{ ...card, position: 'fixed', inset: 24, overflow: 'auto', zIndex: 20, background: 'var(--color-redwood-bg-surface)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>Found item</h2>
      <input aria-label="Search product" placeholder="Search SKU or name" value={query} onChange={(event) => setQuery(event.target.value)} style={btn} />
      <div style={{ display: 'grid', gap: 4 }}>
        {matches.map((row) => (
          <label key={row.id} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
            <input
              type="radio"
              name="found-product"
              aria-label={`Pick ${row.sku}`}
              checked={productId === Number(row.id)}
              onChange={() => setProductId(Number(row.id))}
            />
            {row.sku} · {row.name}
          </label>
        ))}
      </div>
      <input aria-label="Location code" placeholder="Location code" value={code} onChange={(event) => setCode(event.target.value)} style={btn} />
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" style={primary} disabled={busy || productId == null || !code.trim()} onClick={() => void submit()}>Add line</button>
        <button type="button" style={btn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const shell: CSSProperties = { maxWidth: 480, margin: '0 auto', padding: 12, display: 'grid', gap: 12 };
const card: CSSProperties = {
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: 12,
  display: 'grid',
  gap: 8,
};
const btn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 7,
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
};
const primary: CSSProperties = { ...btn, background: '#4F8EF7', color: '#fff', border: 'none' };

function pill(color: string): CSSProperties {
  return { border: `1px solid ${color}`, color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 };
}
