import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ManifestPrint from '../ManifestPrint';
import type { PickManifest } from '../../../services/pickingService';

const manifest: PickManifest = {
  manifestNumber: 'MF-000001',
  dispatchedAt: '2026-10-24T09:00:00',
  van: { code: 'VAN-1', plate: 'PLT-9' },
  driverName: 'Dee Driver',
  stops: [
    {
      invoiceNumber: 'INV-1',
      customerName: 'Acme',
      address: '1 Dock',
      phone: '555-0101',
      invoiceTotal: 36,
      paymentTerms: 'net 7',
      lines: [
        { sku: 'SOAP', name: 'Soap', qtyRequired: 4, qtyPicked: 4, short: false },
      ],
    },
    {
      invoiceNumber: 'INV-2',
      customerName: 'Beta',
      address: '2 Dock',
      phone: '555-0102',
      invoiceTotal: 18,
      paymentTerms: null,
      lines: [
        { sku: 'OIL', name: 'Drum oil', qtyRequired: 4, qtyPicked: 1, short: true },
      ],
    },
  ],
  totals: { stops: 2, units: 5, shortLines: 1 },
};

describe('Manifest print', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders stops in order, marks a short row, and shows totals', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await act(async () => {
      root.render(<ManifestPrint manifest={manifest} onClose={() => undefined} />);
    });
    const stops = container.querySelectorAll('[data-testid^="manifest-stop-"]');
    expect(stops).toHaveLength(2);
    expect(stops[0].textContent).toContain('Acme');
    expect(stops[0].textContent).toContain('INV-1');
    expect(stops[1].textContent).toContain('Beta');
    expect(stops[1].textContent).toContain('INV-2');
    expect(stops[1].querySelector('[data-short="true"]')?.textContent).toContain('short');
    expect(container.querySelector('[data-testid="manifest-totals"]')?.textContent).toBe('Stops 2 · Units 5 · Short lines 1');
    const printButton = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Print');
    await act(() => {
      printButton?.click();
    });
    expect(print).toHaveBeenCalled();
    expect(container.querySelector('#manifest-print')).toBeTruthy();
  });
});
