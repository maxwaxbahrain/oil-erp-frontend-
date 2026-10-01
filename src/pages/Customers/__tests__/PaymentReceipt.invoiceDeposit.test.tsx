import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function invoice(id: string, number: string, depositId: number): Invoice {
  return {
    id,
    invoiceNumber: number,
    customerId: '7',
    customerName: 'Acme',
    invoiceDate: '2026-09-01',
    dueDate: '2026-10-01',
    lineItems: [],
    subtotal: 80,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 80,
    notes: '',
    status: 'Unpaid',
    remaining_balance: 80,
    deposit_account_id: depositId,
    deposit_account_name: depositId === 2 ? 'Bank 2' : 'Bank 3',
    createdAt: '2026-09-01',
  };
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
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

function invoiceBox(host: HTMLElement, number: string) {
  const label = Array.from(host.querySelectorAll('label')).find((node) => node.textContent?.includes(number));
  return label?.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

describe('PaymentReceipt invoice deposit', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getUnpaidInvoices').mockResolvedValue([
      invoice('10', 'INV-A', 2),
      invoice('11', 'INV-B', 4),
    ]);
    vi.spyOn(api, 'getCustomerAdvanceBalance').mockResolvedValue(0);
  });

  it('keeps Cash on Hand when a deposited invoice is ticked under Cash', async () => {
    const view = await mount();
    expect(depositSelect(view.host).value).toBe('3');
    await act(async () => {
      invoiceBox(view.host, 'INV-A').click();
    });
    expect(depositSelect(view.host).value).toBe('3');
    view.cleanup();
  });

  it('switches the picker to the invoice bank under Bank Transfer', async () => {
    const view = await mount();
    await act(async () => {
      setSelectValue(methodSelect(view.host), 'Bank Transfer');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(depositSelect(view.host).value).toBe('1');
    await act(async () => {
      invoiceBox(view.host, 'INV-A').click();
    });
    expect(depositSelect(view.host).value).toBe('2');
    view.cleanup();
  });

  it('leaves the picker unchanged when ticked invoices disagree', async () => {
    const view = await mount();
    await act(async () => {
      setSelectValue(methodSelect(view.host), 'Bank Transfer');
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(depositSelect(view.host).value).toBe('1');
    await act(async () => {
      invoiceBox(view.host, 'INV-A').click();
    });
    expect(depositSelect(view.host).value).toBe('2');
    await act(async () => {
      invoiceBox(view.host, 'INV-B').click();
    });
    expect(depositSelect(view.host).value).toBe('2');
    view.cleanup();
  });
});
