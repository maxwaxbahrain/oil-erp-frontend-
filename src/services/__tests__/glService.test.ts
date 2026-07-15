import { describe, expect, it } from 'vitest';

import { monthStartISO } from '../glService';

describe('monthStartISO (DASH-5)', () => {
  it('returns the first day of the current month in YYYY-MM-DD format', () => {
    const result = monthStartISO();
    // Shape: YYYY-MM-01
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);

    // Ties to the current month/year and is day 01.
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    expect(result).toBe(expected);

    const [, month, day] = result.split('-');
    expect(day).toBe('01');
    expect(Number(month)).toBeGreaterThanOrEqual(1);
    expect(Number(month)).toBeLessThanOrEqual(12);
  });
});
