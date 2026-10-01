import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getBankingAccounts, getCollectionsBankSettings, patchCollectionsBankSettings, authFetch, getPayments, getArSummary, getCustomers, getGLAccounts } = vi.hoisted(() => ({
  getBankingAccounts: vi.fn(),
  getCollectionsBankSettings: vi.fn(),
  patchCollectionsBankSettings: vi.fn(),
  authFetch: vi.fn(),
  getPayments: vi.fn(async () => []),
  getArSummary: vi.fn(async () => null),
  getCustomers: vi.fn(async () => []),
  getGLAccounts: vi.fn(async () => []),
}));

vi.mock('../../../services/glService', () => ({
  getBankingAccounts,
  getCollectionsBankSettings,
  patchCollectionsBankSettings,
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

const accounts = [
  { id: 3, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand', role: 'cash', is_active: true, is_default: false, balance: 10 },
  { id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: 'bank', role: 'bank', is_active: true, is_default: true, balance: 20 },
  { id: 2, code: '1011', name: 'Operating', type: 'asset', system_key: null, role: 'bank', is_active: false, is_default: false, balance: 30 },
];

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function mountBanking() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  await act(async () => {
    root = createRoot(host);
    root.render(<Banking />);
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

describe('Banking collections panel', () => {
  beforeEach(() => {
    getBankingAccounts.mockReset();
    getCollectionsBankSettings.mockReset();
    patchCollectionsBankSettings.mockReset();
    getBankingAccounts.mockResolvedValue(accounts);
    authFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('/ledger')) {
        return { ok: true, json: async () => ({ rows: [], opening_balance: 0, closing_balance: 0 }) };
      }
      return { ok: true, json: async () => [] };
    });
  });

  it('renders the current bank from GET and Save calls PATCH with the chosen id', async () => {
    getCollectionsBankSettings.mockResolvedValue({
      collections_bank_account_id: 2,
      bank: { id: 2, code: '1011', name: 'Operating' },
    });
    patchCollectionsBankSettings.mockResolvedValue({
      collections_bank_account_id: 1,
      bank: { id: 1, code: '1010', name: 'Main Bank' },
    });
    const view = await mountBanking();
    const select = view.host.querySelector('[data-testid="collections-bank-select"]') as HTMLSelectElement;
    expect(select.value).toBe('2');
    expect(select.selectedOptions[0]?.textContent).toContain('Operating');
    expect(view.host.textContent).toContain('Non-cash collections recorded from the driver/sales app are deposited to:');
    expect(Array.from(select.options).some((option) => option.textContent === 'Bank (default)')).toBe(true);
    expect(Array.from(select.options).some((option) => option.textContent === 'Use default bank')).toBe(true);

    await act(async () => {
      setSelectValue(select, '1');
    });
    const save = Array.from(view.host.querySelectorAll('button')).find((button) => button.textContent === 'Save');
    await act(async () => {
      save?.click();
      await Promise.resolve();
    });
    expect(patchCollectionsBankSettings).toHaveBeenCalledWith(1);
    view.cleanup();
  });

  it('Use default bank calls PATCH with null', async () => {
    getCollectionsBankSettings.mockResolvedValue({
      collections_bank_account_id: 2,
      bank: { id: 2, code: '1011', name: 'Operating' },
    });
    patchCollectionsBankSettings.mockResolvedValue({
      collections_bank_account_id: null,
      bank: null,
    });
    const view = await mountBanking();
    const select = view.host.querySelector('[data-testid="collections-bank-select"]') as HTMLSelectElement;
    await act(async () => {
      setSelectValue(select, '');
    });
    const save = Array.from(view.host.querySelectorAll('button')).find((button) => button.textContent === 'Save');
    await act(async () => {
      save?.click();
      await Promise.resolve();
    });
    expect(patchCollectionsBankSettings).toHaveBeenCalledWith(null);
    view.cleanup();
  });

  it('shows error text when PATCH fails with 422', async () => {
    getCollectionsBankSettings.mockResolvedValue({
      collections_bank_account_id: null,
      bank: null,
    });
    patchCollectionsBankSettings.mockRejectedValue(new Error('Not a tenant bank account'));
    const view = await mountBanking();
    const save = Array.from(view.host.querySelectorAll('button')).find((button) => button.textContent === 'Save');
    await act(async () => {
      save?.click();
      await Promise.resolve();
    });
    expect(view.host.querySelector('[data-testid="collections-bank-error"]')?.textContent).toBe('Not a tenant bank account');
    view.cleanup();
  });
});
