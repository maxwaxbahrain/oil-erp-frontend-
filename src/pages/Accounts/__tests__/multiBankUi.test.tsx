import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaidFromBankPicker } from '../ExpenseManagement';
import { expensePaymentAccountIdForSave, pdcCreateBody, pdcListUrl } from '../../../utils/bankingAccounts';
import type { BankingAccount } from '../../../services/glService';

const { getBankingAccounts, authFetch, getPayments, getArSummary, getCustomers, getGLAccounts } = vi.hoisted(() => ({
  getBankingAccounts: vi.fn(),
  authFetch: vi.fn(),
  getPayments: vi.fn(async () => []),
  getArSummary: vi.fn(async () => null),
  getCustomers: vi.fn(async () => []),
  getGLAccounts: vi.fn(async () => []),
}));

vi.mock('../../../services/glService', () => ({
  getBankingAccounts,
  getGLAccounts,
  createBankingAccount: vi.fn(),
  renameBankingAccount: vi.fn(),
}));

vi.mock('../../../api/axios', () => ({
  authFetch,
  ACCESS_TOKEN_KEY: 'token',
}));

vi.mock('../../../services/api', () => ({
  getPayments,
  voidPayment: vi.fn(),
}));

vi.mock('../../../services/customerService', () => ({
  getArSummary,
  getCustomers,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasRole: () => true }),
}));

import Banking from '../Banking';
import { saveExpense } from '../../../services/expenseService';

const mainBank: BankingAccount = {
  id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_active: true, is_default: true, balance: 20,
};
const operating: BankingAccount = {
  id: 2, code: '1011', name: 'Operating', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 30,
};

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

describe('expense paid-from bank', () => {
  it('hides the picker for cash and shows it for a bank transfer', () => {
    const hidden = mount(
      <PaidFromBankPicker method="Cash" banks={[mainBank]} value="" onChange={() => undefined} posted={false} />,
    );
    expect(hidden.host.querySelector('select')).toBeNull();
    hidden.cleanup();

    const shown = mount(
      <PaidFromBankPicker method="Bank Transfer" banks={[mainBank, operating]} value="1" onChange={() => undefined} posted={false} />,
    );
    expect(shown.host.querySelector('select')).not.toBeNull();
    expect(shown.host.textContent).toContain('1011');
    shown.cleanup();
  });

  it('renders nothing for a bank transfer when no banks loaded, and the select when one bank is present', () => {
    const empty = mount(
      <PaidFromBankPicker method="Bank Transfer" banks={[]} value="" onChange={() => undefined} posted={false} />,
    );
    expect(empty.host.querySelector('select')).toBeNull();
    expect(empty.host.textContent).toBe('');
    empty.cleanup();

    const one = mount(
      <PaidFromBankPicker method="Bank Transfer" banks={[mainBank]} value="1" onChange={() => undefined} posted={false} />,
    );
    expect(one.host.querySelector('select')).not.toBeNull();
    expect(one.host.textContent).toContain('1010');
    one.cleanup();
  });

  it('disables the picker after posting', () => {
    const view = mount(
      <PaidFromBankPicker method="Bank Transfer" banks={[mainBank]} value="1" onChange={() => undefined} posted />,
    );
    expect(view.host.querySelector('select')?.disabled).toBe(true);
    expect(view.host.textContent).toContain('Bank is locked after posting');
    view.cleanup();
  });

  it('includes paymentAccountId on the expense payload', async () => {
    expect(expensePaymentAccountIdForSave('Bank Transfer', '15', false)).toBe(15);
    expect(expensePaymentAccountIdForSave('Cash', '15', false)).toBeUndefined();
    expect(expensePaymentAccountIdForSave('Bank Transfer', '15', true)).toBeUndefined();
    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 9, amount: 12, category: 'Fuel', date: '2026-09-30', payment_method: 'Bank Transfer' }),
    });
    await saveExpense({
      category: 'Fuel',
      amount: 12,
      date: '2026-09-30',
      vendor: 'Yard',
      paymentMethod: 'Bank Transfer',
      paymentAccountId: 15,
    });
    const body = JSON.parse(String(authFetch.mock.calls.at(-1)?.[1]?.body));
    expect(body.paymentAccountId).toBe(15);
  });
});

