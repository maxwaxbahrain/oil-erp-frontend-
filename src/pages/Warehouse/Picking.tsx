import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { getInvoices, type Invoice } from '../../services/api';
import {
  assignPickList,
  cancelPickList,
  createPickList,
  dispatchPickList,
  getManifest,
  getPickListForInvoice,
  listPickLists,
  releasePickList,
  undispatchPickList,
  type PickListStatus,
  type PickListSummary,
  type PickManifest,
} from '../../services/pickingService';
import { vanService, type Van } from '../../services/vanService';
import { localIsoDate, localIsoDatePlusDays } from '../../utils/localDate';
import DispatchDialog from './DispatchDialog';
import ManifestPrint from './ManifestPrint';

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
  fontFamily: "'DM Sans',sans-serif",
};

const field: CSSProperties = {
  ...btn,
  width: '100%',
  textAlign: 'left',
};

interface AssignableUser {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
}

const PICKABLE = new Set(['unpaid', 'partial', 'paid']);

function statusColor(status: string): string {
  if (status === 'dispatched') return '#2563eb';
  if (status === 'picked') return '#22c55e';
  if (status === 'picking' || status === 'released') return '#4F8EF7';
  if (status === 'cancelled') return '#94a3b8';
  if (status === 'short') return '#f59e0b';
  return '#F59E0B';
}

function statusLabel(status: string): string {
  if (status === 'dispatched') return 'Dispatched';
  return status;
}

function sourceLabel(row: PickListSummary): string {
  if (row.sourceKind === 'route') return row.routeDate || 'Route day';
  const count = row.invoiceIds.length;
  return count > 0 ? `${count} invoices` : 'Invoices';
}

function progressLabel(row: PickListSummary): string {
  if (row.pickedCount == null || row.lineCount == null) return '—';
  return `${row.pickedCount} / ${row.lineCount}`;
}

