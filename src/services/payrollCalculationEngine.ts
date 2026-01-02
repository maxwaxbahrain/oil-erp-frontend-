import type { ComprehensiveEmployee } from './employeeService';

// ==========================================
// 🚀 ENTERPRISE PAYROLL CALCULATION ENGINE
// Modules 2 & 5: Salary Structure & Processing
// ==========================================

export interface PayrollInput {
    employee: ComprehensiveEmployee;
    daysWorked: number;
    totalWorkingDays: number;
    overtimeHours: number;
    salesAchieved: number;
    salesTarget: number;
    unpaidLeaveDays: number;
    oneTimeBonus: number;
    period: string; // e.g., "April 2025"
}

export interface TaxBreakdown {
    federalTax: number;
    stateTax: number;
    socialSecurity: number;
    medicare: number;
    totalTax: number;
}

export interface PayComponent {
    name: string;
    amount: number;
    type: 'Earning' | 'Deduction' | 'CompanyContribution';
    isTaxable?: boolean;
}

export interface CompletePayrollResult {
    employeeId: string;
    period: string;
    grossPay: number;
    netPay: number;
    totalDeductions: number;
    earnings: PayComponent[];
    deductions: PayComponent[];
    employerContributions: PayComponent[];
    taxes: TaxBreakdown;
    meta: {
        isProRata: boolean;
        currency: string;
        exchangeRateToUSD: number;
    };
}

// Helper: Calculate Percentage
const pct = (amount: number, percentage: number) => (amount * percentage) / 100;

// 1. 🕒 Pro-Rata Calculation Helper
const calculateProRataFactor = (daysWorked: number, totalDays: number): number => {
    if (daysWorked >= totalDays) return 1;
    return daysWorked / totalDays;
};

// 2. 📈 Tiered Commission Calculator (Module 10)
const calculateCommission = (achieved: number, target: number): number => {
    if (target === 0) return 0;
    const performancePct = (achieved / target) * 100;

    // Tiered Structure
    if (performancePct > 120) return pct(achieved, 7); // Tier 4
    if (performancePct > 100) return pct(achieved, 5); // Tier 3
    if (performancePct > 80) return pct(achieved, 3);  // Tier 2
    return pct(achieved, 2);                           // Tier 1
};

// 3. 🏛️ Progressive Tax Calculator (Module 6)
// Simplified US 2024 Tax Brackets for Single Filers (Example)
const calculateFederalTax = (taxableIncome: number, filingStatus: string): number => {
    // Annualized projection -> Calculate Tax -> De-annualize for monthly
    const annualIncome = taxableIncome * 12;
    let tax = 0;

    if (filingStatus === 'Single') {
        if (annualIncome > 578125) tax += (annualIncome - 578125) * 0.37 + 174238.25;
        else if (annualIncome > 231250) tax += (annualIncome - 231250) * 0.35 + 52832;
        else if (annualIncome > 100525) tax += (annualIncome - 100525) * 0.24 + 17400;
        else if (annualIncome > 44725) tax += (annualIncome - 44725) * 0.22 + 5147;
        else if (annualIncome > 11000) tax += (annualIncome - 11000) * 0.12 + 1100;
        else tax += annualIncome * 0.10;
    } else {
        // Mock simplification for other statuses - usually brackets are wider
        tax += annualIncome * 0.18; // Average effective rate fallback
    }

    return tax / 12; // Monthly withholding
};

