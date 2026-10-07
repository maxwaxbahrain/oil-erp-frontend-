import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PayrollAdmin from '../PayrollAdmin';
import ProfileAllowancesEditor from '../ProfileAllowancesEditor';
import * as payroll from '../../../services/payrollService';
import type { AllowanceLine } from '../../../services/payrollService';

const housing: AllowanceLine = { type: 'housing', label: 'Housing Allowance', amount: 500 };

describe('ProfileAllowancesEditor', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(payroll, 'putProfileAllowances').mockResolvedValue([housing]);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function text(): string {
    return container.textContent ?? '';
  }

  async function renderEditor(lines: AllowanceLine[] = [housing]) {
    await act(async () => {
      root.render(
        <ProfileAllowancesEditor profileId={7} initialLines={lines} onSaved={() => undefined} />,
      );
    });
  }

  function inputs(label: string): HTMLInputElement[] {
    return Array.from(container.querySelectorAll(`input[aria-label="${label}"]`));
  }

  function selects(): HTMLSelectElement[] {
    return Array.from(container.querySelectorAll('select[aria-label="Allowance type"]'));
  }

  function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label);
    if (!button) throw new Error(`button not found: ${label}`);
    button.click();
  }

  it('renders the initial lines from the profile', async () => {
    await renderEditor();
    expect(selects()[0].value).toBe('housing');
    expect(text()).toContain('Housing');
    expect(inputs('Allowance label')[0].value).toBe('Housing Allowance');
    expect(inputs('Allowance amount')[0].value).toBe('500');
  });

  it('adds a fuel row and PUTs the full list', async () => {
    await renderEditor();
    await act(async () => {
      clickButton('Add allowance');
    });
    const typeSelects = selects();
    const amounts = inputs('Allowance amount');
    await act(async () => {
      setValue(typeSelects[1], 'fuel');
      setValue(amounts[1], '150.25');
    });
    await act(async () => {
      clickButton('Save allowances');
    });
    expect(payroll.putProfileAllowances).toHaveBeenCalledWith(7, [
      housing,
      { type: 'fuel', label: 'Fuel Allowance', amount: 150.25 },
    ]);
  });

  it('blocks Other with an empty label and does not PUT', async () => {
    await renderEditor([{ type: 'other', label: '', amount: 25 }]);
    await act(async () => {
      clickButton('Save allowances');
    });
    expect(text()).toContain('Label is required for Other');
    expect(payroll.putProfileAllowances).not.toHaveBeenCalled();
  });

  it('blocks an amount with more than 2 decimal places and does not PUT', async () => {
    await renderEditor();
    await act(async () => {
      setValue(inputs('Allowance amount')[0], '10.005');
    });
    await act(async () => {
      clickButton('Save allowances');
    });
    expect(text()).toContain('Amount must have at most 2 decimal places');
    expect(payroll.putProfileAllowances).not.toHaveBeenCalled();
  });

  it('blocks a duplicate type and label and does not PUT', async () => {
    await renderEditor([housing, { type: 'housing', label: 'Housing Allowance', amount: 10 }]);
    await act(async () => {
      clickButton('Save allowances');
    });
    expect(text()).toContain('Duplicate allowance type and label');
    expect(payroll.putProfileAllowances).not.toHaveBeenCalled();
  });

  it('shows a 422 detail and stays editable', async () => {
    vi.mocked(payroll.putProfileAllowances).mockRejectedValue(
      new Error('duplicate allowance type and label'),
    );
    await renderEditor();
    await act(async () => {
      clickButton('Save allowances');
    });
    expect(text()).toContain('duplicate allowance type and label');
    const amount = inputs('Allowance amount')[0];
    expect(amount.disabled).toBe(false);
    await act(async () => {
      setValue(amount, '12');
    });
    expect(amount.value).toBe('12');
  });
});

