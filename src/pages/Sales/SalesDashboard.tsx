import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserX, ShoppingCart, Target, TrendingUp,
  User, Trophy, Send, BarChart2, Megaphone,
  Plus, MessageCircle,
} from 'lucide-react';
import { getCustomers, getSalesOrders, getProducts } from '../../services/api';

// ─── Shared style tokens (mirror public/preview.html tc-sales spec) ──────
const panel: CSSProperties = {
  background: '#0f1f33',
  border: '1px solid rgba(255,255,255,.12)',
  borderRadius: '14px',
  padding: '14px 16px',
};
const ph: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
};
const pt: CSSProperties = {
  fontFamily: "'Syne',sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};
const pa: CSSProperties = {
  fontSize: '10px',
  color: '#4F8EF7',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
};
const pgBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 11px',
  borderRadius: '6px',
  fontSize: '10.5px',
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(255,255,255,.04)',
  color: '#8BA3C7',
  fontFamily: "'DM Sans',sans-serif",
  transition: '.12s',
};

// ─── .srow with hover transition (used for every list row on this page) ──
function SRow({ children, overdue = false }: { children: ReactNode; overdue?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        background: '#142540',
        borderRadius: '6px',
        border: overdue ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(255,255,255,.07)',
        transition: '.12s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#1a2d4e'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#142540'; }}
    >
      {children}
    </div>
  );
}

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

  // ----- Computations (pure JS, no new APIs) -----
  const totalCustomers = customers.length;
  const now = new Date();
  const newThisMonth = customers.filter((c: any) => {
    const created = new Date(c.createdAt || c.created_at || '');
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  const churnThreshold = 60 * 24 * 60 * 60 * 1000;
  const churnRisk = customers.filter((c: any) => {
    const lastOrder = salesOrders
      .filter((o: any) => String(o.customerId || o.customer_id) === String(c.id))
      .sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())[0];
    if (!lastOrder) return true;
    return Date.now() - new Date(lastOrder.createdAt || lastOrder.date).getTime() > churnThreshold;
  }).length;

  const mtdOrders = salesOrders.filter((o: any) => {
    const d = new Date(o.createdAt || o.date || '');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const ordersMTD = mtdOrders.length;
  const ordersTotalValue = mtdOrders.reduce((sum: number, o: any) => sum + (Number(o.grandTotal || o.total) || 0), 0);

  const TARGET = 280000;
  const achieved = ordersTotalValue;
  const targetPct = Math.round((achieved / TARGET) * 100);

  // Top customers by MTD revenue
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
      return {
        name: c?.name || 'Customer',
        revenue: rev,
        isOverdue: rev < 0,
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
    .filter(c => c.daysSince >= 60)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
      {/* ─── PAGE HEADER (FIX 1, FIX 9) ─── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: "'Syne',sans-serif",
            fontSize: '20px',
            fontWeight: 600,
            letterSpacing: '-0.5px',
            color: '#22C55E',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <TrendingUp size={20} style={{ color: '#22C55E' }} />
            Sales & CRM
          </h1>
          <div style={{ fontSize: '11px', color: '#3E5678', marginTop: '2px' }}>
            Pipeline · Top customers · Churn alerts · Product velocity · Marketing
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate('/marketing/campaigns')}
            style={{ ...pgBtn, color: '#22C55E', border: '1px solid rgba(34,197,94,.3)' }}
          >
            <MessageCircle size={13} /> WhatsApp Blast
          </button>
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            style={{ ...pgBtn, color: '#93C5FD', border: '1px solid rgba(79,142,247,.28)' }}
          >
            <Plus size={13} /> Add Customer
          </button>
        </div>
      </div>

      {/* ─── KPI ROW (FIX 2, FIX 3) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
        {/* Total Customers */}
        <div style={{ background: '#0f1f33', border: '1px solid rgba(255,255,255,.12)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#22C55E,#86EFAC)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 500, color: '#8BA3C7' }}>
              <Users size={13} style={{ color: '#22C55E' }} /> Total Customers
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(34,197,94,.12)', color: '#86EFAC', border: '1px solid rgba(34,197,94,.2)' }}>Active</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '3px', lineHeight: '1.1', color: '#22C55E' }}>{totalCustomers}</div>
          <div style={{ fontSize: '10px', color: '#86EFAC' }}>+{newThisMonth} new this month</div>
        </div>

        {/* Churn Risk */}
        <div style={{ background: '#0f1f33', border: '1px solid rgba(255,255,255,.12)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#EF4444,#FCA5A5)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 500, color: '#8BA3C7' }}>
              <UserX size={13} style={{ color: '#EF4444' }} /> Churn Risk
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(239,68,68,.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,.2)' }}>Alert</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '3px', lineHeight: '1.1', color: '#EF4444' }}>{churnRisk}</div>
          <div style={{ fontSize: '10px', color: '#FCA5A5' }}>No order in 60+ days</div>
        </div>

        {/* Orders MTD */}
        <div style={{ background: '#0f1f33', border: '1px solid rgba(255,255,255,.12)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 500, color: '#8BA3C7' }}>
              <ShoppingCart size={13} style={{ color: '#4F8EF7' }} /> Orders MTD
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(79,142,247,.14)', color: '#93C5FD', border: '1px solid rgba(79,142,247,.28)' }}>MTD</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '3px', lineHeight: '1.1', color: '#4F8EF7' }}>{ordersMTD}</div>
          <div style={{ fontSize: '10px', color: '#8BA3C7' }}>
            ${ordersTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total value
          </div>
        </div>

        {/* Target Achievement */}
        <div style={{ background: '#0f1f33', border: '1px solid rgba(255,255,255,.12)', borderRadius: '14px', padding: '13px 14px', position: 'relative', overflow: 'hidden', transition: '.18s' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', borderRadius: '14px 14px 0 0', background: 'linear-gradient(90deg,#F59E0B,#FCD34D)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', fontWeight: 500, color: '#8BA3C7' }}>
              <Target size={13} style={{ color: '#F59E0B' }} /> Target Achievement
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '20px', background: 'rgba(245,158,11,.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,.2)' }}>{targetPct}%</span>
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 600, letterSpacing: '-0.5px', marginBottom: '3px', lineHeight: '1.1', color: '#F59E0B' }}>{targetPct}%</div>
          <div style={{ fontSize: '10px', color: '#FCA5A5' }}>
            ${achieved.toLocaleString(undefined, { maximumFractionDigits: 0 })} of $280k target
          </div>
        </div>
      </div>

      {/* ─── TWO-COLUMN MAIN (FIX 6) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '12px' }}>
        {/* LEFT — Top Customers + progress bars (FIX 4, FIX 5, FIX 7, FIX 8) */}
        <div style={panel}>
          <div style={ph}>
            <div style={pt}>
              <Trophy size={13} style={{ color: '#8BA3C7' }} />
              Top Customers — Revenue MTD
            </div>
            <button onClick={() => navigate('/customers')} style={pa}>Full CRM →</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {topCustomers.map((c, i) => (
              <SRow key={i} overdue={c.isOverdue}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <User size={13} style={{ color: '#3E5678', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: c.isOverdue ? '#FCA5A5' : '#EEF2FF' }}>{c.name}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: c.isOverdue ? '#EF4444' : '#22C55E' }}>
                  ${Math.abs(c.revenue).toFixed(2)}
                </span>
              </SRow>
            ))}
            {topCustomers.length === 0 && (
              <div style={{ fontSize: '11px', color: '#8BA3C7', textAlign: 'center', padding: '16px 0' }}>
                No orders this month
              </div>
            )}
          </div>

          {/* Progress bars (FIX 8) */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'Monthly sales target', pct: targetPct, color: '#4F8EF7' },
              { label: 'New customer target', pct: Math.min(Math.round((newThisMonth / 20) * 100), 100), color: '#22C55E' },
              { label: 'Collection rate', pct: 12, color: '#EF4444' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                <span style={{ fontSize: '10px', color: '#8BA3C7', minWidth: '160px', flexShrink: 0 }}>{row.label}</span>
                <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,.07)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '3px', width: `${row.pct}%`, background: row.color, transition: 'width .8s ease' }} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 500, width: '32px', textAlign: 'right', color: row.color }}>
                  {row.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — 3 stacked panels (FIX 10) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Churn Alerts */}
          <div style={panel}>
            <div style={ph}>
              <div style={pt}>
                <UserX size={13} style={{ color: '#8BA3C7' }} />
                Churn Alerts
              </div>
              <button onClick={() => navigate('/customers')} style={pa}>Send reminders →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {churnList.map((c, i) => (
                <SRow key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <User size={13} style={{ color: '#3E5678' }} />
                    <span style={{ fontSize: '11px', color: '#EEF2FF' }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: c.daysSince >= 90 ? '#FCA5A5' : '#FCD34D' }}>
                    {c.daysSince}d silent
                  </span>
                </SRow>
              ))}
              {churnList.length === 0 && (
                <div style={{ fontSize: '11px', color: '#8BA3C7', textAlign: 'center', padding: '12px 0' }}>
                  No churn risk customers
                </div>
              )}
              <button
                onClick={() => navigate('/customers')}
                style={{
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  width: '100%',
                  textAlign: 'left',
                  fontSize: '10px',
                  color: '#4F8EF7',
                  background: 'rgba(79,142,247,.07)',
                  borderRadius: '6px',
                  border: '1px solid rgba(79,142,247,.14)',
                  cursor: 'pointer',
                  transition: '.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79,142,247,.12)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79,142,247,.07)'; }}
              >
                <Send size={11} /> Send WhatsApp to all {churnRisk} at-risk →
              </button>
            </div>
          </div>

          {/* Product Velocity */}
          <div style={panel}>
            <div style={ph}>
              <div style={pt}>
                <BarChart2 size={13} style={{ color: '#8BA3C7' }} />
                Product Velocity
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {topProducts.map((p, i) => {
                const isFast = i === 0;
                const isMed = i === 1;
                const color = isFast ? '#22C55E' : isMed ? '#F59E0B' : '#3E5678';
                const label = isFast ? 'Fast' : isMed ? 'Med' : 'Slow';
                return (
                  <SRow key={i}>
                    <span style={{ fontSize: '11px', color: '#EEF2FF', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '8px', flexShrink: 0, color }}>
                      {label} — {p.count}/mo
                    </span>
                  </SRow>
                );
              })}
              {topProducts.length === 0 && (
                <div style={{ fontSize: '11px', color: '#8BA3C7', textAlign: 'center', padding: '12px 0' }}>
                  No product data
                </div>
              )}
            </div>
          </div>

          {/* Active Campaigns (hardcoded — no campaigns API) */}
          <div style={panel}>
            <div style={ph}>
              <div style={pt}>
                <Megaphone size={13} style={{ color: '#8BA3C7' }} />
                Active Campaigns
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { label: 'Ramadan bulk discount', badge: 'Live' },
                { label: 'New customer 10% off', badge: 'Paused' },
                { label: 'Reactivation — 12 churned', badge: 'Scheduled' },
              ].map((camp, i) => (
                <SRow key={i}>
                  <span style={{ fontSize: '11px', color: '#EEF2FF' }}>{camp.label}</span>
                  <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(79,142,247,.12)', color: '#93C5FD', border: '1px solid rgba(79,142,247,.2)' }}>
                    {camp.badge}
                  </span>
                </SRow>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
