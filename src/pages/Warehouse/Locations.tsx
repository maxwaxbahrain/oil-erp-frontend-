import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import {
  allowedChildKinds,
  createLocation,
  deactivateLocation,
  flattenLocationTree,
  getLocationOnHand,
  getLocationTree,
  isStockHoldingKind,
  lookupLocationByBarcode,
  postTransfer,
  updateLocation,
  type LocationOnHandRow,
  type StockLocationNode,
} from '../../services/stockLocationService';

const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '12px',
  padding: '12px 14px',
};

const btn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '7px',
  padding: '6px 10px',
  fontSize: '10.5px',
  cursor: 'pointer',
  fontFamily: "'DM Sans',sans-serif",
};

function capacityBarColor(pct: number): string {
  if (pct >= 100) return '#ef4444';
  if (pct >= 80) return '#f59e0b';
  return '#22c55e';
}

function CapacityBar(props: { pct: number }) {
  const width = Math.min(100, Math.max(0, props.pct));
  return (
    <div
      data-testid="capacity-bar"
      aria-hidden
      style={{
        flex: '1 1 48px',
        maxWidth: 80,
        height: 4,
        background: 'var(--color-redwood-border)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div style={{ width: `${width}%`, height: '100%', background: capacityBarColor(props.pct) }} />
    </div>
  );
}

function collectDescendantBins(node: StockLocationNode): StockLocationNode[] {
  const out: StockLocationNode[] = [];
  const walk = (n: StockLocationNode) => {
    if (n.kind === 'bin') out.push(n);
    (n.children ?? []).forEach(walk);
  };
  walk(node);
  return out;
}

const PRINT_LABEL_KINDS = new Set(['warehouse', 'zone', 'aisle', 'rack']);

function kindBadge(_kind: string): CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--color-redwood-row-bg)',
    border: '1px solid var(--color-redwood-border)',
  };
}

