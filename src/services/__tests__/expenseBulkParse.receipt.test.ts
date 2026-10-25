import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../api/axios', () => ({
  authFetch: vi.fn(),
}));

import { authFetch } from '../../api/axios';
import ExpensesBulkUpload from '../../pages/Accounts/ExpensesBulkUpload';
import {
  buildBulkExpenseSavePayload,
  formatCollapsedReceiptNotice,
  parseBulkExpenses,
} from '../expenseService';

const RECEIPT_DATE = '2026-10-20';

const oneReceipt = [{
  document_type: 'receipt',
  vendor_name: 'Pilot',
  date: RECEIPT_DATE,
  amount: 153.61,
  tax_amount: 1.11,
  currency: 'USD',
  description: 'Diesel 31.26 gal, DEF, coffee',
  line_items: [
    { name: 'Diesel 31.26 gal', amount: 131.26 },
    { name: 'DEF', amount: 18.99 },
    { name: 'coffee', amount: 2.25 },
  ],
  confidence: 94,
}];

const splitReceipt = [
  { document_type: 'receipt', vendor_name: 'Pilot', date: RECEIPT_DATE, amount: 131.26, currency: 'USD', description: 'Diesel 31.26 gal', confidence: 90 },
  { document_type: 'receipt', vendor_name: 'Pilot', date: RECEIPT_DATE, amount: 18.99, currency: 'USD', description: 'DEF', confidence: 90 },
  { document_type: 'receipt', vendor_name: 'Pilot', date: RECEIPT_DATE, amount: 2.25, currency: 'USD', description: 'coffee', confidence: 88 },
  { document_type: 'receipt', vendor_name: 'Pilot', date: RECEIPT_DATE, amount: 153.61, currency: 'USD', description: 'Total', confidence: 95 },
];

const splitReceiptWithoutType = splitReceipt.map(({ document_type: _ignored, ...row }) => row);

const expenseList = [10, 20, 30, 40, 100].map((amount, index) => ({
  document_type: 'expense_list',
  vendor_name: 'Amex',
  date: RECEIPT_DATE,
  amount,
  currency: 'USD',
  description: ['Coffee', 'Parking', 'Software', 'Fuel', 'Hotel'][index],
  confidence: 80,
}));

const legacyVendors = [
  { vendor_name: 'Alpha Fuel', date: RECEIPT_DATE, amount: 10, currency: 'USD', description: 'Diesel', confidence: 80 },
  { vendor_name: 'Beta Parking', date: RECEIPT_DATE, amount: 20, currency: 'USD', description: 'Lot', confidence: 80 },
  { vendor_name: 'Gamma Hotel', date: RECEIPT_DATE, amount: 30, currency: 'USD', description: 'Room', confidence: 80 },
];

function chatReply(reply: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ reply: typeof reply === 'string' ? reply : JSON.stringify(reply) }),
  };
}

function installChat(bulk: unknown) {
  vi.mocked(authFetch).mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/expenses')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 99,
          category: 'Other',
          amount: 153.61,
          currency: 'USD',
          date: RECEIPT_DATE,
          vendor: 'Pilot',
          description: 'saved',
          payment_method: 'Card',
          status: 'Draft',
          tax_amount: 1.11,
        }),
      };
    }
    let content: unknown;
    try {
      content = JSON.parse(String(init?.body || '{}'))?.messages?.[0]?.content;
    } catch {
      content = undefined;
    }
    if (content === 'Categorize this expense.') {
      return chatReply({ category: 'Other', confidence: 70, reason: 'test' });
    }
    return chatReply(bulk);
  });
}

async function parseText(bulk: unknown) {
  installChat(bulk);
  return parseBulkExpenses({ kind: 'text', text: 'pasted expense document' });
}

function buttonByText(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(node =>
    (node.textContent || '').includes(label),
  );
  if (!button) throw new Error(`Missing button ${label}`);
  return button as HTMLButtonElement;
}

