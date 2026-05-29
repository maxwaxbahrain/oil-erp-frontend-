import { beforeEach, describe, expect, it, vi } from 'vitest';

import { postGRN } from '../grnService';
import { confirmGRN, type PurchaseOrder } from '../purchasesService';

function okResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

const po: PurchaseOrder = {
  id: 'PO-URL-1',
  poNumber: 'PO-URL-1',
  supplierId: 'SUP-1',
  supplierName: 'Test Supplier',
  date: '2026-05-29',
  expectedDate: '2026-05-30',
  status: 'Approved',
  items: [
    {
      productId: '123',
      productName: 'Test Product',
      uom: 'pcs',
      quantity: 50,
      unitPrice: 10,
      taxRate: 0,
      discount: 0,
      total: 500,
    },
  ],
  subtotal: 500,
  taxTotal: 0,
  grandTotal: 500,
};

function findAddStockUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  const urls = fetchMock.mock.calls.map(([url]) => String(url));
  const addStockUrl = urls.find((url) => url.includes('/add-stock'));
  expect(addStockUrl).toBeTruthy();
  return addStockUrl as string;
}

describe('receive stock add-stock URLs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('confirmGRN uses the /api products add-stock URL', async () => {
    localStorage.setItem('purchase_orders', JSON.stringify([po]));
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('use local purchase_orders fallback'))
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(okResponse({ ...po, status: 'GRN' }));
    vi.stubGlobal('fetch', fetchMock);

    await confirmGRN(po.id);

    const addStockUrl = findAddStockUrl(fetchMock);
    expect(addStockUrl).toContain('/api/products/');
    expect(addStockUrl).toMatch(/\/add-stock$/);
  });

  it('postGRN uses the /api products add-stock URL', async () => {
    localStorage.setItem('purchase_orders', JSON.stringify([{ ...po, status: 'Pending' }]));
    localStorage.setItem(
      'grns',
      JSON.stringify([
        {
          id: 'GRN-URL-1',
          grnNumber: 'GRN-URL-1',
          poReference: po.poNumber,
          poId: po.id,
          warehouse: 'Main Warehouse',
          receivedBy: 'Tester',
          receivedDate: '2026-05-29',
          status: 'Draft',
          items: [
            {
              productId: '123',
              productName: 'Test Product',
              sku: 'TEST-123',
              uom: 'pcs',
              orderedQty: 50,
              receivedQty: 50,
              acceptedQty: 50,
              rejectedQty: 0,
              unitCost: 10,
              totalCost: 500,
            },
          ],
          goodsValue: 500,
          freightCost: 0,
          landedCost: 500,
          createdAt: '2026-05-29T00:00:00.000Z',
        },
      ]),
    );
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('use local purchase_orders fallback'))
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(okResponse({ ...po, status: 'GRN' }));
    vi.stubGlobal('fetch', fetchMock);

    await postGRN('GRN-URL-1');

    const addStockUrl = findAddStockUrl(fetchMock);
    expect(addStockUrl).toContain('/api/products/');
    expect(addStockUrl).toMatch(/\/add-stock$/);
  });
});
