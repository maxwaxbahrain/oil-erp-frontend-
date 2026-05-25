// ──────────────────────────────────────────────────────────────
// Field & Mobile — Employee Self Service
// Pure presentational ESS dashboard matching the Soltol One ERP
// design system. All data hardcoded — no services, hooks, or
// fetches per spec (~/Downloads/FIELD_MOBILE_MASTER_PROMPT.md).
//
// This page is mounted at /portal and is the destination of the
// AQ avatar click in the top nav. Real data persistence (payroll,
// leave requests, document upload) has been intentionally dropped
// per spec — the page is now a self-contained visual mockup.
// ──────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Download, Plus, ChevronRight, Users, Clock, Calendar, Megaphone } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
interface Employee {
  id: string;
  name: string;
  role: 'Office' | 'Van Driver' | 'Salesman' | 'Warehouse' | 'Admin';
  netPay: string;
  regularHours: number;
  overtimeHours: number;
  ptoDays: number;
  status: 'Active' | 'On route' | 'On leave' | 'Off today';
}

interface Payslip {
  month: string;
  hours: number;
  ot: number;
  amount: string;
  colorBg: string;
}

interface LeaveType {
  name: string;
  used: number;
  total: number;
  color: string;
}

interface Announcement {
  title: string;
  description: string;
  time: string;
  isNew: boolean;
  iconBg: string;
  icon: string;
}

interface Holiday {
  month: string;
  day: string;
  name: string;
  status: 'Confirmed' | 'Upcoming';
}

interface ESSState {
  regularHours: number;
  overtimeHours: number;
  savedMessage: boolean;
  activeTab: 'profile' | 'team' | 'payslips' | 'leave';
}

// ── Spec colour tokens (fallback hex so theme.css stays untouched) ─
const C = {
  bg:     'var(--bg, #060f1c)',
  bg3:    'var(--bg3, #0f1f33)',
  bg4:    'var(--bg4, #142540)',
  blue:   'var(--blue, #4F8EF7)',
  green:  'var(--green, #22C55E)',
  amber:  'var(--amber, #F59E0B)',
  t:      'var(--t, #EEF2FF)',
  t2:     'var(--t2, #8BA3C7)',
  t3:     'var(--t3, #3E5678)',
  br2:    'var(--br2, rgba(255,255,255,.12))',
  bd2:    'var(--bd2, rgba(255,255,255,.04))',
} as const;

// ── Role badge styles ─────────────────────────────────────────
const ROLE_STYLES = {
  'Office':     { bg: 'rgba(79,142,247,.12)',  text: '#4F8EF7' },
  'Van Driver': { bg: 'rgba(34,197,94,.12)',   text: '#22C55E' },
  'Salesman':   { bg: 'rgba(124,58,237,.12)',  text: '#7C3AED' },
  'Warehouse':  { bg: 'rgba(245,158,11,.12)',  text: '#F59E0B' },
  'Admin':      { bg: 'rgba(79,142,247,.12)',  text: '#4F8EF7' },
  'Finance':    { bg: 'rgba(245,158,11,.12)',  text: '#F59E0B' },
  'Manager':    { bg: 'rgba(155,111,228,.12)', text: '#9B6FE4' },
} as const;

const STATUS_COLORS: Record<string, string> = {
  'Active':   '#22C55E',
  'On route': '#F59E0B',
  'On leave': '#F59E0B',
  'Off today':'#EF4444',
};

