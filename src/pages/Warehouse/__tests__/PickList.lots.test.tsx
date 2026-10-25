import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PickListPage from '../PickList';
import { getLocationsFlat } from '../../../services/stockLocationService';

const { authFetch, apiGet } = vi.hoisted(() => ({ authFetch: vi.fn(), apiGet: vi.fn() }));

vi.mock('../../../api/axios', () => ({ default: { get: apiGet }, authFetch, ACCESS_TOKEN_KEY: 'access_token' }));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'admin', role: 'admin' }, hasRole: (...roles: string[]) => roles.includes('admin') }),
}));
vi.mock('../../../services/vanService', () => ({ vanService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../../services/productService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/productService')>('../../../services/productService');
  return { ...actual, lookupProductByBarcode: vi.fn() };
});
vi.mock('../../../services/stockLocationService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/stockLocationService')>('../../../services/stockLocationService');
  return { ...actual, getLocationsFlat: vi.fn() };
});

function http(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body), json: async () => body };
}

const lotLine = {
  id: 31,
  sequence: 1,
  invoice_id: 8,
  invoice_number: 'INV-8',
  customer_name: 'Acme',
  product_id: 8,
  sku: 'LOT-OIL',
  name: 'Lot oil',
  location_id: 5,
  location_code: 'B-01',
  location_path: 'MAIN/A/B-01',
  qty_required: 8,
  qty_picked: 0,
  picked_location_id: null,
  status: 'open',
  note: null,
  lots: [
    { lot_id: 1, lot_number: 'A', expiry_date: '2026-11-14', qty: 5 },
    { lot_id: 2, lot_number: 'B', expiry_date: '2027-02-22', qty: 3 },
  ],
  lots_picked: null,
};

const detail = { id: 4, number: 'PK-000012', status: 'picking', source_kind: 'invoice', assigned_to: null, lines: [lotLine], shortages: [] };

function posts() {
  return authFetch.mock.calls
    .filter(([, init]) => String((init as RequestInit | undefined)?.method || 'GET').toUpperCase() === 'POST')
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));
}

describe('Pick screen lots', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    authFetch.mockReset();
    authFetch.mockImplementation(async () => http(detail));
    apiGet.mockResolvedValue({ data: [] });
    vi.mocked(getLocationsFlat).mockResolvedValue([]);
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
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  function pickAll(): HTMLButtonElement {
    return Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Pick all') as HTMLButtonElement;
  }

  it('shows the Take line and sends lots_picked prefilled from the preview', async () => {
    await mount();
    expect(container.querySelector('[data-testid="pick-lots-31"]')?.textContent).toBe('Take: A ×5 (exp 14 Nov), B ×3 (exp 22 Feb)');
    await act(async () => pickAll().click());
    await flush();
    const pick = posts().find((call) => call.url.endsWith('/lines/31/pick'));
    expect(pick?.body).toEqual({ qty: 8, lots_picked: [{ lot_id: 1, qty: 5 }, { lot_id: 2, qty: 3 }] });
  });

  it('refuses lot quantities that do not add up to the pick', async () => {
    await mount();
    const lotB = container.querySelector('[aria-label="Lot B qty for line 31"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(lotB, '2');
      lotB.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => pickAll().click());
    await flush();
    expect(container.textContent).toContain('Lot quantities must add up to 8');
    expect(posts().some((call) => call.url.endsWith('/lines/31/pick'))).toBe(false);
  });

  it('shows the backend detail when the pick is refused', async () => {
    authFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (String(init?.method || 'GET').toUpperCase() === 'POST') {
        return http({ detail: 'Lot 2 is not a lot of this product' }, 400);
      }
      return http(detail);
    });
    await mount();
    await act(async () => pickAll().click());
    await flush();
    expect(container.textContent).toContain('Lot 2 is not a lot of this product');
  });
});
