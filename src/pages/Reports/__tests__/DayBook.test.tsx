import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayBookResponse } from '../../../services/glService';

const { getDayBook, downloadDayBookCsv, getGLAccounts, pdfSave } = vi.hoisted(() => ({
    getDayBook: vi.fn(),
    downloadDayBookCsv: vi.fn(),
    getGLAccounts: vi.fn(),
    pdfSave: vi.fn(),
}));

vi.mock('../../../services/glService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/glService')>();
    return {
        ...actual,
        getDayBook,
        downloadDayBookCsv,
        getGLAccounts,
    };
});

vi.mock('../../../services/settingsService', () => ({
    formatCurrency: (amount: number) => {
        const formatted = amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `$${formatted}`;
    },
}));

vi.mock('jspdf', () => ({
    default: vi.fn(function MockJsPDF(this: { setFontSize: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn>; save: typeof pdfSave }) {
        this.setFontSize = vi.fn();
        this.text = vi.fn();
        this.save = pdfSave;
    }),
}));

vi.mock('jspdf-autotable', () => ({
    default: vi.fn(),
}));

import DayBook from '../DayBook';

function line(
    account_id: number,
    code: string,
    name: string,
    type: string,
    debit: number,
    credit: number,
    memo: string,
) {
    return {
        account_id,
        account_code: code,
        account_name: name,
        account_type: type,
        debit,
        credit,
        memo,
        customer_id: null,
        supplier_id: null,
    };
}

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
                line(11, '1100', 'Accounts Receivable', 'asset', 100, 0, 'AR'),
                line(40, '4000', 'Sales Revenue', 'revenue', 0, 100, 'Sales'),
                line(50, '5000', 'Cost of Goods Sold', 'expense', 27.5, 0, 'COGS'),
                line(12, '1200', 'Inventory', 'asset', 0, 27.5, 'Inventory'),
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
                line(10, '1000', 'Cash on Hand', 'asset', 40, 0, 'Cash'),
                line(11, '1100', 'Accounts Receivable', 'asset', 0, 40, 'AR relief'),
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
                line(60, '6000', 'Operating Expenses', 'expense', 25, 0, 'Supplies'),
                line(10, '1000', 'Cash on Hand', 'asset', 0, 25, 'Cash out'),
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
                line(10, '1000', 'Cash on Hand', 'asset', 25, 0, 'Restore cash'),
                line(60, '6000', 'Operating Expenses', 'expense', 0, 25, 'Reverse supplies'),
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

