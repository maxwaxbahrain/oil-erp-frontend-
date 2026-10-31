import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PurchaseOrderForm from '../PurchaseOrderForm';
import * as api from '../../../services/api';
import * as purchasesService from '../../../services/purchasesService';
import * as productService from '../../../services/productService';

vi.mock('../../../services/productService', async (importOriginal) => {
  const actual = await importOriginal<typeof productService>();
  return { ...actual, getProducts: vi.fn() };
});

vi.mock('../../../components/common/SearchableSelect', () => ({
  default: ({
    onChange,
    options,
    value,
    placeholder,
  }: {
    onChange: (id: string) => void;
    options: { id: string; name: string }[];
    value: string;
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder || 'SearchableSelect'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder || 'Select'}</option>
      {options.map((row) => (
        <option key={row.id} value={row.id}>{row.name}</option>
      ))}
    </select>
  ),
}));

function setSelectValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('PurchaseOrderForm line cost prefill', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(purchasesService, 'getSuppliers').mockResolvedValue([
      {
        id: 'sup-1',
        name: 'Acme Supply',
        code: 'ACM',
        phone: '',
        email: '',
        address: '',
        taxId: '',
        paymentTerms: 'Net 30',
        currency: 'USD',
        rating: 'A',
        status: 'Active',
      },
    ] as purchasesService.Supplier[]);
    vi.spyOn(purchasesService, 'getSupplierBalance').mockResolvedValue(0);
    vi.spyOn(api, 'getProducts').mockResolvedValue([
      { id: '1', name: 'QA Plain', sku: 'QP', unit_price: 9, cost_price: 4, current_stock: 10 },
      { id: '2', name: 'No cost', sku: 'NC', unit_price: 9, cost_price: 0, current_stock: 5 },
    ] as api.Product[]);
    vi.mocked(productService.getProducts).mockResolvedValue([
      {
        id: '1',
        name: 'QA Plain',
        sku: 'QP',
        packQty: 100,
        packUnit: 'case',
        baseUnit: 'ea',
        uom: 'ea',
      } as productService.Product,
      {
        id: '2',
        name: 'No cost',
        sku: 'NC',
        packQty: 1,
        packUnit: 'case',
        baseUnit: 'ea',
        uom: 'ea',
      } as productService.Product,
    ]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function flush() {
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function mount() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/purchases/new']}>
          <PurchaseOrderForm />
        </MemoryRouter>,
      );
    });
    await flush();
    for (let i = 0; i < 40; i += 1) {
      if (container.querySelector('[aria-label="Select SKU"]')) break;
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  function unitCostInput(): HTMLInputElement {
    const row = container.querySelector('tbody tr');
    return row?.querySelector('input[placeholder="0.00"]') as HTMLInputElement;
  }

  it('prefills unit cost from product cost, not selling price', async () => {
    await mount();
    const select = container.querySelector('[aria-label="Select SKU"]') as HTMLSelectElement;
    await act(async () => {
      setSelectValue(select, '1');
    });
    await flush();
    expect(unitCostInput().value).toBe('4');
    expect(container.textContent).not.toContain('$900.00');
  });

  it('pack mode shows cost times pack qty on the pack price field', async () => {
    await mount();
    const select = container.querySelector('[aria-label="Select SKU"]') as HTMLSelectElement;
    await act(async () => {
      setSelectValue(select, '1');
    });
    await flush();
    const packBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'case');
    await act(async () => {
      packBtn?.click();
    });
    await flush();
    const packPrice = container.querySelector('[aria-label="Price per pack"]') as HTMLInputElement;
    expect(packPrice.value).toBe('400');
  });

  it('leaves unit cost empty when product cost is zero', async () => {
    await mount();
    const select = container.querySelector('[aria-label="Select SKU"]') as HTMLSelectElement;
    await act(async () => {
      setSelectValue(select, '2');
    });
    await flush();
    expect(unitCostInput().value).toBe('');
  });
});
