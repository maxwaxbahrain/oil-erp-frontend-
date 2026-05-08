import { useState, useEffect, useCallback } from 'react';
import {
    Calendar, DollarSign, FileText, Clock,
    ChevronRight, Download, Plus, CheckCircle,
    AlertCircle, Bell, X, Users, Timer
} from 'lucide-react';
import clsx from 'clsx';
import { getEmployees, type Employee } from '../../services/payrollService';
import {
    getEmployeeLeaveBalance, submitLeaveRequest, getLeaveRequests,
    getUpcomingHolidays, type LeaveType, type LeaveRequest
} from '../../services/leaveService';
import {
    PORTAL_TEAM_MAX,
    ensurePortalRoles,
    setPortalRole,
    getMonthlyHours,
    saveMonthlyHours,
    getDocuments,
    addPortalDocument,
    currentPeriod,
    type PortalRole,
    type PortalDocument
} from '../../services/employeePortalService';

const SELECTED_ID_KEY = 'ess_portal_selected_id';

function estimatedNetPay(emp: Employee): number {
    if (emp.salaryType === 'Hourly') {
        return Math.round(emp.salaryAmount * 160 * 0.75);
    }
    return Math.round(emp.salaryAmount * 0.75);
}

function greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

export default function EmployeePortal() {
    const [activeTab, setActiveTab] = useState<'overview' | 'payslips' | 'leave' | 'documents'>('overview');
    const [team, setTeam] = useState<Employee[]>([]);
    const [portalRoles, setPortalRoles] = useState<Record<string, PortalRole>>({});
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [leaveBalances, setLeaveBalances] = useState<Record<string, { total: number; used: number; available: number }> | null>(null);
    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
    const [period] = useState(() => currentPeriod());
    const [hoursDraft, setHoursDraft] = useState({ regularHours: 0, overtimeHours: 0 });
    const [documents, setDocuments] = useState<PortalDocument[]>([]);
    const [newDocName, setNewDocName] = useState('');
    const [newDocCategory, setNewDocCategory] = useState('General');

    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveType, setLeaveType] = useState<LeaveType>('Paid Time Off');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    const refreshForEmployee = useCallback((me: Employee) => {
        const balances = getEmployeeLeaveBalance(me.id);
        setLeaveBalances(balances);

        const allRequests = getLeaveRequests();
        setMyRequests(allRequests.filter(r => r.employeeId === me.id));

        const h = getMonthlyHours(me.id, period);
        setHoursDraft({ regularHours: h.regularHours, overtimeHours: h.overtimeHours });
        setDocuments(getDocuments(me.id));
    }, [period]);

    const loadUserData = useCallback(async () => {
        const employees = await getEmployees();
        const active = employees.filter(e => e.status === 'Active').slice(0, PORTAL_TEAM_MAX);
        const roles = ensurePortalRoles(active);
        setTeam(active);
        setPortalRoles(roles);

        const stored = localStorage.getItem(SELECTED_ID_KEY);
        const pick = active.find(e => e.id === stored) || active[0];

        if (pick) {
            setCurrentUser(pick);
            localStorage.setItem(SELECTED_ID_KEY, pick.id);
            refreshForEmployee(pick);
        }
    }, [refreshForEmployee]);

    useEffect(() => {
        void loadUserData();
    }, [loadUserData]);

    const selectEmployee = (id: string) => {
        const me = team.find(e => e.id === id);
        if (!me) return;
        setCurrentUser(me);
        localStorage.setItem(SELECTED_ID_KEY, id);
        refreshForEmployee(me);
    };

    const handleRoleChange = (employeeId: string, role: PortalRole) => {
        setPortalRole(employeeId, role);
        setPortalRoles(prev => ({ ...prev, [employeeId]: role }));
    };

    const handleSaveHours = () => {
        if (!currentUser) return;
        saveMonthlyHours(currentUser.id, period, hoursDraft);
        alert('Hours saved for ' + period);
    };

    const handleApplyLeave = async () => {
        if (!currentUser || !startDate || !endDate) return;

        try {
            await submitLeaveRequest({
                employeeId: currentUser.id,
                employeeName: currentUser.name,
                leaveType,
                startDate,
                endDate,
                reason
            });

            setShowLeaveModal(false);
            setStartDate('');
            setEndDate('');
            setReason('');
            refreshForEmployee(currentUser);
            alert('Leave request submitted successfully!');
        } catch (error: unknown) {
            alert(error instanceof Error ? error.message : 'Request failed');
        }
    };

    const handleAddDocument = () => {
        if (!currentUser || !newDocName.trim()) return;
        addPortalDocument(currentUser.id, newDocName, newDocCategory);
        setNewDocName('');
        setDocuments(getDocuments(currentUser.id));
    };

    if (!currentUser) return <div className="p-20 text-center">Loading Portal...</div>;

    const nextPayDate = new Date();
    nextPayDate.setDate(28);

    const ptoDays = leaveBalances?.['Paid Time Off']?.available ?? 0;
    const roleOptions: PortalRole[] = ['Office', 'Van Driver', 'Salesman'];

    const tabLabels: Record<string, string> = {
        overview: 'Overview',
        payslips: 'Payslips',
        leave: 'Leave',
        documents: 'Documents'
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg flex items-center justify-center text-white font-black text-xs">
                            ESS
                        </div>
                        <span className="font-black text-gray-900 tracking-tight uppercase">Employee Self Service</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button type="button" className="p-2 text-gray-400 hover:text-gray-900 relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
                        </button>
                        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
                            <div className="text-right hidden md:block">
                                <p className="text-xs font-black text-gray-900">{currentUser.name}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{currentUser.jobTitle}</p>
                            </div>
                            <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {currentUser.name.charAt(0)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Monitor bar — switch between up to 10 team members */}
                <div className="mb-6 flex flex-col lg:flex-row lg:items-center gap-4 bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm ring-2 ring-emerald-100">
                    <div className="flex items-center gap-2 text-gray-700 shrink-0">
                        <Users size={18} className="text-emerald-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-gray-500">Monitor team</span>
                        <span className="text-xs font-bold text-gray-400">({team.length}/{PORTAL_TEAM_MAX})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <label className="sr-only" htmlFor="ess-employee-select">Employee</label>
                        <select
                            id="ess-employee-select"
                            value={currentUser.id}
                            onChange={(e) => selectEmployee(e.target.value)}
                            className="flex-1 min-w-[200px] bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900"
                        >
                            {team.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.name} — {e.jobTitle}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Role</span>
                            <select
                                value={portalRoles[currentUser.id] || 'Office'}
                                onChange={(e) => handleRoleChange(currentUser.id, e.target.value as PortalRole)}
                                className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-black text-emerald-900 uppercase tracking-wide"
                            >
                                {roleOptions.map((r) => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <p className="text-[11px] text-gray-500 max-w-md lg:text-right">
                        Switch people to review pay, hours, leave, and documents. Roles help you sort office, van, and sales staff.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                            {greeting()}, {currentUser.name.split(' ')[0]} 👋
                        </h1>
                        <p className="text-gray-500 font-medium">Here&apos;s what&apos;s happening with this employment record today.</p>
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex-wrap">
                        {(['overview', 'payslips', 'leave', 'documents'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={clsx(
                                    'px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all',
                                    activeTab === tab
                                        ? 'bg-gray-900 text-white shadow-md'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                )}
                            >
                                {tabLabels[tab]}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-6 rounded-3xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={80} /></div>
                                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Estimated Net Pay</p>
                                <h3 className="text-3xl font-black tracking-tight mb-4">${estimatedNetPay(currentUser).toLocaleString()}</h3>
                                <div className="flex items-center gap-2 text-xs font-medium bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm">
                                    <Calendar size={12} /> Next payday: {nextPayDate.toLocaleDateString()}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-colors">
                                <div className="absolute top-0 right-0 p-4 text-gray-50 opacity-50"><Clock size={80} /></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Leave balance (PTO)</p>
                                <h3 className="text-3xl font-black text-gray-900 mb-4">
                                    {ptoDays} <span className="text-lg text-gray-400 font-bold">days</span>
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('leave')}
                                    className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                    Review balances <ChevronRight size={12} />
                                </button>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-colors">
                                <div className="absolute top-0 right-0 p-4 text-gray-50 opacity-50"><Timer size={80} /></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Hours this month</p>
                                <p className="text-[10px] font-bold text-gray-400 mb-2">{period}</p>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Regular</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={hoursDraft.regularHours}
                                            onChange={(e) => setHoursDraft((d) => ({ ...d, regularHours: Number(e.target.value) }))}
                                            className="w-full mt-1 bg-gray-50 rounded-lg px-2 py-1.5 text-sm font-bold border border-gray-200"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Overtime</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={hoursDraft.overtimeHours}
                                            onChange={(e) => setHoursDraft((d) => ({ ...d, overtimeHours: Number(e.target.value) }))}
                                            className="w-full mt-1 bg-gray-50 rounded-lg px-2 py-1.5 text-sm font-bold border border-gray-200"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSaveHours}
                                    className="text-xs font-black text-gray-900 uppercase tracking-wider bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg w-full"
                                >
                                    Save hours
                                </button>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-colors">
                                <div className="absolute top-0 right-0 p-4 text-gray-50 opacity-50"><FileText size={80} /></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Latest slip</p>
                                <h3 className="text-3xl font-black text-gray-900 mb-4">Nov 2024</h3>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('payslips')}
                                    className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all underline decoration-gray-200 underline-offset-4"
                                >
                                    <Download size={12} /> View payslips
                                </button>
                            </div>
                        </div>

                        {/* Team snapshot */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Team snapshot</h3>
                                <span className="text-[10px] font-bold text-gray-400">Salaries · hours · leave</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                                            <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Est. net</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Hours ({period})</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">PTO days</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {team.map((e) => {
                                            const hb = getEmployeeLeaveBalance(e.id);
                                            const ho = getMonthlyHours(e.id, period);
                                            const isSel = e.id === currentUser.id;
                                            return (
                                                <tr
                                                    key={e.id}
                                                    className={clsx('hover:bg-gray-50 cursor-pointer', isSel && 'bg-indigo-50/60')}
                                                    onClick={() => selectEmployee(e.id)}
                                                >
                                                    <td className="px-4 py-3 font-bold text-gray-900">{e.name}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md">
                                                            {portalRoles[e.id] || 'Office'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-gray-800">${estimatedNetPay(e).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right text-gray-600">
                                                        {ho.regularHours} reg + {ho.overtimeHours} OT
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                        {hb['Paid Time Off']?.available ?? 0}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Company announcements</h3>
                                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase">1 New</span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    <div className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 mb-1">Open enrollment for benefits</h4>
                                                <p className="text-sm text-gray-500 leading-relaxed">
                                                    Review health and dental options and submit choices before the deadline.
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">2 hours ago</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                                <CheckCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 mb-1">Quarterly town hall</h4>
                                                <p className="text-sm text-gray-500 leading-relaxed">
                                                    Join the all-hands meeting this Friday afternoon.
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">Yesterday</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-lg text-white overflow-hidden">
                                <div className="p-6 border-b border-gray-700">
                                    <h3 className="text-sm font-black text-gray-200 uppercase tracking-wider">Upcoming holidays</h3>
                                </div>
                                <div className="p-6 space-y-6">
                                    {getUpcomingHolidays().slice(0, 4).map((holiday, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="bg-gray-700/50 p-3 rounded-xl text-center min-w-[60px]">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                                    {new Date(holiday.date).toLocaleString('default', { month: 'short' })}
                                                </p>
                                                <p className="text-xl font-black">{new Date(holiday.date).getDate()}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{holiday.name}</p>
                                                <p className="text-xs text-gray-400">Company closed</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'payslips' && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Payslips — {currentUser.name}</h3>
                            <div className="flex gap-2">
                                <select className="bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-600 px-4 py-2">
                                    <option>2026</option>
                                    <option>2025</option>
                                    <option>2024</option>
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Period</th>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pay date</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross pay</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax &amp; ded.</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net pay</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {[1, 2, 3].map((month) => {
                                        const gross =
                                            currentUser.salaryType === 'Hourly'
                                                ? currentUser.salaryAmount * 160
                                                : currentUser.salaryAmount;
                                        const net = gross * 0.75;
                                        return (
                                            <tr key={month} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-5 font-bold text-gray-900">Recent period {month}</td>
                                                <td className="px-6 py-5 text-gray-600 font-medium text-sm">—</td>
                                                <td className="px-6 py-5 text-right font-mono text-gray-600">${gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                <td className="px-6 py-5 text-right font-mono text-red-400">
                                                    -${(gross * 0.25).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-6 py-5 text-right font-mono font-black text-emerald-700 text-lg">
                                                    ${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                                        <Download size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'leave' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {(Object.keys(leaveBalances || {}) as LeaveType[]).slice(0, 4).map((type) => (
                                <div key={type} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{type}</p>
                                    <div>
                                        <p className="text-3xl font-black text-gray-900">{leaveBalances![type].available}</p>
                                        <p className="text-xs text-gray-500 font-medium mt-1">days available</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Leave requests — {currentUser.name}</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowLeaveModal(true)}
                                    className="px-6 py-3 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center gap-2"
                                >
                                    <Plus size={16} /> New request
                                </button>
                            </div>
                            {myRequests.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                                    No leave requests for this person yet.
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {myRequests.map((req) => (
                                        <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className={clsx(
                                                        'w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0',
                                                        req.status === 'Approved'
                                                            ? 'bg-emerald-100 text-emerald-600'
                                                            : req.status === 'Pending'
                                                                ? 'bg-amber-100 text-amber-600'
                                                                : 'bg-red-100 text-red-600'
                                                    )}
                                                >
                                                    {req.daysCount}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{req.leaveType}</h4>
                                                    <p className="text-xs text-gray-500 font-medium">
                                                        {new Date(req.startDate).toLocaleDateString()} — {new Date(req.endDate).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className={clsx(
                                                    'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                                                    req.status === 'Approved'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : req.status === 'Pending'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-red-100 text-red-700'
                                                )}
                                            >
                                                {req.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'documents' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-4">Add a document record</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Track contracts, licenses, and training for <strong>{currentUser.name}</strong>. Files are listed here for your records (upload can be wired to your server later).
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    value={newDocName}
                                    onChange={(e) => setNewDocName(e.target.value)}
                                    placeholder="Document name"
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold"
                                />
                                <input
                                    type="text"
                                    value={newDocCategory}
                                    onChange={(e) => setNewDocCategory(e.target.value)}
                                    placeholder="Category"
                                    className="sm:w-40 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddDocument}
                                    className="px-6 py-3 bg-gray-900 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-black"
                                >
                                    Add
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Documents — {currentUser.name}</h3>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {documents.map((doc) => (
                                    <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600">
                                                <FileText size={22} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{doc.name}</p>
                                                <p className="text-xs text-gray-500">{doc.category} · added {doc.addedAt}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <Download size={14} /> PDF placeholder
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showLeaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-gray-900 text-white flex items-center justify-between">
                            <h3 className="text-xl font-black uppercase tracking-tight">Request time off</h3>
                            <button type="button" onClick={() => setShowLeaveModal(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Leave type</label>
                                <select
                                    value={leaveType}
                                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                >
                                    {(Object.keys(leaveBalances || {}) as LeaveType[]).map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Start date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">End date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Reason (optional)</label>
                                <textarea
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Details..."
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-medium outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowLeaveModal(false)}
                                className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyLeave}
                                className="flex-[2] py-4 bg-gray-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-black shadow-lg"
                            >
                                Submit request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
