import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import {
  API_BASE_URL,
  ApiError,
  getCreditHold,
} from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('credit hold API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getCreditHold requests GET /credit/hold/{id}', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { mode: 'warn', held: true, invoices: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getCreditHold(42);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/hold/42`);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it('throws ApiError with creditHoldDetail on 409 credit_hold', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const detail = {
      code: 'credit_hold',
      held: true,
      mode: 'block',
      message: 'Blocked',
      invoices: [],
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResp(false, 409, { detail }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCreditHold('99')).rejects.toBeInstanceOf(ApiError);

    try {
      await getCreditHold('99');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.creditHoldDetail).toMatchObject({
        code: 'credit_hold',
        mode: 'block',
        held: true,
      });
    }
  });
});
