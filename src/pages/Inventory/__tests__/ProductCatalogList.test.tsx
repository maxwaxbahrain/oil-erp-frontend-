import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ProductCatalog from '../ProductCatalog';
import * as productService from '../../../services/productService';
import type { Product } from '../../../services/productService';

vi.mock('../../../services/productService', () => ({
  getProducts: vi.fn(),
  deleteProduct: vi.fn(),
  saveProduct: vi.fn(),
  formatPack: (packQty?: number | null, packUnit?: string | null) => {
    if (packQty == null || !(Number(packQty) > 0)) return null;
    return packUnit ? `${packQty} x ${packUnit}` : String(packQty);
  },
}));

vi.mock('../../../services/settingsService', () => ({
  formatCurrency: (n: number) => String(n),
}));

vi.mock('../../../utils/imageCompression', () => ({
  compressImage: vi.fn(),
}));

function catalogProduct(overrides: Partial<Product>): Product {
  return {
    id: overrides.id || '1',
    name: overrides.name || 'Live Oil',
    sku: overrides.sku || 'LIVE',
    category: overrides.category || 'Lubricants',
    brand: overrides.brand,
    status: 'Active',
    description: '',
    uom: 'pcs',
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
      purchasePriceExWorks: 1,
      freightShipping: 0,
      importDuty: 0,
      otherDirectCosts: 0,
      landedCost: 1,
      operatingExpenseAllocation: 0,
      sellingPrice: 2,
      taxRate: 0,
      taxIncluded: false,
    },
    priceHistory: [],
    images: [],
    aiEnabled: false,
    aiDemandPrediction: 0,
    aiConfidenceLevel: 0,
    leadTimeDays: 0,
    minOrderQty: 0,
    specifications: [],
    tags: [],
    seo: { metaTitle: '', metaDescription: '', keywords: '' },
    leakageRate: 0,
    returnRate: 0,
    packQty: overrides.packQty,
    packUnit: overrides.packUnit,
    isDiscontinued: overrides.isDiscontinued,
  };
}

describe('Product catalog list', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(productService.getProducts).mockResolvedValue([
      catalogProduct({ id: '1', name: 'Live Oil', brand: 'Mobil', packQty: 12, packUnit: 'case' }),
      catalogProduct({ id: '2', name: 'Castrol Edge', sku: 'CAST', brand: 'Castrol', category: 'Filters' }),
      catalogProduct({ id: '3', name: 'Old Oil', sku: 'OLD', brand: 'Mobil', isDiscontinued: true }),
    ]);
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

  function setValue(el: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  it('hides discontinued rows until the toggle and narrows by brand', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <ProductCatalog />
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.textContent).toContain('Live Oil');
    expect(container.textContent).toContain('Castrol Edge');
    expect(container.textContent).not.toContain('Old Oil');
    expect(container.textContent).toContain('12 x case');
    expect(container.textContent).toContain('Brand Mobil');

    const toggle = container.querySelector('[aria-label="Show discontinued"]') as HTMLInputElement;
    await act(async () => {
      toggle.click();
    });
    expect(container.textContent).toContain('Old Oil');
    expect(container.textContent).toContain('Discontinued');

    const brand = container.querySelector('[aria-label="Brand filter"]') as HTMLInputElement;
    await act(async () => {
      setValue(brand, 'Castrol');
    });
    expect(container.textContent).toContain('Castrol Edge');
    expect(container.textContent).not.toContain('Live Oil');
    expect(container.textContent).not.toContain('Old Oil');
  });
});
