/**
 * Calendar dates vs timestamps.
 *
 * A 10-character "YYYY-MM-DD" value is a calendar day with no timezone.
 * `new Date("YYYY-MM-DD")` reads that as UTC midnight and shifts the day
 * back in timezones west of UTC. Build it from local year/month/day instead.
 * An ISO string that includes a time is a real instant and stays `new Date(value)`.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseLocalDate(value: string | null | undefined): Date | null {
    if (value == null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    if (DATE_ONLY.test(s)) {
        const y = Number(s.slice(0, 4));
        const m = Number(s.slice(5, 7));
        const d = Number(s.slice(8, 10));
        const dt = new Date(y, m - 1, d);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/** True when a calendar date falls in the same local month as ref. */
export function isSameLocalMonth(dateStr: string | null | undefined, ref: Date): boolean {
    const parsed = parseLocalDate(dateStr);
    if (!parsed) return false;
    return parsed.getFullYear() === ref.getFullYear() && parsed.getMonth() === ref.getMonth();
}

const CURRENT_YEAR_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
};

/** Display a calendar date. The year is included when it is not the current year. */
export function formatLocalDate(
    value: string | null | undefined,
    options?: Intl.DateTimeFormatOptions,
): string {
    const parsed = parseLocalDate(value);
    if (!parsed) return '';
    const opts: Intl.DateTimeFormatOptions = options ? { ...options } : { ...CURRENT_YEAR_OPTIONS };
    if (opts.year == null && parsed.getFullYear() !== new Date().getFullYear()) {
        opts.year = 'numeric';
    }
    return parsed.toLocaleDateString('en-US', opts);
}