const TENANT7_OCTOBER: DayBookResponse = {
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    entries: [
        {
            id: 1955,
            entry_number: 'JE-01955',
            entry_date: '2026-10-23',
            created_at: '2026-10-23T10:10:00',
            source_type: 'invoice',
            voucher_type: 'SALES',
            group: 'sales',
            memo: 'Invoice INV-015014',
            status: 'posted',
            party_type: 'customer',
            party_name: 'Bronx Diesel Repair Corp',
            party_id: 1,
            total_debit: 97.06,
            total_credit: 97.06,
            amount: 58.05,
            amount_basis: 'party',
            lines: [
                line(1100, '1100', 'Accounts Receivable', 'asset', 58.05, 0, 'AR'),
                line(4000, '4000', 'Sales Revenue', 'revenue', 0, 58.05, 'Sales'),
                line(5000, '5000', 'Cost of Goods Sold', 'expense', 39.01, 0, 'COGS'),
                line(1200, '1200', 'Inventory', 'asset', 0, 39.01, 'Inventory'),
            ],
        },
        {
            id: 1956,
            entry_number: 'JE-01956',
            entry_date: '2026-10-23',
            created_at: '2026-10-23T10:11:00',
            source_type: 'payment',
            voucher_type: 'RECEIPT',
            group: 'receipts',
            memo: 'Customer payment',
            status: 'posted',
            party_type: 'customer',
            party_name: 'Bronx Diesel Repair Corp',
            party_id: 1,
            total_debit: 58.05,
            total_credit: 58.05,
            amount: 58.05,
            amount_basis: 'party',
            lines: [
                line(1011, '1011', 'Bank', 'asset', 58.05, 0, 'Bank in'),
                line(1100, '1100', 'Accounts Receivable', 'asset', 0, 58.05, 'AR relief'),
            ],
        },
        {
            id: 1957,
            entry_number: 'JE-01957',
            entry_date: '2026-10-23',
            created_at: '2026-10-23T10:32:00',
            source_type: 'expense',
            voucher_type: 'EXPENSE',
            group: 'expenses',
            memo: 'jjj',
            status: 'posted',
            party_type: null,
            party_name: null,
            party_id: null,
            total_debit: 40,
            total_credit: 40,
            amount: 40,
            amount_basis: 'debit_total',
            lines: [
                line(6050, '6050', 'General Expenses', 'expense', 40, 0, 'Expense'),
                line(1011, '1011', 'Bank', 'asset', 0, 40, 'Bank out'),
            ],
        },
        {
            id: 2560,
            entry_number: 'JE-02560',
            entry_date: '2026-10-27',
            created_at: '2026-10-27T10:16:00',
            source_type: 'grn',
            voucher_type: 'PURCHASE',
            group: 'purchases',
            memo: 'GRN-2026-3155 @ Main Warehouse',
            status: 'posted',
            party_type: 'supplier',
            party_name: 'Erie Shore Petroleum Products',
            party_id: 2,
            total_debit: 58.05,
            total_credit: 58.05,
            amount: 58.05,
            amount_basis: 'party',
            lines: [
                line(1200, '1200', 'Inventory', 'asset', 58.05, 0, 'Inventory'),
                line(2000, '2000', 'Accounts Payable', 'liability', 0, 58.05, 'AP'),
            ],
        },
    ],
    summary: {
        entry_count: 4,
        total_debit: 253.16,
        total_credit: 253.16,
        total_amount: 214.15,
        balanced: true,
        by_type: [
            { source_type: 'invoice', voucher_type: 'SALES', group: 'sales', count: 1, total_debit: 97.06, total_credit: 97.06, total_amount: 58.05 },
            { source_type: 'payment', voucher_type: 'RECEIPT', group: 'receipts', count: 1, total_debit: 58.05, total_credit: 58.05, total_amount: 58.05 },
            { source_type: 'expense', voucher_type: 'EXPENSE', group: 'expenses', count: 1, total_debit: 40, total_credit: 40, total_amount: 40 },
            { source_type: 'grn', voucher_type: 'PURCHASE', group: 'purchases', count: 1, total_debit: 58.05, total_credit: 58.05, total_amount: 58.05 },
        ],
        by_day: [
            { date: '2026-10-23', count: 3, total_debit: 195.11, total_credit: 195.11, total_amount: 156.1 },
            { date: '2026-10-27', count: 1, total_debit: 58.05, total_credit: 58.05, total_amount: 58.05 },
        ],
    },
};

const EMPTY_BOOK: DayBookResponse = {
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    entries: [],
    summary: {
        entry_count: 0,
        total_debit: 0,
        total_credit: 0,
        total_amount: 0,
        balanced: true,
        by_type: [],
        by_day: [],
    },
};

