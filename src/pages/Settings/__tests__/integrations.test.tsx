import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as integrationsApi from '../../../api/integrations';
import { QBO_ERROR_REASONS, type QuickBooksStatus } from '../../../api/integrations';
import Sidebar from '../../../components/layout/Sidebar';
import IntegrationsPage, { ImportResultTable } from '../IntegrationsPage';

const authState = {
  role: 'sales' as 'sales' | 'admin',
};

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: authState.role, full_name: 'Test User', role: authState.role },
    hasRole: (...roles: string[]) => roles.includes(authState.role),
    logout: () => undefined,
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('../../../api/integrations', async () => {
  const actual = await vi.importActual<typeof import('../../../api/integrations')>('../../../api/integrations');
  return {
    ...actual,
    listApiKeys: vi.fn().mockResolvedValue([]),
    listWebhooks: vi.fn().mockResolvedValue([]),
    listWebhookEventTypes: vi.fn().mockResolvedValue(['invoice.created']),
    createApiKey: vi.fn(),
    createWebhook: vi.fn(),
    getQuickBooksStatus: vi.fn(),
    startQuickBooksConnect: vi.fn(),
    disconnectQuickBooks: vi.fn(),
    getQuickBooksSettings: vi.fn().mockResolvedValue({
      income_account_ref: null,
      item_type: 'NonInventory',
      deposit_account_ref: null,
      tax_mode: 'none',
      auto_sync: false,
    }),
    putQuickBooksSettings: vi.fn(),
    listQuickBooksIncomeAccounts: vi.fn().mockResolvedValue([{ id: '79', name: 'Sales of Product Income' }]),
    listQuickBooksDepositAccounts: vi.fn().mockResolvedValue([{ id: '35', name: 'Undeposited Funds', type: 'Other Current Asset' }]),
    syncQuickBooks: vi.fn(),
    retryQuickBooksSync: vi.fn().mockResolvedValue({ entity_id: 1, qbo_id: '1', action: 'update', status: 'ok', error: null }),
    listQuickBooksSyncLog: vi.fn().mockResolvedValue([]),
  };
});

const locationAssign = vi.fn();

function disconnectedQuickBooks(overrides: Partial<QuickBooksStatus> = {}): QuickBooksStatus {
  return {
    provider: 'quickbooks',
    status: 'disconnected',
    realm_id: null,
    company_name: null,
    environment: 'sandbox',
    connected_at: null,
    access_expires_at: null,
    refresh_expires_at: null,
    last_error: null,
    configured: true,
    ...overrides,
  };
}

