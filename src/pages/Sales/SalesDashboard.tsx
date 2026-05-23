import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
// NOTE: no lucide-react — all icons are inline SVG copied verbatim from preview.html
import { getCustomers, getSalesOrders, getProducts } from '../../services/api';

// ─── Shared style tokens (mirror public/preview.html tc-sales spec) ──────
const panelStyle: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '14px',
  padding: '14px 16px',
};
const phStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
};
const ptStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: 'var(--color-redwood-text-main)',
};
const paStyle: CSSProperties = {
  fontSize: '10px',
  color: '#4F8EF7',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
};

export default function SalesDashboard() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getCustomers(),
      getSalesOrders(),
      getProducts(),
    ]).then(([custs, orders, prods]) => {
      setCustomers(custs || []);
      setSalesOrders(orders || []);
      setProducts(prods || []);
    }).catch(console.error);
  }, []);

  // ───────── Computations (pure JS, no new APIs) ─────────
  const totalCustomers = customers.length;
  const now = new Date();
  const newThisMonth = customers.filter((c: any) => {
    const created = new Date(c.createdAt || c.created_at || '');
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  // Churn = customer's most-recent order is between 60 and 365 days ago.
  // Customers with no order at all (null/invalid date) are excluded — they
  // were previously bucketed at daysSince=999 and skewed the count.
  const churnRisk = customers.filter((c: any) => {
    const lastOrder = salesOrders
      .filter((o: any) => String(o.customerId || o.customer_id) === String(c.id))
      .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
    if (!lastOrder) return false;
    const daysSince = Math.floor((Date.now() - new Date(lastOrder.createdAt || lastOrder.date).getTime()) / 86400000);
    return daysSince >= 60 && daysSince <= 365;
  }).length;

  const mtdOrders = salesOrders.filter((o: any) => {
    const d = new Date(o.createdAt || o.date || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const ordersMTD = mtdOrders.length;
  const ordersTotalValue = mtdOrders.reduce((sum: number, o: any) => sum + (Number(o.grandTotal || o.total) || 0), 0);

  const TARGET = 10000;
  const achieved = ordersTotalValue;
  const targetPct = Math.round((achieved / TARGET) * 100);

  // Top customers by MTD revenue (with last-order metadata for sub-label)
  const custRevMap: Record<string, number> = {};
  mtdOrders.forEach((o: any) => {
    const cid = String(o.customerId || o.customer_id || '');
    custRevMap[cid] = (custRevMap[cid] || 0) + (Number(o.grandTotal || o.total) || 0);
  });
  const topCustomers = Object.entries(custRevMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cid, rev]) => {
      const c = customers.find((x: any) => String(x.id) === cid);
      const lastOrder = salesOrders
        .filter((o: any) => String(o.customerId || o.customer_id) === cid)
        .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
      const lastOrderDate = lastOrder
        ? new Date(lastOrder.createdAt || lastOrder.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;
      const orderCount = salesOrders.filter((o: any) => String(o.customerId || o.customer_id) === cid).length;
      return {
        name: c?.name || 'Customer',
        revenue: rev,
        isOverdue: rev < 0,
        isOverLimit: false, // extend later if credit-limit data is wired in
        lastOrderDate,
        orderCount,
      };
    });

  // Churn list — worst first
  const churnList = customers
    .map((c: any) => {
      const lastOrder = salesOrders
        .filter((o: any) => String(o.customerId || o.customer_id) === String(c.id))
        .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
      const daysSince = lastOrder
        ? Math.floor((Date.now() - new Date(lastOrder.createdAt || lastOrder.date).getTime()) / 86400000)
        : 999;
      return { name: c.name, daysSince };
    })
    .filter(c => c.daysSince >= 60 && c.daysSince <= 365)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 3);

  // Product velocity — top 3 by line-item appearance count
  const prodCountMap: Record<string, number> = {};
  salesOrders.forEach((o: any) => {
    (o.items || o.orderItems || o.lineItems || o.lines || []).forEach((item: any) => {
      const pid = String(item.productId || item.product_id || item.product || item.name || '');
      prodCountMap[pid] = (prodCountMap[pid] || 0) + 1;
    });
  });
  const topProducts = products
    .map((p: any) => ({
      name: p.name,
      count: prodCountMap[String(p.id)] || prodCountMap[p.name] || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* ═══════════ SECTION 1 — Page header (.pgh) ═══════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          {/* .pgtit */}
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 600, letterSpacing: '-.5px', color: '#22C55E', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ verticalAlign: '-.15em' }}>
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            Sales &amp; CRM
          </div>
          {/* .pgsub */}
          <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-subtle)', marginTop: '2px' }}>
            Pipeline · Top customers · Churn alerts · Product velocity · Marketing
          </div>
        </div>
        {/* .pgact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* WhatsApp Blast — green color override */}
          <button
            type="button"
            onClick={() => navigate('/marketing/campaigns')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 11px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(34,197,94,.3)', background: 'rgba(255,255,255,.04)', color: '#22C55E', fontFamily: "'DM Sans',sans-serif", transition: '.12s' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            WhatsApp Blast
          </button>
          {/* Add Customer — default .pgbtn (subtle, NOT bright blue) */}
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 11px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--color-redwood-border)', background: 'rgba(255,255,255,.04)', color: 'var(--color-redwood-text-muted)', fontFamily: "'DM Sans',sans-serif", transition: '.12s' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="17" y1="11" x2="23" y2="11" />
            </svg>
            Add Customer
          </button>
        </div>
      </div>

      {/* ═══════════ SECTION 2 — 4 KPI cards (.g4) ═══════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '10px', marginBottom: '12px' }}>
        {/* Card 1 — Total Customers (.kpi.kg) */}
        <div style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s', cursor: 'default' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#22C55E,#86EFAC)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--color-redwood-text-muted)', fontWeight: 500, position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Total Customers
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.2)' }}>Active</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-.5px', marginBottom: '3px', lineHeight: '1.1', color: '#22C55E' }}>{totalCustomers}</div>
          <div style={{ fontSize: '10px', color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '4px' }}>+{newThisMonth} new this month</div>
        </div>

        {/* Card 2 — Churn Risk (.kpi.kr) */}
        <div style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s', cursor: 'default' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#EF4444,#FCA5A5)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--color-redwood-text-muted)', fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="18" y1="8" x2="23" y2="13" />
                <line x1="23" y1="8" x2="18" y2="13" />
              </svg>
              Churn Risk
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(239,68,68,.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.2)' }}>Alert</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-.5px', marginBottom: '3px', lineHeight: '1.1', color: '#EF4444' }}>{churnRisk}</div>
          <div style={{ fontSize: '10px', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '4px' }}>No order in 60+ days</div>
        </div>

        {/* Card 3 — Orders MTD (.kpi.kb) — value color #EEF2FF white per spec */}
        <div style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s', cursor: 'default' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: 'var(--color-redwood-text-muted)', fontWeight: 500 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4F8EF7" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Orders MTD
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(79,142,247,.14)', color: '#93C5FD', border: '1px solid rgba(79,142,247,.28)' }}>MTD</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-.5px', marginBottom: '3px', lineHeight: '1.1', color: 'var(--color-redwood-text-main)' }}>{ordersMTD}</div>
          <div style={{ fontSize: '10px', color: 'var(--color-redwood-text-subtle)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ${ordersTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total value
          </div>
        </div>

        {/* Card 4 — Target Achievement (.kpi.ka) */}
        <div style={{ background: 'var(--color-redwood-bg-surface)', border: '1px solid var(--color-redwood-border)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s', cursor: 'default' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#F59E0B,#FCD34D)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', color: 'var(--color-redwood-text-muted)', fontWeight: 500, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              <span title="Target Achievement">Target Achievement</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(245,158,11,.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,.2)' }}>{targetPct}%</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-.5px', marginBottom: '3px', lineHeight: '1.1', color: '#F59E0B' }}>{targetPct}%</div>
          <div style={{ fontSize: '10px', color: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ${achieved.toLocaleString(undefined, { maximumFractionDigits: 0 })} of ${(TARGET / 1000).toFixed(0)}k target
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION 3 — Two-column main content (.g2) ═══════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(300px,1fr)', gap: '12px' }}>
        {/* ───── LEFT PANEL — Top Customers + Progress bars ───── */}
        <div style={panelStyle}>
          <div style={phStyle}>
            <div style={ptStyle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="14.5 17.5 14.5 14 12 14 9.5 14 9.5 17.5" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="21" x2="12" y2="14" />
                <path d="M7 4H4v7a5 5 0 0 0 10 0V4h-3" />
                <path d="M17 4h3v7a5 5 0 0 1-10 0V4h3" />
              </svg>
              Top Customers — Revenue MTD
            </div>
            <button onClick={() => navigate('/customers')} style={paStyle}>Full CRM →</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {topCustomers.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'var(--color-redwood-row-bg)',
                  borderRadius: '6px',
                  border: `1px solid ${c.isOverdue ? 'rgba(239,68,68,.2)' : 'rgba(255,255,255,.07)'}`,
                  transition: '.12s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-bg)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--color-redwood-text-muted)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <div>
                    <div style={{ color: 'var(--color-redwood-text-main)' }}>
                      {c.name}
                      {c.isOverLimit && (
                        <span style={{ fontSize: '9px', color: '#EF4444', marginLeft: '6px' }}>⚠ Over limit</span>
                      )}
                    </div>
                    <div style={{ fontSize: '9px', color: c.isOverdue ? '#EF4444' : 'var(--color-redwood-text-subtle)', marginTop: '1px' }}>
                      {c.isOverdue
                        ? `$${Math.abs(c.revenue).toFixed(2)} overdue — DO NOT EXTEND CREDIT`
                        : `Last order: ${c.lastOrderDate || 'Recent'} · ${c.orderCount} orders`}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: c.isOverdue ? '#EF4444' : '#22C55E' }}>
                  {c.isOverdue ? '-' : ''}${Math.abs(c.revenue).toFixed(2)}
                </span>
              </div>
            ))}
            {topCustomers.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)', textAlign: 'center', padding: '16px 0' }}>
                No orders this month
              </div>
            )}
          </div>

          {/* Progress bars (.prog-row) */}
          <div style={{ marginTop: '12px' }}>
            {[
              { label: 'Monthly sales target', pct: targetPct, color: '#4F8EF7' },
              { label: 'New customer target', pct: Math.min(Math.round((newThisMonth / 20) * 100), 100), color: '#22C55E' },
              { label: 'Collection rate', pct: 12, color: '#EF4444' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                <div style={{ fontSize: '10px', color: 'var(--color-redwood-text-muted)', width: '160px', flexShrink: 0 }}>{row.label}</div>
                <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,.07)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', width: `${Math.min(row.pct, 100)}%`, background: row.color, transition: 'width .8s ease' }} />
                </div>
                <div style={{ fontSize: '10px', fontWeight: 500, width: '32px', textAlign: 'right', color: row.color }}>
                  {row.pct}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ───── RIGHT COLUMN — 3 stacked panels (.gcol gap:10) ───── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* ── Churn Alerts ── */}
          <div style={panelStyle}>
            <div style={phStyle}>
              <div style={ptStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="18" y1="8" x2="23" y2="13" />
                  <line x1="23" y1="8" x2="18" y2="13" />
                </svg>
                Churn Alerts
              </div>
              <button onClick={() => navigate('/customers')} style={paStyle}>Send reminders →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {churnList.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--color-redwood-row-bg)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-redwood-border)',
                    transition: '.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-bg)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--color-redwood-text-muted)', minWidth: 0, overflow: 'hidden' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: c.daysSince >= 90 ? '#EF4444' : '#F59E0B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.daysSince >= 999 ? '90+' : c.daysSince} days silent
                  </span>
                </div>
              ))}
              {churnList.length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No churn risk customers
                </div>
              )}
              {/* Send WhatsApp — a regular .srow with send SVG + blue text */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'var(--color-redwood-row-bg)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-redwood-border)',
                  transition: '.12s',
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/customers')}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-bg)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', minWidth: 0, overflow: 'hidden' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4F8EF7" strokeWidth="2" strokeLinecap="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span style={{ color: '#4F8EF7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Send WhatsApp to all {churnRisk} at-risk →</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Product Velocity ── */}
          <div style={panelStyle}>
            <div style={phStyle}>
              <div style={ptStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                  <line x1="2" y1="20" x2="22" y2="20" />
                </svg>
                Product Velocity
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {topProducts.map((p, i) => {
                const isFast = i === 0;
                const isMed = i === 1;
                const color = isFast ? '#22C55E' : isMed ? '#F59E0B' : 'var(--color-redwood-text-subtle)';
                const label = isFast ? 'Fast' : isMed ? 'Med' : 'Slow';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'var(--color-redwood-row-bg)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-redwood-border)',
                      transition: '.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-bg)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--color-redwood-text-muted)', overflow: 'hidden' }}>
                      {isFast ? (
                        // Flame — fast
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                      ) : isMed ? (
                        // Trending-up — medium
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      ) : (
                        // Trending-down — slow
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-redwood-text-subtle)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                          <polyline points="17 18 23 18 23 12" />
                        </svg>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color, flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {label} — {p.count}/mo
                    </span>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)', textAlign: 'center', padding: '12px 0' }}>
                  No product data
                </div>
              )}
            </div>
          </div>

          {/* ── Active Campaigns (hardcoded — no campaigns API) ── */}
          <div style={{ ...panelStyle, maxHeight: '280px', overflowY: 'auto' }}>
            <div style={phStyle}>
              <div style={ptStyle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 8a6 6 0 0 1 0 8" />
                  <path d="M22 6a10 10 0 0 1 0 12" />
                  <path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V7L6 11H5a2 2 0 0 0-2 2z" />
                </svg>
                Active Campaigns
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { label: 'Ramadan bulk discount', badge: 'Live' },
                { label: 'New customer 10% off', badge: 'Paused' },
                { label: 'Reactivation — 12 churned', badge: 'Scheduled' },
              ].map((camp, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--color-redwood-row-bg)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-redwood-border)',
                    transition: '.12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-redwood-row-bg)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: 'var(--color-redwood-text-muted)', minWidth: 0, overflow: 'hidden' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-redwood-text-subtle)" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 8a6 6 0 0 1 0 8" />
                      <path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V7L6 11H5a2 2 0 0 0-2 2z" />
                    </svg>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{camp.label}</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(79,142,247,.14)', color: '#93C5FD', border: '1px solid rgba(79,142,247,.28)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {camp.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
