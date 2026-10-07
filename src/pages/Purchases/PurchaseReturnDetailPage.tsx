import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  cancel,
  get,
  post as postReturn,
  type PurchaseReturn,
  type PurchaseReturnStatus,
} from '../../services/purchaseReturnService';

const POST_CONFIRM = 'Post this return? Stock will go down and the supplier balance will be reduced.';
const CANCEL_CONFIRM = 'Cancel this return? Stock will be added back and the accounting will be reversed.';

function formatMoney(n: number | null): string {
  if (n == null) return '—';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status: PurchaseReturnStatus): string {
  if (status === 'posted') return 'bg-emerald-100 text-emerald-800';
  if (status === 'cancelled') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-900';
}

export default function PurchaseReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canCancelPosted = hasRole('admin', 'accountant');
  const [data, setData] = useState<PurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await get(id));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load purchase return');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postThis() {
    if (!id || !data) return;
    if (!window.confirm(POST_CONFIRM)) return;
    setBusy(true);
    setError(null);
    try {
      setData(await postReturn(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Post failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancelThis() {
    if (!id || !data) return;
    if (!window.confirm(CANCEL_CONFIRM)) return;
    setBusy(true);
    setError(null);
    try {
      setData(await cancel(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-gray-500">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}
        <p className="font-black text-gray-800">Purchase return not found</p>
        <button
          type="button"
          onClick={() => navigate('/purchases/returns')}
          className="px-4 py-2 rounded-xl text-white text-sm font-black"
          style={{ backgroundColor: '#800020' }}
        >
          Back to list
        </button>
      </div>
    );
  }

  const showCancel = data.status === 'draft' || (data.status === 'posted' && canCancelPosted);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/purchases/returns')}
          className="p-2 rounded-xl border border-gray-200 bg-white"
          aria-label="Back to purchase returns"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <RotateCcw size={22} />
          {data.number}
        </h1>
        <span
          data-status={data.status}
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${statusClass(data.status)}`}
        >
          {data.status}
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2 text-sm">
        <p><span className="font-bold text-gray-500">Supplier: </span>{data.supplier_name}</p>
        <p><span className="font-bold text-gray-500">Date: </span>{data.date}</p>
        <p><span className="font-bold text-gray-500">Reason: </span>{data.reason || '—'}</p>
        <p><span className="font-bold text-gray-500">Notes: </span>{data.notes || '—'}</p>
        <p><span className="font-bold text-gray-500">Refund mode: </span>{data.refund_mode}</p>
        <p><span className="font-bold text-gray-500">Refund amount: </span>{formatMoney(data.refund_amount)}</p>
        <p><span className="font-bold text-gray-500">Total: </span>{formatMoney(data.total)}</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Unit cost</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody>
            {(data.lines ?? []).map((line) => (
              <tr key={String(line.id)} className="border-t border-gray-100">
                <td className="px-4 py-3">Product #{line.product_id}</td>
                <td className="px-4 py-3 text-right font-mono">{line.quantity}</td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(line.unit_cost)}</td>
                <td className="px-4 py-3 text-right font-mono">{formatMoney(line.amount)}</td>
                <td className="px-4 py-3">{line.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        {data.status === 'draft' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => navigate(`/purchases/returns/${data.id}/edit`)}
              className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-black"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void postThis()}
              className="px-4 py-2 rounded-xl text-white text-sm font-black"
              style={{ backgroundColor: '#800020' }}
            >
              Post
            </button>
          </>
        )}
        {showCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancelThis()}
            className="px-4 py-2 rounded-xl border border-red-300 text-red-800 text-sm font-black"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
