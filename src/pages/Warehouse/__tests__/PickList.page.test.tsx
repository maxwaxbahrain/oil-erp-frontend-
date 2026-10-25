import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PickListPage from '../PickList';
import * as api from '../../../services/api';
import { lookupProductByBarcode } from '../../../services/productService';
import { getLocationsFlat } from '../../../services/stockLocationService';
import { vanService } from '../../../services/vanService';

const { authFetch, apiGet } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('../../../api/axios', () => ({
  default: { get: apiGet },
  authFetch,
  ACCESS_TOKEN_KEY: 'access_token',
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'admin', full_name: 'Admin', role: 'admin' },
    hasRole: (...roles: string[]) => roles.includes('admin'),
  }),
}));

vi.mock('../../../services/vanService', () => ({
  vanService: { getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../../services/productService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/productService')>('../../../services/productService');
  return { ...actual, lookupProductByBarcode: vi.fn() };
});

vi.mock('../../../services/stockLocationService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/stockLocationService')>('../../../services/stockLocationService');
  return { ...actual, getLocationsFlat: vi.fn() };
});

function http(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

function line(partial: Record<string, unknown>) {
  return {
    invoice_id: 8,
    invoice_number: 'INV-8',
    customer_name: 'Acme',
    qty_picked: 0,
    picked_location_id: null,
    note: null,
    ...partial,
  };
}

const openLines = [
  line({
    id: 22,
    sequence: 2,
    product_id: 8,
    sku: 'OIL',
    name: 'Drum oil',
    location_id: 5,
    location_code: 'B-01',
    location_path: 'MAIN/A/B-01',
    qty_required: 4,
    status: 'open',
  }),
  line({
    id: 11,
    sequence: 1,
    product_id: 9,
    sku: 'SOAP',
    name: 'Soap',
    location_id: 1,
    location_code: 'MAIN',
    location_path: 'MAIN',
    qty_required: 12,
    status: 'open',
  }),
];

function detail(status: string, lines: Record<string, unknown>[]) {
  return {
    id: 4,
    number: 'PK-000012',
    status,
    source_kind: 'invoice',
    assigned_to: null,
    lines,
    shortages: [],
  };
}

let current = detail('picking', openLines);

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

function buttonIn(root: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll('button')).find((node) => node.textContent?.includes(label));
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

describe('Pick list screen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    current = detail('picking', openLines);
    authFetch.mockReset();
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'POST' && String(url).endsWith('/complete')) {
        return http({
          ...current,
          status: 'picked',
          shortages: [{ invoice_id: 8, product_id: 8, required: 4, picked: 2 }],
        });
      }
      if (method === 'POST' && String(url).endsWith('/release')) {
        return http({ ...current, status: 'released' });
      }
      return http(current);
    });
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: [] });
    vi.mocked(lookupProductByBarcode).mockReset();
    vi.mocked(lookupProductByBarcode).mockRejectedValue(new Error('unknown barcode'));
    vi.mocked(getLocationsFlat).mockReset();
    vi.mocked(getLocationsFlat).mockResolvedValue([
      { id: 1, code: 'MAIN', name: 'Main', kind: 'warehouse', vanId: null, isActive: true, parentId: null, path: 'MAIN', sortOrder: null, capacityUnits: null, barcode: null },
      { id: 5, code: 'B-01', name: 'Bin', kind: 'bin', vanId: null, isActive: true, parentId: 1, path: 'MAIN/A/B-01', sortOrder: null, capacityUnits: null, barcode: null },
      { id: 6, code: 'OLD', name: 'Old', kind: 'bin', vanId: null, isActive: false, parentId: 1, path: 'OLD', sortOrder: null, capacityUnits: null, barcode: null },
    ]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
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
        <MemoryRouter initialEntries={['/warehouse/picking/4']}>
          <Routes>
            <Route path="/warehouse/picking/:id" element={<PickListPage />} />
            <Route path="/warehouse/picking" element={<div>board</div>} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('renders lines in sequence order', async () => {
    await mount();
    const cards = container.querySelectorAll('[data-testid^="pick-line-"]');
    expect(Array.from(cards).map((card) => card.getAttribute('data-testid'))).toEqual(['pick-line-11', 'pick-line-22']);
    expect(container.textContent).toContain('Soap');
    expect(container.textContent).toContain('Drum oil');
    const qty = container.querySelector('[aria-label="Qty for line 11"]') as HTMLInputElement;
    expect(qty.value).toBe('12');
  });

  it('posts Pick all with the required qty', async () => {
    await mount();
    const card = container.querySelector('[data-testid="pick-line-11"]') as HTMLElement;
    await act(async () => {
      buttonIn(card, 'Pick all').click();
      await Promise.resolve();
    });
    await flush();
    const post = calls().find((call) => call.url.endsWith('/lines/11/pick'));
    expect(post?.body).toEqual({ qty: 12 });
  });

  it('posts a short qty and note', async () => {
    await mount();
    const card = container.querySelector('[data-testid="pick-line-22"]') as HTMLElement;
    await act(() => {
      buttonIn(card, 'Short…').click();
    });
    const qty = card.querySelector('[aria-label="Qty for line 22"]') as HTMLInputElement;
    const note = card.querySelector('[aria-label="Short note 22"]') as HTMLInputElement;
    await act(() => {
      setValue(qty, '2');
      setValue(note, 'low');
    });
    await act(async () => {
      buttonIn(card, 'Save short').click();
      await Promise.resolve();
    });
    await flush();
    const post = calls().find((call) => call.url.endsWith('/lines/22/pick'));
    expect(post?.body).toEqual({ qty: 2, note: 'low' });
  });

  it('blocks skip without a note', async () => {
    await mount();
    const card = container.querySelector('[data-testid="pick-line-11"]') as HTMLElement;
    await act(() => {
      buttonIn(card, 'Skip').click();
    });
    expect(card.textContent).toContain('A note is required to skip');
    expect(calls().some((call) => call.method === 'POST' && call.url.includes('/lines/'))).toBe(false);
  });

  it('posts picked_location_id for another bin', async () => {
    await mount();
    const card = container.querySelector('[data-testid="pick-line-11"]') as HTMLElement;
    await act(() => {
      buttonIn(card, 'Picked from another bin').click();
    });
    const select = card.querySelector('[aria-label="Picked from location 11"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', '1', '5']);
    await act(async () => {
      setValue(select, '5');
      await Promise.resolve();
    });
    await flush();
    const post = calls().find((call) => call.url.endsWith('/lines/11/pick'));
    expect(post?.body).toEqual({ qty: 12, picked_location_id: 5 });
  });

  it('focuses the first open line for a scanned barcode', async () => {
    vi.mocked(lookupProductByBarcode).mockResolvedValue({
      product: { id: '8', name: 'Drum oil', sku: 'OIL', category: '' } as never,
      matchedPackQty: null,
    });
    await mount();
    const input = container.querySelector('[aria-label="Scan barcode"]') as HTMLInputElement;
    await act(() => {
      setValue(input, 'ABC');
    });
    await act(async () => {
      buttonIn(container, 'Scan').click();
      await Promise.resolve();
    });
    await flush();
    expect(document.activeElement?.id).toBe('pick-qty-22');
    expect(container.textContent).not.toContain('not on this list');
  });

  it('says not on this list for an unknown barcode', async () => {
    await mount();
    const input = container.querySelector('[aria-label="Scan barcode"]') as HTMLInputElement;
    await act(() => {
      setValue(input, 'ZZZ');
    });
    await act(async () => {
      buttonIn(container, 'Scan').click();
      await Promise.resolve();
    });
    await flush();
    expect(container.querySelector('[data-testid="scan-error"]')?.textContent).toBe('not on this list');
  });

  it('completes and shows shortages', async () => {
    current = detail('picking', [
      line({ id: 11, sequence: 1, product_id: 9, sku: 'SOAP', name: 'Soap', location_id: 1, location_code: 'MAIN', location_path: 'MAIN', qty_required: 12, qty_picked: 12, status: 'picked' }),
      line({ id: 22, sequence: 2, product_id: 8, sku: 'OIL', name: 'Drum oil', location_id: 5, location_code: 'B-01', location_path: 'MAIN/A/B-01', qty_required: 4, qty_picked: 2, status: 'short' }),
    ]);
    await mount();
    const complete = buttonIn(container, 'Complete') as HTMLButtonElement;
    expect(complete.disabled).toBe(false);
    await act(async () => {
      complete.click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/complete'))).toBe(true);
    expect(container.querySelector('[aria-label="Shortages"]')?.textContent).toContain('required 4, picked 2');
  });

  it('releases a draft from the pick screen', async () => {
    current = detail('draft', openLines);
    await mount();
    await act(async () => {
      buttonIn(container, 'Release').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/pick-lists/4/release'))).toBe(true);
  });

  it('shows Dispatch on a picked list', async () => {
    current = detail('picked', openLines);
    await mount();
    expect(container.textContent).toContain('Dispatch…');
    expect(container.querySelector('[data-testid="dispatch-summary"]')).toBeNull();
  });

  it('shows manifest info on a dispatched list', async () => {
    current = {
      ...detail('dispatched', openLines),
      manifest_number: 'MF-000012',
      van_id: 'van-9',
      driver_id: 2,
    };
    apiGet.mockResolvedValue({ data: [{ id: 2, username: 'wren', full_name: 'Wren', role: 'warehouse' }] });
    vi.mocked(vanService.getAll).mockResolvedValue([
      { id: 'van-9', van_number: 'VAN-9', driver_name: 'Dee', vehicle_number: 'PLT-9', status: 'active' },
    ]);
    await mount();
    const summary = container.querySelector('[data-testid="dispatch-summary"]');
    expect(summary?.textContent).toContain('MF-000012');
    expect(summary?.textContent).toContain('VAN-9');
    expect(summary?.textContent).toContain('Wren');
    expect(buttonIn(summary as HTMLElement, 'Manifest')).toBeTruthy();
    expect(container.textContent).not.toContain('Dispatch…');
  });

  const shortageRow = {
    id: 7,
    pick_list_id: 4,
    pick_list_line_id: 22,
    pick_list_number: 'PK-000012',
    invoice_id: 8,
    invoice_number: 'INV-8',
    customer_name: 'Acme',
    product_id: 8,
    sku: 'OIL',
    product_name: 'Drum oil',
    qty_short: 2,
    resolution: 'open',
    sales_return_id: null,
    note: null,
  };

  it('resolves a shortage from the complete modal', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(api, 'getInvoiceById').mockResolvedValue({
      id: '8',
      invoiceNumber: 'INV-8',
      customerId: '1',
      customerName: 'Acme',
      invoiceDate: '2026-10-24',
      dueDate: '2026-10-24',
      lineItems: [{ product: 'Drum oil', description: '', quantity: 4, rate: 9, amount: 36, productId: '8' }],
      subtotal: 36,
      taxRate: 0,
      taxAmount: 0,
      discount: 0,
      grandTotal: 36,
      notes: '',
      status: 'Unpaid',
      createdAt: '2026-10-24T00:00:00',
    });
    current = detail('picking', [
      line({ id: 11, sequence: 1, product_id: 9, sku: 'SOAP', name: 'Soap', location_id: 1, location_code: 'MAIN', location_path: 'MAIN', qty_required: 12, qty_picked: 12, status: 'picked' }),
      line({ id: 22, sequence: 2, product_id: 8, sku: 'OIL', name: 'Drum oil', location_id: 5, location_code: 'B-01', location_path: 'MAIN/A/B-01', qty_required: 4, qty_picked: 2, status: 'short' }),
    ]);
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = String(init?.method || 'GET').toUpperCase();
      const text = String(url);
      if (method === 'POST' && text.includes('/shortages/') && text.endsWith('/resolve')) {
        const payload = JSON.parse(String(init?.body || '{}')) as { mode?: string; note?: string };
        return http({
          ...shortageRow,
          resolution: payload.mode,
          note: payload.note ?? null,
          sales_return_id: payload.mode === 'credited' ? 44 : null,
        });
      }
      if (method === 'GET' && text.endsWith('/shortages')) return http([shortageRow]);
      if (method === 'POST' && text.endsWith('/complete')) {
        return http({
          ...current,
          status: 'picked',
          shortages: [{ invoice_id: 8, product_id: 8, required: 4, picked: 2 }],
        });
      }
      return http(current);
    });
    await mount();
    await act(async () => {
      buttonIn(container, 'Complete').click();
      await Promise.resolve();
    });
    await flush();
    const modal = container.querySelector('[aria-label="Shortages"]') as HTMLElement;
    expect(modal.textContent).toContain('required 4, picked 2');
    await act(async () => {
      buttonIn(modal, 'Backorder').click();
      await Promise.resolve();
    });
    await flush();
    expect(confirm).toHaveBeenCalled();
    expect(calls().some((call) => call.method === 'POST' && call.url.endsWith('/shortages/7/resolve') && call.body?.mode === 'backorder')).toBe(true);

    await act(async () => {
      buttonIn(modal, 'Credit customer').click();
      await Promise.resolve();
    });
    await flush();
    const credit = modal.querySelector('[aria-label="Credit customer"]') as HTMLElement;
    expect(credit.textContent).toContain('Qty short 2');
    expect(credit.textContent).toContain('Unit price 9');
    expect(credit.querySelector('[data-testid="credit-preview"]')?.textContent).toBe('Preview ≈ 2 × 9');
    await act(async () => {
      buttonIn(credit, 'Confirm credit').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.body?.mode === 'credited')).toBe(true);
    expect(credit.textContent).toContain('Sales return 44');

    await act(() => {
      buttonIn(modal, 'Ignore').click();
    });
    const ignore = modal.querySelector('[aria-label="Ignore shortage"]') as HTMLElement;
    await act(async () => {
      buttonIn(ignore, 'Confirm ignore').click();
      await Promise.resolve();
    });
    expect(ignore.textContent).toContain('A note is required');
    await act(() => {
      setValue(ignore.querySelector('[aria-label="Ignore note"]') as HTMLTextAreaElement, 'left on the dock');
    });
    await act(async () => {
      buttonIn(ignore, 'Confirm ignore').click();
      await Promise.resolve();
    });
    await flush();
    expect(calls().some((call) => call.body?.mode === 'ignored' && call.body?.note === 'left on the dock')).toBe(true);
    expect(buttonIn(modal, 'Later')).toBeTruthy();
  });

  it('shows the delivered date in the footer', async () => {
    current = {
      ...detail('delivered', openLines),
      delivered_at: '2026-10-24T15:04:00',
      has_failed_delivery: false,
    };
    await mount();
    expect(container.querySelector('[data-testid="delivered-footer"]')?.textContent).toBe('Delivered 2026-10-24');
    expect(container.textContent).not.toContain('Complete');
  });

  it('shows a failed stop on the pick screen', async () => {
    current = {
      ...detail('dispatched', openLines),
      has_failed_delivery: true,
      manifest_number: 'MF-000012',
    };
    await mount();
    const failed = container.querySelector('[data-testid="failed-stop"]') as HTMLElement;
    expect(failed.textContent).toBe('A stop failed — see deliveries');
    expect(failed.style.color).toBe('rgb(239, 68, 68)');
  });
});
