import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GoodsReceivedForm from '../GoodsReceivedForm';
import * as grnService from '../../../services/grnService';
import * as productService from '../../../services/productService';
import * as stockLocationService from '../../../services/stockLocationService';

vi.mock('../../../services/grnService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/grnService')>();
  return {
    ...actual,
    getGRNById: vi.fn(),
    createGRNFromPO: vi.fn(),
    deleteGRN: vi.fn(),
    getPendingPurchaseOrders: vi.fn(),
  };
});
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn(), lookupProductByBarcode: vi.fn() }));
vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn(),
  suggestPutaway: vi.fn(),
  isStockHoldingKind: (kind: string) => kind === 'bin' || kind === 'warehouse' || kind === 'van',
}));
vi.mock('../../../store/authStore', () => ({ getCurrentUser: () => ({ username: 'tester', name: 'Test User' }) }));
vi.mock('../../../components/Inventory/PackQtyInput', () => ({ default: () => null, BarcodeScanField: () => null }));

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function product(id: string, sku: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: sku,
    sku,
    uom: 'qt',
    status: 'Active',
    category: 'Cat',
    description: '',
    locations: [],
    pricing: { purchasePriceExWorks: 1, freightShipping: 0, importDuty: 0, otherDirectCosts: 0, landedCost: 1, operatingExpenseAllocation: 0, sellingPrice: 2, taxRate: 0, taxIncluded: false },
    images: [],
    specifications: [],
    tags: [],
    ...extra,
  };
}

const PO = {
  id: 'PO-L',
  poNumber: 'PO-L',
  supplierId: '1',
  supplierName: 'Supplier',
  status: 'Approved',
  date: '2026-06-01',
  expectedDate: '2026-06-02',
  items: [
    { productId: '99', productName: 'Lot oil', quantity: 6, unitPrice: 4, uom: 'qt', taxRate: 0, discount: 0, total: 24 },
    { productId: '100', productName: 'Plain', quantity: 3, unitPrice: 4, uom: 'qt', taxRate: 0, discount: 0, total: 12 },
  ],
  grandTotal: 36,
};

function line(productId: string, name: string, sku: string, qty: number) {
  return { productId, productName: name, sku, uom: 'qt', orderedQty: qty, receivedQty: qty, acceptedQty: qty, rejectedQty: 0, unitCost: 4, totalCost: qty * 4 };
}

describe('GoodsReceivedForm lots', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(stockLocationService.getLocationsFlat).mockResolvedValue([
      { id: 1, code: 'MAIN', name: 'Main', kind: 'warehouse', vanId: null, isActive: true, parentId: null, path: 'MAIN', sortOrder: null, capacityUnits: null, barcode: null },
    ]);
    vi.mocked(productService.getProducts).mockResolvedValue([
      product('99', 'LOT-OIL', { lotTracked: true, expiryTracked: true, shelfLifeDays: 30 }),
      product('100', 'PLAIN-1'),
    ] as never);
    vi.mocked(grnService.getPendingPurchaseOrders).mockResolvedValue([PO] as never);
    localStorage.setItem('purchase_orders', JSON.stringify([PO]));
    vi.mocked(grnService.createGRNFromPO).mockImplementation(async () => {
      const draft = {
        id: 'GRN-L',
        grnNumber: 'GRN-L',
        poReference: 'PO-L',
        poId: 'PO-L',
        warehouse: 'Main Warehouse',
        receivedBy: 'tester',
        receivedDate: '2026-06-01',
        status: 'Draft' as const,
        items: [line('99', 'Lot oil', 'LOT-OIL', 6), line('100', 'Plain', 'PLAIN-1', 3)],
        goodsValue: 36,
        freightCost: 0,
        landedCost: 36,
        createdAt: '2026-06-01',
      };
      localStorage.setItem('grns', JSON.stringify([draft]));
      return draft;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/receiving/new']}>
          <Routes>
            <Route path="/receiving/new" element={<GoodsReceivedForm />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  function button(pattern: RegExp): HTMLButtonElement {
    const found = Array.from(container.querySelectorAll('button')).find((b) => pattern.test(b.textContent || ''));
    if (!found) throw new Error(`button ${pattern} missing`);
    return found as HTMLButtonElement;
  }

  function type(el: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function openDraft() {
    await render();
    await act(async () => {
      button(/adjust quantities before receiving/i).click();
      await Promise.resolve();
    });
  }

  it('requires a lot number for a tracked line and sends lotNumber/expiryDate', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('use local purchase_orders fallback'))
      .mockResolvedValueOnce(response({ lines_processed: 2, total_amount: 36 }))
      .mockResolvedValueOnce(response({ status: 'GRN' }));
    vi.stubGlobal('fetch', fetchMock);
    await openDraft();

    expect(container.querySelector('[data-testid="grn-lot-required"]')?.textContent).toBe('Lot number required for LOT-OIL');
    expect(button(/confirm goods received/i).disabled).toBe(true);
    expect(container.textContent).toContain('blank = received + 30 days shelf life');
    expect(container.querySelector('[aria-label="Lot number line 2"]')).toBeNull();

    await act(async () => type(container.querySelector('[aria-label="Lot number line 1"]') as HTMLInputElement, 'L-77'));
    await act(async () => type(container.querySelector('[aria-label="Expiry line 1"]') as HTMLInputElement, '2026-12-31'));
    expect(container.querySelector('[data-testid="grn-lot-required"]')).toBeNull();
    expect(button(/confirm goods received/i).disabled).toBe(false);

    await act(async () => {
      button(/confirm goods received/i).click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/grn-receive'));
    const body = JSON.parse(String((call?.[1] as RequestInit).body));
    expect(body.lines[0]).toMatchObject({ productId: 99, lotNumber: 'L-77', expiryDate: '2026-12-31' });
    expect(body.lines[1]).not.toHaveProperty('lotNumber');
    expect(body.lines[1]).not.toHaveProperty('expiryDate');
  });

  it('a tracked PO stops at the draft instead of posting', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('no network'));
    vi.stubGlobal('fetch', fetchMock);
    await render();
    await act(async () => {
      button(/confirm goods received/i).click();
      await Promise.resolve();
    });
    expect(grnService.createGRNFromPO).toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/grn-receive'))).toBe(false);
    expect(container.querySelector('[aria-label="Lot number line 1"]')).not.toBeNull();
  });

  it('shows the backend 400 detail inline', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('use local purchase_orders fallback'))
      .mockResolvedValueOnce(response({ detail: 'Lot L-77 of LOT-OIL (LOT-OIL) already has expiry 2026-11-30' }, 400));
    vi.stubGlobal('fetch', fetchMock);
    await openDraft();
    await act(async () => type(container.querySelector('[aria-label="Lot number line 1"]') as HTMLInputElement, 'L-77'));
    await act(async () => {
      button(/confirm goods received/i).click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="grn-post-error"]')?.textContent).toContain('already has expiry 2026-11-30');
  });
});
