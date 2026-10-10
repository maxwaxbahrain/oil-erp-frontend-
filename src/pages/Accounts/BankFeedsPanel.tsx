import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePlaidLink, type PlaidLinkError } from 'react-plaid-link';
import { formatUsd } from '../../utils/money';
import {
  PLAID_LINK_MODE_KEY,
  PLAID_LINK_TOKEN_KEY,
  createLinkToken,
  disconnectItem,
  exchangePublicToken,
  isFeatureDisabled,
  listBankFeeds,
  readFeedErrorCode,
  reconnectItem,
  refreshLink,
  setLinkAccount,
  type BankFeedItem,
  type BankFeedLink,
  type PlaidLinkMode,
} from '../../services/bankFeedsService';

export type BankFeedAccountOption = {
  id: number;
  code: string;
  name: string;
  system_key?: string | null;
  role?: string | null;
  account_role?: string | null;
};

type Props = {
  accounts: BankFeedAccountOption[];
  canManage: boolean;
  canView: boolean;
  onBookChanged?: () => void;
};

const panelStyle: CSSProperties = {
  background: 'var(--color-redwood-bg-surface)',
  border: '1px solid var(--color-redwood-border)',
  borderRadius: '14px',
  padding: '14px 16px',
};

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 11px',
  borderRadius: 6,
  fontSize: 10.5,
  fontWeight: 500,
  cursor: 'pointer',
  border: '1px solid var(--color-redwood-border)',
  background: 'rgba(255,255,255,.04)',
  color: 'var(--color-redwood-text-muted)',
  fontFamily: "'DM Sans',sans-serif",
};

const primaryBtn: CSSProperties = {
  ...ghostBtn,
  border: 'none',
  background: '#4F8EF7',
  color: '#fff',
};

const thStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 9,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.4px',
  color: 'var(--color-redwood-text-muted)',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: '11px 12px',
  fontSize: 12,
  color: 'var(--color-redwood-text-main)',
  verticalAlign: 'middle',
};

const LIVE_LIMIT_MESSAGE = 'Daily live-refresh limit reached (3/day). Cached refresh is still available.';

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Could not reach bank feeds.';
}

function isBankOption(account: BankFeedAccountOption): boolean {
  return account.system_key === 'bank' || account.account_role === 'bank' || account.role === 'bank';
}

function consentWithin30Days(iso: string | null): boolean {
  if (!iso) return false;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return false;
  const ms = when.getTime() - Date.now();
  return ms >= 0 && ms <= 30 * 24 * 60 * 60 * 1000;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  return when.toLocaleString();
}

function formatDay(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  return when.toLocaleDateString();
}

function badgeFor(status: string, consentSoon: boolean): { label: string; color: string; background: string } {
  if (status === 'disconnected') {
    return { label: 'disconnected', color: 'var(--color-redwood-text-muted)', background: 'var(--color-redwood-row-bg)' };
  }
  if (status === 'login_required' || status === 'error' || consentSoon) {
    const label = consentSoon && status === 'active' ? 'consent expiring' : status;
    return { label, color: 'var(--color-brand-amber-tint)', background: 'var(--color-badge-amber-bg)' };
  }
  return { label: status || 'active', color: 'var(--color-brand-green-tint)', background: 'var(--color-badge-green-bg)' };
}

function rowMessage(err: unknown): string {
  const code = readFeedErrorCode(err);
  if (code === 'LIVE_LIMIT') return LIVE_LIMIT_MESSAGE;
  if (code === 'DUPLICATE_LINK') return 'This SOLTOL account is already linked to a bank feed.';
  if (code === 'NOT_BANK') return 'Account is not a bank account.';
  return errorText(err);
}

