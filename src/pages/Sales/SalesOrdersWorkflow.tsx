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

const THEME_PRIMARY = '#4F8EF7';

const STATUS_STYLES: Record<SalesOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-800 border border-gray-200',
  confirmed: 'bg-blue-50 text-blue-900 border border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-900 border border-emerald-200',
  invoiced: 'bg-violet-50 text-violet-900 border border-violet-200',
  cancelled: 'bg-red-50 text-red-900 border border-red-200',
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
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderTop: `2px solid ${borderColor}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 16 }}>
        <h3
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            margin: 0,
            marginBottom: 12,
          }}
        >
          {title}
        </h3>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [salesmanFilter, setSalesmanFilter] = useState<string>('all');

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

  const salesmanOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      const n = (o.salesman_name || '').trim();
      if (n) set.add(n);
    }
    return [...set].sort();
  }, [orders]);

  const displayedOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return filtered.filter((o) => {
      if (salesmanFilter !== 'all' && (o.salesman_name || '').trim() !== salesmanFilter) return false;
      if (!q) return true;
      const hay = [
        o.customer_name || '',
        o.so_number || '',
        o.salesman_name || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [filtered, searchTerm, salesmanFilter]);

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
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
            {[
              { label: 'Draft', dot: '#9CA3AF', value: insights.pipeline.draft },
              { label: 'Confirmed', dot: '#4F8EF7', value: insights.pipeline.confirmed },
              { label: 'Delivered', dot: '#22C55E', value: insights.pipeline.delivered },
              { label: 'Invoiced', dot: '#7C3AED', value: insights.pipeline.invoiced },
            ].map((row) => (
              <li
                key={row.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--color-text-secondary)',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: row.dot,
                      flexShrink: 0,
                    }}
                  />
                  {row.label}
                </span>
                <span
                  style={{
                    color: 'var(--color-text-primary)',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </InsightSection>

        <InsightSection title="Today's revenue" borderColor="#22C55E">
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 12,
              }}
            >
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Invoiced today</dt>
              <dd
                style={{
                  margin: 0,
                  color: 'var(--color-text-success)',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatMoney(insights.invoicedTodayTotal)}
              </dd>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 12,
              }}
            >
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>Orders today</dt>
              <dd
                style={{
                  margin: 0,
                  color: 'var(--color-text-primary)',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {insights.ordersTodayCount}
              </dd>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                fontSize: 12,
                paddingTop: 8,
                borderTop: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              <dt style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>This week (invoiced)</dt>
              <dd
                style={{
                  margin: 0,
                  color: 'var(--color-text-success)',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatMoney(insights.weekRevenue)}
              </dd>
            </div>
          </dl>
        </InsightSection>

        <InsightSection title="Top selling products" borderColor="#6b7280">
          {insights.topProducts.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
              No invoiced line items in loaded orders.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {insights.topProducts.map((p) => (
                <li key={p.name}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--color-text-secondary)',
                        fontVariantNumeric: 'tabular-nums',
                        flexShrink: 0,
                      }}
                    >
                      {p.cases} cases
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: 'var(--color-background-secondary)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 999,
                        width: `${Math.min(100, (p.cases / insights.maxCases) * 100)}%`,
                        background: THEME_PRIMARY,
                        transition: 'width .3s ease',
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
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
              No salesman assigned on loaded orders.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.salesmen.map((s, i) => {
                const isGold = i === 0;
                return (
                  <li key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0,
                        background: isGold ? 'rgba(245,158,11,.15)' : 'var(--color-background-secondary)',
                        color: isGold ? '#F59E0B' : 'var(--color-text-secondary)',
                        border: isGold
                          ? '0.5px solid rgba(245,158,11,.35)'
                          : '0.5px solid var(--color-border-tertiary)',
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          margin: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.name}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-success)',
                          margin: 0,
                          fontVariantNumeric: 'tabular-nums',
                          fontWeight: 500,
                        }}
                      >
                        {formatMoney(s.total)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </InsightSection>
      </div>
    </aside>
  );

  return (
    <div
      className="min-h-screen pb-32 md:pb-10"
      style={{ background: 'var(--color-background-secondary)' }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 flex flex-col lg:flex-row lg:items-start lg:gap-8">
        <div className="w-full lg:w-[65%] lg:min-w-0 space-y-6">
          {/* Page header — Soltol dark nav */}
          <div
            style={{
              background: 'var(--color-background-primary)',
              borderBottom: '0.5px solid var(--color-border-tertiary)',
              padding: '13px 18px',
              borderRadius: 12,
            }}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(74,143,245,.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ShoppingCart size={18} style={{ color: THEME_PRIMARY }} />
              </div>
              <div className="min-w-0">
                <h1
                  style={{
                    fontSize: 17,
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  Sales orders
                </h1>
                <p
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    margin: 0,
                    marginTop: 2,
                  }}
                >
                  Mobile workflow · Draft → Delivered → Invoice
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => load()}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'transparent',
                border: '0.5px solid var(--color-border-tertiary)',
                color: 'var(--color-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Refresh"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Search + salesman filter bar */}
          <div
            style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 10,
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search customer, order # or salesman..."
              style={{
                flex: '1 1 220px',
                minWidth: 200,
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <select
              value={salesmanFilter}
              onChange={(e) => setSalesmanFilter(e.target.value)}
              style={{
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
                color: 'var(--color-text-primary)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all">All salesmen</option>
              {salesmanOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {(searchTerm || salesmanFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSalesmanFilter('all');
                }}
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 11,
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Status filters — Soltol tab bar */}
          <div
            style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 10,
              padding: 6,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
            }}
          >
            {chips.map((c) => {
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  style={{
                    padding: '7px 14px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: active ? 'var(--color-background-info)' : 'transparent',
                    color: active ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                    border: active
                      ? '0.5px solid var(--color-border-info)'
                      : '0.5px solid transparent',
                    transition: 'all .15s ease',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <main className="space-y-4">
            {error && (
              <div
                style={{
                  background: 'var(--color-background-danger)',
                  border: '0.5px solid var(--color-border-danger)',
                  color: 'var(--color-text-danger)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            {loading && orders.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '60px 16px',
                  background: 'var(--color-background-primary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 12,
                  color: 'var(--color-text-secondary)',
                }}
              >
                <Loader2 className="animate-spin" size={32} style={{ color: THEME_PRIMARY }} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>Loading orders…</span>
              </div>
            ) : displayedOrders.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '50px 16px',
                  background: 'var(--color-background-primary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 12,
                }}
              >
                <p style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 13, margin: 0 }}>
                  No orders in this view
                </p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 6 }}>
                  Create a draft to get started.
                </p>
              </div>
            ) : (
              displayedOrders.map((o) => {
                const totalNum = Number(o.total) || 0;
                const isZero = totalNum <= 0;
                const isPaid = Boolean((o as unknown as { paid?: boolean }).paid)
                  || String((o as unknown as { payment_status?: string }).payment_status || '').toLowerCase() === 'paid';
                return (
                  <article
                    key={o.id}
                    style={{
                      background: 'var(--color-background-primary)',
                      border: isZero
                        ? '0.5px solid #F59E0B'
                        : '0.5px solid var(--color-border-tertiary)',
                      borderRadius: 12,
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <p
                          style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                            fontSize: 13,
                            fontWeight: 600,
                            color: THEME_PRIMARY,
                            margin: 0,
                          }}
                        >
                          {o.so_number}
                        </p>
                        <p
                          style={{
                            fontSize: 14,
                            fontWeight: 500,
                            color: 'var(--color-text-primary)',
                            margin: 0,
                            lineHeight: 1.3,
                          }}
                        >
                          {o.customer_name || `Customer #${o.customer_id}`}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-secondary)',
                            margin: 0,
                          }}
                        >
                          {o.salesman_name || 'No salesman'}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            margin: 0,
                            marginTop: 2,
                          }}
                        >
                          {formatOrderDate(o.order_date)}
                        </p>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <span
                            className={clsx(
                              'px-2.5 py-1 rounded-full text-[10px] font-medium',
                              STATUS_STYLES[o.status] || 'bg-gray-100 text-gray-800 border border-gray-200'
                            )}
                          >
                            {o.status}
                          </span>
                          {o.status === 'invoiced' && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 500,
                                padding: '3px 8px',
                                borderRadius: 999,
                                background: isPaid
                                  ? 'var(--color-background-success)'
                                  : 'var(--color-background-warning)',
                                color: isPaid
                                  ? 'var(--color-text-success)'
                                  : 'var(--color-text-warning)',
                                border: isPaid
                                  ? '0.5px solid var(--color-border-success)'
                                  : '0.5px solid var(--color-border-warning)',
                              }}
                            >
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p
                            style={{
                              fontSize: 10,
                              color: 'var(--color-text-tertiary)',
                              margin: 0,
                            }}
                          >
                            Total
                          </p>
                          <p
                            style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: isZero ? '#F59E0B' : 'var(--color-text-primary)',
                              margin: 0,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatMoney(totalNum)}
                          </p>
                          {isZero && (
                            <p
                              style={{
                                fontSize: 10,
                                color: '#F59E0B',
                                margin: 0,
                                marginTop: 2,
                              }}
                            >
                              ⚠ Zero total — review order
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {o.linked_invoice_number && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-secondary)',
                          paddingTop: 8,
                          borderTop: '0.5px solid var(--color-border-tertiary)',
                        }}
                      >
                        Linked invoice:{' '}
                        <span
                          style={{
                            color: THEME_PRIMARY,
                            fontWeight: 500,
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          }}
                        >
                          {o.linked_invoice_number}
                        </span>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 8,
                        paddingTop: 8,
                        borderTop: '0.5px solid var(--color-border-tertiary)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/sales/orders/${o.id}`)}
                        style={{
                          flex: 1,
                          minWidth: 120,
                          padding: '9px 14px',
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: 8,
                          background: THEME_PRIMARY,
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <Eye size={14} /> View
                      </button>
                      {o.status === 'delivered' && o.pod_confirmed && o.signature_confirmed && !o.linked_invoice_number && (
                        <button
                          type="button"
                          disabled={convertingId === o.id}
                          onClick={() => handleConvert(o)}
                          style={{
                            flex: 1,
                            minWidth: 120,
                            padding: '9px 14px',
                            fontSize: 12,
                            fontWeight: 500,
                            borderRadius: 8,
                            background: '#7C3AED',
                            color: '#fff',
                            border: 'none',
                            cursor: convertingId === o.id ? 'not-allowed' : 'pointer',
                            opacity: convertingId === o.id ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          {convertingId === o.id ? <Loader2 className="animate-spin" size={14} /> : <FileInput size={14} />}
                          Convert to invoice
                        </button>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </main>

          <div className="hidden md:block pt-2">
            <button
              type="button"
              onClick={() => navigate('/sales/orders/new')}
              style={{
                width: '100%',
                padding: '11px 18px',
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 10,
                background: THEME_PRIMARY,
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Plus size={18} strokeWidth={2.2} /> New sales order
            </button>
          </div>
        </div>

        {insightsPanel}
      </div>

      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 14,
          background: 'var(--color-background-primary)',
          borderTop: '0.5px solid var(--color-border-tertiary)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/sales/orders/new')}
          style={{
            width: '100%',
            padding: '12px 18px',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 10,
            background: THEME_PRIMARY,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Plus size={18} strokeWidth={2.2} /> New sales order
        </button>
      </div>
    </div>
  );
}
