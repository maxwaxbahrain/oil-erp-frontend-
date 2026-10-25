import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import GoodsReceivedForm from '../GoodsReceivedForm';
import * as grnService from '../../../services/grnService';
import * as productService from '../../../services/productService';
import * as stockLocationService from '../../../services/stockLocationService';

function okResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

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

vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
  lookupProductByBarcode: vi.fn(),
}));

vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn(),
  suggestPutaway: vi.fn(),
  isStockHoldingKind: (kind: string) => kind === 'bin' || kind === 'warehouse' || kind === 'van',
}));

vi.mock('../../../store/authStore', () => ({
  getCurrentUser: () => ({ username: 'tester', name: 'Test User' }),
}));

vi.mock('../../../components/Inventory/PackQtyInput', () => ({
  default: () => null,
  BarcodeScanField: () => null,
}));

describe('GoodsReceivedForm location', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.mocked(stockLocationService.getLocationsFlat).mockResolvedValue([
      {
        id: 1,
        code: 'MAIN',
        name: 'Main',
        kind: 'warehouse',
        vanId: null,
        isActive: true,
        parentId: null,
        path: 'MAIN',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
      },
      {
        id: 5,
        code: 'B-DEF',
        name: 'Default bin',
        kind: 'bin',
        vanId: null,
        isActive: true,
        parentId: 1,
        path: 'MAIN/B-DEF',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
      },
    ]);
    vi.mocked(productService.getProducts).mockResolvedValue([
      {
        id: '99',
        name: 'With default',
        sku: 'DEF-1',
        defaultLocationId: 5,
        uom: 'qt',
        status: 'Active',
        category: 'Cat',
        description: '',
        locations: [],
        pricing: { purchasePriceExWorks: 1, freightShipping: 0, importDuty: 0, otherDirectCosts: 0, landedCost: 1, operatingExpenseAllocation: 0, sellingPrice: 2, taxRate: 0, taxIncluded: false },
        images: [],
        specifications: [],
        tags: [],
        seo: { metaTitle: '', metaDescription: '', keywords: '' },
        velocityStatus: 'Medium',
        salesVelocity: 0,
        salesTrend: 0,
        revenueContribution: 0,
        grossMarginPercent: 0,
        netProfitPerUnit: 0,
        avgDailySales: 0,
        daysStockRemaining: 0,
        reorderLevel: 0,
        overstockRisk: 'Low',
        priceHistory: [],
        aiEnabled: false,
        aiDemandPrediction: 0,
        aiConfidenceLevel: 0,
      },
      {
        id: '100',
        name: 'Plain',
        sku: 'PLAIN-1',
        uom: 'qt',
        status: 'Active',
        category: 'Cat',
        description: '',
        locations: [],
        pricing: { purchasePriceExWorks: 1, freightShipping: 0, importDuty: 0, otherDirectCosts: 0, landedCost: 1, operatingExpenseAllocation: 0, sellingPrice: 2, taxRate: 0, taxIncluded: false },
        images: [],
        specifications: [],
        tags: [],
        seo: { metaTitle: '', metaDescription: '', keywords: '' },
        velocityStatus: 'Medium',
        salesVelocity: 0,
        salesTrend: 0,
        revenueContribution: 0,
        grossMarginPercent: 0,
        netProfitPerUnit: 0,
        avgDailySales: 0,
        daysStockRemaining: 0,
        reorderLevel: 0,
        overstockRisk: 'Low',
        priceHistory: [],
        aiEnabled: false,
        aiDemandPrediction: 0,
        aiConfidenceLevel: 0,
      },
    ] as never);
    vi.mocked(grnService.getPendingPurchaseOrders).mockResolvedValue([
      {
        id: 'PO-1',
        poNumber: 'PO-1',
        supplierId: '1',
        supplierName: 'Supplier',
        status: 'Approved',
        date: '2026-06-01',
        expectedDate: '2026-06-02',
        items: [
          { productId: '99', productName: 'With default', quantity: 6, unitPrice: 4, uom: 'qt', taxRate: 0, discount: 0, total: 24 },
          { productId: '100', productName: 'Plain', quantity: 3, unitPrice: 4, uom: 'qt', taxRate: 0, discount: 0, total: 12 },
        ],
        grandTotal: 36,
      },
    ] as never);
    localStorage.setItem(
      'purchase_orders',
      JSON.stringify([
        {
          id: 'PO-1',
          poNumber: 'PO-1',
          supplierId: '1',
          supplierName: 'Supplier',
          status: 'Approved',
          date: '2026-06-01',
          expectedDate: '2026-06-02',
          items: [
            { productId: '99', productName: 'With default', quantity: 6, unitPrice: 4, uom: 'qt', taxRate: 0, discount: 0, total: 24 },
            { productId: '100', productName: 'Plain', quantity: 3, unitPrice: 4, uom: 'qt', taxRate: 0, discount: 0, total: 12 },
          ],
          grandTotal: 36,
        },
      ]),
    );
    vi.mocked(grnService.createGRNFromPO).mockImplementation(async () => {
      const draft = {
        id: 'GRN-1',
        grnNumber: 'GRN-1',
        poReference: 'PO-1',
        poId: 'PO-1',
        warehouse: 'Main Warehouse',
        receivedBy: 'tester',
        receivedDate: '2026-06-01',
        status: 'Draft' as const,
        items: [
          {
            productId: '99',
            productName: 'With default',
            sku: 'DEF-1',
            uom: 'qt',
            orderedQty: 6,
            receivedQty: 6,
            acceptedQty: 6,
            rejectedQty: 0,
            unitCost: 4,
            totalCost: 24,
          },
          {
            productId: '100',
            productName: 'Plain',
            sku: 'PLAIN-1',
            uom: 'qt',
            orderedQty: 3,
            receivedQty: 3,
            acceptedQty: 3,
            rejectedQty: 0,
            unitCost: 4,
            totalCost: 12,
          },
        ],
        goodsValue: 36,
        freightCost: 0,
        landedCost: 36,
        createdAt: '2026-06-01',
      };
      localStorage.setItem('grns', JSON.stringify([draft]));
      return draft;
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('use local purchase_orders fallback'))
      .mockResolvedValueOnce(okResponse({ lines_processed: 2, total_amount: 36 }))
      .mockResolvedValueOnce(okResponse({ status: 'GRN' }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('defaults line location from product and posts location_id on grn-receive', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
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

    const adjustBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /adjust quantities before receiving/i.test(b.textContent || ''),
    );
    expect(adjustBtn).toBeTruthy();
    await act(async () => {
      adjustBtn!.click();
      await Promise.resolve();
    });

    const loc0 = container.querySelector('[aria-label="Location for line 1"]') as HTMLSelectElement;
    const loc1 = container.querySelector('[aria-label="Location for line 2"]') as HTMLSelectElement;
    expect(loc0?.value).toBe('5');
    expect(loc1?.value).toBe('1');

    const confirmBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /confirm goods received/i.test(b.textContent || ''),
    );
    expect(confirmBtn).toBeTruthy();
    await act(async () => {
      confirmBtn!.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    const grnReceiveCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/grn-receive'));
    expect(grnReceiveCall).toBeTruthy();
    const body = JSON.parse(String((grnReceiveCall?.[1] as RequestInit).body));
    expect(body.lines[0]).toMatchObject({ productId: 99, location_id: 5 });
    expect(body.lines[1]).toMatchObject({ productId: 100, location_id: 1 });
    expect(body.lines[0]).not.toHaveProperty('locationId');
    expect(body.lines[1]).not.toHaveProperty('locationId');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('Suggest sets location and caption from putaway API', async () => {
    vi.mocked(stockLocationService.suggestPutaway).mockResolvedValue({
      locationId: 5,
      code: 'B-DEF',
      path: 'MAIN/B-DEF',
      reason: 'default_bin',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
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
    const adjustBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /adjust quantities before receiving/i.test(b.textContent || ''),
    );
    await act(async () => {
      adjustBtn!.click();
      await Promise.resolve();
    });
    const suggestBtn = container.querySelector('[aria-label="Suggest location line 2"]') as HTMLButtonElement;
    await act(async () => {
      suggestBtn.click();
      await Promise.resolve();
    });
    expect(stockLocationService.suggestPutaway).toHaveBeenCalledWith(100, 3);
    const loc1 = container.querySelector('[aria-label="Location for line 2"]') as HTMLSelectElement;
    expect(loc1.value).toBe('5');
    expect(container.querySelector('[data-testid="putaway-caption-1"]')?.textContent).toBe('default bin');
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('Suggest all skips a line the user already changed', async () => {
    vi.mocked(stockLocationService.suggestPutaway).mockResolvedValue({
      locationId: 5,
      code: 'B-DEF',
      path: 'MAIN/B-DEF',
      reason: 'free capacity',
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
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
    const adjustBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /adjust quantities before receiving/i.test(b.textContent || ''),
    );
    await act(async () => {
      adjustBtn!.click();
      await Promise.resolve();
    });
    vi.mocked(stockLocationService.suggestPutaway).mockClear();
    const loc1 = container.querySelector('[aria-label="Location for line 2"]') as HTMLSelectElement;
    const prototype = HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    await act(() => {
      setter?.call(loc1, '5');
      loc1.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const suggestAll = container.querySelector('[aria-label="Suggest all locations"]') as HTMLButtonElement;
    await act(async () => {
      suggestAll.click();
      await Promise.resolve();
    });
    expect(stockLocationService.suggestPutaway).toHaveBeenCalledTimes(1);
    expect(stockLocationService.suggestPutaway).toHaveBeenCalledWith(99, 6);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
