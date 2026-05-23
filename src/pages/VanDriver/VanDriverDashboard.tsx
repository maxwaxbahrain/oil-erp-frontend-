import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Shared style tokens (mirrors Warehouse/Finance dashboards) ──────
const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '12px',
  padding: '14px 16px',
};

const rowBox: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '7px 10px',
  background: 'var(--color-redwood-row-bg)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '7px',
  marginBottom: '5px',
  gap: '8px',
};

const headerBtnGhost: CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: '#4F8EF7',
  border: '1.5px solid #4F8EF7',
  borderRadius: '7px',
  fontSize: '10.5px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: 'inherit',
};

const headerBtnSolid: CSSProperties = {
  padding: '6px 12px',
  background: '#4F8EF7',
  color: '#fff',
  border: 'none',
  borderRadius: '7px',
  fontSize: '10.5px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  fontFamily: 'inherit',
};

// ─── KPI card helper ────────────────────────────────────────────
function kpiCard(cfg: {
  stripe: string;
  label: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  value: string;
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
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '2.5px',
        background: cfg.stripe,
        borderRadius: '12px 12px 0 0',
      }} />
      <div style={{
        fontSize: '10px', color: 'var(--color-redwood-text-muted)',
        marginBottom: '6px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{cfg.label}</span>
        <span style={{
          fontSize: '8px', fontWeight: 700, padding: '2px 6px',
          borderRadius: '999px', background: cfg.badgeBg, color: cfg.badgeColor,
        }}>{cfg.badge}</span>
      </div>
      <div style={{
        fontSize: '20px', fontWeight: 700,
        color: cfg.valueColor,
        fontFamily: "'Syne',sans-serif",
        lineHeight: '1.1',
        marginBottom: '3px',
        letterSpacing: '-0.5px',
      }}>{cfg.value}</div>
      <div style={{ fontSize: '9px', color: 'var(--color-redwood-text-subtle)' }}>{cfg.sub}</div>
    </div>
  );
}

// ─── Hardcoded data (no API — by design per spec) ────────────────
const STOPS = [
  { n: 1, customer: 'ALI A&R',       address: '5330 97 Palace St',    amount: 480, status: 'delivered' },
  { n: 2, customer: 'Qahir Auto',    address: '123 Main St',          amount: 240, status: 'delivered' },
  { n: 3, customer: 'WAQAS Trading', address: '44 Industrial Rd',     amount: 192, status: 'delivered' },
  { n: 4, customer: 'Janan Motors',  address: '88 Gulf Ave',          amount: 560, status: 'delivered' },
  { n: 5, customer: 'Leo Tire Shop', address: '239 Palm Blvd',        amount: 239, status: 'delivered' },
  { n: 6, customer: 'Mobil Centre',  address: '12 Oil Street',        amount: 328, status: 'in_progress' },
  { n: 7, customer: 'Hassan Parts',  address: '67 Spare Parts Souk',  amount: 415, status: 'pending' },
  { n: 8, customer: 'Gulf Lube Co.', address: '3 Refinery Rd',        amount: 346, status: 'pending' },
] as const;

const STOCK_ON_VAN = [
  { name: 'Bettano OW16 SP 12x1', units: 12, level: 'ok' },
  { name: 'Bettano OW20 SP 12x1', units: 8,  level: 'ok' },
  { name: 'Mobil Special 5W30',   units: 6,  level: 'low' },
  { name: 'Castrol GTX 10W40',    units: 9,  level: 'ok' },
  { name: 'Zenol 0W20 SN',        units: 5,  level: 'low' },
  { name: 'Mobil 5W30 MB-2023',   units: 3,  level: 'critical' },
] as const;

const INVOICES = [
  { id: 'INV-960340', customer: 'ALI A&R',          amount: 561.44, terms: 'COD', status: 'collected' },
  { id: 'INV-960339', customer: 'WAQAS Trading',    amount: 56.00,  terms: 'COD', status: 'collected' },
  { id: 'INV-960336', customer: 'Janan Motors',     amount: 281.00, terms: 'COD', status: 'collected' },
  { id: 'INV-960335', customer: 'WAQAS Trading',    amount: 167.28, terms: 'COD', status: 'collected' },
  { id: 'INV-960334', customer: 'Leo Tire',         amount: 56.16,  terms: 'COD', status: 'collected' },
  { id: 'INV-000015', customer: 'Mobil Centre',     amount: 328.00, terms: 'COD', status: 'pending' },
  { id: 'INV-000016', customer: 'Hassan Parts',     amount: 415.00, terms: 'COD', status: 'pending' },
  { id: 'INV-000017', customer: 'Gulf Lube Co.',    amount: 346.00, terms: 'COD', status: 'pending' },
] as const;

