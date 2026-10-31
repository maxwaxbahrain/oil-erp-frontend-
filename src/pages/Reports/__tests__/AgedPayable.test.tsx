import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgedPayableReport, AgedPayableSupplier } from '../../../services/api';

const { getAgedPayable, pdfSave, pdfText } = vi.hoisted(() => ({
    getAgedPayable: vi.fn(),
    pdfSave: vi.fn(),
    pdfText: vi.fn(),
}));

vi.mock('../../../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/api')>();
    return { ...actual, getAgedPayable };
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
    default: vi.fn(function MockJsPDF(this: { setFontSize: ReturnType<typeof vi.fn>; text: typeof pdfText; save: typeof pdfSave }) {
        this.setFontSize = vi.fn();
        this.text = pdfText;
        this.save = pdfSave;
    }),
}));

vi.mock('jspdf-autotable', () => ({
    default: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => vi.fn() };
});

import AgedPayable from '../AgedPayable';

function supplier(
    name: string,
    fields: Pick<
        AgedPayableSupplier,
        'supplier_id' | 'po_count' | 'current' | 'days30' | 'days60' | 'days90' | 'gross' | 'credits' | 'net' | 'ledger_closing'
    >,
): AgedPayableSupplier {
    return {
        supplier_name: name,
        lines: [],
        ...fields,
    };
}

const TENANT7_REPORT: AgedPayableReport = {
    as_of: '2026-10-31',
    gross: 3192121.19,
    credits: 3030880.15,
    net: 161241.04,
    gl_ap_balance: 161232.04,
    gl_difference: 9.0,
    suppliers: [
        supplier('Garden State Chemical Supply', {
            supplier_id: 'ap-1',
            po_count: 20,
            current: 0,
            days30: 0,
            days60: 0,
            days90: 1196231.61,
            gross: 1196231.61,
            credits: 1100000.0,
            net: 96231.61,
            ledger_closing: 96231.61,
        }),
        supplier('Erie Shore Petroleum Products', {
            supplier_id: 'ap-2',
            po_count: 22,
            current: 67.05,
            days30: 0,
            days60: 0,
            days90: 1064942.38,
            gross: 1065009.43,
            credits: 1000000.0,
            net: 65009.43,
            ledger_closing: 65009.43,
        }),
        supplier('Lone Star Coolant Corp', {
            supplier_id: 'ap-3',
            po_count: 20,
            current: 0,
            days30: 0,
            days60: 0,
            days90: 930880.15,
            gross: 930880.15,
            credits: 930880.15,
            net: 0,
            ledger_closing: 0,
        }),
    ],
};

describe('AgedPayable', () => {
    let container: HTMLDivElement;
    let root: Root;
    let getItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        getAgedPayable.mockReset();
        getAgedPayable.mockResolvedValue(TENANT7_REPORT);
        pdfSave.mockReset();
        pdfText.mockReset();
        getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        getItemSpy.mockRestore();
    });

    async function renderPage() {
        await act(async () => {
            root.render(
                <MemoryRouter>
                    <AgedPayable />
                </MemoryRouter>,
            );
        });
        for (let i = 0; i < 8; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }
    }

    function text(): string {
        return container.textContent ?? '';
    }

    function setSearch(value: string) {
        const input = container.querySelector('input[placeholder="Search supplier..."]') as HTMLInputElement;
        expect(input).toBeTruthy();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        act(() => {
            const lastValue = input.value;
            setter?.call(input, value);
            const tracker = (input as unknown as { _valueTracker?: { setValue: (v: string) => void } })._valueTracker;
            tracker?.setValue(lastValue);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    function grossFooterCell(): string {
        const rows = Array.from(container.querySelectorAll('tbody tr'));
        const grossRow = rows.find((row) => {
            const firstCell = row.querySelector('td');
            return (firstCell?.textContent ?? '').trim() === 'Gross';
        });
        expect(grossRow).toBeTruthy();
        const cells = grossRow!.querySelectorAll('td');
        return cells[cells.length - 1]?.textContent ?? '';
    }

    it('shows tenant-7 totals, GL card, supplier names, and Erie bucket cells', async () => {
        await renderPage();

        const body = text();
        expect(body).toContain('Garden State Chemical Supply');
        expect(body).toContain('Erie Shore Petroleum Products');
        expect(body).toContain('Lone Star Coolant Corp');
        expect(body).toContain('3 Suppliers with Outstanding Balances');
        expect(body).toContain('$3,192,121.19');
        expect(body).toContain('$3,030,880.15');
        expect(body).toContain('$161,241.04');
        expect(body).toContain('$161,232.04');
        expect(body).toContain('Difference $9.00');

        const rows = Array.from(container.querySelectorAll('tbody tr')).filter(
            (row) => row.textContent?.includes('Erie Shore Petroleum Products'),
        );
        expect(rows.length).toBeGreaterThan(0);
        const cells = rows[0].querySelectorAll('td');
        expect(cells[2]?.textContent).toContain('$67.05');
        expect(cells[5]?.textContent).toContain('$1,064,942.38');
    });

    it('calls getAgedPayable with a local ISO date and does not read supplier_payments from localStorage', async () => {
        await renderPage();

        expect(getAgedPayable).toHaveBeenCalledTimes(1);
        const asOfArg = getAgedPayable.mock.calls[0]?.[0] as string;
        expect(asOfArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const supplierPaymentReads = getItemSpy.mock.calls.filter((call) => call[0] === 'supplier_payments');
        expect(supplierPaymentReads).toHaveLength(0);
    });

    it('exports PDF with as_of filename and GL balance in document text', async () => {
        await renderPage();

        const exportBtn = Array.from(container.querySelectorAll('button')).find(
            (btn) => btn.textContent?.includes('Export PDF'),
        );
        expect(exportBtn).toBeTruthy();
        act(() => {
            exportBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(pdfSave).toHaveBeenCalledWith('AgedPayable_2026-10-31.pdf');
        expect(pdfText.mock.calls.some((call) => String(call[0]).includes('161,232.04'))).toBe(true);
    });

    it('filters suppliers and recomputes visible gross footer', async () => {
        await renderPage();

        setSearch('Erie');
        await act(async () => {
            await Promise.resolve();
        });

        expect(text()).toContain('1 Suppliers with Outstanding Balances');
        expect(text()).not.toContain('Garden State Chemical Supply');
        expect(grossFooterCell()).toContain('$1,065,009.43');
    });

    it('shows error panel and Retry without zero-dollar totals when the API fails', async () => {
        getAgedPayable.mockRejectedValueOnce(new Error('aged payable unavailable'));
        await renderPage();

        expect(text()).toContain('aged payable unavailable');
        expect(text()).toContain('Retry');
        expect(text()).not.toContain('$0.00');
    });
});
