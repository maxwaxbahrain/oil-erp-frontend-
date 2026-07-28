import axios from 'axios';
import { handlePaymentRequiredStatus } from './paymentRequired';

export const ACCESS_TOKEN_KEY = 'access_token';
export { BILLING_PATH, consumeBillingRequiredMessage, redirectToBilling } from './paymentRequired';

const AUTH_ROUTES = new Set(['/login', '/signup', '/forgot-password', '/reset-password']);

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

/** Client-side navigation — avoids full reload that unmounts the app shell. */
function redirectToLogin(): void {
  const { pathname } = window.location;
  if (isAuthRoute(pathname)) return;
  window.history.replaceState(null, '', '/login');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

const baseURL = String(import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .trim()
  .replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem('bettano_auth_user');
      localStorage.removeItem('bettano_current_user');
      redirectToLogin();
    } else if (error.response?.status === 402) {
      handlePaymentRequiredStatus(402, error.response?.data?.detail);
    }
    return Promise.reject(error);
  }
);

/** Merge Bearer token into fetch init — same key/interceptor as axios `api`. */
export function withBearerAuth(init: RequestInit = {}): RequestInit {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return init;

  const existing: Record<string, string> =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers)
        ? Object.fromEntries(init.headers)
        : { ...(init.headers as Record<string, string> | undefined) };

  return {
    ...init,
    headers: {
      ...existing,
      Authorization: `Bearer ${token}`,
    },
  };
}

/** Authenticated fetch for services that cannot use the axios instance. */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, withBearerAuth(init));
  if (response.status === 402) {
    const body = await response.clone().json().catch(() => ({}));
    handlePaymentRequiredStatus(402, (body as { detail?: unknown })?.detail);
  }
  return response;
}

export default api;
