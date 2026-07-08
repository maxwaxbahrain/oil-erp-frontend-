// AI-Powered Payroll Service

import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';
import type { CompletePayrollResult } from './payrollCalculationEngine';
import type { LeaveType, LeaveStatus } from './leaveService';

export interface Employee {
    id: string;
    name: string;
    email: string;
    jobTitle: string;
    department: string;
    employeeId: string;
    status: 'Active' | 'On Leave' | 'Terminated';
    joinDate: string;

    // Compensation
    salaryType: 'Hourly' | 'Monthly' | 'Annual';
    salaryAmount: number;
    currency: string;

    // Tax Information
    filingStatus: 'Single' | 'Married' | 'Head of Household';
    allowances: number;
    additionalWithholding: number;

    // Benefits
    healthInsurance: boolean;
    retirement401k: boolean;
    retirement401kPercent: number;
    lifeInsurance: boolean;
    dentalInsurance: boolean;

    // Leave Balances
    vacationDays: number;
    sickDays: number;
    personalDays: number;

    // Direct Deposit
    bankName?: string;
    accountNumber?: string;
    routingNumber?: string;
}

export interface PayrollRun {
    id: string;
    period: string;
    startDate: string;
    endDate: string;
    payDate: string;
    status: 'Draft' | 'Processing' | 'Approved' | 'Paid' | 'Completed';
    totalGross: number;
    totalTax: number;
    totalDeductions: number;
    totalNet: number;
    employeeCount: number;
    createdAt: string;
    processedAt?: string;
}

export interface PayrollItem {
    id: string;
    payrollRunId: string;
    employeeId: string;
    employeeName: string;

    // Earnings
    regularHours: number;
    overtimeHours: number;
    regularPay: number;
    overtimePay: number;
    bonus: number;
    commission: number;
    grossPay: number;

    // Taxes (AI Calculated)
    federalTax: number;
    stateTax: number;
    localTax: number;
    socialSecurity: number;
    medicare: number;
    totalTax: number;

    // Deductions
    healthInsurance: number;
    retirement401k: number;
    lifeInsurance: number;
    dentalInsurance: number;
    otherDeductions: number;
    totalDeductions: number;

    // Net Pay
    netPay: number;

    // AI Metadata
    aiCalculated: boolean;
    aiConfidence: number;
    issues: string[];
}

export interface TimeEntry {
    employeeId: string;
    employeeName: string;
    regularHours: number;
    overtimeHours: number;
    ptoHours: number;
    sickHours: number;
}

export interface LeaveRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    status: LeaveStatus;
    reason?: string;
}

export interface TaxRate {
    federal: number;
    state: number;
    local: number;
    socialSecurity: number;
    medicare: number;
}

const EMPLOYEES_KEY = 'zavi_payroll_employees';
const PAYROLL_RUNS_KEY = 'zavi_payroll_runs';
const LEAVE_REQUESTS_KEY = 'zavi_leave_requests';