export default function BankFeedsPanel({ accounts, canManage, canView, onBookChanged }: Props) {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(canView);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<BankFeedItem[]>([]);
  const [opening, setOpening] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exitError, setExitError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [draftAccount, setDraftAccount] = useState<Record<number, string>>({});
  const [pendingDisconnect, setPendingDisconnect] = useState<BankFeedItem | null>(null);
  const openedToken = useRef<string | null>(null);

  const onBookChangedRef = useRef(onBookChanged);
  onBookChangedRef.current = onBookChanged;

  const reload = useCallback(async () => {
    const data = await listBankFeeds();
    setItems(data.items ?? []);
    setDraftAccount({});
    onBookChangedRef.current?.();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listBankFeeds();
      setItems(data.items ?? []);
      setHidden(false);
    } catch (err) {
      if (isFeatureDisabled(err)) {
        setHidden(true);
        return;
      }
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void load();
  }, [canView, load]);

  const finishLink = useCallback(async (publicToken: string | null) => {
    const mode = localStorage.getItem(PLAID_LINK_MODE_KEY);
    try {
      if (mode === 'connect') {
        if (!publicToken) throw new Error('Plaid did not return a public token.');
        await exchangePublicToken(publicToken);
      }
      localStorage.removeItem(PLAID_LINK_TOKEN_KEY);
      localStorage.removeItem(PLAID_LINK_MODE_KEY);
      setLinkToken(null);
      openedToken.current = null;
      await reload();
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setOpening(false);
    }
  }, [reload]);

  const onExit = useCallback((err: PlaidLinkError | null) => {
    if (err) setExitError(err.display_message || err.error_message || 'Bank connection was cancelled.');
    localStorage.removeItem(PLAID_LINK_TOKEN_KEY);
    localStorage.removeItem(PLAID_LINK_MODE_KEY);
    setLinkToken(null);
    openedToken.current = null;
    setOpening(false);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => { void finishLink(publicToken); },
    onExit,
  });

  useEffect(() => {
    if (linkToken && ready && openedToken.current !== linkToken) {
      openedToken.current = linkToken;
      open();
    }
  }, [linkToken, ready, open]);

  const startLink = async (mode: PlaidLinkMode, token: string) => {
    localStorage.setItem(PLAID_LINK_TOKEN_KEY, token);
    localStorage.setItem(PLAID_LINK_MODE_KEY, mode);
    openedToken.current = null;
    setExitError(null);
    setLinkToken(token);
  };

  const connect = async () => {
    setOpening(true);
    setLoadError(null);
    try {
      const { link_token: token } = await createLinkToken();
      await startLink('connect', token);
    } catch (err) {
      setOpening(false);
      setLoadError(errorText(err));
    }
  };

  const reconnect = async (item: BankFeedItem) => {
    setOpening(true);
    setLoadError(null);
    try {
      const { link_token: token } = await reconnectItem(item.id);
      await startLink('reconnect', token);
    } catch (err) {
      setOpening(false);
      setLoadError(errorText(err));
    }
  };

  const confirmDisconnect = async () => {
    if (!pendingDisconnect) return;
    const item = pendingDisconnect;
    setPendingDisconnect(null);
    try {
      await disconnectItem(item.id);
      await reload();
    } catch (err) {
      setLoadError(errorText(err));
    }
  };

  const onAccountChange = async (link: BankFeedLink, value: string) => {
    const previous = link.soltol_account_id == null ? '' : String(link.soltol_account_id);
    setDraftAccount((current) => ({ ...current, [link.id]: value }));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[link.id];
      return next;
    });
    try {
      await setLinkAccount(link.id, value === '' ? null : Number(value));
      setDraftAccount((current) => {
        const next = { ...current };
        delete next[link.id];
        return next;
      });
      await reload();
    } catch (err) {
      setDraftAccount((current) => ({ ...current, [link.id]: previous }));
      setRowErrors((current) => ({ ...current, [link.id]: rowMessage(err) }));
    }
  };

  const onRefresh = async (link: BankFeedLink, live: boolean) => {
    setRowErrors((current) => {
      const next = { ...current };
      delete next[link.id];
      return next;
    });
    try {
      await refreshLink(link.id, live);
      await reload();
    } catch (err) {
      setRowErrors((current) => ({ ...current, [link.id]: rowMessage(err) }));
    }
  };

  if (!canView || hidden) return null;

  const bankOptions = accounts.filter(isBankOption);
  const openingLabel = opening || (linkToken != null && !ready);

  return (
    <section style={panelStyle} aria-label="Connected banks (Plaid)">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-redwood-text-main)' }}>Connected banks (Plaid)</div>
        {canManage && (
          <button type="button" onClick={() => void connect()} disabled={openingLabel} style={primaryBtn}>
            {openingLabel ? 'Opening…' : 'Connect bank'}
          </button>
        )}
      </div>

      {loadError && (
        <div style={{ fontSize: 12, color: 'var(--color-brand-red-tint)', marginBottom: 8 }}>
          {loadError}{' '}
          <button type="button" onClick={() => void load()} style={ghostBtn}>Retry</button>
        </div>
      )}
      {exitError && (
        <div style={{ fontSize: 12, color: 'var(--color-brand-red-tint)', marginBottom: 8 }}>{exitError}</div>
      )}
      {loading && <div style={{ fontSize: 12, color: 'var(--color-redwood-text-muted)' }}>Loading connected banks…</div>}

      {pendingDisconnect && (
        <div role="dialog" aria-label="Disconnect bank" style={{ ...panelStyle, borderColor: 'rgba(79,142,247,.45)', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-redwood-text-main)', marginBottom: 6 }}>Disconnect bank</div>
          <div style={{ fontSize: 12, color: 'var(--color-redwood-text-main)' }}>
            <div>{pendingDisconnect.institution_name || 'This bank'}</div>
            <div>Disconnect removes the Plaid connection. Previously synced balances stay in your books.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => void confirmDisconnect()} style={primaryBtn}>Confirm</button>
            <button type="button" onClick={() => setPendingDisconnect(null)} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {items.map((item) => {
        const consentSoon = consentWithin30Days(item.consent_expires_at);
        const badge = badgeFor(item.status, consentSoon);
        return (
          <div key={item.id} style={{ ...panelStyle, marginTop: 10 }} data-testid="bank-feed-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.institution_name || 'Bank'}</div>
                {item.error_code && <div style={{ fontSize: 11, color: 'var(--color-brand-amber-tint)' }}>{item.error_code}</div>}
                {consentSoon && item.consent_expires_at && (
                  <div style={{ fontSize: 11, color: 'var(--color-redwood-text-muted)' }}>Reconnect by {formatDay(item.consent_expires_at)}</div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: badge.color, background: badge.background, borderRadius: 999, padding: '2px 8px' }}>{badge.label}</span>
                {canManage && (
                  <>
                    <button type="button" onClick={() => void reconnect(item)} style={ghostBtn}>Reconnect</button>
                    <button type="button" onClick={() => setPendingDisconnect(item)} style={ghostBtn}>Disconnect</button>
                  </>
                )}
              </div>
            </div>
            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-redwood-row-bg)', borderBottom: '1px solid var(--color-redwood-border)' }}>
                    {['Account', 'Bank balance', 'As of', 'SOLTOL account', 'Book balance', 'Difference', 'Refresh'].map((heading) => (
                      <th key={heading} style={thStyle}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {item.links.map((link) => {
                    const selected = draftAccount[link.id] ?? (link.soltol_account_id == null ? '' : String(link.soltol_account_id));
                    const unlinked = (draftAccount[link.id] ?? (link.soltol_account_id == null ? '' : String(link.soltol_account_id))) === '';
                    const difference = link.difference;
                    const matches = difference === 0;
                    const off = difference != null && Math.abs(difference) >= 0.01;
                    const availableDiffers = link.balance_available != null && link.balance_available !== link.balance_current;
                    const linkedAccount = bankOptions.find((account) => String(account.id) === selected);
                    return (
                      <tr key={link.id} style={{ borderBottom: '1px solid var(--color-redwood-border)' }}>
                        <td style={tdStyle}>
                          {link.name || link.official_name || 'Account'}
                          {link.mask ? ` (…${link.mask})` : ''}
                          {link.subtype ? ` ${link.subtype}` : ''}
                        </td>
                        <td style={tdStyle}>
                          {link.balance_current == null ? '—' : formatUsd(link.balance_current)}
                          {availableDiffers && link.balance_available != null && (
                            <div style={{ fontSize: 10, color: 'var(--color-redwood-text-subtle)' }}>Available {formatUsd(link.balance_available)}</div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {formatWhen(link.balance_as_of)}
                          {link.balance_source ? ` · ${link.balance_source}` : ''}
                        </td>
                        <td style={tdStyle}>
                          {canManage ? (
                            <select
                              aria-label={`SOLTOL account for ${link.name || link.mask || link.id}`}
                              value={selected}
                              onChange={(event) => void onAccountChange(link, event.target.value)}
                              style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-redwood-border)', background: 'var(--color-redwood-row-bg)', color: 'var(--color-redwood-text-main)', fontSize: 12 }}
                            >
                              <option value="">— not linked —</option>
                              {bankOptions.map((account) => (
                                <option key={account.id} value={String(account.id)}>{account.code} — {account.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span>{linkedAccount ? `${linkedAccount.code} — ${linkedAccount.name}` : (link.soltol_account_code ? `${link.soltol_account_code} — ${link.soltol_account_name || ''}` : '— not linked —')}</span>
                          )}
                          {rowErrors[link.id] && (
                            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-brand-red-tint)' }}>{rowErrors[link.id]}</div>
                          )}
                        </td>
                        <td style={tdStyle}>{unlinked || link.book_balance == null ? '—' : formatUsd(link.book_balance)}</td>
                        <td style={tdStyle}>
                          {unlinked || difference == null ? '—' : matches ? (
                            <span style={{ color: 'var(--color-brand-green-tint)' }}>Matches</span>
                          ) : (
                            <span style={{ color: off ? '#EF4444' : 'inherit' }}>{formatUsd(difference)}</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button type="button" onClick={() => void onRefresh(link, false)} style={ghostBtn}>Refresh</button>
                            <button type="button" title="Live fetch from the bank — limited to 3 per day per account" onClick={() => void onRefresh(link, true)} style={ghostBtn}>Refresh now</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}
