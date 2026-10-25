import { describe, expect, it } from 'vitest';
import {
  customerLedgerRowLabel,
  customerLedgerStatementCsv,
} from '../customerLedgerStatement';

describe('customer ledger opening row', () => {
  it('labels a debit opening, a credit opening, and a brought-forward row', () => {
    expect(customerLedgerRowLabel('opening_balance')).toBe('Opening Balance');
    expect(customerLedgerRowLabel('balance_brought_forward')).toBe('Balance brought forward');
    expect(customerLedgerRowLabel('invoice')).toBeNull();
  });

  it('puts the opening row in the PDF and Excel statement lines', () => {
    const csv = customerLedgerStatementCsv([
      {
        date: '2026-10-01',
        type: 'Opening Balance',
        referenceNumber: 'OPENING',
        description: 'Opening balance',
        debit: 1000,
        credit: 0,
        balance: 1000,
      },
      {
        date: '2026-02-01',
        type: 'Balance brought forward',
        referenceNumber: '',
        description: 'Balance brought forward',
        debit: 0,
        credit: 40,
        balance: -40,
      },
    ]);

    expect(csv).toContain('Opening Balance,OPENING,Opening balance,1000,0,1000');
    expect(csv).toContain('Balance brought forward,,Balance brought forward,0,40,-40');
    expect(csv).not.toContain('Credit Note');
  });
});
