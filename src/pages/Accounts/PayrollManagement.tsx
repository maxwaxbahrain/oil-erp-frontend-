import { useState, useEffect, useRef } from 'react';
// STEP 11C — pending-reimbursements view sourced from Expenses module.
import { getExpenses, saveExpense, type Expense } from '../../services/expenseService';
import {
    DollarSign, Users, TrendingUp, CheckCircle, Play, Download, HandCoins,
    Sparkles, Brain, FileText, Zap, Plus, X, Edit2, Trash2
} from 'lucide-react';
import clsx from 'clsx';
import {
    getEmployees, getPayrollRuns, getLeaveRequests,
    processPayroll, createPayrollRun, updateLeaveRequest, askPayrollAI,
    saveEmployee, deleteEmployee,
    type Employee, type PayrollRun, type PayrollItem, type LeaveRequest
} from '../../services/payrollService';

// Import New Enterprise Engine
import { calculateComprehensivePayroll, type PayrollInput, type CompletePayrollResult } from '../../services/payrollCalculationEngine';
import type { ComprehensiveEmployee, SalaryStructure } from '../../services/employeeService';
// TASK 3 — Real PDF download for payslips. Replaces the W4-3 print-CSS
// approach in the View modal with an actual file download via jspdf.
import { generatePayslipPDF } from '../../utils/payslipPDF';

