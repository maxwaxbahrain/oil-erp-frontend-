import { describe, expect, it } from 'vitest';

import { formatLocalDate, isSameLocalMonth, parseLocalDate } from './dates';

describe('parseLocalDate', () => {
    it('builds a local calendar date from a 10-char YYYY-MM-DD string', () => {
        const d = parseLocalDate('2026-09-30');
        expect(d).not.toBeNull();
        expect(d!.getFullYear()).toBe(2026);
        expect(d!.getMonth()).toBe(8);
        expect(d!.getDate()).toBe(30);
    });

    it('returns the same instant for an ISO timestamp', () => {
        const iso = '2026-10-01T03:30:00.000Z';
        const parsed = parseLocalDate(iso);
        expect(parsed).not.toBeNull();
        expect(parsed!.getTime()).toBe(new Date(iso).getTime());
    });

    it('returns null for null, undefined, and empty string', () => {
        expect(parseLocalDate(null)).toBeNull();
        expect(parseLocalDate(undefined)).toBeNull();
        expect(parseLocalDate('')).toBeNull();
    });
});

describe('formatLocalDate', () => {
    it('formats 2026-09-30 as Sep 30 in America/New_York and in UTC', () => {
        expect(formatLocalDate('2026-09-30')).toBe('Sep 30');
    });

    it('includes the year when the date is not the current year', () => {
        expect(formatLocalDate('2025-10-31')).toBe('Oct 31, 2025');
    });

    it('formats an ISO timestamp the same way as new Date(value)', () => {
        const iso = '2026-10-01T03:30:00.000Z';
        const via = new Date(iso);
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        if (via.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
        expect(parseLocalDate(iso)!.toISOString()).toBe(via.toISOString());
        expect(formatLocalDate(iso)).toBe(via.toLocaleDateString('en-US', options));
    });

    it('returns an empty string for null', () => {
        expect(formatLocalDate(null)).toBe('');
        expect(formatLocalDate(undefined)).toBe('');
        expect(formatLocalDate('')).toBe('');
    });
});

describe('isSameLocalMonth', () => {
    it('counts 2026-10-01 in October against 2026-10-15', () => {
        const ref = new Date(2026, 9, 15);
        expect(isSameLocalMonth('2026-10-01', ref)).toBe(true);
    });
});
