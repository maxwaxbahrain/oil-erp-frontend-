import { describe, expect, it } from 'vitest';

import { isInQuietHours, localMinutesNow } from './quietHours';

describe('quiet hours', () => {
  it('handles same-day windows', () => {
    // 10:00 UTC — use fixed Instant and America/New_York would shift;
    // pass a Date whose local format in UTC is controlled via timezone UTC.
    const ten = new Date('2026-06-01T10:00:00Z');
    expect(isInQuietHours(ten, '09:00', '17:00', 'UTC')).toBe(true);
    expect(isInQuietHours(ten, '11:00', '17:00', 'UTC')).toBe(false);
    const eight = new Date('2026-06-01T08:00:00Z');
    expect(isInQuietHours(eight, '09:00', '17:00', 'UTC')).toBe(false);
  });

  it('handles overnight windows (22:00–07:00)', () => {
    const late = new Date('2026-06-01T23:00:00Z');
    const early = new Date('2026-06-01T05:00:00Z');
    const midday = new Date('2026-06-01T12:00:00Z');
    expect(isInQuietHours(late, '22:00', '07:00', 'UTC')).toBe(true);
    expect(isInQuietHours(early, '22:00', '07:00', 'UTC')).toBe(true);
    expect(isInQuietHours(midday, '22:00', '07:00', 'UTC')).toBe(false);
  });

  it('returns false when start/end missing', () => {
    const now = new Date('2026-06-01T23:00:00Z');
    expect(isInQuietHours(now, null, '07:00', 'UTC')).toBe(false);
    expect(isInQuietHours(now, '22:00', null, 'UTC')).toBe(false);
  });

  it('reads local minutes in the given timezone', () => {
    const noonUtc = new Date('2026-06-01T12:00:00Z');
    expect(localMinutesNow(noonUtc, 'UTC')).toBe(12 * 60);
  });
});
