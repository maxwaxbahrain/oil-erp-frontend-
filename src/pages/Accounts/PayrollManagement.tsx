import { useState, useEffect, useRef } from 'react';
import {
    DollarSign, Users, TrendingUp, CheckCircle, Play, Download,
    Sparkles, Brain, FileText, Zap, Plus, X, Mail, Send
} from 'lucide-react';
import clsx from 'clsx';
import {
    getEmployees, getPayrollRuns, getLeaveRequests,
    processPayroll, updateLeaveRequest, askPayrollAI,
    saveEmployee, sendPayslipToEmployee, sendAllPayslips,
    type Employee, type PayrollRun, type PayrollItem, type LeaveRequest
} from '../../services/payrollService';

// Import New Enterprise Engine
import { calculateComprehensivePayroll, type PayrollInput, type CompletePayrollResult } from '../../services/payrollCalculationEngine';
import type { ComprehensiveEmployee, SalaryStructure } from '../../services/employeeService';

export default function PayrollManagement() {
    const [activeView, setActiveView] = useState<'dashboard' | 'employees' | 'reports' | 'ai-assistant'>('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const [processingPayroll, setProcessingPayroll] = useState(false);

    // Updated to hold detailed results from the new engine
    const [currentPayrollResults, setCurrentPayrollResults] = useState<CompletePayrollResult[]>([]);
    const [currentPayrollItems, setCurrentPayrollItems] = useState<PayrollItem[]>([]); // Keep for backward compat

    const [showPayrollReview, setShowPayrollReview] = useState(false);

    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiThinking, setAiThinking] = useState(false);

    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [showPayslip, setShowPayslip] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Refs for form
    const nameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const jobTitleRef = useRef<HTMLInputElement>(null);
    const departmentRef = useRef<HTMLSelectElement>(null);
    const salaryTypeRef = useRef<HTMLSelectElement>(null);
    const salaryAmountRef = useRef<HTMLInputElement>(null);
    const filingStatusRef = useRef<HTMLSelectElement>(null);
    const allowancesRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [employeesData, runsData, leavesData] = await Promise.all([
                getEmployees(), getPayrollRuns(), getLeaveRequests()
            ]);
            setEmployees(employeesData);
            setPayrollRuns(runsData);
            setLeaveRequests(leavesData);
        } catch (error) {
            console.error('Failed to load payroll data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to convert Simple Employee -> Comprehensive Employee for the Engine
    const convertToComprehensive = (emp: Employee): ComprehensiveEmployee => {
        const basic = emp.salaryAmount * 0.6; // 60% Basic
        return {
            basicInfo: { id: emp.id, fullLegalName: emp.name } as any,
            payrollConfig: { currency: 'USD' } as any,
            salaryStructure: {
                basicSalary: basic,
                housingAllowance: emp.salaryAmount * 0.2, // 20% HRA
                transportAllowance: emp.salaryAmount * 0.1,
                medicalAllowance: emp.salaryAmount * 0.05,
                specialAllowance: emp.salaryAmount * 0.05,

                // Allowances
                mealAllowance: 100,
                educationAllowance: 0,
                shiftAllowance: 0,
                hazardAllowance: 0,
                remoteWorkAllowance: 50,

                // Rates
                overtimeRate: 1.5,
                performanceBonusPercent: 5,
                salesCommissionPercent: emp.department === 'Sales' ? 3 : 0,
                profitSharingPercent: 0,

                // Deductions
                retirement401kPercent: 5,
                healthInsurancePremium: 150,
                lifeInsurancePremium: 20,
                socialSecurityPercent: 6.2,
                medicarePercent: 1.45,

                // Tax
                filingStatus: emp.filingStatus || 'Single',
                allowances: emp.allowances || 1,
                incomeTaxBracket: 'Auto',
                additionalWithholding: 0
            } as SalaryStructure,
            employmentDetails: { department: emp.department } as any,
            leaveBalances: {} as any,
            contactInfo: {} as any,
            documents: {} as any,
            // Mock Metadata for Type Compliance
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'System',
            lastModifiedBy: 'System'
        };
    };

    const handleRunPayroll = async () => {
        setProcessingPayroll(true);
        try {
            const now = new Date();
            const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            const results: CompletePayrollResult[] = [];
            const simpleItems: PayrollItem[] = []; // For backward compatibility

            for (const emp of employees.filter(e => e.status === 'Active')) {
                // Feature: Randomize data to show simulator capabilities
                const otHours = Math.random() > 0.7 ? Math.floor(Math.random() * 10) : 0;
                const sales = emp.department === 'Sales' ? Math.floor(Math.random() * 50000) : 0;

                const compEmp = convertToComprehensive(emp);

                const input: PayrollInput = {
                    employee: compEmp,
                    daysWorked: 22,
                    totalWorkingDays: 22,
                    overtimeHours: otHours,
                    salesAchieved: sales,
                    salesTarget: 30000,
                    unpaidLeaveDays: 0,
                    oneTimeBonus: 0,
                    period
                };

                const result = calculateComprehensivePayroll(input);
                results.push(result);

                // Create simple item for existing service compat
                simpleItems.push({
                    id: Math.random().toString(),
                    payrollRunId: 'temp',
                    employeeId: emp.id,
                    employeeName: emp.name,
                    regularHours: 160,
                    overtimeHours: otHours,
                    grossPay: result.grossPay,
                    netPay: result.netPay,
                    tax: result.taxes.totalTax,
                    deductions: result.totalDeductions,
                    ...result.taxes // Spread detailed tax info
                } as any);
            }

            setCurrentPayrollResults(results);
            setCurrentPayrollItems(simpleItems);
            setShowPayrollReview(true);
        } catch (error) {
            console.error('Failed to run payroll:', error);
            alert('Failed to process payroll');
        } finally {
            setProcessingPayroll(false);
        }
    };

    const handleApprovePayroll = async () => {
        if (currentPayrollResults.length === 0) return;
        try {
            // Using existing simulated process for now
            const payrollRunId = 'RUN-' + Date.now();
            await processPayroll(payrollRunId, currentPayrollItems);

            const activeEmployees = employees.filter(e => e.status === 'Active');
            const sentCount = await sendAllPayslips(activeEmployees);

            await loadData();
            setShowPayrollReview(false);
            setCurrentPayrollResults([]);
            alert(`✅ Payroll processed! Payslips processed with Enhanced Engine & sent to ${sentCount} employees.`);
        } catch (error) {
            console.error('Failed to approve payroll:', error);
            alert('Failed to approve payroll');
        }
    };

    const handleAddEmployee = async () => {
        const name = nameRef.current?.value;
        const email = emailRef.current?.value;
        const jobTitle = jobTitleRef.current?.value;
        const department = departmentRef.current?.value;
        const salaryType = salaryTypeRef.current?.value as 'Hourly' | 'Monthly' | 'Annual';
        const salaryAmount = parseFloat(salaryAmountRef.current?.value || '0');
        const filingStatus = filingStatusRef.current?.value as 'Single' | 'Married' | 'Head of Household';
        const allowances = parseInt(allowancesRef.current?.value || '0');

        if (!name || !email || !jobTitle || !department || !salaryAmount) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            await saveEmployee({
                name, email, jobTitle, department, salaryType, salaryAmount,
                currency: 'USD', filingStatus, allowances, additionalWithholding: 0,
                healthInsurance: true, retirement401k: true, retirement401kPercent: 5,
                lifeInsurance: true, dentalInsurance: false
            });
            await loadData();
            setShowAddEmployee(false);
            alert('✅ Employee added successfully!');
        } catch (error) {
            console.error('Failed to add employee:', error);
            alert('Failed to add employee');
        }
    };

    const handleSendPayslip = async (employee: Employee) => {
        try {
            await sendPayslipToEmployee(employee.id, employee.name, employee.email);
            alert(`✅ Payslip sent to ${employee.name} via email & SMS!`);
        } catch (error) {
            console.error('Failed to send payslip:', error);
            alert('Failed to send payslip');
        }
    };

    const thisMonthTotal = payrollRuns[0]?.totalGross || 0;
    const ytdTotal = payrollRuns.reduce((sum, run) => sum + run.totalGross, 0);
    const taxPaid = payrollRuns.reduce((sum, run) => sum + run.totalTax, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading payroll data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Header with ONE Run Payroll Button */}
            <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-4">
                            <DollarSign className="text-gray-900" size={32} />
                            AI-Powered Payroll
                        </h2>
                        <p className="text-gray-500 mt-2 text-sm font-medium uppercase tracking-widest">
                            🤖 Set it & forget it - No accountant needed
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setActiveView('ai-assistant')}
                            className="px-6 py-4 bg-purple-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-purple-700 transition-all flex items-center gap-2"
                        >
                            <Brain size={18} /> Ask AI
                        </button>
                        <button
                            onClick={handleRunPayroll}
                            disabled={processingPayroll}
                            className="px-10 py-5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-emerald-200 flex items-center gap-3 disabled:opacity-50"
                        >
                            {processingPayroll ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play size={20} /> Run Payroll
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white p-2 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-2 overflow-x-auto">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
                    { id: 'employees', label: 'Employees', icon: Users },
                    { id: 'reports', label: 'Reports', icon: FileText },
                    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveView(tab.id as any)}
                        className={clsx(
                            "px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
                            activeView === tab.id
                                ? "bg-gray-900 text-white shadow-xl"
                                : "text-gray-400 hover:text-gray-900"
                        )}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Dashboard View */}
            {activeView === 'dashboard' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 rounded-3xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20"><DollarSign size={80} /></div>
                            <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-2">This Month</p>
                            <p className="text-4xl font-black tracking-tighter">${thisMonthTotal.toLocaleString()}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-3xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={80} /></div>
                            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">YTD Total</p>
                            <p className="text-4xl font-black tracking-tighter">${ytdTotal.toLocaleString()}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-8 rounded-3xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20"><FileText size={80} /></div>
                            <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mb-2">Tax Paid</p>
                            <p className="text-4xl font-black tracking-tighter">${taxPaid.toLocaleString()}</p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 rounded-3xl text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20"><Users size={80} /></div>
                            <p className="text-[10px] font-black text-amber-200 uppercase tracking-widest mb-2">Employees</p>
                            <p className="text-4xl font-black tracking-tighter">{employees.filter(e => e.status === 'Active').length}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                                <h4 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Recent Activity</h4>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {payrollRuns.slice(0, 5).map(run => (
                                    <div key={run.id} className="p-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-sm font-black text-gray-900">{run.period} Payroll</h5>
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                                run.status === 'Completed' ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                                            )}>{run.status}</span>
                                        </div>
                                        <p className="text-xs text-gray-600 font-medium">{run.employeeCount} employees • ${run.totalNet.toLocaleString()} net</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-100 bg-gray-50/50">
                                <h4 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Pending Leave Requests</h4>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {leaveRequests.filter(r => r.status === 'Pending').length === 0 ? (
                                    <div className="p-12 text-center">
                                        <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                                        <p className="text-gray-500 font-medium">No pending requests</p>
                                    </div>
                                ) : (
                                    leaveRequests.filter(r => r.status === 'Pending').map(request => (
                                        <div key={request.id} className="p-6">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h5 className="text-sm font-black text-gray-900">{request.employeeName}</h5>
                                                    <p className="text-xs text-gray-600 font-medium">{request.leaveType}</p>
                                                </div>
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-black uppercase">{request.daysCount} days</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateLeaveRequest(request.id, 'Approved').then(loadData)}
                                                    className="flex-1 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all"
                                                >Approve</button>
                                                <button
                                                    onClick={() => updateLeaveRequest(request.id, 'Rejected').then(loadData)}
                                                    className="flex-1 py-2 bg-gray-100 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all"
                                                >Reject</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Employees View */}
            {activeView === 'employees' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Employee Directory</h3>
                        <button
                            onClick={() => setShowAddEmployee(true)}
                            className="px-6 py-3 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all flex items-center gap-2"
                        >
                            <Plus size={16} /> Add Employee
                        </button>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {employees.map(employee => (
                            <div key={employee.id} className="p-8 hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-lg">
                                                {employee.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-gray-900">{employee.name}</h4>
                                                <p className="text-sm text-gray-600 font-medium">{employee.jobTitle} • {employee.department}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 mt-3">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID</p>
                                                <p className="text-sm font-bold text-gray-700">{employee.employeeId}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Salary</p>
                                                <p className="text-sm font-bold text-gray-700">${employee.salaryAmount.toLocaleString()}/{employee.salaryType === 'Hourly' ? 'hr' : 'mo'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                                                <span className={clsx("px-2 py-1 rounded-full text-[9px] font-black uppercase", employee.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700")}>{employee.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => { setSelectedEmployee(employee); setShowPayslip(true); }}
                                            className="px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-900 hover:text-white transition-all text-[10px] font-black uppercase"
                                        >View</button>
                                        <button
                                            onClick={() => handleSendPayslip(employee)}
                                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase flex items-center gap-1"
                                        ><Mail size={12} /> Pay Stub</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reports View */}
            {activeView === 'reports' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Payroll Summary</h3>
                                <Download size={20} className="text-gray-400 cursor-pointer hover:text-gray-900" />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">Total Employees</span>
                                    <span className="text-lg font-black text-gray-900">{employees.length}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">Total Gross Pay</span>
                                    <span className="text-lg font-black text-gray-900">${thisMonthTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">Total Deductions</span>
                                    <span className="text-lg font-black text-gray-900">${(thisMonthTotal * 0.25).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
                                    <span className="text-sm font-bold text-emerald-700">Total Net Pay</span>
                                    <span className="text-lg font-black text-emerald-700">${(thisMonthTotal * 0.75).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Tax Report</h3>
                                <Download size={20} className="text-gray-400 cursor-pointer hover:text-gray-900" />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">Federal Tax</span>
                                    <span className="text-lg font-black text-gray-900">${(taxPaid * 0.5).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">State Tax</span>
                                    <span className="text-lg font-black text-gray-900">${(taxPaid * 0.25).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">Social Security</span>
                                    <span className="text-lg font-black text-gray-900">${(taxPaid * 0.15).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                                    <span className="text-sm font-bold text-gray-600">Medicare</span>
                                    <span className="text-lg font-black text-gray-900">${(taxPaid * 0.1).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Employee Earnings</h3>
                            <Download size={20} className="text-gray-400 cursor-pointer hover:text-gray-900" />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b-2 border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Pay</th>
                                        <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {employees.map(emp => {
                                        const gross = emp.salaryType === 'Monthly' ? emp.salaryAmount : emp.salaryAmount * 160;
                                        const net = gross * 0.75;
                                        return (
                                            <tr key={emp.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-bold text-gray-900">{emp.name}</td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-600">{emp.department}</td>
                                                <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">${gross.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-mono font-black text-emerald-700">${net.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Assistant View */}
            {activeView === 'ai-assistant' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-10 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                        <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                            <Brain size={28} /> Ask Payroll AI Anything
                        </h3>
                        <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest mt-1">Get instant answers in plain English</p>
                    </div>
                    <div className="p-12 space-y-8">
                        <div>
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Type your question:</label>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={aiQuestion}
                                    onChange={(e) => setAiQuestion(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && askPayrollAI(aiQuestion).then(setAiResponse)}
                                    placeholder="e.g., How much did I pay in taxes last month?"
                                    className="flex-1 bg-gray-50 border-2 border-transparent focus:border-purple-600 rounded-2xl px-8 py-5 text-sm font-bold outline-none"
                                />
                                <button
                                    onClick={() => { setAiThinking(true); askPayrollAI(aiQuestion).then(r => { setAiResponse(r); setAiThinking(false); }); }}
                                    disabled={aiThinking || !aiQuestion.trim()}
                                    className="px-8 py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl disabled:opacity-50 flex items-center gap-2"
                                >
                                    {aiThinking ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> Thinking...</> : <><Sparkles size={18} /> Ask AI</>}
                                </button>
                            </div>
                        </div>
                        {aiResponse && (
                            <div className="p-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl border-2 border-purple-100">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white"><Brain size={20} /></div>
                                    <p className="text-sm font-black text-purple-900 uppercase tracking-tighter">AI Response:</p>
                                </div>
                                <p className="text-gray-700 font-medium leading-relaxed whitespace-pre-line">{aiResponse}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add Employee Modal */}
            {showAddEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-10 border-b border-gray-100 bg-gray-900 text-white flex items-center justify-between">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">Add New Employee</h3>
                            <button onClick={() => setShowAddEmployee(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-12 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Full Name *</label>
                                    <input ref={nameRef} type="text" placeholder="John Doe" className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Email *</label>
                                    <input ref={emailRef} type="email" placeholder="john@company.com" className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Job Title *</label>
                                    <input ref={jobTitleRef} type="text" placeholder="Sales Manager" className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Department *</label>
                                    <select ref={departmentRef} className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none">
                                        <option value="">Select Department</option>
                                        <option value="Sales">Sales</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="IT">IT</option>
                                        <option value="HR">HR</option>
                                        <option value="Finance">Finance</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Pay Type *</label>
                                    <select ref={salaryTypeRef} className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none">
                                        <option value="Monthly">Monthly</option>
                                        <option value="Hourly">Hourly</option>
                                        <option value="Annual">Annual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Salary Amount *</label>
                                    <input ref={salaryAmountRef} type="number" step="0.01" placeholder="5000" className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Filing Status</label>
                                    <select ref={filingStatusRef} className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none">
                                        <option value="Single">Single</option>
                                        <option value="Married">Married</option>
                                        <option value="Head of Household">Head of Household</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Allowances</label>
                                    <input ref={allowancesRef} type="number" defaultValue="1" className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none" />
                                </div>
                            </div>
                        </div>
                        <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4">
                            <button onClick={() => setShowAddEmployee(false)} className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all">Cancel</button>
                            <button onClick={handleAddEmployee} className="flex-[2] py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl">✅ Save Employee</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Details Modal */}
            {showPayslip && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-10 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter">{selectedEmployee.name}</h3>
                                <p className="text-sm text-blue-200 font-medium">{selectedEmployee.jobTitle}</p>
                            </div>
                            <button onClick={() => setShowPayslip(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-12 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Employee ID</p>
                                    <p className="text-lg font-black text-gray-900">{selectedEmployee.employeeId}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Department</p>
                                    <p className="text-lg font-black text-gray-900">{selectedEmployee.department}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Salary</p>
                                    <p className="text-lg font-black text-gray-900">${selectedEmployee.salaryAmount.toLocaleString()}/{selectedEmployee.salaryType === 'Hourly' ? 'hr' : 'mo'}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Status</p>
                                    <p className="text-lg font-black text-emerald-700">{selectedEmployee.status}</p>
                                </div>
                            </div>
                            <div className="p-6 bg-blue-50 rounded-2xl border-2 border-blue-200">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Contact</p>
                                <p className="text-sm font-bold text-gray-900">{selectedEmployee.email}</p>
                                <p className="text-sm font-bold text-gray-900 mt-1">{selectedEmployee.bankName} - {selectedEmployee.accountNumber}</p>
                            </div>
                        </div>
                        <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4">
                            <button onClick={() => setShowPayslip(false)} className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all">Close</button>
                            <button onClick={() => { handleSendPayslip(selectedEmployee); setShowPayslip(false); }} className="flex-[2] py-5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-2">
                                <Send size={18} /> Send Payslip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payroll Review Modal (Updated) */}
            {showPayrollReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="p-10 border-b border-gray-100 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white sticky top-0 z-10">
                            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <Zap size={28} /> Review Payroll - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mt-1">Enterprise Engine: Verifying Taxes, Compliance & Deductions</p>
                        </div>
                        <div className="p-12 space-y-8">
                            <div className="grid grid-cols-4 gap-6">
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Gross</p>
                                    <p className="text-2xl font-black text-gray-900">${currentPayrollResults.reduce((sum, item) => sum + item.grossPay, 0).toLocaleString()}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Taxes</p>
                                    <p className="text-2xl font-black text-gray-900">${currentPayrollResults.reduce((sum, item) => sum + item.taxes.totalTax, 0).toLocaleString()}</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-2xl">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Deductions</p>
                                    <p className="text-2xl font-black text-gray-900">${currentPayrollResults.reduce((sum, item) => sum + item.totalDeductions, 0).toLocaleString()}</p>
                                </div>
                                <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-200">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Net Pay</p>
                                    <p className="text-2xl font-black text-emerald-700">${currentPayrollResults.reduce((sum, item) => sum + item.netPay, 0).toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b-2 border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Earnings Breakdown</th>
                                            <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Deductions Breakdown</th>
                                            <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Pay</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {currentPayrollResults.map(item => {
                                            const empName = employees.find(e => e.id === item.employeeId)?.name || item.employeeId;
                                            return (
                                                <tr key={item.employeeId} className="hover:bg-gray-50 align-top">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-gray-900">{empName}</div>
                                                        <div className="text-[10px] text-gray-400 uppercase font-black mt-1">ID: {item.employeeId}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1">
                                                            {item.earnings.map((e, i) => (
                                                                <div key={i} className="flex justify-between text-xs">
                                                                    <span className="text-gray-500 font-medium">{e.name}</span>
                                                                    <span className="font-bold text-gray-900">${e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            ))}
                                                            <div className="border-t border-gray-200 pt-1 mt-1 flex justify-between text-xs font-black">
                                                                <span>Gross Total</span>
                                                                <span>${item.grossPay.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="space-y-1">
                                                            {item.deductions.map((d, i) => (
                                                                <div key={i} className="flex justify-between text-xs">
                                                                    <span className="text-gray-500 font-medium">{d.name}</span>
                                                                    <span className="font-bold text-red-600">-${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                                </div>
                                                            ))}
                                                            <div className="border-t border-gray-200 pt-1 mt-1 flex justify-between text-xs font-black">
                                                                <span>Total Deductions</span>
                                                                <span className="text-red-700">-${item.totalDeductions.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 text-lg">
                                                        ${item.netPay.toLocaleString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4 sticky bottom-0">
                            <button onClick={() => { setShowPayrollReview(false); setCurrentPayrollItems([]); setCurrentPayrollResults([]); }} className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all">Cancel</button>
                            <button onClick={handleApprovePayroll} className="flex-[2] py-5 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-700 transition-all shadow-xl">✅ Approve & Process</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
