// Comprehensive Employee Management Service - Enterprise Grade

import { API_BASE_URL } from './api';
import { authFetch } from '../api/axios';

export interface EmployeeBasicInfo {
    id: string;
    employeeId: string; // Auto-generated unique ID
    fullLegalName: string;
    dateOfBirth: string;
    gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
    maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed';
    nationality: string;
    nationalId: string; // SSN, Tax ID, etc.
    passportNumber?: string;
}

export interface EmployeeContactInfo {
    personalEmail: string;
    workEmail: string;
    phoneNumber: string;
    emergencyContactName: string;
    emergencyContactRelationship: string;
    emergencyContactPhone: string;
    currentAddress: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    permanentAddress?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
}

export interface EmploymentDetails {
    employmentType: 'Full-time Permanent' | 'Part-time' | 'Contract' | 'Freelancer' | 'Intern' | 'Consultant';
    department: string;
    designation: string;
    roleLevel: string;
    costCenter: string;
    profitCenter?: string;
    directManager: string;
    workLocation: string;
    joiningDate: string;
    probationPeriod?: number; // in months
    confirmationDate?: string;
    exitDate?: string;
    employmentStatus: 'Active' | 'Inactive' | 'On Notice' | 'Terminated' | 'On Leave';
}

export interface PayrollConfiguration {
    payrollCycle: 'Weekly' | 'Bi-weekly' | 'Semi-monthly' | 'Monthly';
    salaryType: 'Hourly' | 'Daily' | 'Monthly' | 'Commission' | 'Piece-rate';
    currency: string;

    // Bank Details
    bankName: string;
    accountNumber: string;
    iban?: string;
    swiftCode?: string;
    branchCode?: string;
    accountType: 'Checking' | 'Savings';

    // Payment Method
    paymentMethod: 'Bank Transfer' | 'Payroll Card' | 'Digital Wallet' | 'Cash' | 'Cryptocurrency';
    digitalWalletId?: string; // PayPal, Venmo, etc.
}

export interface SalaryStructure {
    // Fixed Components
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    medicalAllowance: number;
    mealAllowance: number;
    educationAllowance: number;
    specialAllowance: number;
    shiftAllowance: number;
    hazardAllowance: number;
    remoteWorkAllowance: number;

    // Variable Components (rates/percentages)
    overtimeRate: number; // multiplier (1.5, 2.0, etc.)
    performanceBonusPercent: number;
    salesCommissionPercent: number;
    profitSharingPercent: number;

    // Deductions
    incomeTaxBracket: string;
    socialSecurityPercent: number;
    medicarePercent: number;
    pensionContributionPercent: number;
    healthInsurancePremium: number;
    lifeInsurancePremium: number;
    retirement401kPercent: number;

    // Tax Information
    filingStatus: 'Single' | 'Married' | 'Head of Household' | 'Married Filing Separately';
    allowances: number;
    additionalWithholding: number;
}

export interface LeaveBalances {
    paidTimeOff: number; // days
    sickLeave: number;
    casualLeave: number;
    maternityLeave?: number;
    paternityLeave?: number;
    parentalLeave?: number;
    bereavementLeave: number;
    sabbaticalLeave?: number;
    studyLeave?: number;
    compOff: number;
    unpaidLeave: number;
}

export interface EmployeeDocuments {
    resume?: string; // URL or base64
    offerLetter?: string;
    employmentContract?: string;
    idProof?: string;
    educationalCertificates?: string[];
    taxForms?: string[];
    bankAccountProof?: string;
    backgroundCheck?: string;
    nda?: string;
    nonCompete?: string;
}

export interface AIInsights {
    salaryBenchmark: {
        marketAverage: number;
        percentile: number; // 0-100
        recommendation: string;
    };
    attritionRisk: {
        score: number; // 0-100
        factors: string[];
        recommendations: string[];
    };
    promotionReadiness: {
        score: number; // 0-100
        timeline: string;
        gaps: string[];
    };
    productivityScore: number; // 0-100
    engagementScore: number; // 0-100
}

