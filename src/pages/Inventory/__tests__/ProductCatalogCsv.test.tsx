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
  exportProductsCsv: vi.fn(),
  importProductsCsv: vi.fn(),
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

function catalogProduct(): Product {
  return {
    id: '1',
    name: 'Live Oil',
    sku: 'LIVE',
    category: 'Lubricants',
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
  };
}

describe('Product catalog CSV', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(productService.getProducts).mockResolvedValue([catalogProduct()]);
    URL.createObjectURL = vi.fn(() => 'blob:products');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.restoreAllMocks();
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
        <MemoryRouter>
          <ProductCatalog />
        </MemoryRouter>,
      );
    });
    await flush();
  }

  it('downloads the server export and posts an import with its result', async () => {
    const blob = new Blob(['sku,name\n'], { type: 'text/csv' });
    vi.mocked(productService.exportProductsCsv).mockResolvedValue(blob);
    vi.mocked(productService.importProductsCsv).mockResolvedValue({
      created: 2,
      failed: [{ row: 4, external_id: 'P4', error: 'barcode already exists' }],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderPage();

    const exportButton = container.querySelector('[aria-label="Export CSV"]') as HTMLButtonElement;
    await act(async () => {
      exportButton.click();
    });
    await flush();
    expect(productService.exportProductsCsv).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

    const input = container.querySelector('[aria-label="Product CSV file"]') as HTMLInputElement;
    const file = new File(['sku,name\n'], 'products.csv', { type: 'text/csv' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await flush();

    expect(window.confirm).toHaveBeenCalled();
    expect(productService.importProductsCsv).toHaveBeenCalledWith(file);
    expect(container.textContent).toContain('Created 2');
    expect(container.textContent).toContain('barcode already exists');
    expect(container.textContent).toContain('4');
    expect(productService.getProducts).toHaveBeenCalledTimes(2);
  });
});
