import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import type { CustomerComboboxOption } from '../../../components/forms/CustomerCombobox';
import type { Expense, ExpenseCategory } from '../../../services/expenseService';
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
    { id: 'c-inactive', name: 'Old Co', phone: '555-0000', code: 'OLD', address: '9 Lane', is_active: false },
    { id: 'c-page', name: 'Page Co', phone: '555-2222', code: 'PG', address: '4 Page', is_active: false },
];

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

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = Object.getPrototypeOf(el) as { constructor: { prototype: object } };
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function blurAmount(host: HTMLElement) {
    host.querySelector('#expense-amount')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
}

function switchNamed(host: HTMLElement, label: string) {
    return Array.from(host.querySelectorAll('[role="switch"]')).find((node) => node.textContent?.includes(label)) as HTMLButtonElement;
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

async function clickSave(host: HTMLElement) {
    await act(async () => {
        (host.querySelector('.expense-button-primary') as HTMLButtonElement).click();
    });
}

describe('ExpenseManualForm', () => {
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
        uploadExpenseReceipt.mockReset();
        uploadExpenseReceipt.mockResolvedValue('https://cdn.example/receipt.png');
        if (typeof URL.createObjectURL !== 'function') {
            URL.createObjectURL = () => 'blob:preview';
        }
        if (typeof URL.revokeObjectURL !== 'function') {
            URL.revokeObjectURL = () => undefined;
        }
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    it('keeps the customer picker off the form until Billable is on', () => {
        const { host, cleanup } = renderForm();
        expect(host.querySelector('[role="combobox"]')).toBeNull();
        act(() => switchNamed(host, 'Billable to a customer').click());
        expect(host.querySelector('[role="combobox"]')).not.toBeNull();
        act(() => switchNamed(host, 'Billable to a customer').click());
        expect(host.querySelector('[role="combobox"]')).toBeNull();
        cleanup();
    });

    it('shows the receipt rule only when the amount is over $50 and no receipt is attached', async () => {
        const { host, cleanup } = renderForm();
        const amount = host.querySelector('#expense-amount') as HTMLInputElement;
        act(() => setValue(amount, '50'));
        expect(host.textContent).not.toContain('Receipt required for amounts over $50');
        act(() => setValue(amount, '50.00'));
        expect(host.textContent).not.toContain('Receipt required for amounts over $50');
        act(() => setValue(amount, '50.01'));
        expect(host.querySelector('.expense-receipt-rule')?.textContent).toBe('Receipt required for amounts over $50');

        const file = new File(['receipt'], 'receipt.png', { type: 'image/png' });
        const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement;
        await act(async () => {
            Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(uploadExpenseReceipt).toHaveBeenCalledWith(file);
        expect(host.textContent).not.toContain('Receipt required for amounts over $50');
        expect(host.textContent).toContain('receipt.png');
        cleanup();
    });

    it('runs the duplicate and policy checks when the amount field is left', () => {
        const { host, cleanup } = renderForm();
        blurAmount(host);
        expect(checkExpenseDuplicate).not.toHaveBeenCalled();
        expect(checkExpensePolicy).not.toHaveBeenCalled();

        act(() => {
            setValue(host.querySelector('#expense-vendor') as HTMLInputElement, '  Acme  ');
            setValue(host.querySelector('#expense-amount') as HTMLInputElement, '12.50');
            setValue(host.querySelector('#expense-date') as HTMLInputElement, '2026-10-09');
        });
        act(() => blurAmount(host));

        expect(checkExpenseDuplicate).toHaveBeenCalledTimes(1);
        expect(checkExpenseDuplicate).toHaveBeenCalledWith({
            vendor: 'Acme',
            amount: 12.5,
            date: '2026-10-09',
            category: 'General expenses',
            excludeId: undefined,
        });
        expect(checkExpensePolicy).toHaveBeenCalledTimes(1);
        expect(checkExpensePolicy).toHaveBeenCalledWith({
            category: 'General expenses',
            amount: 12.5,
            date: '2026-10-09',
            hasReceipt: false,
        });
        cleanup();
    });

    it('sends the same payload as before for a new expense', async () => {
        const { host, cleanup } = renderForm();
        act(() => {
            setValue(host.querySelector('#expense-vendor') as HTMLInputElement, 'Shell ');
            setValue(host.querySelector('#expense-amount') as HTMLInputElement, '25');
            setValue(host.querySelector('#expense-date') as HTMLInputElement, '2026-10-01');
        });
        await clickSave(host);
        expect(saveExpense).toHaveBeenCalledTimes(1);
        expect(saveExpense.mock.calls[0][0]).toEqual({
            id: undefined,
            category: 'General expenses',
            amount: 25,
            currency: 'USD',
            date: '2026-10-01',
            vendor: 'Shell ',
            description: '',
            paymentMethod: 'Cash',
            taxAmount: 0,
            isRecurring: false,
            status: 'Submitted',
            receiptUrl: undefined,
            is_duplicate_flag: false,
            duplicate_of_id: null,
            policy_flags: undefined,
            is_billable: false,
            client_id: null,
            is_reimbursable: false,
            account_id: 7,
        });
        expect(saveExpense.mock.calls[0][0]).not.toHaveProperty('paymentAccountId');
        cleanup();
    });

    it('sends the same payload as before when editing an expense', async () => {
        const editing = {
            id: 'exp-9',
            category: 'Fuel',
            amount: 80,
            currency: 'EUR',
            date: '2026-09-01',
            vendor: 'Depot',
            description: 'Tank',
            paymentMethod: 'Bank Transfer',
            taxAmount: 4,
            status: 'Approved',
            isRecurring: true,
            is_billable: true,
            client_id: 'c-inactive',
            is_reimbursable: true,
            account_id: 12,
            paymentAccountId: 2,
            createdBy: 'tester',
            createdAt: '2026-09-01T00:00:00.000Z',
        } as Expense;
        const { host, cleanup } = renderForm({
            editingExpense: editing,
            banks: [operating],
            defaultBank: operating,
        });
        expect(host.querySelector('#expense-manual-title')?.textContent).toBe('Edit expense');
        expect((host.querySelector('[role="combobox"]') as HTMLInputElement).value).toBe('Old Co');
        expect(host.textContent).toContain('Inactive');
        expect(host.querySelector('#expense-paid-from-bank')).not.toBeNull();

        await clickSave(host);
        expect(saveExpense.mock.calls[0][0]).toEqual({
            id: 'exp-9',
            category: 'Fuel',
            amount: 80,
            currency: 'EUR',
            date: '2026-09-01',
            vendor: 'Depot',
            description: 'Tank',
            paymentMethod: 'Bank Transfer',
            paymentAccountId: 2,
            taxAmount: 4,
            isRecurring: true,
            status: 'Approved',
            receiptUrl: undefined,
            is_duplicate_flag: false,
            duplicate_of_id: null,
            policy_flags: undefined,
            is_billable: true,
            client_id: 'c-inactive',
            is_reimbursable: true,
            account_id: 12,
        });
        cleanup();
    });

    it('sends the customer from the page that opened the form', async () => {
        const { host, cleanup } = renderForm({ prefillClientId: 'c-page' });
        expect((host.querySelector('[role="combobox"]') as HTMLInputElement).value).toBe('Page Co');
        expect(host.textContent).toContain('Inactive');
        act(() => {
            setValue(host.querySelector('#expense-vendor') as HTMLInputElement, 'Harbor');
            setValue(host.querySelector('#expense-amount') as HTMLInputElement, '18');
            setValue(host.querySelector('#expense-date') as HTMLInputElement, '2026-10-02');
        });
        await clickSave(host);
        const payload = saveExpense.mock.calls[0][0];
        expect(payload.id).toBeUndefined();
        expect(payload.status).toBe('Submitted');
        expect(payload.is_billable).toBe(true);
        expect(payload.client_id).toBe('c-page');
        expect(payload.vendor).toBe('Harbor');
        expect(payload.category).toBe('General expenses');
        expect(payload.account_id).toBe(7);
        cleanup();
    });

    it('keeps an inactive customer selected when Billable is turned off and on', async () => {
        const editing = {
            id: 'exp-9',
            category: 'Fuel',
            amount: 80,
            currency: 'EUR',
            date: '2026-09-01',
            vendor: 'Depot',
            description: 'Tank',
            paymentMethod: 'Cash',
            taxAmount: 0,
            status: 'Approved',
            isRecurring: false,
            is_billable: true,
            client_id: 'c-inactive',
            is_reimbursable: false,
            account_id: 12,
            createdBy: 'tester',
            createdAt: '2026-09-01T00:00:00.000Z',
        } as Expense;
        const { host, cleanup } = renderForm({ editingExpense: editing });
        const billable = switchNamed(host, 'Billable to a customer');
        act(() => billable.click());
        expect(host.querySelector('[role="combobox"]')).toBeNull();
        act(() => billable.click());
        expect((host.querySelector('[role="combobox"]') as HTMLInputElement).value).toBe('Old Co');
        expect(host.textContent).toContain('Inactive');
        await clickSave(host);
        expect(saveExpense.mock.calls[0][0].client_id).toBe('c-inactive');
        expect(saveExpense.mock.calls[0][0].is_billable).toBe(true);
        cleanup();
    });
});
