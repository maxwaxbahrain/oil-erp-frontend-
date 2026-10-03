import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as integrationsApi from '../../../api/integrations';
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
  };
});

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

  beforeEach(() => {
    authState.role = 'sales';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(integrationsApi.listApiKeys).mockResolvedValue([]);
    vi.mocked(integrationsApi.listWebhooks).mockResolvedValue([]);
    vi.mocked(integrationsApi.listWebhookEventTypes).mockResolvedValue(['invoice.created']);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
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
});
