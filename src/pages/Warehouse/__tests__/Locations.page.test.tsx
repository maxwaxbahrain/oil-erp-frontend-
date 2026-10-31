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
        capacityUnits: 200,
        onHandUnits: 12,
        pct: 6,
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
                capacityUnits: 100,
                onHandUnits: 12,
                pct: 12,
                barcode: 'BC-B1',
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
  lookupLocationByBarcode: vi.fn(),
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

  it('renders capacity bar from tree pct', async () => {
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    const bars = container.querySelectorAll('[data-testid="capacity-bar"]');
    expect(bars.length).toBeGreaterThan(0);
    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('print labels lists descendant bins only', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    const zoneBtn = container.querySelector('[data-testid="loc-node-A"]') as HTMLButtonElement;
    await act(() => {
      zoneBtn.click();
    });
    const printBtn = container.querySelector('[data-testid="print-labels-btn"]') as HTMLButtonElement;
    await act(() => {
      printBtn.click();
    });
    expect(container.querySelector('[data-testid="label-card-B1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="label-card-MAIN"]')).toBeFalsy();
    printSpy.mockRestore();
    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('scan bin selects looked-up node and shows 404 message', async () => {
    vi.mocked(stockLocationService.lookupLocationByBarcode).mockResolvedValue({
      id: 5,
      code: 'B1',
      name: 'Bin 1',
      kind: 'bin',
      vanId: null,
      isActive: true,
      parentId: 3,
      path: 'MAIN/A/R1/B1',
      sortOrder: null,
      capacityUnits: 100,
      onHandUnits: 12,
      pct: 12,
      barcode: 'BC-B1',
    });
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    const scan = container.querySelector('[aria-label="Scan bin"]') as HTMLInputElement;
    await act(() => {
      setValue(scan, 'BC-B1');
    });
    await act(async () => {
      scan.form!.requestSubmit();
      await Promise.resolve();
    });
    expect(stockLocationService.lookupLocationByBarcode).toHaveBeenCalledWith('BC-B1');
    expect(container.querySelector('h2')?.textContent).toBe('Bin 1');

    vi.mocked(stockLocationService.lookupLocationByBarcode).mockRejectedValue(new Error('404'));
    await act(() => {
      setValue(scan, 'MISSING');
    });
    await act(async () => {
      scan.form!.requestSubmit();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="scan-bin-error"]')?.textContent).toContain('No location with that code');

    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  function addButton(container: HTMLElement) {
    const form = container.querySelector('[data-testid="add-child-form"]') as HTMLFormElement;
    return Array.from(form.querySelectorAll('button')).find((b) => b.textContent === 'Add') as HTMLButtonElement;
  }

  it('keeps Add disabled until kind, code, and name are set', async () => {
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(addButton(container).disabled).toBe(true);
    expect(container.querySelector('[data-testid="add-child-kind-hint"]')?.textContent).toBe('Choose a kind');

    const kind = container.querySelector('[aria-label="Child kind"]') as HTMLSelectElement;
    const code = container.querySelector('[aria-label="Child code"]') as HTMLInputElement;
    const name = container.querySelector('[aria-label="Child name"]') as HTMLInputElement;
    await act(() => {
      setValue(kind, 'zone');
    });
    expect(addButton(container).disabled).toBe(true);
    expect(container.querySelector('[data-testid="add-child-kind-hint"]')).toBeNull();

    await act(() => {
      setValue(code, '   ');
      setValue(name, 'Test Aisle');
    });
    expect(addButton(container).disabled).toBe(true);

    await act(() => {
      setValue(code, 'WH-A');
    });
    expect(addButton(container).disabled).toBe(false);

    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders create error detail inline and keeps the typed values', async () => {
    vi.mocked(stockLocationService.createLocation).mockRejectedValue(new Error('x'));
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    const kind = container.querySelector('[aria-label="Child kind"]') as HTMLSelectElement;
    const code = container.querySelector('[aria-label="Child code"]') as HTMLInputElement;
    const name = container.querySelector('[aria-label="Child name"]') as HTMLInputElement;
    await act(() => {
      setValue(kind, 'zone');
      setValue(code, 'WH-A');
      setValue(name, 'Test Aisle');
    });
    const treeCalls = vi.mocked(stockLocationService.getLocationTree).mock.calls.length;
    await act(async () => {
      addButton(container).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="add-child-error"]')?.textContent).toBe('x');
    expect(kind.value).toBe('zone');
    expect(code.value).toBe('WH-A');
    expect(name.value).toBe('Test Aisle');
    expect(vi.mocked(stockLocationService.getLocationTree).mock.calls.length).toBe(treeCalls);
    await act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('re-fetches the tree and selects the new node after create', async () => {
    const created = {
      id: 42,
      code: 'WH-A',
      name: 'Test Aisle',
      kind: 'zone',
      vanId: null,
      isActive: true,
      parentId: 1,
      path: 'MAIN/WH-A',
      sortOrder: null,
      capacityUnits: null,
      barcode: null,
      children: [],
    };
    const nextTree = [
      {
        ...tree[0],
        children: [...(tree[0].children ?? []), created],
      },
    ];
    vi.mocked(stockLocationService.createLocation).mockResolvedValue(created as never);
    const { container, root } = mount();
    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(stockLocationService.getLocationTree).mockResolvedValue(nextTree as never);
    const kind = container.querySelector('[aria-label="Child kind"]') as HTMLSelectElement;
    const code = container.querySelector('[aria-label="Child code"]') as HTMLInputElement;
    const name = container.querySelector('[aria-label="Child name"]') as HTMLInputElement;
    await act(() => {
      setValue(kind, 'zone');
      setValue(code, ' WH-A ');
      setValue(name, 'Test Aisle');
    });
    await act(async () => {
      addButton(container).click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(stockLocationService.createLocation).toHaveBeenCalledWith({
      code: 'WH-A',
      name: 'Test Aisle',
      kind: 'zone',
      parentId: 1,
    });
    expect(vi.mocked(stockLocationService.getLocationTree).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-testid="loc-node-WH-A"]')).toBeTruthy();
    expect(container.querySelector('h2')?.textContent).toBe('Test Aisle');
    expect((container.querySelector('[aria-label="Child code"]') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('[aria-label="Child name"]') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('[aria-label="Child kind"]') as HTMLSelectElement).value).toBe('');
    await act(() => {
      root.unmount();
    });
    container.remove();
  });
});
