import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { createCustomer, updateCustomer } = vi.hoisted(() => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

vi.mock('../../../services/customerService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/customerService')>(
    '../../../services/customerService',
  );
  return {
    ...actual,
    createCustomer,
    updateCustomer,
  };
});

vi.mock('../../../utils/localDate', () => ({
  localIsoDate: () => '2026-10-26',
}));

import CustomerForm from '../CustomerForm';
import type { Customer } from '../../../services/customerService';

function mount(node: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  act(() => {
    root = createRoot(host);
    root.render(node);
  });
  return {
    host,
    cleanup() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(el) as { constructor: { prototype: object } };
  const setter =
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set ??
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set ??
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set ??
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderForm(overrides: Partial<React.ComponentProps<typeof CustomerForm>> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const view = mount(
    <CustomerForm editingCustomer={null} onSave={onSave} onCancel={onCancel} {...overrides} />,
  );
  return { ...view, onSave, onCancel };
}

describe('CustomerForm redesign', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    createCustomer.mockReset();
    updateCustomer.mockReset();
    createCustomer.mockResolvedValue({ id: '1', name: 'Acme' });
    updateCustomer.mockResolvedValue({ id: '9', name: 'Acme' });
  });

  it('hides the Tell Zava slot for PR B', () => {
    const { host, cleanup } = renderForm();
    const slot = host.querySelector('[data-testid="customer-form-zava-slot"]') as HTMLElement;
    expect(slot).toBeTruthy();
    expect(slot.hidden || slot.getAttribute('aria-hidden') === 'true').toBe(true);
    cleanup();
  });

  it('requires customer name and does not call the API', async () => {
    const { host, cleanup, onSave } = renderForm();
    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });
    expect(createCustomer).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="customer-form-error"]')?.textContent).toContain(
      'Customer Name is required',
    );
    cleanup();
  });

  it('creates with debit opening_side and absolute amount (Dr mapping unchanged)', async () => {
    const { host, cleanup, onSave } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Surjeet A1');
    setValue(host.querySelector('[data-testid="customer-email"]') as HTMLInputElement, 'a@b.com');
    setValue(host.querySelector('[data-testid="customer-phone"]') as HTMLInputElement, '7185550177');
    setValue(host.querySelector('[data-testid="customer-address"]') as HTMLInputElement, '37th Ave');
    setValue(host.querySelector('[data-testid="customer-category"]') as HTMLSelectElement, 'wholesale');
    setValue(host.querySelector('[data-testid="customer-credit-limit"]') as HTMLInputElement, '3000');
    setValue(host.querySelector('[data-testid="customer-opening-amount"]') as HTMLInputElement, '150.5');
    setValue(host.querySelector('[data-testid="customer-notes"]') as HTMLTextAreaElement, 'Remember this');

    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });

    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(createCustomer.mock.calls[0][0]).toMatchObject({
      name: 'Surjeet A1',
      email: 'a@b.com',
      phone: '7185550177',
      address: '37th Ave',
      category: 'wholesale',
      credit_limit: 3000,
      opening_balance: 150.5,
      opening_side: 'debit',
      opening_as_of: '2026-10-26',
      notes: 'Remember this',
    });
    expect(onSave).toHaveBeenCalled();
    cleanup();
  });

  it('sends opening_side credit when Credit (Cr) is selected', async () => {
    const { host, cleanup } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Credit Co');
    setValue(host.querySelector('[data-testid="customer-opening-amount"]') as HTMLInputElement, '40');
    await act(async () => {
      (host.querySelector('[data-testid="opening-side-credit"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });
    expect(createCustomer.mock.calls[0][0]).toMatchObject({
      opening_balance: 40,
      opening_side: 'credit',
      opening_as_of: '2026-10-26',
    });
    cleanup();
  });

  it('omits opening_as_of when opening amount is zero', async () => {
    const { host, cleanup } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Zero Co');
    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });
    const payload = createCustomer.mock.calls[0][0];
    expect(payload.opening_balance).toBe(0);
    expect(payload.opening_as_of).toBeUndefined();
    cleanup();
  });

  it('edit omits opening fields and calls updateCustomer', async () => {
    const editing: Customer = {
      id: '42',
      name: 'Old Name',
      email: 'old@x.com',
      phone: '111',
      address: 'A',
      category: 'retail',
      credit_limit: 100,
      opening_balance: 55,
      notes: 'n',
    };
    const { host, cleanup, onSave } = renderForm({ editingCustomer: editing });
    expect(host.textContent).toContain('Edit customer');
    expect(host.querySelector('[data-testid="customer-opening-readonly"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="opening-side-debit"]')).toBeNull();

    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'New Name');
    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });

    expect(createCustomer).not.toHaveBeenCalled();
    expect(updateCustomer).toHaveBeenCalledTimes(1);
    expect(updateCustomer.mock.calls[0][0]).toBe('42');
    const payload = updateCustomer.mock.calls[0][1];
    expect(payload.name).toBe('New Name');
    expect(payload).not.toHaveProperty('opening_balance');
    expect(payload).not.toHaveProperty('opening_side');
    expect(payload).not.toHaveProperty('opening_as_of');
    expect(onSave).toHaveBeenCalled();
    cleanup();
  });

  it('keeps typed values and shows the backend error message', async () => {
    createCustomer.mockRejectedValueOnce(new Error('Customer name already exists'));
    const { host, cleanup, onSave } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Dup Co');
    setValue(host.querySelector('[data-testid="customer-phone"]') as HTMLInputElement, '999');
    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });
    expect(onSave).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="customer-form-error"]')?.textContent).toContain(
      'Customer name already exists',
    );
    expect((host.querySelector('[data-testid="customer-name"]') as HTMLInputElement).value).toBe('Dup Co');
    expect((host.querySelector('[data-testid="customer-phone"]') as HTMLInputElement).value).toBe('999');
    cleanup();
  });

  it('surfaces axios-style detail via the User Management error helper', async () => {
    createCustomer.mockRejectedValueOnce({
      message: 'Request failed with status code 400',
      response: { data: { detail: 'Phone already registered' } },
    });
    const { host, cleanup } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'X');
    await act(async () => {
      (host.querySelector('[data-testid="customer-save"]') as HTMLButtonElement).click();
    });
    expect(host.querySelector('[data-testid="customer-form-error"]')?.textContent).toContain(
      'Phone already registered',
    );
    cleanup();
  });

  it('Esc on empty form closes immediately', () => {
    const { host, cleanup, onCancel } = renderForm();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-testid="customer-discard-dialog"]')).toBeNull();
    cleanup();
  });

  it('Esc with unsaved typing asks Discard / Keep editing', () => {
    const { host, cleanup, onCancel } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Draft Co');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="customer-discard-dialog"]')?.textContent).toContain(
      'Discard this customer?',
    );

    act(() => {
      (host.querySelector('[data-testid="customer-discard-keep"]') as HTMLButtonElement).click();
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="customer-discard-dialog"]')).toBeNull();
    expect((host.querySelector('[data-testid="customer-name"]') as HTMLInputElement).value).toBe('Draft Co');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    act(() => {
      (host.querySelector('[data-testid="customer-discard-confirm"]') as HTMLButtonElement).click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('Ctrl+Enter saves', async () => {
    const { host, cleanup, onSave } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Hotkey Co');
    const form = host.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(createCustomer).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
    cleanup();
  });

  it('two quick Ctrl+Enter create the customer once', async () => {
    let resolveCreate!: (value: { id: string; name: string }) => void;
    createCustomer.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const { host, cleanup, onSave } = renderForm();
    setValue(host.querySelector('[data-testid="customer-name"]') as HTMLInputElement, 'Once Co');
    const form = host.querySelector('form')!;
    const ctrlEnter = () =>
      form.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }),
      );

    await act(async () => {
      ctrlEnter();
      ctrlEnter();
    });
    expect(createCustomer).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ id: '1', name: 'Once Co' });
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
