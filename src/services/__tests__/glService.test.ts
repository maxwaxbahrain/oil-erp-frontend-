import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_TOKEN_KEY } from '../../api/axios';
import {
  apiRequest,
  apiRequestPathForDisplay,
  getGLTrialBalance,
  monthStartISO,
} from '../glService';
import { API_BASE_URL } from '../api';

function mockFetchResponse(opts: {
  ok: boolean;
  status: number;
  body: string;
  contentType?: string | null;
}) {
  const headers = {
    get: (name: string) => {
      if (name.toLowerCase() !== 'content-type') return null;
      if (opts.contentType === null) return null;
      return opts.contentType === undefined ? 'application/json' : opts.contentType;
    },
  };
  return {
    ok: opts.ok,
    status: opts.status,
    headers,
    text: () => Promise.resolve(opts.body),
    json: () => Promise.reject(new Error('apiRequest must use text(), not json()')),
  };
}

describe('monthStartISO (DASH-5)', () => {
  it('returns the first day of the current month in YYYY-MM-DD format', () => {
    const result = monthStartISO();
    expect(result).toMatch(/^\d{4}-\d{2}-01$/);

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    expect(result).toBe(expected);

    const [, month, day] = result.split('-');
    expect(day).toBe('01');
    expect(Number(month)).toBeGreaterThanOrEqual(1);
    expect(Number(month)).toBeLessThanOrEqual(12);
  });
});

describe('apiRequestPathForDisplay', () => {
  it('shows /api path without query string or host', () => {
    const path = apiRequestPathForDisplay('/gl/trial-balance?as_of=2026-10-21&token=secret');
    expect(path).toBe('/api/gl/trial-balance');
    expect(path).not.toContain('token');
    expect(path).not.toContain('as_of');
    expect(path).not.toContain('http');
    expect(API_BASE_URL).toMatch(/\/api\/?$/);
  });
});

describe('apiRequest HTML vs JSON', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('HTML 200 body → clear web-page message with status and path (no SyntaxError)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          contentType: 'text/html',
          body: '<HTML> <HEAD><TITLE>Error</TITLE></HEAD></HTML>',
        }),
      ),
    );

    let caught: unknown;
    try {
      await getGLTrialBalance('2026-10-21');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      'Server returned a web page instead of data (HTTP 200, /api/gl/trial-balance)',
    );
    expect((caught as Error).message).not.toMatch(/Unexpected token/);
  });

  it('HTML body with application/json content-type still gets the clear message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          contentType: 'application/json',
          body: '<HTML> <H1>Nope</H1>',
        }),
      ),
    );

    await expect(apiRequest('/gl/day-book?start_date=2026-01-01')).rejects.toThrow(
      /Server returned a web page instead of data \(HTTP 200, \/api\/gl\/day-book\)/,
    );
  });

  it('500 JSON detail → detail shown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Ledger unavailable' }),
        }),
      ),
    );

    await expect(getGLTrialBalance()).rejects.toThrow('Ledger unavailable');
  });

  it('valid JSON → unchanged payload', async () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'tb-token');
    const payload = {
      as_of: '2026-10-21',
      accounts: [],
      total_debit: 0,
      total_credit: 0,
      is_balanced: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        ok: true,
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getGLTrialBalance('2026-10-21')).resolves.toEqual(payload);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer tb-token',
    });
  });
});
