import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgedReceivableCustomer, AgedReceivableLine, AgedReceivableReport } from '../../../services/api';

const { getAgedReceivable } = vi.hoisted(() => ({
    getAgedReceivable: vi.fn(),
}));

vi.mock('../../../services/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/api')>();
    return { ...actual, getAgedReceivable };
});

vi.mock('../../../services/settingsService', () => ({
    formatCurrency: (amount: number) => {
        const formatted = amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `$${formatted}`;
    },
}));

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return { ...actual, useNavigate: () => vi.fn() };
});

import AgedReceivable from '../AgedReceivable';

function invoiceLines(count: number): AgedReceivableLine[] {
    return Array.from({ length: count }, (_, i) => ({
        kind: 'invoice' as const,
        label: `INV-${i + 1}`,
        date: '2026-01-15',
        amount: 100,
        bucket: '90+',
    }));
}

function customer(
    id: string,
    name: string,
    invoiceCount: number,
    buckets: Pick<AgedReceivableCustomer, 'current' | 'days30' | 'days60' | 'days90' | 'credits' | 'net'>,
): AgedReceivableCustomer {
    const gross = round2(buckets.current + buckets.days30 + buckets.days60 + buckets.days90);
    return {
        customer_id: id,
        customer_name: name,
        current: buckets.current,
        days30: buckets.days30,
        days60: buckets.days60,
        days90: buckets.days90,
        gross,
        credits: buckets.credits,
        net: buckets.net,
        ledger_closing: buckets.net,
        lines: invoiceLines(invoiceCount),
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

const TENANT7_REPORT: AgedReceivableReport = {
    as_of: '2026-10-30',
    gross: 422559.43,
    credits: 136187.67,
    net: 286371.76,
    customers: [
        customer('t7-1', 'Tribeca Collision Center Inc', 41, {
            current: 0,
            days30: 5320.02,
            days60: 11145.44,
            days90: 92657.64,
            credits: 28432.20,
            net: 80690.90,
        }),
        customer('t7-2', 'Flushing Diesel Repair Corp', 36, {
            current: 0,
            days30: 9489.86,
            days60: 10093.18,
            days90: 64047.41,
            credits: 21542.30,
            net: 62088.15,
        }),
        customer('t7-3', 'Hicksville Fleet Services Inc', 38, {
            current: 0,
            days30: 4755.26,
            days60: 2046.93,
            days90: 69286.99,
            credits: 24873.23,
            net: 51215.95,
        }),
        customer('t7-4', 'Long Island City Transmission Center LLC', 31, {
            current: 3480.80,
            days30: 12158.79,
            days60: 42.65,
            days90: 47717.39,
            credits: 24581.68,
            net: 38817.95,
        }),
        customer('t7-5', 'Bronx Service Center Corp', 27, {
            current: 0,
            days30: 17958.73,
            days60: 2706.99,
            days90: 28201.26,
            credits: 16694.84,
            net: 32172.14,
        }),
        customer('t7-6', 'Albany Auto Parts Corp', 30, {
            current: 0,
            days30: 1734.59,
            days60: 6363.35,
            days90: 33352.15,
            credits: 20063.42,
            net: 21386.67,
        }),
    ],
};

describe('AgedReceivable', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        getAgedReceivable.mockReset();
        getAgedReceivable.mockResolvedValue(TENANT7_REPORT);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        container.remove();
    });

    async function renderPage() {
        await act(async () => {
            root.render(
                <MemoryRouter>
                    <AgedReceivable />
                </MemoryRouter>,
            );
        });
        for (let i = 0; i < 8; i += 1) {
            await act(async () => {
                await Promise.resolve();
            });
        }
    }

    function text(): string {
        return container.textContent ?? '';
    }

    it('shows tenant-7 totals, bucket summary, customer names, and count', async () => {
        await renderPage();

        expect(getAgedReceivable).toHaveBeenCalled();

        const body = text();
        expect(body).toContain('$422,559.43');
        expect(body).toContain('$136,187.67');
        expect(body).toContain('$286,371.76');
        expect(body).toContain('$335,262.84');
        expect(body).toContain('6 Customers with Outstanding Balances');
        expect(body).toContain('Tribeca Collision Center Inc');
        expect(body).toContain('Flushing Diesel Repair Corp');
        expect(body).toContain('Hicksville Fleet Services Inc');
        expect(body).toContain('Long Island City Transmission Center LLC');
        expect(body).toContain('Bronx Service Center Corp');
        expect(body).toContain('Albany Auto Parts Corp');
        expect(body).toContain('Aged receivable');
        expect(body).toContain('Opening balance is its own row');
    });
});
