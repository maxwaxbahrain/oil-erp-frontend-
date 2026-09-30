import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EmployeePortal from '../EmployeePortal';
import * as commission from '../../../services/commissionService';
import * as company from '../../../services/companyService';
import * as employeesApi from '../../../services/employeeService';
import * as leave from '../../../services/leaveService';
import * as payroll from '../../../services/payrollService';
import type { ApiEmployee } from '../../../services/employeeService';
import type { PayrollProfile } from '../../../services/payrollService';

const authState = {
  role: 'admin' as 'admin' | 'manager',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: authState.role, full_name: 'Test User', role: authState.role },
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    logout: () => undefined,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../store/authStore', () => ({
  getCurrentUser: () => ({ id: 'user-admin', name: 'Test User' }),
}));

function employee(partial: Partial<ApiEmployee> & Pick<ApiEmployee, 'id' | 'fullName'>): ApiEmployee {
  return {
    employeeNumber: `E-${partial.id}`,
    employmentStatus: 'active',
    jobTitle: 'Salesman',
    department: 'Sales',
    userId: null,
    ...partial,
  };
}

const salaried: PayrollProfile = {
  id: 7,
  employeeId: 1,
  payType: 'salaried',
  monthlySalary: 5000,
  allowances: [
    { type: 'housing', label: 'Housing Allowance', amount: 200 },
    { type: 'transport', label: 'Transport Allowance', amount: 100 },
  ],
};

const hourly: PayrollProfile = {
  id: 8,
  employeeId: 2,
  payType: 'hourly',
  hourlyRate: 25,
  allowances: [],
};

describe('EmployeePortal pay summary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    authState.role = 'admin';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(employeesApi, 'getEmployees').mockResolvedValue([]);
    vi.spyOn(employeesApi, 'getSalesmen').mockResolvedValue([]);
    vi.spyOn(leave, 'getAllLeaveRequests').mockResolvedValue([]);
    vi.spyOn(leave, 'getLeaveBalanceSummary').mockResolvedValue([]);
    vi.spyOn(leave, 'getLeaveRequests').mockResolvedValue([]);
    vi.spyOn(company, 'getAnnouncements').mockResolvedValue([]);
    vi.spyOn(company, 'getHolidays').mockResolvedValue([]);
    vi.spyOn(commission, 'getCommissionRules').mockResolvedValue([]);
    vi.spyOn(commission, 'getCommissionSummary').mockResolvedValue([]);
    vi.spyOn(commission, 'getCommissionRecords').mockResolvedValue([]);
    vi.spyOn(payroll, 'getPayrollProfiles').mockResolvedValue([]);
    vi.spyOn(payroll, 'listPayrollRuns').mockResolvedValue([]);
    vi.spyOn(payroll, 'getPayslips').mockResolvedValue([]);
    vi.spyOn(payroll, 'getPayrollProfile').mockRejectedValue(new Error('no profile'));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderPortal() {
    await act(async () => {
      root.render(<EmployeePortal />);
    });
    await act(async () => {});
    await act(async () => {});
  }

  function teamRow(name: string): HTMLTableRowElement {
    const row = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent?.includes(name));
    if (!row) throw new Error(`row not found: ${name}`);
    return row as HTMLTableRowElement;
  }

  function estNet(name: string): string {
    return teamRow(name).querySelectorAll('td')[2]?.textContent?.trim() ?? '';
  }

  it('shows salaried, hourly, and missing pay summaries on the team table', async () => {
    vi.mocked(employeesApi.getEmployees).mockResolvedValue([
      employee({ id: 1, fullName: 'Ada' }),
      employee({ id: 2, fullName: 'Bob', jobTitle: 'Office' }),
      employee({ id: 3, fullName: 'Cara', jobTitle: 'Warehouse' }),
    ]);
    vi.mocked(payroll.getPayrollProfiles).mockResolvedValue([salaried, hourly]);
    await renderPortal();
    await act(async () => {});
    expect(payroll.getPayrollProfiles).toHaveBeenCalledTimes(1);
    expect(estNet('Ada')).toBe('$5,000/mo + $300 allowances');
    expect(estNet('Bob')).toBe('$25/hr');
    expect(estNet('Cara')).toBe('Not set');
    expect(container.textContent).toContain('salaried + allowances');
    expect(container.textContent).toContain('$5.3k');
  });

  it('does not load pay profiles or show the pay button for a manager', async () => {
    authState.role = 'manager';
    vi.mocked(employeesApi.getEmployees).mockResolvedValue([
      employee({ id: 1, fullName: 'PETER' }),
    ]);
    await renderPortal();
    expect(estNet('PETER')).toBe('—');
    expect(payroll.getPayrollProfiles).not.toHaveBeenCalled();
    expect(container.textContent).toContain('salary + overtime');
    const edit = Array.from(teamRow('PETER').querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Edit'),
    );
    expect(edit).toBeTruthy();
    await act(async () => {
      edit!.click();
    });
    expect(container.textContent).not.toContain('Pay profile & allowances');
    const netPay = Array.from(container.querySelectorAll('label')).find((label) =>
      label.textContent?.includes('Net Pay Est.'),
    );
    expect(netPay?.querySelector('input, textarea, select')).toBeNull();
    expect(netPay?.textContent).toContain('—');
  });

  it('opens the pay-profile editor from the edit modal and does not use an editable net-pay input', async () => {
    vi.mocked(employeesApi.getEmployees).mockResolvedValue([
      employee({ id: 1, fullName: 'PETER' }),
    ]);
    vi.mocked(payroll.getPayrollProfiles).mockResolvedValue([salaried]);
    await renderPortal();
    const edit = Array.from(teamRow('PETER').querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Edit'),
    );
    await act(async () => {
      edit!.click();
    });
    const netPay = Array.from(container.querySelectorAll('label')).find((label) =>
      label.textContent?.includes('Net Pay Est.'),
    );
    expect(netPay?.querySelector('input, textarea, select')).toBeNull();
    expect(netPay?.textContent).toContain('$5,000/mo + $300 allowances');
    const openPay = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.trim() === 'Pay profile & allowances',
    );
    expect(openPay).toBeTruthy();
    await act(async () => {
      openPay!.click();
    });
    await act(async () => {});
    expect(container.textContent).not.toContain('Edit Employee — PETER');
    expect(container.textContent).toContain('ALLOWANCES');
    expect(container.querySelector('select[aria-label="Allowance type"]')).toBeTruthy();
    const payBlock = Array.from(container.querySelectorAll('div')).find((node) =>
      node.textContent?.includes('PETER')
      && node.querySelector('select[aria-label="Allowance type"]'),
    );
    expect(payBlock?.textContent).toContain('PETER');
  });
});
