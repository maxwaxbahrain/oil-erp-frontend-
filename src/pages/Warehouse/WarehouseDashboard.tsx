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

// Bin layout is hardcoded — no warehouse-bin API exists. The real
// product/stock numbers in the KPI row come from getProducts().
const BINS = [
  { id: 'A1', loc: 'Rack 1',     name: 'Bettano OW16 SP 12x1', units: 142, batch: 'BT-2024-087', expiry: '2026-12-15', qz: false },
  { id: 'A2', loc: 'Rack 1',     name: 'Bettano OW20 SP 12x1', units: 8,   batch: 'BT-2024-091', expiry: '2026-06-20', qz: false },
  { id: 'B1', loc: 'Rack 2',     name: 'Mobil Special 5W30',   units: 4,   batch: 'MB-2024-112', expiry: '2026-08-10', qz: false },
  { id: 'B2', loc: 'Rack 2',     name: 'Castrol GTX 10W40',    units: 56,  batch: 'CT-2025-003', expiry: '2027-03-01', qz: false },
  { id: 'C1', loc: 'Van Stock',  name: 'Bettano OW16 SP 12x1', units: 12,  batch: 'BT-2024-087', expiry: '2026-12-15', qz: false },
  { id: 'D1', loc: 'QUARANTINE', name: 'Mobil Special 5W30',   units: 6,   batch: 'MB-2023-087', expiry: '2023-12-01', qz: true  },
];

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

function kpiCard(cfg: {
  stripe: string;
  label: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  value: number;
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

  // Responsive column counts. Updated on window resize so the grid
  // tracks viewport changes (orientation flips, browser-window resize)
  // — not just first render.
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

  // Low-stock = stock=0 OR stock<=minimum_stock. Derived from real data.
  const lowStockCount = products.filter((p) => {
    if (p.current_stock === 0) return true;
    if (p.minimum_stock !== undefined && p.current_stock <= p.minimum_stock) return true;
    return false;
  }).length;

  const expiryChip = (expiry: string) => {
    const expiryDate = new Date(expiry);
    const days = Math.floor((expiryDate.getTime() - Date.now()) / 86400000);
    const label = days < 0
      ? '⛔ EXPIRED — Do not sell'
      : `📅 Exp: ${expiryDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    if (days < 0) {
      return { text: label, bg: 'var(--color-badge-red-bg)', color: 'var(--color-brand-red)' };
    }
    if (days > 90) {
      return { text: label, bg: 'var(--color-badge-green-bg)', color: 'var(--color-brand-green)' };
    }
    if (days > 30) {
      return { text: label, bg: 'var(--color-badge-amber-bg)', color: 'var(--color-brand-amber)' };
    }
    return { text: label, bg: 'rgba(239,68,68,.14)', color: 'var(--color-brand-red)' };
  };

  const stockColor = (units: number) => {
    if (units >= 20) return 'var(--color-brand-green)';
    if (units >= 5) return 'var(--color-brand-amber)';
    return 'var(--color-brand-red)';
  };

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
          badge: 'Urgent', badgeBg: 'rgba(239,68,68,.2)', badgeColor: 'var(--color-brand-red-tint)',
          value: 3,
          valueColor: 'var(--color-brand-red)',
          sub: '1 batch expired in quarantine',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
          label: 'Active Batches',
          badge: 'Tracked', badgeBg: 'rgba(79,142,247,.2)', badgeColor: 'var(--color-brand-blue-tint)',
          value: 12,
          valueColor: 'var(--color-redwood-text-main)',
          sub: 'Across 3 products',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          label: 'Pick Lists Today',
          badge: 'Active', badgeBg: 'rgba(34,197,94,.2)', badgeColor: 'var(--color-brand-green-tint)',
          value: 5,
          valueColor: 'var(--color-brand-green)',
          sub: '2 pending dispatch',
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols.bins}, 1fr)`,
            gap: cols.bins === 2 ? '6px' : '8px',
          }}>
            {BINS.map((bin) => {
              const chip = expiryChip(bin.expiry);
              return (
                <div
                  key={bin.id}
                  style={{
                    background: bin.qz ? 'rgba(239,68,68,.04)' : 'var(--color-redwood-row-bg)',
                    border: `1px solid ${bin.qz ? 'rgba(239,68,68,.4)' : 'var(--color-redwood-border)'}`,
                    borderRadius: '9px',
                    padding: cols.bins === 2 ? '7px 8px' : '9px 10px',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ fontSize: '8.5px', color: 'var(--color-redwood-text-subtle)', marginBottom: '2px' }}>
                    {bin.qz ? (
                      <span style={{ color: 'var(--color-brand-red)', fontWeight: 700, fontSize: '8px' }}>{bin.loc}</span>
                    ) : (
                      `${bin.id} · ${bin.loc}`
                    )}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bin.name}
                  </div>
                  <div style={{ fontSize: '10px', color: stockColor(bin.units), marginBottom: '2px' }}>
                    {bin.units} units
                  </div>
                  <div style={{ fontSize: '8.5px', fontFamily: "'DM Mono',monospace", color: 'var(--color-redwood-text-subtle)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bin.batch}
                  </div>
                  <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '999px', background: chip.bg, color: chip.color, display: 'inline-block', whiteSpace: 'nowrap' }}>
                    {chip.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — 3 stacked panels */}
        <div className="flex flex-col gap-[10px]">
          {/* Panel 1 — Expiry Alerts */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              <AlertTriangle size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
              Expiry Alerts
            </div>
            {[
              { label: 'Mobil 5W30 · MB-2023-087',   badge: 'EXPIRED', bg: 'rgba(239,68,68,.18)',  color: 'var(--color-brand-red)' },
              { label: 'Bettano OW20 · BT-2024-091', badge: '30 days', bg: 'rgba(245,158,11,.18)', color: 'var(--color-brand-amber)' },
              { label: 'Mobil 5W30 · MB-2024-112',   badge: '90 days', bg: 'rgba(245,158,11,.18)', color: 'var(--color-brand-amber)' },
            ].map((row, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', background: row.bg, color: row.color, flexShrink: 0, marginLeft: '8px', whiteSpace: 'nowrap' }}>
                  {row.badge}
                </span>
              </div>
            ))}
          </div>

          {/* Panel 2 — Reorder Alerts */}
          <div style={panel}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              <RefreshCw size={13} style={{ color: 'var(--color-redwood-text-muted)' }} />
              Reorder Alerts
            </div>
            {[
              { label: 'Mobil Special 5W30',     action: '4 left — Order NOW',    color: 'var(--color-brand-red)' },
              { label: 'Bettano OW20 SP 12x1',   action: '8 left — Below min',    color: 'var(--color-brand-amber)' },
              { label: 'Van Stock Bettano OW16', action: '12 left — Restock van', color: 'var(--color-brand-amber)' },
            ].map((row, i) => (
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
            {[
              { label: 'PL-001 · INV-960339 · Waqas',  badge: 'Dispatched', bg: 'rgba(34,197,94,.18)',  color: 'var(--color-brand-green)' },
              { label: 'PL-002 · INV-960336 · Khalid', badge: 'Picking',    bg: 'rgba(79,142,247,.18)', color: 'var(--color-brand-blue)' },
              { label: 'PL-003 · INV-837774 · Leo',    badge: 'Pending',    bg: 'rgba(255,255,255,.07)', color: 'var(--color-redwood-text-muted)' },
            ].map((row, i) => (
              <div key={i} style={rowStyle}>
                <span style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {row.label}
                </span>
                <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', background: row.bg, color: row.color, flexShrink: 0, marginLeft: '8px' }}>
                  {row.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
