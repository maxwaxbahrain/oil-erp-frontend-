import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatCurrency } from '../../../services/settingsService';
import { payablePurchaseTotal, type PurchaseOrder } from '../../../services/purchasesService';

const orders = vi.hoisted(() => [
    {
        id: '1',
        poNumber: 'PO-PEND',
        supplierId: '9',
        supplierName: 'Mill Co',
        date: '2026-10-09',
        status: 'Pending' as const,
        payment_status: 'Unpaid',
        grandTotal: 250,
        remaining_balance: 250,
        items: [],
        subtotal: 250,
        taxTotal: 0,
    },
    {
        id: '2',
        poNumber: 'PO-REJ',
        supplierId: '9',
        supplierName: 'Mill Co',
        date: '2026-10-09',
        status: 'Rejected' as const,
        payment_status: 'Unpaid',
        grandTotal: 80,
        remaining_balance: 80,
        items: [],
        subtotal: 80,
        taxTotal: 0,
    },
    {
        id: '3',
        poNumber: 'PO-OK',
        supplierId: '9',
        supplierName: 'Mill Co',
        date: '2026-10-09',
        status: 'Approved' as const,
        payment_status: 'Unpaid',
        grandTotal: 100,
        remaining_balance: 100,
        items: [],
        subtotal: 100,
        taxTotal: 0,
    },
]);

vi.mock('../../../services/purchasesService', async () => {
    const actual = await vi.importActual<typeof import('../../../services/purchasesService')>(
        '../../../services/purchasesService',
    );
    return {
        ...actual,
        getPurchaseOrders: vi.fn(async () => orders),
    };
});

import AgedPayable from '../AgedPayable';

describe('Aged Payable payable statuses', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        localStorage.removeItem('supplier_payments');
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    it('totals only approved-or-later orders, matching the payable purchase total', async () => {
        await act(async () => {
            root.render(
                <MemoryRouter>
                    <AgedPayable />
                </MemoryRouter>,
            );
        });
        for (let i = 0; i < 5; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }
        const expected = payablePurchaseTotal(orders as unknown as PurchaseOrder[]);
        expect(expected).toBe(100);
        expect(container.textContent).toContain(formatCurrency(expected));
        expect(container.textContent).not.toContain(formatCurrency(250));
        expect(container.textContent).not.toContain(formatCurrency(80));
        act(() => root.unmount());
        container.remove();
    });
});
