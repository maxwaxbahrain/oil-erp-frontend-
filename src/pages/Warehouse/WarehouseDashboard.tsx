import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Globe,
  AlertTriangle,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react';
import { getProducts, type Product } from '../../services/api';

const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '12px',
  padding: '12px 14px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  background: 'var(--color-redwood-row-bg)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '7px',
  padding: '7px 9px',
  marginBottom: '5px',
};

const headerBtn: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '7px',
  padding: '6px 10px',
  fontSize: '10.5px',
  color: 'var(--color-redwood-text-muted)',
  cursor: 'pointer',
  fontFamily: "'DM Sans',sans-serif",
};

function notConnectedBlock(title: string, explanation: string) {
  return (
    <div
      style={{
        background: 'var(--color-redwood-row-bg)',
        border: '1px solid var(--color-redwood-border)',
        borderRadius: '9px',
        padding: '14px 12px',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '6px' }}>
        {title}
      </div>
      <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.55, color: 'var(--color-redwood-text-muted)' }}>
        {explanation}
      </p>
    </div>
  );
}

function kpiCard(cfg: {
  stripe: string;
  label: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  value: string | number;
  valueColor: string;
  sub: string;
}) {
  return (
    <div style={{
      background: 'var(--color-redwood-bg-surface)',
      border: '1px solid var(--color-redwood-border)',
      borderRadius: '12px',
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', borderRadius: '12px 12px 0 0', background: cfg.stripe }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--color-redwood-text-muted)' }}>{cfg.label}</span>
        <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', background: cfg.badgeBg, color: cfg.badgeColor }}>
          {cfg.badge}
        </span>
      </div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '22px', fontWeight: 700, lineHeight: '1.1', marginBottom: '3px', letterSpacing: '-0.5px', color: cfg.valueColor }}>
        {cfg.value}
      </div>
      <div style={{ fontSize: '9.5px', color: 'var(--color-redwood-text-subtle)' }}>{cfg.sub}</div>
    </div>
  );
}

export default function WarehouseDashboard() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);

  const [cols, setCols] = useState({ kpi: 4, bins: 3, twoCol: true });
  useEffect(() => {
    const update = () => setCols({
      kpi: window.innerWidth >= 1024 ? 4 : 2,
      bins: window.innerWidth >= 768 ? 3 : 2,
      twoCol: window.innerWidth >= 1024,
    });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    getProducts().then(setProducts).catch(console.error);
  }, []);

  const lowStockCount = products.filter((p) => {
    if (p.current_stock === 0) return true;
    if (p.minimum_stock !== undefined && p.current_stock <= p.minimum_stock) return true;
    return false;
  }).length;

  const reorderAlerts = products
    .filter((p) => p.minimum_stock !== undefined && p.current_stock <= p.minimum_stock)
    .sort((a, b) => a.current_stock - b.current_stock)
    .slice(0, 6)
    .map((p) => ({
      label: p.name,
      action: p.current_stock === 0
        ? 'Out of stock — reorder'
        : `${p.current_stock} left — below min (${p.minimum_stock})`,
      color: p.current_stock === 0 ? 'var(--color-brand-red)' : 'var(--color-brand-amber)',
    }));

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* ────────── A) Page header ────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Syne',sans-serif", fontSize: '20px', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-redwood-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Box size={20} style={{ color: 'var(--color-brand-amber)' }} />
            Warehouse Management
          </h1>
          <div style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-subtle)', marginTop: '2px' }}>
            Bin locations · Batch &amp; lot tracking · Expiry dates · Pick lists · Reorder alerts
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" style={headerBtn}>Scan Barcode</button>
          <button type="button" style={headerBtn}>Generate Pick List</button>
        </div>
      </div>

      {/* ────────── B) 4 KPI cards ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols.kpi}, 1fr)`,
        gap: '9px',
        marginBottom: '12px',
      }}>
        {kpiCard({
          stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
          label: 'Low Stock Items',
          badge: 'Critical', badgeBg: 'rgba(239,68,68,.2)', badgeColor: 'var(--color-brand-red-tint)',
          value: lowStockCount,
          valueColor: 'var(--color-brand-amber)',
          sub: 'Below reorder point',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#EF4444,#FCA5A5)',
          label: 'Expiry Alerts',
          badge: '—', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)',
          value: '—',
          valueColor: 'var(--color-redwood-text-muted)',
          sub: 'No expiry tracking connected yet',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
          label: 'Active Batches',
          badge: '—', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)',
          value: '—',
          valueColor: 'var(--color-redwood-text-muted)',
          sub: 'Batch tracking not configured yet',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          label: 'Pick Lists Today',
          badge: '—', badgeBg: 'rgba(148,163,184,.12)', badgeColor: 'var(--color-redwood-text-muted)',
          value: '—',
          valueColor: 'var(--color-redwood-text-muted)',
          sub: 'Pick list workflow not connected yet',
        })}
      </div>

      {/* ────────── C) Two-column main ────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: cols.twoCol ? '1fr minmax(250px,0.7fr)' : '1fr',
        gap: '10px',
      }}>
        {/* LEFT — Bin Locations */}
        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
              <Globe size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
              Bin Locations — Stock Floor Map
            </div>
            <button onClick={() => navigate('/products')} style={{ fontSize: '10px', color: 'var(--color-brand-blue)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Edit locations →
            </button>
          </div>
          {notConnectedBlock(
            'Bin locations not available yet',
            'This grid previously showed demo rack, batch, and expiry data without a warehouse-bin API. Live bin mapping will appear here once storage locations are connected.',
          )}
        </div>

        {/* RIGHT — 3 stacked panels */}
        <div className="flex flex-col gap-[10px]">
          {/* Panel 1 — Expiry Alerts */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              <AlertTriangle size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
              Expiry Alerts
            </div>
            {notConnectedBlock(
              'Expiry alerts not connected yet',
              'Demo expiry batches are hidden until lot/expiry data is available from inventory or warehouse endpoints.',
            )}
          </div>

          {/* Panel 2 — Reorder Alerts (real when minimum_stock is set) */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              <RefreshCw size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
              Reorder Alerts
            </div>
            {reorderAlerts.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No products below minimum stock
              </div>
            ) : reorderAlerts.map((row, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: row.color, flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap' }}>
                  {row.action}
                </span>
              </div>
            ))}
          </div>

          {/* Panel 3 — Active Pick Lists */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              <ClipboardCheck size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
              Active Pick Lists
            </div>
            {notConnectedBlock(
              'Pick lists not connected yet',
              'Demo pick-list rows are hidden until outbound pick-list and dispatch endpoints are wired in.',
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
