import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SupplierDetail from '../SupplierDetail';

const bankAccount = {
  id: 21,
  code: '1010',
  name: 'Main Bank',
  type: 'asset',
  system_key: 'bank',
  role: 'bank' as const,
  is_active: true,
  is_default: true,
  balance: 0,
};

const cashAccount = {
  id: 20,
  code: '1000',
  name: 'Cash on Hand',
  type: 'asset',
  system_key: 'cash_on_hand',
  role: 'cash' as const,
  is_active: true,
  is_default: false,
  balance: 0,
};

vi.mock('../../../hooks/useCompanyPaymentAccounts', () => ({
  useCompanyPaymentAccounts: () => ({
    accounts: [bankAccount, cashAccount],
    cash: [cashAccount],
    banks: [bankAccount],
    defaultBank: bankAccount,
    loading: false,
    error: null,
  }),
}));

vi.mock('../../../services/api', () => ({
  getSupplierLedger: vi.fn(async () => ({
    opening_balance: 0,
    closing_balance: 0,
    rows: [],
  })),
}));

vi.mock('../../../api/axios', () => ({
  authFetch: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (init?.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'pay-1', ...body }),
        text: async () => '',
      };
    }
    if (url.endsWith('/balance')) {
      return { ok: true, status: 200, json: async () => ({ balance: 0 }), text: async () => '' };
    }
    if (url.endsWith('/purchases') || url.endsWith('/payments')) {
      return { ok: true, status: 200, json: async () => [], text: async () => '' };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: 9,
        name: 'Acme Supply',
        status: 'Active',
        payment_terms: 'Net 30',
        currency: 'USD',
      }),
      text: async () => '',
    };
  }),
}));

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Send Fund Disbursement defaults', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('syncs bank 1010 to Bank Transfer and cash 1000 to Cash, and posts the selected account_id', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/suppliers/9?tab=payments']}>
          <Routes>
            <Route path="/suppliers/:id" element={<SupplierDetail />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    const open = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Send payment'),
    );
    expect(open).toBeTruthy();
    await act(async () => {
      open?.click();
    });
    await flush();

    const card = container.querySelector('[data-disbursement-modal]');
    const footer = container.querySelector('[data-disbursement-footer]');
    expect(card).toBeTruthy();
    expect(card?.contains(footer)).toBe(true);
    expect(footer?.textContent).toContain('Abort');
    expect(footer?.textContent).toContain('Execute Payment');

    const payFrom = container.querySelector('select[aria-label="Pay From Account"]') as HTMLSelectElement;
    const channel = container.querySelector('select[aria-label="Transfer Channel"]') as HTMLSelectElement;
    expect(payFrom.value).toBe(String(bankAccount.id));
    expect(payFrom.selectedOptions[0]?.textContent).toContain('1010');
    expect(channel.value).toBe('Bank Transfer');
    expect(channel.selectedOptions[0]?.textContent).toBe('Bank Wire (SWIFT)');

    await act(async () => {
      setValue(payFrom, String(cashAccount.id));
    });
    await flush();

    expect(payFrom.value).toBe(String(cashAccount.id));
    expect(payFrom.selectedOptions[0]?.textContent).toContain('1000');
    expect(channel.value).toBe('Cash');
    expect(channel.selectedOptions[0]?.textContent).toBe('Cash / Petty Cash');

    const amount = container.querySelector('input[aria-label="Disbursement Amount"]') as HTMLInputElement;
    await act(async () => {
      setValue(amount, '25');
    });
    const execute = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Execute Payment'),
    );
    await act(async () => {
      execute?.click();
    });
    await flush();

    const { authFetch } = await import('../../../api/axios');
    const post = vi.mocked(authFetch).mock.calls.find((call) => call[1]?.method === 'POST');
    expect(post).toBeTruthy();
    const payload = JSON.parse(String(post?.[1]?.body));
    expect(payload.account_id).toBe(cashAccount.id);
    expect(payload.pay_from_account_id).toBe(cashAccount.id);
    expect(payload.paymentMethod).toBe('Cash');
    expect(payload.account_id).not.toBe(Number(cashAccount.code));
  });
});