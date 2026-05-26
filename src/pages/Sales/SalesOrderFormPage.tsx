import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Trash2, Loader2, ShoppingCart, Copy, Plus, UserPlus, X } from 'lucide-react';
import { getCustomers, getProducts, getCustomerInvoices, type Customer, type Product, type Invoice } from '../../services/api';
import { getCustomer, getCustomerPayments, type Payment } from '../../services/customerService';
import { createSalesOrder, getSalesOrders, type SalesOrderItem, type SalesOrderStatus, type SalesOrder } from '../../services/salesService';
// ITEM 12 — Salesman dropdown + inline quick-add (mirror of ITEM 7A on
// the Invoice form). Pulls from localStorage-backed getSalesmen so newly-
// added entries appear without a page reload.
import { getSalesmen, addSalesman, type Salesman } from '../../constants/data';
import SearchableSelect from '../../components/common/SearchableSelect';
// ITEM 16 — Escape closes the New Salesman inline modal.
import { useEscape } from '../../hooks/useEscape';

const THEME_PRIMARY = '#4F8EF7';

interface CartLine extends SalesOrderItem {
  key: string;
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPanelDate(raw: string) {
  try {
    const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return raw;
  }
}

function countOverdueInvoices(invoices: Invoice[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return invoices.filter((inv) => {
    if (inv.status === 'Overdue') return true;
    if (inv.status === 'Paid') return false;
    const due = new Date(inv.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    due.setHours(0, 0, 0, 0);
    const bal = inv.remaining_balance ?? inv.grandTotal;
    return due < today && bal > 0;
  }).length;
}

function orderStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === 'draft') return 'Draft';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'delivered') return 'Delivered';
  if (s === 'invoiced') return 'Invoiced';
  if (s === 'cancelled') return 'Cancelled';
  return status;
}

function orderStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'draft') return 'bg-gray-100 text-gray-800 border border-gray-200';
  if (s === 'confirmed') return 'bg-blue-50 text-blue-900 border border-blue-200';
  if (s === 'delivered') return 'bg-emerald-50 text-emerald-900 border border-emerald-200';
  if (s === 'invoiced') return 'bg-violet-50 text-violet-900 border border-violet-200';
  if (s === 'cancelled') return 'bg-red-50 text-red-900 border border-red-200';
  return 'bg-gray-100 text-gray-800 border border-gray-200';
}

type SmartSuggestion = {
  product_id: string;
  product_name: string;
  usualQty: number;
  unit_price_hint: number;
};

function computeSmartSuggestions(orders: SalesOrder[]): SmartSuggestion[] {
  type Agg = { product_name: string; qtys: number[]; unit_prices: number[] };
  const map = new Map<string, Agg>();
  for (const ord of orders) {
    for (const it of ord.items || []) {
      const pid = String(it.product_id ?? '').trim();
      if (!pid) continue;
      if (!map.has(pid)) {
        map.set(pid, { product_name: it.product_name || 'Product', qtys: [], unit_prices: [] });
      }
      const a = map.get(pid)!;
      a.qtys.push(Number(it.quantity) || 0);
      a.unit_prices.push(Number(it.unit_price) || 0);
      if (it.product_name) a.product_name = it.product_name;
    }
  }
  const scored = [...map.entries()].map(([product_id, a]) => {
    const orderTouches = a.qtys.length;
    const usualQty = Math.max(1, Math.round(a.qtys.reduce((s, q) => s + q, 0) / a.qtys.length));
    const unit_price_hint = a.unit_prices[a.unit_prices.length - 1] || 0;
    return { product_id, product_name: a.product_name, usualQty, unit_price_hint, orderTouches };
  });
  scored.sort((x, y) => y.orderTouches - x.orderTouches);
  return scored.slice(0, 3).map(({ orderTouches: _o, ...rest }) => rest);
}

function PanelSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-3 w-32 bg-gray-200 rounded" />
      <div className="space-y-2">
        <div className="h-8 bg-gray-100 rounded-lg" />
        <div className="h-8 bg-gray-100 rounded-lg" />
        <div className="h-8 bg-gray-100 rounded-lg w-2/3" />
      </div>
      <div className="h-3 w-40 bg-gray-200 rounded" />
      <div className="space-y-3">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-20 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-3 w-44 bg-gray-200 rounded" />
      <div className="h-16 bg-gray-100 rounded-xl" />
    </div>
  );
}

