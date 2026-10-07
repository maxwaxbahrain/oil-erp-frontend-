import { describe, expect, it } from 'vitest';

import {
  mapPayslipToPayrollResult,
  mapPortalEmployeeToPayrollPdfEmployee,
  type ApiPayslip,
} from '../payrollService';

function basePayslip(overrides: Partial<ApiPayslip> = {}): ApiPayslip {
  return {
    id: 1,
    payrollRunId: 1,
    employeeId: 10,
    regularHours: 0,
    overtimeHours: 0,
    basePay: 3000,
    overtimePay: 0,
    commissionPay: 0,
    allowancesTotal: 0,
    grossPay: 3000,
    deductionsTotal: 0,
    netPay: 3000,
    status: 'draft',
    deductions: [],
    allowances: [],
    ...overrides,
  };
}

describe('mapPayslipToPayrollResult allowances', () => {
  it('maps housing and fuel allowance lines into earnings and matches gross', () => {
    const payslip = basePayslip({
      basePay: 3000,
      allowancesTotal: 650.25,
      grossPay: 3650.25,
      netPay: 3650.25,
      allowances: [
        { type: 'housing', label: 'Housing Allowance', amount: 500 },
        { type: 'fuel', label: 'Fuel Allowance', amount: 150.25 },
      ],
    });
    const result = mapPayslipToPayrollResult(payslip);
    expect(result.earnings.map((e) => e.name)).toEqual([
      'Base Pay',
      'Housing Allowance',
      'Fuel Allowance',
    ]);
    expect(result.earnings.map((e) => e.amount)).toEqual([3000, 500, 150.25]);
    const sum = result.earnings.reduce((acc, row) => acc + row.amount, 0);
    expect(sum).toBeCloseTo(result.grossPay, 2);
    expect(sum).toBe(3650.25);
  });

  it('with no allowances, earnings match the pre-change shape', () => {
    const payslip = basePayslip({
      basePay: 3000,
      overtimePay: 60,
      commissionPay: 40,
      grossPay: 3100,
      netPay: 3100,
    });
    const result = mapPayslipToPayrollResult(payslip);
    expect(result.earnings).toEqual([
      { name: 'Base Pay', amount: 3000, type: 'Earning' },
      { name: 'Overtime Pay', amount: 60, type: 'Earning' },
      { name: 'Commission', amount: 40, type: 'Earning' },
    ]);
  });

  it('mapPortalEmployeeToPayrollPdfEmployee omits filingStatus for PDF header', () => {
    const employee = mapPortalEmployeeToPayrollPdfEmployee(
      {
        id: '1',
        name: 'Ada',
        employeeNumber: 'E-1',
        role: 'sales',
      },
      {
        id: 7,
        employeeId: 1,
        payType: 'salaried',
        monthlySalary: 3000,
        allowances: [],
      },
    );
    expect(employee.filingStatus).toBeUndefined();
    expect(employee.allowances).toBeUndefined();
  });

  it('sum of earnings equals grossPay when OT, commission and allowances are present', () => {
    const payslip = basePayslip({
      basePay: 200,
      overtimePay: 60,
      commissionPay: 40,
      allowancesTotal: 25.5,
      grossPay: 325.5,
      netPay: 325.5,
      allowances: [
        { type: 'housing', label: 'Housing Allowance', amount: 15 },
        { type: 'fuel', label: 'Fuel Allowance', amount: 10.5 },
      ],
    });
    const result = mapPayslipToPayrollResult(payslip);
    const sum = result.earnings.reduce((acc, row) => acc + row.amount, 0);
    expect(Math.round(sum * 100)).toBe(Math.round(result.grossPay * 100));
  });
});