// Initialize with sample data
const getInitialEmployees = (): Employee[] => {
    const stored = localStorage.getItem(EMPLOYEES_KEY);
    if (stored) return JSON.parse(stored);

    const employees: Employee[] = [
        {
            id: 'EMP001',
            name: 'John Smith',
            email: 'john@company.com',
            jobTitle: 'Sales Manager',
            department: 'Sales',
            employeeId: 'EMP001',
            status: 'Active',
            joinDate: '2023-01-15',
            salaryType: 'Monthly',
            salaryAmount: 5000,
            currency: 'USD',
            filingStatus: 'Married',
            allowances: 2,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: true,
            retirement401kPercent: 5,
            lifeInsurance: true,
            dentalInsurance: false,
            vacationDays: 8,
            sickDays: 7,
            personalDays: 3,
            bankName: 'Chase Bank',
            accountNumber: '****1234',
            routingNumber: '021000021'
        },
        {
            id: 'EMP002',
            name: 'Sarah Lee',
            email: 'sarah@company.com',
            jobTitle: 'Marketing Specialist',
            department: 'Marketing',
            employeeId: 'EMP002',
            status: 'Active',
            joinDate: '2023-03-20',
            salaryType: 'Monthly',
            salaryAmount: 4500,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: true,
            retirement401kPercent: 5,
            lifeInsurance: true,
            dentalInsurance: true,
            vacationDays: 10,
            sickDays: 8,
            personalDays: 5,
            bankName: 'Bank of America',
            accountNumber: '****5678',
            routingNumber: '026009593'
        },
        {
            id: 'EMP003',
            name: 'Mike Johnson',
            email: 'mike@company.com',
            jobTitle: 'IT Specialist',
            department: 'IT',
            employeeId: 'EMP003',
            status: 'Active',
            joinDate: '2023-06-10',
            salaryType: 'Hourly',
            salaryAmount: 25,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: false,
            retirement401kPercent: 0,
            lifeInsurance: false,
            dentalInsurance: false,
            vacationDays: 12,
            sickDays: 10,
            personalDays: 5,
            bankName: 'Wells Fargo',
            accountNumber: '****9012',
            routingNumber: '121000248'
        },
        {
            id: 'EMP004',
            name: 'James Okonkwo',
            email: 'james@company.com',
            jobTitle: 'Delivery Driver',
            department: 'Logistics',
            employeeId: 'EMP004',
            status: 'Active',
            joinDate: '2023-08-01',
            salaryType: 'Hourly',
            salaryAmount: 22,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: false,
            retirement401kPercent: 0,
            lifeInsurance: false,
            dentalInsurance: false,
            vacationDays: 10,
            sickDays: 8,
            personalDays: 4,
            bankName: 'Chase Bank',
            accountNumber: '****3344',
            routingNumber: '021000021'
        },
        {
            id: 'EMP005',
            name: 'Priya Nair',
            email: 'priya@company.com',
            jobTitle: 'Accounts Clerk',
            department: 'Finance',
            employeeId: 'EMP005',
            status: 'Active',
            joinDate: '2024-02-01',
            salaryType: 'Monthly',
            salaryAmount: 3800,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: true,
            retirement401kPercent: 4,
            lifeInsurance: true,
            dentalInsurance: false,
            vacationDays: 12,
            sickDays: 10,
            personalDays: 5,
            bankName: 'Bank of America',
            accountNumber: '****7788',
            routingNumber: '026009593'
        },
        {
            id: 'EMP006',
            name: 'Carlos Mendez',
            email: 'carlos@company.com',
            jobTitle: 'Field Sales',
            department: 'Sales',
            employeeId: 'EMP006',
            status: 'Active',
            joinDate: '2023-11-15',
            salaryType: 'Monthly',
            salaryAmount: 4200,
            currency: 'USD',
            filingStatus: 'Married',
            allowances: 2,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: true,
            retirement401kPercent: 5,
            lifeInsurance: true,
            dentalInsurance: true,
            vacationDays: 9,
            sickDays: 7,
            personalDays: 3,
            bankName: 'Wells Fargo',
            accountNumber: '****4455',
            routingNumber: '121000248'
        },
        {
            id: 'EMP007',
            name: 'David Chen',
            email: 'david@company.com',
            jobTitle: 'Warehouse Assistant',
            department: 'Operations',
            employeeId: 'EMP007',
            status: 'Active',
            joinDate: '2024-04-10',
            salaryType: 'Hourly',
            salaryAmount: 20,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: false,
            retirement401kPercent: 0,
            lifeInsurance: false,
            dentalInsurance: false,
            vacationDays: 8,
            sickDays: 8,
            personalDays: 4,
            bankName: 'Chase Bank',
            accountNumber: '****9900',
            routingNumber: '021000021'
        },
        {
            id: 'EMP008',
            name: 'Fatima Al-Hassan',
            email: 'fatima@company.com',
            jobTitle: 'Route Supervisor',
            department: 'Logistics',
            employeeId: 'EMP008',
            status: 'Active',
            joinDate: '2022-09-01',
            salaryType: 'Monthly',
            salaryAmount: 4800,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: true,
            retirement401kPercent: 6,
            lifeInsurance: true,
            dentalInsurance: true,
            vacationDays: 14,
            sickDays: 10,
            personalDays: 5,
            bankName: 'Bank of America',
            accountNumber: '****1122',
            routingNumber: '026009593'
        },
        {
            id: 'EMP009',
            name: 'Tom Reed',
            email: 'tom@company.com',
            jobTitle: 'Van Driver',
            department: 'Logistics',
            employeeId: 'EMP009',
            status: 'Active',
            joinDate: '2024-01-20',
            salaryType: 'Hourly',
            salaryAmount: 21,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: false,
            retirement401kPercent: 0,
            lifeInsurance: false,
            dentalInsurance: false,
            vacationDays: 10,
            sickDays: 9,
            personalDays: 4,
            bankName: 'Wells Fargo',
            accountNumber: '****6677',
            routingNumber: '121000248'
        },
        {
            id: 'EMP010',
            name: 'Anna Petrov',
            email: 'anna@company.com',
            jobTitle: 'Office Coordinator',
            department: 'Admin',
            employeeId: 'EMP010',
            status: 'Active',
            joinDate: '2023-05-01',
            salaryType: 'Monthly',
            salaryAmount: 3600,
            currency: 'USD',
            filingStatus: 'Single',
            allowances: 1,
            additionalWithholding: 0,
            healthInsurance: true,
            retirement401k: true,
            retirement401kPercent: 4,
            lifeInsurance: false,
            dentalInsurance: true,
            vacationDays: 11,
            sickDays: 9,
            personalDays: 5,
            bankName: 'Chase Bank',
            accountNumber: '****8899',
            routingNumber: '021000021'
        }
    ];

    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
    return employees;
};

