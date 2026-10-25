import { parseLocalDate } from './dates';

const MS_DAY = 86_400_000;
const BALANCE_EPS = 0.01;

/** Open bill fields this report actually reads. A full Invoice satisfies it. */
export type OutstandingBillInput = {
    dueDate?: string | null;
    remaining_balance?: number | null;
    status?: string | null;
};

export type OutstandingBuckets = {
    current: number;
    b30: number;
    b60: number;
    b90: number;
    b90plus: number;
    counts: {
        current: number;
        b30: number;
        b60: number;
        b90: number;
        b90plus: number;
    };
};

export type OutstandingTabCounts = {
    all: number;
    overdue: number;
    dueSoon: number;
    partial: number;
    unpaid: number;
};

export function balanceOf(invoice: OutstandingBillInput): number {
    const amount = Number(invoice.remaining_balance ?? 0);
    return Number.isFinite(amount) ? amount : 0;
}

function statusOf(invoice: OutstandingBillInput): string {
    return String(invoice.status ?? '').trim().toLowerCase();
}

export function isFullyPaid(invoice: OutstandingBillInput): boolean {
    return statusOf(invoice) === 'paid' || balanceOf(invoice) <= BALANCE_EPS;
}

export function isPartial(invoice: OutstandingBillInput): boolean {
    return statusOf(invoice) === 'partial' && balanceOf(invoice) > BALANCE_EPS;
}

export function isUnpaidNoPayment(invoice: OutstandingBillInput): boolean {
    return statusOf(invoice) === 'unpaid' && balanceOf(invoice) > BALANCE_EPS;
}

/**
 * Whole local calendar days from the due date to `today`.
 * 0 means due today. Negative means not yet due.
 * A missing or unparseable due date is 0.
 */
export function daysPastDueLocal(dueDate: string | null | undefined, today: Date): number {
    const due = parseLocalDate(dueDate);
    if (!due) return 0;
    // UTC midnight of the local year/month/day, so a DST shift does not change the day count.
    const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const dueStart = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
    return Math.round((todayStart - dueStart) / MS_DAY);
}

/** Days past due for an open bill. A settled balance is never past due. */
export function daysPastDue(invoice: OutstandingBillInput, today: Date = new Date()): number {
    if (!invoice.dueDate || balanceOf(invoice) <= BALANCE_EPS) return 0;
    return daysPastDueLocal(invoice.dueDate, today);
}

export function isOverdue(invoice: OutstandingBillInput, today: Date = new Date()): boolean {
    return daysPastDue(invoice, today) > 0; // 'due today' is NOT overdue
}

/** Due today through 7 local days ahead, and still carrying a balance. */
export function isDueSoon(invoice: OutstandingBillInput, today: Date = new Date()): boolean {
    if (!invoice.dueDate || balanceOf(invoice) <= BALANCE_EPS) return false;
    if (!parseLocalDate(invoice.dueDate)) return false;
    const daysUntilDue = -daysPastDueLocal(invoice.dueDate, today);
    return daysUntilDue >= 0 && daysUntilDue <= 7;
}

function addBucket(
    acc: OutstandingBuckets,
    key: keyof OutstandingBuckets['counts'],
    amount: number,
): void {
    acc[key] += amount;
    acc.counts[key] += 1;
}

/**
 * Aging by calendar days past the due date.
 * Current = not yet due, including due today (days <= 0).
 * Then 1–30, 31–60, 61–90, and >90.
 */
export function bucketOutstanding(
    invoices: OutstandingBillInput[],
    today: Date = new Date(),
): OutstandingBuckets {
    const acc: OutstandingBuckets = {
        current: 0,
        b30: 0,
        b60: 0,
        b90: 0,
        b90plus: 0,
        counts: { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0 },
    };
    for (const invoice of invoices) {
        if (isFullyPaid(invoice)) continue;
        const days = daysPastDueLocal(invoice.dueDate, today);
        const amount = balanceOf(invoice);
        if (days <= 0) addBucket(acc, 'current', amount);
        else if (days <= 30) addBucket(acc, 'b30', amount);
        else if (days <= 60) addBucket(acc, 'b60', amount);
        else if (days <= 90) addBucket(acc, 'b90', amount);
        else addBucket(acc, 'b90plus', amount);
    }
    return acc;
}

export function tabCounts(
    invoices: OutstandingBillInput[],
    today: Date = new Date(),
): OutstandingTabCounts {
    const open = invoices.filter((invoice) => !isFullyPaid(invoice));
    return {
        all: open.length,
        overdue: open.filter((invoice) => isOverdue(invoice, today)).length,
        dueSoon: open.filter((invoice) => isDueSoon(invoice, today)).length,
        partial: open.filter(isPartial).length,
        unpaid: open.filter(isUnpaidNoPayment).length,
    };
}
