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

/**
 * midnight-UTC stamps are business dates written by the importer; shown as written.
 * A clock time of exactly 00:00:00 (optional zero fraction, optional Z or +00:00)
 * is that calendar day, not an instant. Any other time is a real timestamp:
 * Z or a numeric offset is honored, and a zoneless string is naive UTC, which
 * is how the API sends timestamps.
 */
const MIDNIGHT_BUSINESS_DATE =
    /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(?:\.0+)?(?:Z|\+00:?00)?$/;

export function parseStoredTimestamp(value: string | null | undefined): Date | null {
    if (value == null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const midnight = MIDNIGHT_BUSINESS_DATE.exec(s);
    if (midnight) return parseLocalDate(midnight[1]);
    if (DATE_ONLY.test(s)) return parseLocalDate(s);

    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
    const normalized = hasZone ? s : `${s.includes('T') ? s : s.replace(' ', 'T')}Z`;
    const dt = new Date(normalized);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Same display rules as formatLocalDate, applied to a stored timestamp. */
export function formatStoredTimestamp(
    value: string | null | undefined,
    options?: Intl.DateTimeFormatOptions,
): string {
    const parsed = parseStoredTimestamp(value);
    if (!parsed) return '';
    const opts: Intl.DateTimeFormatOptions = options ? { ...options } : { ...CURRENT_YEAR_OPTIONS };
    if (opts.year == null && parsed.getFullYear() !== new Date().getFullYear()) {
        opts.year = 'numeric';
    }
    return parsed.toLocaleDateString('en-US', opts);
}

function localCalendarDayIndex(d: Date): number {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Customers "Added" label. "Today" is the local calendar day of the parsed stamp. */
export function formatAddedLabel(value: string | null | undefined): string {
    const parsed = parseStoredTimestamp(value);
    if (!parsed) return '—';
    const days = Math.round((localCalendarDayIndex(new Date()) - localCalendarDayIndex(parsed)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days > 1 && days < 7) return `${days} days ago`;
    if (days >= 7 && days < 30) {
        const weeks = Math.floor(days / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    }
    return formatStoredTimestamp(value);
}
