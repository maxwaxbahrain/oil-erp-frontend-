import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, RotateCcw } from 'lucide-react';
import { getSuppliers, type Supplier } from '../../services/purchasesService';
import {
  list,
  type PurchaseReturn,
  type PurchaseReturnStatus,
} from '../../services/purchaseReturnService';

function formatMoney(n: number | null): string {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status: PurchaseReturnStatus): string {
  if (status === 'posted') return 'bg-emerald-100 text-emerald-800';
  if (status === 'cancelled') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-900';
}

export default function PurchaseReturns() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await list({
        status: status || undefined,
        supplier_id: supplierId || undefined,
      });
      setRows(data);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : 'Failed to load purchase returns');
    } finally {
      setLoading(false);
    }
  }, [status, supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    getSuppliers()
      .then((data) => {
        if (!cancelled) setSuppliers(data);
      })
      .catch(() => {
        if (!cancelled) setSuppliers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <RotateCcw size={22} />
          Purchase Returns
        </h1>
        <button
          type="button"
          onClick={() => navigate('/purchases/returns/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-black"
          style={{ backgroundColor: '#800020' }}
        >
          <Plus size={16} />
          New purchase return
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-bold text-gray-600">
          Status
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">All</option>
            <option value="draft">draft</option>
            <option value="posted">posted</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        <label className="text-xs font-bold text-gray-600">
          Supplier
          <select
            aria-label="Supplier filter"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="mt-1 block border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[12rem]"
          >
            <option value="">All suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Refund amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  <Loader2 className="inline animate-spin" size={18} /> Loading purchase returns…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No purchase returns
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/purchases/returns/${row.id}`)}
                >
                  <td className="px-4 py-3 font-mono font-bold">{row.number}</td>
                  <td className="px-4 py-3">{row.date}</td>
                  <td className="px-4 py-3">{row.supplier_name}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(row.total)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatMoney(row.refund_amount)}</td>
                  <td className="px-4 py-3">
                    <span
                      data-status={row.status}
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${statusClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
