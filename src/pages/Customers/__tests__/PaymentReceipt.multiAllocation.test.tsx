import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice } from '../../../services/api';
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
  const bank3 = {
    id: 4, code: '1012', name: 'Bank 3', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 40,
  };
  return { cash: [cashAccount], banks: [mainBank, bank2, bank3], defaultBank: mainBank };
});

vi.mock('../../../hooks/useBankingAccounts', () => ({
  useBankingAccounts: () => ({
    cash,
    banks,
    defaultBank,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

function invoice(id: string, number: string, balance: number): Invoice {
  return {
    id,
    invoiceNumber: number,
    customerId: '7',
    customerName: 'Acme',
    invoiceDate: '2026-09-01',
    dueDate: '2026-10-01',
    lineItems: [],
    subtotal: balance,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: balance,
    notes: '',
    status: 'Unpaid',
    remaining_balance: balance,
    createdAt: '2026-09-01',
  };
}

function setValue(element: HTMLInputElement, value: string) {
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

function invoiceBox(host: HTMLElement, number: string) {
  const label = Array.from(host.querySelectorAll('label')).find((node) => node.textContent?.includes(number));
  return label?.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

function applyInput(host: HTMLElement, number: string) {
  return host.querySelector(`[aria-label="Apply to ${number}"]`) as HTMLInputElement;
}

function paymentAmountInput(host: HTMLElement) {
  const label = Array.from(host.querySelectorAll('label')).find((node) => node.textContent?.includes('Payment Amount'));
  return label?.parentElement?.querySelector('input[type="number"]') as HTMLInputElement;
}

function recordButton(host: HTMLElement) {
  return Array.from(host.querySelectorAll('button')).find((node) =>
    node.textContent?.includes('Record Payment'),
  ) as HTMLButtonElement;
}

async function tick(host: HTMLElement, number: string) {
  await act(async () => {
    invoiceBox(host, number).click();
  });
}

async function submit(host: HTMLElement) {
  await act(async () => {
    recordButton(host).click();
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function allocationsOf(spy: { mock: { calls: unknown[][] } }) {
  const payload = spy.mock.calls[0][0] as {
    amount: number;
    allocations: Array<{ invoice_id: number | null; amount: number }>;
  };
  return {
    amount: payload.amount,
    allocations: [...payload.allocations].sort((a, b) => Number(a.invoice_id) - Number(b.invoice_id)),
  };
}

describe('PaymentReceipt multi allocation', () => {
  let createPayment: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(api, 'getUnpaidInvoices').mockResolvedValue([
      invoice('1', 'INV-1', 300),
      invoice('2', 'INV-2', 200),
      invoice('3', 'INV-3', 100),
    ]);
    vi.spyOn(api, 'getCustomerAdvanceBalance').mockResolvedValue(0);
    vi.spyOn(api, 'getCustomerUnappliedAdvances').mockResolvedValue([]);
    createPayment = vi.spyOn(api, 'createPayment').mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('multi-invoice: typed Apply amounts are sent as allocations', async () => {
    const view = await mount();
    try {
      await tick(view.host, 'INV-1');
      await tick(view.host, 'INV-2');
      const apply1 = applyInput(view.host, 'INV-1');
      await act(async () => {
        apply1.click();
      });
      expect(invoiceBox(view.host, 'INV-1').checked).toBe(true);
      expect(invoiceBox(view.host, 'INV-2').checked).toBe(true);
      await act(async () => {
        setValue(apply1, '150');
      });
      expect(['350', '350.00']).toContain(paymentAmountInput(view.host).value);
      await submit(view.host);
      expect(createPayment).toHaveBeenCalledTimes(1);
      expect(allocationsOf(createPayment)).toEqual({
        amount: 350,
        allocations: [
          { invoice_id: 1, amount: 150 },
          { invoice_id: 2, amount: 200 },
        ],
      });
    } finally {
      view.cleanup();
    }
  });

  it('multi-invoice: over-allocation is blocked inline', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => false);
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => null);
    const view = await mount();
    try {
      await tick(view.host, 'INV-1');
      await tick(view.host, 'INV-2');
      await act(async () => {
        setValue(applyInput(view.host, 'INV-2'), '250');
      });
      await submit(view.host);
      expect(createPayment).not.toHaveBeenCalled();
      expect(view.host.textContent).toContain(
        'One or more Apply amounts exceed the invoice balance or are negative. Fix them before saving.',
      );
      expect(alertSpy).not.toHaveBeenCalled();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(promptSpy).not.toHaveBeenCalled();
    } finally {
      view.cleanup();
    }
  });

  it('multi-invoice: zero Apply rows are skipped', async () => {
    const view = await mount();
    try {
      await tick(view.host, 'INV-1');
      await tick(view.host, 'INV-2');
      await tick(view.host, 'INV-3');
      await act(async () => {
        setValue(applyInput(view.host, 'INV-3'), '0');
      });
      await submit(view.host);
      expect(createPayment).toHaveBeenCalledTimes(1);
      expect(allocationsOf(createPayment)).toEqual({
        amount: 500,
        allocations: [
          { invoice_id: 1, amount: 300 },
          { invoice_id: 2, amount: 200 },
        ],
      });
    } finally {
      view.cleanup();
    }
  });

  it('no invoices: the payment amount is saved as an unapplied advance', async () => {
    vi.spyOn(api, 'getUnpaidInvoices').mockResolvedValue([]);
    const view = await mount();
    try {
      await act(async () => {
        setValue(paymentAmountInput(view.host), '75');
      });
      await submit(view.host);
      expect(createPayment).toHaveBeenCalledTimes(1);
      const payload = createPayment.mock.calls[0][0] as {
        amount: number;
        explicit_advance?: boolean;
        allocations: Array<{ invoice_id: number | null; amount: number }>;
      };
      expect(payload.amount).toBe(75);
      expect(payload.explicit_advance).toBe(true);
      expect(payload.allocations).toEqual([{ invoice_id: null, amount: 75 }]);
      expect(view.host.textContent).not.toContain('Opening Balance Amount');
      expect(view.host.textContent).not.toContain('Select Invoice(s) *');
    } finally {
      view.cleanup();
    }
  });

  it('an amount above one invoice keeps the extra as an advance', async () => {
    const view = await mount();
    try {
      await tick(view.host, 'INV-1');
      await act(async () => {
        setValue(paymentAmountInput(view.host), '350');
      });
      await submit(view.host);
      expect(allocationsOf(createPayment)).toEqual({
        amount: 350,
        allocations: [
          { invoice_id: null, amount: 50 },
          { invoice_id: 1, amount: 300 },
        ],
      });
    } finally {
      view.cleanup();
    }
  });

  it('single-invoice partial still works', async () => {
    const view = await mount();
    try {
      await tick(view.host, 'INV-1');
      expect(applyInput(view.host, 'INV-1')).toBeNull();
      const amountInput = paymentAmountInput(view.host);
      expect(amountInput.readOnly).toBe(false);
      await act(async () => {
        setValue(amountInput, '120');
      });
      await submit(view.host);
      expect(createPayment).toHaveBeenCalledTimes(1);
      expect(allocationsOf(createPayment)).toEqual({
        amount: 120,
        allocations: [{ invoice_id: 1, amount: 120 }],
      });
    } finally {
      view.cleanup();
    }
  });
});
