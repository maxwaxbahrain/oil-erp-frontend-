import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DayBook from '../DayBook';
import * as gl from '../../../services/glService';
import type { DayBookResponse } from '../../../services/glService';

const mockBook: DayBookResponse = {
    start_date: '2026-06-15',
    end_date: '2026-06-15',
    entries: [
        {
            id: 1,
            entry_number: 'JE-00001',
            entry_date: '2026-06-15',
            created_at: '2026-06-15T14:05:00',
            source_type: 'invoice',
            voucher_type: 'Sales',
            group: 'sales',
            memo: 'Invoice to Acme',
            status: 'posted',
            party_type: 'customer',
            party_name: 'Acme',
            party_id: 9,
            total_debit: 127.5,
            total_credit: 127.5,
            amount: 100,
            amount_basis: 'party',
            lines: [
                {
                    account_id: 11,
                    account_code: '1100',
                    account_name: 'Accounts Receivable',
                    account_type: 'asset',
                    debit: 100,
                    credit: 0,
                    memo: 'AR',
                    customer_id: 9,
                    supplier_id: null,
                },
                {
                    account_id: 40,
                    account_code: '4000',
                    account_name: 'Sales Revenue',
                    account_type: 'revenue',
                    debit: 0,
                    credit: 100,
                    memo: 'Sales',
                    customer_id: null,
                    supplier_id: null,
                },
                {
                    account_id: 50,
                    account_code: '5000',
                    account_name: 'Cost of Goods Sold',
                    account_type: 'expense',
                    debit: 27.5,
                    credit: 0,
                    memo: 'COGS',
                    customer_id: null,
                    supplier_id: null,
                },
                {
                    account_id: 12,
                    account_code: '1200',
                    account_name: 'Inventory',
                    account_type: 'asset',
                    debit: 0,
                    credit: 27.5,
                    memo: 'Inventory',
                    customer_id: null,
                    supplier_id: null,
                },
            ],
        },
        {
            id: 2,
            entry_number: 'JE-00002',
            entry_date: '2026-06-15',
            created_at: '2026-06-15T15:10:00',
            source_type: 'payment',
            voucher_type: 'Receipt',
            group: 'receipts',
            memo: 'Receipt from Acme',
            status: 'posted',
            party_type: 'customer',
            party_name: 'Acme',
            party_id: 9,
            total_debit: 40,
            total_credit: 40,
            amount: 40,
            amount_basis: 'party',
            lines: [
                {
                    account_id: 10,
                    account_code: '1000',
                    account_name: 'Cash on Hand',
                    account_type: 'asset',
                    debit: 40,
                    credit: 0,
                    memo: 'Cash',
                    customer_id: null,
                    supplier_id: null,
                },
                {
                    account_id: 11,
                    account_code: '1100',
                    account_name: 'Accounts Receivable',
                    account_type: 'asset',
                    debit: 0,
                    credit: 40,
                    memo: 'AR relief',
                    customer_id: 9,
                    supplier_id: null,
                },
            ],
        },
        {
            id: 3,
            entry_number: 'JE-00003',
            entry_date: '2026-06-15',
            created_at: '2026-06-15T16:00:00',
            source_type: 'expense',
            voucher_type: 'Expense',
            group: 'expenses',
            memo: 'Office supplies',
            status: 'reversed',
            party_type: null,
            party_name: null,
            party_id: null,
            total_debit: 25,
            total_credit: 25,
            amount: 25,
            amount_basis: 'debit_total',
            lines: [
                {
                    account_id: 60,
                    account_code: '6000',
                    account_name: 'Operating Expenses',
                    account_type: 'expense',
                    debit: 25,
                    credit: 0,
                    memo: 'Supplies',
                    customer_id: null,
                    supplier_id: null,
                },
                {
                    account_id: 10,
                    account_code: '1000',
                    account_name: 'Cash on Hand',
                    account_type: 'asset',
                    debit: 0,
                    credit: 25,
                    memo: 'Cash out',
                    customer_id: null,
                    supplier_id: null,
                },
            ],
        },
        {
            id: 4,
            entry_number: 'JE-00004',
            entry_date: '2026-06-15',
            created_at: '2026-06-15T16:05:00',
            source_type: 'reversal',
            voucher_type: 'Reversal',
            group: 'journal',
            memo: 'Reversal of JE-00003',
            status: 'posted',
            party_type: null,
            party_name: null,
            party_id: null,
            total_debit: 25,
            total_credit: 25,
            amount: 25,
            amount_basis: 'debit_total',
            lines: [
                {
                    account_id: 10,
                    account_code: '1000',
                    account_name: 'Cash on Hand',
                    account_type: 'asset',
                    debit: 25,
                    credit: 0,
                    memo: 'Restore cash',
                    customer_id: null,
                    supplier_id: null,
                },
                {
                    account_id: 60,
                    account_code: '6000',
                    account_name: 'Operating Expenses',
                    account_type: 'expense',
                    debit: 0,
                    credit: 25,
                    memo: 'Reverse supplies',
                    customer_id: null,
                    supplier_id: null,
                },
            ],
        },
    ],
    summary: {
        entry_count: 4,
        total_debit: 217.5,
        total_credit: 217.5,
        total_amount: 190,
        balanced: true,
        by_type: [
            { source_type: 'invoice', voucher_type: 'Sales', group: 'sales', count: 1, total_debit: 127.5, total_credit: 127.5, total_amount: 100 },
            { source_type: 'payment', voucher_type: 'Receipt', group: 'receipts', count: 1, total_debit: 40, total_credit: 40, total_amount: 40 },
            { source_type: 'expense', voucher_type: 'Expense', group: 'expenses', count: 1, total_debit: 25, total_credit: 25, total_amount: 25 },
            { source_type: 'reversal', voucher_type: 'Reversal', group: 'journal', count: 1, total_debit: 25, total_credit: 25, total_amount: 25 },
        ],
        by_day: [{ date: '2026-06-15', count: 4, total_debit: 217.5, total_credit: 217.5, total_amount: 190 }],
    },
};

