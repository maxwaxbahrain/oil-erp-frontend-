import { createRoot, type Root } from 'react-dom/client';
import { act, type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BankFeedItem } from '../../../services/bankFeedsService';

const {
  listBankFeeds,
  createLinkToken,
  exchangePublicToken,
  setLinkAccount,
  refreshLink,
  reconnectItem,
  disconnectItem,
} = vi.hoisted(() => ({
  listBankFeeds: vi.fn(),
  createLinkToken: vi.fn(),
  exchangePublicToken: vi.fn(),
  setLinkAccount: vi.fn(),
  refreshLink: vi.fn(),
  reconnectItem: vi.fn(),
  disconnectItem: vi.fn(),
}));

vi.mock('react-plaid-link', () => ({
  usePlaidLink: () => ({ open: vi.fn(), ready: true }),
}));

vi.mock('../../../services/bankFeedsService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/bankFeedsService')>('../../../services/bankFeedsService');
  return {
    ...actual,
    listBankFeeds,
    createLinkToken,
    exchangePublicToken,
    setLinkAccount,
    refreshLink,
    reconnectItem,
    disconnectItem,
  };
});

import BankFeedsPanel from '../BankFeedsPanel';

const banks = [
  { id: 5, code: '1010', name: 'Main Bank', system_key: 'bank', role: 'bank' },
  { id: 9, code: '1011', name: 'Operating', system_key: null, role: 'bank' },
];

function feedError(status: number, detail: string): Error {
  return Object.assign(new Error(detail), { status, detail });
}

function item(overrides: Partial<BankFeedItem['links'][number]> = {}): BankFeedItem {
  return {
    id: 1,
    provider: 'plaid',
    item_id: 'item-1',
    institution_id: 'ins_1',
    institution_name: 'First National',
    status: 'active',
    error_code: null,
    consent_expires_at: null,
    links: [
      {
        id: 44,
        bank_item_id: 1,
        provider_account_id: 'acc_1',
        name: 'Checking',
        official_name: null,
        mask: '1234',
        subtype: 'checking',
        status: 'active',
        soltol_account_id: 5,
        balance_current: 100,
        balance_available: 80,
        balance_currency: 'USD',
        balance_as_of: '2026-10-10T12:00:00Z',
        balance_source: 'cached',
        soltol_account_code: '1010',
        soltol_account_name: 'Main Bank',
        book_balance: 87.5,
        difference: 12.5,
        ...overrides,
      },
    ],
  };
}

async function renderPanel(props: Partial<ComponentProps<typeof BankFeedsPanel>> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  let root: Root;
  await act(async () => {
    root = createRoot(host);
    root.render(
      <BankFeedsPanel
        accounts={banks}
        canManage
        canView
        {...props}
      />,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return {
    host,
    cleanup() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('BankFeedsPanel', () => {
  beforeEach(() => {
    listBankFeeds.mockReset();
    setLinkAccount.mockReset();
    refreshLink.mockReset();
    listBankFeeds.mockResolvedValue({ items: [item()] });
  });

  it('renders null when bank feeds are not enabled', async () => {
    listBankFeeds.mockRejectedValue(feedError(404, 'Bank feeds are not enabled'));
    const view = await renderPanel();
    expect(view.host.textContent).not.toContain('Connected banks');
    expect(view.host.querySelector('section')).toBeNull();
    view.cleanup();
  });

  it('renders null on a plain 404', async () => {
    listBankFeeds.mockRejectedValue(feedError(404, 'Not Found'));
    const view = await renderPanel();
    expect(view.host.textContent).not.toContain('Connected banks');
    expect(view.host.querySelector('section')).toBeNull();
    view.cleanup();
  });

  it('renders the institution, link row, and a red difference', async () => {
    const view = await renderPanel();
    expect(view.host.textContent).toContain('First National');
    expect(view.host.textContent).toContain('Checking');
    expect(view.host.textContent).toContain('…1234');
    const difference = Array.from(view.host.querySelectorAll('span')).find((node) => node.textContent === '$12.50');
    expect(difference).toBeTruthy();
    expect(difference?.getAttribute('style') ?? '').toMatch(/EF4444|239,\s*68,\s*68/i);
    view.cleanup();
  });

  it('hides Connect bank when the user cannot manage feeds', async () => {
    const view = await renderPanel({ canManage: false });
    expect(view.host.textContent).not.toContain('Connect bank');
    view.cleanup();
  });

  it('shows the live-refresh limit message', async () => {
    refreshLink.mockRejectedValue(feedError(409, 'LIVE_LIMIT'));
    const view = await renderPanel();
    const button = Array.from(view.host.querySelectorAll('button')).find((node) => node.textContent === 'Refresh now');
    expect(button).toBeTruthy();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.host.textContent).toContain('Daily live-refresh limit reached (3/day). Cached refresh is still available.');
    view.cleanup();
  });

  it('puts the selected SOLTOL account id', async () => {
    setLinkAccount.mockResolvedValue({});
    const view = await renderPanel();
    const select = view.host.querySelector('select');
    expect(select).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, '9');
      select?.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(setLinkAccount).toHaveBeenCalledWith(44, 9);
    view.cleanup();
  });

  it('keeps the previous SOLTOL account when the link is a duplicate', async () => {
    setLinkAccount.mockRejectedValue(feedError(409, 'DUPLICATE_LINK'));
    const view = await renderPanel();
    const select = view.host.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, '9');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.host.textContent).toContain('already linked');
    expect(select.value).toBe('5');
    view.cleanup();
  });
});