const getInitialPayrollRuns = (): PayrollRun[] => {
    const stored = localStorage.getItem(PAYROLL_RUNS_KEY);
    if (stored) return JSON.parse(stored);

    const runs: PayrollRun[] = [
        {
            id: 'PR-2024-11',
            period: 'November 2024',
            startDate: '2024-11-01',
            endDate: '2024-11-30',
            payDate: '2024-11-30',
            status: 'Completed',
            totalGross: 75000,
            totalTax: 18750,
            totalDeductions: 3500,
            totalNet: 52750,
            employeeCount: 15,
            createdAt: '2024-11-28T10:00:00Z',
            processedAt: '2024-11-30T14:00:00Z'
        },
        {
            id: 'PR-2024-10',
            period: 'October 2024',
            startDate: '2024-10-01',
            endDate: '2024-10-31',
            payDate: '2024-10-31',
            status: 'Completed',
            totalGross: 73500,
            totalTax: 18375,
            totalDeductions: 3400,
            totalNet: 51725,
            employeeCount: 15,
            createdAt: '2024-10-28T10:00:00Z',
            processedAt: '2024-10-31T14:00:00Z'
        }
    ];

    localStorage.setItem(PAYROLL_RUNS_KEY, JSON.stringify(runs));
    return runs;
};

const getInitialLeaveRequests = (): LeaveRequest[] => {
    const stored = localStorage.getItem(LEAVE_REQUESTS_KEY);
    if (stored) return JSON.parse(stored);

    const requests: LeaveRequest[] = [
        {
            id: 'LR-001',
            employeeId: 'EMP001',
            employeeName: 'John Smith',
            leaveType: 'Paid Time Off', // Matched to LeaveType
            startDate: '2025-01-15',
            endDate: '2025-01-19',
            daysCount: 5,
            status: 'Pending',
            reason: 'Family vacation'
        },
        {
            id: 'LR-002',
            employeeId: 'EMP002',
            employeeName: 'Sarah Lee',
            leaveType: 'Sick Leave',
            startDate: '2024-12-28',
            endDate: '2024-12-28',
            daysCount: 1,
            status: 'Pending',
            reason: 'Not feeling well'
        }
    ];

    localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));
    return requests;
};

// AI Tax Calculator
export function calculateTaxes(grossPay: number, filingStatus: string, allowances: number): {
    federalTax: number;
    stateTax: number;
    localTax: number;
    socialSecurity: number;
    medicare: number;
} {
    // Simplified tax calculation (in real app, use actual IRS tables)
    const federalRate = filingStatus === 'Married' ? 0.15 : 0.18;
    const stateRate = 0.06; // Example: NY state tax
    const localRate = 0.03; // Example: NYC local tax
    const ssRate = 0.062;
    const medicareRate = 0.0145;

    const allowanceDeduction = allowances * 300; // Simplified
    const taxableIncome = Math.max(0, grossPay - allowanceDeduction);

    return {
        federalTax: parseFloat((taxableIncome * federalRate).toFixed(2)),
        stateTax: parseFloat((taxableIncome * stateRate).toFixed(2)),
        localTax: parseFloat((taxableIncome * localRate).toFixed(2)),
        socialSecurity: parseFloat((grossPay * ssRate).toFixed(2)),
        medicare: parseFloat((grossPay * medicareRate).toFixed(2))
    };
}

