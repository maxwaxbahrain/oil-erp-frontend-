import { describe, expect, it } from 'vitest';

import { computeRecurringSuggestions } from './recurringSuggestions';

function invoice(
    customerId: string | number,
    date: string,
    total: number,
    status = 'unpaid',
) {
    return { customer_id: customerId, date, total, status };
}

describe('computeRecurringSuggestions', () => {
    it('T1 never suggests a customer with zero invoices, even when they are newest', () => {
        const result = computeRecurringSuggestions(
            [
                { id: '99', name: 'Newest Empty' },
                { id: '1', name: 'Regular Buyer' },
            ],
            [
                invoice('1', '2026-01-05', 10),
                invoice('1', '2026-02-05', 10),
                invoice('1', '2026-03-05', 10),
            ],
            [],
        );
        expect(result.suggestions.map(row => row.name)).toEqual(['Regular Buyer']);
        expect(result.moreCount).toBe(0);
    });

    it('T2 excludes a customer with 2 invoices and includes one with 3', () => {
        const result = computeRecurringSuggestions(
            [
                { id: '2', name: 'Two' },
                { id: '3', name: 'Three' },
            ],
            [
                invoice('2', '2026-01-01', 10),
                invoice('2', '2026-02-01', 10),
                invoice('3', '2026-01-01', 10),
                invoice('3', '2026-02-01', 10),
                invoice('3', '2026-03-01', 10),
            ],
            [],
        );
        expect(result.suggestions.map(row => row.id)).toEqual(['3']);
    });

    it('T3 divides the total by the inclusive local month span', () => {
        const spread = computeRecurringSuggestions(
            [{ id: '1', name: 'Spread' }],
            [
                invoice('1', '2026-03-05', 100),
                invoice('1', '2026-04-10', 200),
                invoice('1', '2026-05-20', 300),
            ],
            [],
        );
        expect(spread.suggestions[0].monthlyAmount).toBe(200);

        const cluster = computeRecurringSuggestions(
            [{ id: '1', name: 'May' }],
            [
                invoice('1', '2026-05-01', 40),
                invoice('1', '2026-05-10', 60),
                invoice('1', '2026-05-20', 80),
            ],
            [],
        );
        expect(cluster.suggestions[0].monthlyAmount).toBe(180);
        expect(cluster.suggestions[0].invoiceCount).toBe(3);
    });

    it('T4 ignores void and cancelled invoices for both count and sum', () => {
        const result = computeRecurringSuggestions(
            [
                { id: '1', name: 'Mixed' },
                { id: '2', name: 'Only Closed' },
            ],
            [
                invoice('1', '2026-03-05', 100, 'paid'),
                invoice('1', '2026-04-10', 200, 'Unpaid'),
                invoice('1', '2026-05-20', 300, 'partial'),
                invoice('1', '2026-01-01', 999, 'Void'),
                invoice('1', '2026-02-01', 999, 'cancelled'),
                invoice('1', '2026-06-01', 999, 'CANCELED'),
                invoice('2', '2026-03-01', 50, 'void'),
                invoice('2', '2026-04-01', 50, 'cancelled'),
                invoice('2', '2026-05-01', 50, 'canceled'),
            ],
            [],
        );
        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0].name).toBe('Mixed');
        expect(result.suggestions[0].invoiceCount).toBe(3);
        expect(result.suggestions[0].monthlyAmount).toBe(200);
        expect(result.suggestions[0].firstDate).toBe('2026-03-05');
        expect(result.suggestions[0].lastDate).toBe('2026-05-20');
    });

    it('T5 excludes a customer who already has a recurring schedule', () => {
        const result = computeRecurringSuggestions(
            [{ id: '7', name: 'Scheduled' }],
            [
                invoice('7', '2026-01-01', 10),
                invoice('7', '2026-02-01', 10),
                invoice('7', '2026-03-01', 10),
            ],
            [{ customerId: '7' }],
        );
        expect(result.suggestions).toEqual([]);
        expect(result.moreCount).toBe(0);
    });

    it('T6 sorts by monthly amount descending and reports the remainder past the limit', () => {
        const customers = [
            { id: 'a', name: 'Ann' },
            { id: 'b', name: 'Bea' },
            { id: 'c', name: 'Cy' },
            { id: 'd', name: 'Dee' },
            { id: 'e', name: 'Eve' },
        ];
        const invoices = [
            ...months('a', 100),
            ...months('b', 300),
            ...months('c', 300),
            ...months('d', 200),
            ...months('e', 50),
        ];
        const result = computeRecurringSuggestions(customers, invoices, [], { limit: 3 });
        expect(result.suggestions.map(row => row.name)).toEqual(['Bea', 'Cy', 'Dee']);
        expect(result.moreCount).toBe(2);

        const exact = computeRecurringSuggestions(
            customers.slice(0, 3),
            [...months('a', 100), ...months('b', 300), ...months('c', 50)],
            [],
        );
        expect(exact.suggestions).toHaveLength(3);
        expect(exact.moreCount).toBe(0);
    });

    it('T7 matches a numeric invoice customer_id to a string customer id', () => {
        const result = computeRecurringSuggestions(
            [{ id: '42', name: 'Forty Two' }],
            [
                invoice(42, '2026-01-02', 10),
                invoice(42, '2026-02-02', 20),
                invoice(42, '2026-03-02', 30),
            ],
            [],
        );
        expect(result.suggestions[0].id).toBe('42');
        expect(result.suggestions[0].invoiceCount).toBe(3);
        expect(result.suggestions[0].monthlyAmount).toBe(20);
    });
});

function months(customerId: string, each: number) {
    return [
        invoice(customerId, '2026-01-05', each),
        invoice(customerId, '2026-02-05', each),
        invoice(customerId, '2026-03-05', each),
    ];
}
