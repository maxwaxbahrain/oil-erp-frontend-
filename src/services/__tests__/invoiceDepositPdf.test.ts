import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { CompanySettings } from '../settingsService';
import type { Invoice } from '../api';

const pdfText = vi.hoisted(() => ({ lines: [] as string[] }));

vi.mock('jspdf', async () => {
  const actual = await vi.importActual<Record<string, any>>('jspdf');
  const Base = typeof actual.jsPDF === 'function'
    ? actual.jsPDF
    : typeof actual.default === 'function'
      ? actual.default
      : actual.default?.jsPDF;
  function Wrapped(this: unknown, ...args: unknown[]) {
    const doc = new Base(...args);
    const originalText = doc.text.bind(doc);
    doc.text = (text: unknown, ...rest: unknown[]) => {
      if (typeof text === 'string') pdfText.lines.push(text);
      else if (Array.isArray(text)) pdfText.lines.push(...text.map(String));
      return originalText(text, ...rest);
    };
    doc.save = () => undefined;
    return doc;
  }
  Object.assign(Wrapped, Base);
  Wrapped.prototype = Base.prototype;
  return { ...actual, default: Wrapped, jsPDF: Wrapped };
});

import { generateInvoicePDF as generateDocumentPdf, generateInvoiceWord } from '../invoiceDocumentService';
import { generateInvoicePDF as generateFormPdf } from '../../utils/invoicePDF';

const company: CompanySettings = {
  name: 'Soltol',
  address: '1 Main',
  city: 'Austin',
  country: 'US',
  phone: '555',
  email: 'a@soltol.com',
  website: '',
  taxId: '',
};

function invoice(deposit: string | null): Invoice {
  return {
    id: '1',
    invoiceNumber: 'INV-1',
    customerId: '1',
    customerName: 'Acme',
    invoiceDate: '2026-09-01',
    dueDate: '2026-10-01',
    lineItems: [{ product: 'Oil', description: '', quantity: 1, rate: 10, amount: 10 }],
    subtotal: 10,
    taxRate: 0,
    taxAmount: 0,
    discount: 0,
    grandTotal: 10,
    notes: 'Net 30',
    status: 'Unpaid',
    createdAt: '2026-09-01',
    deposit_account_name: deposit,
  };
}

describe('invoice deposit line', () => {
  it('prints Deposit to when the name is set and omits it when null', async () => {
    pdfText.lines.length = 0;
    generateFormPdf({
      invoiceNumber: 'INV-1',
      invoiceDate: '2026-09-01',
      customerName: 'Acme',
      lineItems: [{ quantity: 1, rate: 10, amount: 10, product: 'Oil' }],
      subtotal: 10,
      taxAmount: 0,
      discount: 0,
      grandTotal: 10,
      notes: 'Net 30',
      deposit_account_name: 'Chase Bank',
    });
    expect(pdfText.lines.join('\n')).toContain('Deposit to: Chase Bank');

    pdfText.lines.length = 0;
    generateFormPdf({
      invoiceNumber: 'INV-1',
      invoiceDate: '2026-09-01',
      customerName: 'Acme',
      lineItems: [{ quantity: 1, rate: 10, amount: 10, product: 'Oil' }],
      subtotal: 10,
      taxAmount: 0,
      discount: 0,
      grandTotal: 10,
      notes: 'Net 30',
      deposit_account_name: null,
    });
    expect(pdfText.lines.join('\n')).not.toContain('Deposit to:');

    pdfText.lines.length = 0;
    await generateDocumentPdf(invoice('Chase Bank'), company);
    expect(pdfText.lines.join('\n')).toContain('Deposit to: Chase Bank');

    pdfText.lines.length = 0;
    await generateDocumentPdf(invoice(null), company);
    expect(pdfText.lines.join('\n')).not.toContain('Deposit to:');

    const withName = await generateInvoiceWord(invoice('Chase Bank'), company);
    const namedXml = await JSZip.loadAsync(await withName.arrayBuffer()).then((zip) => zip.file('word/document.xml')?.async('string'));
    expect(namedXml).toContain('Deposit to: Chase Bank');

    const without = await generateInvoiceWord(invoice(null), company);
    const emptyXml = await JSZip.loadAsync(await without.arrayBuffer()).then((zip) => zip.file('word/document.xml')?.async('string'));
    expect(emptyXml ?? '').not.toContain('Deposit to:');
  });
});