const FEED = [
  { time: '08:14', event: 'Van 01 departed depot',                       badge: 'Start',       badgeBg: 'rgba(79,142,247,.18)',  badgeColor: '#93C5FD' },
  { time: '08:52', event: 'INV-960340 collected — $561.44 cash',         badge: 'Collected',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC' },
  { time: '09:31', event: 'INV-960339 delivered + paid — $56.00',        badge: 'Collected',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC' },
  { time: '10:15', event: 'Low stock alert — Mobil 5W30 (3 left)',       badge: '⚠ Alert',     badgeBg: 'rgba(239,68,68,.18)',   badgeColor: '#FCA5A5' },
  { time: '11:02', event: 'INV-960336 collected — $281.00 cash',         badge: 'Collected',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC' },
  { time: '11:44', event: 'INV-960335 + INV-960334 collected',           badge: 'Collected',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC' },
  { time: '12:30', event: 'Stop 5 completed — Leo Tire',                 badge: 'Done',        badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC' },
  { time: '13:15', event: 'Arrived Stop 6 — Mobil Centre',               badge: 'In Progress', badgeBg: 'rgba(245,158,11,.18)',  badgeColor: '#FCD34D' },
] as const;

// ─── Helpers ────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function stopStatusBadge(status: string) {
  if (status === 'delivered') {
    return { label: 'Delivered ✓', bg: 'rgba(34,197,94,.18)', color: '#86EFAC' };
  }
  if (status === 'in_progress') {
    return { label: 'In Progress ⟳', bg: 'rgba(245,158,11,.18)', color: '#FCD34D' };
  }
  return { label: 'Pending ○', bg: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)' };
}

function stockLevelBadge(level: string) {
  if (level === 'ok')       return { label: 'OK',       color: 'var(--color-brand-green)' };
  if (level === 'low')      return { label: 'Low',      color: 'var(--color-brand-amber)' };
  return                        { label: 'Critical', color: 'var(--color-brand-red)' };
}

export default function VanDriverDashboard() {
  const navigate = useNavigate();

  // Responsive layout state — same ResizeObserver pattern as
  // WarehouseDashboard / FinanceDashboard.
  const [cols, setCols] = useState({ kpi: 4, twoCol: true });
  useEffect(() => {
    const update = () => setCols({
      kpi: window.innerWidth >= 1024 ? 4 : 2,
      twoCol: window.innerWidth >= 1024,
    });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Aggregates derived from the hardcoded arrays (no API calls).
  const collected = INVOICES.filter((i) => i.status === 'collected').reduce((s, i) => s + i.amount, 0);
  const pending = INVOICES.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '80px' }}>

      {/* ────────── PAGE HEADER ────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--color-redwood-text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Syne',sans-serif",
            letterSpacing: '-0.5px',
          }}>
            🚐 Van Operations
          </h1>
          <p style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-subtle)', marginTop: '2px', margin: '3px 0 0' }}>
            Route tracking · Cash collection · Delivery status · Stock on van
          </p>
        </div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          <button type="button" style={headerBtnGhost} onClick={() => window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer')}>
            📍 Track Van Live
          </button>
          <button type="button" style={headerBtnSolid} onClick={() => navigate('/sales/invoices/new')}>
            + New Delivery
          </button>
        </div>
      </div>

      {/* ────────── ROW 1 — 4 KPI CARDS ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi},1fr)`, gap: '9px' }}>
        {kpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          label: 'Cash Collected Today',
          badge: '44%',
          badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#FCD34D',
          value: '$1,240',
          valueColor: 'var(--color-brand-green)',
          sub: 'of $2,800 target',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
          label: 'Deliveries Today',
          badge: 'Active',
          badgeBg: 'rgba(34,197,94,.18)', badgeColor: '#86EFAC',
          value: '8',
          valueColor: 'var(--color-redwood-text-main)',
          sub: '5 delivered · 2 pending · 1 failed',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
          label: 'Stock on Van',
          badge: 'Live',
          badgeBg: 'rgba(79,142,247,.18)', badgeColor: '#93C5FD',
          value: '43 units',
          valueColor: 'var(--color-redwood-text-main)',
          sub: 'Across 6 product lines',
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
          label: 'Route Progress',
          badge: 'On Route',
          badgeBg: 'rgba(79,142,247,.18)', badgeColor: '#93C5FD',
          value: '62%',
          valueColor: 'var(--color-brand-amber)',
          sub: '8 of 13 stops done',
        })}
      </div>

      {/* ────────── ROW 2 — Route + Stops || Van Status panel ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? '1fr minmax(250px,0.55fr)' : '1fr', gap: '10px' }}>

        {/* LEFT — Today's Delivery Route */}
        <div style={panel}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
              📍 Today's Route — Van 01 · Waqas
            </div>
            <a
              href="https://www.google.com/maps"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '10px', color: '#4F8EF7', textDecoration: 'none', cursor: 'pointer' }}
            >
              Open in Maps →
            </a>
          </div>

          {/* Map placeholder */}
          <div style={{
            background: 'var(--color-redwood-bg-light)',
            border: '1px solid var(--color-redwood-border)',
            borderRadius: '9px',
            padding: '18px',
            textAlign: 'center',
            marginBottom: '12px',
            height: '180px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}>
            <div style={{ fontSize: '14px', color: 'var(--color-redwood-text-main)' }}>🗺 Live Map View</div>
            <div style={{ fontSize: '10px', color: 'var(--color-redwood-text-subtle)' }}>
              Google Maps integration — track Van 01 in real time
            </div>
            <button
              type="button"
              style={{ ...headerBtnGhost, marginTop: '4px' }}
              onClick={() => window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer')}
            >
              View Live on Google Maps →
            </button>
          </div>

          {/* Stops list */}
          <div>
            {STOPS.map((s) => {
              const badge = stopStatusBadge(s.status);
              const isCurrent = s.status === 'in_progress';
              return (
                <div key={s.n} style={{
                  ...rowBox,
                  background: isCurrent ? 'rgba(245,158,11,.08)' : 'var(--color-redwood-row-bg)',
                  borderLeft: isCurrent ? '3px solid var(--color-brand-amber)' : '1px solid var(--color-redwood-border)',
                  paddingLeft: isCurrent ? '8px' : '10px',
                }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '6px',
                    background: 'var(--color-redwood-bg-light)',
                    border: '1px solid var(--color-redwood-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700,
                    color: 'var(--color-redwood-text-main)',
                    flexShrink: 0,
                  }}>
                    {s.n}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-redwood-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.customer}
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--color-redwood-text-subtle)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.address}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '11px', fontWeight: 600,
                    color: 'var(--color-redwood-text-main)',
                    fontFamily: "'DM Mono',monospace",
                    flexShrink: 0,
                  }}>
                    ${s.amount}
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 600,
                    padding: '2px 7px', borderRadius: '999px',
                    background: badge.bg, color: badge.color,
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT — 3 stacked status cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Card A — Cash Summary */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              💵 Cash Collection
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Collected today</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-green)' }}>$1,240</span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Pending (2 stops)</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-amber)' }}>$761</span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Total target</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>$2,800</span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Outstanding (old)</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-red)' }}>$2,927</span>
            </div>
            {/* Progress bar — 44% of daily target */}
            <div style={{ marginTop: '10px' }}>
              <div style={{ height: '6px', background: 'rgba(255,255,255,.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '44%', background: '#4F8EF7', borderRadius: '999px' }} />
              </div>
              <div style={{ fontSize: '9px', color: 'var(--color-redwood-text-subtle)', marginTop: '4px', textAlign: 'center' }}>
                44% of daily target
              </div>
            </div>
          </div>

          {/* Card B — Stock on Van */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              📦 Stock on Van — Van 01
            </div>
            {STOCK_ON_VAN.map((p, i) => {
              const badge = stockLevelBadge(p.level);
              return (
                <div key={i} style={{ ...rowBox, justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-main)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </span>
                  <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)', marginLeft: '8px', flexShrink: 0 }}>
                    {p.units} units
                  </span>
                  <span style={{ fontSize: '9.5px', fontWeight: 600, color: badge.color, marginLeft: '8px', flexShrink: 0, minWidth: '52px', textAlign: 'right' }}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
            <div style={{ fontSize: '9px', color: 'var(--color-redwood-text-subtle)', marginTop: '6px', textAlign: 'right' }}>
              Last restocked: Today 7:42 AM
            </div>
          </div>

          {/* Card C — Van Info */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              🚐 Van 01 — Waqas
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Status</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-brand-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-brand-green)', display: 'inline-block' }} />
                Online
              </span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Current stop</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>Stop 6 of 13</span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Started</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>8:14 AM</span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Est. return</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>5:30 PM</span>
            </div>
            <div style={{ ...rowBox, justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-muted)' }}>Last GPS ping</span>
              <span style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>2 min ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* ────────── ROW 3 — Invoices to Collect || Activity Feed ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? '1fr minmax(250px,0.55fr)' : '1fr', gap: '10px' }}>

        {/* LEFT — Invoices to Collect Today */}
        <div style={panel}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '4px' }}>
            🧾 Invoices to Collect
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-redwood-text-subtle)', marginBottom: '10px' }}>
            Cash on delivery — collect payment on arrival
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Invoice', 'Customer', 'Amount', 'Terms', 'Status'].map((h) => (
                    <th key={h} style={{
                      fontSize: '8px', fontWeight: 600, textTransform: 'uppercase',
                      color: 'var(--color-redwood-text-subtle)', padding: '4px 6px',
                      borderBottom: '1px solid var(--color-redwood-border)',
                      textAlign: h === 'Amount' ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => {
                  const isCollected = inv.status === 'collected';
                  const badge = isCollected
                    ? { label: 'Collected ✓', bg: 'rgba(34,197,94,.18)', color: '#86EFAC' }
                    : { label: 'Pending ○',   bg: 'rgba(245,158,11,.18)', color: '#FCD34D' };
                  return (
                    <tr key={inv.id}>
                      <td style={{
                        fontSize: '9px', fontFamily: "'DM Mono',monospace",
                        color: 'var(--color-redwood-text-main)', padding: '6px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                      }}>{inv.id}</td>
                      <td style={{
                        fontSize: '10px',
                        color: 'var(--color-redwood-text-main)', padding: '6px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                      }}>{inv.customer}</td>
                      <td style={{
                        fontSize: '10px', textAlign: 'right',
                        color: 'var(--color-redwood-text-main)', fontWeight: 600,
                        padding: '6px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                        whiteSpace: 'nowrap',
                        fontFamily: "'DM Mono',monospace",
                      }}>${fmt(inv.amount)}</td>
                      <td style={{
                        fontSize: '9px',
                        color: 'var(--color-redwood-text-muted)', padding: '6px',
                        borderBottom: '1px solid var(--color-redwood-border)',
                      }}>{inv.terms}</td>
                      <td style={{ padding: '6px', borderBottom: '1px solid var(--color-redwood-border)' }}>
                        <span style={{
                          fontSize: '8.5px', fontWeight: 700, padding: '2px 7px',
                          borderRadius: '999px',
                          background: badge.bg, color: badge.color,
                          whiteSpace: 'nowrap',
                        }}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: '10px', paddingTop: '8px',
            borderTop: '1px solid var(--color-redwood-border)',
            fontSize: '10px',
          }}>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>
              Total pending: <span style={{ color: 'var(--color-brand-amber)', fontWeight: 600 }}>${fmt0(pending)}</span>
            </span>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>
              Total collected: <span style={{ color: 'var(--color-brand-green)', fontWeight: 600 }}>${fmt0(collected)}</span>
            </span>
          </div>
        </div>

        {/* RIGHT — Activity Feed */}
        <div style={panel}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
            ⚡ Activity Feed
          </div>
          {FEED.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 8px',
              background: i % 2 === 0 ? 'var(--color-redwood-row-bg)' : 'transparent',
              borderRadius: '5px',
              marginBottom: '2px',
            }}>
              <span style={{
                fontSize: '9.5px',
                color: 'var(--color-redwood-text-subtle)',
                fontFamily: "'DM Mono',monospace",
                flexShrink: 0,
                width: '38px',
              }}>{e.time}</span>
              <span style={{
                fontSize: '10px',
                color: 'var(--color-redwood-text-main)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>{e.event}</span>
              <span style={{
                fontSize: '8.5px', fontWeight: 700,
                padding: '2px 7px', borderRadius: '999px',
                background: e.badgeBg, color: e.badgeColor,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{e.badge}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