// AI Payroll Calculator
export async function calculatePayrollItem(
    employee: Employee,
    timeEntry: TimeEntry
): Promise<PayrollItem> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Calculate earnings
            let regularPay = 0;
            let overtimePay = 0;

            if (employee.salaryType === 'Hourly') {
                regularPay = timeEntry.regularHours * employee.salaryAmount;
                overtimePay = timeEntry.overtimeHours * employee.salaryAmount * 1.5;
            } else if (employee.salaryType === 'Monthly') {
                regularPay = employee.salaryAmount;
                // Adjust for unpaid leave
                const totalHours = timeEntry.regularHours + timeEntry.overtimeHours;
                if (totalHours < 160) { // Assuming 160 hours/month
                    regularPay = (totalHours / 160) * employee.salaryAmount;
                }
            }

            const grossPay = regularPay + overtimePay;

            // AI Tax Calculation
            const taxes = calculateTaxes(grossPay, employee.filingStatus, employee.allowances);

            // Calculate deductions
            const healthInsurance = employee.healthInsurance ? 200 : 0;
            const retirement401k = employee.retirement401k ? grossPay * (employee.retirement401kPercent / 100) : 0;
            const lifeInsurance = employee.lifeInsurance ? 50 : 0;
            const dentalInsurance = employee.dentalInsurance ? 30 : 0;

            const totalTax = taxes.federalTax + taxes.stateTax + taxes.localTax +
                taxes.socialSecurity + taxes.medicare;
            const totalDeductions = healthInsurance + retirement401k + lifeInsurance + dentalInsurance;
            const netPay = grossPay - totalTax - totalDeductions;

            const issues: string[] = [];
            if (timeEntry.overtimeHours > 0) {
                issues.push(`${timeEntry.overtimeHours} hours overtime detected`);
            }

            const payrollItem: PayrollItem = {
                id: `PI-${Date.now()}-${employee.id}`,
                payrollRunId: '',
                employeeId: employee.id,
                employeeName: employee.name,
                regularHours: timeEntry.regularHours,
                overtimeHours: timeEntry.overtimeHours,
                regularPay: parseFloat(regularPay.toFixed(2)),
                overtimePay: parseFloat(overtimePay.toFixed(2)),
                bonus: 0,
                commission: 0,
                grossPay: parseFloat(grossPay.toFixed(2)),
                federalTax: taxes.federalTax,
                stateTax: taxes.stateTax,
                localTax: taxes.localTax,
                socialSecurity: taxes.socialSecurity,
                medicare: taxes.medicare,
                totalTax: parseFloat(totalTax.toFixed(2)),
                healthInsurance,
                retirement401k: parseFloat(retirement401k.toFixed(2)),
                lifeInsurance,
                dentalInsurance,
                otherDeductions: 0,
                totalDeductions: parseFloat(totalDeductions.toFixed(2)),
                netPay: parseFloat(netPay.toFixed(2)),
                aiCalculated: true,
                aiConfidence: 98,
                issues
            };

            resolve(payrollItem);
        }, 500);
    });
}

// CRUD Operations
export async function getEmployees(): Promise<Employee[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialEmployees()), 100);
    });
}

// FIX W2-5 — Hard-delete an employee from the localStorage roster.
// Storage is purely client-side so this is a synchronous removal wrapped
// in a Promise for API symmetry with the rest of payrollService.
export async function deleteEmployee(id: string): Promise<void> {
    return new Promise((resolve) => {
        const employees = getInitialEmployees().filter(e => e.id !== id);
        localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
        setTimeout(() => resolve(), 60);
    });
}

