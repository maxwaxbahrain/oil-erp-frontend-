import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { CustomerComboboxOption } from '../../../components/forms/CustomerCombobox';
import type { ExpenseCategory } from '../../../services/expenseService';
import type { BankingAccount } from '../../../services/glService';

const { saveExpense, checkExpenseDuplicate, checkExpensePolicy, uploadExpenseReceipt } = vi.hoisted(() => ({
    saveExpense: vi.fn(),
    checkExpenseDuplicate: vi.fn(() => ({ isDuplicate: false, matches: [], maxConfidence: 0 })),
    checkExpensePolicy: vi.fn(() => []),
    uploadExpenseReceipt: vi.fn(async () => 'https://cdn.example/receipt.png'),
}));

vi.mock('../../../services/expenseService', async () => {
    const actual = await vi.importActual<typeof import('../../../services/expenseService')>('../../../services/expenseService');
    return {
        ...actual,
        saveExpense,
        checkExpenseDuplicate,
        checkExpensePolicy,
        uploadExpenseReceipt,
    };
});

import { ExpenseManualForm } from '../ExpenseManualForm';

const categories: ExpenseCategory[] = [
    { id: 7, code: '6100', name: 'General expenses' },
    { id: 12, code: '6200', name: 'Fuel' },
];

const customers: CustomerComboboxOption[] = [
    { id: 'c-1', name: 'Active Co', phone: '555-1111', code: 'AC1', address: '1 Road', is_active: true },
];

const mainBank: BankingAccount = {
    id: 1, code: '1010', name: 'Main Bank', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: false, balance: 10,
};

const operating: BankingAccount = {
    id: 2, code: '1011', name: 'Operating', type: 'asset', system_key: null, role: 'bank', is_active: true, is_default: true, balance: 30,
};

function mount(node: ReactElement) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let root: Root;
    act(() => {
        root = createRoot(host);
        root.render(node);
    });
    return {
        host,
        cleanup() {
            act(() => root.unmount());
            host.remove();
        },
    };
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const prototype = Object.getPrototypeOf(el) as { constructor: { prototype: object } };
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function renderForm(overrides: Partial<React.ComponentProps<typeof ExpenseManualForm>> = {}) {
    const onSaved = vi.fn();
    const view = mount(
        <ExpenseManualForm
            editingExpense={null}
            prefillClientId={null}
            categories={categories}
            refreshCategories={vi.fn()}
            customers={customers}
            banks={[]}
            defaultBank={null}
            onClose={vi.fn()}
            onSaved={onSaved}
            onOpenChart={vi.fn()}
            {...overrides}
        />,
    );
    return { ...view, onSaved };
}

function fillRequired(host: HTMLElement) {
    act(() => {
        setValue(host.querySelector('#expense-vendor') as HTMLInputElement, 'Shell');
        setValue(host.querySelector('#expense-amount') as HTMLInputElement, '25');
        setValue(host.querySelector('#expense-date') as HTMLInputElement, '2026-10-01');
    });
}

function chooseMethod(host: HTMLElement, method: string) {
    act(() => setValue(host.querySelector('#expense-payment-method') as HTMLSelectElement, method));
}

function saveButton(host: HTMLElement) {
    return host.querySelector('.expense-button-primary') as HTMLButtonElement;
}

async function clickSave(host: HTMLElement) {
    await act(async () => {
        saveButton(host).click();
    });
}

describe('ExpenseManualForm paid-from bank', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        saveExpense.mockReset();
        saveExpense.mockResolvedValue({ id: 'saved' });
        checkExpenseDuplicate.mockReset();
        checkExpenseDuplicate.mockReturnValue({ isDuplicate: false, matches: [], maxConfidence: 0 });
        checkExpensePolicy.mockReset();
        checkExpensePolicy.mockReturnValue([]);
    });

    it('shows the failure message, blocks Save, and never saves when banks failed to load (HTTP 403)', async () => {
        const reloadAccounts = vi.fn();
        const { host, cleanup } = renderForm({
            banks: [],
            accountsError: 'HTTP 403',
            reloadAccounts,
        });
        chooseMethod(host, 'Bank Transfer');
        fillRequired(host);

        expect(host.querySelector('#expense-paid-from-bank')).not.toBeNull();
        expect(host.textContent).toContain('Could not load bank accounts — choose Cash or try again');
        expect(host.textContent).toContain('HTTP 403');
        expect(saveButton(host).disabled).toBe(true);

        await clickSave(host);
        expect(saveExpense).not.toHaveBeenCalled();

        const retry = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Retry') as HTMLButtonElement;
        expect(retry).toBeTruthy();
        act(() => retry.click());
        expect(reloadAccounts).toHaveBeenCalledTimes(1);
        cleanup();
    });

    it('shows a loading state with a disabled select and blocks Save while accounts load', async () => {
        const { host, cleanup } = renderForm({ banks: [], accountsLoading: true });
        chooseMethod(host, 'Bank Transfer');
        fillRequired(host);

        expect(host.textContent).toContain('Loading bank accounts…');
        expect((host.querySelector('#expense-paid-from-bank') as HTMLSelectElement).disabled).toBe(true);
        expect(saveButton(host).disabled).toBe(true);

        await clickSave(host);
        expect(saveExpense).not.toHaveBeenCalled();
        cleanup();
    });

    it('preselects the default bank and saves its id as a number', async () => {
        const { host, cleanup } = renderForm({
            banks: [mainBank, operating],
            defaultBank: operating,
        });
        chooseMethod(host, 'Bank Transfer');
        fillRequired(host);

        const select = host.querySelector('#expense-paid-from-bank') as HTMLSelectElement;
        const optionValues = Array.from(select.options).map((o) => o.value);
        expect(optionValues).toEqual(['', '1', '2']);
        expect(select.value).toBe('2');
        expect(host.textContent).not.toContain('Could not load bank accounts');
        expect(saveButton(host).disabled).toBe(false);

        await clickSave(host);
        expect(saveExpense).toHaveBeenCalledTimes(1);
        expect(saveExpense.mock.calls[0][0].paymentAccountId).toBe(2);
        expect(typeof saveExpense.mock.calls[0][0].paymentAccountId).toBe('number');
        cleanup();
    });

    it('blocks Save for a bank method until a bank is chosen when there is no default', async () => {
        const { host, cleanup } = renderForm({ banks: [mainBank, operating], defaultBank: null });
        chooseMethod(host, 'Bank Transfer');
        fillRequired(host);
        expect(saveButton(host).disabled).toBe(true);

        act(() => setValue(host.querySelector('#expense-paid-from-bank') as HTMLSelectElement, '1'));
        expect(saveButton(host).disabled).toBe(false);
        await clickSave(host);
        expect(saveExpense.mock.calls[0][0].paymentAccountId).toBe(1);
        cleanup();
    });

    it('cash shows no picker, keeps Save enabled, and omits paymentAccountId even with accounts failing', async () => {
        const { host, cleanup } = renderForm({
            banks: [],
            accountsError: 'HTTP 403',
        });
        fillRequired(host);

        expect(host.querySelector('#expense-paid-from-bank')).toBeNull();
        expect(host.textContent).not.toContain('Could not load bank accounts');
        expect(saveButton(host).disabled).toBe(false);

        await clickSave(host);
        expect(saveExpense).toHaveBeenCalledTimes(1);
        expect(saveExpense.mock.calls[0][0].paymentMethod).toBe('Cash');
        expect(saveExpense.mock.calls[0][0]).not.toHaveProperty('paymentAccountId');
        cleanup();
    });
});