// ── Hardcoded data ────────────────────────────────────────────
const EMPLOYEES: Employee[] = [
  { id: 'e1',  name: 'John Smith',       role: 'Office',     netPay: '$3,750', regularHours: 165, overtimeHours: 1,  ptoDays: 16, status: 'Active' },
  { id: 'e2',  name: 'Sarah Lee',        role: 'Van Driver', netPay: '$3,375', regularHours: 166, overtimeHours: 2,  ptoDays: 16, status: 'On route' },
  { id: 'e3',  name: 'Mike Johnson',     role: 'Salesman',   netPay: '$3,000', regularHours: 175, overtimeHours: 13, ptoDays: 16, status: 'Active' },
  { id: 'e4',  name: 'James Okonkwo',    role: 'Office',     netPay: '$2,640', regularHours: 156, overtimeHours: 4,  ptoDays: 16, status: 'Active' },
  { id: 'e5',  name: 'Priya Nair',       role: 'Van Driver', netPay: '$2,850', regularHours: 149, overtimeHours: 11, ptoDays: 12, status: 'On leave' },
  { id: 'e6',  name: 'Carlos Mendez',    role: 'Salesman',   netPay: '$3,150', regularHours: 146, overtimeHours: 6,  ptoDays: 16, status: 'Active' },
  { id: 'e7',  name: 'David Chen',       role: 'Office',     netPay: '$2,400', regularHours: 161, overtimeHours: 9,  ptoDays: 16, status: 'Active' },
  { id: 'e8',  name: 'Fatima Al-Hassan', role: 'Van Driver', netPay: '$3,600', regularHours: 144, overtimeHours: 6,  ptoDays: 16, status: 'Off today' },
  { id: 'e9',  name: 'Tom Reed',         role: 'Salesman',   netPay: '$2,520', regularHours: 151, overtimeHours: 11, ptoDays: 16, status: 'Active' },
  { id: 'e10', name: 'Anna Petrov',      role: 'Office',     netPay: '$2,700', regularHours: 163, overtimeHours: 5,  ptoDays: 16, status: 'Active' },
];

const PAYSLIPS: Payslip[] = [
  { month: 'May 2026',   hours: 165, ot: 1, amount: '$3,750', colorBg: 'rgba(34,197,94,.1)' },
  { month: 'April 2026', hours: 172, ot: 3, amount: '$3,890', colorBg: 'rgba(74,143,245,.1)' },
  { month: 'March 2026', hours: 168, ot: 0, amount: '$3,600', colorBg: 'rgba(124,58,237,.1)' },
];

const LEAVE_TYPES: LeaveType[] = [
  { name: 'Annual Leave (PTO)', used: 4, total: 20, color: '#22C55E' },
  { name: 'Sick Leave',         used: 2, total: 7,  color: '#F59E0B' },
  { name: 'Emergency Leave',    used: 0, total: 3,  color: '#4F8EF7' },
];

const ANNOUNCEMENTS: Announcement[] = [
  { title: 'Open enrollment for benefits',
    description: 'Review health and dental options and submit choices before the deadline.',
    isNew: true,  time: '2 hours ago',  iconBg: 'rgba(239,68,68,.1)',  icon: '📌' },
  { title: 'Quarterly town hall',
    description: 'Join the all-hands meeting this Friday afternoon at 3pm.',
    isNew: false, time: 'Yesterday',    iconBg: 'rgba(34,197,94,.1)',  icon: '✅' },
  { title: 'New expense policy — June 1',
    description: 'All expenses over $50 require manager approval before submission.',
    isNew: false, time: '3 days ago',   iconBg: 'rgba(74,143,245,.1)', icon: '📋' },
];

const HOLIDAYS: Holiday[] = [
  { month: 'Dec', day: '31', name: "New Year's Day",   status: 'Confirmed' },
  { month: 'Jan', day: '19', name: 'MLK Jr. Day',       status: 'Confirmed' },
  { month: 'May', day: '25', name: 'Memorial Day',      status: 'Confirmed' },
  { month: 'Jul', day: '4',  name: 'Independence Day',  status: 'Upcoming' },
];

