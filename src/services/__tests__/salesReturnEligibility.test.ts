import { describe, expect, it } from 'vitest';

import { customersOpenForNewDocument, mapApiInvoiceToInvoice, type Customer, type Invoice } from '../api';
import {
  eligibleInvoiceEmptyReason,
  invoicesEligibleForReturn,
} from '../salesReturnService';

const today = new Date('2026-10-09T12:00:00');

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: '1',
    invoiceNumber: 'INV-1',
    customerId: '7',
    customerName: 'Alpha',
    invoiceDate: '2026-10-01',
    dueDate: '2026-10-15',
    lineItems: [],
    subtotal: 25,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 25,
    notes: '',
    status: 'Unpaid',
    createdAt: '2026-10-01',
    ...overrides,
  };
}

describe('invoices eligible for a sales return', () => {
  it('offers paid and partly paid invoices and refuses closed, zero, and demo invoices', () => {
    const rows = [
      invoice({ id: 'paid', status: 'Paid', invoiceNumber: 'INV-PAID' }),
      invoice({ id: 'part', status: 'Partial', invoiceNumber: 'INV-PART' }),
      invoice({ id: 'void', status: 'Void' }),
      invoice({ id: 'cancelled', status: 'Cancelled' }),
      invoice({ id: 'zero', grandTotal: 0, invoiceNumber: 'INV-ZERO' }),
      invoice({ id: 'demo', invoiceNumber: 'INV-DEMO-9' }),
      invoice({ id: 'old', invoiceDate: '2026-08-01', invoiceNumber: 'INV-OLD' }),
      invoice({ id: 'other', customerId: '8', invoiceNumber: 'INV-OTHER' }),
    ];

    expect(invoicesEligibleForReturn(rows, '7', today).map((row) => row.id)).toEqual(['paid', 'part']);
    expect(eligibleInvoiceEmptyReason([invoice({ status: 'Cancelled' })], '7', today)).toContain('void or cancelled');
    expect(eligibleInvoiceEmptyReason([], '7', today)).toBe('This customer has no invoices.');
  });

  it('does not offer an inactive customer', () => {
    const rows: Customer[] = [
      { id: '1', name: 'Open' },
      { id: '2', name: 'SMOKE TEST — stays listed when active', is_active: true },
      { id: '3', name: 'Closed', is_active: false },
    ];
    expect(customersOpenForNewDocument(rows).map((row) => row.id)).toEqual(['1', '2']);
  });

  it('keeps the invoice line product id', () => {
    const mapped = mapApiInvoiceToInvoice({
      id: 1,
      customer_id: 7,
      invoice_number: 'INV-1',
      date: '2026-10-01',
      total: 10,
      status: 'paid',
      items: [{ product: 'Oil', product_id: 44, quantity: 1, rate: 10, amount: 10 }],
    });
    expect(mapped.lineItems[0].productId).toBe('44');
    expect(mapped.status).toBe('Paid');
  });
});