function TreeNode(props: {
  node: StockLocationNode;
  depth: number;
  selectedId: number | null;
  onSelect: (node: StockLocationNode) => void;
}) {
  const { node, depth, selectedId, onSelect } = props;
  const inactive = !node.isActive;
  const selected = selectedId === node.id;
  return (
    <div>
      <button
        type="button"
        data-testid={`loc-node-${node.code}`}
        onClick={() => onSelect(node)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          padding: '6px 8px',
          paddingLeft: 8 + depth * 14,
          marginBottom: 2,
          borderRadius: 6,
          border: selected ? '1px solid var(--color-redwood-accent)' : '1px solid transparent',
          background: selected ? 'var(--color-redwood-row-bg)' : 'transparent',
          opacity: inactive ? 0.55 : 1,
          cursor: 'pointer',
          color: 'inherit',
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 11,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{node.name}</span>
            <span style={{ fontSize: 9, color: 'var(--color-redwood-text-muted)' }}>{node.code}</span>
            <span style={kindBadge(node.kind)}>{node.kind}</span>
          </span>
          {(node.capacityUnits != null && node.pct != null) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
              <CapacityBar pct={node.pct} />
              <span style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)', whiteSpace: 'nowrap' }}>{node.pct}%</span>
            </span>
          )}
          {(node.onHandUnits ?? 0) > 0 && (
            <span style={{ fontSize: 8, color: 'var(--color-redwood-text-muted)' }}>on hand {node.onHandUnits}</span>
          )}
        </span>
      </button>
      {(node.children ?? []).map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export default function LocationsPage() {
  const [tree, setTree] = useState<StockLocationNode[]>([]);
  const [selected, setSelected] = useState<StockLocationNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onHand, setOnHand] = useState<LocationOnHandRow[]>([]);
  const [onHandLoading, setOnHandLoading] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSort, setEditSort] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addKind, setAddKind] = useState('');
  const [addCode, setAddCode] = useState('');
  const [addName, setAddName] = useState('');
  const [transferOpen, setTransferOpen] = useState<LocationOnHandRow | null>(null);
  const [transferQty, setTransferQty] = useState('');
  const [transferDest, setTransferDest] = useState('');
  const [transferRef, setTransferRef] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [printBins, setPrintBins] = useState<StockLocationNode[]>([]);

  const flat = useMemo(() => flattenLocationTree(tree), [tree]);
  const transferTargets = useMemo(
    () => flat.filter((row) => row.isActive && isStockHoldingKind(row.kind)),
    [flat],
  );
  const onlyMain = tree.length === 1 && tree[0]?.code === 'MAIN' && !(tree[0]?.children?.length);

  const refreshTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nodes = await getLocationTree();
      setTree(nodes);
      setSelected((prev) => {
        if (!prev) return nodes[0] ?? null;
        const flatNodes = flattenLocationTree(nodes);
        return flatNodes.find((n) => n.id === prev.id) ?? nodes[0] ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, []);

  useEffect(() => {
    if (!selected) {
      setOnHand([]);
      return;
    }
    setEditName(selected.name);
    setEditSort(selected.sortOrder != null ? String(selected.sortOrder) : '');
    setEditCapacity(selected.capacityUnits != null ? String(selected.capacityUnits) : '');
    setEditBarcode(selected.barcode ?? '');
    setActionError(null);
    if (!isStockHoldingKind(selected.kind)) {
      setOnHand([]);
      return;
    }
    setOnHandLoading(true);
    getLocationOnHand(selected.id)
      .then(setOnHand)
      .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
      .finally(() => setOnHandLoading(false));
  }, [selected?.id, selected?.kind, selected?.name, selected?.sortOrder, selected?.capacityUnits, selected?.barcode]);

  const childKinds = selected ? allowedChildKinds(selected.kind) : [];

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    try {
      const updated = await updateLocation(selected.id, {
        name: editName.trim(),
        sortOrder: editSort === '' ? null : Number(editSort),
        capacityUnits: editCapacity === '' ? null : Number(editCapacity),
        barcode: editBarcode.trim() || null,
      });
      setSelected(updated);
      await refreshTree();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !addKind) return;
    setSaving(true);
    setActionError(null);
    try {
      await createLocation({
        code: addCode.trim(),
        name: addName.trim(),
        kind: addKind,
        parentId: selected.id,
      });
      setAddCode('');
      setAddName('');
      setAddKind('');
      await refreshTree();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    try {
      await deactivateLocation(selected.id);
      await refreshTree();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleScanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = scanCode.trim();
    if (!code) return;
    setScanError(null);
    try {
      const found = await lookupLocationByBarcode(code);
      const match = flat.find((n) => n.id === found.id) ?? found;
      setSelected(match);
      setScanCode('');
    } catch {
      setScanError('No location with that code');
    }
  };

  const handlePrintLabels = () => {
    if (!selected) return;
    const bins = collectDescendantBins(selected);
    setPrintBins(bins);
    requestAnimationFrame(() => {
      window.print();
    });
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !transferOpen) return;
    const qty = Number(transferQty);
    const dest = Number(transferDest);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(dest)) return;
    setSaving(true);
    setActionError(null);
    try {
      await postTransfer({
        productId: transferOpen.productId,
        fromLocationId: selected.id,
        toLocationId: dest,
        quantity: qty,
        reference: transferRef.trim() || undefined,
        note: transferNote.trim() || undefined,
      });
      setTransferOpen(null);
      setTransferQty('');
      setTransferDest('');
      setTransferRef('');
      setTransferNote('');
      const rows = await getLocationOnHand(selected.id);
      setOnHand(rows);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '16px 18px', maxWidth: 1200, margin: '0 auto', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #location-labels-print, #location-labels-print * { visibility: visible !important; }
          #location-labels-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
      <div
        id="location-labels-print"
        data-testid="location-labels-print"
        style={{ display: 'none' }}
      >
        {printBins.map((bin) => (
          <div
            key={bin.id}
            data-testid={`label-card-${bin.code}`}
            style={{
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
              width: '45%',
              display: 'inline-block',
              verticalAlign: 'top',
              marginRight: '4%',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>{bin.code}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{bin.path || '—'}</div>
            {bin.barcode && <div style={{ fontSize: 11, marginTop: 8, fontFamily: 'monospace' }}>{bin.barcode}</div>}
          </div>
        ))}
      </div>
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>Warehouse locations</h1>
      {error && <p style={{ color: '#b91c1c', fontSize: 11 }}>{error}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 2fr)', gap: 14 }}>
        <div style={panel} data-testid="location-tree-panel">
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', color: 'var(--color-redwood-text-muted)' }}>
            Tree
          </p>
          <form onSubmit={handleScanSubmit} style={{ marginBottom: 10 }}>
            <input
              aria-label="Scan bin"
              value={scanCode}
              onChange={(e) => {
                setScanCode(e.target.value);
                if (scanError) setScanError(null);
              }}
              placeholder="Scan bin code"
              style={{ fontSize: 11, padding: 6, width: '100%' }}
            />
            {scanError && (
              <p data-testid="scan-bin-error" style={{ fontSize: 10, color: '#b91c1c', margin: '4px 0 0' }}>
                {scanError}
              </p>
            )}
          </form>
          {loading ? (
            <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>Loading…</p>
          ) : (
            tree.map((node) => (
              <TreeNode key={node.id} node={node} depth={0} selectedId={selected?.id ?? null} onSelect={setSelected} />
            ))
          )}
          {onlyMain && (
            <p style={{ fontSize: 10, color: 'var(--color-redwood-text-muted)', marginTop: 10 }} data-testid="main-hint">
              Add a zone to start laying out the warehouse.
            </p>
          )}
        </div>

        <div style={panel}>
          {!selected ? (
            <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>Select a location</p>
          ) : (
            <>
              <header style={{ marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{selected.name}</h2>
                <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--color-redwood-text-muted)' }}>
                  {selected.code} · {selected.path || '—'} · <span style={kindBadge(selected.kind)}>{selected.kind}</span>
                </p>
                {selected.capacityUnits != null && (
                  <p style={{ margin: '6px 0 0', fontSize: 10, fontWeight: 600 }} data-testid="location-utilisation-header">
                    {selected.onHandUnits ?? 0} / {selected.capacityUnits}
                    {selected.pct != null ? ` (${selected.pct}%)` : ''}
                  </p>
                )}
                {(selected.capacityUnits != null || selected.barcode) && (
                  <p style={{ margin: '6px 0 0', fontSize: 10 }}>
                    {selected.capacityUnits != null && <>Capacity: {selected.capacityUnits} </>}
                    {selected.barcode && <>· Barcode: {selected.barcode}</>}
                  </p>
                )}
                {PRINT_LABEL_KINDS.has(selected.kind) && (
                  <button
                    type="button"
                    data-testid="print-labels-btn"
                    onClick={handlePrintLabels}
                    style={{ ...btn, marginTop: 8 }}
                  >
                    Print labels
                  </button>
                )}
              </header>

              {actionError && (
                <p data-testid="location-action-error" style={{ color: '#b91c1c', fontSize: 11, marginBottom: 8 }}>
                  {actionError}
                </p>
              )}

              <form onSubmit={handleSaveDetails} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 6px' }}>Details</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input aria-label="Location name" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ fontSize: 11, padding: 6 }} />
                  <input aria-label="Sort order" value={editSort} onChange={(e) => setEditSort(e.target.value)} placeholder="Sort order" style={{ fontSize: 11, padding: 6 }} />
                  <input aria-label="Capacity units" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} placeholder="Capacity" style={{ fontSize: 11, padding: 6 }} />
                  <input aria-label="Barcode" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} placeholder="Barcode" style={{ fontSize: 11, padding: 6 }} />
                </div>
                <button type="submit" disabled={saving} style={{ ...btn, marginTop: 8 }}>
                  Save details
                </button>
              </form>

              {childKinds.length > 0 && (
                <form onSubmit={handleAddChild} style={{ marginBottom: 14 }} data-testid="add-child-form">
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 6px' }}>Add child</p>
                  <select aria-label="Child kind" value={addKind} onChange={(e) => setAddKind(e.target.value)} style={{ fontSize: 11, padding: 6, marginRight: 6 }}>
                    <option value="">Kind</option>
                    {childKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <input aria-label="Child code" value={addCode} onChange={(e) => setAddCode(e.target.value)} placeholder="Code" style={{ fontSize: 11, padding: 6, marginRight: 6 }} />
                  <input aria-label="Child name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Name" style={{ fontSize: 11, padding: 6, marginRight: 6 }} />
                  <button type="submit" disabled={saving || !addKind} style={btn}>
                    Add
                  </button>
                </form>
              )}

              <button type="button" onClick={() => void handleDeactivate()} disabled={saving} style={{ ...btn, marginBottom: 14 }} aria-label="Deactivate location">
                Deactivate
              </button>

              {isStockHoldingKind(selected.kind) && (
                <div data-testid="on-hand-panel">
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', margin: '0 0 6px' }}>On hand</p>
                  {onHandLoading ? (
                    <p style={{ fontSize: 11 }}>Loading…</p>
                  ) : onHand.length === 0 ? (
                    <p style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>No stock here.</p>
                  ) : (
                    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: 4 }}>Product</th>
                          <th style={{ textAlign: 'right', padding: 4 }}>Qty</th>
                          <th style={{ padding: 4 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {onHand.map((row) => (
                          <tr key={row.productId}>
                            <td style={{ padding: 4 }}>{row.name || row.sku || row.productId}</td>
                            <td style={{ padding: 4, textAlign: 'right' }}>{row.onHand}</td>
                            <td style={{ padding: 4, textAlign: 'right' }}>
                              <button type="button" style={btn} aria-label={`Move ${row.productId}`} onClick={() => setTransferOpen(row)}>
                                Move
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {transferOpen && (
                <form onSubmit={handleTransfer} style={{ marginTop: 14, padding: 10, border: '1px solid var(--color-redwood-border)', borderRadius: 8 }} data-testid="transfer-dialog">
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700 }}>Transfer {transferOpen.name || transferOpen.sku}</p>
                  <input aria-label="Transfer quantity" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="Quantity" style={{ fontSize: 11, padding: 6, width: '100%', marginBottom: 6 }} />
                  <select aria-label="Transfer destination" value={transferDest} onChange={(e) => setTransferDest(e.target.value)} style={{ fontSize: 11, padding: 6, width: '100%', marginBottom: 6 }}>
                    <option value="">Destination</option>
                    {transferTargets.filter((t) => t.id !== selected.id).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.path || t.code})
                      </option>
                    ))}
                  </select>
                  <input aria-label="Transfer reference" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} placeholder="Reference" style={{ fontSize: 11, padding: 6, width: '100%', marginBottom: 6 }} />
                  <input aria-label="Transfer note" value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Note" style={{ fontSize: 11, padding: 6, width: '100%', marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit" disabled={saving} style={btn}>
                      Post transfer
                    </button>
                    <button type="button" style={btn} onClick={() => setTransferOpen(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
