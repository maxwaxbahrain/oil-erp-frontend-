import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_BASE_URL,
  createCollectionsLog,
  getCollectionsCsvUrl,
  getCollectionsReport,
  getCollectionsSettings,
  listCollectionsLog,
  updateCollectionsSettings,
} from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('collections API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('getCollectionsReport requests the bare path when asOf is omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, { rows: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getCollectionsReport();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/collections`);
  });

  it('getCollectionsReport encodes as_of query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, { rows: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getCollectionsReport('2026-09-17T12:00:00');

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE_URL}/credit/collections?as_of=2026-09-17T12%3A00%3A00`,
    );
  });

  it('getCollectionsCsvUrl returns the authenticated CSV endpoint', () => {
    expect(getCollectionsCsvUrl()).toBe(`${API_BASE_URL}/credit/collections.csv`);
    expect(getCollectionsCsvUrl('2026-01-01')).toBe(
      `${API_BASE_URL}/credit/collections.csv?as_of=2026-01-01`,
    );
  });

  it('getCollectionsSettings GETs the settings path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, { late_days: 45 }));
    vi.stubGlobal('fetch', fetchMock);

    await getCollectionsSettings();

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/collections/settings`);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it('updateCollectionsSettings PUTs the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, { late_days: 60 }));
    vi.stubGlobal('fetch', fetchMock);

    await updateCollectionsSettings({ late_days: 60, sender_name: 'Alex' });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/collections/settings`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      late_days: 60,
      sender_name: 'Alex',
    });
  });

  it('createCollectionsLog POSTs the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 201, { id: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await createCollectionsLog({
      invoice_id: 42,
      note: 'Called — no answer',
      promised_method: 'Zelle',
      status: 'Open',
    });

    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/credit/collections/log`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      invoice_id: 42,
      note: 'Called — no answer',
      promised_method: 'Zelle',
      status: 'Open',
    });
  });

  it('listCollectionsLog requests invoice_id query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listCollectionsLog(99);

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE_URL}/credit/collections/log?invoice_id=99`,
    );
  });
});