export interface ComprehensiveEmployee {
    basicInfo: EmployeeBasicInfo;
    contactInfo: EmployeeContactInfo;
    employmentDetails: EmploymentDetails;
    payrollConfig: PayrollConfiguration;
    salaryStructure: SalaryStructure;
    leaveBalances: LeaveBalances;
    documents: EmployeeDocuments;
    aiInsights?: AIInsights;

    // Metadata
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastModifiedBy: string;
}

// Storage keys
const COMPREHENSIVE_EMPLOYEES_KEY = 'zavi_comprehensive_employees';

// Initialize with sample data
const getInitialComprehensiveEmployees = (): ComprehensiveEmployee[] => {
    const stored = localStorage.getItem(COMPREHENSIVE_EMPLOYEES_KEY);
    if (stored) return JSON.parse(stored);

    const employees: ComprehensiveEmployee[] = [
        {
            basicInfo: {
                id: 'EMP001',
                employeeId: 'EMP001',
                fullLegalName: 'John Michael Smith',
                dateOfBirth: '1990-05-15',
                gender: 'Male',
                maritalStatus: 'Married',
                nationality: 'United States',
                nationalId: '123-45-6789',
                passportNumber: 'US1234567'
            },
            contactInfo: {
                personalEmail: 'john.smith@gmail.com',
                workEmail: 'john.smith@company.com',
                phoneNumber: '+1-555-0101',
                emergencyContactName: 'Jane Smith',
                emergencyContactRelationship: 'Spouse',
                emergencyContactPhone: '+1-555-0102',
                currentAddress: {
                    street: '123 Main Street',
                    city: 'New York',
                    state: 'NY',
                    zipCode: '10001',
                    country: 'USA'
                }
            },
            employmentDetails: {
                employmentType: 'Full-time Permanent',
                department: 'Sales',
                designation: 'Sales Manager',
                roleLevel: 'Manager',
                costCenter: 'CC-SALES-001',
                directManager: 'Sarah Johnson (CEO)',
                workLocation: 'New York Office',
                joiningDate: '2020-01-15',
                probationPeriod: 3,
                confirmationDate: '2020-04-15',
                employmentStatus: 'Active'
            },
            payrollConfig: {
                payrollCycle: 'Monthly',
                salaryType: 'Monthly',
                currency: 'USD',
                bankName: 'Chase Bank',
                accountNumber: '****1234',
                iban: 'US12CHASE0000001234',
                swiftCode: 'CHASUS33',
                branchCode: '021000021',
                accountType: 'Checking',
                paymentMethod: 'Bank Transfer'
            },
            salaryStructure: {
                basicSalary: 3000,
                housingAllowance: 600,
                transportAllowance: 200,
                medicalAllowance: 100,
                mealAllowance: 100,
                educationAllowance: 0,
                specialAllowance: 0,
                shiftAllowance: 0,
                hazardAllowance: 0,
                remoteWorkAllowance: 100,
                overtimeRate: 1.5,
                performanceBonusPercent: 10,
                salesCommissionPercent: 5,
                profitSharingPercent: 2,
                incomeTaxBracket: '22%',
                socialSecurityPercent: 6.2,
                medicarePercent: 1.45,
                pensionContributionPercent: 5,
                healthInsurancePremium: 200,
                lifeInsurancePremium: 50,
                retirement401kPercent: 5,
                filingStatus: 'Married',
                allowances: 2,
                additionalWithholding: 0
            },
            leaveBalances: {
                paidTimeOff: 15,
                sickLeave: 10,
                casualLeave: 7,
                bereavementLeave: 5,
                compOff: 2,
                unpaidLeave: 0
            },
            documents: {},
            aiInsights: {
                salaryBenchmark: {
                    marketAverage: 4500,
                    percentile: 65,
                    recommendation: 'Employee is paid 11% below market average. Consider 15% increase to retain talent.'
                },
                attritionRisk: {
                    score: 35,
                    factors: ['Stable performance', 'Good compensation', 'Long tenure'],
                    recommendations: ['Continue current engagement', 'Offer growth opportunities']
                },
                promotionReadiness: {
                    score: 75,
                    timeline: 'Ready within 6 months',
                    gaps: ['Leadership training needed', 'Cross-functional experience']
                },
                productivityScore: 85,
                engagementScore: 78
            },
            createdAt: '2020-01-15T09:00:00Z',
            updatedAt: '2025-01-15T10:30:00Z',
            createdBy: 'HR Admin',
            lastModifiedBy: 'HR Admin'
        }
    ];

    localStorage.setItem(COMPREHENSIVE_EMPLOYEES_KEY, JSON.stringify(employees));
    return employees;
};

