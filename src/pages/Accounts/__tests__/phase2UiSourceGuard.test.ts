import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('phase 2 source guard', () => {
  it('does not use window.confirm or window.prompt in the changed files', () => {
    const files = [
      'src/services/glService.ts',
      'src/services/api.ts',
      'src/services/invoiceDocumentService.ts',
      'src/hooks/useBankingAccountOptions.ts',
      'src/utils/invoicePDF.ts',
      'src/pages/Accounts/Banking.tsx',
      'src/pages/Sales/InvoiceFormPage.tsx',
      'src/pages/Sales/Invoices.tsx',
      'src/pages/Customers/PaymentReceipt.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/window\.confirm|window\.prompt|\bprompt\s*\(/);
    }
  });
});
