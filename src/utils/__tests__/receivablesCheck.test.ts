import { describe, expect, it, vi } from 'vitest';

import { buildReceivablesCheck } from '../receivablesCheck';

describe('receivables check', () => {
  it('lists a paid invoice the old balance still counted, and adds the gap to the cent', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const report = buildReceivablesCheck({
      asOf: new Date('2026-08-01T12:00:00'),
      invoices: [
        {
          id: '9',
          customerId: 'c1',
          customerName: 'Alpha',
          invoiceNumber: 'INV-9',
          invoiceDate: '2026-08-01',
          dueDate: '2026-08-01',
          grandTotal: 100,
          amount_paid: 0,
          remaining_balance: 0,
          status: 'Paid',
        },
        {
          id: '10',
          customerId: 'c1',
          customerName: 'Alpha',
          invoiceNumber: 'INV-10',
          invoiceDate: '2026-08-01',
          dueDate: '2026-08-01',
          grandTotal: 50,
          remaining_balance: 50,
          status: 'Unpaid',
        },
        {
          id: '11',
          customerId: 'c1',
          customerName: 'Alpha',
          invoiceNumber: 'INV-CR',
          invoiceDate: '2026-07-01',
          dueDate: '2026-07-01',
          grandTotal: -20,
          remaining_balance: -20,
          status: 'Unpaid',
        },
      ],
      payments: [{ customer_id: 'c1', amount: 40 }],
      creditNotes: [
        {
          id: '3',
          creditNoteNumber: 'CN-3',
          customerId: 'c2',
          customerName: 'Beta',
          remainingCredit: 5,
          status: 'issued',
        },
      ],
      importedCredits: [
        {
          id: '77',
          customer_id: 'c1',
          customer_name: 'Alpha',
          amount: 12,
          reference: 'SR-77',
          stored_as: 'sales_return',
        },
      ],
      unappliedPayments: [
        { id: '4', customer_id: 'c1', customer_name: 'Alpha', amount: 8, reference: 'PMT-4' },
      ],
      collections: {
        total: 50,
        rows: [{ invoice_id: 10, invoice_number: 'INV-10', outstanding: 50, customer_name: 'Alpha' }],
      },
    });

    expect(report.paidShownOpen.count).toBe(1);
    expect(report.paidShownOpen.total).toBe(60);
    expect(report.paidShownOpen.rows[0].href).toBe('/sales/invoices/9');
    expect(report.gross).toBe(50);
    expect(report.unappliedCredits.total).toBe(37);
    expect(report.unappliedCredits.rows.map((row) => row.storedAs).sort()).toEqual([
      'credit note',
      'negative invoice',
      'sales return',
    ]);
    expect(report.unappliedPayments.total).toBe(8);
    expect(report.net).toBe(13);
    expect(report.customers.find((row) => row.customerId === 'c1')).toMatchObject({
      gross: 50,
      credits: 32,
      net: 18,
    });
    expect(report.gapAddsUp).toBe(true);
    const difference = report.gapLines.find((line) => line.label.startsWith('Difference'))!;
    const onlyAged = report.gapLines.find((line) => line.label === 'In Aged Receivable only')!;
    const onlyCollections = report.gapLines.find((line) => line.label === 'In Collections only')!;
    const same = report.gapLines.find((line) => line.label.startsWith('Same invoice'))!;
    expect(difference.amount).toBe(
      Math.round((onlyAged.amount - onlyCollections.amount + same.amount) * 100) / 100,
    );
  });
});