describe('DayBook', () => {
    let container: HTMLDivElement;
    let root: Root;

    async function renderPage() {
        await act(async () => {
            root.render(
                <MemoryRouter>
                    <DayBook />
                </MemoryRouter>,
            );
        });
        for (let i = 0; i < 12; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }
    }

    function text(): string {
        return container.textContent ?? '';
    }

    function fromInput(): HTMLInputElement {
        const input = container.querySelector('input[aria-label="From"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        return input;
    }

    function typeSelect(): HTMLSelectElement {
        const select = Array.from(container.querySelectorAll('select')).find((node) =>
            Array.from(node.options).some((option) => option.textContent === 'Receipt'),
        );
        if (!select) throw new Error('Type select not found');
        return select;
    }

    function clickButton(label: string) {
        const btn = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes(label));
        expect(btn).toBeTruthy();
        act(() => {
            btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
    }

    describe('Day Book page', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));
            container = document.createElement('div');
            document.body.appendChild(container);
            root = createRoot(container);
            getDayBook.mockReset();
            getDayBook.mockResolvedValue(mockBook);
            downloadDayBookCsv.mockReset();
            downloadDayBookCsv.mockResolvedValue(undefined);
            getGLAccounts.mockReset();
            getGLAccounts.mockResolvedValue([]);
        });

        afterEach(() => {
            act(() => {
                root.unmount();
            });
            container.remove();
            vi.useRealTimers();
        });

        it('renders four vouchers, party, group cards, and a balanced period total', async () => {
            await renderPage();

            expect(getDayBook).toHaveBeenCalledWith(
                expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' }),
            );
            expect(fromInput().value).toBe('2026-10-01');

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

            expect(getDayBook).toHaveBeenLastCalledWith(
                expect.objectContaining({ sourceType: 'payment' }),
            );
        });

        it('shows the error banner and no zero totals when the day book request fails', async () => {
            getDayBook.mockRejectedValue(new Error('Ledger unavailable'));
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
            expect(dates[0].value).toBe('2026-10-01');
            expect(dates[1].value).toBe('2026-10-31');
            const csv = Array.from(container.querySelectorAll('button')).find((button) =>
                button.textContent?.includes('Export CSV'),
            );
            expect(csv).toBeTruthy();

            await act(async () => {
                csv!.click();
            });

            expect(downloadDayBookCsv).toHaveBeenCalledTimes(1);
            expect(downloadDayBookCsv).toHaveBeenCalledWith({
                startDate: dates[0].value,
                endDate: dates[1].value,
            });
        });
    });

    describe('tenant-7 period controls', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));
            container = document.createElement('div');
            document.body.appendChild(container);
            root = createRoot(container);
            getDayBook.mockReset();
            getDayBook.mockResolvedValue(TENANT7_OCTOBER);
            downloadDayBookCsv.mockReset();
            downloadDayBookCsv.mockResolvedValue(undefined);
            getGLAccounts.mockReset();
            getGLAccounts.mockResolvedValue([]);
            pdfSave.mockReset();
        });

        afterEach(() => {
            act(() => {
                root.unmount();
            });
            container.remove();
            vi.useRealTimers();
        });

        it('loads this month by default, shows tenant-7 totals, Today/This month refetch, export PDF, and empty state', async () => {
            await renderPage();

            expect(getDayBook).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' }));
            expect(fromInput().value).toBe('2026-10-01');

            expect(text()).toContain('4');
            expect(text().match(/\$58\.05/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
            expect(text()).toContain('$40.00');
            expect(text().match(/\$253\.16/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
            expect(text()).toContain('$214.15');
            expect(text()).toContain('Balanced');
            expect(text()).toContain('JE-01955');
            expect(text()).toContain('JE-01956');
            expect(text()).toContain('JE-01957');
            expect(text()).toContain('JE-02560');
            expect(text()).toContain('Day book');
            expect(text()).not.toContain('DAY BOOK');

            getDayBook.mockClear();
            clickButton('Today');
            for (let i = 0; i < 8; i += 1) {
                await act(async () => {
                    await Promise.resolve();
                });
            }
            expect(getDayBook).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-10-31', endDate: '2026-10-31' }));

            getDayBook.mockClear();
            clickButton('This month');
            for (let i = 0; i < 8; i += 1) {
                await act(async () => {
                    await Promise.resolve();
                });
            }
            expect(getDayBook).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2026-10-01', endDate: '2026-10-31' }));

            const csvBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Export CSV'));
            const pdfBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Export PDF'));
            expect(csvBtn).toBeTruthy();
            expect(pdfBtn).toBeTruthy();
            expect((pdfBtn as HTMLButtonElement).disabled).toBe(false);

            act(() => {
                pdfBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
            expect(pdfSave).toHaveBeenCalledWith('DayBook_2026-10-01_to_2026-10-31.pdf');
        });

        it('shows empty state without NaN when the day book has no vouchers', async () => {
            getDayBook.mockResolvedValue(EMPTY_BOOK);
            await renderPage();

            expect(text()).toContain('No vouchers posted for this period');
            expect(text()).not.toContain('$NaN');
        });
    });
});
