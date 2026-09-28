import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AllAccountsLedger from '../AllAccountsLedger';
import { monthStartISO } from '../../../services/glService';

const AR_ID = 17;

function localTodayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function account(partial: Record<string, unknown>) {
  return {
    parent_id: null,
    tenant_id: 4,
    created_at: null,
    updated_at: null,
    normal_balance: 'debit',
    is_active: true,
    ...partial,
  };
}

const accounts = [
  account({ id: 1, code: '1000', name: 'Cash on Hand', type: 'asset', system_key: 'cash_on_hand' }),
  account({ id: 2, code: '1010', name: 'Bank', type: 'asset', system_key: 'bank' }),
  account({ id: AR_ID, code: '1100', name: 'Accounts Receivable', type: 'asset', system_key: 'accounts_receivable' }),
  account({ id: 9, code: '1120', name: 'Bank accounts', type: 'asset', system_key: null, is_active: false }),
];

const ledger = {
  account: {
    id: AR_ID,
    code: '1100',
    name: 'Accounts Receivable',
    type: 'asset',
    normal_balance: 'debit',
    system_key: 'accounts_receivable',
  },
  start_date: monthStartISO(),
  end_date: localTodayISO(),
  opening_balance: 111.11,
  total_debit: 333.33,
  total_credit: 222.22,
  net_movement: 44.44,
  closing_balance: 555.55,
  all_time_balance: 999.99,
  rows: [
    {
      entry_id: 10,
      entry_number: 'JE-00010',
      entry_date: monthStartISO(),
      memo: 'Invoice sale',
      source_type: 'invoice',
      source_id: '501',
      status: 'posted',
      debit: 333.33,
      credit: 0,
      running_balance: 444.44,
      contra: [
        { account_id: 20, code: '4000', name: 'Sales Revenue', debit: 0, credit: 300 },
        { account_id: 21, code: '2100', name: 'Tax Payable', debit: 0, credit: 33.33 },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AllAccountsLedger', () => {
  let container: HTMLDivElement;
  let root: Root;
  let urls: string[];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    urls = [];
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  function stubFetch(ledgerStatus: number, ledgerBody: unknown) {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/gl/accounts/')) {
        return jsonResponse(ledgerBody, ledgerStatus);
      }
      if (url.includes('/accounts/')) {
        return jsonResponse(accounts);
      }
      return jsonResponse({ detail: 'not found' }, 404);
    }));
  }

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <AllAccountsLedger />
        </MemoryRouter>,
      );
    });
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  function text(): string {
    return container.textContent ?? '';
  }

  it('builds chips from the accounts response', async () => {
    stubFetch(200, ledger);
    await renderPage();

    expect(text()).toContain('1100 Accounts Receivable');
    expect(text()).not.toContain('Bank accounts');
    expect(text()).not.toContain('1120');
    expect(text()).toContain('1000 Cash on Hand');
    expect(text()).toContain('1010 Bank');
  });

  it('requests the numeric account ledger with the date window', async () => {
    stubFetch(200, ledger);
    await renderPage();

    const ledgerUrl = urls.find((url) => url.includes('/gl/accounts/'));
    expect(ledgerUrl).toBeTruthy();
    expect(ledgerUrl).toContain(`/api/gl/accounts/${AR_ID}/ledger`);
    expect(ledgerUrl).toContain(`start_date=${monthStartISO()}`);
    expect(ledgerUrl).toContain(`end_date=${localTodayISO()}`);
  });

  it('shows the error banner and no zero balance when the ledger request fails', async () => {
    stubFetch(500, { detail: 'Ledger unavailable' });
    await renderPage();

    expect(text()).toContain('Ledger unavailable');
    expect(text()).not.toContain('$0.00');
    expect(text()).not.toContain('OPENING BALANCE');
  });

  it('renders the five card values and the contra column', async () => {
    stubFetch(200, ledger);
    await renderPage();

    const body = text();
    expect(body).toContain('OPENING BALANCE');
    expect(body).toContain('$111.11');
    expect(body).toContain('TOTAL CREDITS');
    expect(body).toContain('$222.22');
    expect(body).toContain('TOTAL DEBITS');
    expect(body).toContain('$333.33');
    expect(body).toContain('NET MOVEMENT');
    expect(body).toContain('+$44.44');
    expect(body).toContain('CLOSING BALANCE');
    expect(body).toContain('$555.55');
    expect(body).toContain('4000 Sales Revenue · 2100 Tax Payable');
    expect(body).toContain('all-time');
    expect(body).toContain('$999.99');
  });
});
