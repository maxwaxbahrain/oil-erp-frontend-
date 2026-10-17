import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGLAccounts, getGLTrialBalance } = vi.hoisted(() => ({
    getGLAccounts: vi.fn(async () => []),
    getGLTrialBalance: vi.fn(async () => ({
        as_of: '2026-10-09',
        accounts: [],
        total_debit: 0,
        total_credit: 0,
        is_balanced: true,
    })),
}));

vi.mock('../../../services/glService', () => ({
    getGLAccounts,
    getGLTrialBalance,
    createAccount: vi.fn(),
    patchAccount: vi.fn(),
    todayISO: () => '2026-10-09',
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ hasRole: () => true }),
}));

import ChartOfAccounts from '../ChartOfAccounts';

function mount() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let root: Root;
    act(() => {
        root = createRoot(host);
        root.render(
            <MemoryRouter>
                <ChartOfAccounts />
            </MemoryRouter>,
        );
    });
    return {
        host,
        cleanup() {
            act(() => root.unmount());
            host.remove();
        },
    };
}

describe('Chart of Accounts add-account hint', () => {
    beforeEach(() => {
        getGLAccounts.mockClear();
        getGLTrialBalance.mockClear();
    });

    it('links Add account to Banking for a payable bank', async () => {
        const view = mount();
        await act(async () => {
            await Promise.resolve();
        });
        const add = Array.from(view.host.querySelectorAll('button')).find((button) =>
            button.textContent?.includes('Add account'),
        ) as HTMLButtonElement;
        act(() => add.click());
        const link = view.host.querySelector('a[href="/finance/banking"]');
        expect(view.host.textContent).toContain('To pay expenses from a bank, add it in');
        expect(link?.textContent).toBe('Banking → Add bank');
        view.cleanup();
    });

    it('shows the bank option only for a new asset account and leaves it off', async () => {
        const view = mount();
        await act(async () => {
            await Promise.resolve();
        });
        const add = Array.from(view.host.querySelectorAll('button')).find((button) =>
            button.textContent?.includes('Add account'),
        ) as HTMLButtonElement;
        act(() => add.click());
        expect(view.host.querySelector('[aria-label="This is a bank account (use for payments)"]')).toBeNull();
        const type = Array.from(view.host.querySelectorAll('select')).find((select) =>
            Array.from(select.options).some((option) => option.value === 'asset'),
        ) as HTMLSelectElement;
        act(() => {
            type.value = 'asset';
            type.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const box = view.host.querySelector(
            '[aria-label="This is a bank account (use for payments)"]',
        ) as HTMLInputElement;
        expect(box).toBeTruthy();
        expect(box.checked).toBe(false);
        view.cleanup();
    });
});
