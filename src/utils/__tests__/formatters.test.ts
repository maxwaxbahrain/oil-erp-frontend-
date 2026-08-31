import { describe, expect, it } from 'vitest';

import { formatDateTime, parseApiDateTime } from '../formatters';

const expectedUtcInstant = Date.UTC(2026, 7, 31, 0, 51);

describe('parseApiDateTime', () => {
    it('treats zoneless ISO strings as UTC', () => {
        const d = parseApiDateTime('2026-08-31T00:51:00');
        expect(d).not.toBeNull();
        expect(d!.getTime()).toBe(expectedUtcInstant);
    });

    it('passes through Z-suffixed strings unchanged', () => {
        const d = parseApiDateTime('2026-08-31T00:51:00Z');
        expect(d).not.toBeNull();
        expect(d!.getTime()).toBe(expectedUtcInstant);
    });

    it('passes through offset strings unchanged', () => {
        const d = parseApiDateTime('2026-08-31T00:51:00+00:00');
        expect(d).not.toBeNull();
        expect(d!.getTime()).toBe(expectedUtcInstant);
    });

    it('returns null for null, empty, or garbage input', () => {
        expect(parseApiDateTime(null)).toBeNull();
        expect(parseApiDateTime('')).toBeNull();
        expect(parseApiDateTime('garbage')).toBeNull();
    });
});

describe('formatDateTime', () => {
    it('formats zoneless UTC as local wall time in America/New_York', () => {
        const formatted = formatDateTime('2026-08-31T00:51:00');
        expect(formatted).toContain('Aug');
        expect(formatted).toMatch(/30|8\/30/);
        expect(formatted).toMatch(/8:51/);
    });

    it('returns empty string for null or empty input', () => {
        expect(formatDateTime(null)).toBe('');
        expect(formatDateTime('')).toBe('');
    });

    it('returns the raw string for unparseable input without throwing', () => {
        expect(formatDateTime('garbage')).toBe('garbage');
    });
});