// CRUD Operations
export async function getComprehensiveEmployees(): Promise<ComprehensiveEmployee[]> {
    return new Promise((resolve) => {
        setTimeout(() => resolve(getInitialComprehensiveEmployees()), 100);
    });
}

export async function getComprehensiveEmployeeById(id: string): Promise<ComprehensiveEmployee | null> {
    return new Promise((resolve) => {
        const employees = getInitialComprehensiveEmployees();
        const employee = employees.find(e => e.basicInfo.id === id);
        setTimeout(() => resolve(employee || null), 100);
    });
}

export async function saveComprehensiveEmployee(employee: Partial<ComprehensiveEmployee>): Promise<ComprehensiveEmployee> {
    return new Promise((resolve) => {
        const employees = getInitialComprehensiveEmployees();
        const now = new Date().toISOString();

        if (employee.basicInfo?.id) {
            // Update existing
            const index = employees.findIndex(e => e.basicInfo.id === employee.basicInfo!.id);
            if (index !== -1) {
                employees[index] = {
                    ...employees[index],
                    ...employee,
                    updatedAt: now
                } as ComprehensiveEmployee;
                localStorage.setItem(COMPREHENSIVE_EMPLOYEES_KEY, JSON.stringify(employees));
                setTimeout(() => resolve(employees[index]), 100);
                return;
            }
        }

        // Create new
        const newEmployee: ComprehensiveEmployee = {
            ...employee,
            basicInfo: {
                ...employee.basicInfo!,
                id: `EMP${String(employees.length + 1).padStart(3, '0')}`,
                employeeId: `EMP${String(employees.length + 1).padStart(3, '0')}`
            },
            createdAt: now,
            updatedAt: now,
            createdBy: 'Current User',
            lastModifiedBy: 'Current User'
        } as ComprehensiveEmployee;

        employees.push(newEmployee);
        localStorage.setItem(COMPREHENSIVE_EMPLOYEES_KEY, JSON.stringify(employees));
        setTimeout(() => resolve(newEmployee), 100);
    });
}

// AI-Powered Analytics
export async function calculateSalaryBenchmark(_employeeId: string): Promise<AIInsights['salaryBenchmark']> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulated AI calculation
            resolve({
                marketAverage: 4500,
                percentile: 65,
                recommendation: 'Employee is paid 11% below market average. Consider 15% increase to retain talent.'
            });
        }, 1000);
    });
}

export async function calculateAttritionRisk(_employeeId: string): Promise<AIInsights['attritionRisk']> {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulated AI analysis
            const riskScore = Math.random() * 100;
            resolve({
                score: Math.round(riskScore),
                factors: riskScore > 70
                    ? ['No salary increase in 2 years', 'Peer promoted', 'High market demand']
                    : ['Stable performance', 'Good compensation', 'Long tenure'],
                recommendations: riskScore > 70
                    ? ['Immediate salary review', 'Promotion consideration', 'Retention bonus']
                    : ['Continue current engagement', 'Offer growth opportunities']
            });
        }, 1000);
    });
}

export async function calculatePromotionReadiness(_employeeId: string): Promise<AIInsights['promotionReadiness']> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const score = Math.round(Math.random() * 100);
            resolve({
                score,
                timeline: score > 75 ? 'Ready now' : score > 50 ? 'Ready within 6 months' : 'Needs 12+ months',
                gaps: score < 75
                    ? ['Leadership training needed', 'Cross-functional experience', 'Strategic thinking development']
                    : []
            });
        }, 1000);
    });
}

