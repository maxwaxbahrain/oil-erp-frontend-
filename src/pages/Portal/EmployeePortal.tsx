// ──────────────────────────────────────────────────────────────
// Field & Mobile — Employee Self Service
// Pure presentational ESS dashboard matching the Soltol One ERP
// design system. All data hardcoded — no services, hooks, or
// fetches per spec.
//
// Interactivity (this build):
//   · "+ New Employee" opens Add modal, pushes into local state
//   · Row "✏ Edit" opens Edit modal pre-filled, updates in place
//   · Row "👤 View" or name click opens 3-tab profile side panel
//   · "⬇ PDF" payslip buttons fire a green toast
//   · Leave "Request" buttons open a leave-request modal (toast on submit)
//   · "Save Hours" toggles to green "✓ Saved!" for 2s
//   · "View all →" scrolls to the team snapshot table
//
// All mutations are LOCAL — nothing persists. The component is still
// a self-contained mockup; the real persistence services that used
// to back this page remain on disk and untouched.
// ──────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import {
  Download, Plus, ChevronRight, Users, Clock, Calendar,
  Megaphone, X, Edit2, Eye,
} from 'lucide-react';

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
  department?: string;
  startDate?: string;
  email?: string;
  phone?: string;
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

interface NewEmployeeForm {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  startDate: string;
  regularHours: number;
  overtimeHours: number;
  ptoDays: number;
  netPay: string;
  status: string;
}

interface ESSState {
  regularHours: number;
  overtimeHours: number;
  savedMessage: boolean;
  showAddModal: boolean;
  showEditModal: boolean;
  editingEmployee: Employee | null;
  selectedEmployee: Employee | null;
  showProfile: boolean;
  profileTab: 'overview' | 'hours' | 'payslips';
  showLeaveModal: boolean;
  leaveModalType: string;
  leaveStart: string;
  leaveEnd: string;
  leaveReason: string;
  leaveCover: string;
  toast: string;
  employees: Employee[];
  newEmp: NewEmployeeForm;
}

const VALID_ROLES = ['Office', 'Van Driver', 'Salesman', 'Warehouse', 'Admin'] as const;
const VALID_STATUSES = ['Active', 'On route', 'On leave', 'Off today'] as const;
const ROLE_OPTIONS: string[] = ['Office', 'Van Driver', 'Salesman', 'Warehouse', 'Admin', 'Finance', 'Manager'];
const STATUS_OPTIONS: string[] = ['Active', 'On route', 'On leave', 'Off today'];

const EMPTY_NEW_EMP: NewEmployeeForm = {
  name: '', role: 'Office', department: '', email: '', phone: '',
  startDate: '', regularHours: 176, overtimeHours: 0, ptoDays: 20,
  netPay: '', status: 'Active',
};

// ── Spec colour tokens (fallback hex so theme.css stays untouched) ─
const C = {
  bg:     'var(--bg, #060f1c)',
  bg2:    'var(--bg2, #0a1726)',
  bg3:    'var(--bg3, #0f1f33)',
  bg4:    'var(--bg4, #142540)',
  blue:   'var(--blue, #4F8EF7)',
  green:  'var(--green, #22C55E)',
  amber:  'var(--amber, #F59E0B)',
  purple: 'var(--purple, #7C3AED)',
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
  { id: 'e1',  name: 'John Smith',       role: 'Office',     netPay: '$3,750', regularHours: 165, overtimeHours: 1,  ptoDays: 16, status: 'Active',    department: 'Operations',  startDate: 'Jan 2023', email: 'john.smith@soltol.com',       phone: '+971 50 123 4567' },
  { id: 'e2',  name: 'Sarah Lee',        role: 'Van Driver', netPay: '$3,375', regularHours: 166, overtimeHours: 2,  ptoDays: 16, status: 'On route',  department: 'Logistics',   startDate: 'Mar 2022', email: 'sarah.lee@soltol.com',        phone: '+971 50 234 5678' },
  { id: 'e3',  name: 'Mike Johnson',     role: 'Salesman',   netPay: '$3,000', regularHours: 175, overtimeHours: 13, ptoDays: 16, status: 'Active',    department: 'Sales',       startDate: 'Sep 2021', email: 'mike.johnson@soltol.com',     phone: '+971 50 345 6789' },
  { id: 'e4',  name: 'James Okonkwo',    role: 'Office',     netPay: '$2,640', regularHours: 156, overtimeHours: 4,  ptoDays: 16, status: 'Active',    department: 'Operations',  startDate: 'May 2023', email: 'james.okonkwo@soltol.com',    phone: '+971 50 456 7890' },
  { id: 'e5',  name: 'Priya Nair',       role: 'Van Driver', netPay: '$2,850', regularHours: 149, overtimeHours: 11, ptoDays: 12, status: 'On leave',  department: 'Logistics',   startDate: 'Feb 2023', email: 'priya.nair@soltol.com',       phone: '+971 50 567 8901' },
  { id: 'e6',  name: 'Carlos Mendez',    role: 'Salesman',   netPay: '$3,150', regularHours: 146, overtimeHours: 6,  ptoDays: 16, status: 'Active',    department: 'Sales',       startDate: 'Aug 2022', email: 'carlos.mendez@soltol.com',    phone: '+971 50 678 9012' },
  { id: 'e7',  name: 'David Chen',       role: 'Office',     netPay: '$2,400', regularHours: 161, overtimeHours: 9,  ptoDays: 16, status: 'Active',    department: 'Finance',     startDate: 'Apr 2024', email: 'david.chen@soltol.com',       phone: '+971 50 789 0123' },
  { id: 'e8',  name: 'Fatima Al-Hassan', role: 'Van Driver', netPay: '$3,600', regularHours: 144, overtimeHours: 6,  ptoDays: 16, status: 'Off today', department: 'Logistics',   startDate: 'Nov 2022', email: 'fatima.alhassan@soltol.com',  phone: '+971 50 890 1234' },
  { id: 'e9',  name: 'Tom Reed',         role: 'Salesman',   netPay: '$2,520', regularHours: 151, overtimeHours: 11, ptoDays: 16, status: 'Active',    department: 'Sales',       startDate: 'Jun 2023', email: 'tom.reed@soltol.com',         phone: '+971 50 901 2345' },
  { id: 'e10', name: 'Anna Petrov',      role: 'Office',     netPay: '$2,700', regularHours: 163, overtimeHours: 5,  ptoDays: 16, status: 'Active',    department: 'HR',          startDate: 'Jan 2024', email: 'anna.petrov@soltol.com',      phone: '+971 50 012 3456' },
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

// ── Helpers ───────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)' }} />
      <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, letterSpacing: '.8px' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,rgba(255,255,255,.07),transparent)' }} />
    </div>
  );
}

