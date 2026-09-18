import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Collections from '../Collections';
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
});