// ── Section divider ───────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)' }} />
      <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.8px' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,.07),transparent)' }} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function EmployeePortal() {
  const [state, setState] = useState<ESSState>({
    regularHours: 165,
    overtimeHours: 1,
    savedMessage: false,
    activeTab: 'profile',
  });

  const [cols, setCols] = useState({
    kpi: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 4 : 2,
    twoCol: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  });

  useEffect(() => {
    const update = () =>
      setCols({
        kpi: window.innerWidth >= 1024 ? 4 : 2,
        twoCol: window.innerWidth >= 768,
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  function handleSave() {
    setState(s => ({ ...s, savedMessage: true }));
    setTimeout(() => {
      setState(s => ({ ...s, savedMessage: false }));
    }, 2000);
  }

  const card = {
    background: C.bg3,
    border: `1px solid ${C.br2}`,
    borderRadius: 12,
    padding: 16,
  } as const;

  // KPI cards — coloured top stripe + lucide icon + badge
  const KPIS = [
    { stripe: '#4F8EF7', value: '10',     label: 'Total Employees',           sub: '3 roles · all active',  badge: 'Active',     badgeBg: 'rgba(79,142,247,.12)',  badgeColor: '#4F8EF7', Icon: Users },
    { stripe: '#22C55E', value: '1,536',  label: 'Hours Logged (this month)', sub: 'avg 153.6 per person', badge: 'This month', badgeBg: 'rgba(34,197,94,.12)',   badgeColor: '#22C55E', Icon: Clock },
    { stripe: '#F59E0B', value: '2',      label: 'Leave Requests',            sub: 'awaiting approval',     badge: 'Pending',    badgeBg: 'rgba(245,158,11,.12)',  badgeColor: '#F59E0B', Icon: Calendar },
    { stripe: '#7C3AED', value: '$29.8k', label: 'Total Payroll Est.',        sub: 'salary + overtime',     badge: 'May 2026',   badgeBg: 'rgba(124,58,237,.12)',  badgeColor: '#7C3AED', Icon: Download },
  ];

  return (
    <div style={{ background: C.bg, color: C.t, minHeight: '100%' }}>
      {/* Page header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.br2}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, color: C.t,
              display: 'flex', alignItems: 'center', gap: 8,
              margin: 0,
            }}>
              <span aria-hidden>📱</span> Field &amp; Mobile — Employee Self Service
            </h1>
            <p style={{ fontSize: 12, color: C.t2, marginTop: 4 }}>
              My profile · Hours · Payslips · Leave · Team snapshot · Announcements
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              style={{
                background: 'transparent',
                border: `1px solid ${C.br2}`,
                borderRadius: 8, padding: '6px 13px', fontSize: 11,
                color: C.t2, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'inherit',
              }}
            >
              <Download size={12} /> View Payslips
            </button>
            <button
              type="button"
              style={{
                background: '#4F8EF7', color: '#fff', border: 'none',
                borderRadius: 8, padding: '6px 13px', fontSize: 11,
                fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'inherit',
              }}
            >
              <Plus size={12} /> New Employee
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px 20px' }}>
        {/* SECTION 1 — KPI row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols.kpi},1fr)`,
          gap: 10,
        }}>
          {KPIS.map((k, i) => {
            const Icon = k.Icon;
            return (
              <div
                key={i}
                style={{
                  background: C.bg3,
                  border: `1px solid ${C.br2}`,
                  borderRadius: 10,
                  padding: '11px 13px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: 2.5, background: k.stripe,
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: k.stripe, lineHeight: 1.15 }}>
                      {k.value}
                    </div>
                    <div style={{ fontSize: 10.5, color: C.t2, marginTop: 2, lineHeight: 1.3 }}>
                      {k.label}
                    </div>
                    <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>{k.sub}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                    <Icon size={14} color={k.stripe} />
                    <span style={{
                      fontSize: 8.5, fontWeight: 700,
                      background: k.badgeBg, color: k.badgeColor,
                      padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap',
                    }}>
                      {k.badge}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SECTION 2 — Profile + Hours */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
          gap: 12,
          marginTop: 12,
        }}>
          {/* Profile */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg,#4F8EF7,#7C3AED)',
                color: '#fff', fontSize: 16, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                AQ
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.t }}>Abdul Qadeer</div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: ROLE_STYLES.Office.bg, color: ROLE_STYLES.Office.text,
                  padding: '2px 8px', borderRadius: 10,
                  display: 'inline-block', marginTop: 4,
                }}>
                  Office
                </span>
              </div>
            </div>
            <InfoRow label="Employee ID" value="EMP-001" />
            <InfoRow label="Department"  value="Management" />
            <InfoRow label="Start date"  value="Jan 2023" />
            <InfoRow label="PTO balance" value="16 days" valueColor={C.green} />
            <InfoRow label="Sick leave"  value="5 days"  valueColor={C.amber} />
            <InfoRow
              label="Status"
              value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                  Active
                </span>
              }
              valueColor={C.green}
              isLast
            />
          </div>

          {/* Hours card */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t }}>Hours — May 2026</span>
              <button
                type="button"
                style={{
                  background: 'transparent', border: 'none',
                  color: C.blue, fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 3,
                  fontFamily: 'inherit',
                }}
              >
                View all <ChevronRight size={11} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <MetricBox label="Regular hours" value="165" valueColor={C.blue}  sub="of 176 target"   pct={93} barColor={C.blue} />
              <MetricBox label="Overtime"      value="1"   valueColor={C.amber} sub="hours this month" pct={10} barColor={C.amber} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 6 }}>Update hours</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input
                  type="number"
                  value={state.regularHours}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setState(s => ({ ...s, regularHours: val }));
                  }}
                  style={{
                    background: C.bg4, border: `1px solid ${C.br2}`,
                    borderRadius: 7, padding: '6px 10px', fontSize: 12,
                    color: C.t, textAlign: 'center', fontWeight: 600,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <input
                  type="number"
                  value={state.overtimeHours}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setState(s => ({ ...s, overtimeHours: val }));
                  }}
                  style={{
                    background: C.bg4, border: `1px solid ${C.br2}`,
                    borderRadius: 7, padding: '6px 10px', fontSize: 12,
                    color: C.t, textAlign: 'center', fontWeight: 600,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              style={{
                width: '100%',
                background: state.savedMessage ? C.green : '#4F8EF7',
                color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px', fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
                transition: 'background .15s',
                fontFamily: 'inherit',
              }}
            >
              {state.savedMessage ? '✓ Saved!' : 'Save Hours'}
            </button>
          </div>
        </div>

        {/* SECTION 3 — Team snapshot */}
        <SectionDivider label="TEAM SNAPSHOT — PAYROLL & HOURS" />
        <div style={{
          background: C.bg3,
          border: `1px solid ${C.br2}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Est. Net', 'Hours (May 2026)', 'PTO Days', 'Status'].map(h => (
                    <th key={h} style={{
                      fontSize: 10, color: C.t3, fontWeight: 700,
                      letterSpacing: '.5px', padding: '8px 10px',
                      borderBottom: `1px solid ${C.br2}`,
                      textTransform: 'uppercase',
                      textAlign: 'left',
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EMPLOYEES.map(emp => {
                  const roleStyle = ROLE_STYLES[emp.role as keyof typeof ROLE_STYLES];
                  const roleBg = roleStyle?.bg ?? 'rgba(255,255,255,.06)';
                  const roleText = roleStyle?.text ?? C.t2;
                  const ptoColor = emp.ptoDays < 14 ? C.amber : C.t;
                  const statusColor = STATUS_COLORS[emp.status] ?? '#3E5678';
                  return (
                    <tr
                      key={emp.id}
                      style={{ fontSize: 12, color: C.t, transition: 'background .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`, whiteSpace: 'nowrap' }}>
                        {emp.name}
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: roleBg, color: roleText,
                          padding: '2px 7px', borderRadius: 8,
                          whiteSpace: 'nowrap',
                        }}>
                          {emp.role}
                        </span>
                      </td>
                      <td style={{
                        padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`,
                        color: C.green, fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {emp.netPay}
                      </td>
                      <td style={{
                        padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`,
                        color: C.t2, whiteSpace: 'nowrap',
                      }}>
                        {emp.regularHours} reg + {emp.overtimeHours} OT
                      </td>
                      <td style={{
                        padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`,
                        color: ptoColor, fontWeight: 600,
                      }}>
                        {emp.ptoDays}
                      </td>
                      <td style={{
                        padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.t }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: statusColor,
                          }} />
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4 — Payslips + Leave */}
        <SectionDivider label="PAYSLIPS · LEAVE · ANNOUNCEMENTS · HOLIDAYS" />
        <div style={{
          display: 'grid',
          gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
          gap: 12,
        }}>
          {/* Payslips */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden>📄</span> My Payslips
              </span>
              <span style={{ fontSize: 10, color: C.t3 }}>last 3 months</span>
            </div>
            {PAYSLIPS.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < PAYSLIPS.length - 1 ? `1px solid ${C.bd2}` : 'none',
                  cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: p.colorBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>
                  📋
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{p.month}</div>
                  <div style={{ fontSize: 10, color: C.t2 }}>
                    {p.hours} hrs · {p.ot} OT · {p.amount} est.
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                  {p.amount}
                </div>
                <button
                  type="button"
                  style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 8,
                    background: 'rgba(74,143,245,.12)',
                    border: '1px solid rgba(74,143,245,.25)',
                    color: '#4F8EF7', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 3,
                    whiteSpace: 'nowrap', fontFamily: 'inherit',
                  }}
                >
                  <Download size={9} /> PDF
                </button>
              </div>
            ))}
          </div>

          {/* Leave Balance */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden>🌴</span> Leave Balance
              </span>
              <span style={{ fontSize: 10, color: C.t3 }}>2026 allocation</span>
            </div>
            {LEAVE_TYPES.map((lt, i) => {
              const remaining = lt.total - lt.used;
              const pct = lt.total === 0 ? 0 : Math.min(100, Math.round((remaining / lt.total) * 100));
              return (
                <div
                  key={i}
                  style={{
                    padding: '8px 0',
                    borderBottom: i < LEAVE_TYPES.length - 1 ? `1px solid ${C.bd2}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{lt.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: lt.color }}>
                      {remaining} days left
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 4, gap: 8,
                  }}>
                    <span style={{ fontSize: 10, color: C.t3 }}>
                      Used: {lt.used} of {lt.total} days
                    </span>
                    <button
                      type="button"
                      style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 8,
                        background: 'rgba(74,143,245,.12)',
                        border: '1px solid rgba(74,143,245,.25)',
                        color: '#4F8EF7', cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Request
                    </button>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 6, height: 7, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`, height: 7, borderRadius: 6,
                      background: lt.color, transition: 'width .8s',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5 — Announcements + Holidays */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: cols.twoCol ? '1fr 1fr' : '1fr',
          gap: 12,
          marginTop: 12,
        }}>
          {/* Announcements */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Megaphone size={13} /> Company Announcements
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                background: 'rgba(239,68,68,.15)', color: '#EF4444',
                padding: '2px 7px', borderRadius: 10,
              }}>
                1 NEW
              </span>
            </div>
            {ANNOUNCEMENTS.map((a, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, padding: '10px 0',
                borderBottom: i < ANNOUNCEMENTS.length - 1 ? `1px solid ${C.bd2}` : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: a.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{a.title}</span>
                    {a.isNew && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        background: 'rgba(239,68,68,.15)', color: '#EF4444',
                        padding: '1px 6px', borderRadius: 8,
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4, marginTop: 2 }}>
                    {a.description}
                  </div>
                  <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Holidays */}
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span aria-hidden>🗓</span> Upcoming Holidays
              </span>
              <span style={{ fontSize: 10, color: C.t3 }}>company closed</span>
            </div>
            {HOLIDAYS.map((h, i) => {
              const isConfirmed = h.status === 'Confirmed';
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                  borderBottom: i < HOLIDAYS.length - 1 ? `1px solid ${C.bd2}` : 'none',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: C.bg3, border: `1px solid ${C.br2}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: C.t3,
                      textTransform: 'uppercase', lineHeight: 1,
                    }}>
                      {h.month}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.t, lineHeight: 1.05 }}>
                      {h.day}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.t }}>{h.name}</div>
                    <div style={{ fontSize: 10, color: C.t2 }}>Company closed</div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    background: isConfirmed ? 'rgba(34,197,94,.1)' : 'rgba(74,143,245,.1)',
                    color: isConfirmed ? '#22C55E' : '#4F8EF7',
                    padding: '3px 8px', borderRadius: 10,
                    flexShrink: 0,
                  }}>
                    {h.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────
function InfoRow({
  label, value, valueColor, isLast,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  isLast?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0',
      borderBottom: isLast ? 'none' : `1px solid ${C.bd2}`,
      fontSize: 12,
    }}>
      <span style={{ color: C.t3 }}>{label}</span>
      <span style={{ color: valueColor ?? C.t, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function MetricBox({
  label, value, valueColor, sub, pct, barColor,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
  pct: number;
  barColor: string;
}) {
  return (
    <div style={{
      background: C.bg4,
      border: `1px solid ${C.br2}`,
      borderRadius: 8,
      padding: '9px 10px',
    }}>
      <div style={{
        fontSize: 10, color: C.t3,
        textTransform: 'uppercase', letterSpacing: '.4px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700, color: valueColor,
        lineHeight: 1.1, marginTop: 2,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: C.t2, marginBottom: 6 }}>{sub}</div>
      <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 6, height: 7, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: 7, borderRadius: 6,
          background: barColor, transition: 'width .8s',
        }} />
      </div>
    </div>
  );
}
