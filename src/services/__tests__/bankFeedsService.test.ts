import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock('../glService', () => ({
  apiRequest,
}));

import {
  createLinkToken,
  disconnectItem,
  exchangePublicToken,
  isFeatureDisabled,
  listBankFeeds,
  readFeedErrorCode,
  reconnectItem,
  refreshLink,
  setLinkAccount,
} from '../bankFeedsService';

function feedError(status: number, detail: unknown): Error {
  const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
  return Object.assign(new Error(message), { status, detail });
}

describe('bankFeedsService', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
  });

  it('POST /banking/feeds/link-token', async () => {
    await createLinkToken();
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds/link-token', { method: 'POST' });
  });

  it('POST /banking/feeds/exchange with public_token', async () => {
    await exchangePublicToken('public-sandbox-token');
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds/exchange', {
      method: 'POST',
      body: JSON.stringify({ public_token: 'public-sandbox-token' }),
    });
  });

  it('GET /banking/feeds', async () => {
    await listBankFeeds();
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds', { method: 'GET' });
  });

  it('PUT /banking/feeds/links/:id/account', async () => {
    await setLinkAccount(7, 15);
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds/links/7/account', {
      method: 'PUT',
      body: JSON.stringify({ soltol_account_id: 15 }),
    });
  });

  it('POST /banking/feeds/links/:id/refresh', async () => {
    await refreshLink(4, true);
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds/links/4/refresh', {
      method: 'POST',
      body: JSON.stringify({ live: true }),
    });
  });

  it('POST /banking/feeds/items/:id/reconnect-token', async () => {
    await reconnectItem(3);
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds/items/3/reconnect-token', { method: 'POST' });
  });

  it('DELETE /banking/feeds/items/:id', async () => {
    await disconnectItem(3);
    expect(apiRequest).toHaveBeenCalledWith('/banking/feeds/items/3', { method: 'DELETE' });
  });

  it('isFeatureDisabled is true for any 404', () => {
    expect(isFeatureDisabled(feedError(404, 'Bank feeds are not enabled'))).toBe(true);
    expect(isFeatureDisabled(feedError(404, 'Not Found'))).toBe(true);
    expect(isFeatureDisabled(feedError(409, 'Bank feeds are not enabled'))).toBe(false);
    expect(isFeatureDisabled(feedError(403, 'anything'))).toBe(false);
  });

  it('readFeedErrorCode extracts LIVE_LIMIT', () => {
    expect(readFeedErrorCode(feedError(409, 'LIVE_LIMIT'))).toBe('LIVE_LIMIT');
    expect(readFeedErrorCode(feedError(409, { error_code: 'DUPLICATE_LINK' }))).toBe('DUPLICATE_LINK');
    expect(readFeedErrorCode(feedError(400, 'something else'))).toBeNull();
  });
});
