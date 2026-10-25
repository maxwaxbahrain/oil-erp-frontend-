import { parseLocalDate } from './dates';
import { purchaseCountsAsPayable } from '../services/purchasesService';

const MS_DAY = 86_400_000;

/** Purchase fields the terms check reads. A full PurchaseOrder satisfies it. */
export type PayablePurchase = {
    date?: string | null;
    status?: string | null;
    payment_status?: string | null;
};

export type TermsAssessment = {
    isOverdue: boolean;
    isDueSoon: boolean;
    ageDays: number | null;
};

export function parseNetDays(terms: string): number {
    const m = terms.match(/net\s*(\d+)/i);
    if (m) return Number(m[1]) || 30;
    if (/cod|cash/i.test(terms)) return 0;
    return 30;
}

function isPaid(po: PayablePurchase): boolean {
    const status = String(po.status ?? '').trim().toLowerCase();
    const paymentStatus = String(po.payment_status ?? '').trim().toLowerCase();
    return status === 'paid' || paymentStatus === 'paid';
}

/** Whole local calendar days from the oldest open payable PO to today. Null when none qualify. */
export function oldestOpenPayableAgeDays(
    purchases: PayablePurchase[],
    today: Date,
): number | null {
    const todayStart = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    let oldest: number | null = null;
    for (const po of purchases) {
        if (!purchaseCountsAsPayable(po.status)) continue;
        if (isPaid(po)) continue;
        const poDate = parseLocalDate(po.date);
        if (!poDate) continue;
        const poStart = Date.UTC(poDate.getFullYear(), poDate.getMonth(), poDate.getDate());
        const days = Math.round((todayStart - poStart) / MS_DAY);
        if (oldest == null || days > oldest) oldest = days;
    }
    return oldest;
}

/**
 * Overdue only when a balance is owed, terms have a positive net-day count,
 * and an open payable PO is older than that count. No invented age.
 */
export function assessTerms(
    balance: number,
    terms: string,
    purchases: PayablePurchase[],
    today: Date,
): TermsAssessment {
    const ageDays = oldestOpenPayableAgeDays(purchases, today);
    if (balance <= 0) return { isOverdue: false, isDueSoon: false, ageDays };
    const netDays = parseNetDays(terms);
    if (netDays === 0 || ageDays == null) {
        return { isOverdue: false, isDueSoon: false, ageDays };
    }
    const isOverdue = ageDays > netDays;
    const isDueSoon = !isOverdue && ageDays >= netDays - 7 && ageDays <= netDays;
    return { isOverdue, isDueSoon, ageDays };
}