describe('Day Book page', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        vi.spyOn(gl, 'getDayBook').mockResolvedValue(mockBook);
        vi.spyOn(gl, 'downloadDayBookCsv').mockResolvedValue(undefined);
        vi.spyOn(gl, 'getGLAccounts').mockResolvedValue([]);
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
            root.render(
                <MemoryRouter>
                    <DayBook />
                </MemoryRouter>,
            );
        });
        await act(async () => {});
    }

    function text(): string {
        return container.textContent ?? '';
    }

    function typeSelect(): HTMLSelectElement {
        const select = Array.from(container.querySelectorAll('select')).find((node) =>
            Array.from(node.options).some((option) => option.textContent === 'Receipt'),
        );
        if (!select) throw new Error('Type select not found');
        return select;
    }

    it('renders four vouchers, party, group cards, and a balanced period total', async () => {
        await renderPage();

        expect(container.querySelectorAll('[data-voucher-row]')).toHaveLength(4);
        expect(text()).toContain('Acme');
        expect(text()).toContain('Sales');
        expect(text()).toContain('Receipts');
        expect(text()).toContain('100.00');
        expect(text()).not.toContain('127.50');
        expect(text()).toContain('40.00');
        expect(text()).toContain('Balanced');
        expect(text()).toContain('190.00');
        expect(text()).toContain('217.50');
        const invoiceRow = container.querySelector('[data-voucher-row="1"]');
        expect(invoiceRow?.textContent).toContain('100.00');
        expect(invoiceRow?.textContent).not.toContain('127.50');
    });

    it('expands the invoice row to its four account lines including COGS', async () => {
        await renderPage();

        expect(text()).not.toContain('Cost of Goods Sold');

        const invoice = container.querySelector('[data-voucher-row="1"]') as HTMLElement;
        expect(invoice).toBeTruthy();
        await act(async () => {
            invoice.click();
        });

        expect(text()).toContain('Accounts Receivable');
        expect(text()).toContain('Sales Revenue');
        expect(text()).toContain('Cost of Goods Sold');
        const lines = container.querySelectorAll('[data-line-row="1"]');
        expect(lines).toHaveLength(4);
        expect(text()).toContain('27.50');
    });

    it('marks a reversed voucher and its reversal', async () => {
        await renderPage();

        const reversed = container.querySelector('[data-voucher-row="3"]');
        const reversal = container.querySelector('[data-voucher-row="4"]');
        expect(reversed?.textContent).toContain('Reversed');
        expect(reversal?.textContent).toContain('Reversal');
    });

    it('refetches when the type filter changes to Receipt', async () => {
        await renderPage();

        const select = typeSelect();
        await act(async () => {
            select.value = 'payment';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });

        expect(gl.getDayBook).toHaveBeenLastCalledWith(
            expect.objectContaining({ sourceType: 'payment' }),
        );
    });

    it('shows the error banner and no zero totals when the day book request fails', async () => {
        vi.spyOn(gl, 'getDayBook').mockRejectedValue(new Error('Ledger unavailable'));
        await renderPage();

        expect(text()).toContain('Ledger unavailable');
        expect(text()).not.toContain('0.00');
        expect(text()).not.toContain('190.00');
        expect(text()).not.toContain('Balanced');
        expect(container.querySelector('[data-voucher-row]')).toBeNull();
    });

    it('export CSV uses the current dates', async () => {
        await renderPage();

        const dates = Array.from(container.querySelectorAll('input[type="date"]')) as HTMLInputElement[];
        const csv = Array.from(container.querySelectorAll('button')).find((button) =>
            button.textContent?.includes('Export CSV'),
        );
        expect(csv).toBeTruthy();

        await act(async () => {
            csv!.click();
        });

        expect(gl.downloadDayBookCsv).toHaveBeenCalledTimes(1);
        expect(gl.downloadDayBookCsv).toHaveBeenCalledWith({
            startDate: dates[0].value,
            endDate: dates[1].value,
        });
    });
});
