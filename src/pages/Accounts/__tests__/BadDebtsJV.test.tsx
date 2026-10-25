import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getInvoices, getCustomers, getGLAccounts } = vi.hoisted(() => ({
    getInvoices: vi.fn(),
    getCustomers: vi.fn(),
    getGLAccounts: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
    getInvoices,
    getCustomers,
}));

vi.mock('../../../services/glService', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/glService')>();
    return { ...actual, getGLAccounts };
});

vi.mock('../../../api/axios', () => ({
    authFetch: vi.fn(),
}));

import BadDebtsJV from '../BadDebtsJV';

function mount() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    act(() => {
        root.render(
            <MemoryRouter>
                <BadDebtsJV />
            </MemoryRouter>,
        );
    });
    return { container, root };
}

describe('BadDebtsJV preview labels', () => {
    let root: Root | null = null;

    beforeEach(() => {
        getInvoices.mockResolvedValue([]);
        getCustomers.mockResolvedValue([]);
        localStorage.clear();
    });

    afterEach(() => {
        if (root) {
            act(() => root!.unmount());
            root = null;
        }
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('renders tenant COA codes in the live JV preview', async () => {
        getGLAccounts.mockResolvedValue([
            {
                id: 10,
                code: '6070',
                name: 'Bad Debt Write-Off',
                type: 'expense',
                system_key: 'bad_debt_expense',
                normal_balance: 'debit',
                parent_id: null,
                is_active: true,
                tenant_id: 4,
                created_at: null,
                updated_at: null,
            },
            {
                id: 11,
                code: '1100',
                name: 'Trade Receivable',
                type: 'asset',
                system_key: 'accounts_receivable',
                normal_balance: 'debit',
                parent_id: null,
                is_active: true,
                tenant_id: 4,
                created_at: null,
                updated_at: null,
            },
        ]);

        const { container, root: r } = mount();
        root = r;
        await act(async () => {
            await Promise.resolve();
        });

        const text = container.textContent ?? '';
        expect(text).toContain('6070');
        expect(text).toContain('1100');
        expect(text).not.toMatch(/\b5250\b/);
        expect(text).not.toMatch(/\b1120\b/);
    });

    it('renders fallback labels without numeric codes when COA is empty', async () => {
        getGLAccounts.mockResolvedValue([]);
        localStorage.removeItem('chart_of_accounts');

        const { container, root: r } = mount();
        root = r;
        await act(async () => {
            await Promise.resolve();
        });

        const text = container.textContent ?? '';
        expect(text).toContain('Dr Bad Debt Expense');
        expect(text).toContain('Cr Accounts Receivable');
        expect(text).not.toMatch(/\b5250\b/);
        expect(text).not.toMatch(/\b1120\b/);
    });
});
