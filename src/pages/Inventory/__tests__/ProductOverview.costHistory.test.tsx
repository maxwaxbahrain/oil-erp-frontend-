import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductOverview from '../ProductOverview';
import * as productService from '../../../services/productService';
import * as purchasesService from '../../../services/purchasesService';
import * as inventoryLedgerService from '../../../services/inventoryLedgerService';
import * as valuationService from '../../../services/inventoryValuationService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
  getProductById: vi.fn(),
  getProducts: vi.fn(),
  saveProduct: vi.fn(),
  getAIInsights: vi.fn(),
  formatPack: () => null,
}));
vi.mock('../../../services/purchasesService', () => ({ getSuppliers: vi.fn() }));
vi.mock('../../../services/inventoryLedgerService', () => ({ getProductOnHand: vi.fn(), getMovements: vi.fn() }));
vi.mock('../../../services/inventoryValuationService', () => ({ listRevaluations: vi.fn() }));
vi.mock('../../../services/settingsService', () => ({ formatCurrency: (n: number) => `$${n}` }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasRole: () => true }) }));

const product = {
  id: '9',
  name: 'Case Oil',
  sku: 'RT-OIL',
  category: 'Lubricants',
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
    purchasePriceExWorks: 6,
    freightShipping: 0,
    importDuty: 0,
    otherDirectCosts: 0,
    landedCost: 6,
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
} as unknown as Product;

const revaluation = {
  id: 5,
  product_id: 9,
  old_cost: 4,
  new_cost: 6,
  quantity: 10,
  amount: 20,
  journal_entry_id: 31,
  reason: null,
  source: 'csv_import' as const,
  created_by: 1,
  created_at: '2026-10-21T09:30:00+00:00',
};

describe('ProductOverview cost revaluation line', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(productService.getProductById).mockResolvedValue(product);
    vi.mocked(productService.getProducts).mockResolvedValue([]);
    vi.mocked(purchasesService.getSuppliers).mockResolvedValue([]);
    vi.mocked(inventoryLedgerService.getProductOnHand).mockResolvedValue({ onHand: 10, byLocation: [] });
    vi.mocked(inventoryLedgerService.getMovements).mockResolvedValue({ total: 0, rows: [] });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function render() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/products/9']}>
          <Routes>
            <Route path="/products/:id" element={<ProductOverview />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('shows cost and last revalued, and opens the history panel', async () => {
    vi.mocked(valuationService.listRevaluations).mockResolvedValue([revaluation]);
    await render();
    expect(valuationService.listRevaluations).toHaveBeenCalledWith(9, 1);
    const line = container.querySelector('[data-testid="cost-last-revalued"]') as HTMLElement;
    expect(line.textContent).toContain('Cost $6 · last revalued');
    expect(line.textContent).toContain('2026');

    const open = Array.from(line.querySelectorAll('button')).find((b) => b.textContent === 'Cost history') as HTMLButtonElement;
    await act(async () => {
      open.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[role="dialog"][aria-label="Cost history"] [data-testid="revaluation-5"]')?.textContent).toContain('CSV import');
  });

  it('hides the line when there is no history', async () => {
    vi.mocked(valuationService.listRevaluations).mockResolvedValue([]);
    await render();
    expect(container.querySelector('[data-testid="cost-last-revalued"]')).toBeNull();
  });
});
