import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
    getExpenseCategories,
    getMileageSettings,
    patchMileageSettings,
    saveExpenseSettings,
} = vi.hoisted(() => ({
    getExpenseCategories: vi.fn(async () => []),
    getMileageSettings: vi.fn(),
    patchMileageSettings: vi.fn(),
    saveExpenseSettings: vi.fn(),
}));

vi.mock('../../../services/expenseService', async () => {
    const actual = await vi.importActual<typeof import('../../../services/expenseService')>('../../../services/expenseService');
    return {
        ...actual,
        getExpenseCategories,
        getMileageSettings,
        patchMileageSettings,
        saveExpenseSettings,
        getExpenseSettings: actual.getExpenseSettings,
    };
});

import ExpenseSettingsPage from '../ExpenseSettingsPage';

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

describe('ExpenseSettingsPage mileage', () => {
    beforeEach(() => {
        getMileageSettings.mockResolvedValue({ distance_unit: 'miles', mileage_rate: 0.7 });
        patchMileageSettings.mockResolvedValue({ distance_unit: 'km', mileage_rate: 0.45 });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('PATCHes mileage settings when Save Settings is clicked', async () => {
        const { host, cleanup } = mount(
            <MemoryRouter>
                <ExpenseSettingsPage />
            </MemoryRouter>,
        );
        await act(async () => { await Promise.resolve(); });

        const unitSelect = host.querySelector('select') as HTMLSelectElement;
        act(() => {
            unitSelect.value = 'km';
            unitSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const rateInputs = host.querySelectorAll('input[type="number"][step="0.01"]');
        const mileageRate = rateInputs[rateInputs.length - 1] as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        act(() => {
            setter?.call(mileageRate, '0.45');
            mileageRate.dispatchEvent(new Event('input', { bubbles: true }));
            mileageRate.dispatchEvent(new Event('change', { bubbles: true }));
        });

        const saveBtn = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Save Settings'));
        await act(async () => {
            saveBtn?.click();
            await Promise.resolve();
        });

        expect(patchMileageSettings).toHaveBeenCalledWith({
            distance_unit: 'km',
            mileage_rate: 0.45,
        });
        cleanup();
    });

    it('does not store mileage rate in localStorage from this page', () => {
        const src = readFileSync(resolve(__dirname, '../ExpenseSettingsPage.tsx'), 'utf8');
        expect(src).not.toMatch(/mileageRatePerKm/);
        expect(src).not.toMatch(/zavi_mileage/);
    });
});
