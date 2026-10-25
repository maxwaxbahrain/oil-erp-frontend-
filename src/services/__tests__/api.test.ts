import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import { getInvoices, getProducts, getProductsStrict } from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('apiRequest auth headers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('sends the stored login token as a Bearer token for invoice requests', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-login-token');
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await getInvoices();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/invoices\/$/);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer test-login-token',
    });
  });
});

describe('getProducts vs getProductsStrict', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('getProducts returns [] on HTTP 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResp(false, 500, { detail: 'boom' })));
    await expect(getProducts()).resolves.toEqual([]);
  });

  it('getProductsStrict rejects on HTTP 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResp(false, 500, { detail: 'boom' })));
    await expect(getProductsStrict()).rejects.toThrow(/HTTP 500/);
  });
});
