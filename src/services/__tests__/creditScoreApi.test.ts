import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import * as paymentRequired from '../../api/paymentRequired';
import {
  API_BASE_URL,
  deleteCreditProviderSettings,
  getCreditChecks,
  getCreditProviderSettings,
  getPaymentScore,
  saveCreditProviderSettings,
  getPaymentScoreHistory,
  pullCreditsafeReport,
  recomputePaymentScore,
  searchCreditsafe,
} from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('credit score API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getPaymentScore requests GET /credit/score/{id}', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { band: 'GREEN', score: 88, reasons: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getPaymentScore(12);

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/score/12`);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it('recomputePaymentScore requests POST /credit/score/{id}/recompute', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { band: 'YELLOW', score: 62, reasons: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await recomputePaymentScore('9');

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/score/9/recompute`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('getPaymentScoreHistory requests GET /credit/score/{id}/history', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await getPaymentScoreHistory(3);

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/score/3/history`);
  });

  it('getCreditProviderSettings with skipBillingRedirect does not redirect on 402', async () => {
    const redirectSpy = vi.spyOn(paymentRequired, 'handlePaymentRequiredStatus');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(false, 402, { detail: 'Trial expired for this tenant' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getCreditProviderSettings()).rejects.toThrow('Trial expired for this tenant');
    expect(redirectSpy).not.toHaveBeenCalled();
  });

  it('getCreditProviderSettings requests GET /ai/credit/settings', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { connected: false }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await getCreditProviderSettings();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ai/credit/settings`);
  });

  it('saveCreditProviderSettings requests PUT /ai/credit/settings with credentials body', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { connected: true, environment: 'sandbox' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await saveCreditProviderSettings({
      username: 'api-user',
      password: 'secret-pass',
      environment: 'sandbox',
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ai/credit/settings`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ username: 'api-user', password: 'secret-pass', environment: 'sandbox' }),
    );
  });

  it('deleteCreditProviderSettings requests DELETE /ai/credit/settings', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await deleteCreditProviderSettings();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ai/credit/settings`);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('getCreditChecks filters history rows by customer_id', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, [
        { id: 1, customer_id: 5, company_name: 'A' },
        { id: 2, customer_id: 9, company_name: 'B' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const rows = await getCreditChecks(5);

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ai/credit/history`);
    expect(rows).toHaveLength(1);
    expect(rows[0].customer_id).toBe(5);
  });

  it('searchCreditsafe requests POST /ai/credit/search with company_name', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { matches: [], searches_used: 1 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await searchCreditsafe('Acme LLC', { state: 'NY' });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ai/credit/search`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ company_name: 'Acme LLC', country: 'US', state: 'NY', city: '' }),
    );
  });

  it('pullCreditsafeReport requests POST /ai/credit/report', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'test-token');
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(true, 200, { check_id: 1, company_name: 'Acme LLC' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await pullCreditsafeReport({
      connectId: 'cs-1',
      companyName: 'Acme LLC',
      customerId: 4,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/ai/credit/report`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].body).toBe(
      JSON.stringify({ connect_id: 'cs-1', company_name: 'Acme LLC', customer_id: 4 }),
    );
  });
});