describe('cheque bank account', () => {
  it('sends bank_account_id and filters the list call', () => {
    const body = pdcCreateBody({
      date: '2026-09-30',
      chequeNo: '1044',
      bankName: 'Printed name',
      payee: 'Al Noor',
      amount: '110',
      type: 'Received',
      description: '',
      customerId: 4,
      bankAccountId: '1',
    });
    expect(body.bank_account_id).toBe(1);
    expect(body.bankName).toBe('Printed name');
    expect(pdcListUrl('http://localhost:8000/api/pdc', '1')).toBe('http://localhost:8000/api/pdc/?bank_account_id=1');
    expect(pdcListUrl('http://localhost:8000/api/pdc', '')).toBe('http://localhost:8000/api/pdc/');
  });
});

describe('Banking account cards', () => {
  beforeEach(() => {
    getBankingAccounts.mockResolvedValue([
      { id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', role: 'cash', is_active: true, is_default: false, balance: 10 },
      { id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_active: true, is_default: true, balance: 20 },
      { id: 2, code: '1011', name: 'Operating', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 30 },
    ]);
    authFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('/ledger')) {
        return { ok: true, json: async () => ({ rows: [], opening_balance: 0, closing_balance: 0 }) };
      }
      return { ok: true, json: async () => [] };
    });
  });

  it('renders one card per bank plus cash and totals the balances', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let root: Root;
    await act(async () => {
      root = createRoot(host);
      root.render(<Banking />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const cards = host.querySelectorAll('[data-testid="banking-account-card"]');
    expect(cards).toHaveLength(3);
    expect(host.textContent).toContain('1010');
    expect(host.textContent).toContain('1011');
    expect(host.textContent).toContain('1000');
    expect(host.textContent).toContain('Default');
    expect(host.querySelector('[data-testid="banking-net-cash"]')?.textContent).toContain('60.00');
    act(() => root.unmount());
    host.remove();
  });

  it('shows the free-text bank name when the cheque has no linked account, and the linked name when it does', async () => {
    authFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('/pdc')) {
        return {
          ok: true,
          json: async () => [
            {
              id: 'c1',
              date: '2026-10-02',
              chequeNo: '9001',
              bankName: 'Chase (slip)',
              bank_account_name: null,
              payee: 'Old payee',
              amount: 10,
              type: 'Issued',
              status: 'Pending',
              description: '',
              createdAt: '2026-09-30',
            },
            {
              id: 'c2',
              date: '2026-10-03',
              chequeNo: '9002',
              bankName: 'Ignored slip',
              bank_account_name: 'Bank 2',
              payee: 'New payee',
              amount: 20,
              type: 'Issued',
              status: 'Pending',
              description: '',
              createdAt: '2026-09-30',
            },
          ],
        };
      }
      if (String(url).includes('/ledger')) {
        return { ok: true, json: async () => ({ rows: [], opening_balance: 0, closing_balance: 0 }) };
      }
      return { ok: true, json: async () => [] };
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    let root: Root;
    await act(async () => {
      root = createRoot(host);
      root.render(<Banking />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    const tab = Array.from(host.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Post dated cheques'),
    );
    await act(async () => {
      tab?.click();
    });
    expect(host.textContent).toContain('Chase (slip)');
    expect(host.textContent).toContain('Bank 2');
    expect(host.textContent).not.toContain('Ignored slip');
    act(() => root.unmount());
    host.remove();
  });
});

describe('multi-bank source guard', () => {
  it('does not use window.confirm or window.prompt in the changed files', () => {
    const files = [
      'src/hooks/useBankingAccounts.ts',
      'src/utils/bankingAccounts.ts',
      'src/services/glService.ts',
      'src/services/expenseService.ts',
      'src/pages/Accounts/Banking.tsx',
      'src/pages/Accounts/ExpenseManagement.tsx',
      'src/pages/Customers/PaymentReceipt.tsx',
      'src/pages/Purchases/SupplierDetail.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/window\.confirm|window\.prompt|\bprompt\s*\(/);
    }
  });
});
