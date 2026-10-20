import { describe, expect, it } from 'vitest';

import {
    dueDateFrom,
    invoiceNumberFromNarration,
    openingAccountName,
    paymentModeFromDebit,
    sumLineDiscounts,
} from '../migrationParsers';

describe('paymentModeFromDebit', () => {
    it('treats cash on hand, petty cash, and any cash-named debit as Cash', () => {
        expect(paymentModeFromDebit('Cash on Hand')).toBe('Cash');
        expect(paymentModeFromDebit('cash on hand')).toBe('Cash');
        expect(paymentModeFromDebit('Petty Cash')).toBe('Cash');
        expect(paymentModeFromDebit('  PETTY CASH  ')).toBe('Cash');
        expect(paymentModeFromDebit('Office Cash Drawer')).toBe('Cash');
    });

    it('treats non-cash debits, including the operating bank, as Bank Transfer', () => {
        expect(paymentModeFromDebit('Bank - Operating Account')).toBe('Bank Transfer');
        expect(paymentModeFromDebit('Bank - Payroll')).toBe('Bank Transfer');
        expect(paymentModeFromDebit('')).toBe('Bank Transfer');
    });
});

describe('dueDateFrom', () => {
    it('prefers the due_date column over a date in the narration', () => {
        expect(dueDateFrom({
            due_date: '2026-03-01',
            narration: 'Balance due 2026-04-15',
        })).toBe('2026-03-01');
    });

    it('reads due YYYY-MM-DD from the narration when the column is empty', () => {
        expect(dueDateFrom({ due_date: '  ', narration: 'Net 30, due 2024-12-31' })).toBe('2024-12-31');
        expect(dueDateFrom({ narration: 'due 2025-01-02' })).toBe('2025-01-02');
    });

    it('returns null when neither the column nor the narration has a due date', () => {
        expect(dueDateFrom({ due_date: null, narration: 'no date here' })).toBeNull();
        expect(dueDateFrom({ due_date: '', narration: 'DUE 2024-12-31' })).toBeNull();
        expect(dueDateFrom({})).toBeNull();
    });
});

describe('invoiceNumberFromNarration', () => {
    it('reads a credit-note invoice number after against', () => {
        expect(invoiceNumberFromNarration('Credit against INV-1042 issued', 'credit_note')).toBe('INV-1042');
        expect(invoiceNumberFromNarration('CREDIT NOTE (no goods) against INV-000123: Price adjustment', 'credit_note')).toBe('INV-000123');
        expect(invoiceNumberFromNarration('write-off of INV-1042', 'credit_note')).toBeNull();
    });

    it('reads a bad-debt invoice number after write-off of', () => {
        expect(invoiceNumberFromNarration('Bad debt write-off of INV-2002 remaining', 'bad_debt')).toBe('INV-2002');
        expect(invoiceNumberFromNarration('Bad debt write-off of INV-000045.', 'bad_debt')).toBe('INV-000045');
        expect(invoiceNumberFromNarration('against INV-2002', 'bad_debt')).toBeNull();
    });

    it('returns null when the narration has no invoice number', () => {
        expect(invoiceNumberFromNarration('', 'credit_note')).toBeNull();
        expect(invoiceNumberFromNarration('misc journal', 'bad_debt')).toBeNull();
    });
});

describe('openingAccountName', () => {
    it('maps cash, capital, and the operating bank', () => {
        expect(openingAccountName('Cash-in-hand', 'Drawer')).toBe('Cash on Hand');
        expect(openingAccountName('Capital Account', 'Proprietor')).toBe('Owner Capital');
        expect(openingAccountName('Bank Accounts', 'Bank - Operating Account')).toBe('Bank');
    });

    it('returns null for an unmapped bank name', () => {
        expect(openingAccountName('Bank Accounts', 'Bank - Payroll Account')).toBeNull();
        expect(openingAccountName('Sundry Debtors', 'Bank - Operating Account')).toBeNull();
    });
});

describe('sumLineDiscounts', () => {
    it('sums line discounts and rounds to 2 decimal places', () => {
        expect(sumLineDiscounts([
            { discount: 0.1 },
            { discount: 0.2 },
            {},
            { discount: undefined },
        ])).toBe(0.3);
        expect(sumLineDiscounts([
            { discount: 0.014 },
            { discount: 0.014 },
        ])).toBe(0.03);
        expect(sumLineDiscounts([])).toBe(0);
    });
});
