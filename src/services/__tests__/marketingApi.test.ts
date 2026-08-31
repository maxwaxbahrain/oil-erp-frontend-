import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_BASE_URL,
  deleteMarketingPost,
  generateMarketingPosts,
  listMarketingPosts,
  updateMarketingPost,
} from '../api';

function mockResp(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('marketing API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('generate posts to the correct path with the correct method and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await generateMarketingPosts({
      platforms: ['linkedin', 'x'],
      campaign_type: 'summer promo',
      post_topic: 'Same-day drum delivery when a shop runs out mid-shift',
      brand_voice: 'professional',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/marketing/generate`);
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      platforms: ['linkedin', 'x'],
      campaign_type: 'summer promo',
      post_topic: 'Same-day drum delivery when a shop runs out mid-shift',
      brand_voice: 'professional',
    });
  });

  it('list with no params requests the bare path with no query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listMarketingPosts();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/marketing/posts`);
  });

  it('list with status and limit produces exactly ?status=draft&limit=10', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listMarketingPosts({ status: 'draft', limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE_URL}/marketing/posts?status=draft&limit=10`,
    );
  });

  it('list omits undefined params entirely', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listMarketingPosts({
      status: 'draft',
      platform: undefined,
      generation_id: undefined,
      limit: 10,
      offset: undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE_URL}/marketing/posts?status=draft&limit=10`,
    );
  });

  it('update sends PATCH with only the provided fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResp(true, 200, { id: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    await updateMarketingPost(3, { status: 'approved' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/marketing/posts/3`);
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ status: 'approved' });
  });

  it('delete sends DELETE and resolves without throwing on a 204 empty body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteMarketingPost(9)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE_URL}/marketing/posts/9`);
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('a 422 response rejects rather than resolving with undefined', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResp(false, 422, { detail: 'Invalid platform' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listMarketingPosts({ platform: 'x' })).rejects.toThrow('Invalid platform');
  });
});
