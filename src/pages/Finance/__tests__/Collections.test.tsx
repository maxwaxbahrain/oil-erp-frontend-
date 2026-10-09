import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Collections, {
  daysBand,
  formatLastOrder,
  formatPhoneDisplay,
  sortCollectionRows,
} from '../Collections';
import * as api from '../../../services/api';

const mockReport: api.CollectionsReport = {
  as_of: '2026-09-17T20:00:00',
  settings_used: {
    sender_name: 'Soltol',
    zelle: '',
    card_phone: '',
    cheque_payee: 'Soltol',
    group1_days: 30,
    group2_days: 105,
    min_balance: 100,
    late_days: 45,
    credit_hold_mode: 'off',
    credit_hold_days: 45,
  },
  groups: {
    1: { customers: 1, invoices: 1, total: 500 },
    2: { customers: 1, invoices: 1, total: 300 },
    3: { customers: 0, invoices: 0, total: 0 },
  },
  total: 800,
  rows: [
    {
      invoice_id: 1,
      invoice_number: 'INV-1001',
      customer_id: 10,
      customer_name: 'Alpha Shop',
      customer_phone: '555-0100',
      customer_email: 'a@example.com',
      outstanding: 500,
      days_unpaid: 60,
      last_order: '2026-08-01',
      group: 1,
      action: 'Cash on delivery from next order + send statement',
      statement_message: 'Hi Alpha, please pay $500.',
      driver_line: 'Alpha, your account has $500 open',
      phone_missing: false,
    },
    {
      invoice_id: 2,
      invoice_number: 'INV-1002',
      customer_id: 11,
      customer_name: 'Beta Garage',
      customer_phone: null,
      customer_email: null,
      outstanding: 300,
      days_unpaid: 90,
      last_order: '2026-06-01',
      group: 2,
      action: 'Send statement today, call in 3 days',
      statement_message: 'Hi Beta, please pay $300.',
      driver_line: null,
      phone_missing: true,
    },
  ],
};

describe('Collections page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    vi.spyOn(api, 'getCollectionsReport').mockResolvedValue(mockReport);
    vi.spyOn(api, 'getCollectionsSettings').mockResolvedValue(mockReport.settings_used);
    vi.spyOn(api, 'downloadCollectionsCsv').mockResolvedValue(undefined);
    vi.spyOn(api, 'createCollectionsLog').mockResolvedValue({
      id: 1,
      tenant_id: 1,
      invoice_id: 1,
      customer_id: 10,
      user_id: 1,
      note: 'test',
      promised_date: null,
      promised_method: null,
      status: 'Open',
      created_at: '2026-09-17T20:00:00',
    });
    vi.spyOn(api, 'listCollectionsLog').mockResolvedValue([]);

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Collections />
        </MemoryRouter>,
      );
    });
    await act(async () => {});
  }

  function text(): string {
    return container.textContent ?? '';
  }

  it('renders three group summary cards from the report', async () => {
    await renderPage();

    expect(text()).toContain('Still ordering');
    expect(text()).toContain('Recently quiet');
    expect(text()).toContain('one round, then decide');
    expect(text()).toContain('Alpha Shop');
    expect(text()).toContain('Beta Garage');
  });

  it('filters the table when a group card is clicked', async () => {
    await renderPage();

    const group1Btn = container.querySelector('[aria-label="Filter group 1"]') as HTMLButtonElement;
    expect(group1Btn).toBeTruthy();

    await act(async () => {
      group1Btn.click();
    });

    expect(text()).toContain('Alpha Shop');
    expect(text()).not.toContain('Beta Garage');

    await act(async () => {
      group1Btn.click();
    });

    expect(text()).toContain('Beta Garage');
  });

  it('copy message writes statement_message to the clipboard', async () => {
    await renderPage();

    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy message'),
    );
    expect(copyBtn).toBeTruthy();

    await act(async () => {
      copyBtn!.click();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hi Alpha, please pay $500.');
    expect(text()).toContain('Copied');
  });

  it('shows No phone badge when phone_missing is true', async () => {
    await renderPage();

    expect(text()).toContain('No phone');
  });

  it('sorts invoice rows from the column header without changing the loaded rows', async () => {
    await renderPage();

    const daysHeader = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Days unpaid',
    );
    expect(daysHeader).toBeTruthy();

    const names = () =>
      Array.from(container.querySelectorAll('table [data-customer]')).map((row) =>
        row.getAttribute('data-customer'),
      );

    await act(async () => {
      daysHeader!.click();
    });
    expect(names()).toEqual(['Alpha Shop', 'Beta Garage']);

    await act(async () => {
      daysHeader!.click();
    });
    expect(names()).toEqual(['Beta Garage', 'Alpha Shop']);
    expect(mockReport.rows.map((row) => row.customer_name)).toEqual(['Alpha Shop', 'Beta Garage']);
  });

  it('colours days chips by the unpaid band', async () => {
    await renderPage();

    const bands = Array.from(container.querySelectorAll('table [data-days-band]')).map((chip) =>
      chip.getAttribute('data-days-band'),
    );
    expect(bands).toEqual(['amber', 'orange']);
  });

  it('shows a stored non-US phone exactly as stored', async () => {
    await renderPage();

    const link = container.querySelector('a[href="tel:555-0100"]');
    expect(link?.textContent).toBe('555-0100');
  });

  it('shows a US phone as a national number with a +1 link', async () => {
    vi.mocked(api.getCollectionsReport).mockResolvedValue({
      ...mockReport,
      rows: [{ ...mockReport.rows[0], customer_phone: '+1 (718) 392-1101' }, mockReport.rows[1]],
    });
    await renderPage();

    const link = container.querySelector('a[href="tel:+17183921101"]');
    expect(link?.textContent).toBe('(718) 392-1101');
  });

  it('formats last order on one line', async () => {
    await renderPage();

    const lastOrder = container.querySelector('table tbody tr')?.querySelectorAll('td')[5];
    expect(lastOrder?.textContent?.trim()).toBe('Aug 1');
  });
});

