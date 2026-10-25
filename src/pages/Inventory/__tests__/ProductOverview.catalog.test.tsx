import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductOverview from '../ProductOverview';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
  getProductById: vi.fn(),
  getProducts: vi.fn(),
  saveProduct: vi.fn(),
  getAIInsights: vi.fn(),
  formatPack: (packQty?: number | null, packUnit?: string | null) => {
    if (packQty == null || !(Number(packQty) > 0)) return null;
    return packUnit ? `${packQty} x ${packUnit}` : String(packQty);
  },
}));

vi.mock('../../../services/purchasesService', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('../../../services/inventoryLedgerService', () => ({
  getProductOnHand: vi.fn(),
  getMovements: vi.fn(),
}));

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => String(n),
}));

const { authState } = vi.hoisted(() => ({ authState: { role: 'admin' } }));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasRole: (...roles: string[]) => roles.includes(authState.role) }),
}));

function overviewProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '9',
    name: 'Case Oil',
    sku: 'RT-OIL',
    barcode: 'PRI-OIL',
    category: 'Legacy Cat',
    categoryName: 'Lubricants',
    brand: 'Mobil',
    baseUnit: 'qt',
    packQty: 12,
    packUnit: 'case',
    reorderPoint: 12,
    reorderQty: 30,
    maxStock: 0,
    status: 'Active',
    description: '',
    uom: 'qt',
    velocityStatus: 'Medium',
    salesVelocity: 0,
    salesTrend: 0,
    revenueContribution: 0,
    grossMarginPercent: 0,
    netProfitPerUnit: 0,
    locations: [{ id: 'L', name: 'Main', type: 'Warehouse', currentStock: 4 }],
    avgDailySales: 0,
    daysStockRemaining: 0,
    reorderLevel: 0,
    overstockRisk: 'Low',
    pricing: {
      purchasePriceExWorks: 4,
      freightShipping: 0,
      importDuty: 0,
      otherDirectCosts: 0,
      landedCost: 4,
      operatingExpenseAllocation: 0,
      sellingPrice: 9,
      taxRate: 0,
      taxIncluded: false,
    },
    priceHistory: [],
    images: [],
    aiEnabled: false,
    aiDemandPrediction: 0,
    aiConfidenceLevel: 0,
    leadTimeDays: 7,
    minOrderQty: 0,
    specifications: [],
    tags: [],
    seo: { metaTitle: '', metaDescription: '', keywords: '' },
    leakageRate: 0,
    returnRate: 0,
    preferredSupplierId: 5,
    barcodes: [
      { barcode: 'PRI-OIL', packQty: null, isPrimary: true },
      { barcode: '1111111111111', packQty: 6, isPrimary: false },
    ],
    isDiscontinued: true,
    ...overrides,
  };
}

describe('Product overview catalog reads', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(productService.getProductById).mockResolvedValue(overviewProduct());
    vi.mocked(productService.getProducts).mockResolvedValue([]);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([
      { id: '5', name: 'Acme Lubes' } as never,
    ]);
    vi.mocked(inventoryLedgerService.getProductOnHand).mockResolvedValue({
      onHand: 10,
      byLocation: [
        { locationId: 1, code: 'MAIN', kind: 'warehouse', onHand: 6 },
        { locationId: 2, code: 'VAN', kind: 'van', onHand: 4 },
      ],
    });
    vi.mocked(inventoryLedgerService.getMovements).mockResolvedValue({ total: 0, rows: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/products/9']}>
          <Routes>
            <Route path="/products/:id" element={<ProductOverview />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('shows the category name, stock by location, reorder suggestion, and primary barcode', async () => {
    await renderPage();

    expect(container.textContent).toContain('Category: Lubricants');
    expect(container.textContent).not.toContain('Category: Legacy Cat');
    expect(container.textContent).toContain('Brand: Mobil');
    expect(container.textContent).toContain('Pack: 12 x case');
    expect(container.textContent).toContain('Base unit: qt');
    expect(container.textContent).toContain('Discontinued');
    expect(container.querySelector('[data-testid="stock-on-hand"]')?.textContent).toBe('10');
    expect(container.textContent).toContain('MAIN');
    expect(container.textContent).toContain('warehouse');
    expect(container.textContent).toContain('VAN');
    expect(container.textContent).toContain('van');
    expect(container.querySelector('[data-testid="reorder-status"]')?.textContent).toBe('Reorder — suggest 3 case = 36 qt');
    expect(container.textContent).toContain('Lead time: 7 days');
    expect(container.textContent).toContain('Acme Lubes');
    expect(container.textContent).toContain('PRI-OIL');
    expect(container.textContent).toContain('Primary');
    expect(container.querySelector('a[href="/products/edit/9"]')?.textContent).toContain('Manage');
    expect(inventoryLedgerService.getProductOnHand).toHaveBeenCalledWith(9);
  });

  it('shows OK when on hand is above the reorder point', async () => {
    vi.mocked(inventoryLedgerService.getProductOnHand).mockResolvedValue({
      onHand: 20,
      byLocation: [{ locationId: 1, code: 'MAIN', kind: 'warehouse', onHand: 20 }],
    });
    await renderPage();
    expect(container.querySelector('[data-testid="reorder-status"]')?.textContent).toBe('OK');
  });

  it('links the Stock card to Reorder planning for this product', async () => {
    await renderPage();
    const link = container.querySelector('[data-testid="open-reorder-planning"]');
    expect(link?.textContent).toBe('Open in Reorder planning');
    expect(link?.getAttribute('href')).toBe('/purchases/reorder?product_id=9');
  });

  it('hides the Reorder planning link from roles that cannot open it', async () => {
    authState.role = 'sales';
    try {
      await renderPage();
      expect(container.querySelector('[data-testid="open-reorder-planning"]')).toBeNull();
    } finally {
      authState.role = 'admin';
    }
  });

  it('still renders the product when on-hand fails', async () => {
    vi.mocked(inventoryLedgerService.getProductOnHand).mockRejectedValue(new Error('ledger down'));
    await renderPage();
    expect(container.textContent).toContain('Case Oil');
    expect(container.querySelector('[data-testid="stock-on-hand"]')?.textContent).toBe('—');
    expect(container.querySelector('[data-testid="reorder-status"]')?.textContent).toBe('—');
    expect(container.textContent).toContain('PRI-OIL');
  });
});
