import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GLBalanceSheet, GLCashFlow, GLProfitLoss } from '../../../services/glService';

const {
    getGLBalanceSheet,
    getGLCashFlow,
    getGLProfitLoss,
    getInvoices,
    getCustomerPayments,
    getExpenses,
    getGRNs,
    getSuppliers,
    getSupplierPayments,
    getAccounts,
    calculateProfitLoss,
    calculateCashFlow,
    calculateBalanceSheet,
} = vi.hoisted(() => ({
    getGLBalanceSheet: vi.fn(),
    getGLCashFlow: vi.fn(),
    getGLProfitLoss: vi.fn(),
    getInvoices: vi.fn(),
    getCustomerPayments: vi.fn(),
    getExpenses: vi.fn(),
    getGRNs: vi.fn(),
    getSuppliers: vi.fn(),
    getSupplierPayments: vi.fn(),
    getAccounts: vi.fn(),
    calculateProfitLoss: vi.fn(),
    calculateCashFlow: vi.fn(),
    calculateBalanceSheet: vi.fn(),
}));

vi.mock('../../../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/api')>();
    return { ...actual, getInvoices, getCustomerPayments };
});

vi.mock('../../../services/purchasesService', () => ({
    getSuppliers,
    getSupplierPayments,
}));

vi.mock('../../../services/expenseService', () => ({
    getExpenses,
}));

vi.mock('../../../services/grnService', () => ({
    getGRNs,
}));

vi.mock('../../Accounts/ChartOfAccounts', () => ({
    getAccounts,
}));

vi.mock('../../../services/profitLossService', () => ({
    calculateProfitLoss,
    calculateCashFlow,
}));

vi.mock('../../../services/balanceSheetService', () => ({
    calculateBalanceSheet,
}));

vi.mock('../../../utils/documentGenerator', () => ({
    generateStandardPDF: vi.fn(),
}));

vi.mock('recharts', () => ({
    BarChart: ({ children }: { children?: React.ReactNode }) => <div data-testid="barchart">{children}</div>,
    Bar: () => null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
}));

vi.mock('../../../services/glService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/glService')>();
    return {
        ...actual,
        getGLBalanceSheet,
        getGLCashFlow,
        getGLProfitLoss,
        todayISO: () => '2026-10-31',
        yearStartISO: () => '2026-01-01',
    };
});

import FinancialStatement from '../FinancialStatement';

const MOCK_BS: GLBalanceSheet = {
    as_of: '2026-10-31',
    assets: [{ account_id: 1, code: '1000', name: 'Cash', type: 'asset', system_key: 'cash_on_hand', normal_balance: 'debit', debit: 0, credit: 0, balance: 10112094.11 }],
    total_assets: 10112094.11,
    liabilities: [{ account_id: 2, code: '2000', name: 'Accounts Payable', type: 'liability', system_key: 'accounts_payable', normal_balance: 'credit', debit: 0, credit: 0, balance: 1082486.43 }],
    total_liabilities: 1082486.43,
    equity: [{ account_id: 3, code: '3000', name: 'Equity', type: 'equity', system_key: 'owner_capital', normal_balance: 'credit', debit: 0, credit: 0, balance: 9029607.68 }],
    equity_accounts_total: 9029607.68,
    net_income: -151620.11,
    total_equity: 8877987.57,
    is_balanced: true,
};

const MOCK_PL: GLProfitLoss = {
    start: '2026-01-01',
    end: '2026-10-31',
    revenue: 100,
    revenue_lines: [],
    cogs: 10,
    gross_profit: 90,
    operating_expenses: 20,
    expense_lines: [],
    net_income: 70,
};

const MOCK_CF: GLCashFlow = {
    start: '2026-01-01',
    end: '2026-10-31',
    opening_cash: 0,
    closing_cash: 0,
    net_change: 0,
    sections: {
        operating: { line_items: [], total_inflows: 0, total_outflows: 0 },
        financing: { line_items: [], total_inflows: 0, total_outflows: 0 },
        investing: { line_items: [], total_inflows: 0, total_outflows: 0 },
    },
};

describe('FinancialStatement periods and liabilities', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        getInvoices.mockResolvedValue([]);
        getCustomerPayments.mockResolvedValue([]);
        getExpenses.mockResolvedValue([]);
        getGRNs.mockResolvedValue([]);
        getSuppliers.mockResolvedValue([]);
        getSupplierPayments.mockResolvedValue([]);
        getAccounts.mockReturnValue([]);
        calculateProfitLoss.mockResolvedValue(null);
        calculateCashFlow.mockResolvedValue(null);
        calculateBalanceSheet.mockResolvedValue(null);

        getGLBalanceSheet.mockResolvedValue(MOCK_BS);
        getGLProfitLoss.mockResolvedValue(MOCK_PL);
        getGLCashFlow.mockResolvedValue(MOCK_CF);
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
                    <FinancialStatement />
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

    function clickButtonMatching(substring: string) {
        const btn = Array.from(container.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes(substring),
        );
        expect(btn).toBeTruthy();
        act(() => {
            btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
    }

    it('loads GL for YTD, shows as-of and positive liabilities, last-year pill, labels, and non-sticky AI bar', async () => {
        await renderPage();

        expect(getGLBalanceSheet).toHaveBeenCalledWith('2026-10-31');
        expect(getGLProfitLoss).toHaveBeenCalledWith('2026-01-01', '2026-10-31');

        expect(text()).toMatch(/As of.*Oct.*31/i);
        expect(text()).toContain('$1,082,486');
        expect(text()).not.toMatch(/[-−]\$1,082,486/);

        getGLBalanceSheet.mockClear();
        getGLProfitLoss.mockClear();
        getGLCashFlow.mockClear();

        clickButtonMatching('Last year');
        for (let i = 0; i < 8; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(getGLBalanceSheet).toHaveBeenCalledWith('2025-12-31');
        expect(getGLProfitLoss).toHaveBeenCalledWith('2025-01-01', '2025-12-31');

        expect(text()).toContain('Net income (to date)');
        expect(text()).not.toContain('Net income (YTD)');
        expect(text()).not.toContain('General Ledger module');

        const askAiLabel = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === 'Ask AI CFO');
        const askAiPanel = askAiLabel?.closest('div')?.parentElement as HTMLElement | null;
        expect(askAiPanel?.style.position).not.toBe('sticky');
    });
});
