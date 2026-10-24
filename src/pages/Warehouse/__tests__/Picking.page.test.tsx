import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PickingPage from '../Picking';
import * as api from '../../../services/api';
import { localIsoDate } from '../../../utils/localDate';
import type { Invoice } from '../../../services/api';

const { authFetch, apiGet } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('../../../api/axios', () => ({
  default: { get: apiGet },
  authFetch,
  ACCESS_TOKEN_KEY: 'access_token',
}));

vi.mock('../../../services/vanService', () => ({
  vanService: { getAll: vi.fn().mockResolvedValue([]) },
}));

function http(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

const listBody = {
  total: 1,
  items: [{
    id: 4,
    number: 'PK-000004',
    status: 'draft',
    source_kind: 'route',
    route_date: '2026-10-24',
    van_id: null,
    assigned_to: 2,
    created_at: '2026-10-24T12:00:00',
    line_count: 12,
    picked_count: 7,
    invoice_ids: [9, 10],
  }],
};

const users = [
  { id: 1, username: 'sam', full_name: 'Sam Sales', role: 'sales' },
  { id: 2, username: 'wren', full_name: 'Wren', role: 'warehouse' },
];

function invoice(partial: Partial<Invoice> & Pick<Invoice, 'id' | 'invoiceNumber' | 'customerName'>): Invoice {
  return {
    invoiceDate: localIsoDate(),
    dueDate: localIsoDate(),
    lineItems: [],
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 0,
    notes: '',
    status: 'Unpaid',
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

function calls() {
  return authFetch.mock.calls.map((call) => {
    const init = call[1] as RequestInit | undefined;
    return {
      url: String(call[0]),
      method: String(init?.method || 'GET').toUpperCase(),
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined,
    };
  });
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(label));
  expect(found, label).toBeTruthy();
  return found as HTMLButtonElement;
}

function setValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = el instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Picking board', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authFetch.mockReset();
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      if (String(url).includes('/for-invoice/8')) {
        return http({ id: 3, number: 'PK-000003', status: 'picking', source_kind: 'invoice', lines: [] });
      }
      if (String(url).includes('/for-invoice/')) return http({ detail: 'not found' }, 404);
      if (method === 'POST' && /\/pick-lists\/?$/.test(String(url))) {
        const payload = JSON.parse(String(init?.body || '{}')) as { route_date?: string; invoice_ids?: number[] };
        return http({
          id: 15,
          number: 'PK-000015',
          status: 'draft',
          source_kind: payload.route_date ? 'route' : 'invoice',
          route_date: payload.route_date ?? null,
          invoice_ids: payload.invoice_ids ?? [],
          lines: [],
        });
      }
      if (method === 'POST') return http({ id: 4, number: 'PK-000004', status: 'draft', lines: [] });
      return http(listBody);
    });
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: users });
    vi.spyOn(api, 'getInvoices').mockResolvedValue([
      invoice({ id: '8', invoiceNumber: 'INV-8', customerName: 'Acme' }),
      invoice({ id: '9', invoiceNumber: 'INV-9', customerName: 'Beta' }),
      invoice({ id: '1', invoiceNumber: 'INV-OLD', customerName: 'Old', invoiceDate: '2020-01-01' }),
    ]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 6; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function mount() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/warehouse/picking']}>
          <Routes>
            <Route path="/warehouse/picking" element={<PickingPage />} />
            <Route path="/warehouse/picking/:id" element={<div>opened</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('renders lists from a mocked GET', async () => {
    await mount();
    expect(container.textContent).toContain('PK-000004');
    expect(container.textContent).toContain('2026-10-24');
    expect(container.textContent).toContain('draft');
    expect(container.textContent).toContain('Wren');
    expect(container.textContent).toContain('7 / 12');
  });

  it('reads the staging pick_lists key', async () => {
    authFetch.mockImplementation(async () => http({
      total: 1,
      pick_lists: [{
        id: 9,
        number: 'PK-000009',
        status: 'released',
        source_kind: 'invoice',
        invoice_ids: [3],
        line_count: 2,
        picked_count: 1,
      }],
    }));
    await mount();
    expect(container.textContent).toContain('PK-000009');
    expect(container.textContent).toContain('1 / 2');
    expect(container.textContent).toContain('1 invoices');
  });

  it('creates a route-day draft with route_date', async () => {
    await mount();
    await act(() => {
      button(container, 'New pick list').click();
    });
    const date = (container.querySelector('[aria-label="Route date"]') as HTMLInputElement).value;
    expect(date).toBe(localIsoDate());
    await act(async () => {
      button(container, 'Create draft').click();
      await Promise.resolve();
    });
    await flush();
    const create = calls().find((call) => call.method === 'POST' && /\/pick-lists\/?$/.test(call.url));
    expect(create?.body).toEqual({ route_date: date });
    expect(container.textContent).toContain('opened');
  });

  it('creates from selected invoices and badges an open list', async () => {
    await mount();
    await act(() => {
      button(container, 'New pick list').click();
    });
    await act(async () => {
      button(container, 'Invoices').click();
      await Promise.resolve();
    });
    await flush();
    expect(container.textContent).toContain('INV-8');
    expect(container.textContent).not.toContain('INV-OLD');
    const search = container.querySelector('[aria-label="Search invoices"]') as HTMLInputElement;
    await act(() => {
      setValue(search, 'Beta');
    });
    expect(container.textContent).toContain('INV-9');
    expect(container.textContent).not.toContain('INV-8');
    await act(() => {
      setValue(search, '');
    });
    const box = container.querySelector('[aria-label="Select INV-8"]') as HTMLInputElement;
    await act(async () => {
      box.click();
      await Promise.resolve();
    });
    await flush();
    expect(container.querySelector('[data-testid="open-list-badge-8"]')?.textContent).toBe('PK-000003');
    await act(async () => {
      button(container, 'Create draft').click();
      await Promise.resolve();
    });
    await flush();
    const create = calls().find((call) => call.method === 'POST' && /\/pick-lists\/?$/.test(call.url));
    expect(create?.body).toEqual({ invoice_ids: [8] });
    expect(container.textContent).toContain('opened');
  });

  it('shows a 409 detail inline', async () => {
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST') return http({ detail: 'invoice line already on an open list' }, 409);
      if (String(url).includes('/for-invoice/')) return http({ detail: 'not found' }, 404);
      return http(listBody);
    });
    await mount();
    await act(() => {
      button(container, 'New pick list').click();
    });
    await act(async () => {
      button(container, 'Invoices').click();
      await Promise.resolve();
    });
    await flush();
    const box = container.querySelector('[aria-label="Select INV-8"]') as HTMLInputElement;
    await act(async () => {
      box.click();
      await Promise.resolve();
    });
    await flush();
    await act(async () => {
      button(container, 'Create draft').click();
      await Promise.resolve();
    });
    await flush();
    expect(container.querySelector('[data-testid="create-error"]')?.textContent).toContain('invoice line already on an open list');
    expect(container.textContent).not.toContain('opened');
  });

  it('releases, assigns, and cancels through their endpoints', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await mount();
    await act(async () => {
      button(container, 'Release').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/pick-lists/4/release'))).toBe(true);

    await act(() => {
      button(container, 'Assign').click();
    });
    const select = container.querySelector('[aria-label="Assign to"]') as HTMLSelectElement;
    expect(select.options[1].textContent).toBe('Wren');
    expect(select.options[2].textContent).toBe('Sam Sales');
    await act(() => {
      setValue(select, '2');
    });
    await act(async () => {
      button(container, 'Save assignment').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/pick-lists/4/assign') && call.body?.user_id === 2)).toBe(true);

    await act(async () => {
      button(container, 'Cancel').click();
      await Promise.resolve();
    });
    await flush();
    expect(confirm).toHaveBeenCalled();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/pick-lists/4/cancel'))).toBe(true);
  });
});
