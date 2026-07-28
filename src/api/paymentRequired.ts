export const BILLING_PATH = '/settings/billing';

const BILLING_MESSAGE_KEY = 'billing_required_message';

const DEFAULT_TRIAL_EXPIRED_MESSAGE =
  'Your free trial has expired. Please upgrade your account to continue.';

export function isOnBillingPage(pathname: string = window.location.pathname): boolean {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return path === BILLING_PATH || path.startsWith('/billing/');
}

/** Persist message and navigate to billing — keeps auth token (unlike 401). */
export function redirectToBilling(message?: string): void {
  if (isOnBillingPage()) return;

  const text = message?.trim() || DEFAULT_TRIAL_EXPIRED_MESSAGE;
  sessionStorage.setItem(BILLING_MESSAGE_KEY, text);
  window.history.replaceState(null, '', BILLING_PATH);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function consumeBillingRequiredMessage(): string | null {
  const msg = sessionStorage.getItem(BILLING_MESSAGE_KEY);
  if (msg) sessionStorage.removeItem(BILLING_MESSAGE_KEY);
  return msg;
}

export function handlePaymentRequiredStatus(
  status: number,
  detail?: unknown,
): boolean {
  if (status !== 402) return false;

  const message =
    typeof detail === 'string' && detail.trim()
      ? detail.trim()
      : DEFAULT_TRIAL_EXPIRED_MESSAGE;
  redirectToBilling(message);
  return true;
}
