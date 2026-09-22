import { describe, expect, it } from 'vitest';

import {
  bankTxHomeState,
  bankTxIdFromSourceId,
  buildStatementExport,
  chequeActions,
  chequeConfirmText,
  chequeEffectSentence,
  foreignTransferEditMessage,
  contraAccountOptions,
  contraOptionsWithCurrent,
  filterLedgerRows,
  ledgerRowAction,
  moneyDirectionLabel,
  orderLedgerRows,
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

describe('orderLedgerRows', () => {
  const rows: LedgerRow[] = [
    {
      id: 'a',
      date: '2026-01-01',
      type: 'bank_transaction',
      reference: 'R1',
      debit: 100,
      credit: 0,
      running_balance: 100,
    },
    {
      id: 'b',
      date: '2026-01-02',
      type: 'bank_transaction',
      reference: 'R2',
      debit: 0,
      credit: 40,
      running_balance: 60,
    },
  ];

  it('keeps oldest order unchanged and does not mutate the input', () => {
    const input = [...rows];
    const ordered = orderLedgerRows(input, 'oldest');
    expect(ordered.map((row) => row.id)).toEqual(['a', 'b']);
    expect(ordered[0].running_balance).toBe(100);
    expect(ordered[1].running_balance).toBe(60);
    expect(input.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('reverses for newest without changing running_balance values', () => {
    const input = [...rows];
    const ordered = orderLedgerRows(input, 'newest');
    expect(ordered.map((row) => row.id)).toEqual(['b', 'a']);
    expect(ordered[0].running_balance).toBe(60);
    expect(ordered[1].running_balance).toBe(100);
    expect(input.map((row) => row.id)).toEqual(['a', 'b']);
  });
});

describe('chequeConfirmText', () => {
  const fmt = (amount: number) => `$${amount.toFixed(2)}`;

  it('clear Received mentions books and cheque details', () => {
    const text = chequeConfirmText(
      'clear',
      { chequeNo: 'CHQ-9', amount: 250, type: 'Received' },
      fmt,
    );
    expect(text).toContain('CHQ-9');
    expect(text).toContain('$250.00');
    expect(text).toContain('recorded in the books');
  });

  it('clear Issued mentions status-only change', () => {
    const text = chequeConfirmText(
      'clear',
      { chequeNo: 'CHQ-10', amount: 100, type: 'Issued' },
      fmt,
    );
    expect(text).toContain('CHQ-10');
    expect(text).toContain('only changes the status');
  });

  it('bounce glPosted mentions reversal in the books', () => {
    const text = chequeConfirmText(
      'bounce',
      { chequeNo: 'CHQ-11', amount: 75, type: 'Received', glPosted: true },
      fmt,
    );
    expect(text).toContain('CHQ-11');
    expect(text).toContain('$75.00');
    expect(text).toContain('reversed in the books');
    expect(text).toContain('cannot be undone');
  });

  it('bounce not glPosted mentions status-only change', () => {
    const text = chequeConfirmText(
      'bounce',
      { chequeNo: 'CHQ-12', amount: 50, type: 'Received', glPosted: false },
      fmt,
    );
    expect(text).toContain('CHQ-12');
    expect(text).toContain('only the status changes');
    expect(text).toContain('cannot be undone');
  });

  it('cancel mentions cannot be undone', () => {
    const text = chequeConfirmText(
      'cancel',
      { chequeNo: 'CHQ-13', amount: 30, type: 'Issued' },
      fmt,
    );
    expect(text).toContain('CHQ-13');
    expect(text).toContain('cannot be undone');
  });
});

describe('bankTxHomeState', () => {
  it('returns here when account matches selected account', () => {
    expect(bankTxHomeState({ accountId: 5 }, 5)).toBe('here');
  });

  it('returns elsewhere when account differs or is missing', () => {
    expect(bankTxHomeState({ accountId: 5 }, 6)).toBe('elsewhere');
    expect(bankTxHomeState({ accountId: null }, 6)).toBe('elsewhere');
    expect(bankTxHomeState({ accountId: 5 }, null)).toBe('elsewhere');
  });
});

describe('contraOptionsWithCurrent', () => {
  const accounts = [
    { id: 1, code: '1000', name: 'Operating Bank', system_key: 'bank_operating', is_active: true },
    { id: 2, code: '1010', name: 'Petty Cash', system_key: 'cash_on_hand', is_active: true },
    { id: 5, code: '6100', name: 'Rent Expense', system_key: null, is_active: true },
  ];

  it('adds stored account once as current when missing from options', () => {
    const extended = [
      ...accounts,
      { id: 7, code: '6200', name: 'Legacy Other', system_key: null, is_active: false },
    ];
    const base = contraAccountOptions(extended, 1);
    const withCurrent = contraOptionsWithCurrent(base, 7, extended, null);
    expect(withCurrent).toHaveLength(base.length + 1);
    expect(withCurrent.find((a) => a.id === 7)?.isCurrent).toBe(true);
  });

  it('adds nothing when stored account is already offered', () => {
    const base = contraAccountOptions(accounts, 1);
    const withCurrent = contraOptionsWithCurrent(base, 2, accounts, null);
    expect(withCurrent).toEqual(base);
  });

  it('adds nothing when there is no stored account', () => {
    const base = contraAccountOptions(accounts, 1);
    expect(contraOptionsWithCurrent(base, null, accounts, null)).toEqual(base);
  });
});

describe('buildStatementExport', () => {
  const rows: LedgerRow[] = [
    {
      id: 'a',
      date: '2026-01-01',
      type: 'bank_transaction',
      reference: 'DEP',
      description: 'Deposit',
      debit: 110,
      credit: 0,
      running_balance: 110,
    },
    {
      id: 'b',
      date: '2026-01-02',
      type: 'expense',
      reference: 'FEE',
      description: 'Bank fee',
      debit: 0,
      credit: 10,
      running_balance: 100,
    },
  ];

  it('computes period totals from the rows it is given, not the unfiltered ledger', () => {
    const exported = buildStatementExport(rows, { search: 'fee', direction: 'all' });
    expect(exported.filterActive).toBe(true);
    expect(exported.label).toBe('Filtered · 1 of 2 rows');
    expect(exported.rows.map((row) => row.id)).toEqual(['b']);
    expect(exported.moneyIn).toBe(0);
    expect(exported.moneyOut).toBe(10);
    expect(periodTotals(exported.rows)).toEqual({ moneyIn: 0, moneyOut: 10 });
    expect(periodTotals(rows)).toEqual({ moneyIn: 110, moneyOut: 10 });
  });

  it('keeps the full ledger when no search or direction filter is active', () => {
    const exported = buildStatementExport(rows, { search: '', direction: 'all' });
    expect(exported.filterActive).toBe(false);
    expect(exported.label).toBeNull();
    expect(exported.moneyIn).toBe(110);
    expect(exported.moneyOut).toBe(10);
  });
});

describe('foreignTransferEditMessage', () => {
  it('appears when the row account is not the selected account', () => {
    expect(foreignTransferEditMessage(1, 2, 'Bank')).toBe(
      'This transfer was recorded from the Bank account — edit it there',
    );
  });

  it('is absent when the row belongs to the selected account', () => {
    expect(foreignTransferEditMessage(2, 2, 'Bank')).toBeNull();
  });
});

describe('chequeEffectSentence', () => {
  const fmt = (amount: number) => `$${amount.toFixed(2)}`;

  it('states the clear and bounce effects', () => {
    expect(chequeEffectSentence('clear', { chequeNo: '1044', amount: 110, type: 'Received' }, fmt))
      .toBe('Clear will record a $110.00 payment dated today');
    expect(chequeEffectSentence('bounce', { chequeNo: '1044', amount: 110, type: 'Received', glPosted: true }, fmt))
      .toBe('Bounce will void that payment');
  });
});
