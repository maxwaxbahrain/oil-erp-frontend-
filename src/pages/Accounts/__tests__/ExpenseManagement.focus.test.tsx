import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { reloadBanks, getExpensesSnapshot, getExpenseCategories, getSalesOrders, getCustomers } = vi.hoisted(() => ({
    reloadBanks: vi.fn(),
    getExpensesSnapshot: vi.fn(async () => ({ stale: false, expenses: [] })),
    getExpenseCategories: vi.fn(async () => []),
    getSalesOrders: vi.fn(async () => []),
    getCustomers: vi.fn(async () => []),
}));

vi.mock('../../../hooks/useBankingAccounts', () => ({
    useBankingAccounts: () => ({ banks: [], defaultBank: null, reload: reloadBanks }),
}));

vi.mock('../../../services/expenseService', () => ({
    getExpensesSnapshot,
    getExpenseCategories,
    saveExpense: vi.fn(),
    deleteExpense: vi.fn(),
    exportExpensesAsCSV: vi.fn(() => ''),
    extractExpenseFromReceipt: vi.fn(),
    suggestExpenseCategory: vi.fn(),
    resolveCoaCategoryName: vi.fn(),
}));

vi.mock('../../../services/salesService', () => ({
    getSalesOrders,
}));

vi.mock('../../../services/customerService', () => ({
    getCustomers,
}));

import ExpenseManagement from '../ExpenseManagement';

describe('expense bank list refresh', () => {
    beforeEach(() => {
        reloadBanks.mockClear();
        getExpensesSnapshot.mockClear();
        getExpenseCategories.mockClear();
    });

    it('reloads banks when the window regains focus', async () => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        let root: Root;
        await act(async () => {
            root = createRoot(host);
            root.render(
                <MemoryRouter>
                    <ExpenseManagement />
                </MemoryRouter>,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(reloadBanks).not.toHaveBeenCalled();
        await act(async () => {
            window.dispatchEvent(new Event('focus'));
        });
        expect(reloadBanks).toHaveBeenCalledTimes(1);
        act(() => root.unmount());
        host.remove();
    });
});
