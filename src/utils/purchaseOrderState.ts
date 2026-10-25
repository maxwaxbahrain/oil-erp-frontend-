import { purchaseCountsAsPayable } from '../services/purchasesService';

/** Same tolerance the payable overlay uses for a fully settled balance. */
const PAID_TOLERANCE = 0.005;

export type PurchaseOrderStateInput = {
    status?: string | null;
    payment_status?: string | null;
    remaining_balance?: number | null;
    grandTotal?: number | null;
};

export type PurchaseOrderClassCounts = {
    total: number;
    pendingApproval: number;
    openPayable: number;
    settled: number;
    totalValue: number;
    openValue: number;
};

export type PurchaseStepperLights = {
    approved: boolean;
    received: boolean;
    paid: boolean;
};

const APPROVED_LIT_STATUSES = new Set(['approved', 'grn', 'received', 'completed', 'paid']);
const RECEIVED_LIT_STATUSES = new Set(['grn', 'received', 'completed', 'paid']);

function paymentStatusKey(paymentStatus: string | null | undefined): string {
    return String(paymentStatus ?? '').trim().toLowerCase();
}

/** Paid in full: payment_status Paid, or remaining balance within tolerance. */
export function isPaidPo(po: PurchaseOrderStateInput): boolean {
    if (paymentStatusKey(po.payment_status) === 'paid') return true;
    return Number(po.remaining_balance) <= PAID_TOLERANCE;
}

/**
 * Payable workflow status with money still open.
 * Received / Completed alone is not enough — payment fields decide.
 */
export function isOpenPayablePo(po: PurchaseOrderStateInput): boolean {
    if (!purchaseCountsAsPayable(po.status)) return false;
    if (isPaidPo(po)) return false;
    return Number(po.remaining_balance) > PAID_TOLERANCE;
}

/** Unchanged: only Pending and Draft wait on approval. */
export function isPendingApprovalPo(po: PurchaseOrderStateInput): boolean {
    return po.status === 'Pending' || po.status === 'Draft';
}

/** PAYMENT cell text. Settled wins over a stale Partial status. */
export function paymentLabel(po: PurchaseOrderStateInput): 'Settled' | 'Partial' | 'Unpaid' {
    if (isPaidPo(po)) return 'Settled';
    if (paymentStatusKey(po.payment_status) === 'partial') return 'Partial';
    return 'Unpaid';
}

/** Workflow stepper. The Paid step follows payment, not workflow status. */
export function purchaseStepperLights(po: PurchaseOrderStateInput): PurchaseStepperLights {
    const status = String(po.status ?? '').trim().toLowerCase();
    return {
        approved: APPROVED_LIT_STATUSES.has(status),
        received: RECEIVED_LIT_STATUSES.has(status),
        paid: isPaidPo(po),
    };
}

export function classifyPurchaseOrders(list: readonly PurchaseOrderStateInput[]): PurchaseOrderClassCounts {
    let pendingApproval = 0;
    let openPayable = 0;
    let settled = 0;
    let totalValue = 0;
    let openValue = 0;

    for (const po of list) {
        totalValue += Number(po.grandTotal) || 0;
        if (isPendingApprovalPo(po)) pendingApproval += 1;
        if (isPaidPo(po)) settled += 1;
        if (isOpenPayablePo(po)) {
            openPayable += 1;
            openValue += Number(po.remaining_balance) || 0;
        }
    }

    return {
        total: list.length,
        pendingApproval,
        openPayable,
        settled,
        totalValue,
        openValue,
    };
}
