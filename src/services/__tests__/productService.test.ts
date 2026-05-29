import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveProduct, getProducts } from '../productService';

/** Minimal fetch-response-like object */
function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** Bare-minimum Partial<Product> fixture for saveProduct calls */
function productFixture(overrides: {
  id?: string;
  locations: { id: string; name: string; type: 'Warehouse' | 'Van' | 'Store' | 'Retail'; currentStock: number }[];
}) {
  return {
    id: overrides.id ?? '',
    name: 'Test Oil',
    sku: 'OIL-TEST',
    category: 'Lubricants',
    description: '',
    status: 'Active' as const,
    uom: 'pcs',
    locations: overrides.locations,
    pricing: {
      purchasePriceExWorks: 0,
      freightShipping: 0,
      importDuty: 0,
      otherDirectCosts: 0,
      landedCost: 5,
      operatingExpenseAllocation: 0,
      sellingPrice: 10,
      taxRate: 0,
      taxIncluded: false,
    },
  };
}

describe('productService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ──────────────────────────────────────────────
  // TEST 1 — stock sum (the "100 became 19" bug)
  // ──────────────────────────────────────────────
  it('TEST 1: sums stock across multiple locations before sending to backend', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResp(true, 200, { id: 1, stock: 100, is_active: true }));
    vi.stubGlobal('fetch', fetchMock);

    await saveProduct(
      productFixture({
        locations: [
          { id: 'L1', name: 'Warehouse', type: 'Warehouse', currentStock: 30 },
          { id: 'L2', name: 'Van',       type: 'Van',       currentStock: 70 },
        ],
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stock).toBe(100);
  });

  // ──────────────────────────────────────────────
  // TEST 2 — single location passes through cleanly
  // ──────────────────────────────────────────────
  it('TEST 2: single location currentStock 100 → body.stock === 100', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResp(true, 200, { id: 2, stock: 100, is_active: true }));
    vi.stubGlobal('fetch', fetchMock);

    await saveProduct(
      productFixture({
        locations: [{ id: 'L1', name: 'Warehouse', type: 'Warehouse', currentStock: 100 }],
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.stock).toBe(100);
  });

  // ──────────────────────────────────────────────
  // TEST 3 — upsert on 404 (ghost self-heal)
  // ──────────────────────────────────────────────
  it('TEST 3: PUT 404 promotes to POST on products/', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
        json: () => Promise.resolve({}),
      })
      .mockResolvedValueOnce(mockResp(true, 200, { id: 5, stock: 10, is_active: true }));
    vi.stubGlobal('fetch', fetchMock);

    await saveProduct(
      productFixture({
        id: 'ghost-old-id',
        locations: [{ id: 'L1', name: 'Warehouse', type: 'Warehouse', currentStock: 10 }],
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondInit.method).toBe('POST');
    expect(secondUrl).toMatch(/products\/$/);
  });

  // ──────────────────────────────────────────────
  // TEST 4 — catalog = backend only (no localStorage ghosts)
  // ──────────────────────────────────────────────
  it('TEST 4: getProducts returns only backend rows, ignores localStorage ghost', async () => {
    localStorage.setItem(
      'zavi_products',
      JSON.stringify([{ id: 'ghost-1', name: 'Ghost Product', sku: 'GHOST' }]),
    );

    const backendRow = {
      id: 99,
      name: 'Real Backend Product',
      sku: 'REAL-001',
      category: 'Lubricants',
      description: 'From backend',
      stock: 50,
      price: 20,
      cost: 10,
      unit: 'pcs',
      is_active: true,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResp(true, 200, [backendRow])));

    const products = await getProducts();

    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Real Backend Product');
    expect(products.find((p) => p.id === 'ghost-1')).toBeUndefined();
  });

  // ──────────────────────────────────────────────
  // TEST 5 — no stale fallback on fetch failure
  // ──────────────────────────────────────────────
  it('TEST 5: fetch failure returns [] — never falls back to localStorage ghosts', async () => {
    localStorage.setItem(
      'zavi_products',
      JSON.stringify([{ id: 'ghost-1', name: 'Ghost Product', sku: 'GHOST' }]),
    );

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network Error')));

    const products = await getProducts();
    expect(products).toEqual([]);
  });

  it('round-trips backend cost through the ProductForm cost-bound pricing field', async () => {
    const backendRow = {
      id: 100,
      name: 'Cost Round Trip Product',
      sku: 'COST-RT',
      category: 'Lubricants',
      description: 'Cost should reopen in the Cost input',
      stock: 5,
      min_stock: 1,
      price: 30,
      cost: 10,
      unit: 'pcs',
      is_active: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResp(true, 200, [backendRow]))
      .mockResolvedValueOnce(mockResp(true, 200, { id: 100, stock: 5, is_active: true }));
    vi.stubGlobal('fetch', fetchMock);

    const [loadedProduct] = await getProducts();
    expect(loadedProduct.pricing.purchasePriceExWorks).toBe(10);
    expect(loadedProduct.pricing.sellingPrice).toBe(30);

    await saveProduct(loadedProduct);

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.cost).toBe(10);
    expect(body.price).toBe(30);
  });

  it('includes the primary product image in the backend payload when set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResp(true, 200, { id: 101, stock: 1, is_active: true }));
    vi.stubGlobal('fetch', fetchMock);

    await saveProduct({
      ...productFixture({
        locations: [{ id: 'L1', name: 'Warehouse', type: 'Warehouse', currentStock: 1 }],
      }),
      images: [
        { id: 'secondary', url: 'data:image/jpeg;base64,secondary', isPrimary: false },
        { id: 'primary', url: 'data:image/jpeg;base64,primary', isPrimary: true },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.image).toBe('data:image/jpeg;base64,primary');
  });
});