describe('collections display helpers', () => {
  it('formats 10-digit and leading-1 numbers and leaves every other value stored', () => {
    expect(formatPhoneDisplay('7183921101')).toEqual({
      text: '(718) 392-1101',
      href: 'tel:+17183921101',
    });
    expect(formatPhoneDisplay('17183921101')).toEqual({
      text: '(718) 392-1101',
      href: 'tel:+17183921101',
    });
    const stored = '+1 (718) 392-1101';
    expect(formatPhoneDisplay(stored)).toEqual({
      text: '(718) 392-1101',
      href: 'tel:+17183921101',
    });
    expect(stored).toBe('+1 (718) 392-1101');
    expect(formatPhoneDisplay('555-0100')).toEqual({ text: '555-0100', href: 'tel:555-0100' });
    expect(formatPhoneDisplay('+973-1234-5678')).toEqual({
      text: '+973-1234-5678',
      href: 'tel:+973-1234-5678',
    });
    expect(formatPhoneDisplay('')).toEqual({ text: '', href: null });
    expect(formatPhoneDisplay(null)).toEqual({ text: '', href: null });
  });

  it('bands days unpaid at 30, 60, and 90', () => {
    expect(daysBand(0)).toBe('neutral');
    expect(daysBand(30)).toBe('neutral');
    expect(daysBand(31)).toBe('amber');
    expect(daysBand(60)).toBe('amber');
    expect(daysBand(61)).toBe('orange');
    expect(daysBand(90)).toBe('orange');
    expect(daysBand(91)).toBe('red');
  });

  it('formats a last-order date with the year only when it is not the current year', () => {
    expect(formatLastOrder('2026-08-01', 2026)).toBe('Aug 1');
    expect(formatLastOrder('2025-08-30', 2026)).toBe('Aug 30, 2025');
    expect(formatLastOrder(null, 2026)).toBe('');
  });

  it('sorts a copy of the rows and breaks ties by invoice id', () => {
    const older = { ...mockReport.rows[0], invoice_id: 9, customer_name: 'Same Shop', days_unpaid: 12 };
    const newer = { ...mockReport.rows[0], invoice_id: 4, customer_name: 'Same Shop', days_unpaid: 12 };
    const input = [older, newer];
    const sorted = sortCollectionRows(input, 'customer', 'asc');
    expect(sorted.map((row) => row.invoice_id)).toEqual([4, 9]);
    expect(input.map((row) => row.invoice_id)).toEqual([9, 4]);
    expect(sortCollectionRows(mockReport.rows, 'days', 'desc').map((row) => row.invoice_id)).toEqual([2, 1]);
    expect(sortCollectionRows(mockReport.rows, 'outstanding', 'asc').map((row) => row.invoice_id)).toEqual([2, 1]);
  });
});
