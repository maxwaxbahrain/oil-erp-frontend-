import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../../services/api';
import PaymentReceipt from '../PaymentReceipt';

const { cash, banks, defaultBank } = vi.hoisted(() => {
  const cashAccount = {
    id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', role: 'cash', is_active: true, is_default: false, balance: 10,
  };
  const mainBank = {
    id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_active: true, is_default: true, balance: 20,
  };
  const bank2 = {
    id: 2, code: '1011', name: 'Bank 2', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 30,
  };
  return { cash: [cashAccount], banks: [mainBank, bank2], defaultBank: mainBank };
});

vi.mock('../../../hooks/useCompanyPaymentAccounts', () => ({
  useCompanyPaymentAccounts: () => ({
    accounts: [...cash, ...banks],
    cash,
    banks,
    defaultBank,
    loading: false,
    error: null,
  }),
}));

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function setInputValue(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  await act(async () => {
    root = createRoot(host);
    root.render(<PaymentReceipt customer={{ id: '7', name: 'Acme' }} onBack={() => undefined} />);
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
  return {
    host,
    cleanup() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function depositSelect(host: HTMLElement) {
  return host.querySelector('[aria-label="Deposit To Account"]') as HTMLSelectElement;
}

function methodSelect(host: HTMLElement) {
  return Array.from(host.querySelectorAll('select')).find((select) =>
    Array.from(select.options).some((option) => option.value === 'Bank Transfer'),
  ) as HTMLSelectElement;
}

function recordButtons(host: HTMLElement) {
  return Array.from(host.querySelectorAll('button')).filter((button) =>
    (button.textContent ?? '').toLowerCase().includes('record payment'),
  ) as HTMLButtonElement[];
}

function paymentAmountInput(host: HTMLElement) {
  const label = Array.from(host.querySelectorAll('label')).find((node) => node.textContent?.includes('Payment Amount'));
  return label?.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
}

async function chooseMethod(host: HTMLElement, method: string) {
  await act(async () => {
    setSelectValue(methodSelect(host), method);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('PaymentReceipt explicit deposit account', () => {
  let createPayment: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(api, 'getUnpaidInvoices').mockResolvedValue([]);
    vi.spyOn(api, 'getCustomerUnappliedAdvances').mockResolvedValue([]);
    createPayment = vi.spyOn(api, 'createPayment').mockResolvedValue({});
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on Bank Transfer with an empty account and a disabled Save that does not post', async () => {
    const view = await mount();
    try {
      await chooseMethod(view.host, 'Bank Transfer');
      const select = depositSelect(view.host);
      expect(select.value).toBe('');
      expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
        'Choose bank account',
        '1010 — Main Bank',
        '1011 — Bank 2',
      ]);
      const buttons = recordButtons(view.host);
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => button.disabled)).toBe(true);
      expect(view.host.textContent).toContain('Choose the bank account this payment went into');
      await act(async () => {
        buttons[0].click();
        view.host.querySelector('#payment-form')?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      });
      expect(createPayment).not.toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();
    } finally {
      view.cleanup();
    }
  });

  it('enables Save after a bank is chosen and posts that deposit_account_id', async () => {
    const view = await mount();
    try {
      await chooseMethod(view.host, 'Bank Transfer');
      await act(async () => {
        setSelectValue(depositSelect(view.host), '2');
      });
      const buttons = recordButtons(view.host);
      expect(buttons.every((button) => button.disabled)).toBe(false);
      expect(view.host.textContent).not.toContain('Choose the bank account this payment went into');
      await act(async () => {
        setInputValue(paymentAmountInput(view.host), '80');
      });
      await act(async () => {
        buttons[0].click();
      });
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(createPayment).toHaveBeenCalledTimes(1);
      const payload = createPayment.mock.calls[0][0] as { deposit_account_id?: string };
      expect(payload.deposit_account_id).toBe('2');
    } finally {
      view.cleanup();
    }
  });

  it('keeps Cash locked to cash on hand and posts that cash deposit_account_id', async () => {
    const view = await mount();
    try {
      const select = depositSelect(view.host);
      expect(methodSelect(view.host).value).toBe('Cash');
      expect(select.disabled).toBe(true);
      expect(select.value).toBe('3');
      expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['1000 — Cash on Hand']);
      expect(view.host.textContent).not.toContain('Choose bank account');
      const buttons = recordButtons(view.host);
      expect(buttons.every((button) => button.disabled)).toBe(false);
      await act(async () => {
        setInputValue(paymentAmountInput(view.host), '40');
      });
      await act(async () => {
        buttons[0].click();
      });
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await Promise.resolve();
        });
      }
      expect(createPayment).toHaveBeenCalledTimes(1);
      const payload = createPayment.mock.calls[0][0] as { deposit_account_id?: string };
      expect(payload.deposit_account_id).toBe('3');
    } finally {
      view.cleanup();
    }
  });

  it('clears the chosen bank when switching Bank Transfer → Cash → Bank Transfer', async () => {
    const view = await mount();
    try {
      await chooseMethod(view.host, 'Bank Transfer');
      expect(depositSelect(view.host).value).toBe('');
      await act(async () => {
        setSelectValue(depositSelect(view.host), '2');
      });
      expect(depositSelect(view.host).value).toBe('2');
      await chooseMethod(view.host, 'Cash');
      expect(depositSelect(view.host).disabled).toBe(true);
      expect(depositSelect(view.host).value).toBe('3');
      await chooseMethod(view.host, 'Bank Transfer');
      expect(depositSelect(view.host).value).toBe('');
      expect(depositSelect(view.host).disabled).toBe(false);
      expect(recordButtons(view.host).every((button) => button.disabled)).toBe(true);
    } finally {
      view.cleanup();
    }
  });
});
