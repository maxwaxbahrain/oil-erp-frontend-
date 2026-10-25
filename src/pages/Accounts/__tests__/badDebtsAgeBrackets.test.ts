import { describe, expect, it } from 'vitest';
import {
    AGE_BRACKETS,
    bracketForDays,
    bracketStatsFromDaysAndAmounts,
    inAgeBracket,
} from '../badDebtsAgeBrackets';

describe('badDebtsAgeBrackets', () => {
    it('assigns each overdue day count to exactly one bracket', () => {
        const sampleDays = [5, 45, 75, 120, 200, 400];
        const keys = sampleDays.map((d) => bracketForDays(d));
        expect(keys).toEqual(['1-29', '30-60', '61-90', '91-180', '181-360', '360+']);
    });

    it('sums bracket counts to the overdue invoice count', () => {
        const rows = [
            { days: 5, amount: 100 },
            { days: 45, amount: 200 },
            { days: 75, amount: 300 },
            { days: 120, amount: 400 },
            { days: 200, amount: 500 },
            { days: 400, amount: 600 },
        ];
        const stats = bracketStatsFromDaysAndAmounts(rows);
        const totalCount = AGE_BRACKETS.reduce((s, b) => s + stats[b.key].count, 0);
        expect(totalCount).toBe(rows.length);
    });

    it('covers non-overlapping inclusive ranges', () => {
        for (let d = 1; d <= 400; d += 1) {
            const matches = AGE_BRACKETS.filter((b) => inAgeBracket(d, b.key));
            expect(matches).toHaveLength(1);
        }
    });
});
