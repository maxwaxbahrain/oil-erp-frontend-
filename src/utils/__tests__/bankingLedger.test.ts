import { describe, expect, it } from 'vitest';

import {
  bankTxIdFromSourceId,
  chequeActions,
  contraAccountOptions,
  filterLedgerRows,
  ledgerRowAction,
  moneyDirectionLabel,
  paymentIdFromRow,
  periodTotals,
  type LedgerRow,
} from '../bankingLedger';

describe('bankTxIdFromSourceId', () => {
  it('parses plain and reversal suffix ids', () => {
    expect(bankTxIdFromSourceId('12')).toBe(12);
    expect(bankTxIdFromSourceId('12:r3')).toBe(12);
  });

  it('returns null for non-numeric ids', () => {
    expect(bankTxIdFromSourceId('abc')).toBeNull();
    expect(bankTxIdFromSourceId('abc:r3')).toBeNull();
    expect(bankTxIdFromSourceId(null)).toBeNull();
    expect(bankTxIdFromSourceId('')).toBeNull();
  });
});

describe('paymentIdFromRow', () => {
  it('returns id for payment rows only', () => {
    expect(paymentIdFromRow({ source_type: 'payment', source_id: '42' })).toBe(42);
    expect(paymentIdFromRow({ source_type: 'bank_transaction', source_id: '42' })).toBeNull();
    expect(paymentIdFromRow({ source_type: 'payment', source_id: 'x' })).toBeNull();
  });
});

describe('ledgerRowAction', () => {
  const bankRow: LedgerRow = {
    id: 'gl-1',
    date: '2026-01-01',
    type: 'bank_transaction',
    reference: 'REF',
    debit: 100,
    credit: 0,
    running_balance: 100,
    source_type: 'bank_transaction',
    source_id: '7',
    is_reversed: false,
    is_reversal: false,
  };

  it('allows edit-delete on live bank_transaction rows', () => {
    expect(ledgerRowAction(bankRow, {})).toBe('edit-delete');
  });

  it('returns none for reversed or reversal bank rows', () => {
    expect(ledgerRowAction({ ...bankRow, is_reversed: true }, {})).toBe('none');
    expect(ledgerRowAction({ ...bankRow, is_reversal: true }, {})).toBe('none');
  });

  it('void vs voided for payment rows', () => {
    const payRow: LedgerRow = {
      ...bankRow,
      source_type: 'payment',
      source_id: '9',
      type: 'customer_payment',
    };
    expect(ledgerRowAction(payRow, { '9': { voided: true } })).toBe('voided');
    expect(ledgerRowAction(payRow, { '9': { voided: false } })).toBe('void');
    expect(ledgerRowAction(payRow, {})).toBe('void');
  });

  it('returns none for supplier payments and journal vouchers', () => {
    expect(
      ledgerRowAction(
        { ...bankRow, source_type: 'supplier_payment', source_id: '1' },
        {},
      ),
    ).toBe('none');
    expect(
      ledgerRowAction(
        { ...bankRow, source_type: 'journal_voucher', source_id: '1' },
        {},
      ),
    ).toBe('none');
  });
});

describe('periodTotals', () => {
  it('sums debits as money in and credits as money out', () => {
    expect(
      periodTotals([
        { debit: 100, credit: 0 },
        { debit: 50, credit: 0 },
        { debit: 0, credit: 30 },
      ]),
    ).toEqual({ moneyIn: 150, moneyOut: 30 });
  });
});

describe('filterLedgerRows', () => {
  const rows: LedgerRow[] = [
    {
      id: 'a',
      date: '2026-01-01',
      type: 'bank_transaction',
      reference: 'DEP-001',
      description: 'Deposit',
      debit: 200,
      credit: 0,
      running_balance: 200,
    },
    {
      id: 'b',
      date: '2026-01-02',
      type: 'expense',
      reference: 'EXP-002',
      description: 'Rent',
      debit: 0,
      credit: 75,
      running_balance: 125,
    },
  ];

  it('filters by search and direction without changing running_balance', () => {
    const filtered = filterLedgerRows(rows, { search: 'rent', direction: 'out' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('b');
    expect(filtered[0].running_balance).toBe(125);
  });

  it('filters in-direction by debit > 0', () => {
    const filtered = filterLedgerRows(rows, { direction: 'in' });
    expect(filtered.map((r) => r.id)).toEqual(['a']);
    expect(filtered[0].running_balance).toBe(200);
  });
});

describe('chequeActions', () => {
  it('returns expected buttons per status', () => {
    expect(chequeActions('Pending', 'Received')).toEqual(['clear', 'bounce', 'cancel']);
    expect(chequeActions('Cleared', 'Received')).toEqual(['bounce']);
    expect(chequeActions('Bounced', 'Issued')).toEqual([]);
    expect(chequeActions('Cancelled', 'Issued')).toEqual([]);
  });
});

describe('moneyDirectionLabel', () => {
  it('maps Credit and Debit to user-facing labels', () => {
    expect(moneyDirectionLabel('Credit')).toBe('Money in');
    expect(moneyDirectionLabel('Debit')).toBe('Money out');
  });
});

describe('contraAccountOptions', () => {
  const accounts = [
    { id: 1, code: '1000', name: 'Operating Bank', system_key: 'bank_operating', is_active: true },
    { id: 2, code: '1010', name: 'Petty Cash', system_key: 'cash_on_hand', is_active: true },
    { id: 3, code: '1100', name: 'Accounts Receivable', system_key: 'accounts_receivable', is_active: true },
    { id: 4, code: '2000', name: 'Accounts Payable', system_key: 'accounts_payable', is_active: true },
    { id: 5, code: '6100', name: 'Rent Expense', system_key: null, is_active: true },
    { id: 6, code: '3000', name: 'Owner Equity', system_key: 'owner_equity', is_active: true },
    { id: 7, code: '9999', name: 'Inactive Other', system_key: null, is_active: false },
  ];

  it('keeps transfer and ordinary accounts while excluding AR/AP, inactive, and selected', () => {
    expect(contraAccountOptions(accounts, 1).map((a) => a.id)).toEqual([2, 5, 6]);
  });
});
