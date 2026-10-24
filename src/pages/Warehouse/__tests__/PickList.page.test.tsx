import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PickListPage from '../PickList';
import { lookupProductByBarcode } from '../../../services/productService';
import { getLocationsFlat } from '../../../services/stockLocationService';

const { authFetch, apiGet } = vi.hoisted(() => ({
  authFetch: vi.fn(),
  apiGet: vi.fn(),
}));

vi.mock('../../../api/axios', () => ({
  default: { get: apiGet },
  authFetch,
  ACCESS_TOKEN_KEY: 'access_token',
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

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
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
});
