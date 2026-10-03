import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import { API_BASE_URL, getInvoices, voidInvoice } from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('mapApiInvoiceToInvoice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
  });

  it('maps partial credit-note settlement (paid_amount 0, balance 49.5)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, [
        {
          id: 1,
          status: 'partial',
          paid_amount: 0,
          balance: 49.5,
          total: 99.5,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [inv] = await getInvoices();

    expect(inv.status).toBe('Partial');
    expect(inv.payment_status).toBe('Advance Paid');
    expect(inv.remaining_balance).toBe(49.5);
  });

  it('maps fully paid invoice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, [
        {
          id: 2,
          status: 'paid',
          paid_amount: 99.5,
          balance: 0,
          total: 99.5,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [inv] = await getInvoices();

    expect(inv.status).toBe('Paid');
    expect(inv.payment_status).toBe('Paid');
  });

  it('maps unpaid invoice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, [
        {
          id: 3,
          status: 'unpaid',
          paid_amount: 0,
          balance: 99.5,
          total: 99.5,
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const [inv] = await getInvoices();

    expect(inv.status).toBe('Unpaid');
    expect(inv.payment_status).toBe('Unpaid');
  });

  it('maps void and CANCELLED, and voidInvoice posts /invoices/42/void', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        mockResp(true, 200, [{ id: 4, status: 'void', paid_amount: 0, balance: 10, total: 10 }]),
      )
      .mockResolvedValueOnce(
        mockResp(true, 200, [{ id: 5, status: 'CANCELLED', paid_amount: 0, balance: 10, total: 10 }]),
      )
      .mockResolvedValueOnce(
        mockResp(true, 200, {
          id: 42,
          invoice_number: 'INV-42',
          status: 'void',
          reversed_entries: [9],
          customer_balance: null,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const [voided] = await getInvoices();
    expect(voided.status).toBe('Void');

    const [cancelled] = await getInvoices();
    expect(cancelled.status).toBe('Cancelled');

    await voidInvoice('42');
    const [url, init] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/invoices/42/void`);
    expect(init.method).toBe('POST');
  });
});