// ── Phase 1: tenant-scoped HR employees API ─────────────────────

export interface ApiEmployee {
    id: number;
    tenantId?: number | null;
    userId?: number | null;
    employeeNumber: string;
    fullName: string;
    department?: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    workEmail?: string | null;
    hireDate?: string | null;
    employmentStatus: string;
    employeeRole?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

/** Dropdown option for invoice/quotation salesman picker (FK → employees.id). */
export interface SalesmanPickerOption {
    id: string;
    name: string;
}

export interface EmployeeCreateInput {
    userId?: number | null;
    employeeNumber: string;
    fullName: string;
    department?: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    workEmail?: string | null;
    hireDate?: string | null;
    employmentStatus?: string;
}

export interface EmployeeUpdateInput {
    userId?: number | null;
    employeeNumber?: string;
    fullName?: string;
    department?: string | null;
    jobTitle?: string | null;
    phone?: string | null;
    workEmail?: string | null;
    hireDate?: string | null;
    employmentStatus?: string;
}

function fromApiEmployee(raw: Record<string, unknown>): ApiEmployee {
    return {
        id: Number(raw.id),
        tenantId: raw.tenantId != null ? Number(raw.tenantId) : raw.tenant_id != null ? Number(raw.tenant_id) : null,
        userId: raw.userId != null ? Number(raw.userId) : raw.user_id != null ? Number(raw.user_id) : null,
        employeeNumber: String(raw.employeeNumber ?? raw.employee_number ?? ''),
        fullName: String(raw.fullName ?? raw.full_name ?? ''),
        department: raw.department != null ? String(raw.department) : null,
        jobTitle: raw.jobTitle != null ? String(raw.jobTitle) : raw.job_title != null ? String(raw.job_title) : null,
        phone: raw.phone != null ? String(raw.phone) : null,
        workEmail: raw.workEmail != null ? String(raw.workEmail) : raw.work_email != null ? String(raw.work_email) : null,
        hireDate: raw.hireDate != null
            ? String(raw.hireDate).slice(0, 10)
            : raw.hire_date != null
              ? String(raw.hire_date).slice(0, 10)
              : null,
        employmentStatus: String(raw.employmentStatus ?? raw.employment_status ?? 'active'),
        employeeRole:
            raw.employeeRole != null
                ? String(raw.employeeRole)
                : raw.employee_role != null
                  ? String(raw.employee_role)
                  : null,
        createdAt: raw.createdAt != null ? String(raw.createdAt) : raw.created_at != null ? String(raw.created_at) : null,
        updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : raw.updated_at != null ? String(raw.updated_at) : null,
    };
}

async function readApiError(r: Response): Promise<string> {
    try {
        const body = await r.json();
        if (typeof body?.detail === 'string') return body.detail;
        if (body?.detail) return JSON.stringify(body.detail);
    } catch {
        /* ignore */
    }
    return `Request failed (${r.status})`;
}

export async function getEmployees(): Promise<ApiEmployee[]> {
    const r = await authFetch(`${API_BASE_URL}/employees/`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => fromApiEmployee(row as Record<string, unknown>));
}

/** Tenant-scoped employees with HR role salesman — for invoice/quotation picker. */
export async function getSalesmen(): Promise<SalesmanPickerOption[]> {
    const r = await authFetch(`${API_BASE_URL}/employees/?role=salesman`);
    if (!r.ok) throw new Error(await readApiError(r));
    const rows = await r.json();
    return (Array.isArray(rows) ? rows : []).map((row) => {
        const emp = fromApiEmployee(row as Record<string, unknown>);
        return { id: String(emp.id), name: emp.fullName };
    });
}

export interface EmployeeSalesSummaryInvoice {
    id: number;
    invoiceNumber: string;
    date: string;
    customerId: number;
    customerName: string;
    amount: number;
    paidStatus: string;
}

export interface EmployeeSalesSummary {
    employeeId: number;
    from: string;
    to: string;
    invoiceCount: number;
    totalInvoicedAmount: number;
    invoices: EmployeeSalesSummaryInvoice[];
}

function fromApiSalesSummaryInvoice(raw: Record<string, unknown>): EmployeeSalesSummaryInvoice {
    return {
        id: Number(raw.id),
        invoiceNumber: String(raw.invoiceNumber ?? raw.invoice_number ?? ''),
        date: String(raw.date ?? ''),
        customerId: Number(raw.customerId ?? raw.customer_id ?? 0),
        customerName: String(raw.customerName ?? raw.customer_name ?? ''),
        amount: Number(raw.amount ?? 0),
        paidStatus: String(raw.paidStatus ?? raw.paid_status ?? 'unpaid'),
    };
}

/** Invoices attributed to this employee as salesman (commission / sales history). */
export async function getEmployeeSalesSummary(
    employeeId: number | string,
    from: string,
    to: string,
): Promise<EmployeeSalesSummary> {
    const qs = new URLSearchParams({ from, to });
    const r = await authFetch(
        `${API_BASE_URL}/employees/${encodeURIComponent(String(employeeId))}/sales-summary?${qs}`,
    );
    if (!r.ok) throw new Error(await readApiError(r));
    const raw = (await r.json()) as Record<string, unknown>;
    const invoicesRaw = raw.invoices;
    return {
        employeeId: Number(raw.employeeId ?? raw.employee_id ?? employeeId),
        from: String(raw.from ?? from),
        to: String(raw.to ?? to),
        invoiceCount: Number(raw.invoiceCount ?? raw.invoice_count ?? 0),
        totalInvoicedAmount: Number(raw.totalInvoicedAmount ?? raw.total_invoiced_amount ?? 0),
        invoices: (Array.isArray(invoicesRaw) ? invoicesRaw : []).map((row) =>
            fromApiSalesSummaryInvoice(row as Record<string, unknown>),
        ),
    };
}

export async function addEmployee(payload: EmployeeCreateInput): Promise<ApiEmployee> {
    const r = await authFetch(`${API_BASE_URL}/employees/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            employeeNumber: payload.employeeNumber,
            fullName: payload.fullName,
            department: payload.department ?? null,
            jobTitle: payload.jobTitle ?? null,
            phone: payload.phone ?? null,
            workEmail: payload.workEmail ?? null,
            hireDate: payload.hireDate ?? null,
            employmentStatus: payload.employmentStatus ?? 'active',
            ...(payload.userId != null ? { userId: payload.userId } : {}),
        }),
    });
    if (!r.ok) throw new Error(await readApiError(r));
    return fromApiEmployee((await r.json()) as Record<string, unknown>);
}

export async function updateEmployee(id: number | string, payload: EmployeeUpdateInput): Promise<ApiEmployee> {
    const body: Record<string, unknown> = {};
    if (payload.userId !== undefined) body.userId = payload.userId;
    if (payload.employeeNumber !== undefined) body.employeeNumber = payload.employeeNumber;
    if (payload.fullName !== undefined) body.fullName = payload.fullName;
    if (payload.department !== undefined) body.department = payload.department;
    if (payload.jobTitle !== undefined) body.jobTitle = payload.jobTitle;
    if (payload.phone !== undefined) body.phone = payload.phone;
    if (payload.workEmail !== undefined) body.workEmail = payload.workEmail;
    if (payload.hireDate !== undefined) body.hireDate = payload.hireDate;
    if (payload.employmentStatus !== undefined) body.employmentStatus = payload.employmentStatus;

    const r = await authFetch(`${API_BASE_URL}/employees/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await readApiError(r));
    return fromApiEmployee((await r.json()) as Record<string, unknown>);
}

export async function deleteEmployee(id: number | string): Promise<ApiEmployee> {
    const r = await authFetch(`${API_BASE_URL}/employees/${encodeURIComponent(String(id))}`, {
        method: 'DELETE',
    });
    if (!r.ok) throw new Error(await readApiError(r));
    return fromApiEmployee((await r.json()) as Record<string, unknown>);
}
