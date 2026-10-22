import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { localIsoDate, localIsoDatePlusDays, localMonthEndIso, localMonthStartIso } from '../localDate';

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

// Absolute instant: 21:04 in America/New_York on 2026-10-21 (EDT, UTC-4).
const NY_EVENING = new Date('2026-10-22T01:04:00.000Z');

describe('local calendar helpers at 21:04 America/New_York', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NY_EVENING);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('follows the process timezone for the same absolute instant', () => {
    if (process.env.TZ === 'UTC') {
      expect(localIsoDate()).toBe('2026-10-22');
      expect(localIsoDatePlusDays(7)).toBe('2026-10-29');
      expect(localIsoDatePlusDays(30)).toBe('2026-11-21');
      return;
    }

    expect(localIsoDate()).toBe('2026-10-21');
    expect(localIsoDatePlusDays(7)).toBe('2026-10-28');
    expect(localIsoDatePlusDays(30)).toBe('2026-11-20');
    expect(localMonthStartIso()).toBe('2026-10-01');
    expect(localMonthEndIso()).toBe('2026-10-31');
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-22');
  });
});

describe('localIsoDatePlusDays across the November fallback', () => {
  it('adds one local calendar day from Nov 1 23:00', () => {
    expect(localIsoDatePlusDays(1, new Date(2026, 10, 1, 23))).toBe('2026-11-02');
  });
});
