import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Circle,
  FileInput,
  Truck,
  ClipboardCheck,
  DollarSign,
  X,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';
import { getVans, type Van } from '../../services/api';
import {
  getSalesOrder,
  patchSalesOrder,
  convertSalesOrderToInvoice,
  hydrateSalesOrdersWithCustomers,
  type SalesOrder,
  type SalesOrderStatus,
} from '../../services/salesService';

const STEPS: SalesOrderStatus[] = ['draft', 'confirmed', 'delivered', 'invoiced'];

const THEME_PRIMARY = '#800020';
const SIDEBAR_DARK = '#1a1a2e';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800 border border-gray-200',
  confirmed: 'bg-blue-50 text-blue-900 border border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
  invoiced: 'bg-violet-50 text-violet-900 border border-violet-200',
  cancelled: 'bg-red-50 text-red-900 border border-red-200',
};

function stepIndex(s: SalesOrderStatus): number {
  if (s === 'cancelled') return -1;
  const i = STEPS.indexOf(s);
  return i >= 0 ? i : 0;
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceCreatedModal, setInvoiceCreatedModal] = useState<{
    invoiceNumber: string;
    total: number;
    customerId: string;
  } | null>(null);
  const [showVanPicker, setShowVanPicker] = useState(false);
  const [vans, setVans] = useState<Van[]>([]);
  const [vansLoading, setVansLoading] = useState(false);
  const [selectedVanId, setSelectedVanId] = useState('');

  const activeVans = useMemo(
    () => vans.filter((v) => (v.status || 'active') === 'active'),
    [vans]
  );

  const confirmVanReady =
    activeVans.length === 1 || (activeVans.length > 1 && !!selectedVanId);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const o = await getSalesOrder(id);
      const [hydrated] = await hydrateSalesOrdersWithCustomers([o]);
      setOrder(hydrated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load order');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePodPatch(next: { pod_confirmed?: boolean; signature_confirmed?: boolean }) {
    if (!id) return;
    setSaving(true);
    try {
      await patchSalesOrder(id, next);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(next: SalesOrderStatus, vanId?: string | null) {
    if (!id) return;
    setSaving(true);
    try {
      const body: { status: SalesOrderStatus; van_id?: string | null } = { status: next };
      if (vanId != null && vanId !== '') body.van_id = vanId;
      await patchSalesOrder(id, body);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function loadActiveVans(): Promise<Van[]> {
    setVansLoading(true);
    try {
      const list = await getVans();
      const active = (Array.isArray(list) ? list : []).filter(
        (v) => (v.status || 'active') === 'active'
      );
      setVans(active);
      if (active.length === 1) setSelectedVanId(active[0].id);
      return active;
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not load vans');
      return [];
    } finally {
      setVansLoading(false);
    }
  }

  async function handleConfirmDraft() {
    if (!order) return;
    if (order.van_id) {
      await patchStatus('confirmed');
      return;
    }

    const active = await loadActiveVans();
    if (active.length === 0) {
      alert('No active vans available. Add a van before confirming.');
      return;
    }
    if (active.length === 1) {
      await patchStatus('confirmed', active[0].id);
      return;
    }

    setSelectedVanId('');
    setShowVanPicker(true);
  }

  async function confirmDraftWithVan() {
    if (!confirmVanReady) return;
    const vanId = selectedVanId || activeVans[0]?.id;
    if (!vanId) return;
    setShowVanPicker(false);
    await patchStatus('confirmed', vanId);
  }

  async function handleConvert() {
    if (!id || !order) return;
    try {
      setConverting(true);
      const updated = await convertSalesOrderToInvoice(id);
      const invNo = updated.linked_invoice_number?.trim() || '';
      if (!invNo) {
        throw new Error('Convert succeeded but invoice number missing in response');
      }
      setInvoiceCreatedModal({
        invoiceNumber: invNo,
        total: updated.total,
        customerId: order.customer_id,
      });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not convert');
    } finally {
      setConverting(false);
    }
  }

  if (loading || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 p-6">
        {error ? (
          <p className="text-red-700 font-bold text-center">{error}</p>
        ) : (
          <>
            <Loader2 className="animate-spin" style={{ color: THEME_PRIMARY }} size={36} />
            <p className="text-gray-700 font-bold">Loading order…</p>
          </>
        )}
        <button
          type="button"
          onClick={() => navigate('/sales/orders')}
          className="mt-4 min-h-[48px] px-6 rounded-xl border-2 border-gray-200 font-black text-sm uppercase tracking-wide bg-white hover:bg-gray-50"
        >
          Back to list
        </button>
      </div>
    );
  }

  const idx = stepIndex(order.status);
  const cancelled = order.status === 'cancelled';
  const podEnabled = order.status === 'delivered';
  const showConvert =
    order.status === 'delivered' &&
    order.pod_confirmed &&
    order.signature_confirmed &&
    !order.linked_invoice_number;

  return (
    <div className="space-y-6 max-w-3xl w-full mx-auto pb-28">
      {/* Header card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex flex-wrap items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/sales/orders')}
            className="p-2.5 rounded-xl border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <h1 className="font-mono font-black text-xl md:text-2xl text-gray-900 tracking-tight">{order.so_number}</h1>
              <span
                className={clsx(
                  'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                  STATUS_BADGE[order.status] || 'bg-gray-100 text-gray-800 border border-gray-200'
                )}
              >
                {order.status}
              </span>
            </div>
            <p className="text-base font-black text-gray-900 leading-snug">
              {order.customer_name || `Customer #${order.customer_id}`}
            </p>
          </div>
        </div>
      </div>

      {cancelled && (
        <div className="rounded-2xl bg-red-50 text-red-900 font-black text-sm px-5 py-4 border border-red-100 uppercase tracking-wide">
          This order is cancelled.
        </div>
      )}

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-5">Status timeline</h2>
        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const done = !cancelled && idx >= i;
            const current = !cancelled && idx === i;
            return (
              <div key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  {done ? (
                    <CheckCircle2
                      className="shrink-0"
                      size={26}
                      style={{ color: current ? THEME_PRIMARY : '#059669' }}
                      strokeWidth={current ? 2.5 : 2}
                    />
                  ) : (
                    <Circle className="text-gray-200 shrink-0" size={26} strokeWidth={2} />
                  )}
                  {i < STEPS.length - 1 && (
                    <div
                      className={clsx('w-0.5 flex-1 min-h-[22px] rounded-full', done ? '' : 'bg-gray-200')}
                      style={done ? { backgroundColor: current ? `${THEME_PRIMARY}55` : '#a7f3d0' } : undefined}
                    />
                  )}
                </div>
                <div
                  className={clsx(
                    'pb-5 pt-0.5 capitalize text-sm',
                    current ? 'font-black text-gray-900' : 'text-gray-600 font-bold'
                  )}
                  style={current ? { color: THEME_PRIMARY } : undefined}
                >
                  {step}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 space-y-5">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">POD &amp; delivery</h2>
        <p className="text-sm text-gray-600 font-semibold leading-relaxed">
          After the order is marked <strong className="text-gray-900">delivered</strong>, confirm POD and signature here.
          Both are required before converting to invoice.
        </p>
        <label
          className={clsx(
            'flex items-center gap-4 min-h-[52px] rounded-xl border border-gray-100 px-4 py-3 transition-colors',
            podEnabled ? 'cursor-pointer hover:bg-gray-50/80 bg-gray-50/40' : 'cursor-not-allowed opacity-55 bg-gray-50'
          )}
        >
          <input
            type="checkbox"
            className="h-5 w-5 rounded-md border-2 border-gray-300 focus:ring-2 focus:ring-offset-0 shrink-0"
            style={{ accentColor: THEME_PRIMARY }}
            checked={order.pod_confirmed}
            disabled={saving || order.status === 'invoiced' || !podEnabled}
            onChange={(e) => savePodPatch({ pod_confirmed: e.target.checked })}
          />
          <span className="font-black text-gray-900 text-sm">Delivery confirmed (POD)</span>
        </label>
        <label
          className={clsx(
            'flex items-center gap-4 min-h-[52px] rounded-xl border border-gray-100 px-4 py-3 transition-colors',
            podEnabled ? 'cursor-pointer hover:bg-gray-50/80 bg-gray-50/40' : 'cursor-not-allowed opacity-55 bg-gray-50'
          )}
        >
          <input
            type="checkbox"
            className="h-5 w-5 rounded-md border-2 border-gray-300 focus:ring-2 focus:ring-offset-0 shrink-0"
            style={{ accentColor: THEME_PRIMARY }}
            checked={order.signature_confirmed}
            disabled={saving || order.status === 'invoiced' || !podEnabled}
            onChange={(e) => savePodPatch({ signature_confirmed: e.target.checked })}
          />
          <span className="font-black text-gray-900 text-sm">Customer signature captured</span>
        </label>
        {order.linked_invoice_number && (
          <p className="text-sm font-black text-violet-800 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
            Invoice: {order.linked_invoice_number}
          </p>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Lines</h2>
        <ul className="divide-y divide-gray-100">
          {order.items.map((line, i) => (
            <li key={i} className="py-4 flex justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-gray-900 truncate">{line.product_name || 'Product'}</p>
                <p className="text-xs font-bold text-gray-500 mt-1">
                  {line.quantity} × {formatMoney(line.unit_price)}
                </p>
              </div>
              <p className="font-mono font-black text-gray-900 shrink-0">{formatMoney(line.total)}</p>
            </li>
          ))}
        </ul>
        <div className="space-y-3 pt-5 mt-2 border-t-2 border-gray-100">
          <div className="flex justify-between items-center">
            <span className="font-black text-gray-800 uppercase tracking-wide text-sm">Subtotal</span>
            <span className="font-mono font-bold tabular-nums text-gray-900">{formatMoney(order.subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-black text-gray-800 uppercase tracking-wide text-sm">Tax</span>
            <span className="font-mono font-bold tabular-nums text-gray-900">{formatMoney(order.tax)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="font-black text-gray-800 uppercase tracking-wide text-sm">Total</span>
            <span className="text-2xl font-black tabular-nums text-gray-900">{formatMoney(order.total)}</span>
          </div>
        </div>
        {order.notes && (
          <p className="mt-5 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100 rounded-xl p-4 bg-gray-50/50 font-semibold leading-relaxed">
            <span className="font-black text-gray-900">Notes: </span>
            {order.notes}
          </p>
        )}
      </section>

      {!cancelled && order.status !== 'invoiced' && (
        <div className="sticky bottom-0 z-20 -mx-1 px-1 pt-4 pb-2 bg-[#F8F9FA] border-t border-gray-200/80 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          {order.status === 'draft' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleConfirmDraft()}
              className="w-full min-h-[52px] rounded-xl text-white font-black text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
              style={{ backgroundColor: THEME_PRIMARY }}
            >
              {saving ? <Loader2 className="animate-spin" size={22} /> : <ClipboardCheck size={22} />}
              Confirm order
            </button>
          )}

          {order.status === 'confirmed' && (
            <button
              type="button"
              disabled={saving}
              onClick={() => patchStatus('delivered')}
              className="w-full min-h-[52px] rounded-xl bg-emerald-700 text-white font-black text-sm uppercase tracking-widest hover:bg-emerald-800 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              {saving ? <Loader2 className="animate-spin" size={22} /> : <Truck size={22} />}
              Mark as delivered
            </button>
          )}

          {showConvert && (
            <button
              type="button"
              disabled={converting}
              onClick={handleConvert}
              className="w-full min-h-[52px] rounded-xl bg-violet-800 text-white font-black text-sm uppercase tracking-widest hover:bg-violet-900 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              {converting ? <Loader2 className="animate-spin" size={22} /> : <FileInput size={22} />}
              Convert to invoice
            </button>
          )}
        </div>
      )}

      {showVanPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200/80">
            <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${THEME_PRIMARY}18` }}
                >
                  <Truck size={22} style={{ color: THEME_PRIMARY }} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-gray-900 uppercase tracking-wide">Deliver by van</h2>
                  <p className="text-xs font-semibold text-gray-500 mt-1">Choose which van will deliver this order</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setShowVanPicker(false)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {vansLoading ? (
                <div className="min-h-[56px] flex items-center justify-center">
                  <Loader2 className="animate-spin" style={{ color: THEME_PRIMARY }} size={28} />
                </div>
              ) : (
                <select
                  value={selectedVanId}
                  onChange={(e) => setSelectedVanId(e.target.value)}
                  className="w-full min-h-[56px] rounded-xl border-2 border-gray-200 px-4 text-base font-bold bg-white shadow-sm focus:ring-2 focus:ring-[#800020]/20 focus:border-[#800020] outline-none"
                >
                  <option value="">Select a van…</option>
                  {activeVans.map((van) => (
                    <option key={van.id} value={van.id}>
                      {van.van_number} — {van.driver_name}
                    </option>
                  ))}
                </select>
              )}
              {!confirmVanReady && !vansLoading && (
                <p className="text-sm font-bold text-amber-700">Select a van to confirm this order</p>
              )}
              <button
                type="button"
                disabled={saving || vansLoading || !confirmVanReady}
                onClick={() => confirmDraftWithVan()}
                className="w-full min-h-[52px] rounded-xl text-white font-black text-sm uppercase tracking-widest hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
                style={{ backgroundColor: THEME_PRIMARY }}
              >
                {saving ? <Loader2 className="animate-spin" size={22} /> : <ClipboardCheck size={22} />}
                Confirm order
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceCreatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200/80">
            <div
              className="px-5 py-4 flex items-start justify-between gap-3 border-b border-white/10"
              style={{ backgroundColor: SIDEBAR_DARK }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${THEME_PRIMARY}33` }}
                >
                  <FileText className="text-white" size={22} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">Invoice created</h2>
                  <p className="text-xs font-mono text-gray-300 truncate mt-1">{invoiceCreatedModal.invoiceNumber}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setInvoiceCreatedModal(null)}
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-5">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total amount</p>
                <p className="text-2xl font-black text-gray-900 tabular-nums">{formatMoney(invoiceCreatedModal.total)}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  className="flex-1 min-h-[50px] rounded-xl text-white font-black text-xs uppercase tracking-widest hover:brightness-110 flex items-center justify-center gap-2 shadow-md transition-all"
                  style={{ backgroundColor: THEME_PRIMARY }}
                  onClick={() => {
                    const cid = invoiceCreatedModal.customerId;
                    setInvoiceCreatedModal(null);
                    navigate(`/customers/${cid}?tab=payments`);
                  }}
                >
                  <DollarSign size={20} />
                  Record payment
                </button>
                <button
                  type="button"
                  className="flex-1 min-h-[50px] rounded-xl border-2 border-gray-900 text-gray-900 font-black text-xs uppercase tracking-widest hover:bg-gray-50 flex items-center justify-center"
                  onClick={() => {
                    setInvoiceCreatedModal(null);
                    navigate('/sales/invoices');
                  }}
                >
                  View invoices
                </button>
              </div>
              <button
                type="button"
                className="w-full min-h-[44px] text-sm font-black text-gray-500 hover:text-gray-900 uppercase tracking-wide"
                onClick={() => setInvoiceCreatedModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
