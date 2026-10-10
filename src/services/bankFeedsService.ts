import { apiRequest } from './glService';

export const PLAID_LINK_TOKEN_KEY = 'soltol_plaid_link_token';
export const PLAID_LINK_MODE_KEY = 'soltol_plaid_link_mode';

export type PlaidLinkMode = 'connect' | 'reconnect';

const FEED_ERROR_CODES = ['LIVE_LIMIT', 'DUPLICATE_LINK', 'NOT_BANK'] as const;
export type FeedErrorCode = (typeof FEED_ERROR_CODES)[number];

export interface BankFeedLink {
  id: number;
  bank_item_id: number;
  provider_account_id: string;
  name: string | null;
  official_name: string | null;
  mask: string | null;
  subtype: string | null;
  status: string;
  soltol_account_id: number | null;
  balance_current: number | null;
  balance_available: number | null;
  balance_currency: string | null;
  balance_as_of: string | null;
  balance_source: string | null;
  soltol_account_code?: string | null;
  soltol_account_name?: string | null;
  book_balance?: number | null;
  difference?: number | null;
}

export interface BankFeedItem {
  id: number;
  provider: string;
  item_id: string;
  institution_id: string | null;
  institution_name: string | null;
  status: string;
  error_code: string | null;
  consent_expires_at: string | null;
  links: BankFeedLink[];
}

function detailOf(err: unknown): unknown {
  if (err && typeof err === 'object' && 'detail' in err) return (err as { detail: unknown }).detail;
  if (err instanceof Error) return err.message;
  return null;
}

/** A 404 on the feeds collection means the backend has no bank-feeds feature here (flag off or router absent). */
export function isFeatureDisabled(err: unknown): boolean {
  const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : NaN;
  return status === 404;
}

export function readFeedErrorCode(err: unknown): string | null {
  const detail = detailOf(err);
  if (typeof detail === 'string') {
    return FEED_ERROR_CODES.find((code) => detail.includes(code)) ?? null;
  }
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    for (const key of ['code', 'error_code', 'errorCode']) {
      const value = record[key];
      if (typeof value === 'string' && (FEED_ERROR_CODES as readonly string[]).includes(value)) return value;
    }
  }
  return null;
}

export function createLinkToken(): Promise<{ link_token: string }> {
  return apiRequest<{ link_token: string }>('/banking/feeds/link-token', { method: 'POST' });
}

export function exchangePublicToken(publicToken: string): Promise<BankFeedItem> {
  return apiRequest<BankFeedItem>('/banking/feeds/exchange', {
    method: 'POST',
    body: JSON.stringify({ public_token: publicToken }),
  });
}

export function listBankFeeds(): Promise<{ items: BankFeedItem[] }> {
  return apiRequest<{ items: BankFeedItem[] }>('/banking/feeds', { method: 'GET' });
}

export function setLinkAccount(linkId: number, soltolAccountId: number | null): Promise<BankFeedLink> {
  return apiRequest<BankFeedLink>(`/banking/feeds/links/${linkId}/account`, {
    method: 'PUT',
    body: JSON.stringify({ soltol_account_id: soltolAccountId }),
  });
}

export function refreshLink(linkId: number, live: boolean): Promise<BankFeedLink> {
  return apiRequest<BankFeedLink>(`/banking/feeds/links/${linkId}/refresh`, {
    method: 'POST',
    body: JSON.stringify({ live }),
  });
}

export function reconnectItem(itemId: number): Promise<{ link_token: string }> {
  return apiRequest<{ link_token: string }>(`/banking/feeds/items/${itemId}/reconnect-token`, {
    method: 'POST',
  });
}

export function disconnectItem(itemId: number): Promise<{ id: number; status: string }> {
  return apiRequest<{ id: number; status: string }>(`/banking/feeds/items/${itemId}`, {
    method: 'DELETE',
  });
}
