import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ finance: true }));
const { createAccount } = vi.hoisted(() => ({
    createAccount: vi.fn(async () => ({ id: 1 })),
}));

vi.mock('../../../services/glService', () => ({
    getGLAccounts: vi.fn(async () => []),
    getGLTrialBalance: vi.fn(async () => ({
        as_of: '2026-10-09',
        accounts: [],
        total_debit: 0,
        total_credit: 0,
        is_balanced: true,
    })),
    createAccount,
    patchAccount: vi.fn(),
    todayISO: () => '2026-10-09',
}));

vi.mock('../../../contexts/AuthContext', () => ({
    useAuth: () => ({ hasRole: () => auth.finance }),
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

async function openAdd(host: HTMLElement) {
    await act(async () => {
        await Promise.resolve();
    });
    const add = Array.from(host.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Add account'),
    ) as HTMLButtonElement;
    act(() => add.click());
}

describe('Chart of Accounts opening balance', () => {
    beforeEach(() => {
        auth.finance = true;
        createAccount.mockClear();
    });

    it('shows the company currency and defaults a contra normal balance to credit', async () => {
        const view = mount();
        await openAdd(view.host);
        expect(view.host.textContent).toContain('Opening balance (USD)');
        const normal = view.host.querySelector('[aria-label="Normal balance"]') as HTMLSelectElement;
        const side = view.host.querySelector('[aria-label="Opening balance side"]') as HTMLSelectElement;
        expect(side.value).toBe('debit');
        act(() => {
            normal.value = 'credit';
            normal.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect((view.host.querySelector('[aria-label="Opening balance side"]') as HTMLSelectElement).value).toBe('credit');
        view.cleanup();
    });

    it('hides the opening fields when the user cannot post journals', async () => {
        auth.finance = false;
        const view = mount();
        await openAdd(view.host);
        expect(view.host.textContent).not.toContain('Opening balance (USD)');
        expect(view.host.querySelector('[aria-label="Opening balance amount"]')).toBeNull();
        view.cleanup();
    });
});
