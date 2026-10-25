import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BarcodeScanField } from '../../components/Inventory/PackQtyInput';
import { useAuth } from '../../contexts/AuthContext';
import { lookupProductByBarcode } from '../../services/productService';
import {
  completePickList,
  dispatchPickList,
  getManifest,
  getPickList,
  hydrateShortageLabels,
  listShortages,
  recordPick,
  releasePickList,
  type PickLine,
  type PickListDetail,
  type PickManifest,
  type PickShortage,
  type ShortageRow,
} from '../../services/pickingService';
import { getLocationsFlat, type StockLocationNode } from '../../services/stockLocationService';
import { vanService, type Van } from '../../services/vanService';
import api from '../../api/axios';
import DispatchDialog from './DispatchDialog';
import ManifestPrint from './ManifestPrint';
import ShortageResolve from './ShortageResolve';

const shell: CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  padding: 12,
  display: 'grid',
  gap: 12,
};

interface AssignableUser {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
}

/** "14 Nov" — formatting only. */
function shortDate(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

function cardStyle(status: string, highlighted: boolean): CSSProperties {
  const tone = status === 'picked'
    ? { background: 'rgba(34,197,94,.15)', borderColor: '#22c55e' }
    : status === 'short'
      ? { background: 'rgba(245,158,11,.18)', borderColor: '#f59e0b' }
      : status === 'skipped'
        ? { background: 'rgba(148,163,184,.2)', borderColor: '#94a3b8' }
        : { background: 'var(--color-redwood-bg-surface)', borderColor: 'var(--color-redwood-border)' };
  return {
    ...tone,
    border: `1px solid ${tone.borderColor}`,
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 8,
    outline: highlighted ? '2px solid #4F8EF7' : 'none',
  };
}

export default function PickListPage() {
  const { id } = useParams<{ id: string }>();
  const listId = Number(id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canDispatch = hasRole('admin', 'manager', 'warehouse');
  const [list, setList] = useState<PickListDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [qtyByLine, setQtyByLine] = useState<Record<number, string>>({});
  // Lot-tracked lines: picked qty per preview lot, prefilled from the FEFO preview.
  const [lotQtyByLine, setLotQtyByLine] = useState<Record<number, Record<number, string>>>({});
  const [shortFor, setShortFor] = useState<number | null>(null);
  const [shortNote, setShortNote] = useState('');
  const [skipNote, setSkipNote] = useState<Record<number, string>>({});
  const [skipFor, setSkipFor] = useState<number | null>(null);
  const [altFor, setAltFor] = useState<number | null>(null);
  const [editing, setEditing] = useState<Record<number, boolean>>({});
  const [lineError, setLineError] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [bins, setBins] = useState<StockLocationNode[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [vans, setVans] = useState<Van[]>([]);
  const [shortages, setShortages] = useState<PickShortage[] | null>(null);
  const [shortageRows, setShortageRows] = useState<ShortageRow[]>([]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [manifest, setManifest] = useState<PickManifest | null>(null);

  useEffect(() => {
    if (!Number.isFinite(listId)) return;
    let cancelled = false;
    getPickList(listId)
      .then((row) => {
        if (!cancelled) setList(row);
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err));
      });
    getLocationsFlat()
      .then((rows) => {
        if (!cancelled) {
          setBins(rows.filter((row) => row.isActive && (row.kind === 'bin' || row.kind === 'warehouse')));
        }
      })
      .catch(() => {
        if (!cancelled) setBins([]);
      });
    api.get<AssignableUser[]>('/api/auth/users')
      .then(({ data }) => {
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    vanService.getAll()
      .then((rows) => {
        if (!cancelled) setVans(rows);
      })
      .catch(() => {
        if (!cancelled) setVans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  useEffect(() => {
    if (highlightId == null) return;
    document.getElementById(`pick-qty-${highlightId}`)?.focus();
  }, [highlightId, list]);

  const lines = useMemo(
    () => [...(list?.lines ?? [])].sort((a, b) => a.sequence - b.sequence || a.id - b.id),
    [list],
  );
  const done = lines.filter((line) => line.status !== 'open').length;
  const ready = lines.length > 0 && done === lines.length;
  const assignee = users.find((user) => user.id === list?.assignedTo);
  const driver = users.find((user) => user.id === list?.driverId);
  const van = vans.find((item) => item.id === list?.vanId);
  const invoiceNumbers = [...new Set(lines.map((line) => line.invoiceNumber).filter(Boolean))].join(', ');

  async function refresh() {
    setList(await getPickList(listId));
  }

  async function onScan(code: string) {
    setScanError(null);
    try {
      const found = await lookupProductByBarcode(code);
      const productId = Number(found.product.id);
      const line = lines.find((item) => item.productId === productId && item.status === 'open');
      if (!line) {
        setScanError('not on this list');
        return;
      }
      setHighlightId(line.id);
      setEditing((prev) => ({ ...prev, [line.id]: true }));
    } catch {
      setScanError('not on this list');
    }
  }

  function lotPlan(line: PickLine) {
    return line.lots.map((lot, index) => {
      const raw = lotQtyByLine[line.id]?.[index];
      const parsed = raw == null || raw === '' ? lot.qty : Number(raw);
      return { ...lot, qty: Number.isFinite(parsed) ? parsed : 0 };
    });
  }

  async function submit(line: PickLine, qty: number, extra?: { note?: string; pickedLocationId?: number }) {
    let lotsPicked: { lotId: number; qty: number }[] | undefined;
    if (line.lots.length > 0 && qty > 0) {
      const plan = lotPlan(line);
      const total = plan.reduce((sum, lot) => sum + lot.qty, 0);
      if (Math.abs(total - qty) > 1e-9) {
        setLineError((prev) => ({ ...prev, [line.id]: `Lot quantities must add up to ${qty}` }));
        return;
      }
      lotsPicked = plan
        .filter((lot) => lot.lotId != null && lot.qty > 0)
        .map((lot) => ({ lotId: lot.lotId as number, qty: lot.qty }));
    }
    setBusy(true);
    setLineError((prev) => ({ ...prev, [line.id]: '' }));
    try {
      await recordPick(listId, line.id, {
        qty,
        note: extra?.note,
        pickedLocationId: extra?.pickedLocationId,
        lotsPicked,
      });
      await refresh();
      setEditing((prev) => ({ ...prev, [line.id]: false }));
      setShortFor(null);
      setSkipFor(null);
      setAltFor(null);
    } catch (err) {
      setLineError((prev) => ({ ...prev, [line.id]: errorText(err) }));
    } finally {
      setBusy(false);
    }
  }

  function qtyOf(line: PickLine): number {
    const raw = qtyByLine[line.id];
    if (raw == null || raw === '') return line.qtyRequired;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : line.qtyRequired;
  }

  async function onRelease() {
    setError(null);
    try {
      const updated = await releasePickList(listId);
      setList(updated.lines.length ? updated : await getPickList(listId));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function onDispatch(input: { vanId: string; driverId: number; note?: string }) {
    setDispatchError(null);
    setDispatching(true);
    try {
      const updated = await dispatchPickList(listId, input);
      setList(updated.lines.length ? updated : await getPickList(listId));
      setDispatchOpen(false);
    } catch (err) {
      setDispatchError(errorText(err));
    } finally {
      setDispatching(false);
    }
  }

  async function openManifest() {
    setError(null);
    try {
      setManifest(await getManifest(listId));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function onComplete() {
    setError(null);
    try {
      const updated = await completePickList(listId);
      setList(updated.lines.length ? updated : await getPickList(listId));
      setShortages(updated.shortages);
      try {
        setShortageRows(await hydrateShortageLabels(await listShortages(listId)));
      } catch {
        setShortageRows([]);
      }
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (!list && !error) return <div style={shell}>Loading pick list…</div>;
  if (!list) return <div style={shell}><p role="alert">{error}</p></div>;

  return (
    <div style={shell}>
      <header style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{list.number}</h1>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{list.status}</span>
        </div>
        <p style={{ fontSize: 13 }}>
          {list.sourceKind === 'route' && list.routeDate ? list.routeDate : (invoiceNumbers || 'Invoices')}
        </p>
        <p style={{ fontSize: 13 }}>
          {assignee ? (assignee.full_name || assignee.username) : (list.assignedTo == null ? 'Unassigned' : `User ${list.assignedTo}`)}
        </p>
        <div aria-label="Pick progress" style={{ height: 8, background: 'var(--color-redwood-border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${lines.length ? (done / lines.length) * 100 : 0}%`, height: '100%', background: '#22c55e' }} />
        </div>
        <p style={{ fontSize: 12 }}>{`${done} / ${lines.length}`}</p>
      </header>

      <BarcodeScanField onScan={onScan} />
      {scanError && <p role="alert" data-testid="scan-error" style={{ color: '#ef4444', fontSize: 13 }}>{scanError}</p>}
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

      {lines.map((line) => {
        const showInputs = line.status === 'open' || editing[line.id];
        return (
          <article key={line.id} data-testid={`pick-line-${line.id}`} style={cardStyle(line.status, highlightId === line.id)}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{line.locationPath || line.locationCode || '—'}</div>
            <div style={{ fontSize: 14 }}>{line.productName} · {line.sku}</div>
            {line.lots.length > 0 && (
              <div data-testid={`pick-lots-${line.id}`} style={{ fontSize: 13, fontWeight: 600 }}>
                {`Take: ${line.lots.map((lot) => `${lot.lotNumber} ×${lot.qty}${lot.expiryDate ? ` (exp ${shortDate(lot.expiryDate)})` : ''}`).join(', ')}`}
              </div>
            )}
            <div style={{ fontSize: 13 }}>Need {line.qtyRequired}</div>
            {!showInputs ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Picked {line.qtyPicked}</span>
                <button type="button" onClick={() => setEditing((prev) => ({ ...prev, [line.id]: true }))}>Change</button>
              </div>
            ) : (
              <>
                {line.lots.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
                    {line.lots.map((lot, index) => (
                      <label key={`${lot.lotNumber}-${index}`} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        {lot.lotNumber}
                        <input
                          aria-label={`Lot ${lot.lotNumber} qty for line ${line.id}`}
                          type="number"
                          min={0}
                          style={{ width: 64 }}
                          value={lotQtyByLine[line.id]?.[index] ?? String(lot.qty)}
                          onChange={(event) => setLotQtyByLine((prev) => ({
                            ...prev,
                            [line.id]: { ...(prev[line.id] ?? {}), [index]: event.target.value },
                          }))}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <input
                  id={`pick-qty-${line.id}`}
                  aria-label={`Qty for line ${line.id}`}
                  type="number"
                  value={qtyByLine[line.id] ?? String(line.qtyRequired)}
                  onChange={(event) => setQtyByLine((prev) => ({ ...prev, [line.id]: event.target.value }))}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" disabled={busy} onClick={() => void submit(line, line.qtyRequired)}>Pick all</button>
                  <button type="button" disabled={busy} onClick={() => { setShortFor(line.id); setShortNote(''); }}>Short…</button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const note = (skipNote[line.id] ?? '').trim();
                      if (!note) {
                        setSkipFor(line.id);
                        setLineError((prev) => ({ ...prev, [line.id]: 'A note is required to skip' }));
                        return;
                      }
                      void submit(line, 0, { note });
                    }}
                  >
                    Skip
                  </button>
                  <button type="button" disabled={busy} onClick={() => setAltFor(line.id)}>Picked from another bin</button>
                </div>
                {shortFor === line.id && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input
                      aria-label={`Short note ${line.id}`}
                      value={shortNote}
                      onChange={(event) => setShortNote(event.target.value)}
                      placeholder="Note"
                    />
                    <button type="button" disabled={busy} onClick={() => void submit(line, qtyOf(line), { note: shortNote })}>
                      Save short
                    </button>
                  </div>
                )}
                {skipFor === line.id && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <input
                      aria-label={`Skip note ${line.id}`}
                      value={skipNote[line.id] ?? ''}
                      onChange={(event) => setSkipNote((prev) => ({ ...prev, [line.id]: event.target.value }))}
                      placeholder="Note required"
                    />
                  </div>
                )}
                {altFor === line.id && (
                  <select
                    aria-label={`Picked from location ${line.id}`}
                    defaultValue=""
                    onChange={(event) => {
                      const locationId = Number(event.target.value);
                      if (!locationId) return;
                      void submit(line, qtyOf(line), { pickedLocationId: locationId });
                    }}
                  >
                    <option value="">Select bin</option>
                    {bins.map((bin) => (
                      <option key={bin.id} value={bin.id}>{bin.path || bin.code}</option>
                    ))}
                  </select>
                )}
              </>
            )}
            {lineError[line.id] ? <p role="alert" style={{ color: '#ef4444', fontSize: 12 }}>{lineError[line.id]}</p> : null}
          </article>
        );
      })}

      <footer style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {list.status === 'draft' && (
          <button type="button" onClick={() => void onRelease()}>Release</button>
        )}
        {list.status === 'picked' && canDispatch && (
          <button type="button" onClick={() => { setDispatchOpen(true); setDispatchError(null); }}>Dispatch…</button>
        )}
        {list.status === 'dispatched' && (
          <div data-testid="dispatch-summary" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{list.manifestNumber || '—'}</span>
            <span>{van?.van_number || list.vanId || '—'}</span>
            <span>{driver ? (driver.full_name || driver.username) : (list.driverId == null ? '—' : `User ${list.driverId}`)}</span>
            <button type="button" onClick={() => void openManifest()}>Manifest</button>
          </div>
        )}
        {list.status === 'delivered' && (
          <span data-testid="delivered-footer">{`Delivered ${list.deliveredAt ? list.deliveredAt.slice(0, 10) : ''}`.trim()}</span>
        )}
        {list.hasFailedDelivery && (
          <span data-testid="failed-stop" style={{ color: '#ef4444' }}>A stop failed — see deliveries</span>
        )}
        {list.status !== 'dispatched' && list.status !== 'delivered' && (
          <button type="button" disabled={!ready || busy} onClick={() => void onComplete()}>Complete</button>
        )}
      </footer>

      {dispatchOpen && (
        <DispatchDialog
          users={users}
          saving={dispatching}
          error={dispatchError}
          onClose={() => setDispatchOpen(false)}
          onSubmit={(input) => void onDispatch(input)}
        />
      )}

      {manifest && <ManifestPrint manifest={manifest} onClose={() => setManifest(null)} />}

      {shortages && (
        <div role="dialog" aria-label="Shortages" style={{ border: '1px solid var(--color-redwood-border)', borderRadius: 12, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Shortages</h2>
          {shortages.length === 0 ? <p>No shortages</p> : shortages.map((row) => (
            <p key={`${row.invoiceId}-${row.productId}`}>
              {`Invoice ${row.invoiceId} product ${row.productId}: required ${row.required}, picked ${row.picked}`}
            </p>
          ))}
          {shortageRows.length > 0 && (
            <ShortageResolve
              rows={shortageRows}
              canResolve={canDispatch}
              onChanged={async () => {
                setShortageRows(await hydrateShortageLabels(await listShortages(listId)));
              }}
            />
          )}
          <button type="button" onClick={() => navigate('/warehouse/picking')}>Later</button>
        </div>
      )}
    </div>
  );
}
