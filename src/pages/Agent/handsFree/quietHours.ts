/** Quiet-hours math in the user's IANA timezone (same-day + overnight). */

function parseHHMM(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Local minutes-since-midnight for `now` in `timeZone` (falls back to runtime local). */
export function localMinutesNow(now: Date, timeZone: string | null | undefined): number {
  const tz = (timeZone || '').trim();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz || undefined,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    return now.getHours() * 60 + now.getMinutes();
  }
}

/**
 * True when local time is inside [start, end).
 * Overnight (e.g. 22:00–07:00): quiet if >= start OR < end.
 * Same-day (e.g. 09:00–17:00): quiet if >= start AND < end.
 */
export function isInQuietHours(
  now: Date,
  start: string | null | undefined,
  end: string | null | undefined,
  timeZone: string | null | undefined,
): boolean {
  if (!start || !end) return false;
  const s = parseHHMM(start);
  const e = parseHHMM(end);
  if (s == null || e == null) return false;
  if (s === e) return false;
  const mins = localMinutesNow(now, timeZone);
  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e;
}
