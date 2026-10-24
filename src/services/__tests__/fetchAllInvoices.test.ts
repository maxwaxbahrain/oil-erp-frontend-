import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import { fetchAllInvoices, INVOICES_FETCH_MAX_PAGES } from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

function rawInvoice(id: number) {
  return {
    id,
    invoice_number: `INV-${id}`,
    status: 'paid',
    date: '2026-01-15',
    customer_id: 1,
    customer_name: 'Acme',
    items: [],
    total: 100,
    paid_amount: 100,
    balance: 0,
  };
}

function pageFromUrl(url: string): { skip: number; limit: number } {
  const u = new URL(url, 'http://localhost');
  return {
    skip: Number(u.searchParams.get('skip') ?? 0),
    limit: Number(u.searchParams.get('limit') ?? 0),
  };
}

describe('fetchAllInvoices', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads 3 pages (200 + 200 + 37) with 437 invoices and truncated false', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token');
    const pageSize = 200;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const { skip } = pageFromUrl(String(url));
      if (skip === 0) {
        return Promise.resolve(mockResp(true, 200, Array.from({ length: 200 }, (_, i) => rawInvoice(i + 1))));
      }
      if (skip === 200) {
        return Promise.resolve(mockResp(true, 200, Array.from({ length: 200 }, (_, i) => rawInvoice(i + 201))));
      }
      if (skip === 400) {
        return Promise.resolve(mockResp(true, 200, Array.from({ length: 37 }, (_, i) => rawInvoice(i + 401))));
      }
      return Promise.resolve(mockResp(true, 200, []));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { invoices, truncated } = await fetchAllInvoices({ pageSize });

    expect(truncated).toBe(false);
    expect(invoices).toHaveLength(437);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(pageFromUrl(String(fetchMock.mock.calls[0][0])).limit).toBe(200);
    expect(pageFromUrl(String(fetchMock.mock.calls[2][0])).skip).toBe(400);
  });

  it('stops at 50 full pages and sets truncated true', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'token');
    const pageSize = 200;
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const { skip } = pageFromUrl(String(url));
      const start = skip + 1;
      return Promise.resolve(
        mockResp(true, 200, Array.from({ length: pageSize }, (_, i) => rawInvoice(start + i))),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { invoices, truncated } = await fetchAllInvoices({ pageSize });

    expect(truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(INVOICES_FETCH_MAX_PAGES);
    expect(invoices).toHaveLength(pageSize * INVOICES_FETCH_MAX_PAGES);
  });
});
