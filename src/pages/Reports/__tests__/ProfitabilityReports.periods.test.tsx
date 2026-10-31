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
    getProducts,
    calculateProfitLoss,
    calculateCashFlow,
    calculateBalanceSheet,
    calculateDimensionalAnalysis,
    calculateFinancialRatios,
} = vi.hoisted(() => ({
    getGLBalanceSheet: vi.fn(),
    getGLCashFlow: vi.fn(),
    getGLProfitLoss: vi.fn(),
    getInvoices: vi.fn(),
    getProducts: vi.fn(),
    calculateProfitLoss: vi.fn(),
    calculateCashFlow: vi.fn(),
    calculateBalanceSheet: vi.fn(),
    calculateDimensionalAnalysis: vi.fn(),
    calculateFinancialRatios: vi.fn(),
}));

vi.mock('../../../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/api')>();
    return { ...actual, getInvoices, getProducts };
});

vi.mock('../../../services/profitLossService', () => ({
    calculateProfitLoss,
    calculateCashFlow,
    calculateDimensionalAnalysis,
    calculateFinancialRatios,
    getKnownProductUnitCost: vi.fn(),
}));

vi.mock('../../../services/balanceSheetService', () => ({
    calculateBalanceSheet,
}));

vi.mock('../../../services/settingsService', () => ({
    formatCurrency: (amount: number) => {
        const formatted = amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `$${formatted}`;
    },
}));

vi.mock('recharts', () => ({
    LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Line: () => null,
    BarChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Bar: () => null,
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
}));

vi.mock('../../../services/glService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/glService')>();
    return {
        ...actual,
        getGLBalanceSheet,
        getGLCashFlow,
        getGLProfitLoss,
    };
});

import ProfitabilityReports from '../ProfitabilityReports';

const EMPTY_GL_PL: GLProfitLoss = {
    start: '2026-01-01',
    end: '2026-10-31',
    revenue: 0,
    revenue_lines: [],
    cogs: 0,
    gross_profit: 0,
    operating_expenses: 0,
    expense_lines: [],
    net_income: 0,
};

const EMPTY_GL_BS: GLBalanceSheet = {
    as_of: '2026-10-31',
    assets: [{ account_id: 1, code: '1000', name: 'Cash', type: 'asset', system_key: 'cash_on_hand', normal_balance: 'debit', debit: 1, credit: 0, balance: 1 }],
    total_assets: 1,
    liabilities: [],
    total_liabilities: 0,
    equity: [],
    equity_accounts_total: 0,
    net_income: 0,
    total_equity: 0,
    is_balanced: true,
};

const EMPTY_GL_CF: GLCashFlow = {
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

describe('ProfitabilityReports period presets', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0));
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        getInvoices.mockResolvedValue([]);
        getProducts.mockResolvedValue([]);
        calculateProfitLoss.mockResolvedValue(null);
        calculateCashFlow.mockResolvedValue(null);
        calculateBalanceSheet.mockResolvedValue(null);
        calculateDimensionalAnalysis.mockResolvedValue(null);
        calculateFinancialRatios.mockResolvedValue(null);

        getGLBalanceSheet.mockResolvedValue(EMPTY_GL_BS);
        getGLProfitLoss.mockResolvedValue(EMPTY_GL_PL);
        getGLCashFlow.mockResolvedValue(EMPTY_GL_CF);
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
                    <ProfitabilityReports />
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

    it('shows 2026 preset labels, refetches GL on last quarter, no AED or vs Budget', async () => {
        await renderPage();

        expect(text()).toContain('2026');
        expect(text()).not.toContain('2023');
        expect(text()).not.toContain('2022');
        expect(text()).not.toContain('AED');
        expect(text()).not.toContain('vs Budget');

        getGLProfitLoss.mockClear();
        getGLBalanceSheet.mockClear();
        getGLCashFlow.mockClear();

        const lastQuarterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Last quarter'),
        );
        expect(lastQuarterBtn).toBeTruthy();
        act(() => {
            lastQuarterBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        for (let i = 0; i < 8; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }

        expect(getGLProfitLoss).toHaveBeenCalledWith('2026-07-01', '2026-09-30');
    });
});
