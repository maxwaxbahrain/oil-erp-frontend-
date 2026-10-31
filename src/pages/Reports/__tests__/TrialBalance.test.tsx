import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getGLTrialBalance } = vi.hoisted(() => ({
    getGLTrialBalance: vi.fn(),
}));

vi.mock('../../../services/glService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/glService')>();
    return { ...actual, getGLTrialBalance };
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

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => vi.fn() };
});

import TrialBalance from '../TrialBalance';
import type { GLTrialBalance, GLTrialBalanceRow } from '../../../services/glService';

function row(partial: Partial<GLTrialBalanceRow> & Pick<GLTrialBalanceRow, 'code' | 'name' | 'type' | 'debit' | 'credit'>): GLTrialBalanceRow {
    const account_id = partial.account_id ?? Number(partial.code);
    const balance = partial.balance ?? round2(partial.debit - partial.credit);
    return {
        normal_balance: 'debit',
        ...partial,
        account_id,
        balance,
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

const TENANT7_ROWS: GLTrialBalanceRow[] = [
    row({ code: '1000', name: 'Cash on Hand', type: 'asset', debit: 2324986.34, credit: 68019.83 }),
    row({ code: '1010', name: 'Bank', type: 'asset', debit: 6295371.54, credit: 9854908.74 }),
    row({ code: '1011', name: 'Test Bank 2', type: 'asset', debit: 58.05, credit: 40.0 }),
    row({ code: '1100', name: 'Accounts Receivable', type: 'asset', debit: 2953478.92, credit: 2667107.16 }),
    row({ code: '1200', name: 'Inventory', type: 'asset', debit: 15447037.89, credit: 4318762.9 }),
    row({ code: '2000', name: 'Accounts Payable', type: 'liability', debit: 9734327.8, credit: 10816814.23 }),
    row({ code: '3000', name: 'Owner Capital', type: 'equity', debit: 0, credit: 6690000.0 }),
    row({ code: '3200', name: 'Opening Balance Equity', type: 'equity', debit: 0, credit: 2491227.79 }),
    row({ code: '4000', name: 'Sales Revenue', type: 'revenue', debit: 0, credit: 2953478.92 }),
    row({ code: '4050', name: 'Sales Returns', type: 'revenue', debit: 161341.49, credit: 0 }),
    row({ code: '5000', name: 'Cost of Goods Sold', type: 'expense', debit: 4278030.75, credit: 2138995.87 }),
    row({ code: '6050', name: 'General Expenses', type: 'expense', debit: 229372.92, credit: 0 }),
    row({ code: '6070', name: 'Bad Debt Expense', type: 'expense', debit: 575349.74, credit: 0 }),
];

function tbPayload(asOf: string): GLTrialBalance {
    return {
        as_of: asOf,
        accounts: TENANT7_ROWS,
        total_debit: 41999355.44,
        total_credit: 41999355.44,
        is_balanced: true,
    };
}

describe('TrialBalance', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-30T12:00:00'));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        getGLTrialBalance.mockReset();
        getGLTrialBalance.mockImplementation(async (asOf?: string) => tbPayload(asOf || '2026-10-30'));
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
        vi.useRealTimers();
    });

    async function renderPage() {
        await act(async () => {
            root.render(
                <MemoryRouter>
                    <TrialBalance />
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

    function clickButton(label: string) {
        const buttons = Array.from(container.querySelectorAll('button'));
        const btn = buttons.find(b => (b.textContent ?? '').includes(label));
        expect(btn, `button "${label}"`).toBeTruthy();
        act(() => {
            btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
    }

    function setAsOfInput(value: string) {
        const input = container.querySelector('input[type="date"][aria-label="As of"]') as HTMLInputElement;
        expect(input).toBeTruthy();
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        act(() => {
            setter?.call(input, value);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    function toggleGross() {
        const box = container.querySelector('input[aria-label="Show gross movements"]') as HTMLInputElement;
        expect(box).toBeTruthy();
        act(() => {
            box.click();
        });
    }

    function tableRowForAccount(label: string): HTMLTableRowElement {
        const rows = Array.from(container.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
        const rowEl = rows.find(r => (r.cells[0]?.textContent ?? '').includes(label));
        expect(rowEl, `row for ${label}`).toBeTruthy();
        return rowEl!;
    }

    it('net view: totals, sample accounts, balanced banner, and heading date', async () => {
        await renderPage();

        expect(getGLTrialBalance).toHaveBeenCalledWith('2026-10-30');

        const body = text();
        expect(body).toContain('Trial balance is balanced');
        const totalMatches = body.match(/\$16,776,730\.34/g) ?? [];
        expect(totalMatches.length).toBeGreaterThanOrEqual(3);
        expect(body).toContain('$1,082,486.43');
        expect(body).toContain('$11,128,274.99');
        expect(body).toContain('Trial balance — as of');

        const bankRow = tableRowForAccount('1010 — Bank');
        expect(bankRow.cells[2].textContent?.trim()).toBe('—');
        expect(bankRow.cells[3].textContent?.trim()).toBe('$3,559,537.20');
    });

    it('gross view: API totals when switch is on', async () => {
        await renderPage();
        toggleGross();
        for (let i = 0; i < 4; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        const body = text();
        const matches = body.match(/\$41,999,355\.44/g) ?? [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
        expect(body).toContain('gross movements');
    });

    it('presets and date input call getGLTrialBalance with exact as_of dates', async () => {
        await renderPage();
        getGLTrialBalance.mockClear();

        clickButton('End of last month');
        for (let i = 0; i < 4; i += 1) {
            await act(async () => { await Promise.resolve(); });
        }
        expect(getGLTrialBalance).toHaveBeenLastCalledWith('2026-09-30');

        clickButton('End of last quarter');
        for (let i = 0; i < 4; i += 1) {
            await act(async () => { await Promise.resolve(); });
        }
        expect(getGLTrialBalance).toHaveBeenLastCalledWith('2026-09-30');

        clickButton('End of last year');
        for (let i = 0; i < 4; i += 1) {
            await act(async () => { await Promise.resolve(); });
        }
        expect(getGLTrialBalance).toHaveBeenLastCalledWith('2025-12-31');

        getGLTrialBalance.mockClear();
        setAsOfInput('2026-06-15');
        for (let i = 0; i < 4; i += 1) {
            await act(async () => { await Promise.resolve(); });
        }
        expect(getGLTrialBalance).toHaveBeenLastCalledWith('2026-06-15');
    });

    it('heading reflects chosen as_of from API response', async () => {
        getGLTrialBalance.mockImplementation(async () => tbPayload('2026-06-15'));
        await renderPage();
        setAsOfInput('2026-06-15');
        for (let i = 0; i < 6; i += 1) {
            await act(async () => { await Promise.resolve(); });
        }
        expect(text()).toContain('Jun 15');
        const input = container.querySelector('input[type="date"][aria-label="As of"]') as HTMLInputElement;
        expect(input.value).toBe('2026-06-15');
    });
});
