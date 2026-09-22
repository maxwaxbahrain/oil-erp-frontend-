import { describe, expect, it } from 'vitest';

import { localIsoDate } from '../localDate';

describe('localIsoDate', () => {
  it('returns zero-padded YYYY-MM-DD from local calendar fields', () => {
    const d = new Date(2025, 2, 5, 12, 0, 0);
    expect(localIsoDate(d)).toBe('2025-03-05');
  });

  it('uses local date even late in the evening when UTC is the next day', () => {
    const d = new Date(2025, 0, 15, 23, 30, 0);
    const localDay = localIsoDate(d);
    expect(localDay).toBe('2025-01-15');
    const utcDay = d.toISOString().slice(0, 10);
    if (utcDay !== localDay) {
      expect(utcDay).toBe('2025-01-16');
    }
  });
});
