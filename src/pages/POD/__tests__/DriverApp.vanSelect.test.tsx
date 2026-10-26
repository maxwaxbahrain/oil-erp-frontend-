import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DriverApp from '../DriverApp';
import { getVans, type Van } from '../../../services/api';
import { listDeliveryNotes } from '../../../services/deliveryService';
import { getManifest, listPickLists, type PickListSummary, type PickManifest, type PickManifestStop } from '../../../services/pickingService';
import { localIsoDate } from '../../../utils/localDate';

vi.mock('../../../services/api', () => ({
  getVans: vi.fn(),
  getCustomers: vi.fn(),
  getSalesOrders: vi.fn(),
  createInvoice: vi.fn(),
  createPayment: vi.fn(),
}));

vi.mock('../../../services/pickingService', () => ({
  listPickLists: vi.fn(),
  getManifest: vi.fn(),
}));

vi.mock('../../../services/deliveryService', () => ({
  listDeliveryNotes: vi.fn(),
  createDeliveryNote: vi.fn(),
  completeDeliveryNote: vi.fn(),
  toDriverDeliveryStatus: (status: string) => status,
}));

vi.mock('../../../services/employeeService', () => ({
  getEmployees: vi.fn().mockResolvedValue([]),
}));

function van(partial: Partial<Van> & Pick<Van, 'id' | 'van_number'>): Van {
  return {
    driver_name: 'Leila Nasser',
    status: 'active',
    ...partial,
  };
}

function summary(partial: Partial<PickListSummary> & Pick<PickListSummary, 'id' | 'vanId' | 'dispatchedAt'>): PickListSummary {
  return {
    number: `PK-${partial.id}`,
    status: 'dispatched',
    sourceKind: 'route',
    routeDate: localIsoDate(),
    assignedTo: null,
    driverId: null,
    manifestNumber: `M-${partial.id}`,
    deliveredAt: null,
    hasFailedDelivery: false,
    createdAt: null,
    releasedAt: null,
    pickedAt: null,
    lineCount: 1,
    pickedCount: 1,
    invoiceIds: [],
    ...partial,
  };
}

function stop(partial: Partial<PickManifestStop>): PickManifestStop {
  return {
    invoiceNumber: null,
    customerName: null,
    address: null,
    phone: null,
    lines: [],
    invoiceTotal: null,
    paymentTerms: null,
    ...partial,
  };
}

function manifest(dispatchedAt: string, stops: PickManifestStop[]): PickManifest {
  return {
    manifestNumber: 'M',
    dispatchedAt,
    van: { code: null, plate: null },
    driverName: null,
    stops,
    totals: { stops: stops.length, units: 0, shortLines: 0 },
  };
}

function vanCard(container: HTMLElement, vanNumber: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((node) =>
    node.textContent?.includes(vanNumber) && node.textContent?.includes('Stops'));
  expect(found, vanNumber).toBeTruthy();
  return found as HTMLButtonElement;
}

