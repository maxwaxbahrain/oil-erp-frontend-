import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, FileInput, Loader2, RefreshCw, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';
import {
  getSalesOrders,
  hydrateSalesOrdersWithCustomers,
  convertSalesOrderToInvoice,
  type SalesOrder,
  type SalesOrderStatus,
} from '../../services/salesService';

const THEME_PRIMARY = '#800020';

const STATUS_STYLES: Record<SalesOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 border border-gray-200',
  confirmed: 'bg-blue-50 text-blue-900 border border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
  invoiced: 'bg-violet-50 text-violet-900 border border-violet-200',
  cancelled: 'bg-red-50 text-red-900 border border-red-200',
};

const STATUS_LEFT_BORDER: Record<SalesOrderStatus, string> = {
  draft: 'border-l-gray-400',
  confirmed: 'border-l-blue-600',
  delivered: 'border-l-emerald-600',
  invoiced: 'border-l-violet-600',
  cancelled: 'border-l-red-500',
};

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatOrderDate(raw: string) {
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return raw;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalDay(raw: string | undefined): Date | null {
  if (raw == null || raw === '') return null;
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  } catch {
    return null;
  }
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function startOfWeekLocal(ref: Date): Date {
  const x = new Date(ref);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfWeekLocal(ref: Date): Date {
  const s = startOfWeekLocal(ref);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

function orderCreatedDay(o: SalesOrder): Date | null {
  if (o.created_at) return toLocalDay(o.created_at);
  return toLocalDay(o.order_date);
}

type ProductAgg = { name: string; cases: number };

function computeTopProductsFromInvoiced(orders: SalesOrder[]): ProductAgg[] {
  const map = new Map<string, { name: string; cases: number }>();
  for (const o of orders) {
    if (o.status !== 'invoiced') continue;
    for (const it of o.items || []) {
      const pid = String(it.product_id ?? '').trim() || it.product_name;
      if (!map.has(pid)) {
        map.set(pid, { name: it.product_name || 'Product', cases: 0 });
      }
      const row = map.get(pid)!;
      row.cases += Number(it.quantity) || 0;
      if (it.product_name) row.name = it.product_name;
    }
  }
  return [...map.values()]
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 3);
}

function computeSalesmanLeaderboard(orders: SalesOrder[]): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const o of orders) {
    const name = (o.salesman_name || '').trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + (Number(o.total) || 0));
  }
  return [...map.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
}

function InsightSection({
  title,
  borderColor,
  children,
}: {
  title: string;
  borderColor: string;
  children: ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      style={{ borderTopWidth: 4, borderTopColor: borderColor }}
    >
      <div className="p-5 md:p-6">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4">{title}</h3>
        {children}
      </div>
    </section>
  );
}

