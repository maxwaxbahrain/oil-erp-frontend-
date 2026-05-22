import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserX, ShoppingCart, Target, TrendingUp,
  User, Trophy, Send, BarChart2, Megaphone,
  Plus, MessageCircle,
} from 'lucide-react';
import { getCustomers, getSalesOrders, getProducts } from '../../services/api';

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
    <div className="space-y-4 pb-10">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold flex items-center gap-2" style={{ fontFamily: "'Syne',sans-serif", color: '#22C55E' }}>
            <TrendingUp size={20} style={{ color: '#22C55E' }} />
            Sales & CRM
          </h1>
          <div className="text-[11px] text-redwood-text-muted mt-0.5">
            Pipeline · Top customers · Churn alerts · Product velocity · Marketing
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/marketing/campaigns')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[rgba(34,197,94,0.12)] text-[#86EFAC] border border-[rgba(34,197,94,0.22)] hover:bg-[rgba(34,197,94,0.18)] transition-colors"
          >
            <MessageCircle size={13} /> WhatsApp Blast
          </button>
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-[#4F8EF7] text-white hover:brightness-110 transition-all shadow-sm"
          >
            <Plus size={13} /> Add Customer
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Customers */}
        <div className="bg-redwood-bg-surface border border-[rgba(34,197,94,0.2)] rounded-[14px] px-[14px] py-[13px] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[14px]"
            style={{ background: 'linear-gradient(90deg,#22C55E,#86EFAC)' }} />
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-redwood-text-muted">
              <Users size={13} style={{ color: '#22C55E' }} /> Total Customers
            </div>
            <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-[rgba(34,197,94,0.12)] text-[#86EFAC] border border-[rgba(34,197,94,0.2)]">Active</span>
          </div>
          <div className="text-[22px] font-semibold leading-[1.1] tracking-[-0.5px] mb-[3px]"
            style={{ fontFamily: "'Syne',sans-serif", color: '#22C55E' }}>
            {totalCustomers}
          </div>
          <div className="text-[10px] text-[#3E5678]">+{newThisMonth} new this month</div>
        </div>

        {/* Churn Risk */}
        <div className="bg-redwood-bg-surface border border-[rgba(239,68,68,0.2)] rounded-[14px] px-[14px] py-[13px] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[14px]"
            style={{ background: 'linear-gradient(90deg,#EF4444,#FCA5A5)' }} />
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-redwood-text-muted">
              <UserX size={13} style={{ color: '#EF4444' }} /> Churn Risk
            </div>
            <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-[rgba(239,68,68,0.12)] text-[#FCA5A5] border border-[rgba(239,68,68,0.2)]">Alert</span>
          </div>
          <div className="text-[22px] font-semibold leading-[1.1] tracking-[-0.5px] mb-[3px]"
            style={{ fontFamily: "'Syne',sans-serif", color: '#EF4444' }}>
            {churnRisk}
          </div>
          <div className="text-[10px] text-[#FCA5A5]">No order in 60+ days</div>
        </div>

        {/* Orders MTD */}
        <div className="bg-redwood-bg-surface border border-[rgba(79,142,247,0.28)] rounded-[14px] px-[14px] py-[13px] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[14px]"
            style={{ background: 'linear-gradient(90deg,#4F8EF7,#93C5FD)' }} />
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-redwood-text-muted">
              <ShoppingCart size={13} style={{ color: '#4F8EF7' }} /> Orders MTD
            </div>
            <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-[rgba(79,142,247,0.14)] text-[#93C5FD] border border-[rgba(79,142,247,0.28)]">MTD</span>
          </div>
          <div className="text-[22px] font-semibold leading-[1.1] tracking-[-0.5px] mb-[3px]"
            style={{ fontFamily: "'Syne',sans-serif", color: '#4F8EF7' }}>
            {ordersMTD}
          </div>
          <div className="text-[10px] text-redwood-text-muted">
            ${ordersTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} total value
          </div>
        </div>

        {/* Target Achievement */}
        <div className="bg-redwood-bg-surface border border-[rgba(245,158,11,0.2)] rounded-[14px] px-[14px] py-[13px] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[14px]"
            style={{ background: 'linear-gradient(90deg,#F59E0B,#FCD34D)' }} />
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-redwood-text-muted">
              <Target size={13} style={{ color: '#F59E0B' }} /> Target Achievement
            </div>
            <span className="text-[9px] font-semibold px-[7px] py-[2px] rounded-full bg-[rgba(245,158,11,0.12)] text-[#FCD34D] border border-[rgba(245,158,11,0.2)]">{targetPct}%</span>
          </div>
          <div className="text-[22px] font-semibold leading-[1.1] tracking-[-0.5px] mb-[3px]"
            style={{ fontFamily: "'Syne',sans-serif", color: '#F59E0B' }}>
            {targetPct}%
          </div>
          <div className="text-[10px] text-[#FCA5A5]">
            ${achieved.toLocaleString(undefined, { maximumFractionDigits: 0 })} of $280k target
          </div>
        </div>
      </div>

      {/* Two-column main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-[10px]">
        {/* LEFT — Top Customers + progress bars */}
        <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold text-redwood-text-main flex items-center gap-1.5">
              <Trophy size={13} className="text-redwood-text-muted" />
              Top Customers — Revenue MTD
            </div>
            <button onClick={() => navigate('/customers')} className="text-[10px] text-[#4F8EF7] hover:underline">
              Full CRM →
            </button>
          </div>
          <div className="flex flex-col gap-[5px]">
            {topCustomers.map((c, i) => (
              <div key={i} className={`flex items-center justify-between px-2.5 py-1.5 bg-[#142540] rounded-[6px] border transition-colors hover:bg-[#1a2d4e] ${c.isOverdue ? 'border-[rgba(239,68,68,0.25)]' : 'border-redwood-border'}`}>
                <div className="flex items-center gap-2">
                  <User size={13} className="text-[#3E5678] flex-shrink-0" />
                  <span className={`text-[11px] ${c.isOverdue ? 'text-[#FCA5A5]' : 'text-redwood-text-main'}`}>
                    {c.name}
                  </span>
                </div>
                <span className={`text-[13px] font-semibold ${c.isOverdue ? 'text-[#EF4444]' : 'text-[#22C55E]'}`}>
                  ${Math.abs(c.revenue).toFixed(2)}
                </span>
              </div>
            ))}
            {topCustomers.length === 0 && (
              <div className="text-[11px] text-redwood-text-muted text-center py-4">No orders this month</div>
            )}
          </div>
          {/* Progress bars */}
          <div className="mt-3 flex flex-col gap-2">
            {[
              { label: 'Monthly sales target', pct: targetPct, color: '#4F8EF7' },
              { label: 'New customer target', pct: Math.min(Math.round((newThisMonth / 20) * 100), 100), color: '#22C55E' },
              { label: 'Collection rate', pct: 12, color: '#EF4444' },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-redwood-text-muted w-[140px] flex-shrink-0">{row.label}</span>
                <div className="flex-1 h-[5px] bg-[#142540] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${row.pct}%`, background: row.color }} />
                </div>
                <span className="text-[10px] font-semibold w-8 text-right" style={{ color: row.color }}>{row.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — 3 stacked panels */}
        <div className="flex flex-col gap-[10px]">
          {/* Churn Alerts */}
          <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[13px] font-semibold text-redwood-text-main flex items-center gap-1.5">
                <UserX size={13} className="text-redwood-text-muted" /> Churn Alerts
              </div>
              <button onClick={() => navigate('/customers')} className="text-[10px] text-[#4F8EF7] hover:underline">
                Send reminders →
              </button>
            </div>
            <div className="flex flex-col gap-[5px]">
              {churnList.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-[#142540] rounded-[6px] border border-redwood-border">
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-[#3E5678]" />
                    <span className="text-[11px] text-redwood-text-main">{c.name}</span>
                  </div>
                  <span className={`text-[9px] font-semibold ${c.daysSince >= 90 ? 'text-[#FCA5A5]' : 'text-[#FCD34D]'}`}>
                    {c.daysSince}d silent
                  </span>
                </div>
              ))}
              {churnList.length === 0 && (
                <div className="text-[11px] text-redwood-text-muted text-center py-3">No churn risk customers</div>
              )}
              <button
                onClick={() => navigate('/customers')}
                className="mt-1 flex items-center gap-2 px-2.5 py-1.5 w-full text-left text-[10px] text-[#4F8EF7] bg-[rgba(79,142,247,0.07)] rounded-[6px] border border-[rgba(79,142,247,0.14)] hover:bg-[rgba(79,142,247,0.12)] transition-colors">
                <Send size={11} /> Send WhatsApp to all {churnRisk} at-risk →
              </button>
            </div>
          </div>

          {/* Product Velocity */}
          <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
            <div className="text-[13px] font-semibold text-redwood-text-main flex items-center gap-1.5 mb-2.5">
              <BarChart2 size={13} className="text-redwood-text-muted" /> Product Velocity
            </div>
            <div className="flex flex-col gap-[5px]">
              {topProducts.map((p, i) => {
                const isFast = i === 0;
                const isMed = i === 1;
                const color = isFast ? '#22C55E' : isMed ? '#F59E0B' : '#3E5678';
                const label = isFast ? 'Fast' : isMed ? 'Med' : 'Slow';
                return (
                  <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-[#142540] rounded-[6px] border border-redwood-border">
                    <span className="text-[11px] text-redwood-text-main flex-1 truncate">{p.name}</span>
                    <span className="text-[10px] font-semibold ml-2 flex-shrink-0" style={{ color }}>
                      {label} — {p.count}/mo
                    </span>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <div className="text-[11px] text-redwood-text-muted text-center py-3">No product data</div>
              )}
            </div>
          </div>

          {/* Active Campaigns (hardcoded — no campaigns API) */}
          <div className="bg-redwood-bg-surface border border-redwood-border rounded-[14px] px-4 py-3.5">
            <div className="text-[13px] font-semibold text-redwood-text-main flex items-center gap-1.5 mb-2.5">
              <Megaphone size={13} className="text-redwood-text-muted" /> Active Campaigns
            </div>
            <div className="flex flex-col gap-[5px]">
              {[
                { label: 'Ramadan bulk discount', badge: 'Live' },
                { label: 'New customer 10% off', badge: 'Paused' },
                { label: 'Reactivation — 12 churned', badge: 'Scheduled' },
              ].map((camp, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-[#142540] rounded-[6px] border border-redwood-border">
                  <span className="text-[11px] text-redwood-text-main">{camp.label}</span>
                  <span className="text-[9px] font-semibold px-2 py-[2px] rounded-full bg-[rgba(79,142,247,0.12)] text-[#93C5FD] border border-[rgba(79,142,247,0.2)]">
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