function stubLocationAssign(): () => void {
  const real = window.location;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'location');
  const fake = {
    assign: locationAssign,
    replace: (url: string | URL) => real.replace(url),
    reload: () => real.reload(),
    get href() { return real.href; },
    set href(value: string) { real.href = value; },
    get pathname() { return real.pathname; },
    get search() { return real.search; },
    get hash() { return real.hash; },
    get origin() { return real.origin; },
    get protocol() { return real.protocol; },
    get host() { return real.host; },
    get hostname() { return real.hostname; },
    get port() { return real.port; },
    toString: () => real.toString(),
  };
  Object.defineProperty(window, 'location', {
    configurable: true,
    enumerable: true,
    value: fake,
  });
  return () => {
    if (descriptor) Object.defineProperty(window, 'location', descriptor);
  };
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Integrations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let restoreLocation = () => {};

  beforeEach(() => {
    authState.role = 'sales';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(integrationsApi.listApiKeys).mockResolvedValue([]);
    vi.mocked(integrationsApi.listWebhooks).mockResolvedValue([]);
    vi.mocked(integrationsApi.listWebhookEventTypes).mockResolvedValue(['invoice.created']);
    vi.mocked(integrationsApi.getQuickBooksStatus).mockReset();
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(disconnectedQuickBooks());
    vi.mocked(integrationsApi.startQuickBooksConnect).mockReset();
    vi.mocked(integrationsApi.disconnectQuickBooks).mockReset();
    vi.mocked(integrationsApi.getQuickBooksSettings).mockReset();
    vi.mocked(integrationsApi.getQuickBooksSettings).mockResolvedValue({
      income_account_ref: null,
      item_type: 'NonInventory',
      deposit_account_ref: null,
      tax_mode: 'none',
      auto_sync: false,
    });
    vi.mocked(integrationsApi.putQuickBooksSettings).mockReset();
    vi.mocked(integrationsApi.listQuickBooksIncomeAccounts).mockReset();
    vi.mocked(integrationsApi.listQuickBooksIncomeAccounts).mockResolvedValue([
      { id: '79', name: 'Sales of Product Income' },
    ]);
    vi.mocked(integrationsApi.listQuickBooksDepositAccounts).mockReset();
    vi.mocked(integrationsApi.listQuickBooksDepositAccounts).mockResolvedValue([
      { id: '35', name: 'Undeposited Funds', type: 'Other Current Asset' },
    ]);
    vi.mocked(integrationsApi.syncQuickBooks).mockReset();
    vi.mocked(integrationsApi.retryQuickBooksSync).mockReset();
    vi.mocked(integrationsApi.retryQuickBooksSync).mockResolvedValue({
      entity_id: 1,
      qbo_id: '1',
      action: 'update',
      status: 'ok',
      error: null,
    });
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockReset();
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockResolvedValue([]);
    locationAssign.mockReset();
    restoreLocation = stubLocationAssign();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.getElementById('app-global-share-toast')?.remove();
    document.getElementById('integrations-error-toast')?.remove();
    window.history.pushState(null, '', '/');
    restoreLocation();
    vi.mocked(window.confirm).mockRestore();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <IntegrationsPage />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
  }

  it('omits webhooks:manage and blocks submit with zero scopes', async () => {
    await renderPage();
    const create = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create API key');
    await act(async () => {
      create?.click();
    });
    expect(container.textContent).not.toContain('webhooks:manage');
    const submit = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create');
    expect(submit).toBeInstanceOf(HTMLButtonElement);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the money-scope notice and clears the one-time key without storage writes', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.mocked(integrationsApi.createApiKey).mockResolvedValue({
      id: 1,
      name: 'Desk',
      prefix: 'sk_live_1_ab',
      scopes: ['invoices:write'],
      expires_at: null,
      raw_key: 'sk_live_secret_once',
    });
    await renderPage();
    const create = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create API key');
    await act(async () => {
      create?.click();
    });
    const name = container.querySelector('[aria-label="API key name"]') as HTMLInputElement;
    setValue(name, 'Desk');
    const money = Array.from(container.querySelectorAll('input[type="checkbox"]')).find((input) => input.parentElement?.textContent?.includes('invoices:write'));
    await act(async () => {
      (money as HTMLInputElement | undefined)?.click();
    });
    expect(container.textContent).toContain('Money writes require an Idempotency-Key header on every request.');
    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await act(async () => {});
    const secretInput = container.querySelector('[aria-label="Secret value"]') as HTMLInputElement;
    expect(secretInput.value).toBe('sk_live_secret_once');
    const close = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Close' && button.closest('[aria-label="API key"]'));
    await act(async () => {
      close?.click();
    });
    expect(container.querySelector('[aria-label="Secret value"]')).toBeNull();
    const stored = setItem.mock.calls.map((call) => String(call[1]));
    expect(stored.some((value) => value.includes('sk_live_secret_once'))).toBe(false);
    setItem.mockRestore();
  });

  it('rejects a webhook URL that does not start with https://', async () => {
    await renderPage();
    const tab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Webhooks');
    await act(async () => {
      tab?.click();
    });
    await act(async () => {});
    const add = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Add endpoint');
    await act(async () => {
      add?.click();
    });
    const url = container.querySelector('[aria-label="Webhook URL"]') as HTMLInputElement;
    setValue(url, 'http://example.com/hook');
    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain('URL must start with https://');
  });

  it('renders failed import rows', async () => {
    await act(async () => {
      root.render(
        <ImportResultTable
          result={{
            created: 1,
            skipped_existing: 0,
            total_rows: 2,
            failed: [{ row: 2, external_id: 'EXT-2', error: 'name is required' }],
          }}
        />,
      );
    });
    expect(container.textContent).toContain('name is required');
    expect(container.textContent).toContain('EXT-2');
    expect(container.textContent).toContain('Failed 1');
  });

  it('hides the Integrations menu item for a non-admin role', async () => {
    authState.role = 'sales';
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );
    });
    expect(container.querySelector('a[href="/settings/integrations"]')).toBeNull();
  });

  it('shows the Integrations menu item for an admin', async () => {
    authState.role = 'admin';
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Sidebar />
        </MemoryRouter>,
      );
    });
    expect(container.querySelector('a[href="/settings/integrations"]')).not.toBeNull();
  });

  const NEW_SCOPES = [
    'credit_notes:read',
    'credit_notes:write',
    'collections:read',
    'collections:write',
    'credit:read',
    'banking:read',
    'banking:write',
    'bank_transactions:read',
    'bank_transactions:write',
    'pdc:read',
    'pdc:write',
    'reports:read',
    'tax:read',
    'tax:write',
    'quotations:read',
    'quotations:write',
    'deliveries:write',
  ] as const;

  const IDEMPOTENCY_NOTE = 'Money writes require an Idempotency-Key header on every request.';
  const ACCOUNTANT_NOTE = 'This key will be created with the Accountant role so it can reach finance and reports endpoints.';

  async function openCreateKey() {
    await renderPage();
    const create = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Create API key');
    await act(async () => {
      create?.click();
    });
  }

  function clickScope(scope: string) {
    const box = Array.from(container.querySelectorAll('input[type="checkbox"]')).find((input) => input.parentElement?.textContent?.includes(scope));
    return box as HTMLInputElement | undefined;
  }

  it('renders a checkbox for every new scope and partitions the catalog', async () => {
    expect(integrationsApi.API_KEY_SCOPES).toHaveLength(39);
    const invoicesGroup = integrationsApi.SCOPE_GROUPS.find((group) => group.label === 'Invoices & returns');
    expect(invoicesGroup?.scopes).toEqual([
      'invoices:read',
      'invoices:write',
      'sales_returns:read',
      'sales_returns:write',
    ]);
    expect(integrationsApi.MONEY_WRITE_SCOPES).toContain('sales_returns:write');
    expect(new Set(integrationsApi.API_KEY_SCOPES).size).toBe(integrationsApi.API_KEY_SCOPES.length);
    const grouped = integrationsApi.SCOPE_GROUPS.flatMap((group) => group.scopes);
    for (const scope of [...grouped, ...integrationsApi.MONEY_WRITE_SCOPES, ...integrationsApi.FINANCE_ROLE_SCOPES]) {
      expect(integrationsApi.API_KEY_SCOPES).toContain(scope);
    }
    for (const scope of integrationsApi.API_KEY_SCOPES) {
      expect(grouped.filter((item) => item === scope)).toHaveLength(1);
    }
    await openCreateKey();
    for (const scope of NEW_SCOPES) {
      const box = Array.from(container.querySelectorAll('input[type="checkbox"]')).find((input) => input.parentElement?.textContent?.includes(scope));
      expect(box).toBeInstanceOf(HTMLInputElement);
      expect(box?.parentElement?.textContent).toContain(scope);
    }
  });

  it('shows the Idempotency-Key and Accountant notes for pdc:write', async () => {
    await openCreateKey();
    await act(async () => {
      clickScope('pdc:write')?.click();
    });
    expect(container.textContent).toContain(IDEMPOTENCY_NOTE);
    expect(container.textContent).toContain(ACCOUNTANT_NOTE);
  });

  it('shows only the Accountant note for reports:read', async () => {
    await openCreateKey();
    await act(async () => {
      clickScope('reports:read')?.click();
    });
    expect(container.textContent).toContain(ACCOUNTANT_NOTE);
    expect(container.textContent).not.toContain(IDEMPOTENCY_NOTE);
  });

  it('shows neither finance note for quotations:read', async () => {
    await openCreateKey();
    await act(async () => {
      clickScope('quotations:read')?.click();
    });
    expect(container.textContent).not.toContain(ACCOUNTANT_NOTE);
    expect(container.textContent).not.toContain(IDEMPOTENCY_NOTE);
  });

  async function openConnections() {
    const keys = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'API Keys');
    await act(async () => {
      keys?.click();
    });
    const tab = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Connections');
    await act(async () => {
      tab?.click();
    });
    await act(async () => {});
    await act(async () => {});
  }

  it('shows a QuickBooks badge for each connection status', async () => {
    authState.role = 'admin';
    const cases: { status: QuickBooksStatus; text: string }[] = [
      { status: disconnectedQuickBooks({ status: 'disconnected' }), text: 'Disconnected' },
      { status: disconnectedQuickBooks({ status: 'pending' }), text: 'Pending' },
      {
        status: disconnectedQuickBooks({ status: 'connected', company_name: 'Sandbox Co', environment: 'sandbox' }),
        text: 'Connected to Sandbox Co (sandbox)',
      },
      {
        status: disconnectedQuickBooks({ status: 'error', last_error: 'token refresh failed' }),
        text: 'Error: token refresh failed',
      },
    ];
    for (const row of cases) {
      vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(row.status);
      await renderPage();
      await openConnections();
      expect(container.textContent).toContain(row.text);
    }
  });

  it('starts QuickBooks connect and disables Connect when the server is not configured', async () => {
    authState.role = 'admin';
    const authorizeUrl = 'https://appcenter.intuit.com/connect/oauth2';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(disconnectedQuickBooks({ status: 'disconnected', configured: true }));
    vi.mocked(integrationsApi.startQuickBooksConnect).mockResolvedValue({ authorize_url: authorizeUrl });
    await renderPage();
    await openConnections();
    const connect = container.querySelector('button[title="Connect QuickBooks"]') as HTMLButtonElement;
    expect(connect.disabled).toBe(false);
    await act(async () => {
      connect.click();
    });
    await act(async () => {});
    expect(integrationsApi.startQuickBooksConnect).toHaveBeenCalledTimes(1);
    expect(locationAssign).toHaveBeenCalledWith(authorizeUrl);

    vi.mocked(integrationsApi.startQuickBooksConnect).mockClear();
    locationAssign.mockClear();
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(disconnectedQuickBooks({ status: 'disconnected', configured: false }));
    await renderPage();
    await openConnections();
    const disabled = container.querySelector('button[title="Connect QuickBooks"]') as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    expect(container.textContent).toContain('Not configured on this server');
    await act(async () => {
      disabled.click();
    });
    expect(integrationsApi.startQuickBooksConnect).not.toHaveBeenCalled();
    expect(locationAssign).not.toHaveBeenCalled();
  });

  it('disconnects QuickBooks after confirm and surfaces a 502 detail', async () => {
    authState.role = 'admin';
    const connected = disconnectedQuickBooks({
      status: 'connected',
      company_name: 'Sandbox Co',
      environment: 'sandbox',
      connected_at: '2026-01-01T00:00:00Z',
    });
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connected);
    vi.mocked(integrationsApi.disconnectQuickBooks).mockResolvedValue({ status: 'disconnected' });
    await renderPage();
    await openConnections();
    const callsBefore = vi.mocked(integrationsApi.getQuickBooksStatus).mock.calls.length;
    const disconnect = container.querySelector('button[title="Disconnect QuickBooks"]') as HTMLButtonElement;
    await act(async () => {
      disconnect.click();
    });
    await act(async () => {});
    expect(window.confirm).toHaveBeenCalledWith('Disconnect QuickBooks? SOLTOL will revoke its access; nothing in QuickBooks is deleted.');
    expect(integrationsApi.disconnectQuickBooks).toHaveBeenCalledTimes(1);
    expect(vi.mocked(integrationsApi.getQuickBooksStatus).mock.calls.length).toBeGreaterThan(callsBefore);

    vi.mocked(integrationsApi.disconnectQuickBooks).mockRejectedValue({
      response: { status: 502, data: { detail: 'Could not revoke at QuickBooks; try again' } },
    });
    await renderPage();
    await openConnections();
    const again = container.querySelector('button[title="Disconnect QuickBooks"]') as HTMLButtonElement;
    await act(async () => {
      again.click();
    });
    await act(async () => {});
    expect(document.getElementById('integrations-error-toast')?.textContent).toBe('Could not revoke at QuickBooks; try again');
  });

  it('opens Connections from the QuickBooks callback query and strips it', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockClear();
    window.history.pushState(null, '', '/settings/integrations?qbo=connected');
    await renderPage();
    await act(async () => {});
    const selected = container.querySelector('button[role="tab"][aria-selected="true"]');
    expect(selected?.textContent).toBe('Connections');
    expect(document.getElementById('app-global-share-toast')?.textContent).toContain('QuickBooks connected');
    expect(integrationsApi.getQuickBooksStatus).toHaveBeenCalled();
    expect(window.location.search).toBe('');

    act(() => {
      root.unmount();
    });
    document.getElementById('app-global-share-toast')?.remove();
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.history.pushState(null, '', '/settings/integrations?qbo=error&reason=bad_state');
    await renderPage();
    await act(async () => {});
    expect(document.getElementById('integrations-error-toast')?.textContent).toBe(QBO_ERROR_REASONS.bad_state);
    expect(window.location.search).toBe('');
  });

  it('shows a read-only line for non-admins and does not load QuickBooks status', async () => {
    authState.role = 'sales';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockClear();
    await renderPage();
    await openConnections();
    expect(container.textContent).toContain('Ask a company admin to manage connections.');
    expect(integrationsApi.getQuickBooksStatus).not.toHaveBeenCalled();
    expect(integrationsApi.getQuickBooksSettings).not.toHaveBeenCalled();
    expect(integrationsApi.putQuickBooksSettings).not.toHaveBeenCalled();
    expect(integrationsApi.listQuickBooksIncomeAccounts).not.toHaveBeenCalled();
    expect(integrationsApi.listQuickBooksDepositAccounts).not.toHaveBeenCalled();
    expect(integrationsApi.syncQuickBooks).not.toHaveBeenCalled();
    expect(integrationsApi.retryQuickBooksSync).not.toHaveBeenCalled();
    expect(integrationsApi.listQuickBooksSyncLog).not.toHaveBeenCalled();
  });

  function connectedQuickBooks() {
    return disconnectedQuickBooks({
      status: 'connected',
      company_name: 'Sandbox Co',
      environment: 'sandbox',
      connected_at: '2026-01-01T00:00:00Z',
    });
  }

  it('saves QuickBooks income account and item type from the connected card', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.putQuickBooksSettings).mockResolvedValue({
      income_account_ref: '79',
      item_type: 'NonInventory',
      deposit_account_ref: null,
      tax_mode: 'none',
      auto_sync: false,
    });
    await renderPage();
    await openConnections();
    expect(container.textContent).toContain('Sales of Product Income');
    const income = container.querySelector('select[title="QuickBooks income account"]') as HTMLSelectElement;
    const itemType = container.querySelector('select[title="QuickBooks item type"]') as HTMLSelectElement;
    await act(async () => {
      setValue(income, '79');
      setValue(itemType, 'NonInventory');
    });
    const save = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save settings');
    await act(async () => {
      save?.click();
    });
    await act(async () => {});
    expect(integrationsApi.putQuickBooksSettings).toHaveBeenCalledWith({
      income_account_ref: '79',
      item_type: 'NonInventory',
      deposit_account_ref: null,
      tax_mode: 'none',
      auto_sync: false,
    });
    expect(document.getElementById('app-global-share-toast')?.textContent).toContain('QuickBooks settings saved');
  });

  it('disables Sync products until an income account is set', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    await renderPage();
    await openConnections();
    const blocked = container.querySelector('button[title="Set an income account first"]') as HTMLButtonElement;
    expect(blocked.textContent).toBe('Sync products');
    expect(blocked.disabled).toBe(true);

    vi.mocked(integrationsApi.getQuickBooksSettings).mockResolvedValue({
      income_account_ref: '79',
      item_type: 'NonInventory',
      deposit_account_ref: null,
      tax_mode: 'none',
      auto_sync: false,
    });
    await openConnections();
    const enabled = container.querySelector('button[title="Sync products to QuickBooks"]') as HTMLButtonElement;
    expect(enabled.textContent).toBe('Sync products');
    expect(enabled.disabled).toBe(false);
  });

  it('pushes all customers and lists failing sync results', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.syncQuickBooks).mockResolvedValue({
      requested: 2,
      ok: 1,
      error: 1,
      results: [
        { entity_id: 7, qbo_id: null, action: 'create', status: 'error', error: 'QuickBooks income account not set' },
        { entity_id: 8, qbo_id: '55', action: 'update', status: 'ok', error: null },
      ],
    });
    await renderPage();
    await openConnections();
    const callsBefore = vi.mocked(integrationsApi.listQuickBooksSyncLog).mock.calls.length;
    const syncCustomers = container.querySelector('button[title="Sync customers to QuickBooks"]') as HTMLButtonElement;
    await act(async () => {
      syncCustomers.click();
    });
    await act(async () => {});
    expect(window.confirm).toHaveBeenCalledWith('Push all customers to QuickBooks? Existing records are matched by name/SKU and updated.');
    expect(integrationsApi.syncQuickBooks).toHaveBeenCalledWith('customers', { all: true });
    expect(container.textContent).toContain('1 synced, 1 failed');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('QuickBooks income account not set');
    expect(vi.mocked(integrationsApi.listQuickBooksSyncLog).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('shows a 400 QuickBooks sync detail in the error toast', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.syncQuickBooks).mockRejectedValue({
      response: { status: 400, data: { detail: 'Maximum 200 per request' } },
    });
    await renderPage();
    await openConnections();
    const syncCustomers = container.querySelector('button[title="Sync customers to QuickBooks"]') as HTMLButtonElement;
    await act(async () => {
      syncCustomers.click();
    });
    await act(async () => {});
    expect(document.getElementById('integrations-error-toast')?.textContent).toBe('Maximum 200 per request');
  });

  it('renders the sync log, the empty state, and hides sync blocks when disconnected', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockResolvedValue([
      {
        id: 1,
        entity_type: 'customer',
        entity_id: 3,
        qbo_id: '100',
        action: 'create',
        status: 'ok',
        error_text: null,
        attempted_at: '2026-02-01T12:00:00Z',
      },
      {
        id: 2,
        entity_type: 'product',
        entity_id: 9,
        qbo_id: null,
        action: 'create',
        status: 'error',
        error_text: 'Duplicate name',
        attempted_at: '2026-02-01T12:05:00Z',
      },
    ]);
    await renderPage();
    await openConnections();
    expect(container.textContent).toContain('Recent sync log');
    expect(container.textContent).toContain('create');
    expect(container.textContent).toContain('ok');
    expect(container.textContent).toContain('Duplicate name');
    expect(container.textContent).not.toContain('No sync activity yet.');

    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockResolvedValue([]);
    await openConnections();
    expect(container.textContent).toContain('No sync activity yet.');

    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(disconnectedQuickBooks());
    vi.mocked(integrationsApi.getQuickBooksSettings).mockClear();
    vi.mocked(integrationsApi.putQuickBooksSettings).mockClear();
    vi.mocked(integrationsApi.listQuickBooksIncomeAccounts).mockClear();
    vi.mocked(integrationsApi.listQuickBooksDepositAccounts).mockClear();
    vi.mocked(integrationsApi.syncQuickBooks).mockClear();
    vi.mocked(integrationsApi.retryQuickBooksSync).mockClear();
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockClear();
    await openConnections();
    expect(container.textContent).not.toContain('Sync settings');
    expect(container.textContent).not.toContain('Push to QuickBooks');
    expect(container.textContent).not.toContain('Recent sync log');
    expect(container.textContent).not.toContain('No sync activity yet.');
    expect(integrationsApi.getQuickBooksSettings).not.toHaveBeenCalled();
    expect(integrationsApi.putQuickBooksSettings).not.toHaveBeenCalled();
    expect(integrationsApi.listQuickBooksIncomeAccounts).not.toHaveBeenCalled();
    expect(integrationsApi.listQuickBooksDepositAccounts).not.toHaveBeenCalled();
    expect(integrationsApi.syncQuickBooks).not.toHaveBeenCalled();
    expect(integrationsApi.retryQuickBooksSync).not.toHaveBeenCalled();
    expect(integrationsApi.listQuickBooksSyncLog).not.toHaveBeenCalled();
  });

  it('saves deposit account, tax mode, and automatic sync with the income settings', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.putQuickBooksSettings).mockResolvedValue({
      income_account_ref: '79',
      item_type: 'NonInventory',
      deposit_account_ref: '35',
      tax_mode: 'qbo_automatic',
      auto_sync: true,
    });
    await renderPage();
    await openConnections();
    const income = container.querySelector('select[title="QuickBooks income account"]') as HTMLSelectElement;
    const deposit = container.querySelector('select[title="QuickBooks deposit account"]') as HTMLSelectElement;
    const taxMode = container.querySelector('select[title="QuickBooks tax mode"]') as HTMLSelectElement;
    const autoSync = container.querySelector('input[title="QuickBooks automatic sync"]') as HTMLInputElement;
    await act(async () => {
      setValue(income, '79');
      setValue(deposit, '35');
      setValue(taxMode, 'qbo_automatic');
      autoSync.click();
    });
    const save = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save settings');
    await act(async () => {
      save?.click();
    });
    await act(async () => {});
    expect(integrationsApi.putQuickBooksSettings).toHaveBeenCalledWith({
      income_account_ref: '79',
      item_type: 'NonInventory',
      deposit_account_ref: '35',
      tax_mode: 'qbo_automatic',
      auto_sync: true,
    });
  });

  it('gates invoice, payment, and credit note sync on an income account', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    await renderPage();
    await openConnections();
    for (const label of ['Sync invoices', 'Sync payments', 'Sync credit notes']) {
      const blocked = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label) as HTMLButtonElement;
      expect(blocked.title).toBe('Set an income account first');
      expect(blocked.disabled).toBe(true);
    }

    vi.mocked(integrationsApi.getQuickBooksSettings).mockResolvedValue({
      income_account_ref: '79',
      item_type: 'NonInventory',
      deposit_account_ref: null,
      tax_mode: 'none',
      auto_sync: false,
    });
    await openConnections();
    for (const [label, title] of [
      ['Sync invoices', 'Sync invoices to QuickBooks'],
      ['Sync payments', 'Sync payments to QuickBooks'],
      ['Sync credit notes', 'Sync credit notes to QuickBooks'],
    ] as const) {
      const enabled = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === label) as HTMLButtonElement;
      expect(enabled.title).toBe(title);
      expect(enabled.disabled).toBe(false);
    }
    const syncPayments = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Sync payments') as HTMLButtonElement;
    await act(async () => {
      syncPayments.click();
    });
    await act(async () => {});
    expect(window.confirm).toHaveBeenCalledWith('Push all payments to QuickBooks? Existing records are matched by name/SKU and updated.');
    expect(integrationsApi.syncQuickBooks).toHaveBeenCalledWith('payments', { all: true });
  });

  it('retries a failed sync row and omits Retry on ok rows', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockResolvedValue([
      {
        id: 1,
        entity_type: 'invoice',
        entity_id: 4,
        qbo_id: '10',
        action: 'create',
        status: 'ok',
        error_text: null,
        attempted_at: '2026-02-01T12:00:00Z',
      },
      {
        id: 9,
        entity_type: 'payment',
        entity_id: 5,
        qbo_id: null,
        action: 'create',
        status: 'error',
        error_text: 'rejected',
        attempted_at: '2026-02-01T12:05:00Z',
      },
    ]);
    vi.mocked(integrationsApi.retryQuickBooksSync).mockResolvedValue({
      entity_id: 5,
      qbo_id: '11',
      action: 'update',
      status: 'ok',
      error: null,
    });
    await renderPage();
    await openConnections();
    const rows = Array.from(container.querySelectorAll('tbody tr'));
    const okRow = rows.find((row) => row.textContent?.includes('invoice'));
    const errorRow = rows.find((row) => row.textContent?.includes('payment'));
    expect(okRow?.querySelector('button[title="Retry this row"]')).toBeNull();
    const retry = errorRow?.querySelector('button[title="Retry this row"]') as HTMLButtonElement;
    expect(retry.textContent).toBe('Retry');
    const callsBefore = vi.mocked(integrationsApi.listQuickBooksSyncLog).mock.calls.length;
    await act(async () => {
      retry.click();
    });
    await act(async () => {});
    expect(integrationsApi.retryQuickBooksSync).toHaveBeenCalledWith(9);
    expect(document.getElementById('app-global-share-toast')?.textContent).toContain('Retried — synced');
    expect(vi.mocked(integrationsApi.listQuickBooksSyncLog).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('shows the retry error text when the retry result is not ok', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockResolvedValue([
      {
        id: 4,
        entity_type: 'invoice',
        entity_id: 8,
        qbo_id: null,
        action: 'create',
        status: 'error',
        error_text: 'totals differ',
        attempted_at: '2026-02-02T12:00:00Z',
      },
    ]);
    vi.mocked(integrationsApi.retryQuickBooksSync).mockResolvedValue({
      entity_id: 8,
      qbo_id: null,
      action: 'update',
      status: 'error',
      error: 'QBO total 40.1 ≠ SOLTOL total 40.0',
    });
    await renderPage();
    await openConnections();
    const retry = container.querySelector('button[title="Retry this row"]') as HTMLButtonElement;
    await act(async () => {
      retry.click();
    });
    await act(async () => {});
    expect(document.getElementById('integrations-error-toast')?.textContent).toBe('QBO total 40.1 ≠ SOLTOL total 40.0');
  });

  it('reloads the sync log for failed rows and marks ok rows that carry an error as a warning', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.listQuickBooksSyncLog).mockResolvedValue([
      {
        id: 3,
        entity_type: 'invoice',
        entity_id: 8,
        qbo_id: '20',
        action: 'update',
        status: 'ok',
        error_text: 'tax rounded',
        attempted_at: '2026-03-01T00:00:00Z',
      },
    ]);
    await renderPage();
    await openConnections();
    expect(container.textContent).toContain('ok (warning)');
    const failedOnly = container.querySelector('input[title="Show failed rows only"]') as HTMLInputElement;
    await act(async () => {
      failedOnly.click();
    });
    await act(async () => {});
    expect(integrationsApi.listQuickBooksSyncLog).toHaveBeenCalledWith({ limit: 20, failed_only: true });
  });

  it('shows a 409 QuickBooks sync busy detail in the error toast', async () => {
    authState.role = 'admin';
    vi.mocked(integrationsApi.getQuickBooksStatus).mockResolvedValue(connectedQuickBooks());
    vi.mocked(integrationsApi.syncQuickBooks).mockRejectedValue({
      response: { status: 409, data: { detail: 'A QuickBooks sync is already running for this company; try again shortly' } },
    });
    await renderPage();
    await openConnections();
    const syncCustomers = container.querySelector('button[title="Sync customers to QuickBooks"]') as HTMLButtonElement;
    await act(async () => {
      syncCustomers.click();
    });
    await act(async () => {});
    expect(document.getElementById('integrations-error-toast')?.textContent).toBe(
      'A QuickBooks sync is already running for this company; try again shortly',
    );
  });
});