describe('DriverApp van select', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(getVans).mockReset();
    vi.mocked(listPickLists).mockReset();
    vi.mocked(getManifest).mockReset();
    vi.mocked(listDeliveryNotes).mockReset();
    vi.mocked(listDeliveryNotes).mockResolvedValue([]);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderApp() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <DriverApp />
        </MemoryRouter>,
      );
    });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('shows stops, order value, Loaded and Next from the earliest manifest, and leaves the other van Empty', async () => {
    vi.mocked(getVans).mockResolvedValue([
      van({ id: 'van-a', van_number: 'LM-TEST', driver_name: 'Leila Nasser' }),
      van({ id: 'van-b', van_number: 'LM-EMPTY', driver_name: 'Noor Ali', status: 'maintenance' }),
    ]);
    vi.mocked(listPickLists).mockResolvedValue({
      total: 2,
      items: [
        summary({ id: 11, vanId: 'van-a', dispatchedAt: '2026-10-26T11:00:00' }),
        summary({ id: 10, vanId: 'van-a', dispatchedAt: '2026-10-26T08:00:00' }),
      ],
    });
    vi.mocked(getManifest).mockImplementation(async (id: number) => {
      if (id === 10) {
        return manifest('2026-10-26T08:00:00', [
          stop({ customerName: 'North Fuel', address: '14 Hill St', invoiceNumber: 'INV-10', invoiceTotal: 150 }),
        ]);
      }
      if (id === 11) {
        return manifest('2026-10-26T11:00:00', [
          stop({ customerName: 'West Fuel', address: '2 Dock Rd', invoiceNumber: 'INV-11', invoiceTotal: 75 }),
        ]);
      }
      throw new Error(`unexpected manifest ${id}`);
    });

    await renderApp();

    expect(listPickLists).toHaveBeenCalledWith({ status: 'dispatched', routeDate: localIsoDate() });
    expect(container.textContent).toContain('2 deliveries scheduled today');
    expect(container.textContent).not.toContain('zones');

    const loaded = vanCard(container, 'LM-TEST');
    expect(loaded.textContent).toContain('Leila N.');
    expect(loaded.textContent).toContain('Loaded');
    expect(loaded.textContent).toContain('Stops2');
    expect(loaded.textContent).toContain('$225');
    expect(loaded.textContent).toContain('Next');
    expect(loaded.textContent).toContain('North Fuel · 14 Hill St');
    expect(loaded.textContent).not.toContain('West Fuel');
    expect(loaded.textContent).not.toContain('Senior driver');

    const empty = vanCard(container, 'LM-EMPTY');
    expect(empty.textContent).toContain('Empty');
    expect(empty.textContent).toContain('In use');
    expect(empty.textContent).toContain('Stops0');
    expect(empty.textContent).toContain('$0');
    expect(empty.textContent).not.toContain('Next');
    expect(empty.textContent).not.toContain('North Fuel');
  });

  it('shows no dispatched deliveries and no invented customers when there are zero pick lists', async () => {
    vi.mocked(getVans).mockResolvedValue([
      van({ id: 'van-a', van_number: 'LM-TEST' }),
      van({ id: 'van-b', van_number: 'LM-EMPTY', driver_name: 'Noor Ali' }),
    ]);
    vi.mocked(listPickLists).mockResolvedValue({ total: 0, items: [] });

    await renderApp();

    expect(getManifest).not.toHaveBeenCalled();
    const text = container.textContent || '';
    expect(text).toContain('No deliveries dispatched today');
    expect(text).not.toContain('Arshad');
    expect(text).not.toContain('Qahir');
    expect(text).not.toContain('zones');
    expect(text).not.toContain('Senior driver');
    expect(text).not.toMatch(/\$[1-9]/);

    const first = vanCard(container, 'LM-TEST');
    const second = vanCard(container, 'LM-EMPTY');
    expect(first.textContent).toContain('Empty');
    expect(second.textContent).toContain('Empty');
    expect(first.textContent).not.toContain('Next');
    expect(second.textContent).not.toContain('Next');
    expect(first.textContent).toContain('Stops0');
    expect(second.textContent).toContain('$0');
  });

  it('keeps the vans and retries only today\'s deliveries when pick lists fail', async () => {
    vi.mocked(getVans).mockResolvedValue([
      van({ id: 'van-a', van_number: 'LM-TEST' }),
      van({ id: 'van-b', van_number: 'LM-EMPTY', driver_name: 'Noor Ali' }),
    ]);
    vi.mocked(listPickLists).mockRejectedValueOnce(new Error('pick lists down'));

    await renderApp();

    expect(vanCard(container, 'LM-TEST').textContent).toContain('Empty');
    expect(vanCard(container, 'LM-EMPTY').textContent).toContain('Empty');
    expect(container.textContent).toContain("Couldn't load today's deliveries");
    expect(container.textContent).not.toContain("Couldn't load vans — check your connection and try again");
    expect(vi.mocked(getVans).mock.calls).toHaveLength(1);
    expect(getManifest).not.toHaveBeenCalled();

    vi.mocked(listPickLists).mockResolvedValue({
      total: 1,
      items: [summary({ id: 10, vanId: 'van-a', dispatchedAt: '2026-10-26T08:00:00' })],
    });
    vi.mocked(getManifest).mockResolvedValue(manifest('2026-10-26T08:00:00', [
      stop({ customerName: 'North Fuel', address: '14 Hill St', invoiceNumber: 'INV-10', invoiceTotal: 150 }),
    ]));

    const retry = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes('Retry'));
    expect(retry).toBeTruthy();
    await act(async () => {
      retry?.click();
    });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    expect(vi.mocked(getVans).mock.calls).toHaveLength(1);
    expect(vi.mocked(listPickLists).mock.calls).toHaveLength(2);
    const loaded = vanCard(container, 'LM-TEST');
    expect(loaded.textContent).toContain('Loaded');
    expect(loaded.textContent).toContain('North Fuel · 14 Hill St');
    expect(container.textContent).not.toContain("Couldn't load today's deliveries");
    expect(vanCard(container, 'LM-EMPTY').textContent).toContain('Empty');
  });

  it('shows a connection error and Retry when GET /vans fails, with no sample van', async () => {
    vi.mocked(getVans).mockRejectedValue(new Error('HTTP 503'));

    await renderApp();

    expect(container.textContent).toContain("Couldn't load vans — check your connection and try again");
    expect(container.textContent).not.toContain('VAN-01');
    expect(listPickLists).not.toHaveBeenCalled();
    const retry = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes('Retry'));
    expect(retry).toBeTruthy();

    vi.mocked(getVans).mockResolvedValue([van({ id: 'van-a', van_number: 'LM-TEST' })]);
    vi.mocked(listPickLists).mockResolvedValue({ total: 0, items: [] });
    await act(async () => {
      retry?.click();
    });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
    expect(container.textContent).toContain('LM-TEST');
    expect(container.textContent).not.toContain('VAN-01');
  });
});
