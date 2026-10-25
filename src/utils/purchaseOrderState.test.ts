import { describe, expect, it } from 'vitest';
import {
    classifyPurchaseOrders,
    isOpenPayablePo,
    isPaidPo,
    isPendingApprovalPo,
    paymentLabel,
    purchaseStepperLights,
    type PurchaseOrderStateInput,
} from './purchaseOrderState';

function po(overrides: PurchaseOrderStateInput = {}): PurchaseOrderStateInput {
    return {
        status: 'Received',
        payment_status: 'Unpaid',
        remaining_balance: 100,
        grandTotal: 100,
        ...overrides,
    };
}

describe('purchaseOrderState', () => {
    it('treats Received + Unpaid + remaining 100 as open payable, not settled', () => {
        const row = po();
        expect(isOpenPayablePo(row)).toBe(true);
        expect(isPaidPo(row)).toBe(false);
        expect(paymentLabel(row)).toBe('Unpaid');
        expect(purchaseStepperLights(row)).toEqual({ approved: true, received: true, paid: false });
    });

    it('treats Received + Paid + remaining 0 as settled', () => {
        const row = po({ payment_status: 'Paid', remaining_balance: 0, grandTotal: 100 });
        expect(isPaidPo(row)).toBe(true);
        expect(isOpenPayablePo(row)).toBe(false);
        expect(paymentLabel(row)).toBe('Settled');
        expect(purchaseStepperLights(row).paid).toBe(true);
        expect(isPaidPo(po({ payment_status: 'paid', remaining_balance: 80 }))).toBe(true);
        expect(isPaidPo(po({ payment_status: 'Advance Paid', remaining_balance: 40 }))).toBe(false);
        expect(paymentLabel(po({ payment_status: 'Advance Paid', remaining_balance: 40 }))).toBe('Unpaid');
    });

    it('treats Received + Partial + remaining 40 as open payable and labels PAYMENT Partial', () => {
        const row = po({ payment_status: 'Partial', remaining_balance: 40, grandTotal: 80 });
        expect(isOpenPayablePo(row)).toBe(true);
        expect(isPaidPo(row)).toBe(false);
        expect(paymentLabel(row)).toBe('Partial');
        expect(paymentLabel(po({ payment_status: 'PARTIAL', remaining_balance: 40 }))).toBe('Partial');
        expect(purchaseStepperLights(row).paid).toBe(false);
    });

    it('never treats Draft, Pending, or Rejected as open payable', () => {
        for (const status of ['Draft', 'Pending', 'Rejected']) {
            const row = po({ status, payment_status: 'Unpaid', remaining_balance: 100, grandTotal: 100 });
            expect(isOpenPayablePo(row)).toBe(false);
            expect(purchaseStepperLights(row).paid).toBe(false);
        }
        expect(isPendingApprovalPo(po({ status: 'Pending' }))).toBe(true);
        expect(isPendingApprovalPo(po({ status: 'Draft' }))).toBe(true);
        expect(isPendingApprovalPo(po({ status: 'Rejected' }))).toBe(false);
        expect(isPendingApprovalPo(po({ status: 'Received' }))).toBe(false);

        const approved = po({ status: 'Approved', payment_status: 'Unpaid', remaining_balance: 10, grandTotal: 10 });
        expect(purchaseStepperLights(approved)).toEqual({ approved: true, received: false, paid: false });
        expect(isOpenPayablePo(approved)).toBe(true);
    });

    it('settles Received when payment_status is missing and remaining is within 0.005', () => {
        const row = po({ payment_status: undefined, remaining_balance: 0.004, grandTotal: 100 });
        expect(isPaidPo(row)).toBe(true);
        expect(isOpenPayablePo(row)).toBe(false);
        expect(paymentLabel(row)).toBe('Settled');
        expect(purchaseStepperLights(row).paid).toBe(true);

        const justOpen = po({ payment_status: undefined, remaining_balance: 0.006, grandTotal: 100 });
        expect(isPaidPo(justOpen)).toBe(false);
        expect(isOpenPayablePo(justOpen)).toBe(true);
        expect(paymentLabel(justOpen)).toBe('Unpaid');
    });

    it('classifies a mixed list and sums open payable remaining balances', () => {
        const list = [
            po({ status: 'Received', payment_status: 'Unpaid', remaining_balance: 100, grandTotal: 100 }),
            po({ status: 'Received', payment_status: 'Paid', remaining_balance: 0, grandTotal: 50 }),
            po({ status: 'Received', payment_status: 'Partial', remaining_balance: 40, grandTotal: 80 }),
            po({ status: 'Pending', payment_status: 'Unpaid', remaining_balance: 15, grandTotal: 15 }),
            po({ status: 'Draft', payment_status: 'Unpaid', remaining_balance: 5, grandTotal: 5 }),
            po({ status: 'Rejected', payment_status: 'Unpaid', remaining_balance: 9, grandTotal: 9 }),
            po({ status: 'GRN', payment_status: 'Unpaid', remaining_balance: 20, grandTotal: 20 }),
            po({ status: 'Completed', payment_status: 'Unpaid', remaining_balance: 0.004, grandTotal: 30 }),
        ];

        expect(classifyPurchaseOrders(list)).toEqual({
            total: 8,
            pendingApproval: 2,
            openPayable: 3,
            settled: 2,
            totalValue: 309,
            openValue: 160,
        });
    });

    it('lights the Paid step only when the order is paid, including workflow status Paid', () => {
        const completedUnpaid = po({ status: 'Completed', payment_status: 'Unpaid', remaining_balance: 12, grandTotal: 12 });
        expect(purchaseStepperLights(completedUnpaid)).toEqual({ approved: true, received: true, paid: false });

        const workflowPaidStillOpen = po({ status: 'Paid', payment_status: 'Unpaid', remaining_balance: 5, grandTotal: 5 });
        expect(isPaidPo(workflowPaidStillOpen)).toBe(false);
        expect(purchaseStepperLights(workflowPaidStillOpen)).toEqual({ approved: true, received: true, paid: false });
        expect(paymentLabel(workflowPaidStillOpen)).toBe('Unpaid');

        const grnPaid = po({ status: 'GRN', payment_status: 'Paid', remaining_balance: 0, grandTotal: 20 });
        expect(purchaseStepperLights(grnPaid).paid).toBe(true);
        expect(isOpenPayablePo(grnPaid)).toBe(false);
    });

    it('returns zeros for an empty list', () => {
        expect(classifyPurchaseOrders([])).toEqual({
            total: 0,
            pendingApproval: 0,
            openPayable: 0,
            settled: 0,
            totalValue: 0,
            openValue: 0,
        });
    });
});
