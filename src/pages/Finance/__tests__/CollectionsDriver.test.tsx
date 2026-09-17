import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CollectionsDriver from '../CollectionsDriver';
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
      customer_email: null,
      outstanding: 500,
      days_unpaid: 60,
      last_order: '2026-08-01',
      group: 1,
      action: 'COD',
      statement_message: 'msg',
      driver_line: 'Alpha, COD today',
      phone_missing: false,
    },
    {
      invoice_id: 2,
      invoice_number: 'INV-1002',
      customer_id: 11,
      customer_name: 'Beta Garage',
      customer_phone: '555-0200',
      customer_email: null,
      outstanding: 300,
      days_unpaid: 90,
      last_order: '2026-06-01',
      group: 2,
      action: 'Call',
      statement_message: 'msg2',
      driver_line: null,
      phone_missing: false,
    },
  ],
};

describe('CollectionsDriver page', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(api, 'getCollectionsReport').mockResolvedValue(mockReport);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders only group 1 rows', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <CollectionsDriver />
        </MemoryRouter>,
      );
    });
    await act(async () => {});

    const text = container.textContent ?? '';
    expect(text).toContain('Alpha Shop');
    expect(text).toContain('Alpha, COD today');
    expect(text).not.toContain('Beta Garage');
  });
});