// ==========================================
// 🧮 MAIN CALCULATION FUNCTION
// ==========================================
export const calculateComprehensivePayroll = (input: PayrollInput): CompletePayrollResult => {
    const { employee, daysWorked, totalWorkingDays, overtimeHours, salesAchieved, salesTarget, unpaidLeaveDays, oneTimeBonus } = input;
    const structure = employee.salaryStructure;
    const proRataFactor = calculateProRataFactor(daysWorked - unpaidLeaveDays, totalWorkingDays);

    const earnings: PayComponent[] = [];
    const deductions: PayComponent[] = [];
    const employerContributions: PayComponent[] = [];

    // --- A. EARNINGS (Fixed) ---
    // Apply pro-rata factor to fixed monthly allowances
    const addFixed = (name: string, amount: number) => {
        if (amount > 0) earnings.push({ name, amount: amount * proRataFactor, type: 'Earning', isTaxable: true });
    };

    addFixed('Basic Salary', structure.basicSalary);
    addFixed('Housing Allowance (HRA)', structure.housingAllowance);
    addFixed('Transport Allowance', structure.transportAllowance);
    addFixed('Medical Allowance', structure.medicalAllowance);
    addFixed('Special Allowance', structure.specialAllowance);
    addFixed('Remote Work Allowance', structure.remoteWorkAllowance);

    // --- B. EARNINGS (Variable) ---
    // Overtime
    const hourlyRate = (structure.basicSalary / 160); // Assuming 160 hours/month standard
    const overtimePay = overtimeHours * hourlyRate * structure.overtimeRate;
    if (overtimePay > 0) earnings.push({ name: 'Overtime Pay', amount: overtimePay, type: 'Earning', isTaxable: true });

    // Commission
    const commission = calculateCommission(salesAchieved, salesTarget);
    if (commission > 0) earnings.push({ name: 'Sales Commission', amount: commission, type: 'Earning', isTaxable: true });

    // Bonus
    if (oneTimeBonus > 0) earnings.push({ name: 'Performance Bonus', amount: oneTimeBonus, type: 'Earning', isTaxable: true });

    // Calculate Gross
    const grossPay = earnings.reduce((sum, item) => sum + item.amount, 0);

    // --- C. DEDUCTIONS (Pre-Tax) ---
    // 401k
    const contribution401k = pct(grossPay, structure.retirement401kPercent);
    if (contribution401k > 0) deductions.push({ name: '401(k) Contribution', amount: contribution401k, type: 'Deduction', isTaxable: false });

    // Health Insurance (Employee share)
    if (structure.healthInsurancePremium > 0) deductions.push({ name: 'Health Insurance', amount: structure.healthInsurancePremium, type: 'Deduction', isTaxable: false });

    // Taxable Income Calculation
    const preTaxDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
    const taxableIncome = grossPay - preTaxDeductions;

    // --- D. TAXES (Statutory) ---
    const federalTax = calculateFederalTax(taxableIncome, structure.filingStatus);
    deductions.push({ name: 'Federal Income Tax', amount: federalTax, type: 'Deduction' });

    const socialSecurity = Math.min(pct(grossPay, structure.socialSecurityPercent), 9932.40 / 12); // Capped annually (simplified)
    deductions.push({ name: 'Social Security', amount: socialSecurity, type: 'Deduction' });

    const medicare = pct(grossPay, structure.medicarePercent);
    deductions.push({ name: 'Medicare', amount: medicare, type: 'Deduction' });

    const stateTax = taxableIncome * 0.05; // Simplified 5% flat state tax for demo
    deductions.push({ name: 'State Tax', amount: stateTax, type: 'Deduction' });

    // --- E. POST-TAX DEDUCTIONS ---
    // Unpaid Leave (Calculated as deduction if not handled by pro-rata reducing gross)
    // Note: In this engine, we used proRataFactor on Gross, so we don't deduct again.
    // However, if we wanted to show it as a line item deduction instead:
    // const unpaidLeaveDeduction = (structure.basicSalary / totalWorkingDays) * unpaidLeaveDays;
    // We already handled this via pro-rata factor on earnings.

    // --- F. EMPLOYER CONTRIBUTIONS ---
    employerContributions.push({ name: 'Social Security Match', amount: socialSecurity, type: 'CompanyContribution' });
    employerContributions.push({ name: 'Medicare Match', amount: medicare, type: 'CompanyContribution' });
    employerContributions.push({ name: '401(k) Match', amount: pct(grossPay, 3), type: 'CompanyContribution' }); // Assuming 3% match

    // Final Calculations
    const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
    const netPay = grossPay - totalDeductions;

    return {
        employeeId: employee.basicInfo.id,
        period: input.period,
        grossPay,
        netPay,
        totalDeductions,
        earnings,
        deductions,
        employerContributions,
        taxes: {
            federalTax,
            stateTax,
            socialSecurity,
            medicare,
            totalTax: federalTax + stateTax + socialSecurity + medicare
        },
        meta: {
            isProRata: proRataFactor < 1,
            currency: employee.payrollConfig.currency,
            exchangeRateToUSD: 1 // Default
        }
    };
};

// ==========================================
// 🧪 SIMULATION / WHAT-IF ENGINE
// ==========================================
export const simulatePayrollScenario = (
    employee: ComprehensiveEmployee,
    changes: Partial<PayrollInput>
): { original: number, new: number, diff: number } => {

    // Default mock inputs
    const baseInput: PayrollInput = {
        employee,
        daysWorked: 22,
        totalWorkingDays: 22,
        overtimeHours: 0,
        salesAchieved: 0,
        salesTarget: 10000,
        unpaidLeaveDays: 0,
        oneTimeBonus: 0,
        period: 'Simulation'
    };

    const originalRun = calculateComprehensivePayroll(baseInput);
    const newRun = calculateComprehensivePayroll({ ...baseInput, ...changes });

    return {
        original: originalRun.netPay,
        new: newRun.netPay,
        diff: newRun.netPay - originalRun.netPay
    };
};
