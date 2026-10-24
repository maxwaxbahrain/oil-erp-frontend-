import { describe, expect, it } from 'vitest';
import { daysOverdue } from '../daysOverdue';

describe('daysOverdue', () => {
    it('counts whole local calendar days from due date to today', () => {
        const now = new Date(2026, 9, 23, 23, 59, 0);
        expect(daysOverdue('2025-10-31', now)).toBe(357);
        expect(daysOverdue('2026-03-14', now)).toBe(223);
    });

    it('returns 0 when due today', () => {
        const now = new Date(2026, 9, 23, 15, 0, 0);
        expect(daysOverdue('2026-10-23', now)).toBe(0);
    });

    it('uses the same local calendar day regardless of clock time', () => {
        const due = '2026-10-20';
        const late = new Date(2026, 9, 23, 23, 30, 0);
        const early = new Date(2026, 9, 23, 0, 30, 0);
        expect(daysOverdue(due, late)).toBe(3);
        expect(daysOverdue(due, early)).toBe(3);
    });
});
