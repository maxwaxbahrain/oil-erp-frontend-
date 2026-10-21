import { invoiceCountsTowardCustomerBalance } from './invoiceBalance';
import { parseStoredTimestamp } from './dates';

export type SuggestionCustomer = {
    id: string | number;
    name: string;
};

export type SuggestionInvoice = {
    customerId?: string | number | null;
    customer_id?: string | number | null;
    invoiceDate?: string | null;
    date?: string | null;
    grandTotal?: number | null;
    total?: number | null;
    status?: string | null;
};

export type SuggestionSchedule = {
    customerId?: string | number | null;
    customer_id?: string | number | null;
};

export type RecurringSuggestion = {
    id: string;
    name: string;
    invoiceCount: number;
    firstDate: string;
    lastDate: string;
    monthlyAmount: number;
};

export type RecurringSuggestionResult = {
    suggestions: RecurringSuggestion[];
    moreCount: number;
};

type Options = {
    minInvoices?: number;
    limit?: number;
};

type Bucket = {
    count: number;
    sum: number;
    firstMs: number;
    lastMs: number;
    firstDate: string;
    lastDate: string;
};

function customerKey(value: string | number | null | undefined): string {
    if (value == null) return '';
    return String(value).trim();
}

function invoiceCustomerKey(invoice: SuggestionInvoice): string {
    return customerKey(invoice.customerId ?? invoice.customer_id);
}

function invoiceRawDate(invoice: SuggestionInvoice): string {
    const raw = invoice.invoiceDate ?? invoice.date;
    return raw == null ? '' : String(raw).trim();
}

function invoiceAmount(invoice: SuggestionInvoice): number {
    const raw = invoice.grandTotal ?? invoice.total ?? 0;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : 0;
}

/** Inclusive local-calendar months from first to last. A single month is 1. */
function inclusiveMonthSpan(first: Date, last: Date): number {
    const span = (last.getFullYear() - first.getFullYear()) * 12
        + (last.getMonth() - first.getMonth())
        + 1;
    return Math.max(1, span);
}

export function computeRecurringSuggestions(
    customers: SuggestionCustomer[],
    invoices: SuggestionInvoice[],
    recurring: SuggestionSchedule[],
    options: Options = {},
): RecurringSuggestionResult {
    const minInvoices = options.minInvoices ?? 3;
    const limit = options.limit ?? 3;
    const scheduled = new Set(
        recurring
            .map(row => customerKey(row.customerId ?? row.customer_id))
            .filter(id => id !== ''),
    );

    const buckets = new Map<string, Bucket>();
    for (const invoice of invoices) {
        if (!invoiceCountsTowardCustomerBalance(invoice.status)) continue;
        const id = invoiceCustomerKey(invoice);
        if (!id) continue;
        const rawDate = invoiceRawDate(invoice);
        const when = parseStoredTimestamp(rawDate);
        if (!when) continue;
        const ms = when.getTime();
        const amount = invoiceAmount(invoice);
        const existing = buckets.get(id);
        if (!existing) {
            buckets.set(id, {
                count: 1,
                sum: amount,
                firstMs: ms,
                lastMs: ms,
                firstDate: rawDate,
                lastDate: rawDate,
            });
            continue;
        }
        existing.count += 1;
        existing.sum += amount;
        if (ms < existing.firstMs) {
            existing.firstMs = ms;
            existing.firstDate = rawDate;
        }
        if (ms > existing.lastMs) {
            existing.lastMs = ms;
            existing.lastDate = rawDate;
        }
    }

    const qualifying: RecurringSuggestion[] = [];
    for (const customer of customers) {
        const id = customerKey(customer.id);
        if (!id || scheduled.has(id)) continue;
        const bucket = buckets.get(id);
        if (!bucket || bucket.count < minInvoices) continue;
        const first = parseStoredTimestamp(bucket.firstDate);
        const last = parseStoredTimestamp(bucket.lastDate);
        if (!first || !last) continue;
        qualifying.push({
            id,
            name: customer.name,
            invoiceCount: bucket.count,
            firstDate: bucket.firstDate,
            lastDate: bucket.lastDate,
            monthlyAmount: bucket.sum / inclusiveMonthSpan(first, last),
        });
    }

    qualifying.sort((a, b) => {
        if (b.monthlyAmount !== a.monthlyAmount) return b.monthlyAmount - a.monthlyAmount;
        return a.name.localeCompare(b.name);
    });

    const shown = Math.max(0, limit);
    const suggestions = qualifying.slice(0, shown);
    return {
        suggestions,
        moreCount: Math.max(0, qualifying.length - suggestions.length),
    };
}