function clampRole(r: string): Employee['role'] {
  return (VALID_ROLES as readonly string[]).includes(r) ? (r as Employee['role']) : 'Office';
}
function clampStatus(s: string): Employee['status'] {
  return (VALID_STATUSES as readonly string[]).includes(s) ? (s as Employee['status']) : 'Active';
}

function recentActivity(emp: Employee) {
  const items: { icon: string; text: string; time: string }[] = [
    { icon: '💰', text: `Payslip processed — April 2026`, time: '5 days ago' },
    { icon: '📋', text: `Hours submitted for May 2026`, time: '1 week ago' },
  ];
  if (emp.role === 'Van Driver') {
    items.unshift({ icon: '✅', text: 'Completed 13-stop delivery route', time: '2 days ago' });
  }
  return items;
}

function hoursHistory(emp: Employee) {
  return [
    { month: 'May 2026',   reg: emp.regularHours,                  ot: emp.overtimeHours,     status: 'Submitted' as const },
    { month: 'April 2026', reg: Math.max(0, emp.regularHours - 7), ot: emp.overtimeHours + 2, status: 'Approved'  as const },
    { month: 'March 2026', reg: emp.regularHours + 8,              ot: 0,                     status: 'Approved'  as const },
    { month: 'Feb 2026',   reg: Math.max(0, emp.regularHours - 3), ot: emp.overtimeHours + 1, status: 'Approved'  as const },
  ];
}

