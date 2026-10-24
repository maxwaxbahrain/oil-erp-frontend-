import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LocationsPage from '../Locations';
import * as stockLocationService from '../../../services/stockLocationService';

const tree = [
  {
    id: 1,
    code: 'MAIN',
    name: 'Main warehouse',
    kind: 'warehouse',
    vanId: null,
    isActive: true,
    parentId: null,
    path: 'MAIN',
    sortOrder: null,
    capacityUnits: null,
    barcode: null,
    children: [
      {
        id: 2,
        code: 'A',
        name: 'Zone A',
        kind: 'zone',
        vanId: null,
        isActive: true,
        parentId: 1,
        path: 'MAIN/A',
        sortOrder: null,
        capacityUnits: null,
        barcode: null,
        children: [
          {
            id: 3,
            code: 'R1',
            name: 'Rack 1',
            kind: 'rack',
            vanId: null,
            isActive: true,
            parentId: 2,
            path: 'MAIN/A/R1',
            sortOrder: null,
            capacityUnits: null,
            barcode: null,
            children: [
              {
                id: 5,
                code: 'B1',
                name: 'Bin 1',
                kind: 'bin',
                vanId: null,
                isActive: true,
                parentId: 3,
                path: 'MAIN/A/R1/B1',
                sortOrder: null,
                capacityUnits: null,
                barcode: null,
                children: [],
              },
            ],
          },
        ],
      },
    ],
  },
];

vi.mock('../../../services/stockLocationService', () => ({
  getLocationTree: vi.fn(),
  getLocationOnHand: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deactivateLocation: vi.fn(),
  postTransfer: vi.fn(),
  allowedChildKinds: (kind: string) => (kind === 'rack' ? ['bin'] : kind === 'warehouse' ? ['zone'] : kind === 'zone' ? ['aisle'] : kind === 'aisle' ? ['rack', 'bin'] : []),
  isStockHoldingKind: (kind: string) => kind === 'bin' || kind === 'warehouse' || kind === 'van',
  flattenLocationTree: (nodes: typeof tree) => {
    const out: typeof tree = [];
    const walk = (list: typeof tree) => {
      for (const node of list) {
        out.push({ ...node, children: undefined });
        if (node.children?.length) walk(node.children as typeof tree);
      }
    };
    walk(nodes);
    return out;
  },
}));

function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter>
        <LocationsPage />
      </MemoryRouter>,
    );
  });
  return { container, root };
}

describe('Locations page', () => {
  beforeEach(() => {
    vi.mocked(stockLocationService.getLocationTree).mockResolvedValue(tree as never);
    vi.mocked(stockLocationService.getLocationOnHand).mockResolvedValue([]);
    vi.mocked(stockLocationService.deactivateLocation).mockRejectedValue(new Error('location still has stock'));
    vi.mocked(stockLocationService.postTransfer).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders tree and rack add-child offers bin only', async () => {
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="loc-node-MAIN"]')).toBeTruthy();
    const rackBtn = container.querySelector('[data-testid="loc-node-R1"]') as HTMLButtonElement;
    await act(() => {
      rackBtn.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const kindSelect = container.querySelector('[aria-label="Child kind"]') as HTMLSelectElement;
    const options = Array.from(kindSelect.options).map((o) => o.value).filter(Boolean);
    expect(options).toEqual(['bin']);
    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows deactivate error from server', async () => {
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    const mainBtn = container.querySelector('[data-testid="loc-node-MAIN"]') as HTMLButtonElement;
    await act(() => {
      mainBtn.click();
    });
    const deactivate = container.querySelector('[aria-label="Deactivate location"]') as HTMLButtonElement;
    await act(async () => {
      deactivate.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="location-action-error"]')?.textContent).toContain('location still has stock');
    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('posts transfer from move dialog', async () => {
    vi.mocked(stockLocationService.getLocationOnHand).mockResolvedValue([
      { productId: 9, sku: 'SKU-9', name: 'Oil', onHand: 5 },
    ]);
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    const mainBtn = container.querySelector('[data-testid="loc-node-MAIN"]') as HTMLButtonElement;
    await act(() => {
      mainBtn.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const moveBtn = container.querySelector('[aria-label="Move 9"]') as HTMLButtonElement;
    await act(() => {
      moveBtn.click();
    });
    const qty = container.querySelector('[aria-label="Transfer quantity"]') as HTMLInputElement;
    const dest = container.querySelector('[aria-label="Transfer destination"]') as HTMLSelectElement;
    await act(() => {
      setValue(qty, '2');
      setValue(dest, '5');
    });
    const postBtn = Array.from(container.querySelectorAll('button')).find((b) => /post transfer/i.test(b.textContent || ''));
    await act(() => {
      postBtn!.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(stockLocationService.postTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 9,
        fromLocationId: 1,
        toLocationId: 5,
        quantity: 2,
      }),
    );
    await act(() => {
      root.unmount();
    });
    container.remove();
  });
});
