import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Shared style tokens ─────────────────────────────────────────
const panel: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '12px',
  padding: '14px 16px',
};

const tooltipContentStyle: CSSProperties = {
  backgroundColor: '#0f1f33',
  border: '1px solid rgba(79,142,247,0.3)',
  borderRadius: '6px',
  color: '#EEF2FF',
  fontSize: '11px',
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

// ─── Hardcoded data (no API — by design per spec) ────────────────
const STOPS = [
  { n: 1, customer: 'ALI A&R',       address: '5330 97 Palace',         amount: 480, status: 'delivered' as const },
  { n: 2, customer: 'Qahir Auto',    address: '123 Main St',            amount: 240, status: 'delivered' as const },
  { n: 3, customer: 'WAQAS Trading', address: '44 Industrial Rd',       amount: 192, status: 'delivered' as const },
  { n: 4, customer: 'Janan Motors',  address: '88 Gulf Ave',            amount: 560, status: 'delivered' as const },
  { n: 5, customer: 'Leo Tire Shop', address: '239 Palm Blvd',          amount: 239, status: 'delivered' as const },
  { n: 6, customer: 'Mobil Centre',  address: '12 Oil Street',          amount: 328, status: 'in_progress' as const },
  { n: 7, customer: 'Hassan Parts',  address: '67 Spare Parts Souk',    amount: 415, status: 'pending' as const },
  { n: 8, customer: 'Gulf Lube Co.', address: '3 Refinery Rd',          amount: 346, status: 'pending' as const },
];

// Card-1 cash sparkline (running cash collected)
const CASH_SPARK = [200, 350, 480, 620, 780, 950, 1240].map((v, i) => ({ i, v }));
// Card-2 deliveries-per-hour bars
const DELIV_BARS = [2, 3, 1, 4, 5, 3, 8].map((v, i) => ({ i, v }));
// Card-3 stock-on-van trend (declining through the day)
const STOCK_SPARK = [60, 58, 55, 52, 50, 47, 43].map((v, i) => ({ i, v }));
// Card-4 route progress (single radial point)
const ROUTE_RADIAL = [{ name: 'Progress', value: 62, fill: '#7C3AED' }];

// Section A — hourly collected vs target pace.
type HourlyPoint = { hour: string; target: number; collected?: number };
const CASH_HOURLY: HourlyPoint[] = [
  { hour: '8AM',  collected: 0,    target: 280 },
  { hour: '9AM',  collected: 480,  target: 560 },
  { hour: '10AM', collected: 536,  target: 840 },
  { hour: '11AM', collected: 817,  target: 1120 },
  { hour: '12PM', collected: 1122, target: 1400 },
  { hour: '1PM',  collected: 1240, target: 1680 },
  { hour: '2PM',  collected: 1240, target: 1960 },
  { hour: '3PM',  target: 2240 },
  { hour: '4PM',  target: 2520 },
  { hour: '5PM',  target: 2800 },
];

// Donut data — delivery status breakdown
const DELIVERY_STATUS = [
  { name: 'Delivered',   value: 5, fill: '#22C55E' },
  { name: 'In Progress', value: 1, fill: '#F59E0B' },
  { name: 'Pending',     value: 2, fill: '#4F8EF7' },
  { name: 'Failed',      value: 0, fill: '#EF4444' },
];

// Stock levels — horizontal bar
const STOCK_DATA = [
  { name: 'OW16 SP',    units: 12, max: 20 },
  { name: 'OW20 SP',    units: 8,  max: 15 },
  { name: '5W30',       units: 6,  max: 20 },
  { name: 'GTX 10W40',  units: 9,  max: 15 },
  { name: 'Zenol 0W20', units: 5,  max: 12 },
  { name: 'Mobil 5W30', units: 3,  max: 15 },
];

// Week performance — Today is highlighted green
const WEEK = [
  { day: 'Mon',   cash: 2100, isToday: false },
  { day: 'Tue',   cash: 1850, isToday: false },
  { day: 'Wed',   cash: 2400, isToday: false },
  { day: 'Thu',   cash: 1600, isToday: false },
  { day: 'Fri',   cash: 2200, isToday: false },
  { day: 'Sat',   cash: 1900, isToday: false },
  { day: 'Today', cash: 1240, isToday: true },
];

// Invoice collection
const INVOICES = [
  { id: 'INV-960340', customer: 'ALI A&R',       amount: 561.44, status: 'collected' as const },
  { id: 'INV-960339', customer: 'WAQAS Trading', amount: 56.00,  status: 'collected' as const },
  { id: 'INV-960336', customer: 'Janan Motors',  amount: 281.00, status: 'collected' as const },
  { id: 'INV-960335', customer: 'WAQAS Trading', amount: 167.28, status: 'collected' as const },
  { id: 'INV-960334', customer: 'Leo Tire',      amount: 56.16,  status: 'collected' as const },
  { id: 'INV-000015', customer: 'Mobil Centre',  amount: 328.00, status: 'pending' as const },
  { id: 'INV-000016', customer: 'Hassan Parts',  amount: 415.00, status: 'pending' as const },
  { id: 'INV-000017', customer: 'Gulf Lube Co.', amount: 346.00, status: 'pending' as const },
];

// Activity feed (timeline). Active=true on the last item for pulse.
const FEED = [
  { time: '08:14', icon: '🚀', event: 'Van 01 departed depot',                    badge: 'Start',  badgeBg: 'rgba(79,142,247,.18)',  badgeColor: '#93C5FD', dot: '#4F8EF7' },
  { time: '08:52', icon: '💵', event: 'INV-960340 collected — $561.44 cash',     badge: 'Done',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC', dot: '#22C55E' },
  { time: '09:31', icon: '✅', event: 'INV-960339 delivered + paid $56.00',       badge: 'Done',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC', dot: '#22C55E' },
  { time: '10:15', icon: '⚠️', event: 'Low stock — Mobil 5W30 (3 units left)',    badge: 'Alert',  badgeBg: 'rgba(245,158,11,.18)',  badgeColor: '#FCD34D', dot: '#F59E0B' },
  { time: '11:02', icon: '💵', event: 'INV-960336 collected — $281.00',           badge: 'Done',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC', dot: '#22C55E' },
  { time: '11:44', icon: '💵', event: 'INV-960335 + INV-960334 collected',        badge: 'Done',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC', dot: '#22C55E' },
  { time: '12:30', icon: '✅', event: 'Stop 5 complete — Leo Tire',               badge: 'Done',   badgeBg: 'rgba(34,197,94,.18)',   badgeColor: '#86EFAC', dot: '#22C55E' },
  { time: '13:15', icon: '📍', event: 'Arrived Stop 6 — Mobil Centre',            badge: 'Active', badgeBg: 'rgba(245,158,11,.18)',  badgeColor: '#FCD34D', dot: '#F59E0B', active: true },
];

// ─── Helpers ────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function stopStatusBadge(status: string) {
  if (status === 'delivered')   return { label: 'Delivered',    bg: 'rgba(34,197,94,.18)',  color: '#86EFAC', dot: '#22C55E' };
  if (status === 'in_progress') return { label: 'In Progress',  bg: 'rgba(245,158,11,.18)', color: '#FCD34D', dot: '#F59E0B' };
  return                              { label: 'Pending',      bg: 'rgba(255,255,255,.06)', color: 'var(--color-redwood-text-muted)', dot: 'rgba(255,255,255,.3)' };
}

function stockColor(units: number, max: number) {
  const pct = units / max;
  if (pct > 0.5)  return '#22C55E';
  if (pct > 0.25) return '#F59E0B';
  return '#EF4444';
}

// ─── Card frame (KPI w/ stripe + sparkline area) ────────────────
function kpiCard(cfg: {
  stripe: string;
  icon: string;
  label: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  value: string;
  valueColor: string;
  spark: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--color-redwood-bg-surface)',
      border: '1px solid var(--color-redwood-border)',
      borderRadius: '12px',
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: '3px',
        background: cfg.stripe,
        borderRadius: '12px 12px 0 0',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--color-redwood-text-muted)' }}>
          <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
          {cfg.label}
        </div>
        <span style={{
          fontSize: '8px', fontWeight: 700, padding: '2px 6px',
          borderRadius: '999px', background: cfg.badgeBg, color: cfg.badgeColor,
        }}>{cfg.badge}</span>
      </div>
      <div style={{
        fontSize: '24px', fontWeight: 700,
        color: cfg.valueColor,
        fontFamily: "'Syne',sans-serif",
        lineHeight: '1.05',
        letterSpacing: '-0.5px',
      }}>{cfg.value}</div>
      <div style={{ height: '40px', margin: '0 -6px -2px' }}>{cfg.spark}</div>
    </div>
  );
}

export default function VanDriverDashboard() {
  const navigate = useNavigate();

  // Responsive layout state — same ResizeObserver pattern as the
  // other dashboards.
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

  const collected = INVOICES.filter((i) => i.status === 'collected').reduce((s, i) => s + i.amount, 0);
  const pending = INVOICES.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const total = collected + pending;
  const visibleStatus = DELIVERY_STATUS.filter((d) => d.value > 0);

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '80px' }}>

      {/* ────────── PAGE HEADER ────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: '20px', fontWeight: 600,
            color: 'var(--color-redwood-text-main)',
            display: 'flex', alignItems: 'center', gap: '8px',
            fontFamily: "'Syne',sans-serif", letterSpacing: '-0.5px',
          }}>
            🚐 Van Operations — Live Dashboard
          </h1>
          <p style={{ fontSize: '10.5px', color: 'var(--color-redwood-text-subtle)', margin: '3px 0 0' }}>
            Route tracking · Cash collection · Delivery status · Stock on van
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 9px', borderRadius: '999px',
              background: 'rgba(34,197,94,.12)',
              border: '1px solid rgba(34,197,94,.3)',
              color: '#86EFAC', fontSize: '9.5px', fontWeight: 600,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} className="animate-pulse" />
              Van 01 · Online
            </span>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 9px', borderRadius: '999px',
              background: 'rgba(79,142,247,.14)',
              border: '1px solid rgba(79,142,247,.3)',
              color: '#93C5FD', fontSize: '9.5px', fontWeight: 600,
            }}>
              📍 Waqas · Stop 6 of 13
            </span>
          </div>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            <button type="button" style={headerBtnGhost} onClick={() => window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer')}>
              Open in Maps →
            </button>
            <button type="button" style={headerBtnSolid} onClick={() => navigate('/sales/invoices/new')}>
              + New Delivery
            </button>
          </div>
        </div>
      </div>

      {/* ────────── ROW 1 — 4 KPI cards with sparklines ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi},1fr)`, gap: '9px' }}>
        {kpiCard({
          stripe: 'linear-gradient(90deg,#22C55E,#86EFAC)',
          icon: '💵',
          label: 'Cash Collected',
          badge: '44%',
          badgeBg: 'rgba(245,158,11,.18)', badgeColor: '#FCD34D',
          value: '$1,240',
          valueColor: '#22C55E',
          spark: (
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={CASH_SPARK}>
                <Area type="monotone" dataKey="v" stroke="#22C55E" fill="rgba(34,197,94,0.15)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ),
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#4F8EF7,#93C5FD)',
          icon: '📦',
          label: 'Deliveries',
          badge: 'Active',
          badgeBg: 'rgba(34,197,94,.18)', badgeColor: '#86EFAC',
          value: '8',
          valueColor: '#4F8EF7',
          spark: (
            <ResponsiveContainer width="100%" height={40}>
              <BarChart data={DELIV_BARS}>
                <Bar dataKey="v" fill="#4F8EF7" fillOpacity={0.7} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ),
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#F59E0B,#FCD34D)',
          icon: '🗃',
          label: 'Stock on Van',
          badge: 'Live',
          badgeBg: 'rgba(79,142,247,.18)', badgeColor: '#93C5FD',
          value: '43 units',
          valueColor: '#F59E0B',
          spark: (
            <ResponsiveContainer width="100%" height={40}>
              <AreaChart data={STOCK_SPARK}>
                <Area type="monotone" dataKey="v" stroke="#F59E0B" fill="rgba(245,158,11,0.15)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          ),
        })}
        {kpiCard({
          stripe: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
          icon: '🗺',
          label: 'Route Progress',
          badge: 'On Route',
          badgeBg: 'rgba(79,142,247,.18)', badgeColor: '#93C5FD',
          value: '62%',
          valueColor: '#7C3AED',
          spark: (
            <ResponsiveContainer width="100%" height={48}>
              <RadialBarChart
                data={ROUTE_RADIAL}
                innerRadius="70%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar background={{ fill: 'rgba(124,58,237,0.15)' }} dataKey="value" cornerRadius={4} isAnimationActive={false} />
              </RadialBarChart>
            </ResponsiveContainer>
          ),
        })}
      </div>

      {/* ────────── ROW 2 ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? '1fr 0.9fr' : '1fr', gap: '10px' }}>

        {/* LEFT — Cash chart + Route stops + Map placeholder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Section A: Cash Collection Hourly */}
          <div style={panel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>
                💵 Cash Collection Progress
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-redwood-text-muted)' }}>
                Target: <span style={{ color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>$2,800</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={CASH_HOURLY} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="hour" tick={{ fill: '#8BA3C7', fontSize: 10 }} stroke="rgba(255,255,255,0.12)" />
                <YAxis tick={{ fill: '#8BA3C7', fontSize: 10 }} stroke="rgba(255,255,255,0.12)" />
                <Tooltip contentStyle={tooltipContentStyle} formatter={(v: number | undefined) => `$${fmt0(v ?? 0)}`} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#22C55E" fill="rgba(34,197,94,0.2)" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="target" name="Target pace" stroke="rgba(79,142,247,0.5)" strokeDasharray="4 4" strokeWidth={2} fill="none" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            {/* Custom inline legend (Recharts Legend overlays poorly at this size) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', fontSize: '9.5px', color: 'var(--color-redwood-text-muted)', marginTop: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '2px', background: '#22C55E', display: 'inline-block' }} /> Collected
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '2px', background: 'rgba(79,142,247,0.5)', display: 'inline-block' }} /> Target pace
              </span>
            </div>
          </div>

          {/* Section B: Route Stops + Map placeholder */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
              📍 Route Stops — Van 01
            </div>
            <div>
              {STOPS.map((s) => {
                const badge = stopStatusBadge(s.status);
                const isCurrent = s.status === 'in_progress';
                return (
                  <div key={s.n} style={{
                    display: 'flex', alignItems: 'center',
                    padding: '7px 10px',
                    background: isCurrent ? 'rgba(245,158,11,.08)' : 'var(--color-redwood-row-bg)',
                    border: '1px solid var(--color-redwood-border)',
                    borderLeft: isCurrent ? '3px solid var(--color-brand-amber)' : '1px solid var(--color-redwood-border)',
                    borderRadius: '7px',
                    marginBottom: '5px',
                    gap: '10px',
                    paddingLeft: isCurrent ? '8px' : '10px',
                  }}>
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '5px',
                      background: 'var(--color-redwood-bg-light)',
                      border: '1px solid var(--color-redwood-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700,
                      color: 'var(--color-redwood-text-main)',
                      flexShrink: 0,
                    }}>{s.n}</div>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-redwood-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.customer}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--color-redwood-text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.address}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-redwood-text-main)', fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>
                      ${s.amount}
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 600,
                      padding: '2px 7px', borderRadius: '999px',
                      background: badge.bg, color: badge.color,
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>{badge.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Map card */}
            <div style={{
              background: '#0a1726',
              border: '1px solid var(--color-redwood-border)',
              borderRadius: '9px',
              padding: '14px',
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '10px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--color-redwood-text-main)' }}>
                🗺 Live Map · Van 01 is at Stop 6 — Mobil Centre, 12 Oil Street
              </div>
              <button
                type="button"
                style={{ ...headerBtnGhost, marginTop: '4px' }}
                onClick={() => window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer')}
              >
                Open Google Maps →
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — 3 performance charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Card A — Delivery status donut */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '6px' }}>
              📊 Delivery Status
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={visibleStatus}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {visibleStatus.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="var(--color-redwood-bg-surface)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipContentStyle} />
              </PieChart>
            </ResponsiveContainer>
            {/* Inline legend with counts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', fontSize: '9.5px', color: 'var(--color-redwood-text-muted)', marginTop: '4px' }}>
              {DELIVERY_STATUS.map((d) => (
                <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.fill, display: 'inline-block' }} />
                  {d.name}: <span style={{ color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>{d.value}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Card B — Stock horizontal bar */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '6px' }}>
              📦 Stock Levels
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={STOCK_DATA} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: '#8BA3C7', fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
                <YAxis dataKey="name" type="category" tick={{ fill: '#8BA3C7', fontSize: 9 }} stroke="rgba(255,255,255,0.12)" width={80} />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Bar dataKey="units" isAnimationActive={false}>
                  {STOCK_DATA.map((d, i) => (
                    <Cell key={i} fill={stockColor(d.units, d.max)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Card C — This week */}
          <div style={panel}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '6px' }}>
              📈 This Week
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={WEEK} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: '#8BA3C7', fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
                <YAxis tick={{ fill: '#8BA3C7', fontSize: 9 }} stroke="rgba(255,255,255,0.12)" />
                <Tooltip contentStyle={tooltipContentStyle} formatter={(v: number | undefined) => `$${fmt0(v ?? 0)}`} />
                <Bar dataKey="cash" isAnimationActive={false}>
                  {WEEK.map((d, i) => (
                    <Cell key={i} fill={d.isToday ? '#22C55E' : '#4F8EF7'} fillOpacity={d.isToday ? 1 : 0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ────────── ROW 3 ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: cols.twoCol ? '1fr 0.9fr' : '1fr', gap: '10px' }}>

        {/* LEFT — Invoice collection table */}
        <div style={panel}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
            🧾 Invoices to Collect Today
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Invoice', 'Customer', 'Amount', 'Status'].map((h) => (
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
                        fontSize: '9.5px', fontFamily: "'DM Mono',monospace",
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
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
            marginTop: '10px', paddingTop: '8px',
            borderTop: '1px solid var(--color-redwood-border)',
            fontSize: '10px',
          }}>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>
              Collected: <span style={{ color: 'var(--color-brand-green)', fontWeight: 600 }}>${fmt0(collected)}</span>
            </span>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>
              Pending: <span style={{ color: 'var(--color-brand-amber)', fontWeight: 600 }}>${fmt0(pending)}</span>
            </span>
            <span style={{ color: 'var(--color-redwood-text-muted)' }}>
              Total: <span style={{ color: 'var(--color-redwood-text-main)', fontWeight: 600 }}>${fmt0(total)}</span>
            </span>
          </div>
        </div>

        {/* RIGHT — Activity Feed timeline */}
        <div style={panel}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-redwood-text-main)', marginBottom: '10px' }}>
            ⚡ Live Activity Feed
          </div>
          <div style={{ position: 'relative', paddingLeft: '22px' }}>
            {/* Vertical timeline line */}
            <div style={{
              position: 'absolute',
              top: '6px',
              bottom: '6px',
              left: '8px',
              width: '2px',
              background: 'rgba(79,142,247,0.3)',
            }} />
            {FEED.map((e, i) => (
              <div key={i} style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                background: i % 2 === 0 ? 'var(--color-redwood-row-bg)' : 'transparent',
                borderRadius: '5px',
                marginBottom: '4px',
              }}>
                {/* Dot on the timeline line */}
                <span
                  className={e.active ? 'animate-pulse' : ''}
                  style={{
                    position: 'absolute',
                    left: '-19px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: e.dot,
                    border: '2px solid var(--color-redwood-bg-surface)',
                    boxShadow: e.active ? '0 0 0 3px rgba(245,158,11,0.25)' : 'none',
                  }}
                />
                <span style={{
                  fontSize: '9.5px',
                  color: 'var(--color-redwood-text-subtle)',
                  fontFamily: "'DM Mono',monospace",
                  flexShrink: 0,
                  width: '36px',
                }}>{e.time}</span>
                <span style={{ fontSize: '12px', flexShrink: 0 }}>{e.icon}</span>
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

    </div>
  );
}
