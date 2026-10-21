import { describe, expect, it } from 'vitest';

import { assessTerms, type PayablePurchase } from './supplierTerms';

const TODAY = new Date(2026, 9, 21, 15);

function po(overrides: PayablePurchase): PayablePurchase {
    return { status: 'Approved', payment_status: 'Unpaid', ...overrides };
}

describe('supplier terms', () => {
    it('T1 does not invent an age when nothing is payable', () => {
        const result = assessTerms(5000, 'Net 30', [], TODAY);
        expect(result.isOverdue).toBe(false);
        expect(result.isDueSoon).toBe(false);
        expect(result.ageDays).toBeNull();
    });

    it('T2 ages an unpaid approved PO on the local calendar', () => {
        const at31 = assessTerms(100, 'Net 30', [po({ date: '2026-09-20' })], TODAY);
        expect(at31.ageDays).toBe(31);
        expect(at31.isOverdue).toBe(true);
        expect(at31.isDueSoon).toBe(false);

        const at30 = assessTerms(100, 'Net 30', [po({ date: '2026-09-21' })], TODAY);
        expect(at30.ageDays).toBe(30);
        expect(at30.isOverdue).toBe(false);
        expect(at30.isDueSoon).toBe(true);

        const recent = assessTerms(100, 'Net 30', [po({ date: '2026-10-15' })], TODAY);
        expect(recent.ageDays).toBe(6);
        expect(recent.isOverdue).toBe(false);
        expect(recent.isDueSoon).toBe(false);
    });

    it('T3 skips paid and draft purchases', () => {
        const onlyClosed: PayablePurchase[] = [
            po({ status: 'paid', date: '2026-01-01' }),
            po({ status: 'Approved', payment_status: 'PAID', date: '2026-01-01' }),
            po({ status: 'draft', payment_status: 'Unpaid', date: '2026-01-01' }),
        ];
        const skipped = assessTerms(5000, 'Net 30', onlyClosed, TODAY);
        expect(skipped.ageDays).toBeNull();
        expect(skipped.isOverdue).toBe(false);
        expect(skipped.isDueSoon).toBe(false);

        const withOpen = assessTerms(5000, 'Net 30', [
            ...onlyClosed,
            po({ date: '2026-10-15' }),
        ], TODAY);
        expect(withOpen.ageDays).toBe(6);
        expect(withOpen.isOverdue).toBe(false);
    });

    it('T4 treats COD as never overdue and Net 45 day 40 as due soon', () => {
        const cod = assessTerms(5000, 'COD', [po({ date: '2026-01-01' })], TODAY);
        expect(cod.ageDays).toBeGreaterThan(30);
        expect(cod.isOverdue).toBe(false);
        expect(cod.isDueSoon).toBe(false);

        const net45 = assessTerms(100, 'Net 45', [po({ date: '2026-09-11' })], TODAY);
        expect(net45.ageDays).toBe(40);
        expect(net45.isOverdue).toBe(false);
        expect(net45.isDueSoon).toBe(true);
    });

    it('T5 does not call a zero balance overdue', () => {
        const result = assessTerms(0, 'Net 30', [po({ date: '2026-07-23' })], TODAY);
        expect(result.ageDays).toBe(90);
        expect(result.isOverdue).toBe(false);
        expect(result.isDueSoon).toBe(false);
    });
});
