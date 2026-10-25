import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { act, type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const {
    getMileageSettings,
    listMileageTrips,
    createMileageTrip,
    deleteMileageTrip,
    estimateMileage,
} = vi.hoisted(() => ({
    getMileageSettings: vi.fn(),
    listMileageTrips: vi.fn(),
    createMileageTrip: vi.fn(),
    deleteMileageTrip: vi.fn(),
    estimateMileage: vi.fn(),
}));

vi.mock('../../../services/expenseService', async () => {
    const actual = await vi.importActual<typeof import('../../../services/expenseService')>('../../../services/expenseService');
    return {
        ...actual,
        getMileageSettings,
        listMileageTrips,
        createMileageTrip,
        deleteMileageTrip,
        estimateMileage,
    };
});

import ExpenseMileageTracker from '../ExpenseMileageTracker';

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

function setInputValue(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ExpenseMileageTracker', () => {
    beforeEach(() => {
        getMileageSettings.mockResolvedValue({ distance_unit: 'miles', mileage_rate: 0.7 });
        listMileageTrips.mockResolvedValue({
            items: [],
            count: 0,
            total_distance: 0,
            total_amount: 0,
        });
        createMileageTrip.mockResolvedValue({
            id: 1,
            date: '2026-10-23',
            origin: 'A',
            destination: 'B',
            distance: 24.8,
            unit: 'miles',
            rate: 0.7,
            round_trip: true,
            purpose: '',
            amount: 17.36,
            expense_id: 2,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows mi labels, read-only rate $0.70 / mi, and round-trip total $17.36', async () => {
        const { host, cleanup } = mount(
            <MemoryRouter>
                <ExpenseMileageTracker />
            </MemoryRouter>,
        );
        await act(async () => { await Promise.resolve(); });

        expect(host.textContent).toContain('Distance (mi)');
        expect(host.textContent).toContain('$0.70');
        expect(host.textContent).toContain('/ mi');
        expect(host.textContent).toContain('set in Expense settings');
        expect(host.querySelector('input[type="number"][step="0.01"]')).toBeNull();

        const distanceInputs = host.querySelectorAll('input[type="number"][step="0.1"]');
        setInputValue(distanceInputs[0] as HTMLInputElement, '12.4');

        const roundTrip = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
        act(() => {
            roundTrip.click();
        });

        await act(async () => { await Promise.resolve(); });
        expect(host.textContent).toContain('$17.36');
        cleanup();
    });

    it('POSTs trip with createExpense and refetches month list on save', async () => {
        listMileageTrips
            .mockResolvedValueOnce({ items: [], count: 0, total_distance: 0, total_amount: 0 })
            .mockResolvedValueOnce({
                items: [{
                    id: 1,
                    date: '2026-10-23',
                    origin: 'Home',
                    destination: 'Client',
                    distance: 24.8,
                    unit: 'miles',
                    rate: 0.7,
                    round_trip: true,
                    purpose: '',
                    amount: 17.36,
                    expense_id: 2,
                }],
                count: 1,
                total_distance: 24.8,
                total_amount: 17.36,
            });

        const { host, cleanup } = mount(
            <MemoryRouter>
                <ExpenseMileageTracker />
            </MemoryRouter>,
        );
        await act(async () => { await Promise.resolve(); });

        const textInputs = host.querySelectorAll('input[type="text"]');
        setInputValue(textInputs[0] as HTMLInputElement, 'Home');
        setInputValue(textInputs[1] as HTMLInputElement, 'Client');

        const distanceInput = host.querySelector('input[type="number"][step="0.1"]') as HTMLInputElement;
        setInputValue(distanceInput, '12.4');

        const roundTrip = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
        act(() => { roundTrip.click(); });

        const saveBtn = Array.from(host.querySelectorAll('button')).find(b => b.textContent?.includes('Save trip'));
        await act(async () => {
            saveBtn?.click();
            await Promise.resolve();
        });

        expect(createMileageTrip).toHaveBeenCalledWith(expect.objectContaining({
            origin: 'Home',
            destination: 'Client',
            distance: 12.4,
            roundTrip: true,
            createExpense: true,
        }));
        expect(listMileageTrips).toHaveBeenCalledTimes(2);
        expect(host.textContent).toContain('Submitted for approval');
        cleanup();
    });

    it('uses km labels when tenant settings are km', async () => {
        getMileageSettings.mockResolvedValue({ distance_unit: 'km', mileage_rate: 0.45 });
        const { host, cleanup } = mount(
            <MemoryRouter>
                <ExpenseMileageTracker />
            </MemoryRouter>,
        );
        await act(async () => { await Promise.resolve(); });
        expect(host.textContent).toContain('Distance (km)');
        expect(host.textContent).toContain('$0.45 / km');
        cleanup();
    });

    it('does not reference localStorage for mileage storage', () => {
        const src = readFileSync(resolve(__dirname, '../ExpenseMileageTracker.tsx'), 'utf8');
        expect(src).not.toMatch(/localStorage/);
        expect(src).not.toMatch(/zavi_mileage/);
    });
});
