import api from '../../api/axios';
import type {
  BillingPlanSlug,
  CheckoutSessionResponse,
  PortalSessionResponse,
  TenantBillingInfo,
} from './billingTypes';

export function extractApiDetail(error: unknown, fallback: string): string {
  const axiosErr = error as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = axiosErr.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item: { msg?: string; loc?: (string | number)[] }) => {
        const field = item.loc?.[item.loc.length - 1] ?? 'field';
        return `${field}: ${item.msg ?? 'invalid'}`;
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  if (axiosErr.message && !axiosErr.response) {
    return axiosErr.message;
  }
  return fallback;
}

export async function getTenantBilling(): Promise<TenantBillingInfo> {
  const res = await api.get<TenantBillingInfo>('/api/tenants/me');
  return res.data;
}

export async function createCheckoutSession(plan: BillingPlanSlug): Promise<void> {
  const res = await api.post<CheckoutSessionResponse>('/api/billing/checkout-session', { plan });
  const url = res.data.checkout_url;
  if (!url) {
    throw new Error('Checkout session did not return a URL.');
  }
  window.location.href = url;
}

export async function createPortalSession(): Promise<void> {
  const res = await api.post<PortalSessionResponse>('/api/billing/portal-session');
  const url = res.data.portal_url;
  if (!url) {
    throw new Error('Portal session did not return a URL.');
  }
  window.location.href = url;
}
