/**
 * Lot balances for one product, by lot then location. Expired / expiring chips come from
 * GET /inventory/lots/expiring; quantities and dates are only formatted here.
 * Admin and manager can correct a lot's expiry and note (PATCH /inventory/lots/{id}).
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getExpiringLots,
  getLot,
  getLotBalances,
  patchLot,
  type ExpiringLot,
  type LotBalance,
} from '../../services/stockLotService';
import { getLocationsFlat } from '../../services/stockLocationService';
import { formatLocalDate } from '../../utils/dates';

function qty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Request failed';
}

interface Props {
  productId: number;
  canEdit: boolean;
}

export default function ProductLotsPanel({ productId, canEdit }: Props) {
  const [rows, setRows] = useState<LotBalance[] | null>(null);
  const [expiring, setExpiring] = useState<Map<string, ExpiringLot>>(new Map());
  const [codes, setCodes] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ lotId: number; expiry: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [balances, soon] = await Promise.all([getLotBalances(productId), getExpiringLots(30, true)]);
      setRows(balances);
      setExpiring(new Map(soon.filter((row) => row.product_id === productId).map((row) => [`${row.lot_id}:${row.location_id}`, row])));
      setError(null);
    } catch (err) {
      setRows([]);
      setError(errorText(err));
    }
  }, [productId]);

  useEffect(() => {
    void load();
    getLocationsFlat()
      .then((locs) => setCodes(new Map(locs.map((loc) => [loc.id, loc.code]))))
      .catch(() => setCodes(new Map()));
  }, [load]);

  async function startEdit(row: LotBalance) {
    setError(null);
    try {
      const lot = await getLot(row.lot_id);
      setEditing({ lotId: lot.id, expiry: lot.expiry_date ?? '', note: lot.note ?? '' });
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await patchLot(editing.lotId, { expiry_date: editing.expiry || null, note: editing.note.trim() || null });
      setEditing(null);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="product-lots" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em] mb-4">Lots</h3>
      {error && <p role="alert" className="mb-3 text-sm font-bold text-rose-700">{error}</p>}
      {rows == null ? (
        <p className="text-sm text-gray-400">Loading lots…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">No lot balances.</p>
      ) : (
        <table className="w-full text-sm" aria-label="Lot balances">
          <thead className="bg-gray-50">
            <tr>
              {['Lot', 'Expiry', 'Location', 'Qty', '', ''].map((label, i) => (
                <th key={`${label}-${i}`} className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const soon = expiring.get(`${row.lot_id}:${row.location_id}`);
              return (
                <tr key={`${row.lot_id}-${row.location_id}`} data-testid={`lot-row-${row.lot_id}-${row.location_id ?? 'none'}`}>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{row.lot_number}</td>
                  <td className="px-4 py-3 text-xs">{row.expiry_date ? formatLocalDate(row.expiry_date) : '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.location_id == null ? '—' : (codes.get(row.location_id) ?? row.location_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-black">{qty(row.qty)}</td>
                  <td className="px-4 py-3 text-xs">
                    {soon?.expired && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-black">expired</span>}
                    {soon && !soon.expired && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-black">{`expires in ${soon.days_left}d`}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {canEdit && row.lot_number !== 'UNASSIGNED' && (
                      <button type="button" className="underline" onClick={() => void startEdit(row)}>Edit</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {editing && (
        <div role="dialog" aria-label="Edit lot" className="mt-4 p-4 border border-gray-200 rounded-xl grid gap-2 max-w-sm">
          <label className="text-xs font-bold">
            Expiry
            <input
              aria-label="Lot expiry"
              type="date"
              value={editing.expiry}
              onChange={(e) => setEditing({ ...editing, expiry: e.target.value })}
              className="block border border-gray-200 rounded px-2 py-1"
            />
          </label>
          <label className="text-xs font-bold">
            Note
            <input
              aria-label="Lot note"
              value={editing.note}
              onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              className="block w-full border border-gray-200 rounded px-2 py-1"
            />
          </label>
          <p className="text-[10px] text-gray-500">Corrections only — quantities do not change.</p>
          <div className="flex gap-2">
            <button type="button" disabled={saving} className="px-3 py-1 rounded bg-gray-900 text-white text-xs" onClick={() => void saveEdit()}>Save lot</button>
            <button type="button" className="px-3 py-1 rounded border text-xs" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
