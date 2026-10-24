import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductOverview from '../ProductOverview';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';
import * as stockLocationService from '../../../services/stockLocationService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
  getProductById: vi.fn(),
  getProducts: vi.fn(),
  saveProduct: vi.fn(),
  getAIInsights: vi.fn(),
  formatPack: () => null,
}));

vi.mock('../../../services/purchasesService', () => ({
  getSuppliers: vi.fn(),
}));

vi.mock('../../../services/inventoryLedgerService', () => ({
  getProductOnHand: vi.fn(),
  getMovements: vi.fn(),
}));

vi.mock('../../../services/stockLocationService', () => ({
  getLocationsFlat: vi.fn(),
  isStockHoldingKind: (kind: string) => kind === 'bin' || kind === 'warehouse' || kind === 'van',
}));

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => String(n),
}));

const product: Product = {
  id: '9',
  name: 'Case Oil',
  sku: 'RT-OIL',
  category: 'Cat',
  status: 'Active',
  description: '',
  uom: 'qt',
  velocityStatus: 'Medium',
  salesVelocity: 0,
  salesTrend: 0,
  revenueContribution: 0,
  grossMarginPercent: 0,
  netProfitPerUnit: 0,
  locations: [],
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
  specifications: [],
  tags: [],
  seo: { metaTitle: '', metaDescription: '', keywords: '' },
};

function setValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ProductOverview History location', () => {
  beforeEach(() => {
    vi.mocked(productService.getProductById).mockResolvedValue(product);
    vi.mocked(productService.getProducts).mockResolvedValue([]);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
    vi.mocked(inventoryLedgerService.getProductOnHand).mockResolvedValue({ onHand: 0, byLocation: [] });
    vi.mocked(stockLocationService.getLocationsFlat).mockResolvedValue([
      {
        id: 5,
        code: 'B1',
        name: 'Bin 1',
        kind: 'bin',
        vanId: null,
        isActive: true,
        parentId: 1,
        path: 'MAIN/B1',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
      },
    ]);
    vi.mocked(inventoryLedgerService.getMovements).mockResolvedValue({
      rows: [
        {
          id: 1,
          product_id: 9,
          entry_date: '2026-06-01',
          source_type: 'grn',
          source_id: 'GRN-1',
          reference: 'GRN-1',
          quantity_delta: 5,
          stock_before: 0,
          stock_after: 5,
          unit_cost: 4,
          journal_entry_id: null,
          note: null,
          created_at: null,
          location_id: 5,
          location_code: 'B1',
          location_path: 'MAIN/B1',
        },
      ],
      total: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders location column and filter calls getMovements with location_id', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/products/9']}>
          <Routes>
            <Route path="/products/:id" element={<ProductOverview />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const historyTab = Array.from(container.querySelectorAll('button')).find((b) =>
      /movement history/i.test(b.textContent || ''),
    );
    await act(() => {
      historyTab!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="movement-location-1"]')?.textContent).toBe('B1');

    const filter = container.querySelector('[aria-label="History location filter"]') as HTMLSelectElement;
    await act(() => {
      setValue(filter, '5');
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(inventoryLedgerService.getMovements).toHaveBeenCalledWith(
      expect.objectContaining({ product_id: 9, location_id: 5 }),
    );

    await act(() => {
      root.unmount();
    });
    container.remove();
  });
});