export async function saveEmployee(employee: Partial<Employee>): Promise<Employee> {
    return new Promise((resolve) => {
        const employees = getInitialEmployees();
        let savedEmployee: Employee;

        if (employee.id) {
            const index = employees.findIndex(e => e.id === employee.id);
            if (index !== -1) {
                employees[index] = { ...employees[index], ...employee } as Employee;
                savedEmployee = employees[index];
            } else {
                savedEmployee = { ...employee, id: employee.id } as Employee;
                employees.push(savedEmployee);
            }
        } else {
            savedEmployee = {
                ...employee,
                id: `EMP${String(employees.length + 1).padStart(3, '0')}`,
                employeeId: `EMP${String(employees.length + 1).padStart(3, '0')}`,
                status: 'Active',
                joinDate: new Date().toISOString().split('T')[0],
                vacationDays: 15,
                sickDays: 10,
                personalDays: 5
            } as Employee;
            employees.push(savedEmployee);
        }

        localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
        setTimeout(() => resolve(savedEmployee), 100);
    });
}

export async function getPayrollRuns(): Promise<PayrollRun[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialPayrollRuns()), 100);
    });
}

export async function createPayrollRun(period: string, startDate: string, endDate: string): Promise<PayrollRun> {
    return new Promise((resolve) => {
        const runs = getInitialPayrollRuns();
        const newRun: PayrollRun = {
            id: `PR-${Date.now()}`,
            period,
            startDate,
            endDate,
            payDate: endDate,
            status: 'Draft',
            totalGross: 0,
            totalTax: 0,
            totalDeductions: 0,
            totalNet: 0,
            employeeCount: 0,
            createdAt: new Date().toISOString()
        };
        runs.unshift(newRun);
        localStorage.setItem(PAYROLL_RUNS_KEY, JSON.stringify(runs));
        setTimeout(() => resolve(newRun), 100);
    });
}

export async function processPayroll(payrollRunId: string, items: PayrollItem[]): Promise<PayrollRun> {
    return new Promise((resolve) => {
        const runs = getInitialPayrollRuns();
        const runIndex = runs.findIndex(r => r.id === payrollRunId);

        if (runIndex !== -1) {
            const totalGross = items.reduce((sum, item) => sum + item.grossPay, 0);
            const totalTax = items.reduce((sum, item) => sum + item.totalTax, 0);
            const totalDeductions = items.reduce((sum, item) => sum + item.totalDeductions, 0);
            const totalNet = items.reduce((sum, item) => sum + item.netPay, 0);

            runs[runIndex] = {
                ...runs[runIndex],
                status: 'Approved',
                totalGross: parseFloat(totalGross.toFixed(2)),
                totalTax: parseFloat(totalTax.toFixed(2)),
                totalDeductions: parseFloat(totalDeductions.toFixed(2)),
                totalNet: parseFloat(totalNet.toFixed(2)),
                employeeCount: items.length,
                processedAt: new Date().toISOString()
            };

            localStorage.setItem(PAYROLL_RUNS_KEY, JSON.stringify(runs));
            setTimeout(() => resolve(runs[runIndex]), 1000);
        } else {
            throw new Error('Payroll run not found');
        }
    });
}

export async function getLeaveRequests(): Promise<LeaveRequest[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialLeaveRequests()), 100);
    });
}

export async function updateLeaveRequest(id: string, status: LeaveStatus): Promise<void> {
    return new Promise((resolve) => {
        const requests = getInitialLeaveRequests();
        const index = requests.findIndex(r => r.id === id);
        if (index !== -1) {
            requests[index].status = status;
            localStorage.setItem(LEAVE_REQUESTS_KEY, JSON.stringify(requests));
        }
        setTimeout(() => resolve(), 300);
    });
}

// AI Assistant - Natural Language Processing (Simulated)
export async function askPayrollAI(question: string): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const lowerQ = question.toLowerCase();

            if (lowerQ.includes('tax') && lowerQ.includes('last month')) {
                resolve('In November 2024, you paid:\n• Federal Tax: $11,500\n• State Tax (NY): $4,350\n• Social Security: $4,650\n• Medicare: $1,087.50\n• Total: $21,587.50');
            } else if (lowerQ.includes('overtime')) {
                resolve('Overtime costs for Q4 2024: $12,450\nEmployees with most overtime:\n1. John Smith: 15 hours\n2. Mike Johnson: 12 hours\n3. Sarah Lee: 8 hours');
            } else {
                resolve('I can help you with payroll questions! Try asking about taxes, overtime, employee pay, or deadlines.');
            }
        }, 1000);
    });
}

