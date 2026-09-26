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
});