export default function PayrollManagement() {
    // STEP 11C — pending reimbursable expenses pulled from Expense module.
    const [reimbursableExpenses, setReimbursableExpenses] = useState<Expense[]>([]);
    const [reimbursingId, setReimbursingId] = useState<string | null>(null);

    const reloadReimbursable = async () => {
        try {
            const all = await getExpenses();
            setReimbursableExpenses(all.filter(e =>
                (e.is_reimbursable === true ||
                 e.paymentMethod === 'Cash' || e.paymentMethod === 'Petty Cash')
                && e.status === 'Approved'
                && !e.payroll_reimbursed_in
            ));
        } catch { /* ignore */ }
    };

    const markReimbursed = async (exp: Expense) => {
        if (!window.confirm(`Mark $${exp.amount.toFixed(2)} reimbursement as paid?`)) return;
        setReimbursingId(exp.id);
        try {
            const period = new Date().toISOString().slice(0, 7);
            await saveExpense({ id: exp.id, status: 'Reimbursed', payroll_reimbursed_in: period });
            await reloadReimbursable();
        } finally {
            setReimbursingId(null);
        }
    };

    useEffect(() => { void reloadReimbursable(); }, []);

    const [activeView, setActiveView] = useState<'dashboard' | 'employees' | 'reports' | 'ai-assistant' | 'reimbursements'>('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const [processingPayroll, setProcessingPayroll] = useState(false);

    // Updated to hold detailed results from the new engine
    const [currentPayrollResults, setCurrentPayrollResults] = useState<CompletePayrollResult[]>([]);
    const [currentPayrollItems, setCurrentPayrollItems] = useState<PayrollItem[]>([]); // Keep for backward compat

    const [showPayrollReview, setShowPayrollReview] = useState(false);

    // FIX W4-2 — Per-employee inputs collected BEFORE the review modal so
    // overtime / sales / unpaid-leave / one-time-bonus values are real
    // user input, not Math.random() fabrications.
    const [showPayrollInputs, setShowPayrollInputs] = useState(false);
    const [payrollInputs, setPayrollInputs] = useState<Record<string, {
        overtimeHours: number;
        salesAchieved: number;
        unpaidLeaveDays: number;
        oneTimeBonus: number;
    }>>({});

    const [aiQuestion, setAiQuestion] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiThinking, setAiThinking] = useState(false);

    const [showAddEmployee, setShowAddEmployee] = useState(false);
    const [showPayslip, setShowPayslip] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // FIX W2-5 — Edit Employee modal state (compact 7-field subset).
    const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
    const [editForm, setEditForm] = useState({
        name: '', email: '', jobTitle: '', department: '',
        salaryType: 'Monthly' as 'Hourly' | 'Monthly' | 'Annual',
        salaryAmount: 0,
        // FIX: match Employee.status enum exactly ('Active' | 'On Leave' | 'Terminated').
        status: 'Active' as 'Active' | 'On Leave' | 'Terminated',
    });
    const [savingEmpEdit, setSavingEmpEdit] = useState(false);

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

    // FIX W4-3 — Scoped print helper. Marks one element as the print
    // target so the @media print rule in theme.css can hide everything
    // else (sidebar, nav, other modals). No external library — uses the
    // browser's native print dialog + CSS visibility scoping.
    const printSection = (name: 'payslip' | 'summary' | 'tax' | 'earnings') => {
        const target = document.querySelector(`[data-print-section="${name}"]`);
        if (!target) {
            alert('Nothing to print on this page.');
            return;
        }
        target.setAttribute('data-print-target', '');
        document.body.classList.add('printing-section');
        const cleanup = () => {
            target.removeAttribute('data-print-target');
            document.body.classList.remove('printing-section');
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        // Safety net — some browsers (notably Safari) don't fire
        // afterprint when the user cancels. Hard-clean after 2s.
        setTimeout(cleanup, 2000);
        window.print();
    };

    // TASK 3 — Generate a real payslip PDF for a single employee.
    // Runs the engine with neutral defaults (22 working days, 0 OT, 0
    // sales) so we always get an earnings/deductions breakdown even
    // when the user hasn't run a full payroll batch yet. Catches errors
    // so a broken engine never leaves the user with a blank screen.
    const handleDownloadPayslipPDF = (employee: Employee | null) => {
        if (!employee) return;
        try {
            const period = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const compEmp = convertToComprehensive(employee);
            const input: PayrollInput = {
                employee: compEmp,
                daysWorked: 22,
                totalWorkingDays: 22,
                overtimeHours: 0,
                salesAchieved: 0,
                salesTarget: 30000,
                unpaidLeaveDays: 0,
                oneTimeBonus: 0,
                period,
            };
            const result = calculateComprehensivePayroll(input);
            generatePayslipPDF({ employee, result, period });
        } catch (e) {
            console.error('Payslip PDF generation failed:', e);
            alert('Could not generate payslip PDF: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    // FIX W4-2 — Step 1: open the inputs modal. Seeds zeros for every
    // Active employee so unfilled fields are honest (0) rather than
    // hidden Math.random() values masquerading as real data.
    const handleStartPayroll = () => {
        const active = employees.filter(e => e.status === 'Active');
        if (active.length === 0) {
            alert('No active employees to run payroll for.');
            return;
        }
        const seed: typeof payrollInputs = {};
        active.forEach(e => {
            seed[e.id] = { overtimeHours: 0, salesAchieved: 0, unpaidLeaveDays: 0, oneTimeBonus: 0 };
        });
        setPayrollInputs(seed);
        setShowPayrollInputs(true);
    };

    // FIX W4-2 — Step 2: calculate from real user inputs. Replaces the
    // old handleRunPayroll which used Math.random() for overtime and
    // sales. Same engine call, same downstream review modal — only the
    // inputs are now honest.
    const handleCalculatePayroll = async () => {
        setProcessingPayroll(true);
        try {
            const now = new Date();
            const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            const results: CompletePayrollResult[] = [];
            const simpleItems: PayrollItem[] = [];

            for (const emp of employees.filter(e => e.status === 'Active')) {
                const inp = payrollInputs[emp.id] || {
                    overtimeHours: 0, salesAchieved: 0, unpaidLeaveDays: 0, oneTimeBonus: 0,
                };
                const compEmp = convertToComprehensive(emp);

                const input: PayrollInput = {
                    employee: compEmp,
                    daysWorked: 22,
                    totalWorkingDays: 22,
                    overtimeHours: inp.overtimeHours,
                    // Sales only counts for Sales-department employees (matches
                    // the original gate; non-Sales rows leave the field as 0).
                    salesAchieved: emp.department === 'Sales' ? inp.salesAchieved : 0,
                    salesTarget: 30000,
                    unpaidLeaveDays: inp.unpaidLeaveDays,
                    oneTimeBonus: inp.oneTimeBonus,
                    period,
                };

                const result = calculateComprehensivePayroll(input);
                results.push(result);

                simpleItems.push({
                    id: Math.random().toString(),
                    payrollRunId: 'temp',
                    employeeId: emp.id,
                    employeeName: emp.name,
                    regularHours: 160,
                    overtimeHours: inp.overtimeHours,
                    grossPay: result.grossPay,
                    netPay: result.netPay,
                    tax: result.taxes.totalTax,
                    deductions: result.totalDeductions,
                    ...result.taxes,
                } as any);
            }

            setCurrentPayrollResults(results);
            setCurrentPayrollItems(simpleItems);
            setShowPayrollInputs(false);
            setShowPayrollReview(true);
        } catch (error) {
            console.error('Failed to calculate payroll:', error);
            alert('Failed to calculate payroll');
        } finally {
            setProcessingPayroll(false);
        }
    };

    const handleApprovePayroll = async () => {
        if (currentPayrollResults.length === 0) return;
        try {
            // FIX W4-1 — Previously this invented a 'RUN-${Date.now()}' id
            // and passed it straight to processPayroll, which looks runs up
            // by id and threw "Payroll run not found" every single time. The
            // end-to-end approve step was dead. Now we create the run first
            // (Draft status, current month's window) and use its real id.
            const now = new Date();
            const period = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            const newRun = await createPayrollRun(period, startDate, endDate);

            // Stamp every PayrollItem with the real run id so processPayroll's
            // gross/tax/net totals get attributed to this run.
            const itemsForRun = currentPayrollItems.map(it => ({ ...it, payrollRunId: newRun.id }));

            await processPayroll(newRun.id, itemsForRun);

            // FIX W4-4 — sendAllPayslips was a console.log stub that NEVER
            // emailed or SMS'd anyone. Removed entirely so we don't claim
            // delivery that never happened. Payslips are still generated
            // by the engine and downloadable per-employee via the View
            // modal's Download button (W4-3 print-only flow).
            const activeCount = employees.filter(e => e.status === 'Active').length;

            await loadData();
            setShowPayrollReview(false);
            setCurrentPayrollResults([]);
            setCurrentPayrollItems([]);
            alert(`✅ Payroll processed for ${activeCount} employee${activeCount === 1 ? '' : 's'}. Open any employee to download their payslip.`);
        } catch (error) {
            console.error('Failed to approve payroll:', error);
            const msg = error instanceof Error ? error.message : 'Failed to approve payroll';
            alert(`Failed to approve payroll: ${msg}`);
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

    // FIX W2-5 — Open edit modal prefilled with this employee's data.
    const handleOpenEditEmployee = (emp: Employee) => {
        setEditEmployee(emp);
        setEditForm({
            name: emp.name,
            email: emp.email,
            jobTitle: emp.jobTitle,
            department: emp.department,
            salaryType: emp.salaryType,
            salaryAmount: emp.salaryAmount,
            // FIX: map legacy 'Inactive' onto the closest valid Employee
            // status ('Terminated'). Falls through to 'Active' otherwise.
            status: emp.status === 'On Leave' ? 'On Leave' : emp.status === 'Terminated' ? 'Terminated' : 'Active',
        });
    };

    // FIX W2-5 — Save the edited employee back through saveEmployee
    // (which handles update-by-id semantics on its own).
    const handleSaveEditEmployee = async () => {
        if (!editEmployee) return;
        if (!editForm.name || !editForm.email) {
            alert('Name and email are required.');
            return;
        }
        setSavingEmpEdit(true);
        try {
            await saveEmployee({ id: editEmployee.id, ...editForm });
            await loadData();
            setEditEmployee(null);
            alert('✅ Employee updated.');
        } catch (e) {
            alert('Failed to save changes: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSavingEmpEdit(false);
        }
    };

    // FIX W2-5 — Delete with unreimbursed-expense warning.
    // Expense.createdBy is free-text so we fuzzy-match against name,
    // employeeId, and id; misses are possible if createdBy was entered
    // with a different spelling. Best-effort guard.
    const handleDeleteEmployeeClick = async (emp: Employee) => {
        const linked = reimbursableExpenses.filter(e =>
            e.createdBy === emp.name ||
            e.createdBy === emp.employeeId ||
            e.createdBy === emp.id
        );
        let msg = `Delete employee ${emp.name}? This cannot be undone.`;
        if (linked.length > 0) {
            const total = linked.reduce((s, e) => s + e.amount, 0);
            msg = `⚠️ ${emp.name} has ${linked.length} unreimbursed expense(s) ` +
                `totaling $${total.toFixed(2)}. Deleting now will leave those ` +
                `expense records without an owner.\n\nProceed with delete anyway?`;
        }
        if (!window.confirm(msg)) return;
        try {
            await deleteEmployee(emp.id);
            await loadData();
        } catch (e) {
            alert('Could not delete: ' + (e instanceof Error ? e.message : String(e)));
        }
    };

    // FIX W4-4 — handleSendPayslip removed. The old impl alerted
    // "✅ Payslip sent via email & SMS" but only console.log'd in dev.
    // No SMTP/SMS provider is wired. Payslips are now download-only
    // via the View modal's Download button (powered by printSection).

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
                            onClick={handleStartPayroll}
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
                    { id: 'reimbursements', label: 'Reimbursements', icon: HandCoins },
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
                                        {/* FIX W4-4 — Removed "Pay Stub" button. It used to call
                                            the fake handleSendPayslip (console.log only). View
                                            already opens the payslip with a working Download. */}
                                        {/* FIX W2-5 — Per-row Edit + Delete */}
                                        <button
                                            onClick={() => handleOpenEditEmployee(employee)}
                                            className="px-4 py-2 bg-gray-100 rounded-xl hover:bg-redwood-brand hover:text-white transition-all text-[10px] font-black uppercase flex items-center gap-1"
                                        ><Edit2 size={12} /> Edit</button>
                                        <button
                                            onClick={() => handleDeleteEmployeeClick(employee)}
                                            className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-600 hover:text-white transition-all text-[10px] font-black uppercase flex items-center gap-1"
                                        ><Trash2 size={12} /> Delete</button>
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
                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm" data-print-section="summary">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Payroll Summary</h3>
                                <button onClick={() => printSection('summary')} aria-label="Download payroll summary" className="text-gray-400 hover:text-gray-900 transition-colors">
                                    <Download size={20} />
                                </button>
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

                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm" data-print-section="tax">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Tax Report</h3>
                                <button onClick={() => printSection('tax')} aria-label="Download tax report" className="text-gray-400 hover:text-gray-900 transition-colors">
                                    <Download size={20} />
                                </button>
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

                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden" data-print-section="earnings">
                        <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Employee Earnings</h3>
                            <button onClick={() => printSection('earnings')} aria-label="Download employee earnings" className="text-gray-400 hover:text-gray-900 transition-colors">
                                <Download size={20} />
                            </button>
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

            {/* STEP 11C — Reimbursements View */}
            {activeView === 'reimbursements' && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter flex items-center gap-2">
                                <HandCoins size={20} className="text-amber-600" /> Pending Reimbursements
                            </h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                                Approved out-of-pocket expenses owed back to employees
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-amber-700 font-mono">
                                ${reimbursableExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                            </p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                {reimbursableExpenses.length} pending
                            </p>
                        </div>
                    </div>
                    <div className="p-3 mx-8 mt-4 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                        ⚠ Tracked separately from payroll-run totals.  Pay these out via your usual payroll flow, then click "Mark Reimbursed".
                    </div>
                    {reimbursableExpenses.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-16">No pending reimbursements 🎉</p>
                    ) : (
                        <div className="overflow-x-auto p-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Employee</th>
                                        <th className="px-4 py-3 text-left">Vendor / Description</th>
                                        <th className="px-4 py-3 text-left">Method</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reimbursableExpenses.map(exp => (
                                        <tr key={exp.id}>
                                            <td className="px-4 py-3 text-xs">{new Date(exp.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-xs font-bold">{exp.createdBy}</td>
                                            <td className="px-4 py-3 text-xs">{exp.vendor} <span className="text-gray-400">— {exp.description || exp.category}</span></td>
                                            <td className="px-4 py-3 text-xs">{exp.paymentMethod}</td>
                                            <td className="px-4 py-3 text-xs text-right font-mono font-black">${exp.amount.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => void markReimbursed(exp)}
                                                    disabled={reimbursingId === exp.id}
                                                    className="text-xs font-black text-amber-700 hover:text-amber-900 uppercase tracking-widest hover:underline disabled:opacity-50"
                                                >
                                                    {reimbursingId === exp.id ? 'Marking…' : 'Mark Reimbursed'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
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

            {/* FIX W2-5 — Edit Employee modal (compact 7-field subset). */}
            {editEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden">
                        <div className="p-10 border-b border-gray-100 bg-gray-900 text-white flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Edit Employee</p>
                                <h3 className="text-2xl font-black uppercase tracking-tighter mt-1">{editEmployee.name}</h3>
                            </div>
                            <button onClick={() => setEditEmployee(null)} className="p-2 hover:bg-white/20 rounded-xl transition-all"><X size={24} /></button>
                        </div>
                        <div className="p-12 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Full Name *</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Email *</label>
                                    <input
                                        type="email"
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Job Title *</label>
                                    <input
                                        type="text"
                                        value={editForm.jobTitle}
                                        onChange={(e) => setEditForm(f => ({ ...f, jobTitle: e.target.value }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Department *</label>
                                    <select
                                        value={editForm.department}
                                        onChange={(e) => setEditForm(f => ({ ...f, department: e.target.value }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                    >
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
                                    <select
                                        value={editForm.salaryType}
                                        onChange={(e) => setEditForm(f => ({ ...f, salaryType: e.target.value as 'Hourly' | 'Monthly' | 'Annual' }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                    >
                                        <option value="Monthly">Monthly</option>
                                        <option value="Hourly">Hourly</option>
                                        <option value="Annual">Annual</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Salary Amount *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editForm.salaryAmount}
                                        onChange={(e) => setEditForm(f => ({ ...f, salaryAmount: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-3">Status</label>
                                <select
                                    value={editForm.status}
                                    onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value as 'Active' | 'On Leave' | 'Terminated' }))}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                                >
                                    <option value="Active">Active</option>
                                    <option value="On Leave">On Leave</option>
                                    <option value="Terminated">Terminated</option>
                                </select>
                            </div>
                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                ⚠️ Insurance, retirement, and tax-withholding fields aren't editable here. They keep the values set during Add.
                            </p>
                        </div>
                        <div className="p-10 bg-gray-50 border-t border-gray-100 flex gap-4">
                            <button
                                onClick={() => setEditEmployee(null)}
                                disabled={savingEmpEdit}
                                className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all disabled:opacity-50"
                            >Cancel</button>
                            <button
                                onClick={handleSaveEditEmployee}
                                disabled={savingEmpEdit}
                                className="flex-[2] py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl disabled:opacity-50"
                            >{savingEmpEdit ? 'Saving…' : '✅ Save Changes'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Details Modal */}
            {showPayslip && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        {/* FIX W4-3 — Wrap only the payslip content (header + body)
                            with data-print-section. The action footer below is
                            intentionally OUTSIDE so it doesn't print. */}
                        <div data-print-section="payslip">
                            <div className="p-4 sm:p-8 md:p-10 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">{selectedEmployee.name}</h3>
                                    <p className="text-sm text-blue-200 font-medium">{selectedEmployee.jobTitle}</p>
                                </div>
                                <button onClick={() => setShowPayslip(false)} className="p-2 hover:bg-white/20 rounded-xl transition-all print:hidden" aria-label="Close"><X size={24} /></button>
                            </div>
                            <div className="p-4 sm:p-8 md:p-12 space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                        </div>
                        <div className="p-4 sm:p-8 md:p-10 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                            <button onClick={() => setShowPayslip(false)} className="flex-1 py-4 sm:py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all">Close</button>
                            {/* FIX W4-4 — Removed "Send Payslip" button. There's no
                                email/SMS provider wired; the old button claimed delivery
                                that never happened. Download is now the primary action. */}
                            <button onClick={() => handleDownloadPayslipPDF(selectedEmployee)} className="flex-[2] py-4 sm:py-5 bg-gray-900 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2">
                                <Download size={18} /> Download Payslip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FIX W4-2 — Per-employee Inputs modal (precedes the Review modal).
                Collects real overtime, sales, unpaid-leave, and one-time-bonus
                values instead of the old Math.random() fabrications. */}
            {showPayrollInputs && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-md bg-black/40">
                    <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-10 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                                <Play size={28} /> Payroll Inputs - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </h3>
                            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mt-1">
                                Enter actual values per employee. Leave at 0 if not applicable.
                            </p>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b-2 border-gray-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Overtime (hrs)</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Sales Achieved ($)</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Unpaid Leave (days)</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">One-time Bonus ($)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {employees.filter(e => e.status === 'Active').map(emp => {
                                        const inp = payrollInputs[emp.id] || { overtimeHours: 0, salesAchieved: 0, unpaidLeaveDays: 0, oneTimeBonus: 0 };
                                        const isSales = emp.department === 'Sales';
                                        return (
                                            <tr key={emp.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900 text-sm">{emp.name}</div>
                                                    <div className="text-[10px] text-gray-400 uppercase font-black mt-0.5">{emp.jobTitle} · {emp.department}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={inp.overtimeHours}
                                                        onChange={(e) => setPayrollInputs(p => ({
                                                            ...p,
                                                            [emp.id]: { ...inp, overtimeHours: parseFloat(e.target.value) || 0 },
                                                        }))}
                                                        className="w-24 px-3 py-2 text-right border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {isSales ? (
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="100"
                                                            value={inp.salesAchieved}
                                                            onChange={(e) => setPayrollInputs(p => ({
                                                                ...p,
                                                                [emp.id]: { ...inp, salesAchieved: parseFloat(e.target.value) || 0 },
                                                            }))}
                                                            className="w-32 px-3 py-2 text-right border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                        />
                                                    ) : (
                                                        <span className="text-xs text-gray-300 font-mono">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={inp.unpaidLeaveDays}
                                                        onChange={(e) => setPayrollInputs(p => ({
                                                            ...p,
                                                            [emp.id]: { ...inp, unpaidLeaveDays: parseFloat(e.target.value) || 0 },
                                                        }))}
                                                        className="w-24 px-3 py-2 text-right border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="50"
                                                        value={inp.oneTimeBonus}
                                                        onChange={(e) => setPayrollInputs(p => ({
                                                            ...p,
                                                            [emp.id]: { ...inp, oneTimeBonus: parseFloat(e.target.value) || 0 },
                                                        }))}
                                                        className="w-28 px-3 py-2 text-right border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3 mt-6">
                                ℹ️ Days worked is currently hardcoded at 22 (full month). Time-tracking integration is a future enhancement.
                            </p>
                        </div>
                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                            <button
                                onClick={() => setShowPayrollInputs(false)}
                                disabled={processingPayroll}
                                className="flex-1 py-5 bg-white border border-gray-200 text-[11px] font-black uppercase tracking-widest text-gray-600 rounded-2xl hover:bg-gray-100 transition-all disabled:opacity-50"
                            >Cancel</button>
                            <button
                                onClick={handleCalculatePayroll}
                                disabled={processingPayroll}
                                className="flex-[2] py-5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-xl disabled:opacity-50"
                            >
                                {processingPayroll ? 'Calculating…' : 'Calculate Payroll →'}
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
