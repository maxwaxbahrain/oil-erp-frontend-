import { describe, expect, it } from 'vitest';
import {
    isOpenPayablePurchase,
    payablePurchaseTotal,
    purchaseCountsAsPayable,
} from '../purchasesService';

const orders = [
    { status: 'Pending', grandTotal: 250, remaining_balance: 250 },
    { status: 'Draft', grandTotal: 15, remaining_balance: 15 },
    { status: 'Rejected', grandTotal: 80, remaining_balance: 50 },
    { status: 'Approved', grandTotal: 100, remaining_balance: 100 },
    { status: 'GRN', grandTotal: 30, remaining_balance: 30 },
    { status: 'Received', grandTotal: 40, remaining_balance: 0 },
    { status: 'Paid', grandTotal: 50, remaining_balance: 0 },
    { status: 'Completed', grandTotal: 60, remaining_balance: 10 },
];

describe('purchase statuses that count as payable', () => {
    it('counts Approved and later, and ignores Draft, Pending, and Rejected', () => {
        expect(purchaseCountsAsPayable('Pending')).toBe(false);
        expect(purchaseCountsAsPayable('Draft')).toBe(false);
        expect(purchaseCountsAsPayable('Rejected')).toBe(false);
        expect(purchaseCountsAsPayable('Approved')).toBe(true);
        expect(purchaseCountsAsPayable('GRN')).toBe(true);
        expect(purchaseCountsAsPayable('Received')).toBe(true);
        expect(purchaseCountsAsPayable('Paid')).toBe(true);
        expect(purchaseCountsAsPayable('Completed')).toBe(true);
        expect(payablePurchaseTotal(orders)).toBe(280);
    });

    it('keeps a rejected order off the pay-supplier list even when money is still open', () => {
        const rejected = orders.find((po) => po.status === 'Rejected');
        expect(isOpenPayablePurchase(rejected)).toBe(false);
        expect(isOpenPayablePurchase(orders.find((po) => po.status === 'Approved'))).toBe(true);
        expect(isOpenPayablePurchase(orders.find((po) => po.status === 'Received'))).toBe(false);
    });
});
