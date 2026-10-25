import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { getInvoiceById } from '../../services/api';
import {
  resolveShortage,
  type ShortageRow,
} from '../../services/pickingService';

const btn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 7,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: "'DM Sans',sans-serif",
};

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

function productLabel(row: ShortageRow): string {
  return row.productName || row.sku || `Product ${row.productId}`;
}

function resolutionChip(row: ShortageRow): string {
  if (row.resolution === 'backorder') return `Backorder ${row.backorderQtyOpen ?? 0}`;
  if (row.resolution === 'credited') return `Credited ${row.salesReturnId ?? ''}`.trim();
  if (row.resolution === 'ignored') return `Ignored ${row.note ?? ''}`.trim();
  return 'Open';
}

export default function ShortageResolve({
  rows,
  canResolve,
  onChanged,
}: {
  rows: ShortageRow[];
  canResolve: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [credit, setCredit] = useState<ShortageRow | null>(null);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [returnId, setReturnId] = useState<number | null>(null);
  const [ignore, setIgnore] = useState<ShortageRow | null>(null);
  const [ignoreNote, setIgnoreNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!credit) return;
    let cancelled = false;
    setPriceLoading(true);
    setUnitPrice(null);
    getInvoiceById(String(credit.invoiceId))
      .then((invoice) => {
        if (cancelled) return;
        const line = invoice?.lineItems.find((item) => String(item.productId || '') === String(credit.productId));
        setUnitPrice(line && Number.isFinite(line.rate) ? line.rate : null);
      })
      .catch(() => {
        if (!cancelled) setUnitPrice(null);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [credit]);

  async function onBackorder(row: ShortageRow) {
    if (!window.confirm('Backorder the short quantity?')) return;
    setError(null);
    setBusy(true);
    try {
      await resolveShortage(row.id, { mode: 'backorder' });
      await onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmCredit() {
    if (!credit || returnId != null) return;
    setError(null);
    setBusy(true);
    try {
      const saved = await resolveShortage(credit.id, { mode: 'credited' });
      setReturnId(saved.salesReturnId);
      await onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmIgnore() {
    if (!ignore) return;
    const note = ignoreNote.trim();
    if (!note) {
      setNoteError('A note is required');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resolveShortage(ignore.id, { mode: 'ignored', note });
      setIgnore(null);
      setIgnoreNote('');
      await onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function openCredit(row: ShortageRow) {
    setError(null);
    setReturnId(null);
    setCredit(row);
  }

  const preview = unitPrice == null
    ? 'Preview'
    : `Preview ≈ ${credit?.qtyShort ?? 0} × ${unitPrice}`;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      {rows.length === 0 && <p style={{ fontSize: 13 }}>No shortages.</p>}
      {rows.map((row) => (
        <div key={row.id} data-testid={`shortage-row-${row.id}`} style={{ display: 'grid', gap: 4, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {row.pickListId != null ? (
              <Link to={`/warehouse/picking/${row.pickListId}`}>{row.pickListNumber || `List ${row.pickListId}`}</Link>
            ) : (
              <span>{row.pickListNumber || '—'}</span>
            )}
            <span>{row.invoiceNumber || `Invoice ${row.invoiceId}`}</span>
            <span>{row.customerName || '—'}</span>
            <span>{productLabel(row)}</span>
            <span>{`Qty short ${row.qtyShort}`}</span>
            {row.resolution === 'open' && canResolve ? (
              <>
                <button type="button" style={btn} disabled={busy} onClick={() => void onBackorder(row)}>Backorder</button>
                <button type="button" style={btn} disabled={busy} onClick={() => openCredit(row)}>Credit customer</button>
                <button
                  type="button"
                  style={btn}
                  disabled={busy}
                  onClick={() => {
                    setIgnore(row);
                    setIgnoreNote('');
                    setNoteError(null);
                    setError(null);
                  }}
                >
                  Ignore
                </button>
              </>
            ) : (
              <span data-testid={`shortage-resolution-${row.id}`}>{resolutionChip(row)}</span>
            )}
          </div>
        </div>
      ))}

      {credit && (
        <div role="dialog" aria-label="Credit customer" style={{ border: '1px solid var(--color-redwood-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Credit customer</h2>
          <p>{`Invoice ${credit.invoiceNumber || credit.invoiceId}`}</p>
          <p>{productLabel(credit)}</p>
          <p>{`Qty short ${credit.qtyShort}`}</p>
          <p>{priceLoading ? 'Unit price …' : `Unit price ${unitPrice == null ? '—' : unitPrice}`}</p>
          <p data-testid="credit-preview">{preview}</p>
          {returnId != null && (
            <Link to={`/sales/returns/${returnId}`}>{`Sales return ${returnId}`}</Link>
          )}
          {returnId == null && (
            <button type="button" style={btn} disabled={busy} onClick={() => void onConfirmCredit()}>Confirm credit</button>
          )}
          <button type="button" style={btn} onClick={() => setCredit(null)}>Close</button>
        </div>
      )}

      {ignore && (
        <div role="dialog" aria-label="Ignore shortage" style={{ border: '1px solid var(--color-redwood-border)', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Ignore</h2>
          <textarea
            aria-label="Ignore note"
            value={ignoreNote}
            onChange={(event) => {
              setIgnoreNote(event.target.value);
              setNoteError(null);
            }}
            style={{ ...btn, minHeight: 64 }}
          />
          {noteError && <p role="alert">{noteError}</p>}
          <button type="button" style={btn} disabled={busy} onClick={() => void onConfirmIgnore()}>Confirm ignore</button>
          <button type="button" style={btn} onClick={() => setIgnore(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
