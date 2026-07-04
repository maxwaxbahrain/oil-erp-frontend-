/**
 * Global Formatters for SOLTOL ONE
 * Standardizing display across enterprise nodes.
 */

const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Parse an API date-only string (``YYYY-MM-DD``) as a local calendar date.
 * Datetime strings (with ``T``) are parsed normally. Never use
 * ``new Date("YYYY-MM-DD")`` for display — that is UTC midnight and shifts
 * back a day in western timezones.
 */
export function parseDateOnlyLocal(value: string | Date | null | undefined): Date | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const s = String(value).trim();
    if (!s) return null;
    const m = ISO_DATE_PREFIX.exec(s);
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const dt = new Date(y, mo - 1, d);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

const DEFAULT_DATE_ONLY_OPTIONS: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
};

/** Timezone-safe display for date-only API values (ledger / PO / payment dates). */
export function formatDateOnly(
    value: string | Date | null | undefined,
    locale?: string,
    options?: Intl.DateTimeFormatOptions,
): string {
    const parsed = parseDateOnlyLocal(value);
    if (!parsed) return '';
    return parsed.toLocaleDateString(locale, options ?? DEFAULT_DATE_ONLY_OPTIONS);
}

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(amount);
};

/** @deprecated Prefer {@link formatDateOnly} for API date-only fields. */
export const formatDate = (dateString: string | Date): string => {
    if (!dateString) return '';
    return formatDateOnly(dateString, 'en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).toUpperCase();
};

export const formatSKU = (sku: string): string => {
    return sku.toUpperCase().replace(/\s+/g, '-');
};

export const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
};
