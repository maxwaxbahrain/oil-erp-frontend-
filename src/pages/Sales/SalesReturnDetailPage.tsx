import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Printer,
  RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';
import {
  getSalesReturn,
  patchSalesReturn,
  reasonLabel,
  type SalesReturn,
  type ReturnStatus,
} from '../../services/salesReturnService';

const THEME = '#800020';

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STEPS: { key: ReturnStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
];

function stepIndex(status: ReturnStatus): number {
  const i = STEPS.findIndex((s) => s.key === status);
  return i >= 0 ? i : 0;
}

export default function SalesReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<SalesReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await getSalesReturn(id);
      setData(r);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Failed to load return');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve() {
    if (!id || !data) return;
    if (!confirm('Approve this return? Ledger credit will be posted and invoice balance updated.')) return;
    setBusy(true);
    try {
      const u = await patchSalesReturn(id, { status: 'approved' });
      setData(u);
      if (window.confirm('Create Credit Note for this approved return?')) {
        navigate('/sales/credit-notes/new', {
          state: {
            customerId: u.customerId,
            invoiceId: u.invoiceId,
            reason: 'return',
          },
        });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!id || !data) return;
    if (!confirm('Mark return as completed?')) return;
    setBusy(true);
    try {
      const u = await patchSalesReturn(id, { status: 'completed' });
      setData(u);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Complete failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: THEME }} size={36} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center p-6">
        <p className="font-black text-gray-800">Return not found</p>
        <button
          type="button"
          onClick={() => navigate('/sales/returns')}
          className="mt-4 px-4 py-2 rounded-xl text-white font-black text-sm"
          style={{ backgroundColor: THEME }}
        >
          Back to list
        </button>
      </div>
    );
  }

  const si = stepIndex(data.status);

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24 print:bg-white">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 space-y-6 print:max-w-none">
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => navigate('/sales/returns')}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 uppercase flex items-center gap-2">
            <RotateCcw size={24} style={{ color: THEME }} />
            {data.returnNumber}
          </h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 print:shadow-none print:border-gray-300">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</p>
              <p className="text-lg font-black text-gray-900">{data.customerName || `Customer #${data.customerId}`}</p>
              <p className="text-sm text-gray-600 mt-2 font-semibold">
                Invoice: <span className="font-mono">{data.invoiceNumber}</span>
              </p>
              <p className="text-sm text-gray-600 font-semibold">Return date: {data.returnDate}</p>
              <p className="text-sm mt-1">
                <span className="font-bold text-gray-500">Reason: </span>
                <span className="font-black" style={{ color: THEME }}>
                  {reasonLabel(data.returnReason)}
                </span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Credit amount</p>
              <p className="text-3xl font-black font-mono tabular-nums" style={{ color: THEME }}>
                ${formatMoney(data.refundAmount)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Timeline</p>
            <div className="flex flex-wrap gap-2">
              {STEPS.map((s, idx) => (
                <div
                  key={s.key}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase border',
                    idx <= si ? 'border-[#800020]/40 bg-[#800020]/5 text-[#800020]' : 'border-gray-200 text-gray-400'
                  )}
                >
                  {idx < si ? <CheckCircle size={16} /> : idx === si ? <Clock size={16} /> : <span className="w-4" />}
                  {s.label}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 font-medium">
              {data.status === 'approved' &&
                'Credit has been posted to the customer ledger and the invoice balance was reduced.'}
              {data.status === 'pending' && 'Waiting for manager approval.'}
              {data.status === 'draft' && 'Draft — submit from the edit form when ready.'}
              {data.status === 'completed' && 'Return closed.'}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Returned items</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-black text-gray-500 uppercase">Product</th>
                    <th className="px-3 py-2 text-center text-[10px] font-black text-gray-500 uppercase">Qty</th>
                    <th className="px-3 py-2 text-right text-[10px] font-black text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                        No lines
                      </td>
                    </tr>
                  ) : (
                    data.lineItems.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 font-bold text-gray-900">{line.productName}</td>
                        <td className="px-3 py-2 text-center font-semibold">{line.quantityReturned}</td>
                        <td className="px-3 py-2 text-right font-mono font-black">${formatMoney(line.totalAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {data.notes ? (
            <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-xl">
              <p className="text-[10px] font-black text-amber-900 uppercase mb-1">Notes</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{data.notes}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 rounded-xl border-2 border-gray-200 font-black text-xs uppercase flex items-center gap-2 hover:bg-gray-50"
            >
              <Printer size={18} />
              Print return note
            </button>
            {data.status === 'draft' && (
              <button
                type="button"
                onClick={() => navigate(`/sales/returns/edit/${data.id}`)}
                className="px-4 py-2.5 rounded-xl text-white font-black text-xs uppercase"
                style={{ backgroundColor: THEME }}
              >
                Edit draft
              </button>
            )}
            {data.status === 'pending' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => approve()}
                className="px-4 py-2.5 rounded-xl text-white font-black text-xs uppercase flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: THEME }}
              >
                {busy ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                Approve (manager)
              </button>
            )}
            {data.status === 'approved' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/sales/credit-notes/new', {
                      state: { customerId: data.customerId, invoiceId: data.invoiceId, reason: 'return' },
                    })
                  }
                  className="px-4 py-2.5 rounded-xl text-white font-black text-xs uppercase"
                  style={{ backgroundColor: THEME }}
                >
                  Create Credit Note
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => complete()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase flex items-center gap-2 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                  Mark completed
                </button>
              </>
            )}
          </div>

          <p className="text-[10px] text-gray-400 font-medium print:hidden">
            Created {new Date(data.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