// ── Main component ───────────────────────────────────────────
export default function EmployeePortal() {
  const [state, setState] = useState<ESSState>({
    regularHours: 165,
    overtimeHours: 1,
    savedMessage: false,
    showAddModal: false,
    showEditModal: false,
    editingEmployee: null,
    selectedEmployee: null,
    showProfile: false,
    profileTab: 'overview',
    showLeaveModal: false,
    leaveModalType: '',
    leaveStart: '',
    leaveEnd: '',
    leaveReason: '',
    leaveCover: '',
    toast: '',
    employees: [...EMPLOYEES],
    newEmp: { ...EMPTY_NEW_EMP },
  });

  const [cols, setCols] = useState({
    kpi: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 4 : 2,
    twoCol: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
    formTwoCol: typeof window !== 'undefined' ? window.innerWidth >= 540 : true,
  });

  const teamTableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () =>
      setCols({
        kpi: window.innerWidth >= 1024 ? 4 : 2,
        twoCol: window.innerWidth >= 768,
        formTwoCol: window.innerWidth >= 540,
      });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => setState(s => ({ ...s, toast: '' })), 2500);
    return () => clearTimeout(t);
  }, [state.toast]);

  // ESC closes any open modal/overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setState(s => {
        if (s.showProfile)    return { ...s, showProfile: false, selectedEmployee: null };
        if (s.showAddModal)   return { ...s, showAddModal: false, newEmp: { ...EMPTY_NEW_EMP } };
        if (s.showEditModal)  return { ...s, showEditModal: false, editingEmployee: null, newEmp: { ...EMPTY_NEW_EMP } };
        if (s.showLeaveModal) return { ...s, showLeaveModal: false };
        return s;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function handleSave() {
    setState(s => ({ ...s, savedMessage: true }));
    setTimeout(() => setState(s => ({ ...s, savedMessage: false })), 2000);
  }

  function openAddModal() {
    setState(s => ({ ...s, showAddModal: true, newEmp: { ...EMPTY_NEW_EMP } }));
  }
  function closeAddModal() {
    setState(s => ({ ...s, showAddModal: false, newEmp: { ...EMPTY_NEW_EMP } }));
  }

  function openEditModal(emp: Employee) {
    setState(s => ({
      ...s,
      showEditModal: true,
      editingEmployee: emp,
      newEmp: {
        name: emp.name,
        role: emp.role,
        department: emp.department ?? '',
        email: emp.email ?? '',
        phone: emp.phone ?? '',
        startDate: emp.startDate ?? '',
        regularHours: emp.regularHours,
        overtimeHours: emp.overtimeHours,
        ptoDays: emp.ptoDays,
        netPay: emp.netPay,
        status: emp.status,
      },
    }));
  }
  function closeEditModal() {
    setState(s => ({ ...s, showEditModal: false, editingEmployee: null, newEmp: { ...EMPTY_NEW_EMP } }));
  }

  function handleAddEmployee() {
    if (!state.newEmp.name.trim()) return;
    const id = 'e' + (state.employees.length + 1);
    const fresh: Employee = {
      id,
      name: state.newEmp.name.trim(),
      role: clampRole(state.newEmp.role),
      netPay: state.newEmp.netPay || '$0',
      regularHours: state.newEmp.regularHours,
      overtimeHours: state.newEmp.overtimeHours,
      ptoDays: state.newEmp.ptoDays,
      status: clampStatus(state.newEmp.status),
      department: state.newEmp.department,
      startDate: state.newEmp.startDate,
      email: state.newEmp.email,
      phone: state.newEmp.phone,
    };
    setState(s => ({
      ...s,
      employees: [...s.employees, fresh],
      showAddModal: false,
      newEmp: { ...EMPTY_NEW_EMP },
      toast: 'Employee added successfully',
    }));
  }

  function handleSaveEdit() {
    if (!state.editingEmployee || !state.newEmp.name.trim()) return;
    const id = state.editingEmployee.id;
    setState(s => ({
      ...s,
      employees: s.employees.map(e =>
        e.id === id
          ? {
              ...e,
              name: s.newEmp.name.trim(),
              role: clampRole(s.newEmp.role),
              status: clampStatus(s.newEmp.status),
              netPay: s.newEmp.netPay || e.netPay,
              regularHours: s.newEmp.regularHours,
              overtimeHours: s.newEmp.overtimeHours,
              ptoDays: s.newEmp.ptoDays,
              department: s.newEmp.department,
              startDate: s.newEmp.startDate,
              email: s.newEmp.email,
              phone: s.newEmp.phone,
            }
          : e
      ),
      showEditModal: false,
      editingEmployee: null,
      newEmp: { ...EMPTY_NEW_EMP },
      toast: 'Employee updated',
    }));
  }

  function openProfile(emp: Employee) {
    setState(s => ({ ...s, selectedEmployee: emp, showProfile: true, profileTab: 'overview' }));
  }
  function closeProfile() {
    setState(s => ({ ...s, selectedEmployee: null, showProfile: false }));
  }
  function editFromProfile() {
    if (!state.selectedEmployee) return;
    const emp = state.selectedEmployee;
    setState(s => ({
      ...s,
      showProfile: false,
      selectedEmployee: null,
      showEditModal: true,
      editingEmployee: emp,
      newEmp: {
        name: emp.name, role: emp.role,
        department: emp.department ?? '',
        email: emp.email ?? '',
        phone: emp.phone ?? '',
        startDate: emp.startDate ?? '',
        regularHours: emp.regularHours,
        overtimeHours: emp.overtimeHours,
        ptoDays: emp.ptoDays,
        netPay: emp.netPay,
        status: emp.status,
      },
    }));
  }

  function openLeaveModal(typeName: string) {
    setState(s => ({
      ...s,
      showLeaveModal: true,
      leaveModalType: typeName,
      leaveStart: '', leaveEnd: '', leaveReason: '', leaveCover: '',
    }));
  }
  function closeLeaveModal() {
    setState(s => ({ ...s, showLeaveModal: false }));
  }
  function handleLeaveSubmit() {
    setState(s => ({ ...s, showLeaveModal: false, toast: 'Leave request submitted for approval' }));
  }

  function downloadPdf(filename: string) {
    setState(s => ({ ...s, toast: `Downloading ${filename}...` }));
  }
  function exportProfilePdf() {
    if (!state.selectedEmployee) return;
    setState(s => ({ ...s, toast: `Downloading ${state.selectedEmployee?.name}_profile.pdf...` }));
  }

  function scrollToTeam() {
    teamTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Derived values ───────────────────────────────────────
  const totalEmps = state.employees.length;
  const totalActive = state.employees.filter(e => e.status === 'Active').length;
  const distinctRoles = new Set(state.employees.map(e => e.role)).size;
  const totalRegular = state.employees.reduce((sum, e) => sum + e.regularHours, 0);
  const totalOvertime = state.employees.reduce((sum, e) => sum + e.overtimeHours, 0);
  const totalHours = totalRegular + totalOvertime;
  const avgPerPerson = totalEmps > 0 ? (totalHours / totalEmps).toFixed(1) : '0';
  const totalPayrollNum = state.employees.reduce((sum, e) => {
    const n = parseFloat(e.netPay.replace(/[$,]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const totalPayrollFmt = totalPayrollNum >= 1000
    ? '$' + (totalPayrollNum / 1000).toFixed(1) + 'k'
    : '$' + totalPayrollNum.toFixed(0);

  // Leave-modal computed days
  const leaveDays = (() => {
    if (!state.leaveStart || !state.leaveEnd) return 0;
    const start = new Date(state.leaveStart).getTime();
    const end = new Date(state.leaveEnd).getTime();
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return Math.round((end - start) / 86400000) + 1;
  })();

  // KPIs (Total Employees, Hours Logged, Leave Requests, Total Payroll)
  const KPIS = [
    { stripe: '#4F8EF7', value: String(totalEmps),         label: 'Total Employees',           sub: `${distinctRoles} roles · ${totalActive} active`, badge: 'Active',     badgeBg: 'rgba(79,142,247,.12)',  badgeColor: '#4F8EF7', Icon: Users },
    { stripe: '#22C55E', value: totalHours.toLocaleString(), label: 'Hours Logged (this month)', sub: `avg ${avgPerPerson} per person`,                 badge: 'This month', badgeBg: 'rgba(34,197,94,.12)',   badgeColor: '#22C55E', Icon: Clock },
    { stripe: '#F59E0B', value: '2',                       label: 'Leave Requests',            sub: 'awaiting approval',                              badge: 'Pending',    badgeBg: 'rgba(245,158,11,.12)',  badgeColor: '#F59E0B', Icon: Calendar },
    { stripe: '#7C3AED', value: totalPayrollFmt,           label: 'Total Payroll Est.',        sub: 'salary + overtime',                              badge: 'May 2026',   badgeBg: 'rgba(124,58,237,.12)',  badgeColor: '#7C3AED', Icon: Download },
  ];

  const card = {
    background: C.bg3,
    border: `1px solid ${C.br2}`,
    borderRadius: 12,
    padding: 16,
  } as const;

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ background: C.bg, color: C.t, minHeight: '100%' }}>
      {/* Page header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.br2}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 700, color: C.t,
              display: 'flex', alignItems: 'center', gap: 8, margin: 0,
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
              onClick={() => downloadPdf('all_payslips.zip')}
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
              onClick={openAddModal}
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
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.kpi},1fr)`, gap: 10 }}>
          {KPIS.map((k, i) => {
            const Icon = k.Icon;
            return (
              <div
                key={i}
                style={{
                  background: C.bg3, border: `1px solid ${C.br2}`,
                  borderRadius: 10, padding: '11px 13px',
                  position: 'relative', overflow: 'hidden', cursor: 'pointer',
                  transition: 'transform .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: k.stripe }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: k.stripe, lineHeight: 1.15 }}>{k.value}</div>
                    <div style={{ fontSize: 10.5, color: C.t2, marginTop: 2, lineHeight: 1.3 }}>{k.label}</div>
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
          gap: 12, marginTop: 12,
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
                onClick={scrollToTeam}
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
                  style={numInputStyle}
                />
                <input
                  type="number"
                  value={state.overtimeHours}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setState(s => ({ ...s, overtimeHours: val }));
                  }}
                  style={numInputStyle}
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
                transition: 'background .15s', fontFamily: 'inherit',
              }}
            >
              {state.savedMessage ? '✓ Saved!' : 'Save Hours'}
            </button>
          </div>
        </div>

        {/* SECTION 3 — Team snapshot */}
        <div ref={teamTableRef}>
          <SectionDivider label="TEAM SNAPSHOT — PAYROLL & HOURS" />
        </div>
        <div style={{
          background: C.bg3, border: `1px solid ${C.br2}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Est. Net', 'Hours (May 2026)', 'PTO Days', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      fontSize: 10, color: C.t3, fontWeight: 700,
                      letterSpacing: '.5px', padding: '8px 10px',
                      borderBottom: `1px solid ${C.br2}`,
                      textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.employees.map(emp => {
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
                      <td
                        style={{
                          padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`,
                          whiteSpace: 'nowrap',
                          color: C.blue, fontWeight: 600, cursor: 'pointer',
                        }}
                        onClick={() => openProfile(emp)}
                      >
                        {emp.name}
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}` }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          background: roleBg, color: roleText,
                          padding: '2px 7px', borderRadius: 8, whiteSpace: 'nowrap',
                        }}>
                          {emp.role}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`, color: C.green, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {emp.netPay}
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`, color: C.t2, whiteSpace: 'nowrap' }}>
                        {emp.regularHours} reg + {emp.overtimeHours} OT
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`, color: ptoColor, fontWeight: 600 }}>
                        {emp.ptoDays}
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`, whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.t }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                          {emp.status}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', borderBottom: `1px solid ${C.bd2}`, whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => openProfile(emp)}
                          style={{
                            fontSize: 9, padding: '2px 7px', borderRadius: 8,
                            background: 'rgba(74,143,245,.12)',
                            border: '1px solid rgba(74,143,245,.25)',
                            color: '#4F8EF7', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontFamily: 'inherit',
                          }}
                        >
                          <Eye size={9} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(emp)}
                          style={{
                            fontSize: 9, padding: '2px 7px', borderRadius: 8, marginLeft: 4,
                            background: 'rgba(245,158,11,.12)',
                            border: '1px solid rgba(245,158,11,.25)',
                            color: '#F59E0B', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontFamily: 'inherit',
                          }}
                        >
                          <Edit2 size={9} /> Edit
                        </button>
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
                  cursor: 'pointer', transition: 'background .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: p.colorBg,
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
                  onClick={() => downloadPdf(`${p.month}_payslip.pdf`)}
                  style={pdfButtonStyle}
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: lt.color }}>{remaining} days left</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.t3 }}>Used: {lt.used} of {lt.total} days</span>
                    <button
                      type="button"
                      onClick={() => openLeaveModal(lt.name)}
                      style={requestButtonStyle}
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
          gap: 12, marginTop: 12,
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
                  width: 36, height: 36, borderRadius: 10, background: a.iconBg,
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
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', lineHeight: 1 }}>
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
                    padding: '3px 8px', borderRadius: 10, flexShrink: 0,
                  }}>
                    {h.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Toast (always rendered, fades in/out) ── */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 400,
          opacity: state.toast ? 1 : 0,
          transform: state.toast ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity .2s, transform .2s',
          pointerEvents: 'none',
          background: C.bg3,
          border: '1px solid rgba(34,197,94,.3)',
          borderRadius: 9, padding: '10px 14px',
          fontSize: 11, color: '#22C55E',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          maxWidth: '88vw',
        }}
      >
        <Download size={12} />
        <span>{state.toast || ' '}</span>
      </div>

      {/* ── Add Employee Modal ── */}
      {state.showAddModal && (
        <ModalOverlay onClose={closeAddModal}>
          <ModalCard>
            <ModalHeader title="➕ Add New Employee" onClose={closeAddModal} />
            <EmployeeFormFields
              value={state.newEmp}
              twoCol={cols.formTwoCol}
              onChange={next => setState(s => ({ ...s, newEmp: next }))}
            />
            <ModalFooter>
              <button type="button" onClick={closeAddModal} style={modalCancelBtn}>Cancel</button>
              <button
                type="button"
                onClick={handleAddEmployee}
                disabled={!state.newEmp.name.trim()}
                style={{
                  ...modalSubmitBtn,
                  opacity: state.newEmp.name.trim() ? 1 : 0.55,
                  cursor: state.newEmp.name.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Plus size={12} /> Add Employee
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Edit Employee Modal ── */}
      {state.showEditModal && state.editingEmployee && (
        <ModalOverlay onClose={closeEditModal}>
          <ModalCard>
            <ModalHeader
              title={`✏ Edit Employee — ${state.editingEmployee.name}`}
              onClose={closeEditModal}
            />
            <EmployeeFormFields
              value={state.newEmp}
              twoCol={cols.formTwoCol}
              onChange={next => setState(s => ({ ...s, newEmp: next }))}
            />
            <ModalFooter>
              <button type="button" onClick={closeEditModal} style={modalCancelBtn}>Cancel</button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!state.newEmp.name.trim()}
                style={{
                  ...modalSubmitBtn,
                  opacity: state.newEmp.name.trim() ? 1 : 0.55,
                  cursor: state.newEmp.name.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save Changes
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Leave Request Modal ── */}
      {state.showLeaveModal && (
        <ModalOverlay onClose={closeLeaveModal}>
          <ModalCard>
            <ModalHeader title={`🌴 Request Leave — ${state.leaveModalType}`} onClose={closeLeaveModal} />
            <div style={{ display: 'grid', gridTemplateColumns: cols.formTwoCol ? '1fr 1fr' : '1fr', gap: 10 }}>
              <FieldLabel label="Start Date">
                <input
                  type="date"
                  value={state.leaveStart}
                  onChange={e => setState(s => ({ ...s, leaveStart: e.target.value }))}
                  style={formInputStyle}
                />
              </FieldLabel>
              <FieldLabel label="End Date">
                <input
                  type="date"
                  value={state.leaveEnd}
                  onChange={e => setState(s => ({ ...s, leaveEnd: e.target.value }))}
                  style={formInputStyle}
                />
              </FieldLabel>
              <FieldLabel label="Days">
                <input
                  type="text"
                  readOnly
                  value={leaveDays}
                  style={{ ...formInputStyle, opacity: 0.7 }}
                />
              </FieldLabel>
              <div /> {/* spacer */}
              <FieldLabel label="Reason" full>
                <textarea
                  rows={3}
                  value={state.leaveReason}
                  onChange={e => setState(s => ({ ...s, leaveReason: e.target.value }))}
                  style={{ ...formInputStyle, resize: 'vertical', minHeight: 60, textAlign: 'left' }}
                />
              </FieldLabel>
              <FieldLabel label="Cover" full>
                <input
                  type="text"
                  placeholder="Who will cover your duties?"
                  value={state.leaveCover}
                  onChange={e => setState(s => ({ ...s, leaveCover: e.target.value }))}
                  style={{ ...formInputStyle, textAlign: 'left' }}
                />
              </FieldLabel>
            </div>
            <ModalFooter>
              <button type="button" onClick={closeLeaveModal} style={modalCancelBtn}>Cancel</button>
              <button
                type="button"
                onClick={handleLeaveSubmit}
                disabled={!state.leaveStart || !state.leaveEnd || leaveDays <= 0}
                style={{
                  ...modalSubmitBtn,
                  opacity: state.leaveStart && state.leaveEnd && leaveDays > 0 ? 1 : 0.55,
                  cursor: state.leaveStart && state.leaveEnd && leaveDays > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Submit Request
              </button>
            </ModalFooter>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ── Profile Side Panel ── */}
      {state.showProfile && state.selectedEmployee && (
        <div
          onClick={closeProfile}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
            zIndex: 200, display: 'flex',
            alignItems: 'flex-start', justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400, maxWidth: '100vw',
              height: '100%',
              background: C.bg2,
              borderLeft: `1px solid ${C.br2}`,
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,.5)',
            }}
          >
            <ProfilePanel
              emp={state.selectedEmployee}
              tab={state.profileTab}
              onTab={(t: ESSState['profileTab']) => setState(s => ({ ...s, profileTab: t }))}
              onClose={closeProfile}
              onEdit={editFromProfile}
              onDownload={downloadPdf}
              onExport={exportProfilePdf}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-components / helpers
// ──────────────────────────────────────────────────────────────

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
      background: C.bg4, border: `1px solid ${C.br2}`,
      borderRadius: 8, padding: '9px 10px',
    }}>
      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, lineHeight: 1.1, marginTop: 2 }}>
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

// ── Modal scaffolding ─────────────────────────────────────────
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
        zIndex: 300, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(480px, 100%)' }}>
        {children}
      </div>
    </div>
  );
}

function ModalCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.bg3,
      border: `1px solid ${C.br2}`,
      borderRadius: 12,
      padding: 20,
      maxHeight: 'calc(100vh - 32px)',
      overflowY: 'auto',
      boxShadow: '0 16px 48px rgba(0,0,0,.5)',
    }}>
      {children}
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.t }}>{title}</div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: C.t2, padding: 4, display: 'flex', alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
      {children}
    </div>
  );
}

function FieldLabel({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function EmployeeFormFields({
  value, onChange, twoCol,
}: {
  value: NewEmployeeForm;
  onChange: (next: NewEmployeeForm) => void;
  twoCol: boolean;
}) {
  const set = <K extends keyof NewEmployeeForm>(k: K, v: NewEmployeeForm[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr', gap: 10 }}>
      <FieldLabel label="Full Name *" full>
        <input
          type="text"
          value={value.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Jane Doe"
          style={{ ...formInputStyle, textAlign: 'left' }}
        />
      </FieldLabel>
      <FieldLabel label="Role">
        <select
          value={value.role}
          onChange={e => set('role', e.target.value)}
          style={{ ...formInputStyle, textAlign: 'left' }}
        >
          {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </FieldLabel>
      <FieldLabel label="Status">
        <select
          value={value.status}
          onChange={e => set('status', e.target.value)}
          style={{ ...formInputStyle, textAlign: 'left' }}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </FieldLabel>
      <FieldLabel label="Department">
        <input
          type="text"
          value={value.department}
          onChange={e => set('department', e.target.value)}
          style={{ ...formInputStyle, textAlign: 'left' }}
        />
      </FieldLabel>
      <FieldLabel label="Start Date">
        <input
          type="date"
          value={value.startDate}
          onChange={e => set('startDate', e.target.value)}
          style={formInputStyle}
        />
      </FieldLabel>
      <FieldLabel label="Email" full>
        <input
          type="email"
          value={value.email}
          onChange={e => set('email', e.target.value)}
          placeholder="name@soltol.com"
          style={{ ...formInputStyle, textAlign: 'left' }}
        />
      </FieldLabel>
      <FieldLabel label="Phone">
        <input
          type="tel"
          value={value.phone}
          onChange={e => set('phone', e.target.value)}
          placeholder="+971 50 ..."
          style={{ ...formInputStyle, textAlign: 'left' }}
        />
      </FieldLabel>
      <FieldLabel label="Net Pay Est.">
        <input
          type="text"
          value={value.netPay}
          onChange={e => set('netPay', e.target.value)}
          placeholder="$3,000"
          style={{ ...formInputStyle, textAlign: 'left' }}
        />
      </FieldLabel>
      <FieldLabel label="Regular Hrs">
        <input
          type="number"
          value={value.regularHours}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            set('regularHours', isNaN(n) ? 0 : n);
          }}
          style={formInputStyle}
        />
      </FieldLabel>
      <FieldLabel label="Overtime Hrs">
        <input
          type="number"
          value={value.overtimeHours}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            set('overtimeHours', isNaN(n) ? 0 : n);
          }}
          style={formInputStyle}
        />
      </FieldLabel>
      <FieldLabel label="PTO Days">
        <input
          type="number"
          value={value.ptoDays}
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            set('ptoDays', isNaN(n) ? 0 : n);
          }}
          style={formInputStyle}
        />
      </FieldLabel>
    </div>
  );
}

// ── Profile side panel ────────────────────────────────────────
function ProfilePanel({
  emp, tab, onTab, onClose, onEdit, onDownload, onExport,
}: {
  emp: Employee;
  tab: ESSState['profileTab'];
  onTab: (t: ESSState['profileTab']) => void;
  onClose: () => void;
  onEdit: () => void;
  onDownload: (filename: string) => void;
  onExport: () => void;
}) {
  const roleStyle = ROLE_STYLES[emp.role as keyof typeof ROLE_STYLES];
  const roleBg = roleStyle?.bg ?? 'rgba(255,255,255,.06)';
  const roleText = roleStyle?.text ?? C.t2;
  const statusColor = STATUS_COLORS[emp.status] ?? '#3E5678';

  const tabs: { key: ESSState['profileTab']; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'hours',    label: 'Hours History' },
    { key: 'payslips', label: 'Payslips' },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ padding: 16, borderBottom: `1px solid ${C.br2}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg,#4F8EF7,#7C3AED)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {emp.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.name}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: roleBg, color: roleText,
                padding: '2px 8px', borderRadius: 10,
                display: 'inline-block', marginTop: 4,
              }}>
                {emp.role}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onEdit}
              style={{
                background: 'rgba(79,142,247,.12)', border: '1px solid rgba(79,142,247,.3)',
                color: '#4F8EF7', borderRadius: 7, padding: '4px 9px',
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
              }}
            >
              <Edit2 size={10} /> Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.t2, padding: 4, display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.br2}`, padding: '0 8px' }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onTab(t.key)}
              style={{
                padding: '10px 12px',
                background: 'transparent', border: 'none',
                borderBottom: active ? `2px solid ${C.blue}` : '2px solid transparent',
                color: active ? C.blue : C.t3,
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {tab === 'overview' && (
          <>
            <ProfileSection label="Personal Information">
              <InfoRow label="Employee ID" value={emp.id} />
              <InfoRow label="Department"  value={emp.department ?? 'Management'} />
              <InfoRow label="Email"       value={emp.email ?? `${emp.name.toLowerCase().replace(/\s+/g, '.')}@soltol.com`} />
              <InfoRow label="Phone"       value={emp.phone ?? '+971 50 XXX XXXX'} />
              <InfoRow label="Start date"  value={emp.startDate ?? 'Jan 2023'} />
              <InfoRow
                label="Status"
                value={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                    {emp.status}
                  </span>
                }
                valueColor={statusColor}
                isLast
              />
            </ProfileSection>

            <ProfileSection label="Employment Stats">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Stat label="Regular Hrs"  value={String(emp.regularHours)}  color={C.blue} />
                <Stat label="Overtime Hrs" value={String(emp.overtimeHours)} color={C.amber} />
                <Stat label="PTO Balance"  value={`${emp.ptoDays} days`}      color={C.green} />
                <Stat label="Est. Net Pay" value={emp.netPay}                  color={C.purple} />
              </div>
            </ProfileSection>

            <ProfileSection label="Leave Summary">
              {LEAVE_TYPES.map((lt, i) => {
                const remaining = lt.total - lt.used;
                const pct = lt.total === 0 ? 0 : Math.min(100, Math.round((remaining / lt.total) * 100));
                return (
                  <div key={i} style={{ padding: '6px 0', borderBottom: i < LEAVE_TYPES.length - 1 ? `1px solid ${C.bd2}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{lt.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: lt.color }}>{remaining} left</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: 6, borderRadius: 6, background: lt.color }} />
                    </div>
                  </div>
                );
              })}
            </ProfileSection>

            <ProfileSection label="Recent Activity">
              {recentActivity(emp).map((a, i, arr) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, padding: '6px 0',
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.bd2}` : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'rgba(255,255,255,.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>
                    {a.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: C.t }}>{a.text}</div>
                    <div style={{ fontSize: 10, color: C.t2 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </ProfileSection>
          </>
        )}

        {tab === 'hours' && (() => {
          const history = hoursHistory(emp);
          const totals = history.map(h => h.reg + h.ot);
          const max = Math.max(1, ...totals);
          return (
            <>
              <ProfileSection label="Monthly hours — last 4 months">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        {['Month', 'Regular', 'Overtime', 'Total', 'Status'].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '6px 8px',
                            fontSize: 9, color: C.t3, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '.4px',
                            borderBottom: `1px solid ${C.br2}`,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i}>
                          <td style={{ padding: '8px', borderBottom: `1px solid ${C.bd2}`, color: C.t, fontWeight: 600 }}>{h.month}</td>
                          <td style={{ padding: '8px', borderBottom: `1px solid ${C.bd2}`, color: C.t2 }}>{h.reg}</td>
                          <td style={{ padding: '8px', borderBottom: `1px solid ${C.bd2}`, color: h.ot > 0 ? C.amber : C.t3 }}>{h.ot}</td>
                          <td style={{ padding: '8px', borderBottom: `1px solid ${C.bd2}`, color: C.t, fontWeight: 600 }}>{h.reg + h.ot}</td>
                          <td style={{ padding: '8px', borderBottom: `1px solid ${C.bd2}` }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              background: h.status === 'Submitted' ? 'rgba(245,158,11,.12)' : 'rgba(34,197,94,.12)',
                              color: h.status === 'Submitted' ? '#F59E0B' : '#22C55E',
                              padding: '1px 6px', borderRadius: 8,
                            }}>
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ProfileSection>

              <ProfileSection label="Total hours — visual">
                {history.map((h, i) => {
                  const total = h.reg + h.ot;
                  const pct = Math.round((total / max) * 100);
                  return (
                    <div key={i} style={{ padding: '6px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 10, color: C.t2 }}>{h.month}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: i === 0 ? C.green : C.blue }}>{total}</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,.05)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: 8, borderRadius: 6,
                          background: i === 0 ? C.green : C.blue,
                          transition: 'width .8s',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </ProfileSection>
            </>
          );
        })()}

        {tab === 'payslips' && (
          <ProfileSection label="Last 3 payslips">
            {PAYSLIPS.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                borderBottom: i < PAYSLIPS.length - 1 ? `1px solid ${C.bd2}` : 'none',
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, background: p.colorBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  📋
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.t }}>{p.month}</div>
                  <div style={{ fontSize: 9, color: C.t2 }}>
                    {p.hours} hrs · {p.ot} OT
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green, flexShrink: 0 }}>
                  {p.amount}
                </div>
                <button
                  type="button"
                  onClick={() => onDownload(`${emp.name.replace(/\s+/g, '_')}_${p.month.replace(/\s+/g, '_')}_payslip.pdf`)}
                  style={pdfButtonStyle}
                >
                  <Download size={9} /> PDF
                </button>
              </div>
            ))}
          </ProfileSection>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px', borderTop: `1px solid ${C.br2}`,
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onEdit}
          style={{
            flex: 1,
            background: 'transparent',
            border: `1px solid ${C.blue}`,
            color: C.blue,
            borderRadius: 8, padding: '8px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontFamily: 'inherit',
          }}
        >
          <Edit2 size={11} /> Edit Employee
        </button>
        <button
          type="button"
          onClick={onExport}
          style={{
            flex: 1,
            background: '#4F8EF7', color: '#fff', border: 'none',
            borderRadius: 8, padding: '8px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontFamily: 'inherit',
          }}
        >
          <Download size={11} /> Export Profile PDF
        </button>
      </div>
    </>
  );
}

function ProfileSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9, color: C.t3, fontWeight: 700,
        letterSpacing: '.6px', textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        background: C.bg3, border: `1px solid ${C.br2}`,
        borderRadius: 10, padding: '10px 12px',
      }}>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: C.bg4, border: `1px solid ${C.br2}`,
      borderRadius: 8, padding: '8px 10px',
    }}>
      <div style={{ fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: '.4px' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── Shared inline style objects ───────────────────────────────
const numInputStyle: React.CSSProperties = {
  background: C.bg4, border: `1px solid ${C.br2}`,
  borderRadius: 7, padding: '6px 10px', fontSize: 12,
  color: C.t, textAlign: 'center', fontWeight: 600,
  outline: 'none', fontFamily: 'inherit',
};

const formInputStyle: React.CSSProperties = {
  background: C.bg4, border: `1px solid ${C.br2}`,
  borderRadius: 7, padding: '7px 10px', fontSize: 12,
  color: C.t, fontWeight: 500,
  outline: 'none', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box',
};

const modalCancelBtn: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${C.br2}`,
  borderRadius: 7, padding: '7px 14px',
  fontSize: 11, color: C.t2, cursor: 'pointer', fontWeight: 600,
  fontFamily: 'inherit',
};

const modalSubmitBtn: React.CSSProperties = {
  background: '#4F8EF7', color: '#fff', border: 'none',
  borderRadius: 7, padding: '7px 14px',
  fontSize: 11, fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: 5,
  fontFamily: 'inherit',
};

const pdfButtonStyle: React.CSSProperties = {
  fontSize: 9, padding: '2px 8px', borderRadius: 8,
  background: 'rgba(74,143,245,.12)',
  border: '1px solid rgba(74,143,245,.25)',
  color: '#4F8EF7', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 3,
  whiteSpace: 'nowrap', fontFamily: 'inherit',
};

const requestButtonStyle: React.CSSProperties = {
  fontSize: 9, padding: '2px 8px', borderRadius: 8,
  background: 'rgba(74,143,245,.12)',
  border: '1px solid rgba(74,143,245,.25)',
  color: '#4F8EF7', cursor: 'pointer',
  fontFamily: 'inherit',
};
