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
    getKnownProductUnitCost: vi.fn(() => 0),
    calculateProfitLoss,
    calculateCashFlow,
    calculateDimensionalAnalysis,
    calculateFinancialRatios,
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
        return amount < 0 ? `-$${formatted.replace('-', '')}` : `$${formatted}`;
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

const GL_PL: GLProfitLoss = {
    start: '2026-01-01',
    end: '2026-10-31',
    revenue: 2135700.02,
    revenue_lines: [],
    cogs: 1646840.94,
    gross_profit: 488859.08,
    operating_expenses: 751809.42,
    expense_lines: [],
    net_income: -262950.34,
};

const GL_BS: GLBalanceSheet = {
    as_of: '2026-10-31',
    assets: [
        { account_id: 1, code: '1200', name: 'Accounts Receivable', type: 'asset', system_key: 'accounts_receivable', normal_balance: 'debit', debit: 286371.76, credit: 0, balance: 286371.76 },
        { account_id: 2, code: '1300', name: 'Inventory', type: 'asset', system_key: 'inventory', normal_balance: 'debit', debit: 11128274.99, credit: 0, balance: 11128274.99 },
    ],
    total_assets: 10112094.11,
    liabilities: [
        { account_id: 3, code: '2000', name: 'Accounts Payable', type: 'liability', system_key: 'accounts_payable', normal_balance: 'credit', debit: 0, credit: 1082486.43, balance: 1082486.43 },
    ],
    total_liabilities: 1082486.43,
    equity: [],
    equity_accounts_total: 9029607.68,
    net_income: -151620.11,
    total_equity: 9029607.68,
    is_balanced: true,
};

const GL_CF: GLCashFlow = {
    start: '2026-01-01',
    end: '2026-10-31',
    opening_cash: 0,
    closing_cash: -1302552.64,
    net_change: -1302552.64,
    net_operating: 0,
    net_financing: 0,
    net_investing: 0,
    actual_closing: -1302552.64,
    is_reconciled: true,
    sections: {
        operating: { line_items: [], total_inflows: 0, total_outflows: 0 },
        financing: { line_items: [], total_inflows: 0, total_outflows: 0 },
        investing: { line_items: [], total_inflows: 0, total_outflows: 0 },
    },
};

describe('ProfitabilityReports GL-only statements', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-31T12:00:00'));
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

        getGLProfitLoss.mockResolvedValue(GL_PL);
        getGLBalanceSheet.mockResolvedValue(GL_BS);
        getGLCashFlow.mockResolvedValue(GL_CF);
    });

    afterEach(() => {
        act(() => root.unmount());
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

    function text() {
        return container.textContent ?? '';
    }

    it('GL-only P&L, ratios, balance label, no calculator calls, GL error retry', async () => {
        await renderPage();

        expect(text()).toContain('$2,135,700.02');
        expect(text()).toContain('-$262,950.34');
        expect(text()).not.toMatch(/Estimate/i);
        expect(text()).not.toMatch(/Based on invoices/i);

        expect(calculateProfitLoss).not.toHaveBeenCalled();
        expect(calculateCashFlow).not.toHaveBeenCalled();
        expect(calculateBalanceSheet).not.toHaveBeenCalled();
        expect(calculateFinancialRatios).not.toHaveBeenCalled();
        expect(calculateDimensionalAnalysis).not.toHaveBeenCalled();

        const ratiosTab = Array.from(container.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Financial ratios'),
        );
        await act(async () => {
            ratiosTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        for (let i = 0; i < 6; i += 1) {
            await act(async () => Promise.resolve());
        }

        expect(text()).toContain('22.9%');
        expect(text()).toContain('-12.3%');
        expect(text()).toMatch(/0\.1[0-9]x|0\.15x/);
        expect(text()).toMatch(/DSO \(days\)[\s\S]*\d/);

        const balanceTab = Array.from(container.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Balance sheet'),
        );
        await act(async () => {
            balanceTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        for (let i = 0; i < 6; i += 1) {
            await act(async () => Promise.resolve());
        }

        expect(text()).toContain('Net income (to date)');
        expect(text()).not.toContain('Net income (YTD)');
        expect(text()).not.toContain('AED');
        expect(text()).not.toContain('vs Budget');

        getGLProfitLoss.mockClear();
        const lastQuarterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Last quarter'),
        );
        await act(async () => {
            lastQuarterBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        for (let i = 0; i < 8; i += 1) {
            await act(async () => Promise.resolve());
        }
        expect(getGLProfitLoss).toHaveBeenCalledWith('2026-07-01', '2026-09-30');
    });

    it('shows GL P&L error panel with Retry when getGLProfitLoss rejects', async () => {
        getGLProfitLoss.mockRejectedValue(new Error('GL unavailable'));
        await renderPage();

        expect(text()).toContain('GL unavailable');
        expect(text()).not.toContain('$0.00');

        getGLProfitLoss.mockResolvedValue(GL_PL);
        const retryBtn = Array.from(container.querySelectorAll('button')).find((b) =>
            (b.textContent ?? '').includes('Retry'),
        );
        await act(async () => {
            retryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        for (let i = 0; i < 10; i += 1) {
            await act(async () => Promise.resolve());
        }
        expect(text()).toContain('$2,135,700.02');
    });
});