// CLEANUP-3 — Removed sendPayslipToEmployee + sendAllPayslips. They were
// console.log stubs that never actually sent email/SMS. W4-4 orphaned
// them from the UI (Send buttons removed). No callers remain.

// Generate payslip PDF (simulated)
export async function generatePayslipPDF(payrollItem: PayrollItem, _employee: Employee): Promise<string> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // In real app, generate actual PDF
            const pdfUrl = `data:application/pdf;base64,payslip-${payrollItem.id}`;
            resolve(pdfUrl);
        }, 500);
    });
}

// Compliance verification
export function verifyCompliance(employees: Employee[]): {
    passed: boolean;
    checks: Array<{ name: string; passed: boolean; message: string }>;
} {
    const checks = [
        {
            name: 'Minimum Wage',
            passed: employees.every(e => e.salaryType === 'Hourly' ? e.salaryAmount >= 15 : true),
            message: 'All employees meet minimum wage requirements'
        },
        {
            name: 'Tax Forms',
            passed: employees.every(e => e.filingStatus && e.allowances >= 0),
            message: 'All W-4 forms on file'
        },
        {
            name: 'Bank Info',
            passed: employees.every(e => e.bankName && e.accountNumber),
            message: 'All direct deposit information complete'
        },
        {
            name: 'Overtime Rules',
            passed: true,
            message: 'Overtime calculated at 1.5x for hours >40'
        }
    ];

    return {
        passed: checks.every(c => c.passed),
        checks
    };
}

// ── Phase 3c: tenant-scoped payroll API (real backend) ─────────

export interface PayrollProfile {
    id: number;
    tenantId?: number | null;
    employeeId: number;
    payType: string;
    monthlySalary?: number | null;
    hourlyRate?: number | null;
    overtimeRate?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

export interface ApiPayslipDeduction {
    id: number;
    tenantId?: number | null;
    payslipId: number;
    label: string;
    amount: number;
    createdAt?: string | null;
}

export interface ApiPayslip {
    id: number;
    tenantId?: number | null;
    payrollRunId: number;
    employeeId: number;
    regularHours: number;
    overtimeHours: number;
    basePay: number;
    overtimePay: number;
    grossPay: number;
    deductionsTotal: number;
    netPay: number;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    deductions: ApiPayslipDeduction[];
}

async function readPayrollApiError(r: Response): Promise<string> {
    try {
        const body = await r.json();
        if (typeof body?.detail === 'string') return body.detail;
        if (body?.detail) return JSON.stringify(body.detail);
    } catch {
        /* ignore */
    }
    return `Request failed (${r.status})`;
}

function fromPayrollProfile(raw: Record<string, unknown>): PayrollProfile {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        payType: String(raw.payType ?? raw.pay_type ?? ''),
        monthlySalary: raw.monthlySalary != null
            ? Number(raw.monthlySalary)
            : raw.monthly_salary != null
              ? Number(raw.monthly_salary)
              : null,
        hourlyRate: raw.hourlyRate != null
            ? Number(raw.hourlyRate)
            : raw.hourly_rate != null
              ? Number(raw.hourly_rate)
              : null,
        overtimeRate: raw.overtimeRate != null
            ? Number(raw.overtimeRate)
            : raw.overtime_rate != null
              ? Number(raw.overtime_rate)
              : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

function fromPayslipDeduction(raw: Record<string, unknown>): ApiPayslipDeduction {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        payslipId: Number(raw.payslipId ?? raw.payslip_id),
        label: String(raw.label ?? ''),
        amount: Number(raw.amount ?? 0),
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
    };
}

function fromPayslip(raw: Record<string, unknown>): ApiPayslip {
    const deductionsRaw = raw.deductions;
    const deductions = Array.isArray(deductionsRaw)
        ? deductionsRaw.map((row) => fromPayslipDeduction(row as Record<string, unknown>))
        : [];
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        payrollRunId: Number(raw.payrollRunId ?? raw.payroll_run_id),
        employeeId: Number(raw.employeeId ?? raw.employee_id),
        regularHours: Number(raw.regularHours ?? raw.regular_hours ?? 0),
        overtimeHours: Number(raw.overtimeHours ?? raw.overtime_hours ?? 0),
        basePay: Number(raw.basePay ?? raw.base_pay ?? 0),
        overtimePay: Number(raw.overtimePay ?? raw.overtime_pay ?? 0),
        grossPay: Number(raw.grossPay ?? raw.gross_pay ?? 0),
        deductionsTotal: Number(raw.deductionsTotal ?? raw.deductions_total ?? 0),
        netPay: Number(raw.netPay ?? raw.net_pay ?? 0),
        status: String(raw.status ?? 'draft'),
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
        deductions,
    };
}