export default function SalesOrdersWorkflow() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SalesOrderStatus | 'all'>('all');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await getSalesOrders();
      setOrders(await hydrateSalesOrdersWithCustomers(raw));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const insights = useMemo(() => {
    const today = startOfToday();
    const weekStart = startOfWeekLocal(today);
    const weekEnd = endOfWeekLocal(today);

    const pipeline = {
      draft: orders.filter((o) => o.status === 'draft').length,
      confirmed: orders.filter((o) => o.status === 'confirmed').length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      invoiced: orders.filter((o) => o.status === 'invoiced').length,
    };

    const invoicedTodayTotal = orders
      .filter((o) => o.status === 'invoiced' && sameDay(orderCreatedDay(o), today))
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const ordersTodayCount = orders.filter((o) => sameDay(toLocalDay(o.order_date), today)).length;

    const weekRevenue = orders
      .filter((o) => {
        if (o.status !== 'invoiced') return false;
        const od = toLocalDay(o.order_date);
        if (!od) return false;
        return od >= weekStart && od <= weekEnd;
      })
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const topProducts = computeTopProductsFromInvoiced(orders);
    const maxCases = topProducts.length ? Math.max(...topProducts.map((p) => p.cases), 1) : 1;

    const salesmen = computeSalesmanLeaderboard(orders);

    return {
      pipeline,
      invoicedTodayTotal,
      ordersTodayCount,
      weekRevenue,
      topProducts,
      maxCases,
      salesmen,
    };
  }, [orders]);

  const chips: Array<{ key: SalesOrderStatus | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'invoiced', label: 'Invoiced' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  async function handleConvert(order: SalesOrder) {
    if (order.status !== 'delivered') return;
    if (!order.pod_confirmed || !order.signature_confirmed) {
      alert('Confirm POD and signature on the order detail page first.');
      return;
    }
    try {
      setConvertingId(order.id);
      await convertSalesOrderToInvoice(order.id);
      await load();
      alert('Invoice created from this order.');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Convert failed');
    } finally {
      setConvertingId(null);
    }
  }

  const insightsPanel = (
    <aside className="w-full lg:w-[35%] lg:shrink-0 space-y-5">
      <div className="lg:sticky lg:top-4 space-y-5">
        <InsightSection title="Order pipeline" borderColor="#9ca3af">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-bold text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                Draft
              </span>
              <span className="font-black text-gray-900 tabular-nums">{insights.pipeline.draft}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-bold text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                Confirmed
              </span>
              <span className="font-black text-gray-900 tabular-nums">{insights.pipeline.confirmed}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-bold text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                Delivered
              </span>
              <span className="font-black text-gray-900 tabular-nums">{insights.pipeline.delivered}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-bold text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-600 shrink-0" />
                Invoiced
              </span>
              <span className="font-black text-gray-900 tabular-nums">{insights.pipeline.invoiced}</span>
            </li>
          </ul>
        </InsightSection>

        <InsightSection title="Today's revenue" borderColor={THEME_PRIMARY}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-2 items-baseline">
              <dt className="font-bold text-gray-500">Invoiced today</dt>
              <dd className="font-black tabular-nums text-gray-900">{formatMoney(insights.invoicedTodayTotal)}</dd>
            </div>
            <div className="flex justify-between gap-2 items-baseline">
              <dt className="font-bold text-gray-500">Orders today</dt>
              <dd className="font-black tabular-nums text-gray-900">{insights.ordersTodayCount}</dd>
            </div>
            <div className="flex justify-between gap-2 items-baseline pt-1 border-t border-gray-100">
              <dt className="font-bold text-gray-500">This week (invoiced)</dt>
              <dd className="font-black tabular-nums" style={{ color: THEME_PRIMARY }}>
                {formatMoney(insights.weekRevenue)}
              </dd>
            </div>
          </dl>
        </InsightSection>

        <InsightSection title="Top selling products" borderColor="#6b7280">
          {insights.topProducts.length === 0 ? (
            <p className="text-sm font-semibold text-gray-500">No invoiced line items in loaded orders.</p>
          ) : (
            <ul className="space-y-4">
              {insights.topProducts.map((p) => (
                <li key={p.name}>
                  <div className="flex justify-between gap-2 items-start mb-1.5">
                    <span className="font-bold text-gray-900 text-sm leading-snug">{p.name}</span>
                    <span className="text-xs font-black text-gray-500 tabular-nums shrink-0">{p.cases} cases</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (p.cases / insights.maxCases) * 100)}%`,
                        backgroundColor: THEME_PRIMARY,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </InsightSection>

        <InsightSection title="Salesman leaderboard" borderColor="#374151">
          {insights.salesmen.length === 0 ? (
            <p className="text-sm font-semibold text-gray-500">No salesman assigned on loaded orders.</p>
          ) : (
            <ul className="space-y-3">
              {insights.salesmen.map((s, i) => (
                <li key={s.name} className="flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                    style={{ backgroundColor: THEME_PRIMARY }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{s.name}</p>
                    <p className="text-xs font-black text-gray-500 tabular-nums">{formatMoney(s.total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </InsightSection>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-32 md:pb-10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 flex flex-col lg:flex-row lg:items-start lg:gap-8">
        <div className="w-full lg:w-[65%] lg:min-w-0 space-y-6">
          {/* Page header — ProductManagement-style hero */}
          <div className="bg-white p-8 md:p-10 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-[0.06] pointer-events-none">
              <ShoppingCart size={160} className="text-gray-900" />
            </div>
            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="flex items-start gap-5">
                <div
                  className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"
                  style={{ backgroundColor: THEME_PRIMARY }}
                >
                  <ShoppingCart size={34} strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight uppercase">Sales orders</h1>
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] mt-2">
                    Mobile workflow · Draft → Delivered → Invoice
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => load()}
                className="shrink-0 self-start p-3 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Status filters — ProductManagement-style tab bar */}
          <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setFilter(c.key)}
                className={clsx(
                  'shrink-0 px-5 sm:px-7 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all',
                  filter === c.key
                    ? 'text-white shadow-lg shadow-gray-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                )}
                style={filter === c.key ? { backgroundColor: THEME_PRIMARY } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>

          <main className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 text-red-800 text-sm font-bold px-4 py-3 border border-red-100">
                {error}
              </div>
            )}

            {loading && orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3 rounded-2xl bg-white border border-gray-100">
                <Loader2 className="animate-spin text-[#800020]" size={36} />
                <span className="text-sm font-bold">Loading orders…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
                <p className="text-gray-800 font-black uppercase tracking-wide text-sm">No orders in this view</p>
                <p className="text-sm text-gray-500 font-semibold mt-2">Create a draft to get started.</p>
              </div>
            ) : (
              filtered.map((o) => (
                <article
                  key={o.id}
                  className={clsx(
                    'bg-white rounded-xl border border-gray-200 shadow-sm border-l-4 pl-5 pr-4 py-5 space-y-4',
                    STATUS_LEFT_BORDER[o.status] || 'border-l-gray-400'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono font-black text-gray-900 text-lg tracking-tight">{o.so_number}</p>
                      <p className="text-base md:text-lg font-black text-gray-900 leading-snug">
                        {o.customer_name || `Customer #${o.customer_id}`}
                      </p>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                        {o.salesman_name || 'No salesman'}
                      </p>
                      <p className="text-xs font-semibold text-gray-600 pt-1">{formatOrderDate(o.order_date)}</p>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 shrink-0">
                      <span
                        className={clsx(
                          'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest',
                          STATUS_STYLES[o.status] || 'bg-gray-100 text-gray-800 border border-gray-200'
                        )}
                      >
                        {o.status}
                      </span>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total</p>
                        <p className="text-xl font-black text-gray-900 tabular-nums">{formatMoney(o.total)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => navigate(`/sales/orders/${o.id}`)}
                      className="flex-1 min-h-[48px] rounded-lg border-2 font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 transition-colors hover:brightness-95 bg-white"
                      style={{ borderColor: THEME_PRIMARY, color: THEME_PRIMARY }}
                    >
                      <Eye size={20} /> View
                    </button>
                    {o.status === 'delivered' && o.pod_confirmed && o.signature_confirmed && !o.linked_invoice_number && (
                      <button
                        type="button"
                        disabled={convertingId === o.id}
                        onClick={() => handleConvert(o)}
                        className="flex-1 min-h-[48px] rounded-lg bg-violet-700 text-white font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-violet-800 disabled:opacity-50 shadow-sm"
                      >
                        {convertingId === o.id ? <Loader2 className="animate-spin" size={20} /> : <FileInput size={20} />}
                        Convert to invoice
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </main>

          <div className="hidden md:block pt-2">
            <button
              type="button"
              onClick={() => navigate('/sales/orders/new')}
              className="w-full min-h-[52px] rounded-xl text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-transform hover:brightness-110"
              style={{ backgroundColor: THEME_PRIMARY }}
            >
              <Plus size={22} strokeWidth={2.5} /> New sales order
            </button>
          </div>
        </div>

        {insightsPanel}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 md:hidden">
        <button
          type="button"
          onClick={() => navigate('/sales/orders/new')}
          className="w-full min-h-[52px] rounded-xl text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-[0.99] transition-transform hover:brightness-110"
          style={{ backgroundColor: THEME_PRIMARY }}
        >
          <Plus size={22} strokeWidth={2.5} /> New sales order
        </button>
      </div>
    </div>
  );
}
