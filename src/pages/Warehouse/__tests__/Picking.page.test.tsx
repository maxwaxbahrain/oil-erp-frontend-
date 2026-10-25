import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PickingPage from '../Picking';
import * as api from '../../../services/api';
import { vanService } from '../../../services/vanService';
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

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'admin', full_name: 'Admin', role: 'admin' },
    hasRole: (...roles: string[]) => roles.includes('admin'),
  }),
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

  it('dispatches a picked list with van, driver, and note', async () => {
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST' && String(url).endsWith('/dispatch')) {
        return http({ id: 4, number: 'PK-000004', status: 'dispatched', lines: [] });
      }
      return http({
        total: 1,
        items: [{
          id: 4,
          number: 'PK-000004',
          status: 'picked',
          source_kind: 'invoice',
          van_id: null,
          assigned_to: 2,
          line_count: 2,
          picked_count: 2,
        }],
      });
    });
    vi.mocked(vanService.getAll).mockResolvedValue([
      { id: 'van-1', van_number: 'VAN-1', driver_name: 'Dee', vehicle_number: 'PLT-9', status: 'active' },
    ]);
    await mount();
    await act(() => {
      button(container, 'Dispatch…').click();
    });
    await flush();
    const dialog = container.querySelector('[aria-label="Dispatch"]') as HTMLElement;
    await act(() => {
      setValue(dialog.querySelector('[aria-label="Dispatch van"]') as HTMLSelectElement, 'van-1');
      setValue(dialog.querySelector('[aria-label="Dispatch driver"]') as HTMLSelectElement, '2');
      setValue(dialog.querySelector('[aria-label="Dispatch note"]') as HTMLTextAreaElement, 'gate');
    });
    await act(async () => {
      button(dialog, 'Dispatch').click();
      await Promise.resolve();
    });
    await flush();
    const posted = calls().find((call) => call.method === 'POST' && call.url.endsWith('/pick-lists/4/dispatch'));
    expect(posted?.body).toEqual({ van_id: 'van-1', driver_id: 2, note: 'gate' });
  });

  it('shows an undispatch 400 and lists dispatched rows with van and driver', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST' && String(url).endsWith('/undispatch')) {
        return http({ detail: 'a delivery has already left pending' }, 400);
      }
      return http({
        total: 1,
        items: [{
          id: 4,
          number: 'PK-000004',
          status: 'dispatched',
          source_kind: 'invoice',
          van_id: 'van-1',
          driver_id: 2,
          assigned_to: null,
          line_count: 2,
          picked_count: 2,
        }],
      });
    });
    vi.mocked(vanService.getAll).mockResolvedValue([
      { id: 'van-1', van_number: 'VAN-1', driver_name: 'Dee', vehicle_number: 'PLT-9', status: 'active' },
    ]);
    await mount();
    expect(container.textContent).toContain('Dispatched');
    expect(container.querySelector('[data-testid="pick-van-4"]')?.textContent).toBe('VAN-1');
    expect(container.querySelector('[data-testid="pick-driver-4"]')?.textContent).toBe('Wren');
    await act(async () => {
      button(container, 'Undispatch').click();
      await Promise.resolve();
    });
    await flush();
    expect(confirm).toHaveBeenCalled();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/pick-lists/4/undispatch'))).toBe(true);
    expect(container.querySelector('[data-testid="picking-error"]')?.textContent).toContain('a delivery has already left pending');
  });

  it('filters the list with status dispatched', async () => {
    await mount();
    const select = container.querySelector('[aria-label="Filter status"]') as HTMLSelectElement;
    await act(async () => {
      setValue(select, 'dispatched');
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'GET' && call.url.includes('status=dispatched'))).toBe(true);
  });

  const openShortage = {
    id: 7,
    pick_list_id: 4,
    pick_list_line_id: 22,
    pick_list_number: 'PK-000004',
    invoice_id: 8,
    invoice_number: 'INV-8',
    customer_name: 'Acme',
    product_id: 3,
    sku: 'OIL',
    product_name: 'Drum oil',
    qty_short: 2,
    resolution: 'open',
    backorder_qty_open: null,
    sales_return_id: null,
    resolved_at: null,
    note: null,
  };

  function mockShortages(rowsFor: (url: string) => unknown) {
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      const text = String(url);
      if (method === 'POST' && text.includes('/shortages/') && text.endsWith('/resolve')) {
        const payload = JSON.parse(String(init?.body || '{}')) as { mode?: string; note?: string };
        return http({
          ...openShortage,
          resolution: payload.mode,
          note: payload.note ?? null,
          sales_return_id: payload.mode === 'credited' ? 44 : null,
          backorder_qty_open: payload.mode === 'backorder' ? openShortage.qty_short : null,
        });
      }
      if (method === 'GET' && text.includes('/picking/shortages')) return http(rowsFor(text));
      return http(listBody);
    });
  }

  async function openShortagesTab() {
    await mount();
    await act(async () => {
      button(container, 'Shortages').click();
      await Promise.resolve();
    });
    await flush();
  }

  it('lists open shortages and posts backorder, credit, and ignore', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockShortages(() => [openShortage]);
    vi.spyOn(api, 'getInvoiceById').mockResolvedValue(invoice({
      id: '8',
      invoiceNumber: 'INV-8',
      customerName: 'Acme',
      lineItems: [{ product: 'Drum oil', description: '', quantity: 12, rate: 9, amount: 108, productId: '3' }],
    }));
    await openShortagesTab();
    expect(container.textContent).toContain('PK-000004');
    expect(container.textContent).toContain('INV-8');
    expect(container.textContent).toContain('Acme');
    expect(container.textContent).toContain('Drum oil');
    expect(container.textContent).toContain('Qty short 2');
    expect(calls().some((call) => call.method === 'GET' && call.url.includes('/picking/shortages') && call.url.includes('resolution=open'))).toBe(true);

    await act(async () => {
      button(container, 'Backorder').click();
      await Promise.resolve();
    });
    await flush();
    expect(confirm).toHaveBeenCalled();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/shortages/7/resolve') && call.body?.mode === 'backorder')).toBe(true);

    await act(async () => {
      button(container, 'Credit customer').click();
      await Promise.resolve();
    });
    await flush();
    const credit = container.querySelector('[aria-label="Credit customer"]') as HTMLElement;
    expect(credit.textContent).toContain('Qty short 2');
    expect(credit.textContent).toContain('Unit price 9');
    expect(credit.querySelector('[data-testid="credit-preview"]')?.textContent).toBe('Preview ≈ 2 × 9');
    await act(async () => {
      button(credit, 'Confirm credit').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/shortages/7/resolve') && JSON.stringify(call.body) === JSON.stringify({ mode: 'credited' }))).toBe(true);
    const returnLink = Array.from(credit.querySelectorAll('a')).find((node) => node.textContent === 'Sales return 44');
    expect(returnLink?.getAttribute('href')).toBe('/sales/returns/44');

    await act(() => {
      button(container, 'Ignore').click();
    });
    const ignore = container.querySelector('[aria-label="Ignore shortage"]') as HTMLElement;
    await act(async () => {
      button(ignore, 'Confirm ignore').click();
      await Promise.resolve();
    });
    expect(ignore.textContent).toContain('A note is required');
    expect(calls().some((call) => call.body?.mode === 'ignored')).toBe(false);
    await act(() => {
      setValue(ignore.querySelector('[aria-label="Ignore note"]') as HTMLTextAreaElement, 'customer declined');
    });
    await act(async () => {
      button(ignore, 'Confirm ignore').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'POST' && call.body?.mode === 'ignored' && call.body?.note === 'customer declined')).toBe(true);
  });

  it('toggles show resolved off the open query', async () => {
    mockShortages((url) => (url.includes('resolution=open')
      ? [openShortage]
      : [
        { ...openShortage, id: 8, resolution: 'backorder', backorder_qty_open: 2 },
        { ...openShortage, id: 9, resolution: 'credited', sales_return_id: 44 },
        { ...openShortage, id: 10, resolution: 'ignored', note: 'customer declined' },
      ]));
    await openShortagesTab();
    const box = container.querySelector('[aria-label="Show resolved"]') as HTMLInputElement;
    await act(async () => {
      box.click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'GET' && call.url.includes('/picking/shortages') && !call.url.includes('resolution='))).toBe(true);
    expect(container.querySelector('[data-testid="shortage-resolution-8"]')?.textContent).toContain('Backorder 2');
    expect(container.querySelector('[data-testid="shortage-resolution-9"]')?.textContent).toContain('Credited 44');
    expect(container.querySelector('[data-testid="shortage-resolution-10"]')?.textContent).toContain('Ignored customer declined');
  });

  it('renders the delivered chip and the failed dispatch chip', async () => {
    authFetch.mockImplementation(async () => http({
      total: 2,
      items: [
        { id: 4, number: 'PK-000004', status: 'delivered', source_kind: 'invoice', delivered_at: '2026-10-24T15:00:00', has_failed_delivery: false, line_count: 1, picked_count: 1 },
        { id: 5, number: 'PK-000005', status: 'dispatched', source_kind: 'invoice', has_failed_delivery: true, line_count: 1, picked_count: 1 },
      ],
    }));
    await mount();
    const delivered = container.querySelector('[data-testid="pick-status-4"]') as HTMLElement;
    expect(delivered.textContent).toBe('Delivered');
    expect(delivered.style.backgroundColor).toBe('rgb(34, 197, 94)');
    expect(container.querySelector('[data-testid="pick-status-5"]')?.textContent).toBe('Dispatched · 1 failed');
  });

  it('filters the list with status delivered', async () => {
    await mount();
    const select = container.querySelector('[aria-label="Filter status"]') as HTMLSelectElement;
    await act(async () => {
      setValue(select, 'delivered');
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'GET' && call.url.includes('status=delivered'))).toBe(true);
  });
});
