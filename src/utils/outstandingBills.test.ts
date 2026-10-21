import { describe, expect, it } from 'vitest';

import {
    bucketOutstanding,
    daysPastDueLocal,
    tabCounts,
    type OutstandingBillInput,
} from './outstandingBills';

const TODAY = new Date(2026, 9, 21, 15, 0, 0);

function bill(overrides: OutstandingBillInput = {}): OutstandingBillInput {
    return {
        dueDate: '2026-10-21',
        status: 'Unpaid',
        remaining_balance: 100,
        ...overrides,
    };
}

function filledBuckets(dueDate: string) {
    const aging = bucketOutstanding([bill({ dueDate, remaining_balance: 10 })], TODAY);
    return (['current', 'b30', 'b60', 'b90', 'b90plus'] as const).filter((key) => aging[key] !== 0);
}

describe('outstanding bills aging', () => {
    it('T1 ages a date-only due date on the local calendar, with due today not overdue', () => {
        const cases: Array<{ due: string; days: number; bucket: 'current' | 'b30' | 'b60' | 'b90' | 'b90plus' }> = [
            { due: '2026-10-21', days: 0, bucket: 'current' },
            { due: '2026-10-20', days: 1, bucket: 'b30' },
            { due: '2026-09-21', days: 30, bucket: 'b30' },
            { due: '2026-09-20', days: 31, bucket: 'b60' },
            { due: '2026-08-22', days: 60, bucket: 'b60' },
            { due: '2026-08-21', days: 61, bucket: 'b90' },
            { due: '2026-07-23', days: 90, bucket: 'b90' },
            { due: '2026-07-22', days: 91, bucket: 'b90plus' },
        ];

        for (const row of cases) {
            expect(daysPastDueLocal(row.due, TODAY)).toBe(row.days);
            expect(filledBuckets(row.due)).toEqual([row.bucket]);
            const tabs = tabCounts([bill({ dueDate: row.due, remaining_balance: 10 })], TODAY);
            expect(tabs.overdue).toBe(row.days > 0 ? 1 : 0);
        }
    });

    it('T2 counts every unpaid open bill, and overdue / due soon by local days', () => {
        const invoices: OutstandingBillInput[] = [
            bill({ dueDate: '2026-10-20', status: 'Unpaid', remaining_balance: 10 }),
            bill({ dueDate: '2026-09-01', status: 'unpaid', remaining_balance: 20 }),
            bill({ dueDate: '2026-10-24', status: 'Unpaid', remaining_balance: 5 }),
            bill({ dueDate: '2026-10-01', status: 'Partial', remaining_balance: 30 }),
            bill({ dueDate: '2026-10-21', status: 'Partial', remaining_balance: 40 }),
            bill({ dueDate: '2026-10-28', status: 'partial', remaining_balance: 50 }),
        ];
        const counts = tabCounts(invoices, TODAY);
        expect(counts.unpaid).toBe(3);
        expect(counts.partial).toBe(3);
        expect(counts.all).toBe(6);
        // Two unpaid past due, plus the partial due 2026-10-01. Due today is not overdue.
        expect(counts.overdue).toBe(3);
        // Due today, due in 3 days (2026-10-24), and due in 7 days (2026-10-28).
        expect(counts.dueSoon).toBe(3);
    });

    it('T3 bucket dollars add up to outstanding, and 61–90 plus >90 is the 61+ tail', () => {
        const invoices: OutstandingBillInput[] = [
            bill({ dueDate: '2026-10-25', remaining_balance: 1 }),
            bill({ dueDate: '2026-10-21', remaining_balance: 2, status: 'Partial' }),
            bill({ dueDate: '2026-10-20', remaining_balance: 4 }),
            bill({ dueDate: '2026-09-21', remaining_balance: 8 }),
            bill({ dueDate: '2026-09-20', remaining_balance: 16, status: 'Partial' }),
            bill({ dueDate: '2026-08-21', remaining_balance: 32 }),
            bill({ dueDate: '2026-07-23', remaining_balance: 64 }),
            bill({ dueDate: '2026-07-22', remaining_balance: 128 }),
        ];
        const aging = bucketOutstanding(invoices, TODAY);
        const outstanding = invoices.reduce((sum, row) => sum + Number(row.remaining_balance), 0);
        expect(aging.current + aging.b30 + aging.b60 + aging.b90 + aging.b90plus).toBe(outstanding);
        const sixtyOnePlus = invoices
            .filter((row) => daysPastDueLocal(row.dueDate, TODAY) >= 61)
            .reduce((sum, row) => sum + Number(row.remaining_balance), 0);
        expect(aging.b90 + aging.b90plus).toBe(sixtyOnePlus);
        expect(sixtyOnePlus).toBe(224);
    });

    it('T4 leaves a zero balance out of every bucket and every tab', () => {
        const invoices: OutstandingBillInput[] = [
            bill({ status: 'Paid', remaining_balance: 0, dueDate: '2026-01-01' }),
            bill({ status: 'Unpaid', remaining_balance: 0, dueDate: '2026-01-01' }),
            bill({ status: 'Partial', remaining_balance: 0, dueDate: '2026-09-01' }),
            bill({ status: 'Unpaid', remaining_balance: 10, dueDate: '2026-10-01' }),
        ];
        const aging = bucketOutstanding(invoices, TODAY);
        expect(aging.current + aging.b30 + aging.b60 + aging.b90 + aging.b90plus).toBe(10);
        expect(
            aging.counts.current + aging.counts.b30 + aging.counts.b60 + aging.counts.b90 + aging.counts.b90plus,
        ).toBe(1);
        const counts = tabCounts(invoices, TODAY);
        expect(counts).toEqual({ all: 1, overdue: 1, dueSoon: 0, partial: 0, unpaid: 1 });
    });
});