function userLabel(user: AssignableUser): string {
  return user.full_name?.trim() || user.username;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

export default function PickingPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canDispatch = hasRole('admin', 'manager', 'warehouse');
  const [items, setItems] = useState<PickListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [routeDateFilter, setRouteDateFilter] = useState('');
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<'route' | 'invoices'>('route');
  const [routeDate, setRouteDate] = useState(localIsoDate());
  const [vanId, setVanId] = useState('');
  const [notes, setNotes] = useState('');
  const [vans, setVans] = useState<Van[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [openBadges, setOpenBadges] = useState<Record<number, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignFor, setAssignFor] = useState<number | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [dispatchFor, setDispatchFor] = useState<number | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [manifest, setManifest] = useState<PickManifest | null>(null);

  const userNames = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((user) => map.set(user.id, userLabel(user)));
    return map;
  }, [users]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aw = String(a.role).toLowerCase() === 'warehouse' ? 0 : 1;
      const bw = String(b.role).toLowerCase() === 'warehouse' ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return userLabel(a).localeCompare(userLabel(b));
    });
  }, [users]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listPickLists({
        status: statusFilter || undefined,
        routeDate: routeDateFilter || undefined,
      });
      setItems(page.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, routeDateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    vanService.getAll().then(setVans).catch(() => setVans([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get<AssignableUser[]>('/api/auth/users')
      .then(({ data }) => {
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openDialog() {
    setDialogOpen(true);
    setTab('route');
    setRouteDate(localIsoDate());
    setVanId('');
    setNotes('');
    setInvoiceQuery('');
    setSelected([]);
    setOpenBadges({});
    setFormError(null);
    vanService.getAll().then(setVans).catch(() => setVans([]));
  }

  async function openInvoicesTab() {
    setTab('invoices');
    if (invoices.length) return;
    try {
      const rows = await getInvoices();
      const cutoff = localIsoDatePlusDays(-14);
      setInvoices(rows.filter((row) => {
        const status = String(row.status || '').toLowerCase();
        const day = String(row.invoiceDate || '').slice(0, 10);
        return PICKABLE.has(status) && day >= cutoff;
      }));
    } catch (err) {
      setFormError(errorText(err));
    }
  }

  async function toggleInvoice(id: number) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    setSelected(next);
    if (!next.includes(id) || openBadges[id]) return;
    try {
      const open = await getPickListForInvoice(id);
      setOpenBadges((prev) => ({ ...prev, [id]: open.number }));
    } catch {
      setOpenBadges((prev) => ({ ...prev, [id]: '' }));
    }
  }

  async function submitCreate() {
    setFormError(null);
    setSaving(true);
    try {
      const created = tab === 'route'
        ? await createPickList({
          routeDate,
          vanId: vanId || undefined,
          notes: notes.trim() || undefined,
        })
        : await createPickList({ invoiceIds: selected });
      setDialogOpen(false);
      navigate(`/warehouse/picking/${created.id}`);
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  async function onRelease(id: number) {
    setError(null);
    try {
      await releasePickList(id);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function onAssign() {
    if (assignFor == null || !assignUserId) return;
    setError(null);
    try {
      await assignPickList(assignFor, Number(assignUserId));
      setAssignFor(null);
      setAssignUserId('');
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function onCancel(id: number) {
    if (!window.confirm('Cancel this pick list?')) return;
    setError(null);
    try {
      await cancelPickList(id);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  function vanNumber(vanId: string | null): string {
    if (!vanId) return '—';
    return vans.find((van) => van.id === vanId)?.van_number || vanId;
  }

  async function onDispatch(input: { vanId: string; driverId: number; note?: string }) {
    if (dispatchFor == null) return;
    setDispatchError(null);
    setDispatching(true);
    try {
      await dispatchPickList(dispatchFor, input);
      setDispatchFor(null);
      await load();
    } catch (err) {
      setDispatchError(errorText(err));
    } finally {
      setDispatching(false);
    }
  }

  async function onUndispatch(id: number) {
    if (!window.confirm('Undispatch this pick list?')) return;
    setError(null);
    try {
      await undispatchPickList(id);
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function openManifest(id: number) {
    setError(null);
    try {
      setManifest(await getManifest(id));
    } catch (err) {
      setError(errorText(err));
    }
  }

  const visibleInvoices = invoices.filter((row) => {
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return true;
    return row.invoiceNumber.toLowerCase().includes(q) || row.customerName.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Picking</h1>
        <button type="button" style={{ ...btn, background: '#4F8EF7', color: '#fff', border: 'none' }} onClick={openDialog}>
          New pick list
        </button>
      </div>

      <div style={{ ...panel, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12 }}>
          Status
          <select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ ...field, marginLeft: 8 }}
          >
            <option value="">All</option>
            {(['draft', 'released', 'picking', 'picked', 'dispatched', 'cancelled'] as PickListStatus[]).map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          Route date
          <input
            aria-label="Filter route date"
            type="date"
            value={routeDateFilter}
            onChange={(event) => setRouteDateFilter(event.target.value)}
            style={{ ...field, marginLeft: 8 }}
          />
        </label>
      </div>

      {error && <p role="alert" data-testid="picking-error" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      {loading && <p style={{ fontSize: 13 }}>Loading pick lists…</p>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              {['Number', 'Source', 'Status', 'Assigned', 'Van', 'Driver', 'Lines', 'Created', 'Actions'].map((heading) => (
                <th key={heading} style={{ padding: '8px 6px', borderBottom: '1px solid var(--color-redwood-border)' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} data-testid={`pick-row-${row.id}`}>
                <td style={{ padding: '8px 6px' }}>{row.number}</td>
                <td style={{ padding: '8px 6px' }}>{sourceLabel(row)}</td>
                <td style={{ padding: '8px 6px' }}>
                  <span style={{
                    border: `1px solid ${statusColor(row.status)}`,
                    color: statusColor(row.status),
                    borderRadius: 20,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td style={{ padding: '8px 6px' }}>
                  {row.assignedTo == null ? '—' : (userNames.get(row.assignedTo) || `User ${row.assignedTo}`)}
                </td>
                <td style={{ padding: '8px 6px' }} data-testid={`pick-van-${row.id}`}>{vanNumber(row.vanId)}</td>
                <td style={{ padding: '8px 6px' }} data-testid={`pick-driver-${row.id}`}>
                  {row.driverId == null ? '—' : (userNames.get(row.driverId) || `User ${row.driverId}`)}
                </td>
                <td style={{ padding: '8px 6px' }}>{progressLabel(row)}</td>
                <td style={{ padding: '8px 6px' }}>{row.createdAt ? row.createdAt.slice(0, 16).replace('T', ' ') : '—'}</td>
                <td style={{ padding: '8px 6px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {row.status === 'draft' && (
                    <button type="button" style={btn} onClick={() => void onRelease(row.id)}>Release</button>
                  )}
                  {(row.status === 'draft' || row.status === 'released' || row.status === 'picking') && (
                    <button type="button" style={btn} onClick={() => { setAssignFor(row.id); setAssignUserId(''); }}>Assign</button>
                  )}
                  {(row.status === 'draft' || row.status === 'released') && (
                    <button type="button" style={btn} onClick={() => void onCancel(row.id)}>Cancel</button>
                  )}
                  {row.status === 'picked' && canDispatch && (
                    <button type="button" style={btn} onClick={() => { setDispatchFor(row.id); setDispatchError(null); }}>Dispatch…</button>
                  )}
                  {row.status === 'dispatched' && (
                    <button type="button" style={btn} onClick={() => void openManifest(row.id)}>Manifest</button>
                  )}
                  {row.status === 'dispatched' && canDispatch && (
                    <button type="button" style={btn} onClick={() => void onUndispatch(row.id)}>Undispatch</button>
                  )}
                  <Link to={`/warehouse/picking/${row.id}`} style={{ ...btn, textDecoration: 'none' }}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p style={{ fontSize: 13, marginTop: 8 }}>No pick lists.</p>}
      </div>

      {dialogOpen && (
        <div role="dialog" aria-label="New pick list" style={{ ...panel, position: 'fixed', inset: 40, overflow: 'auto', zIndex: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>New pick list</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" aria-pressed={tab === 'route'} style={btn} onClick={() => setTab('route')}>Route day</button>
            <button type="button" aria-pressed={tab === 'invoices'} style={btn} onClick={() => void openInvoicesTab()}>Invoices</button>
          </div>
          {tab === 'route' ? (
            <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
              <label style={{ fontSize: 12 }}>
                Date
                <input aria-label="Route date" type="date" value={routeDate} onChange={(event) => setRouteDate(event.target.value)} style={field} />
              </label>
              <label style={{ fontSize: 12 }}>
                Van
                <select aria-label="Van" value={vanId} onChange={(event) => setVanId(event.target.value)} style={field}>
                  <option value="">Any van</option>
                  {vans.map((van) => (
                    <option key={van.id} value={van.id}>{van.van_number}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                Notes
                <textarea aria-label="Route notes" value={notes} onChange={(event) => setNotes(event.target.value)} style={field} />
              </label>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                aria-label="Search invoices"
                placeholder="Search number or customer"
                value={invoiceQuery}
                onChange={(event) => setInvoiceQuery(event.target.value)}
                style={field}
              />
              <div style={{ maxHeight: 280, overflow: 'auto', display: 'grid', gap: 4 }}>
                {visibleInvoices.map((row) => {
                  const id = Number(row.id);
                  const badge = openBadges[id];
                  return (
                    <label key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.invoiceNumber}`}
                        checked={selected.includes(id)}
                        onChange={() => void toggleInvoice(id)}
                      />
                      <span>{row.invoiceNumber} · {row.customerName}</span>
                      {badge ? (
                        <span data-testid={`open-list-badge-${id}`} style={{ fontSize: 10, color: '#f59e0b' }}>{badge}</span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {formError && <p role="alert" data-testid="create-error" style={{ color: '#ef4444', fontSize: 13 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              style={{ ...btn, background: '#4F8EF7', color: '#fff', border: 'none' }}
              disabled={saving || (tab === 'invoices' && selected.length === 0) || (tab === 'route' && !routeDate)}
              onClick={() => void submitCreate()}
            >
              Create draft
            </button>
            <button type="button" style={btn} onClick={() => setDialogOpen(false)}>Close</button>
          </div>
        </div>
      )}

      {dispatchFor != null && (
        <DispatchDialog
          users={users}
          saving={dispatching}
          error={dispatchError}
          onClose={() => setDispatchFor(null)}
          onSubmit={(input) => void onDispatch(input)}
        />
      )}

      {manifest && <ManifestPrint manifest={manifest} onClose={() => setManifest(null)} />}

      {assignFor != null && (
        <div role="dialog" aria-label="Assign pick list" style={{ ...panel, maxWidth: 360 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Assign</h2>
          <select aria-label="Assign to" value={assignUserId} onChange={(event) => setAssignUserId(event.target.value)} style={field}>
            <option value="">Select user</option>
            {sortedUsers.map((user) => (
              <option key={user.id} value={user.id}>{userLabel(user)}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" style={btn} disabled={!assignUserId} onClick={() => void onAssign()}>Save assignment</button>
            <button type="button" style={btn} onClick={() => setAssignFor(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