function setNativeValue(el: HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(el) as { constructor: { prototype: object } };
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
    ?? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('bulk expense receipt parsing', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    container = null;
    root = null;
    vi.clearAllMocks();
  });

  it('maps a single receipt entry to the total, tax, and line-item summary', async () => {
    const rows = await parseText(oneReceipt);

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(153.61);
    expect(rows[0].taxAmount).toBe(1.11);
    expect(rows[0].documentType).toBe('receipt');
    expect(rows[0].collapsedReceipt).toBeUndefined();
    expect(rows[0].description).toBe('Diesel 31.26 gal, DEF, coffee');
    expect(rows[0].lineItems).toEqual([
      { name: 'Diesel 31.26 gal', amount: 131.26 },
      { name: 'DEF', amount: 18.99 },
      { name: 'coffee', amount: 2.25 },
    ]);

    const body = JSON.parse(String(vi.mocked(authFetch).mock.calls[0][1]?.body));
    expect(body.system).toContain('document_type');
    expect(body.system).toContain('"receipt"');
    expect(body.system).toContain('"expense_list"');
    expect(body.system).toContain('no markdown');
    expect(body.system).toContain('TOTAL');
  });

  it('collapses a receipt the model split into line entries plus a total', async () => {
    const rows = await parseText(splitReceipt);

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(153.61);
    expect(rows[0].taxAmount).toBe(1.11);
    expect(rows[0].documentType).toBe('receipt');
    expect(rows[0].collapsedReceipt).toBe(true);
    expect(rows[0].collapsedLineCount).toBe(4);
    expect(rows[0].description).toContain('Diesel 31.26 gal');
    expect(rows[0].description).toContain('DEF');
    expect(rows[0].description).toContain('coffee');
    expect(rows[0].lineItems?.map(item => item.amount)).toEqual([131.26, 18.99, 2.25]);
    expect(formatCollapsedReceiptNotice(rows[0].collapsedLineCount ?? 0)).toBe(
      'Combined 4 receipt lines into one expense',
    );

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    installChat(splitReceipt);
    await act(async () => {
      root?.render(
        createElement(MemoryRouter, null, createElement(ExpensesBulkUpload)),
      );
    });
    await act(async () => {
      buttonByText(container!, 'Paste Text').click();
    });
    await flush();
    const textarea = container.querySelector('textarea');
    expect(textarea).toBeTruthy();
    await act(async () => {
      setNativeValue(textarea as HTMLTextAreaElement, 'pilot receipt');
    });
    await act(async () => {
      buttonByText(container!, 'Parse with AI').click();
    });
    await flush();

    expect(container.textContent).toContain('Combined 4 receipt lines into one expense');
    expect(container.textContent).toContain('Receipt');
  });

  it('collapses a typeless reply when every line shares vendor and date and one amount is the total', async () => {
    const rows = await parseText(splitReceiptWithoutType);

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(153.61);
    expect(rows[0].taxAmount).toBe(1.11);
    expect(rows[0].collapsedReceipt).toBe(true);
    expect(rows[0].documentType).toBe('receipt');
    expect(rows[0].collapsedLineCount).toBe(4);
  });

  it('keeps an expense_list as one row per entry', async () => {
    const rows = await parseText(expenseList);

    expect(rows).toHaveLength(5);
    expect(rows.map(row => row.amount)).toEqual([10, 20, 30, 40, 100]);
    expect(rows.every(row => row.documentType === 'expense_list')).toBe(true);
    expect(rows.every(row => row.collapsedReceipt === undefined)).toBe(true);
  });

  it('does not collapse a legacy reply whose vendors differ', async () => {
    const rows = await parseText(legacyVendors);

    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.vendor)).toEqual(['Alpha Fuel', 'Beta Parking', 'Gamma Hotel']);
    expect(rows.every(row => row.documentType === undefined)).toBe(true);
    expect(rows.every(row => row.collapsedReceipt === undefined)).toBe(true);
  });

  it('sends taxAmount and the receipt total on the import payload', async () => {
    const rows = await parseText(oneReceipt);
    const payload = buildBulkExpenseSavePayload(rows[0]);

    expect(payload.amount).toBe(153.61);
    expect(payload.taxAmount).toBe(1.11);
    expect(payload.description).toContain('Diesel 31.26 gal');
    expect(payload.description).toContain('DEF');
    expect(payload.description).toContain('coffee');
    expect(payload.status).toBe('Draft');
    expect(payload.paymentMethod).toBe('Card');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    installChat(oneReceipt);
    await act(async () => {
      root?.render(
        createElement(MemoryRouter, null, createElement(ExpensesBulkUpload)),
      );
    });
    await act(async () => {
      buttonByText(container!, 'Paste Text').click();
    });
    await flush();
    await act(async () => {
      setNativeValue(container!.querySelector('textarea') as HTMLTextAreaElement, 'pilot receipt');
    });
    await act(async () => {
      buttonByText(container!, 'Parse with AI').click();
    });
    await flush();
    await act(async () => {
      buttonByText(container!, 'Import All').click();
    });
    await flush();

    const post = vi.mocked(authFetch).mock.calls.find(([url, init]) =>
      String(url).includes('/expenses') && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(post).toBeTruthy();
    const body = JSON.parse(String(post?.[1]?.body));
    expect(body.amount).toBe(153.61);
    expect(body.tax_amount).toBe(1.11);
    expect(body.status).toBe('Draft');
    expect(body.payment_method).toBe('Card');
  });
});