describe('PayrollAdmin allowances gate', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(payroll, 'getPayrollProfiles').mockResolvedValue([]);
    vi.spyOn(payroll, 'listPayrollRuns').mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('shows the save-profile note instead of the editor when there is no profileId', async () => {
    await act(async () => {
      root.render(
        <PayrollAdmin
          employees={[{ id: '1', name: 'Ada', employeeNumber: 'E-1', role: 'sales' }]}
          onToast={() => undefined}
          onError={() => undefined}
        />,
      );
    });
    await act(async () => {});
    const setProfile = Array.from(container.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Set profile'),
    );
    expect(setProfile).toBeTruthy();
    await act(async () => {
      setProfile!.click();
    });
    expect(container.textContent).toContain('Save the pay profile first to add allowances');
    expect(container.querySelector('select[aria-label="Allowance type"]')).toBeNull();
  });

  function setInputValue(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === label);
    if (!button) throw new Error(`button not found: ${label}`);
    button.click();
  }

  it('keeps the form open and shows the allowances editor after creating a profile', async () => {
    const onToast = vi.fn();
    vi.spyOn(payroll, 'createPayrollProfile').mockResolvedValue({
      id: 42,
      employeeId: 1,
      payType: 'salaried',
      monthlySalary: 5000,
      allowances: [],
    });
    vi.spyOn(payroll, 'putProfileAllowances').mockResolvedValue([]);
    await act(async () => {
      root.render(
        <PayrollAdmin
          employees={[{ id: '1', name: 'Ada', employeeNumber: 'E-1', role: 'sales' }]}
          onToast={onToast}
          onError={() => undefined}
        />,
      );
    });
    await act(async () => {});
    await act(async () => {
      clickButton('Set profile');
    });
    const salary = container.querySelector('input[type="number"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(salary, '5000');
    });
    await act(async () => {
      clickButton('Save profile');
    });
    await act(async () => {});
    expect(onToast).toHaveBeenCalledWith('Profile saved — you can now add allowances');
    expect(container.textContent).toContain('ALLOWANCES');
    expect(container.textContent).toContain('Save allowances');
    expect(container.textContent).not.toContain('Save the pay profile first to add allowances');
    expect(Array.from(container.querySelectorAll('button')).some((node) => node.textContent?.trim() === 'Cancel')).toBe(true);
    await act(async () => {
      clickButton('Save allowances');
    });
    expect(payroll.putProfileAllowances).toHaveBeenCalledWith(42, []);
  });

  it('closes the form after saving an existing profile', async () => {
    const onToast = vi.fn();
    const existing = {
      id: 9,
      employeeId: 1,
      payType: 'salaried',
      monthlySalary: 4000,
      allowances: [],
    };
    vi.mocked(payroll.getPayrollProfiles).mockResolvedValue([existing]);
    vi.spyOn(payroll, 'updatePayrollProfile').mockResolvedValue(existing);
    await act(async () => {
      root.render(
        <PayrollAdmin
          employees={[{ id: '1', name: 'Ada', employeeNumber: 'E-1', role: 'sales' }]}
          onToast={onToast}
          onError={() => undefined}
        />,
      );
    });
    await act(async () => {});
    await act(async () => {
      clickButton('Edit');
    });
    expect(container.textContent).toContain('ALLOWANCES');
    await act(async () => {
      clickButton('Save profile');
    });
    await act(async () => {});
    expect(onToast).toHaveBeenCalledWith('Pay profile updated');
    expect(payroll.updatePayrollProfile).toHaveBeenCalled();
    expect(container.textContent).not.toContain('ALLOWANCES');
    expect(container.querySelector('select[aria-label="Allowance type"]')).toBeNull();
    expect(Array.from(container.querySelectorAll('button')).some((node) => node.textContent?.trim() === 'Edit')).toBe(true);
    expect(Array.from(container.querySelectorAll('button')).some((node) => node.textContent?.trim() === 'Cancel')).toBe(false);
  });
});
