import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RecurringInvoices from '../RecurringInvoices';
import * as api from '../../../services/api';

/** API returns numeric ids (CustomerResponse.id: int, Product.id: int). */
const customer = {
    id: 2,
    name: 'Test Customer 2',
} as unknown as api.Customer;

const product = {
    id: 15,
    name: 'MOBIL SPECIAL 0W30 6X1QT',
    sku: 'MOB-0W30',
    unit_price: 10,
    current_stock: 12,
} as unknown as api.Product;

describe('Recurring invoices form', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        vi.spyOn(api, 'getCustomers').mockResolvedValue([customer]);
        vi.spyOn(api, 'getProducts').mockResolvedValue([product]);
        vi.spyOn(api, 'getRecurringInvoices').mockReturnValue([]);
        vi.spyOn(api, 'saveRecurringInvoice').mockImplementation(() => {});
        vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        vi.restoreAllMocks();
    });

    async function renderPage() {
        await act(async () => {
            root.render(<RecurringInvoices />);
        });
        await act(async () => {});
    }

    function text(): string {
        return container.textContent ?? '';
    }

    function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function clickButton(label: string) {
        const button = Array.from(container.querySelectorAll('button')).find((node) =>
            (node.textContent ?? '').includes(label),
        );
        if (!button) throw new Error(`button not found: ${label}`);
        button.click();
    }

    function selectByOptionText(label: string): HTMLSelectElement {
        const el = Array.from(container.querySelectorAll('select')).find((node) =>
            Array.from(node.options).some((option) => option.text === label),
        );
        if (!el) throw new Error(`select not found: ${label}`);
        return el;
    }

    async function openForm() {
        await act(async () => {
            clickButton('New recurring');
        });
    }

    async function fillHeader() {
        await act(async () => {
            setValue(selectByOptionText('Select customer...'), '2');
            const frequency = Array.from(container.querySelectorAll('select')).find(
                (node) => node.options[0]?.value === 'weekly',
            );
            if (!frequency) throw new Error('frequency select not found');
            setValue(frequency, 'weekly');
            const date = container.querySelector('input[type="date"]');
            if (!(date instanceof HTMLInputElement)) throw new Error('date input not found');
            setValue(date, '2026-09-28');
        });
    }

    async function fillQtyAndPrice() {
        await act(async () => {
            const qty = container.querySelector('input[placeholder="Qty"]');
            const rate = container.querySelector('input[placeholder="Rate"]');
            if (!(qty instanceof HTMLInputElement) || !(rate instanceof HTMLInputElement)) {
                throw new Error('line inputs not found');
            }
            setValue(qty, '3');
            setValue(rate, '17.86');
        });
    }

    it('saves a selected product with an integer product id, qty 3, and price 17.86', async () => {
        await renderPage();
        await openForm();
        await fillHeader();
        await act(async () => {
            setValue(selectByOptionText('Select product...'), '15');
        });
        await fillQtyAndPrice();

        expect(text()).toContain('53.58');
        expect(window.alert).not.toHaveBeenCalled();

        await act(async () => {
            clickButton('Save recurring invoice');
        });

        expect(window.alert).not.toHaveBeenCalled();
        expect(api.saveRecurringInvoice).toHaveBeenCalledTimes(1);
        const saved = vi.mocked(api.saveRecurringInvoice).mock.calls[0][0];
        expect(saved.customerName).toBe('Test Customer 2');
        expect(saved.frequency).toBe('weekly');
        expect(saved.nextRunDate).toBe('2026-09-28');
        expect(saved.lineItems).toEqual([
            {
                product: 'MOBIL SPECIAL 0W30 6X1QT',
                description: 'MOBIL SPECIAL 0W30 6X1QT',
                quantity: 3,
                rate: 17.86,
                amount: 3 * 17.86,
                product_id: 15,
            },
        ]);
        expect(typeof saved.lineItems[0].product_id).toBe('number');
        expect(saved.grandTotal).toBeCloseTo(53.58, 2);
    });

    it('blocks save when the line has no product and does not call the service', async () => {
        await renderPage();
        await openForm();
        await fillHeader();
        await fillQtyAndPrice();

        await act(async () => {
            clickButton('Save recurring invoice');
        });

        expect(window.alert).toHaveBeenCalledTimes(1);
        expect(window.alert).toHaveBeenCalledWith('Select a customer and at least one product.');
        expect(api.saveRecurringInvoice).not.toHaveBeenCalled();
    });
});
