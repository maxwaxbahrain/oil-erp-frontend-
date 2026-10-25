import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { vanService, type Van } from '../../services/vanService';

const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 12,
  padding: '12px 14px',
  position: 'fixed',
  inset: 40,
  overflow: 'auto',
  zIndex: 30,
  maxWidth: 480,
  margin: 'auto',
};

const field: CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: 7,
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: "'DM Sans',sans-serif",
};

export interface DispatchUser {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
}

function userLabel(user: DispatchUser): string {
  return user.full_name?.trim() || user.username;
}

function vanLabel(van: Van): string {
  const plate = van.vehicle_number?.trim();
  return plate ? `${van.van_number} · ${plate}` : van.van_number;
}

export default function DispatchDialog({
  users,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  users: DispatchUser[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: { vanId: string; driverId: number; note?: string }) => void;
}) {
  const [vans, setVans] = useState<Van[]>([]);
  const [vanId, setVanId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    vanService.getAll().then((rows) => {
      if (!cancelled) setVans(rows);
    }).catch(() => {
      if (!cancelled) setVans([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const drivers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aw = String(a.role).toLowerCase() === 'warehouse' ? 0 : 1;
      const bw = String(b.role).toLowerCase() === 'warehouse' ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return userLabel(a).localeCompare(userLabel(b));
    });
  }, [users]);

  return (
    <div role="dialog" aria-label="Dispatch" style={panel}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Dispatch</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        <label style={{ fontSize: 12 }}>
          Van
          <select aria-label="Dispatch van" value={vanId} onChange={(event) => setVanId(event.target.value)} style={field}>
            <option value="">Select van</option>
            {vans.map((van) => (
              <option key={van.id} value={van.id}>{vanLabel(van)}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          Driver
          <select aria-label="Dispatch driver" value={driverId} onChange={(event) => setDriverId(event.target.value)} style={field}>
            <option value="">Select driver</option>
            {drivers.map((user) => (
              <option key={user.id} value={user.id}>{userLabel(user)}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>
          Note
          <textarea aria-label="Dispatch note" value={note} onChange={(event) => setNote(event.target.value)} style={field} />
        </label>
      </div>
      {error && <p role="alert" data-testid="dispatch-error" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          disabled={saving || !vanId || !driverId}
          onClick={() => onSubmit({
            vanId,
            driverId: Number(driverId),
            note: note.trim() || undefined,
          })}
        >
          Dispatch
        </button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