export default function SalesOrderFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const preCustomerId = (location.state as { customerId?: string } | null)?.customerId;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // TC-35 — track WHICH status the user clicked so only that button
  // shows the spinner.  Without this, both buttons spinner-render
  // simultaneously off the shared `submitting` flag.
  const [submittingStatus, setSubmittingStatus] = useState<SalesOrderStatus | null>(null);

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Credit' | 'Cheque'>('Cash');
  const [paymentDueDays, setPaymentDueDays] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  // ITEM 12 — salesman dropdown state + quick-add. Save still goes out
  // as `salesman_name`, resolved from the selected id at submit time.
  const [salesmen, setSalesmen] = useState<Salesman[]>(() => getSalesmen());
  const [salesmanId, setSalesmanId] = useState('');
  const [showNewSalesman, setShowNewSalesman] = useState(false);
  const [newSalesmanName, setNewSalesmanName] = useState('');
  const [newSalesmanPhone, setNewSalesmanPhone] = useState('');
  // ITEM 16 — Escape closes the New Salesman inline modal.
  useEscape(() => setShowNewSalesman(false), showNewSalesman);

  const [panelLoading, setPanelLoading] = useState(false);
  const [panelCustomer, setPanelCustomer] = useState<Customer | null>(null);
  const [panelOrders, setPanelOrders] = useState<SalesOrder[]>([]);
  const [panelInvoices, setPanelInvoices] = useState<Invoice[]>([]);
  const [panelPayments, setPanelPayments] = useState<Payment[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, p] = await Promise.all([getCustomers(), getProducts()]);
        if (!cancelled) {
          setCustomers(c);
          setProducts(p);
          if (preCustomerId) {
            const found = c.find((x) => String(x.id) === String(preCustomerId));
            if (found) setSelectedCustomer(found);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preCustomerId]);

  useEffect(() => {
    if (!selectedCustomer) {
      setPanelCustomer(null);
      setPanelOrders([]);
      setPanelInvoices([]);
      setPanelPayments([]);
      setPanelLoading(false);
      return;
    }

    const cid = String(selectedCustomer.id);
    let cancelled = false;

    (async () => {
      setPanelLoading(true);
      try {
        const [detail, allSalesOrders, invoices, payments] = await Promise.all([
          getCustomer(cid),
          getSalesOrders(),
          getCustomerInvoices(cid),
          getCustomerPayments(cid),
        ]);
        if (cancelled) return;
        setPanelCustomer(detail);
        setPanelOrders(allSalesOrders.filter((o) => String(o.customer_id) === cid));
        setPanelInvoices(invoices);
        setPanelPayments(payments);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPanelCustomer(selectedCustomer);
          setPanelOrders([]);
          setPanelInvoices([]);
          setPanelPayments([]);
        }
      } finally {
        if (!cancelled) setPanelLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCustomer]);

  const panelStats = useMemo(() => {
    const outstanding = panelCustomer?.balance ?? 0;
    const creditLimit = panelCustomer?.credit_limit ?? 0;
    const overdueCount = countOverdueInvoices(panelInvoices);

    const sortedOrders = [...panelOrders].sort((a, b) => {
      const ta = new Date(a.order_date.includes('T') ? a.order_date : `${a.order_date}T12:00:00`).getTime();
      const tb = new Date(b.order_date.includes('T') ? b.order_date : `${b.order_date}T12:00:00`).getTime();
      return tb - ta;
    });
    const lastOrder = sortedOrders[0];
    const lastOrderDate = lastOrder ? lastOrder.order_date : '';

    const sortedPay = [...panelPayments].sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    const lastPay = sortedPay[0];
    const lastPaymentDate = lastPay?.payment_date ?? '';

    const recentThree = sortedOrders.slice(0, 3);
    const suggestions = computeSmartSuggestions(panelOrders);

    return {
      outstanding,
      creditLimit,
      overdueCount,
      lastOrderDate,
      lastPaymentDate,
      recentThree,
      suggestions,
      balanceAlert: outstanding > 0 || overdueCount > 0,
    };
  }, [panelCustomer, panelInvoices, panelOrders, panelPayments]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          String(c.id).includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [customers, customerQuery]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 15);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          String(p.id).includes(q)
      )
      .slice(0, 20);
  }, [products, productQuery]);

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const tax = 0;
  const total = subtotal + tax;

  function addProduct(p: Product) {
    const unit = Number(p.unit_price) || 0;
    setLines((prev) => [
      ...prev,
      {
        key: `${p.id}-${Date.now()}`,
        product_id: String(p.id),
        product_name: p.name,
        quantity: 1,
        unit_price: unit,
        total: unit,
      },
    ]);
    setProductQuery('');
  }

  const addProductWithQty = useCallback((p: Product, qty: number) => {
    const unit = Number(p.unit_price) || 0;
    const q = Math.max(1, Math.floor(qty));
    setLines((prev) => [
      ...prev,
      {
        key: `${p.id}-${Date.now()}`,
        product_id: String(p.id),
        product_name: p.name,
        quantity: q,
        unit_price: unit,
        total: unit * q,
      },
    ]);
  }, []);

  function updateQty(key: string, delta: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const q = Math.max(1, l.quantity + delta);
        const t = q * l.unit_price;
        return { ...l, quantity: q, total: t };
      })
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function handleReorder(order: SalesOrder) {
    setLines((prev) => {
      const additions: CartLine[] = (order.items || []).map((it, i) => ({
        key: `reorder-${order.id}-${it.product_id}-${Date.now()}-${i}`,
        product_id: String(it.product_id),
        product_name: it.product_name,
        quantity: Math.max(1, Number(it.quantity) || 1),
        unit_price: Number(it.unit_price) || 0,
        total: Number(it.total) || Number(it.quantity) * Number(it.unit_price) || 0,
      }));
      return [...prev, ...additions];
    });
  }

  function handleAddSuggestion(s: SmartSuggestion) {
    const p = products.find((pr) => String(pr.id) === String(s.product_id));
    if (p) {
      addProductWithQty(p, s.usualQty);
      return;
    }
    const unit = s.unit_price_hint || 0;
    setLines((prev) => [
      ...prev,
      {
        key: `sugg-${s.product_id}-${Date.now()}`,
        product_id: String(s.product_id),
        product_name: s.product_name,
        quantity: s.usualQty,
        unit_price: unit,
        total: unit * s.usualQty,
      },
    ]);
  }

  async function submit(status: SalesOrderStatus) {
    if (!selectedCustomer) {
      alert('Select a customer');
      return;
    }
    if (lines.length === 0) {
      alert('Add at least one product');
      return;
    }

    setSubmitting(true);
    setSubmittingStatus(status);
    try {
      const items: SalesOrderItem[] = lines.map(({ key: _k, ...rest }) => rest);
      const dueDays = paymentMethod === 'Cash' ? 0 : paymentDueDays;
      await createSalesOrder({
        customer_id: String(selectedCustomer.id),
        order_date: new Date().toISOString().split('T')[0],
        items: items as unknown as Array<Record<string, unknown>>,
        notes,
        status,
        // ITEM 12 — resolve the selected salesman id → name for the API payload.
        salesman_name: salesmen.find(s => s.id === salesmanId)?.name || undefined,
        van_id: null,
        payment_status: 'unpaid',
        subtotal,
        tax,
        total,
        payment_method: paymentMethod,
        payment_due_days: dueDays,
        payment_notes: paymentNotes.trim() || undefined,
      });
      navigate('/sales/orders');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not save order');
    } finally {
      setSubmitting(false);
      setSubmittingStatus(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin" style={{ color: THEME_PRIMARY }} size={40} />
      </div>
    );
  }

  const sectionCard = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-7 space-y-4';

  const customerInsightPanel = (
    <aside className="w-full lg:w-[40%] lg:shrink-0">
      <div
        className="lg:sticky lg:top-4 rounded-2xl shadow-sm p-5 md:p-6 space-y-8"
        style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        {!selectedCustomer ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm font-black text-gray-400  leading-relaxed">
              Select a customer to see their history and smart suggestions
            </p>
          </div>
        ) : panelLoading ? (
          <PanelSkeleton />
        ) : (
          <>
            <section>
              <h3 className="text-[10px] font-black text-gray-400  mb-4">Customer balance</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2 items-baseline">
                  <dt className="font-bold text-gray-500">Outstanding</dt>
                  <dd
                    className={`font-black tabular-nums ${panelStats.balanceAlert ? 'text-red-600' : 'text-gray-900'}`}
                  >
                    {formatMoney(panelStats.outstanding)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 items-baseline">
                  <dt className="font-bold text-gray-500">Credit limit</dt>
                  <dd className="font-black text-gray-900 tabular-nums">{formatMoney(panelStats.creditLimit)}</dd>
                </div>
                <div className="flex justify-between gap-2 items-baseline">
                  <dt className="font-bold text-gray-500">Last order</dt>
                  <dd className="font-bold text-gray-800">
                    {panelStats.lastOrderDate ? formatPanelDate(panelStats.lastOrderDate) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 items-baseline">
                  <dt className="font-bold text-gray-500">Last payment</dt>
                  <dd className="font-bold text-gray-800">
                    {panelStats.lastPaymentDate ? formatPanelDate(panelStats.lastPaymentDate) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 items-baseline">
                  <dt className="font-bold text-gray-500">Overdue invoices</dt>
                  <dd
                    className={`font-black tabular-nums ${panelStats.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}`}
                  >
                    {panelStats.overdueCount}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="text-[10px] font-black text-gray-400  mb-4">Recent orders</h3>
              {panelStats.recentThree.length === 0 ? (
                <p className="text-sm font-semibold text-gray-500">No prior orders yet.</p>
              ) : (
                <ul className="space-y-4">
                  {panelStats.recentThree.map((o) => (
                    <li
                      key={o.id}
                      className="rounded-xl border border-gray-100 p-4 space-y-2"
                      style={{ background: 'var(--color-background-secondary)' }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-mono font-black text-gray-900 text-sm">{o.so_number}</p>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black  ${orderStatusBadgeClass(o.status)}`}
                        >
                          {orderStatusLabel(o.status)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-500">{formatPanelDate(o.order_date)}</p>
                      <p className="text-base font-black text-gray-900 tabular-nums">{formatMoney(o.total)}</p>
                      <button
                        type="button"
                        onClick={() => handleReorder(o)}
                        className="w-full min-h-[40px] rounded-lg border-2 text-xs font-black  flex items-center justify-center gap-1.5 hover:bg-white transition-colors"
                        style={{ borderColor: THEME_PRIMARY, color: THEME_PRIMARY }}
                      >
                        <Copy size={14} />
                        Reorder
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-[10px] font-black text-gray-400  mb-4">Smart suggestions</h3>
              {panelStats.suggestions.length === 0 ? (
                <p className="text-sm font-semibold text-gray-500">Not enough history to suggest products.</p>
              ) : (
                <ul className="space-y-3">
                  {panelStats.suggestions.map((s) => (
                    <li
                      key={s.product_id}
                      className="rounded-xl border border-gray-100 p-3 flex flex-col gap-2 bg-white"
                    >
                      <p className="font-bold text-gray-900 text-sm leading-snug">{s.product_name}</p>
                      <p className="text-xs font-bold text-gray-500">
                        Usual qty: <span className="text-gray-800">{s.usualQty}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAddSuggestion(s)}
                        className="min-h-[38px] rounded-lg text-white text-xs font-black  flex items-center justify-center gap-1 shadow-sm hover:brightness-110"
                        style={{ backgroundColor: THEME_PRIMARY }}
                      >
                        <Plus size={16} strokeWidth={2.5} />
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );

  const formColumn = (
    <div className="w-full lg:w-[60%] lg:max-w-none space-y-8">
      {/* Page header — Soltol dark nav style */}
      <div style={{
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          padding: '13px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
      }}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/sales/orders')}
            aria-label="Back"
            style={{
                background: 'transparent',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 8,
                padding: '5px 8px',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                display: 'flex', alignItems: 'center',
                fontFamily: 'inherit',
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: 'rgba(74,143,245,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
          }}>
            <ShoppingCart size={18} style={{ color: '#4F8EF7' }} />
          </div>
          <div className="min-w-0">
            <h1 style={{
                fontSize: 17, fontWeight: 500,
                color: 'var(--color-text-primary)',
                margin: 0,
            }}>
              New sales order
            </h1>
            <p style={{
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                marginTop: 2,
            }}>
              Draft or confirm — mobile-friendly layout
            </p>
          </div>
        </div>
      </div>

      <div className={`${sectionCard}`}>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-black text-gray-500 ">Salesman</label>
          {/* ITEM 12 — Quick-add salesman, mirrors the Invoice form pattern. */}
          <button
            type="button"
            onClick={() => setShowNewSalesman(true)}
            className="flex items-center gap-1 text-xs font-black text-orange-600 hover:text-orange-800 transition-all"
          >
            <UserPlus size={12} /> New Salesman
          </button>
        </div>
        <SearchableSelect
          options={salesmen}
          value={salesmanId}
          onChange={(val) => setSalesmanId(val)}
          placeholder="Search and select salesman..."
          displayKey="name"
        />
        {showNewSalesman && (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-orange-700 ">New Salesman</p>
              <button type="button" onClick={() => setShowNewSalesman(false)} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
            </div>
            <input
              type="text"
              placeholder="Salesman Name *"
              value={newSalesmanName}
              onChange={(e) => setNewSalesmanName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <input
              type="text"
              placeholder="Phone (optional)"
              value={newSalesmanPhone}
              onChange={(e) => setNewSalesmanPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={() => {
                if (!newSalesmanName.trim()) return;
                try {
                  const created = addSalesman({ name: newSalesmanName, phone: newSalesmanPhone });
                  setSalesmen(prev => [...prev, created]);
                  setSalesmanId(created.id);
                  setShowNewSalesman(false);
                  setNewSalesmanName('');
                  setNewSalesmanPhone('');
                } catch {
                  alert('Failed to create salesman.');
                }
              }}
              disabled={!newSalesmanName.trim()}
              className="w-full py-2 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-all"
            >
              Create &amp; Select Salesman
            </button>
          </div>
        )}
      </div>

      <div className={`${sectionCard}`}>
        <label className="block text-xs font-black text-gray-500 ">Customer</label>
        {selectedCustomer ? (
          <div
            className="rounded-xl border-2 bg-gray-50/80 p-4 flex justify-between items-center gap-2"
            style={{ borderColor: THEME_PRIMARY }}
          >
            <div className="min-w-0">
              <p className="font-black text-gray-900 truncate text-base">{selectedCustomer.name}</p>
              <p className="text-xs font-bold text-gray-500 mt-0.5">ID {selectedCustomer.id}</p>
            </div>
            <button
              type="button"
              className="text-sm font-black shrink-0 "
              style={{ color: THEME_PRIMARY }}
              onClick={() => setSelectedCustomer(null)}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative z-30">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              <input
                type="search"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search name, phone, ID…"
                className="w-full min-h-[50px] pl-4 pr-11 rounded-xl border border-gray-200 text-sm font-semibold bg-white shadow-inner focus:ring-2 focus:ring-[#4F8EF7]/25 focus:border-[#4F8EF7] outline-none transition-shadow"
              />
            </div>
            <ul className="mt-2 rounded-xl border border-gray-100 bg-white shadow-md max-h-48 overflow-y-auto overscroll-y-contain divide-y divide-gray-100">
              {filteredCustomers.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 min-h-[48px] hover:bg-gray-50 text-sm transition-colors"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerQuery('');
                    }}
                  >
                    <span className="font-bold text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-500 block font-semibold">#{c.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* FIX 5 — Credit limit warning banner (display-only IIFE, reads
          existing selectedCustomer + panelStats + lines state). No new
          state, no new API calls, no submit-blocking. */}
      {selectedCustomer && (() => {
        const outstanding = Number((selectedCustomer as any).balance ?? panelStats?.outstanding ?? 0);
        const creditLimit = Number((selectedCustomer as any).credit_limit ?? panelStats?.creditLimit ?? 0);
        const orderTotal = lines.reduce((s, l) => s + l.total, 0);
        const newTotal = outstanding + orderTotal;
        const usedPct = creditLimit > 0
          ? Math.min(100, Math.round((newTotal / creditLimit) * 100))
          : 0;

        if (outstanding === 0 && creditLimit === 0 && orderTotal === 0) return null;

        const isDanger = creditLimit > 0 && usedPct > 100;
        const isWarning = creditLimit > 0 && usedPct > 80;

        return (
          <div style={{
            margin: '8px 0 12px',
            padding: '8px 12px',
            borderRadius: 8,
            border: `1px solid ${isDanger ? 'rgba(239,68,68,.3)' : isWarning ? 'rgba(245,158,11,.3)' : 'rgba(74,143,245,.2)'}`,
            background: isDanger ? 'rgba(239,68,68,.07)' : isWarning ? 'rgba(245,158,11,.07)' : 'rgba(74,143,245,.07)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 11,
            color: isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#4F8EF7',
          }}>
            <span style={{ flexShrink: 0 }}>
              {isDanger ? '🚨' : isWarning ? '⚠️' : 'ℹ️'}
            </span>
            <div>
              <strong>
                {isDanger ? 'Over credit limit: '
                 : isWarning ? 'Credit warning: '
                 : 'Credit notice: '}
              </strong>
              {selectedCustomer.name} has ${outstanding.toLocaleString()} outstanding.
              {creditLimit > 0 && orderTotal > 0
                ? ` This order adds $${orderTotal.toFixed(2)} → new total $${newTotal.toFixed(2)} (${usedPct}% of $${creditLimit.toLocaleString()} limit).`
                : creditLimit > 0
                  ? ` Credit limit: $${creditLimit.toLocaleString()}.`
                  : ' No credit limit set.'}
            </div>
          </div>
        );
      })()}

      <div className={`${sectionCard} relative z-20`}>
        <label className="block text-xs font-black text-gray-500 ">Add products</label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
          <input
            type="search"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            placeholder="Search product or SKU…"
            className="w-full min-h-[50px] pl-4 pr-11 rounded-xl border border-gray-200 text-sm font-semibold bg-white shadow-inner focus:ring-2 focus:ring-[#4F8EF7]/25 focus:border-[#4F8EF7] outline-none transition-shadow"
          />
        </div>
        {productQuery.trim() ? (
          <ul className="rounded-xl border border-gray-100 bg-white shadow-md max-h-44 overflow-y-auto overscroll-y-contain divide-y divide-gray-100">
            {filteredProducts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 min-h-[48px] hover:bg-gray-50 flex justify-between gap-2 text-sm transition-colors"
                  onClick={() => addProduct(p)}
                >
                  <span className="font-bold text-gray-900 truncate">{p.name}</span>
                  <span className="font-mono text-gray-700 shrink-0 font-semibold">{formatMoney(p.unit_price)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={sectionCard}>
        <h2 className="text-xs font-black text-gray-500 ">Line items</h2>
        {lines.length === 0 ? (
          <p
            className="text-sm text-gray-500 py-10 text-center border-2 border-dashed border-gray-200 rounded-xl font-semibold"
            style={{ background: 'var(--color-background-secondary)' }}
          >
            No lines yet — search and select a product above.
          </p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="rounded-xl border border-gray-100 p-4 flex flex-col gap-3 bg-white shadow-sm"
              >
                <div className="flex justify-between gap-2 items-start">
                  <p className="font-black text-gray-900 leading-snug text-sm">{line.product_name}</p>
                  <button
                    type="button"
                    className="p-2 text-red-700 hover:bg-red-50 rounded-lg shrink-0 transition-colors"
                    onClick={() => removeLine(line.key)}
                    aria-label="Remove"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="w-11 h-11 rounded-xl bg-white border-2 border-gray-200 font-black text-lg flex items-center justify-center hover:border-gray-300 hover:bg-gray-50 transition-colors"
                      onClick={() => updateQty(line.key, -1)}
                    >
                      −
                    </button>
                    <span className="text-base font-black w-9 text-center tabular-nums text-gray-900">{line.quantity}</span>
                    <button
                      type="button"
                      className="w-11 h-11 rounded-xl text-white font-black text-lg flex items-center justify-center shadow-sm transition-opacity hover:opacity-90"
                      style={{ backgroundColor: THEME_PRIMARY }}
                      onClick={() => updateQty(line.key, 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="text-base font-black tabular-nums text-gray-900">{formatMoney(line.total)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={sectionCard}>
        <label className="block text-xs font-black text-gray-500  mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-200 p-3 text-sm font-medium focus:ring-2 focus:ring-[#4F8EF7]/25 focus:border-[#4F8EF7] outline-none bg-white"
          placeholder="Delivery instructions, etc."
        />
      </div>

      <div
        className={`${sectionCard} border-dashed border-gray-200`}
        style={{ background: 'var(--color-background-secondary)' }}
      >
        <h2 className="text-xs font-black text-gray-500 ">Payment terms</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[10px] font-black text-gray-500  mb-1.5">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const v = e.target.value as 'Cash' | 'Credit' | 'Cheque';
                setPaymentMethod(v);
                if (v === 'Cash') setPaymentDueDays(0);
              }}
              className="w-full min-h-[48px] rounded-xl border border-gray-200 px-3 text-sm font-bold bg-white shadow-sm focus:ring-2 focus:ring-[#4F8EF7]/25 focus:border-[#4F8EF7] outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="Credit">Credit</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-500  mb-1.5">Payment due (days)</label>
            <select
              value={paymentMethod === 'Cash' ? 0 : paymentDueDays}
              disabled={paymentMethod === 'Cash'}
              onChange={(e) => setPaymentDueDays(Number(e.target.value))}
              className="w-full min-h-[48px] rounded-xl border border-gray-200 px-3 text-sm font-bold bg-white shadow-sm disabled:bg-gray-100 disabled:text-gray-500 focus:ring-2 focus:ring-[#4F8EF7]/25 focus:border-[#4F8EF7] outline-none"
            >
              {paymentMethod === 'Cash' ? (
                <option value={0}>0 (Cash)</option>
              ) : (
                <>
                  <option value={0}>0</option>
                  <option value={30}>30</option>
                  <option value={60}>60</option>
                  <option value={90}>90</option>
                </>
              )}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-500  mb-1.5">Notes for payment</label>
          <textarea
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-200 p-3 text-sm font-medium focus:ring-2 focus:ring-[#4F8EF7]/25 focus:border-[#4F8EF7] outline-none bg-white"
            placeholder="e.g. Payable to company account, cheque favouring…"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 flex justify-between items-center">
        <span className="font-black text-gray-800  text-sm">Total</span>
        <span className="text-2xl font-black tabular-nums text-gray-900">{formatMoney(total)}</span>
      </div>

      <div
        className="sticky bottom-0 z-20 -mx-1 px-1 pt-4 pb-2 mt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
        style={{
            background: 'var(--color-background-primary)',
            borderTop: '0.5px solid var(--color-border-tertiary)',
        }}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={submitting && submittingStatus !== 'draft'}
            aria-busy={submittingStatus === 'draft'}
            onClick={() => submit('draft')}
            style={{
                flex: 1,
                background: 'transparent',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: (submitting && submittingStatus !== 'draft') ? 0.5 : 1,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {submittingStatus === 'draft' ? <Loader2 className="animate-spin" size={18} /> : 'Save as draft'}
          </button>
          <button
            type="button"
            disabled={submitting && submittingStatus !== 'confirmed'}
            aria-busy={submittingStatus === 'confirmed'}
            onClick={() => submit('confirmed')}
            style={{
                flex: 1,
                background: '#4F8EF7',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: (submitting && submittingStatus !== 'confirmed') ? 0.5 : 1,
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {submittingStatus === 'confirmed' ? <Loader2 className="animate-spin mx-auto text-white" size={22} /> : 'Confirm order'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:gap-8 lg:justify-between">
        {formColumn}
        {customerInsightPanel}
      </div>
    </div>
  );
}
