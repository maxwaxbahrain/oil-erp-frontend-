import { describe, expect, it } from 'vitest';

import { computeCreditNoteTotals } from './creditNoteTotals';

describe('computeCreditNoteTotals', () => {
    it('T1 sums used notes into issued and used, with nothing unused', () => {
        const result = computeCreditNoteTotals([
            { status: 'used', total: 100, usedAmount: 100, remainingCredit: 0 },
            { status: 'used', total: 200, usedAmount: 200, remainingCredit: 0 },
            { status: 'used', total: 300, usedAmount: 300, remainingCredit: 0 },
        ]);
        expect(result.totalIssued).toBe(600);
        expect(result.totalUsed).toBe(600);
        expect(result.pendingUnused).toBe(0);
        expect(result.issuedCount).toBe(3);
    });

    it('T2 counts issued and used notes, and leaves cancelled and draft out of issued', () => {
        const result = computeCreditNoteTotals([
            { status: 'issued', total: 50, usedAmount: 0, remainingCredit: 50 },
            { status: 'used', total: 70, usedAmount: 70, remainingCredit: 0 },
            { status: 'cancelled', total: 999, usedAmount: 0, remainingCredit: 0 },
            { status: 'draft', total: 999, usedAmount: 0, remainingCredit: 0 },
        ]);
        expect(result.totalIssued).toBe(120);
        expect(result.issuedCount).toBe(2);
        expect(result.pendingUnused).toBe(50);
        expect(result.totalUsed).toBe(70);
    });

    it('T3 treats status case-insensitively', () => {
        const result = computeCreditNoteTotals([
            { status: 'Used', total: 40, usedAmount: 40, remainingCredit: 0 },
            { status: 'ISSUED', total: 60, usedAmount: 0, remainingCredit: 60 },
            { status: 'VOID', total: 999, usedAmount: 0, remainingCredit: 0 },
            { status: 'Draft', total: 999, usedAmount: 0, remainingCredit: 0 },
        ]);
        expect(result.totalIssued).toBe(100);
        expect(result.issuedCount).toBe(2);
        expect(result.totalUsed).toBe(40);
        expect(result.pendingUnused).toBe(60);
    });
});
