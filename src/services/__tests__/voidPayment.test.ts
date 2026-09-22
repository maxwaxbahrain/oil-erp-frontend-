import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import { voidPayment } from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('voidPayment', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('POSTs to /ledger/payment/{id}/void with reason and does not create a negative payment', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-login-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { id: 12, status: 'voided' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await voidPayment({
      id: '12',
      customer_id: '4',
      amount: 100,
      reason: 'Duplicate entry',
    });

    expect(result).toEqual({ id: 12, status: 'voided' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/ledger\/payment\/12\/void$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ reason: 'Duplicate entry' });
    expect(String(url)).not.toMatch(/\/ledger\/payment$/);
  });

  it('surfaces server detail text on failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(false, 400, { detail: 'Payment is already voided' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      voidPayment({ id: '99', customer_id: '4', amount: 50 }),
    ).rejects.toThrow('Payment is already voided');
  });

  it('throws when payment id is not numeric', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      voidPayment({ id: 'PAY-abc', customer_id: '4', amount: 50 }),
    ).rejects.toThrow(/invalid payment id/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
