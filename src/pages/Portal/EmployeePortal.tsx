import { useState, useEffect } from 'react';
import {
    Calendar, DollarSign, FileText, Clock,
    ChevronRight, Download, Plus, CheckCircle,
    AlertCircle, Bell, X
} from 'lucide-react';
import clsx from 'clsx';
import { getEmployees, type Employee } from '../../services/payrollService';
import {
    getEmployeeLeaveBalance, submitLeaveRequest, getLeaveRequests,
    getUpcomingHolidays, type LeaveType, type LeaveRequest
} from '../../services/leaveService';

export default function EmployeePortal() {
    const [activeTab, setActiveTab] = useState<'overview' | 'payslips' | 'leave' | 'documents'>('overview');
    const [currentUser, setCurrentUser] = useState<Employee | null>(null);
    const [leaveBalances, setLeaveBalances] = useState<any>(null);
    const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);

    // Leave Form State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveType, setLeaveType] = useState<LeaveType>('Paid Time Off');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        // Simulate logging in as the first active employee for demo purposes
        const employees = await getEmployees();
        const me = employees.find(e => e.status === 'Active') || employees[0];

        if (me) {
            setCurrentUser(me);
            const balances = getEmployeeLeaveBalance(me.id);
            setLeaveBalances(balances);

            const allRequests = getLeaveRequests();
            setMyRequests(allRequests.filter(r => r.employeeId === me.id || r.employeeName === me.name));
        }
    };

    const handleApplyLeave = async () => {
        if (!currentUser || !startDate || !endDate) return;

        try {
            await submitLeaveRequest({
                employeeId: currentUser.id,
                employeeName: currentUser.name,
                leaveType: leaveType,
                startDate,
                endDate,
                reason
            });

            setShowLeaveModal(false);
            setStartDate('');
            setEndDate('');
            setReason('');
            loadUserData(); // Refresh
            alert('Leave request submitted successfully!');
        } catch (error: any) {
            alert(error.message);
        }
    };

    if (!currentUser) return <div className="p-20 text-center">Loading Portal...</div>;

    const nextPayDate = new Date();
    nextPayDate.setDate(30); // Mock next pay date

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Top Navigation Bar */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-lg flex items-center justify-center text-white font-black text-xs">
                            ESS
                        </div>
                        <span className="font-black text-gray-900 tracking-tight uppercase">Employee Self Service</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button className="p-2 text-gray-400 hover:text-gray-900 relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
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
                {/* Dashboard Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
                            Good Afternoon, {currentUser.name.split(' ')[0]} 👋
                        </h1>
                        <p className="text-gray-500 font-medium">Here's what's happening with your employment today.</p>
                    </div>
                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
                        {['overview', 'payslips', 'leave', 'documents'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={clsx(
                                    "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                                    activeTab === tab
                                        ? "bg-gray-900 text-white shadow-md"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                )}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Quick Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-6 rounded-3xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={80} /></div>
                                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-1">Estimated Net Pay</p>
                                <h3 className="text-3xl font-black tracking-tight mb-4">${(currentUser.salaryAmount * 0.75).toLocaleString()}</h3>
                                <div className="flex items-center gap-2 text-xs font-medium bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm">
                                    <Calendar size={12} /> Next Payday: {nextPayDate.toLocaleDateString()}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-colors">
                                <div className="absolute top-0 right-0 p-4 text-gray-50 opacity-50"><Clock size={80} /></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Leave Balance</p>
                                <h3 className="text-3xl font-black text-gray-900 mb-4">
                                    {leaveBalances?.['Paid Time Off']?.available || 0} <span className="text-lg text-gray-400 font-bold">days</span>
                                </h3>
                                <button
                                    onClick={() => setActiveTab('leave')}
                                    className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                    Review Balances <ChevronRight size={12} />
                                </button>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-gray-300 transition-colors">
                                <div className="absolute top-0 right-0 p-4 text-gray-50 opacity-50"><FileText size={80} /></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Latest Slip</p>
                                <h3 className="text-3xl font-black text-gray-900 mb-4">Nov 2024</h3>
                                <button className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1 hover:gap-2 transition-all decoration-2 underline decoration-gray-200 underline-offset-4">
                                    <Download size={12} /> Download PDF
                                </button>
                            </div>
                        </div>

                        {/* Recent Activity & Announcement Split */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Announcements */}
                            <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Company Announcements</h3>
                                    <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase">1 New</span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    <div className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                                                <AlertCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 mb-1">Open Enrollment for 2026 Benefits</h4>
                                                <p className="text-sm text-gray-500 leading-relaxed">
                                                    The enrollment window for 2026 health and dental benefits is now open.
                                                    Please review your options and make selections by December 15th.
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">2 Hours Ago</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                                                <CheckCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 mb-1">Q4 Town Hall Meeting</h4>
                                                <p className="text-sm text-gray-500 leading-relaxed">
                                                    Join us for the quarterly all-hands meeting this Friday at 2 PM EST.
                                                </p>
                                                <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase">Yesterday</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Upcoming Holidays */}
                            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-lg text-white overflow-hidden">
                                <div className="p-6 border-b border-gray-700">
                                    <h3 className="text-sm font-black text-gray-200 uppercase tracking-wider">Upcoming Holidays</h3>
                                </div>
                                <div className="p-6 space-y-6">
                                    {getUpcomingHolidays().slice(0, 4).map((holiday, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="bg-gray-700/50 p-3 rounded-xl text-center min-w-[60px]">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{new Date(holiday.date).toLocaleString('default', { month: 'short' })}</p>
                                                <p className="text-xl font-black">{new Date(holiday.date).getDate()}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-white">{holiday.name}</p>
                                                <p className="text-xs text-gray-400">Company Closed</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAYSLIPS TAB */}
                {activeTab === 'payslips' && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">My Payslips</h3>
                            <div className="flex gap-2">
                                <select className="bg-gray-50 border-none rounded-xl text-sm font-bold text-gray-600 px-4 py-2">
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
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pay Date</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Pay</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax & Ded.</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Pay</th>
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {[1, 2, 3].map((month) => {
                                        const gross = currentUser.salaryAmount;
                                        const net = gross * 0.75;
                                        return (
                                            <tr key={month} className="hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-5 font-bold text-gray-900">Nov {31 - month}, 2025</td>
                                                <td className="px-6 py-5 text-gray-600 font-medium text-sm">Nov {31 - month}, 2025</td>
                                                <td className="px-6 py-5 text-right font-mono text-gray-600">${gross.toLocaleString()}</td>
                                                <td className="px-6 py-5 text-right font-mono text-red-400">-${(gross * 0.25).toLocaleString()}</td>
                                                <td className="px-6 py-5 text-right font-mono font-black text-emerald-700 text-lg">${net.toLocaleString()}</td>
                                                <td className="px-6 py-5 text-center">
                                                    <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
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

                {/* LEAVE TAB */}
                {activeTab === 'leave' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-8">
                        {/* Balance Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {(Object.keys(leaveBalances || {}) as LeaveType[]).slice(0, 4).map(type => (
                                <div key={type} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{type}</p>
                                    <div>
                                        <p className="text-3xl font-black text-gray-900">{leaveBalances[type].available}</p>
                                        <p className="text-xs text-gray-500 font-medium mt-1">days available</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Request History */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">My Leave Requests</h3>
                                <button
                                    onClick={() => setShowLeaveModal(true)}
                                    className="px-6 py-3 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all flex items-center gap-2"
                                >
                                    <Plus size={16} /> New Request
                                </button>
                            </div>
                            {myRequests.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                                    No leave requests found. Time for a vacation?
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {myRequests.map(req => (
                                        <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0",
                                                    req.status === 'Approved' ? "bg-emerald-100 text-emerald-600" :
                                                        req.status === 'Pending' ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"
                                                )}>
                                                    {req.daysCount}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{req.leaveType}</h4>
                                                    <p className="text-xs text-gray-500 font-medium">
                                                        {new Date(req.startDate).toLocaleDateString()} — {new Date(req.endDate).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                                req.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                                    req.status === 'Pending' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                            )}>{req.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Leave Request Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-gray-900 text-white flex items-center justify-between">
                            <h3 className="text-xl font-black uppercase tracking-tight">Request Time Off</h3>
                            <button onClick={() => setShowLeaveModal(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Leave Type</label>
                                <select
                                    value={leaveType}
                                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                >
                                    {Object.keys(leaveBalances || {}).map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Reason (Optional)</label>
                                <textarea
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Taking a trip to..."
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-xl px-4 py-3 text-sm font-medium outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <button onClick={() => setShowLeaveModal(false)} className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-gray-100">Cancel</button>
                            <button onClick={handleApplyLeave} className="flex-[2] py-4 bg-gray-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-black shadow-lg">Submit Request</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


