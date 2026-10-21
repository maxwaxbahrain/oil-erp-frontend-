import { describe, expect, it } from 'vitest';

import { localIsoDate } from './localDate';
import {
    formatAddedLabel,
    formatLocalDate,
    formatStoredTimestamp,
    isSameLocalMonth,
    parseLocalDate,
    parseStoredTimestamp,
} from './dates';

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

const MIDNIGHT_STAMPS = [
    '2025-10-01 00:00:00',
    '2025-10-01T00:00:00',
    '2025-10-01T00:00:00Z',
    '2025-10-01T00:00:00.000Z',
];

describe('parseStoredTimestamp', () => {
    it('reads midnight stamps as the written calendar day in America/New_York and in UTC', () => {
        for (const raw of MIDNIGHT_STAMPS) {
            const parsed = parseStoredTimestamp(raw);
            expect(parsed, raw).not.toBeNull();
            expect(parsed!.getFullYear(), raw).toBe(2025);
            expect(parsed!.getMonth(), raw).toBe(9);
            expect(parsed!.getDate(), raw).toBe(1);
        }
    });

    it('parses a real UTC timestamp as that instant', () => {
        const raw = '2026-10-20T14:37:22Z';
        const parsed = parseStoredTimestamp(raw);
        expect(parsed).not.toBeNull();
        expect(parsed!.getTime()).toBe(Date.parse(raw));
        expect(parsed!.getFullYear()).toBe(2026);
        expect(parsed!.getMonth()).toBe(9);
        expect(parsed!.getDate()).toBe(20);
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz === 'America/New_York') expect(parsed!.getHours()).toBe(10);
        if (tz === 'UTC') expect(parsed!.getHours()).toBe(14);
    });

    it('returns null for null, undefined, and empty string without throwing', () => {
        expect(parseStoredTimestamp(null)).toBeNull();
        expect(parseStoredTimestamp(undefined)).toBeNull();
        expect(parseStoredTimestamp('')).toBeNull();
    });
});

describe('formatStoredTimestamp', () => {
    it('formats midnight stamps as Oct 1, 2025 in America/New_York and in UTC', () => {
        for (const raw of MIDNIGHT_STAMPS) {
            expect(formatStoredTimestamp(raw), raw).toBe('Oct 1, 2025');
            expect(formatStoredTimestamp(raw, { month: 'short', year: 'numeric' }), raw).toBe('Oct 2025');
        }
    });

    it('formats 2026-10-20T14:37:22Z on the local calendar day', () => {
        expect(formatStoredTimestamp('2026-10-20T14:37:22Z')).toBe('Oct 20');
    });
});

describe('formatAddedLabel', () => {
    it('labels today midnight as Today and yesterday as not Today', () => {
        const today = localIsoDate();
        expect(formatAddedLabel(`${today} 00:00:00`)).toBe('Today');
        expect(formatAddedLabel(`${today}T00:00:00Z`)).toBe('Today');

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        expect(formatAddedLabel(`${localIsoDate(yesterday)} 00:00:00`)).not.toBe('Today');
    });
});