export function formatPayslipPeriod(createdAt?: string | null): string {
    if (!createdAt) return 'Pay period';
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return 'Pay period';
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatPayslipUsd(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function getPayslips(employeeId: number | string): Promise<ApiPayslip[]> {
    const r = await authFetch(
        `${API_BASE_URL}/payroll/payslips?employeeId=${encodeURIComponent(String(employeeId))}`,
    );
    if (!r.ok) throw new Error(await readPayrollApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromPayslip(row as Record<string, unknown>));
}

export async function getPayslip(id: number | string): Promise<ApiPayslip> {
    const r = await authFetch(`${API_BASE_URL}/payroll/payslips/${encodeURIComponent(String(id))}`);
    if (!r.ok) throw new Error(await readPayrollApiError(r));
    return fromPayslip((await r.json()) as Record<string, unknown>);
}

export async function getPayrollProfile(employeeId: number | string): Promise<PayrollProfile> {
    const r = await authFetch(
        `${API_BASE_URL}/payroll/profiles/${encodeURIComponent(String(employeeId))}`,
    );
    if (!r.ok) throw new Error(await readPayrollApiError(r));
    return fromPayrollProfile((await r.json()) as Record<string, unknown>);
}

export function mapPayslipToPayrollResult(payslip: ApiPayslip): CompletePayrollResult {
    const earnings = [
        { name: 'Base Pay', amount: payslip.basePay, type: 'Earning' as const },
    ];
    if (payslip.overtimePay > 0) {
        earnings.push({ name: 'Overtime Pay', amount: payslip.overtimePay, type: 'Earning' as const });
    }

    const deductions = (payslip.deductions || []).map((d) => ({
        name: d.label,
        amount: d.amount,
        type: 'Deduction' as const,
    }));
    if (deductions.length === 0 && payslip.deductionsTotal > 0) {
        deductions.push({ name: 'Deductions', amount: payslip.deductionsTotal, type: 'Deduction' as const });
    }

    return {
        employeeId: String(payslip.employeeId),
        period: formatPayslipPeriod(payslip.createdAt),
        grossPay: payslip.grossPay,
        netPay: payslip.netPay,
        totalDeductions: payslip.deductionsTotal,
        earnings,
        deductions,
        employerContributions: [],
        taxes: {
            federalTax: 0,
            stateTax: 0,
            socialSecurity: 0,
            medicare: 0,
            totalTax: 0,
        },
        meta: {
            isProRata: false,
            currency: 'USD',
            exchangeRateToUSD: 1,
        },
    };
}

export function mapPortalEmployeeToPayrollPdfEmployee(
    emp: {
        id: string;
        name: string;
        employeeNumber: string;
        department?: string;
        role: string;
        email?: string;
        hireDateIso?: string;
    },
    profile?: PayrollProfile | null,
): Employee {
    const payType = profile?.payType?.toLowerCase();
    const salaryType: Employee['salaryType'] = payType === 'hourly' ? 'Hourly' : 'Monthly';
    const salaryAmount = payType === 'hourly'
        ? Number(profile?.hourlyRate ?? 0)
        : Number(profile?.monthlySalary ?? 0);

    return {
        id: emp.id,
        name: emp.name,
        email: emp.email || '',
        jobTitle: emp.role,
        department: emp.department || '',
        employeeId: emp.employeeNumber,
        status: 'Active',
        joinDate: emp.hireDateIso || '',
        salaryType,
        salaryAmount,
        currency: 'USD',
        filingStatus: 'Single',
        allowances: 0,
        additionalWithholding: 0,
        healthInsurance: false,
        retirement401k: false,
        retirement401kPercent: 0,
        lifeInsurance: false,
        dentalInsurance: false,
        vacationDays: 0,
        sickDays: 0,
        personalDays: 0,
    };
}
